/**
 * Signup Page
 *
 * Simple, guided signup flow for Preem HR
 * Creates tenant + user, then redirects to onboarding
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear error messages in French
 * - Smart defaults and validation
 * - Loading states for all actions
 */

'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';
import { signup } from './actions';

/**
 * Signup form validation schema
 * ✅ IMPROVED: More helpful validation messages for low digital literacy users
 */
const signupSchema = z.object({
  email: z.string()
    .min(1, { message: 'Veuillez entrer votre adresse email' })
    .email({ message: 'L\'email doit contenir @ et un domaine (ex: nom@exemple.com)' }),
  password: z.string()
    .min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
    .regex(/[a-zA-Z]/, { message: 'Le mot de passe doit contenir au moins une lettre' })
    .regex(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre' }),
  confirmPassword: z.string()
    .min(1, { message: 'Veuillez confirmer votre mot de passe' }),
  firstName: z.string()
    .min(1, { message: 'Veuillez entrer votre prénom' })
    .min(2, { message: 'Le prénom doit contenir au moins 2 caractères' }),
  lastName: z.string()
    .min(1, { message: 'Veuillez entrer votre nom' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' }),
  companyName: z.string()
    .min(1, { message: 'Veuillez entrer le nom de votre entreprise' })
    .min(2, { message: 'Le nom de l\'entreprise doit contenir au moins 2 caractères' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les deux mots de passe doivent être identiques',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  // Watch password field for real-time strength indicator
  const password = watch('password');

  // Calculate password strength in real-time
  React.useEffect(() => {
    if (!password || password.length === 0) {
      setPasswordStrength(null);
      return;
    }

    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);

    const criteria = [hasMinLength, hasLetter, hasNumber, hasSpecialChar, hasUpperCase].filter(Boolean).length;

    if (criteria >= 4) {
      strength = 'strong';
    } else if (criteria >= 3 && hasMinLength) {
      strength = 'medium';
    }

    setPasswordStrength(strength);
  }, [password]);

  const onSubmit = async (data: SignupFormData) => {
    setError(null);

    startTransition(async () => {
      // Create FormData for Server Action
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);
      formData.append('confirmPassword', data.confirmPassword);
      formData.append('firstName', data.firstName);
      formData.append('lastName', data.lastName);
      formData.append('companyName', data.companyName);

      // Call Server Action
      const result = await signup(formData);

      // Handle error (success redirects automatically)
      if (!result.success) {
        setError(result.error);
        toast.error('Erreur lors de l\'inscription', {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
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

        {/* Signup Card */}
        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Créer votre compte</CardTitle>
            <CardDescription className="text-base">
              Commencez à gérer votre paie en 2 minutes
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-base">
                  Nom de l&apos;entreprise
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Ex: Mon Entreprise SARL"
                  className="min-h-[48px] text-base"
                  {...register('companyName')}
                  disabled={isPending}
                  autoComplete="organization"
                />
                {!errors.companyName && (
                  <p className="text-xs text-muted-foreground">
                    🏢 Le nom de votre société ou entreprise
                  </p>
                )}
                {errors.companyName && (
                  <p className="text-sm text-destructive flex items-start gap-1">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{errors.companyName.message}</span>
                  </p>
                )}
              </div>

              {/* First Name & Last Name (side by side on desktop) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-base">
                    Prénom
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Ex: Jean"
                    className="min-h-[48px] text-base"
                    {...register('firstName')}
                    disabled={isPending}
                    autoComplete="given-name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive flex items-start gap-1">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{errors.firstName.message}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-base">
                    Nom
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Ex: Kouassi"
                    className="min-h-[48px] text-base"
                    {...register('lastName')}
                    disabled={isPending}
                    autoComplete="family-name"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive flex items-start gap-1">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{errors.lastName.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Ex: votre@email.com"
                  className="min-h-[48px] text-base"
                  {...register('email')}
                  disabled={isPending}
                  autoComplete="email"
                />
                {!errors.email && (
                  <p className="text-xs text-muted-foreground">
                    📧 Votre adresse email (ex: jean@gmail.com ou jean@yahoo.fr)
                  </p>
                )}
                {errors.email && (
                  <p className="text-sm text-destructive flex items-start gap-1">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 caractères"
                  className="min-h-[48px] text-base"
                  {...register('password')}
                  disabled={isPending}
                  autoComplete="new-password"
                />

                {/* Password Strength Indicator */}
                {password && password.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength === 'strong'
                              ? 'w-full bg-green-500'
                              : passwordStrength === 'medium'
                              ? 'w-2/3 bg-yellow-500'
                              : 'w-1/3 bg-red-500'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-medium min-w-[60px]">
                        {passwordStrength === 'strong' && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Fort
                          </span>
                        )}
                        {passwordStrength === 'medium' && (
                          <span className="text-yellow-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Moyen
                          </span>
                        )}
                        {passwordStrength === 'weak' && (
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Faible
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Conseil : utilisez des lettres, chiffres et caractères spéciaux (!@#$)
                    </p>
                  </div>
                )}

                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-base">
                  Confirmer le mot de passe
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Retapez votre mot de passe"
                  className="min-h-[48px] text-base"
                  {...register('confirmPassword')}
                  disabled={isPending}
                  autoComplete="new-password"
                />
                {!errors.confirmPassword && (
                  <p className="text-xs text-muted-foreground">
                    🔒 Retapez le même mot de passe pour confirmer
                  </p>
                )}
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive flex items-start gap-1">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{errors.confirmPassword.message}</span>
                  </p>
                )}
              </div>

              {/* Error Message - More prominent for low literacy users */}
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-base font-medium text-red-900 mb-1">
                        Erreur
                      </p>
                      <p className="text-sm text-red-700">
                        {error}
                      </p>
                    </div>
                  </div>
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
                    Création en cours...
                  </>
                ) : (
                  <>
                    Créer mon compte
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Terms & Privacy */}
              <p className="text-sm text-center text-muted-foreground">
                En créant un compte, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
              </p>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center border-t pt-6">
              <p className="text-sm text-muted-foreground">
                Vous avez déjà un compte ?{' '}
                <Link href="/login" className="text-preem-teal font-medium hover:underline hover:text-preem-teal-700">
                  Se connecter
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Trust indicators */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Essai gratuit • Aucune carte bancaire requise
          </p>
        </div>
      </div>
    </div>
  );
}
