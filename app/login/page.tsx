/**
 * Login Page
 *
 * Simple login form for existing users
 * Redirects to dashboard or onboarding based on completion status
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear error messages in French
 * - Loading states for all actions
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createAuthClient } from '@/lib/supabase/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(1, { message: 'Mot de passe requis' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allow internal paths (no external URLs)
 */
function getSafeRedirectUrl(redirect: string | null): string {
  // Default to onboarding if no redirect
  if (!redirect) return '/onboarding';

  // Only allow paths that start with / (internal)
  if (!redirect.startsWith('/')) return '/onboarding';

  // Don't allow redirects to login/signup (infinite loop)
  if (redirect.startsWith('/login') || redirect.startsWith('/signup')) {
    return '/onboarding';
  }

  return redirect;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get safe redirect URL from query params (set by middleware)
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      // Sign in with Supabase (client-side)
      const supabase = createAuthClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        toast.error('Erreur de connexion', {
          description: 'Email ou mot de passe incorrect',
        });
        setIsSubmitting(false);
        return;
      }

      toast.success('Connexion réussie!');

      // Small delay to ensure session is set
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to original requested page or onboarding
      router.push(redirectUrl);
      router.refresh(); // Refresh to update auth state
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Erreur de connexion', {
        description: 'Une erreur s\'est produite',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="min-h-[44px] text-preem-teal hover:text-preem-teal-700 hover:bg-preem-teal/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <PreemLogo size="default" />
        </div>

        {/* Login Card */}
        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Connexion</CardTitle>
            <CardDescription className="text-base">
              Accédez à votre compte Preem
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  className="min-h-[48px] text-base"
                  {...register('email')}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-base">
                    Mot de passe
                  </Label>
                  {/* Future: Add forgot password link */}
                  {/* <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Mot de passe oublié ?
                  </Link> */}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="min-h-[48px] text-base"
                  {...register('password')}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full min-h-[56px] text-lg bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Signup Link */}
            <div className="mt-6 text-center border-t pt-6">
              <p className="text-sm text-muted-foreground">
                Vous n&apos;avez pas de compte ?{' '}
                <Link href="/signup" className="text-preem-teal font-medium hover:underline hover:text-preem-teal-700">
                  Créer un compte gratuit
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Besoin d&apos;aide ? Contactez-nous par email
          </p>
        </div>
      </div>
    </div>
  );
}
