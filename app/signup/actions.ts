/**
 * Signup Server Actions
 *
 * Server-side authentication actions for signup page
 * Uses tRPC for signup and Supabase SSR for auto-login
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signupRateLimiter, getClientIp } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { appRouter } from '@/server/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import { createTRPCContext } from '@/server/api/context';
import { z } from 'zod';

/**
 * Signup form validation schema
 */
const signupSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(8, { message: 'Minimum 8 caractères' }),
  confirmPassword: z.string(),
  firstName: z.string().min(1, { message: 'Prénom requis' }),
  lastName: z.string().min(1, { message: 'Nom requis' }),
  companyName: z.string().min(1, { message: 'Nom de l\'entreprise requis' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

/**
 * Result type for signup action
 */
export type SignupResult =
  | { success: true; firstName: string }
  | { success: false; error: string; field?: string };

/**
 * Signup Server Action
 *
 * Creates user account via tRPC, then auto-signs in and redirects to onboarding
 *
 * @param formData - Form data containing user details
 * @returns Signup result (only on error, redirects on success)
 */
export async function signup(formData: FormData): Promise<SignupResult> {
  // Parse and validate form data
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    companyName: formData.get('companyName') as string,
  };

  const validationResult = signupSchema.safeParse(rawData);
  if (!validationResult.success) {
    const firstError = validationResult.error.errors[0];
    return {
      success: false,
      error: firstError.message,
      field: firstError.path[0]?.toString(),
    };
  }

  const { email, password, firstName, lastName, companyName } = validationResult.data;

  // Rate limiting
  if (signupRateLimiter) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const { success, limit, reset, remaining } = await signupRateLimiter.limit(ip);

    if (!success) {
      const resetDate = new Date(reset);
      const minutes = Math.ceil((resetDate.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Trop de tentatives d'inscription. Réessayez dans ${minutes} minutes.`,
      };
    }
  }

  try {
    // 1. Create user account via tRPC (creates tenant + user in DB + Supabase Auth)
    const context = await createTRPCContext();
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller(context);

    const result = await caller.auth.signup({
      email,
      password,
      firstName,
      lastName,
      companyName,
    });

    if (!result || !result.success) {
      return {
        success: false,
        error: 'Erreur lors de l\'inscription',
      };
    }
  } catch (error: any) {
    console.error('[Signup] Error:', error);

    // Extract meaningful error message
    let errorMessage = 'Une erreur s\'est produite';
    if (error?.message) {
      if (error.message.includes('déjà')) {
        errorMessage = 'Un compte avec cet email existe déjà';
      } else if (error.message.includes('email')) {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }

  // 2. Redirect to email verification page (no auto sign-in)
  // This must be outside try/catch because redirect() throws a special error
  redirect('/auth/verify-email?email=' + encodeURIComponent(email));
}
