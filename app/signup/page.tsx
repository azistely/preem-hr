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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createAuthClient } from '@/lib/supabase/auth-client';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';

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

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const signupMutation = api.auth.signup.useMutation();

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      // 1. Create user account (this creates Supabase auth + DB records)
      const result = await signupMutation.mutateAsync({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName,
      });

      if (!result) {
        toast.error('Erreur lors de l\'inscription');
        setIsSubmitting(false);
        return;
      }

      // 2. Sign in to create session
      const supabase = createAuthClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) {
        console.error('Auto sign-in error:', signInError);
        toast.success('Compte créé avec succès!', {
          description: 'Veuillez vous connecter pour continuer',
        });
        router.push('/login');
        return;
      }

      toast.success('Compte créé avec succès!', {
        description: `Bienvenue ${result.user.firstName}!`,
      });

      // Small delay to ensure session is set
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to onboarding
      router.push('/onboarding');
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error('Erreur lors de l\'inscription', {
        description: error?.message || 'Une erreur s\'est produite',
      });
      setIsSubmitting(false);
    }
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
                  disabled={isSubmitting}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
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
                    disabled={isSubmitting}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
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
                    disabled={isSubmitting}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email professionnel
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Ex: jean@monentreprise.com"
                  className="min-h-[48px] text-base"
                  {...register('email')}
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
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
                  disabled={isSubmitting}
                />
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
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
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
