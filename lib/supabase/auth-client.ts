/**
 * Supabase Auth Client Helpers
 *
 * Client-side utilities for authentication with Supabase
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Create Supabase browser client for client-side auth operations
 */
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
