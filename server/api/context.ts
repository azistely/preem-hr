/**
 * tRPC Context (v11)
 *
 * Defines the context available to all tRPC procedures.
 * Uses React cache for deduplication.
 */

import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { cache } from 'react';
import 'server-only';
import { db } from '@/lib/db';
import { sql, eq } from 'drizzle-orm';
import { users, tenants } from '@/drizzle/schema';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * User role definitions
 */
export type UserRole = 'super_admin' | 'tenant_admin' | 'hr_manager' | 'manager' | 'employee';

/**
 * Development-only mock tenant for testing RLS
 * Only used when Supabase auth is not available
 */
const DEV_MOCK_TENANT = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'tenant_admin' as UserRole,
};

/**
 * Development-only mock user
 * Only used when Supabase auth is not available
 */
const DEV_MOCK_USER = {
  id: 'cb127444-aac4-45a5-8682-93d5f7ef5775',
  email: 'admin@preem.hr',
  firstName: 'Admin',
  lastName: 'Preem',
  role: 'tenant_admin' as UserRole,
  tenantId: '00000000-0000-0000-0000-000000000001',
  activeTenantId: '00000000-0000-0000-0000-000000000001',
  employeeId: null as string | null,
  companyName: 'Dev Company',
  onboardingComplete: true,
  authMethod: 'email' as const,
  mfaEnabled: true,
  phoneVerified: true,
};

/**
 * Extract user from Supabase session (optimized with local JWT decode)
 */
async function getUserFromSession() {
  const startTime = Date.now();
  try {
    const t1 = Date.now();
    const cookieStore = await cookies();
    console.log(`[Context] cookies() took ${Date.now() - t1}ms`);

    const t2 = Date.now();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );
    console.log(`[Context] createServerClient took ${Date.now() - t2}ms`);

    // ✅ OPTIMIZATION: Use getSession() instead of getUser()
    // getSession() reads from cookies without network call (instant)
    // getUser() makes network request to Supabase Auth API (5-9s)
    // Security: Session is still validated via JWT signature
    const t3 = Date.now();
    const { data: { session } } = await supabase.auth.getSession();
    console.log(`[Context] getSession() took ${Date.now() - t3}ms`);

    if (!session?.user) {
      // No authenticated user - return null to use dev mock or trigger auth error
      console.log(`[Context] No session found, total time: ${Date.now() - startTime}ms`);
      return null;
    }

    const authUser = session.user;

    // ✅ OPTIMIZATION: Fetch user + tenant in parallel (single round-trip)
    // This avoids auth.me needing to re-query the same data
    const t4 = Date.now();
    const [user, tenant] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, authUser.id),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          activeTenantId: true,
          employeeId: true,
          authMethod: true,
          mfaEnabled: true,
          phoneVerified: true,
        },
      }),
      // Fetch tenant info to avoid second query in auth.me
      db.query.tenants.findFirst({
        where: eq(tenants.id, authUser.app_metadata?.tenant_id || ''),
        columns: {
          id: true,
          name: true,
          slug: true,
          countryCode: true,
          settings: true,
        },
      }),
    ]);
    console.log(`[Context] Parallel DB queries took ${Date.now() - t4}ms`);

    if (!user) {
      console.warn('[Context] User authenticated but not found in database:', authUser.id);
      return null;
    }

    console.log(`[Context] getUserFromSession total time: ${Date.now() - startTime}ms`);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      // TENANT ISOLATION FIX: Always use effective tenant (activeTenantId if set, otherwise tenantId)
      // This ensures ctx.user.tenantId throughout the codebase reflects the currently active tenant
      tenantId: user.activeTenantId || user.tenantId,
      activeTenantId: user.activeTenantId, // Keep for audit trail
      employeeId: user.employeeId,
      // Include tenant info to avoid re-querying
      companyName: tenant?.name || '',
      onboardingComplete: (tenant?.settings as any)?.onboarding?.onboarding_complete || false,
      // Auth method and MFA status for phone authentication flow
      authMethod: user.authMethod || 'email',
      mfaEnabled: user.mfaEnabled || false,
      phoneVerified: user.phoneVerified || false,
    };
  } catch (error) {
    console.error('[Context] Error extracting user from session:', error);
    console.log(`[Context] Error after ${Date.now() - startTime}ms`);
    return null;
  }
}

/**
 * Create context for tRPC
 * Cached to prevent duplicate calls in Server Components
 */
export const createTRPCContext = cache(async (opts?: CreateNextContextOptions) => {
  const { req } = opts || {};

  // Extract user from Supabase session (production) or use dev mock
  const user = await getUserFromSession();
  const hasRealSession = user !== null;

  // Set PostgreSQL session variables for RLS policies
  // This allows RLS policies to access tenant_id via current_setting()
  // Only set config if we have a real authenticated user (not for public procedures like signup)
  if (user) {
    try {
      const rlsStart = Date.now();
      // Use activeTenantId if set, otherwise fall back to tenantId (for backward compatibility)
      const effectiveTenantId = user.activeTenantId || user.tenantId;

      await db.execute(sql`
        SELECT set_config('app.tenant_id', ${effectiveTenantId}, true),
               set_config('app.user_role', ${user.role}, true),
               set_config('app.user_id', ${user.id}, true);
      `);
      console.log(`[Context] RLS config set (tenant: ${effectiveTenantId}) in ${Date.now() - rlsStart}ms`);
    } catch (error) {
      console.error('[Context] Failed to set RLS config:', error);
      // Don't throw - allow unauthenticated requests to proceed
    }
  }

  return {
    user: user || DEV_MOCK_USER, // Use dev mock for backward compatibility
    hasRealSession, // Track if user has a real authenticated session
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
