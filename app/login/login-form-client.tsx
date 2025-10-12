/**
 * Login Form Client Component
 *
 * Client component for handling form state and validation
 * Uses Server Actions for authentication
 */

'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';
import { login } from './actions';

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

/**
 * Login form component (uses searchParams)
 */
export function LoginFormClient() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    startTransition(async () => {
      // Create FormData for Server Action
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);
      formData.append('redirectUrl', redirectUrl);

      // Call Server Action
      const result = await login(formData);

      // Handle error (success redirects automatically)
      if (!result.success) {
        setError(result.error);
        toast.error('Erreur de connexion', {
          description: result.error,
        });
      }
    });
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
                  disabled={isPending}
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
                  <Link href="/auth/forgot-password" className="text-sm text-preem-teal hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="min-h-[48px] text-base"
                  {...register('password')}
                  disabled={isPending}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full min-h-[56px] text-lg bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal transition-all"
                disabled={isPending}
              >
                {isPending ? (
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
