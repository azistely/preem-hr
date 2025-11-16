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
import { tenants, users, userTenants } from '@/drizzle/schema';
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
        // ✅ OPTIMIZATION: Skip email check, let Supabase Auth handle it
        // BEFORE: listUsers() fetches ALL users (~500-1000ms), then filters client-side
        // AFTER: Let signUp fail with proper error if email exists (0ms upfront)
        // Supabase Auth will return proper error if email is duplicate
        console.log('[Auth] Starting signup (email duplicate check handled by Supabase)...');
        const supabase = createSupabaseAdmin();

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
        // Using signUp instead of admin.createUser to trigger automatic confirmation email
        console.log('[Auth] Creating Supabase auth user...');
        // supabase already created above for email check

        // Option 1: Use regular signUp (sends confirmation email automatically)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              tenant_id: tenant.id,
              role: 'tenant_admin',
              first_name: firstName,
              last_name: lastName,
            },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
          },
        });

        // Update app_metadata using admin API (signUp puts data in user_metadata, not app_metadata)
        if (authData.user) {
          await supabase.auth.admin.updateUserById(authData.user.id, {
            app_metadata: {
              tenant_id: tenant.id,
              role: 'tenant_admin',
            },
          });
        }

        if (authError || !authData.user) {
          console.error('[Auth] Supabase signup error:', authError);
          // Rollback: delete tenant if user creation failed
          await serviceDb.delete(tenants).where(eq(tenants.id, tenant.id));

          // ✅ OPTIMIZATION: Better error handling for duplicate emails
          // Check if error is duplicate email (Supabase returns 'User already registered')
          const isDuplicateEmail = authError?.message?.toLowerCase().includes('already registered') ||
            authError?.message?.toLowerCase().includes('already exists');

          throw new TRPCError({
            code: isDuplicateEmail ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
            message: isDuplicateEmail
              ? 'Un compte avec cet email existe déjà'
              : `Erreur lors de la création du compte: ${authError?.message || 'Unknown error'}`,
          });
        }

        console.log('[Auth] Supabase user created:', authData.user.id);
        console.log('[Auth] Confirmation email sent automatically by Supabase');

        // 4. Create user in database
        console.log('[Auth] Creating user in database...');
        const [user] = await serviceDb
          .insert(users)
          .values({
            id: authData.user.id,
            tenantId: tenant.id,
            activeTenantId: tenant.id, // Set active tenant on signup
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

        // 5. Create user_tenants record (many-to-many relationship)
        console.log('[Auth] Creating user_tenants record...');
        await serviceDb
          .insert(userTenants)
          .values({
            userId: user.id,
            tenantId: tenant.id,
            role: 'tenant_admin',
          });

        console.log('[Auth] User_tenants record created');

        // 6. Seed time-off policies from templates for the tenant's country
        let policiesSeeded = 0;
        try {
          const { seedTimeOffPoliciesForTenant } = await import('@/features/time-off/services/policy-seeding.service');
          policiesSeeded = await seedTimeOffPoliciesForTenant(
            tenant.id,
            tenant.countryCode,
            user.id
          );
          console.log(`[Auth] Seeded ${policiesSeeded} time-off policies for ${tenant.name}`);
        } catch (error) {
          // Log error but don't fail signup
          console.error('[Auth] Failed to seed time-off policies:', error);
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
   *
   * ✅ MAJOR OPTIMIZATION: Context already has user + tenant data!
   * BEFORE: 4 DB queries (user, tenant, available_tenants join)
   * AFTER: 0 DB queries for basic info, 1 optional query for availableTenants
   *
   * NOTE: Uses publicProcedure to allow unauthenticated access on marketing pages
   * Returns null if not authenticated, allowing graceful handling in UI
   */
  me: publicProcedure
    .input(z.object({
      includeAvailableTenants: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Return null if no real session (for marketing pages, login page, etc.)
      console.log('[auth.me] hasRealSession:', ctx.hasRealSession, 'user.id:', ctx.user?.id);

      if (!ctx.hasRealSession || !ctx.user) {
        console.log('[auth.me] No real session, returning null');
        return null;
      }

      // ✅ OPTIMIZATION: Use data from context (already fetched during context creation)
      // Context has: id, email, firstName, lastName, role, tenantId, activeTenantId,
      // employeeId, companyName, onboardingComplete
      const baseResponse = {
        id: ctx.user.id,
        email: ctx.user.email,
        firstName: ctx.user.firstName,
        lastName: ctx.user.lastName,
        role: ctx.user.role,
        tenantId: ctx.user.tenantId,
        activeTenantId: ctx.user.activeTenantId,
        employeeId: ctx.user.employeeId,
        companyName: ctx.user.companyName,
        onboardingComplete: ctx.user.onboardingComplete,
        // Basic tenant info from context
        currentTenant: ctx.user.tenantId ? {
          id: ctx.user.tenantId,
          name: ctx.user.companyName,
          slug: '', // Not critical for most use cases
          countryCode: '', // Fetch if needed
        } : null,
        // Empty by default - only fetch when explicitly requested
        availableTenants: [] as any[],
      };

      // ✅ LAZY LOAD: Only fetch availableTenants when explicitly requested
      // Most users only have 1 tenant, so this avoids an expensive join on every page load
      if (input?.includeAvailableTenants) {
        const availableTenants = await db
          .select({
            tenantId: userTenants.tenantId,
            tenantName: tenants.name,
            tenantSlug: tenants.slug,
            tenantCountryCode: tenants.countryCode,
            tenantStatus: tenants.status,
            userRole: userTenants.role,
          })
          .from(userTenants)
          .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
          .where(eq(userTenants.userId, ctx.user.id))
          .orderBy(tenants.name);

        baseResponse.availableTenants = availableTenants.map((t) => ({
          id: t.tenantId,
          name: t.tenantName,
          slug: t.tenantSlug,
          countryCode: t.tenantCountryCode,
          status: t.tenantStatus,
          userRole: t.userRole,
        }));
      }

      return baseResponse;
    }),
});
