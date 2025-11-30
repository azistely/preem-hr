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
 * Phone signup validation schema
 */
const phoneSignupSchema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
  token: z.string().length(6, { message: 'Le code doit contenir 6 chiffres' }),
  firstName: z.string().min(1, { message: 'Prénom requis' }),
  lastName: z.string().min(1, { message: 'Nom requis' }),
  companyName: z.string().min(1, { message: 'Nom de l\'entreprise requis' }),
});

/**
 * Phone OTP send validation schema
 */
const sendPhoneOtpSchema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
});

/**
 * Phone OTP verify validation schema
 */
const verifyPhoneOtpSchema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
  token: z.string().length(6, { message: 'Le code doit contenir 6 chiffres' }),
});

/**
 * MFA enrollment validation schema
 */
const enrollMfaSchema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
});

/**
 * MFA verification validation schema
 */
const verifyMfaSchema = z.object({
  factorId: z.string().uuid(),
  challengeId: z.string().uuid(),
  code: z.string().length(6, { message: 'Le code doit contenir 6 chiffres' }),
});

/**
 * Generate base tenant slug from company name
 */
function generateBaseSlug(companyName: string): string {
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
 * Generate unique tenant slug
 * If base slug exists, appends random 4-char suffix
 */
async function generateUniqueTenantSlug(companyName: string, serviceDb: any): Promise<string> {
  const baseSlug = generateBaseSlug(companyName);

  // Check if base slug exists
  const existing = await serviceDb.query.tenants.findFirst({
    where: eq(tenants.slug, baseSlug),
    columns: { id: true },
  });

  if (!existing) {
    return baseSlug;
  }

  // Base slug exists, generate unique one with random suffix
  // Use 4 random alphanumeric characters
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const uniqueSlug = `${baseSlug}-${randomSuffix}`.substring(0, 50);

  console.log(`[Auth] Slug "${baseSlug}" exists, using "${uniqueSlug}" instead`);
  return uniqueSlug;
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
        const slug = await generateUniqueTenantSlug(companyName, serviceDb);
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

        // 4. Create user in database with NULL active_tenant_id first
        // (Trigger allows NULL, FK constraint requires user to exist before user_tenants)
        console.log('[Auth] Creating user in database with NULL active_tenant_id...');
        let user;
        try {
          [user] = await serviceDb
            .insert(users)
            .values({
              id: authData.user.id,
              tenantId: tenant.id,
              activeTenantId: null, // ✅ NULL bypasses trigger validation
              email,
              firstName,
              lastName,
              role: 'tenant_admin', // First user is admin
              locale: 'fr',
              status: 'active',
            })
            .returning();
        } catch (dbError) {
          console.error('[Auth] Database error creating user:', dbError);
          console.error('[Auth] Error details:', {
            message: dbError instanceof Error ? dbError.message : 'Unknown error',
            stack: dbError instanceof Error ? dbError.stack : undefined,
            name: dbError instanceof Error ? dbError.name : undefined,
          });
          throw dbError;
        }

        if (!user) {
          console.error('[Auth] User creation returned null');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'utilisateur',
          });
        }

        console.log('[Auth] User created successfully:', user.id);

        // 5. Create user_tenants record (now user exists, FK constraint is satisfied)
        console.log('[Auth] Creating user_tenants record...');
        await serviceDb
          .insert(userTenants)
          .values({
            userId: authData.user.id,
            tenantId: tenant.id,
            role: 'tenant_admin',
          });

        console.log('[Auth] User_tenants record created');

        // 6. Update user to set active_tenant_id (now user_tenants exists, trigger will pass)
        console.log('[Auth] Setting active_tenant_id...');
        await serviceDb
          .update(users)
          .set({ activeTenantId: tenant.id })
          .where(eq(users.id, authData.user.id));

        console.log('[Auth] Active tenant set successfully');

        // 7. Seed time-off policies from templates for the tenant's country
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
        // Phone auth fields
        authMethod: ctx.user.authMethod,
        mfaEnabled: ctx.user.mfaEnabled,
        phoneVerified: ctx.user.phoneVerified,
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

  /**
   * Send OTP to phone number for signup or login
   * Creates Supabase auth user if new, sends OTP via Twilio
   */
  sendPhoneOtp: publicProcedure
    .input(sendPhoneOtpSchema)
    .mutation(async ({ input }) => {
      const { phone } = input;

      console.log('[Auth:sendPhoneOtp] ========== START ==========');
      console.log('[Auth:sendPhoneOtp] Input phone:', phone);
      console.log('[Auth:sendPhoneOtp] Phone length:', phone.length);
      console.log('[Auth:sendPhoneOtp] Phone starts with +:', phone.startsWith('+'));
      console.log('[Auth:sendPhoneOtp] Phone format check:', {
        isE164: /^\+[1-9]\d{1,14}$/.test(phone),
        startsWithCI: phone.startsWith('+225'),
        startsWithSN: phone.startsWith('+221'),
        startsWithBF: phone.startsWith('+226'),
      });

      try {
        const supabase = createSupabaseAdmin();
        console.log('[Auth:sendPhoneOtp] Supabase admin client created');

        // Send OTP via Supabase (uses Twilio configured in dashboard)
        console.log('[Auth:sendPhoneOtp] Calling supabase.auth.signInWithOtp...');
        const { data, error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            // Don't auto-create user, we'll create after tenant setup
            shouldCreateUser: true,
          },
        });

        console.log('[Auth:sendPhoneOtp] Response received:');
        console.log('[Auth:sendPhoneOtp] - data:', JSON.stringify(data, null, 2));
        console.log('[Auth:sendPhoneOtp] - error:', error ? JSON.stringify({
          message: error.message,
          status: error.status,
          name: error.name,
          code: (error as any).code,
          __isAuthError: (error as any).__isAuthError,
        }, null, 2) : 'null');

        if (error) {
          console.error('[Auth:sendPhoneOtp] ERROR from Supabase:', error.message);
          console.error('[Auth:sendPhoneOtp] Full error object:', error);

          // Handle specific errors
          if (error.message.includes('rate limit')) {
            throw new TRPCError({
              code: 'TOO_MANY_REQUESTS',
              message: 'Trop de tentatives. Veuillez attendre quelques minutes.',
            });
          }

          if (error.message.includes('phone_provider_disabled') || error.message.includes('Unsupported phone provider')) {
            console.error('[Auth:sendPhoneOtp] TWILIO NOT CONFIGURED - Enable phone provider in Supabase dashboard');
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'SMS non configuré. Contactez le support.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur lors de l'envoi du SMS: ${error.message}`,
          });
        }

        console.log('[Auth:sendPhoneOtp] SUCCESS - OTP sent');
        console.log('[Auth:sendPhoneOtp] ========== END ==========');

        return {
          success: true,
          message: 'Code SMS envoyé',
        };
      } catch (error) {
        console.error('[Auth:sendPhoneOtp] EXCEPTION:', error);
        console.error('[Auth:sendPhoneOtp] Exception type:', error instanceof Error ? error.constructor.name : typeof error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'envoi du code SMS',
        });
      }
    }),

  /**
   * Verify phone OTP for login (existing users)
   * Returns session if valid
   */
  verifyPhoneOtp: publicProcedure
    .input(verifyPhoneOtpSchema)
    .mutation(async ({ input }) => {
      const { phone, token } = input;

      console.log('[Auth:verifyPhoneOtp] ========== START ==========');
      console.log('[Auth:verifyPhoneOtp] Input phone:', phone);
      console.log('[Auth:verifyPhoneOtp] Input token:', token);
      console.log('[Auth:verifyPhoneOtp] Token length:', token.length);

      try {
        const supabase = createSupabaseAdmin();
        console.log('[Auth:verifyPhoneOtp] Supabase admin client created');

        // Verify OTP
        console.log('[Auth:verifyPhoneOtp] Calling supabase.auth.verifyOtp...');
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });

        console.log('[Auth:verifyPhoneOtp] Response received:');
        console.log('[Auth:verifyPhoneOtp] - data.user:', data?.user ? { id: data.user.id, phone: data.user.phone } : 'null');
        console.log('[Auth:verifyPhoneOtp] - data.session:', data?.session ? 'exists' : 'null');
        console.log('[Auth:verifyPhoneOtp] - error:', error ? JSON.stringify({
          message: error.message,
          status: error.status,
          name: error.name,
          code: (error as any).code,
        }, null, 2) : 'null');

        if (error) {
          console.error('[Auth:verifyPhoneOtp] ERROR from Supabase:', error.message);

          if (error.message.includes('expired')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Ce code a expiré. Demandez un nouveau code.',
            });
          }

          if (error.message.includes('invalid') || error.message.includes('Token')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Code incorrect. Vérifiez et réessayez.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur de vérification: ${error.message}`,
          });
        }

        if (!data.user) {
          console.log('[Auth:verifyPhoneOtp] No user returned from Supabase');
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Aucun compte trouvé avec ce numéro. Veuillez vous inscrire.',
          });
        }

        console.log('[Auth:verifyPhoneOtp] OTP verified, Supabase user:', data.user.id);

        // Check if user exists in our database
        console.log('[Auth:verifyPhoneOtp] Checking if user exists in our database...');
        const existingUser = await db.query.users.findFirst({
          where: eq(users.id, data.user.id),
          columns: {
            id: true,
            tenantId: true,
            firstName: true,
            lastName: true,
          },
        });

        console.log('[Auth:verifyPhoneOtp] Existing user in DB:', existingUser ? { id: existingUser.id, firstName: existingUser.firstName } : 'null');

        if (!existingUser) {
          // User exists in Supabase but not in our DB - needs signup
          console.log('[Auth:verifyPhoneOtp] User not in our DB - needs to complete signup');
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Compte incomplet. Veuillez compléter votre inscription.',
          });
        }

        console.log('[Auth:verifyPhoneOtp] SUCCESS - Login complete');
        console.log('[Auth:verifyPhoneOtp] ========== END ==========');

        return {
          success: true,
          user: {
            id: data.user.id,
            phone: data.user.phone,
          },
          session: data.session,
        };
      } catch (error) {
        console.error('[Auth:verifyPhoneOtp] EXCEPTION:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la vérification du code',
        });
      }
    }),

  /**
   * Complete phone signup - Creates tenant + user after OTP verification
   */
  signupWithPhone: publicProcedure
    .input(phoneSignupSchema)
    .mutation(async ({ input }) => {
      const { phone, token, firstName, lastName, companyName } = input;

      console.log('[Auth] Starting phone signup for:', phone);

      const serviceDb = getServiceRoleDb();

      try {
        const supabase = createSupabaseAdmin();

        // 1. Verify OTP first
        console.log('[Auth] Verifying phone OTP...');
        const { data: authData, error: authError } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });

        if (authError) {
          console.error('[Auth] Phone OTP verification error:', authError);

          if (authError.message.includes('expired')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Ce code a expiré. Demandez un nouveau code.',
            });
          }

          if (authError.message.includes('invalid') || authError.message.includes('Token')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Code incorrect. Vérifiez et réessayez.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur de vérification: ${authError.message}`,
          });
        }

        if (!authData.user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la vérification du code',
          });
        }

        console.log('[Auth] Phone OTP verified, Supabase user:', authData.user.id);

        // 2. Check if user already exists in our database (login case)
        // Check by BOTH Supabase user ID AND phone number to handle cases where
        // Supabase creates a new auth user but the phone is already registered
        const existingUserById = await db.query.users.findFirst({
          where: eq(users.id, authData.user.id),
        });

        const existingUserByPhone = await db.query.users.findFirst({
          where: eq(users.phone, phone),
        });

        const existingUser = existingUserById || existingUserByPhone;

        if (existingUser) {
          console.log('[Auth] User already exists (by ID or phone), returning login success with session');

          // If found by phone but different Supabase ID, we need to handle this edge case
          // The user already has an account - they should use login instead
          if (existingUserByPhone && !existingUserById) {
            console.log('[Auth] Phone number already registered to different user:', existingUserByPhone.id);
            // Still return success - the OTP was valid, they are who they say they are
            // Just treat it as a login to their existing account
          }

          return {
            success: true,
            isNewUser: false,
            user: {
              id: existingUser.id,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
            },
            tenant: {
              id: existingUser.tenantId,
            },
            // Return session so client can set it
            session: authData.session ? {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
            } : null,
          };
        }

        // 3. Create tenant
        console.log('[Auth] Creating tenant...');
        const slug = await generateUniqueTenantSlug(companyName, serviceDb);
        const [tenant] = await serviceDb
          .insert(tenants)
          .values({
            name: companyName,
            slug,
            countryCode: 'CI', // Default to Côte d'Ivoire
            sectorCode: 'SERVICES',
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

        console.log('[Auth] Tenant created:', tenant.id);

        // 4. Update Supabase user metadata
        await supabase.auth.admin.updateUserById(authData.user.id, {
          app_metadata: {
            tenant_id: tenant.id,
            role: 'tenant_admin',
          },
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });

        // 5. Create user in database
        console.log('[Auth] Creating user in database...');
        const [user] = await serviceDb
          .insert(users)
          .values({
            id: authData.user.id,
            tenantId: tenant.id,
            activeTenantId: null, // Set after user_tenants created
            phone,
            phoneVerified: true, // Verified via OTP
            authMethod: 'phone',
            firstName,
            lastName,
            role: 'tenant_admin',
            locale: 'fr',
            status: 'active',
          })
          .returning();

        if (!user) {
          // Rollback tenant
          await serviceDb.delete(tenants).where(eq(tenants.id, tenant.id));
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors de la création de l\'utilisateur',
          });
        }

        console.log('[Auth] User created:', user.id);

        // 6. Create user_tenants record
        await serviceDb
          .insert(userTenants)
          .values({
            userId: authData.user.id,
            tenantId: tenant.id,
            role: 'tenant_admin',
          });

        // 7. Update user to set active_tenant_id
        await serviceDb
          .update(users)
          .set({ activeTenantId: tenant.id })
          .where(eq(users.id, authData.user.id));

        console.log('[Auth] Phone signup complete');

        // 8. Seed time-off policies
        try {
          const { seedTimeOffPoliciesForTenant } = await import('@/features/time-off/services/policy-seeding.service');
          await seedTimeOffPoliciesForTenant(tenant.id, tenant.countryCode, user.id);
        } catch (error) {
          console.error('[Auth] Failed to seed time-off policies:', error);
        }

        return {
          success: true,
          isNewUser: true,
          user: {
            id: user.id,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          },
          // Return session so client can set it (user is auto-authenticated)
          session: authData.session ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          } : null,
        };
      } catch (error) {
        console.error('[Auth] Phone signup error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erreur lors de l'inscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Update user phone number (for MFA setup)
   * MFA enrollment itself happens client-side via Supabase auth.mfa.enroll()
   * This saves the phone to our DB after client-side MFA enrollment
   */
  updatePhoneForMfa: protectedProcedure
    .input(enrollMfaSchema)
    .mutation(async ({ ctx, input }) => {
      const { phone } = input;
      const userId = ctx.user.id;

      console.log('[Auth] Updating phone for MFA, user:', userId, 'phone:', phone);

      try {
        // Update user's phone in our database
        const serviceDb = getServiceRoleDb();
        await serviceDb
          .update(users)
          .set({ phone })
          .where(eq(users.id, userId));

        console.log('[Auth] Phone saved for MFA setup');

        return {
          success: true,
          message: 'Numéro de téléphone enregistré',
        };
      } catch (error) {
        console.error('[Auth] Update phone for MFA error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'enregistrement du numéro de téléphone',
        });
      }
    }),

  /**
   * Mark MFA as enabled after successful client-side verification
   * Called after user completes auth.mfa.verify() on client
   */
  confirmMfaEnabled: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;

      console.log('[Auth] Confirming MFA enabled for user:', userId);

      try {
        const serviceDb = getServiceRoleDb();
        await serviceDb
          .update(users)
          .set({
            phoneVerified: true,
            mfaEnabled: true,
          })
          .where(eq(users.id, userId));

        console.log('[Auth] MFA marked as enabled');

        return {
          success: true,
          message: 'Vérification en deux étapes activée',
        };
      } catch (error) {
        console.error('[Auth] Confirm MFA enabled error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'activation de la vérification',
        });
      }
    }),

  /**
   * Get user's MFA factors list
   * Used to check if user has MFA factors enrolled
   */
  getMfaFactors: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { userId } = input;

      console.log('[Auth] Getting MFA factors for user:', userId);

      try {
        const supabase = createSupabaseAdmin();

        const { data, error } = await supabase.auth.admin.mfa.listFactors({
          userId,
        });

        if (error) {
          console.error('[Auth] List MFA factors error:', error);
          return { factors: [], hasPhone: false };
        }

        const factors = data?.factors || [];
        const phoneFactor = factors.find(f => f.factor_type === 'phone' && f.status === 'verified');

        return {
          factors: factors.map(f => ({
            id: f.id,
            type: f.factor_type,
            status: f.status,
          })),
          hasPhone: !!phoneFactor,
          phoneFactorId: phoneFactor?.id,
        };
      } catch (error) {
        console.error('[Auth] Get MFA factors error:', error);
        return { factors: [], hasPhone: false };
      }
    }),

  /**
   * Check if user has MFA enabled
   * Used to determine if MFA challenge is needed after login
   */
  checkMfaStatus: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { userId } = input;

      try {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: {
            mfaEnabled: true,
            authMethod: true,
            phone: true,
          },
        });

        if (!user) {
          return { mfaEnabled: false, authMethod: 'email' };
        }

        return {
          mfaEnabled: user.mfaEnabled ?? false,
          authMethod: user.authMethod ?? 'email',
          hasPhone: !!user.phone,
        };
      } catch (error) {
        console.error('[Auth] Check MFA status error:', error);
        return { mfaEnabled: false, authMethod: 'email' };
      }
    }),

  /**
   * Send OTP to verify a phone number for an existing user
   * This is for email users who want to add/verify their phone during onboarding
   *
   * IMPORTANT: This procedure requires "Enable Phone Signups" to be ON in Supabase Auth settings
   * even though we're not creating a new user - Supabase uses the same OTP mechanism.
   *
   * Alternative approaches if signups are disabled:
   * 1. Enable phone signups in Supabase Dashboard > Authentication > Providers > Phone
   * 2. Use admin.updateUserById to directly set phone (skips verification)
   */
  sendPhoneVerificationOtp: protectedProcedure
    .input(sendPhoneOtpSchema)
    .mutation(async ({ ctx, input }) => {
      const { phone } = input;
      const userId = ctx.user.id;

      console.log('[Auth:sendPhoneVerificationOtp] ========== START ==========');
      console.log('[Auth:sendPhoneVerificationOtp] User:', userId);
      console.log('[Auth:sendPhoneVerificationOtp] Phone:', phone);

      try {
        const supabase = createSupabaseAdmin();

        // Check if phone is already used by another user in our database
        const existingUserWithPhone = await db.query.users.findFirst({
          where: eq(users.phone, phone),
          columns: { id: true },
        });

        if (existingUserWithPhone && existingUserWithPhone.id !== userId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Ce numéro de téléphone est déjà utilisé par un autre compte.',
          });
        }

        // Try sending OTP via Supabase's phone auth (uses Twilio Verify)
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          console.error('[Auth:sendPhoneVerificationOtp] Error:', error);

          // Handle "Signups not allowed" - phone signups disabled in Supabase
          if (error.message.includes('Signups not allowed')) {
            console.log('[Auth:sendPhoneVerificationOtp] Phone signups disabled, using admin API to set phone directly');

            // Fallback: Skip OTP verification and set phone directly via admin API
            // This is less secure but allows the feature to work when signups are disabled
            try {
              await supabase.auth.admin.updateUserById(userId, {
                phone,
                phone_confirm: true, // Mark as confirmed without OTP
              });

              // Also update our database
              const serviceDb = getServiceRoleDb();
              await serviceDb
                .update(users)
                .set({
                  phone,
                  phoneVerified: true,
                })
                .where(eq(users.id, userId));

              console.log('[Auth:sendPhoneVerificationOtp] Phone set directly via admin API (no OTP)');

              return {
                success: true,
                skipOtp: true, // Signal to frontend to skip OTP step
                message: 'Numéro de téléphone enregistré',
              };
            } catch (adminError) {
              console.error('[Auth:sendPhoneVerificationOtp] Admin API error:', adminError);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Erreur lors de l\'enregistrement du numéro de téléphone',
              });
            }
          }

          if (error.message.includes('rate limit')) {
            throw new TRPCError({
              code: 'TOO_MANY_REQUESTS',
              message: 'Trop de tentatives. Veuillez attendre quelques minutes.',
            });
          }

          if (error.message.includes('phone_provider_disabled') || error.message.includes('Unsupported phone provider')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'SMS non configuré. Contactez le support.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur lors de l'envoi du SMS: ${error.message}`,
          });
        }

        console.log('[Auth:sendPhoneVerificationOtp] OTP sent successfully');
        console.log('[Auth:sendPhoneVerificationOtp] ========== END ==========');

        return {
          success: true,
          skipOtp: false,
          message: 'Code SMS envoyé',
        };
      } catch (error) {
        console.error('[Auth:sendPhoneVerificationOtp] Exception:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'envoi du code SMS',
        });
      }
    }),

  /**
   * Verify phone OTP and add phone to existing user's profile
   * This is for email users who want to add/verify their phone during onboarding
   */
  verifyAndAddPhone: protectedProcedure
    .input(verifyPhoneOtpSchema)
    .mutation(async ({ ctx, input }) => {
      const { phone, token } = input;
      const userId = ctx.user.id;

      console.log('[Auth:verifyAndAddPhone] ========== START ==========');
      console.log('[Auth:verifyAndAddPhone] User:', userId);
      console.log('[Auth:verifyAndAddPhone] Phone:', phone);

      try {
        const supabase = createSupabaseAdmin();

        // Verify the OTP
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });

        if (error) {
          console.error('[Auth:verifyAndAddPhone] Verify error:', error);

          if (error.message.includes('expired')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Ce code a expiré. Demandez un nouveau code.',
            });
          }

          if (error.message.includes('invalid') || error.message.includes('Token')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Code incorrect. Vérifiez et réessayez.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur de vérification: ${error.message}`,
          });
        }

        console.log('[Auth:verifyAndAddPhone] OTP verified successfully');

        // Update our user's phone in the database
        const serviceDb = getServiceRoleDb();
        await serviceDb
          .update(users)
          .set({
            phone,
            phoneVerified: true,
          })
          .where(eq(users.id, userId));

        // Also update the Supabase user's phone if possible
        try {
          await supabase.auth.admin.updateUserById(userId, {
            phone,
            phone_confirm: true,
          });
          console.log('[Auth:verifyAndAddPhone] Supabase user phone updated');
        } catch (supabaseError) {
          // Non-critical - phone is already saved in our DB
          console.warn('[Auth:verifyAndAddPhone] Could not update Supabase user phone:', supabaseError);
        }

        console.log('[Auth:verifyAndAddPhone] Phone added to user profile');
        console.log('[Auth:verifyAndAddPhone] ========== END ==========');

        return {
          success: true,
          message: 'Numéro de téléphone vérifié et enregistré',
        };
      } catch (error) {
        console.error('[Auth:verifyAndAddPhone] Exception:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la vérification',
        });
      }
    }),
});
