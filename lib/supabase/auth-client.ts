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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
