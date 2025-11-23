'use server';

import { createClient } from '@/lib/supabase/server';
import { passwordResetRateLimiter } from '@/lib/rate-limit';

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Rate limiting by email
    if (passwordResetRateLimiter) {
      const { success } = await passwordResetRateLimiter.limit(email);
      if (!success) {
        return {
          success: false,
          error: 'Trop de tentatives. Réessayez dans 1 heure.',
        };
      }
    }

    const supabase = await createClient();

    // Construct reset password URL (ensure no double slashes)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3002';
    const resetPasswordUrl = `${baseUrl}/auth/reset-password`;

    console.log('[Password Reset] Sending reset email to:', email);
    console.log('[Password Reset] Redirect URL:', resetPasswordUrl);

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordUrl,
    });

    if (error) {
      console.error('[Password Reset] Error:', error);
      // Don't reveal if email exists or not (security)
      return { success: true };
    }

    return { success: true };
  } catch (error) {
    console.error('[Password Reset] Unexpected error:', error);
    return {
      success: false,
      error: 'Une erreur s\'est produite',
    };
  }
}
