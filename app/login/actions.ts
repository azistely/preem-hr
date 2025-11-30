/**
 * Login Server Actions
 *
 * Server-side authentication actions for login page
 * Uses Supabase SSR pattern for secure authentication
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { loginRateLimiter, getClientIp } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(1, { message: 'Mot de passe requis' }),
  redirectUrl: z.string().optional(),
});

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allow internal paths (no external URLs)
 */
function getSafeRedirectUrl(redirectUrl?: string): string {
  // Default to onboarding if no redirect
  if (!redirectUrl) return '/onboarding';

  // Only allow paths that start with / (internal)
  if (!redirectUrl.startsWith('/')) return '/onboarding';

  // Don't allow redirects to login/signup (infinite loop)
  if (redirectUrl.startsWith('/login') || redirectUrl.startsWith('/signup')) {
    return '/onboarding';
  }

  return redirectUrl;
}

/**
 * Result type for login action
 */
export type LoginResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string };

/**
 * Login Server Action
 *
 * Authenticates user with Supabase and redirects to requested page or onboarding
 *
 * @param formData - Form data containing email, password, and optional redirectUrl
 * @returns Login result (only on error, redirects on success)
 */
export async function login(formData: FormData): Promise<LoginResult> {
  // Parse and validate form data
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    redirectUrl: formData.get('redirectUrl') as string | undefined,
  };

  const validationResult = loginSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Données invalides',
    };
  }

  const { email, password, redirectUrl } = validationResult.data;

  // Rate limiting
  if (loginRateLimiter) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const { success, limit, reset, remaining } = await loginRateLimiter.limit(ip);

    if (!success) {
      const resetDate = new Date(reset);
      const minutes = Math.ceil((resetDate.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Trop de tentatives. Réessayez dans ${minutes} minutes.`,
      };
    }
  }

  // Create Supabase client
  const supabase = await createClient();

  // Attempt sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error('[Login] Sign in error:', signInError);
    return {
      success: false,
      error: 'Email ou mot de passe incorrect',
    };
  }

  // Get the authenticated user
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // Get safe redirect URL
  const safeRedirectUrl = getSafeRedirectUrl(redirectUrl);

  // Check if user has MFA enabled in our database
  if (authUser) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
      columns: {
        mfaEnabled: true,
        authMethod: true,
      },
    });

    // If email user has MFA enabled, redirect to MFA challenge page
    if (dbUser?.mfaEnabled && dbUser?.authMethod === 'email') {
      console.log('[Login] User has MFA enabled, redirecting to MFA challenge');
      revalidatePath('/', 'layout');
      return {
        success: true,
        redirectUrl: `/auth/mfa?redirect=${encodeURIComponent(safeRedirectUrl)}`,
      };
    }
  }

  // Revalidate the layout to update auth state
  revalidatePath('/', 'layout');

  // ✅ FIX: Return success with redirect URL instead of using redirect()
  // Using redirect() in server actions prevents cookies from being committed
  // Let the client handle the redirect after cookies are set
  return {
    success: true,
    redirectUrl: safeRedirectUrl,
  };
}
