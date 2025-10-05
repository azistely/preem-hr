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

/**
 * Create context for tRPC
 * Cached to prevent duplicate calls in Server Components
 */
export const createTRPCContext = cache(async (opts?: CreateNextContextOptions) => {
  const { req } = opts || {};

  // For now, return basic context without auth
  // TODO: Implement Supabase auth when ready
  if (!req) {
    return {
      user: null,
      db,
    };
  }

  // Future: Extract user from Supabase JWT
  // const token = req.headers.authorization?.replace('Bearer ', '');
  // const { data: { user }, error } = await supabase.auth.getUser(token);

  return {
    user: null, // Will be populated when auth is implemented
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
