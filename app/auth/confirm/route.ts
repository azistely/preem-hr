import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error) {
      // Determine redirect based on type
      let redirectUrl = next || '/onboarding';

      // For password recovery, always redirect to reset password page
      if (type === 'recovery') {
        redirectUrl = '/auth/reset-password';
      }

      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }

  // Error: redirect to error page
  return NextResponse.redirect(new URL('/auth/auth-code-error', request.url));
}
