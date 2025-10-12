/**
 * Supabase Middleware Utilities
 *
 * Session refresh utilities for Next.js middleware
 * Ensures user sessions are kept fresh across requests
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Update Supabase session in middleware
 *
 * This function:
 * 1. Creates a Supabase client with proper cookie handling
 * 2. Calls getUser() to validate the session (this is CRITICAL for security)
 * 3. Returns the updated response with refreshed session cookies and user data
 *
 * IMPORTANT: The getUser() call validates the session with the Supabase Auth server.
 * This is NOT just reading a cookie - it's a security validation step.
 * DO NOT remove it even if it seems unused.
 *
 * Usage in middleware.ts:
 * ```ts
 * import { updateSession } from '@/lib/supabase/middleware';
 *
 * export async function middleware(request: NextRequest) {
 *   const { supabaseResponse, user } = await updateSession(request);
 *
 *   if (!user) {
 *     // Redirect to login
 *     return NextResponse.redirect(new URL('/login', request.url));
 *   }
 *
 *   // Continue with RBAC checks...
 *   return supabaseResponse;
 * }
 * ```
 */
export async function updateSession(request: NextRequest) {
  // Create a response object to hold the updated cookies
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client with cookie handlers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for current request handling)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Create a fresh response with updated cookies
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set cookies on the response (for browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: DO NOT remove this getUser() call!
  // It validates the session with the Supabase Auth server.
  // This is a security-critical operation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
