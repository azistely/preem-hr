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
import { users } from '@/drizzle/schema';
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
  role: 'tenant_admin' as UserRole,
  tenantId: '00000000-0000-0000-0000-000000000001',
  employeeId: null as string | null,
};

/**
 * Extract user from Supabase session
 */
async function getUserFromSession() {
  try {
    const cookieStore = await cookies();

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

    // Use getUser() for secure server-side authentication
    // This validates the token with Supabase Auth server
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      // No authenticated user - return null to use dev mock or trigger auth error
      return null;
    }

    // Fetch user details from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
      columns: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        employeeId: true,
      },
    });

    if (!user) {
      console.warn('[Context] User authenticated but not found in database:', authUser.id);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
    };
  } catch (error) {
    console.error('[Context] Error extracting user from session:', error);
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
  const user = await getUserFromSession() || DEV_MOCK_USER;

  // Set PostgreSQL session variables for RLS policies
  // This allows RLS policies to access tenant_id via current_setting()
  await db.execute(sql`
    SELECT set_config('app.tenant_id', ${user.tenantId}, true),
           set_config('app.user_role', ${user.role}, true),
           set_config('app.user_id', ${user.id}, true);
  `);

  return {
    user,
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
