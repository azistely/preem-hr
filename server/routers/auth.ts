/**
 * Auth Router (tRPC v11)
 *
 * Handles user authentication flows:
 * - Signup (creates tenant + user)
 * - Login
 * - Logout
 * - Session management
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '@/server/api/trpc';
import { db } from '@/lib/db';
import { tenants, users } from '@/drizzle/schema';
import { createClient } from '@supabase/supabase-js';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

/**
 * Create Supabase admin client for server-side auth operations
 */
function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Validation schemas
 */
const signupSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(8, { message: 'Mot de passe trop court (minimum 8 caractères)' }),
  firstName: z.string().min(1, { message: 'Prénom requis' }),
  lastName: z.string().min(1, { message: 'Nom requis' }),
  companyName: z.string().min(1, { message: 'Nom de l\'entreprise requis' }),
});

const loginSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(1, { message: 'Mot de passe requis' }),
});

/**
 * Generate tenant slug from company name
 */
function generateTenantSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to dashes
    .replace(/-+/g, '-') // Multiple dashes to single
    .replace(/^-|-$/g, '') // Trim dashes
    .substring(0, 50); // Max length
}

/**
 * Auth Router
 */
export const authRouter = router({
  /**
   * Signup - Create new tenant + user account
   */
  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ input }) => {
      const { email, password, firstName, lastName, companyName } = input;

      try {
        // 1. Check if email already exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un compte avec cet email existe déjà',
          });
        }

        // 2. Create tenant first (needed for app_metadata)
        const slug = generateTenantSlug(companyName);
        const [tenant] = await db
          .insert(tenants)
          .values({
            name: companyName,
            slug,
            countryCode: 'CI', // Default to Côte d'Ivoire
            sectorCode: 'SERVICES', // Default sector (lowest risk, most common)
            currency: 'XOF',
            timezone: 'Africa/Abidjan',
            plan: 'trial',
            status: 'active',
          })
          .returning();

        if (!tenant) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'entreprise',
          });
        }

        // 3. Create Supabase auth user with app_metadata
        const supabase = createSupabaseAdmin();
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email for now
          app_metadata: {
            tenant_id: tenant.id,
            role: 'tenant_admin', // First user is admin
          },
        });

        if (authError || !authData.user) {
          console.error('[Auth] Supabase signup error:', authError);
          // Rollback: delete tenant if user creation failed
          await db.delete(tenants).where(eq(tenants.id, tenant.id));
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création du compte',
          });
        }

        // 4. Create user in database
        const [user] = await db
          .insert(users)
          .values({
            id: authData.user.id,
            tenantId: tenant.id,
            email,
            firstName,
            lastName,
            role: 'tenant_admin', // First user is admin
            locale: 'fr',
            status: 'active',
          })
          .returning();

        if (!user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'utilisateur',
          });
        }

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          },
        };
      } catch (error) {
        console.error('[Auth] Signup error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'inscription',
        });
      }
    }),

  /**
   * Get user by ID - Used after client-side login
   */
  getUserById: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.id, input.userId),
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenantId: true,
          },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Utilisateur non trouvé',
          });
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
          },
        };
      } catch (error) {
        console.error('[Auth] Get user error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération de l\'utilisateur',
        });
      }
    }),

  /**
   * Get current authenticated user with full details
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    // Fetch full user details with tenant info
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      with: {
        tenant: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      companyName: user.tenant.name,
    };
  }),
});
