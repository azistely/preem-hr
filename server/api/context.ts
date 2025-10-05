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
import { sql } from 'drizzle-orm';

/**
 * Development-only mock tenant for testing RLS
 * In production, this will be extracted from Supabase JWT
 */
const DEV_MOCK_TENANT = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'tenant_admin',
};

/**
 * Create context for tRPC
 * Cached to prevent duplicate calls in Server Components
 */
export const createTRPCContext = cache(async (opts?: CreateNextContextOptions) => {
  const { req } = opts || {};

  // For development: use mock tenant to enable RLS testing
  // In production: extract from Supabase JWT
  const tenantId = DEV_MOCK_TENANT.id;
  const userRole = DEV_MOCK_TENANT.role;

  // Set PostgreSQL session variables for RLS policies
  // This allows RLS policies to access tenant_id via current_setting()
  await db.execute(sql`
    SELECT set_config('app.tenant_id', ${tenantId}, true),
           set_config('app.user_role', ${userRole}, true);
  `);

  return {
    tenantId,
    userRole,
    user: DEV_MOCK_TENANT,
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
