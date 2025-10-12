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
import { db, getServiceRoleDb } from '@/lib/db';
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

      console.log('[Auth] Starting signup for:', email);

      // Use service role DB to bypass RLS (no auth exists yet during signup)
      const serviceDb = getServiceRoleDb();
      console.log('[Auth] Service role DB initialized');

      try {
        // 1. Check if email already exists
        console.log('[Auth] Checking if email exists...');
        const existingUser = await serviceDb.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (existingUser) {
          console.log('[Auth] Email already exists');
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un compte avec cet email existe déjà',
          });
        }

        // 2. Create tenant first (needed for app_metadata)
        console.log('[Auth] Creating tenant...');
        const slug = generateTenantSlug(companyName);
        const [tenant] = await serviceDb
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
          console.error('[Auth] Tenant creation returned null');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'entreprise',
          });
        }

        console.log('[Auth] Tenant created:', tenant.id);

        // 3. Create Supabase auth user with app_metadata
        console.log('[Auth] Creating Supabase auth user...');
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
          await serviceDb.delete(tenants).where(eq(tenants.id, tenant.id));
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur lors de la création du compte: ${authError?.message || 'Unknown error'}`,
          });
        }

        console.log('[Auth] Supabase user created:', authData.user.id);

        // 4. Create user in database
        console.log('[Auth] Creating user in database...');
        const [user] = await serviceDb
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
          console.error('[Auth] User creation returned null');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'utilisateur',
          });
        }

        console.log('[Auth] User created successfully:', user.id);

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
        console.error('[Auth] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        // Provide more detailed error for debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erreur lors de l'inscription: ${errorMessage}`,
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
    // Fetch user and tenant info
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }

    // Fetch tenant separately
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, user.tenantId),
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      companyName: tenant?.name || '',
    };
  }),
});
