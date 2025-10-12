/**
 * Supabase Server Utilities
 *
 * Server-side Supabase client for Server Components and Server Actions
 * Uses @supabase/ssr for proper cookie handling in Next.js 15
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create Supabase server client for Server Components and Server Actions
 *
 * Usage in Server Components:
 * ```ts
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   return <div>Hello {user?.email}</div>;
 * }
 * ```
 *
 * Usage in Server Actions:
 * ```ts
 * 'use server'
 * import { createClient } from '@/lib/supabase/server';
 *
 * export async function myAction() {
 *   const supabase = await createClient();
 *   const { data, error } = await supabase.from('table').select();
 *   return data;
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
