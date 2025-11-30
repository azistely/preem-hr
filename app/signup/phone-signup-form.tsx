/**
 * Phone Signup Form Component
 *
 * Multi-step phone signup flow:
 * 1. Enter phone number + company info
 * 2. Receive OTP via SMS
 * 3. Verify OTP and complete signup
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear French messages for low digital literacy
 * - Smart defaults and validation
 */

'use client';

import React, { useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PhoneInput } from '@/components/auth/phone-input';
import { OtpInput } from '@/components/auth/otp-input';
import { api } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/auth-client';

/**
 * Step 1 validation schema: Phone + Company Info
 */
const step1Schema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
  firstName: z.string()
    .min(1, { message: 'Veuillez entrer votre prénom' })
    .min(2, { message: 'Le prénom doit contenir au moins 2 caractères' }),
  lastName: z.string()
    .min(1, { message: 'Veuillez entrer votre nom' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' }),
  companyName: z.string()
    .min(1, { message: 'Veuillez entrer le nom de votre entreprise' })
    .min(2, { message: 'Le nom de l\'entreprise doit contenir au moins 2 caractères' }),
});

type Step1FormData = z.infer<typeof step1Schema>;

interface PhoneSignupFormProps {
  onBack: () => void;
}

export function PhoneSignupForm({ onBack }: PhoneSignupFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [formData, setFormData] = useState<Step1FormData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations
  const sendOtp = api.auth.sendPhoneOtp.useMutation();
  const signupWithPhone = api.auth.signupWithPhone.useMutation();

  // Step 1 form
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
  });

  // Handle phone change from PhoneInput component
  const handlePhoneChange = (e164Phone: string) => {
    setPhone(e164Phone);
    setValue('phone', e164Phone);
  };

  // Step 1: Send OTP
  const onStep1Submit = async (data: Step1FormData) => {
    setError(null);
    setFormData(data);

    console.log('[PhoneSignup] ========== STEP 1: SEND OTP ==========');
    console.log('[PhoneSignup] Form data:', {
      phone: data.phone,
      phoneLength: data.phone.length,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
    });

    startTransition(async () => {
      try {
        console.log('[PhoneSignup] Calling sendOtp.mutateAsync...');
        await sendOtp.mutateAsync({ phone: data.phone });
        console.log('[PhoneSignup] OTP sent successfully!');
        toast.success('Code SMS envoyé!', {
          description: 'Vérifiez votre téléphone',
        });
        setStep(2);
      } catch (err: any) {
        console.error('[PhoneSignup] Send OTP error:', err);
        console.error('[PhoneSignup] Error details:', {
          message: err?.message,
          data: err?.data,
          code: err?.code,
        });
        const message = err?.message || 'Erreur lors de l\'envoi du SMS';
        setError(message);
        toast.error('Erreur', { description: message });
      }
    });
  };

  // Step 2: Verify OTP and complete signup
  const handleOtpComplete = async (otp: string) => {
    if (!formData) return;

    console.log('[PhoneSignup] ========== STEP 2: VERIFY OTP ==========');
    console.log('[PhoneSignup] OTP entered:', otp);
    console.log('[PhoneSignup] Phone:', formData.phone);

    setError(null);
    startTransition(async () => {
      try {
        console.log('[PhoneSignup] Calling signupWithPhone.mutateAsync...');
        const result = await signupWithPhone.mutateAsync({
          phone: formData.phone,
          token: otp,
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
        });

        console.log('[PhoneSignup] Signup result:', result);

        if (result.success) {
          // Set session in browser client so user is authenticated
          if (result.session) {
            console.log('[PhoneSignup] Setting browser session...');
            const supabase = createAuthClient();
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
            });

            if (sessionError) {
              console.error('[PhoneSignup] Failed to set session:', sessionError);
              // Continue anyway - user will need to login manually
            } else {
              console.log('[PhoneSignup] Browser session established successfully');
            }
          }

          if (result.isNewUser) {
            console.log('[PhoneSignup] New user created, redirecting to onboarding');
            toast.success('Compte créé!', {
              description: 'Bienvenue sur Preem HR',
            });
            setStep(3);
            // Redirect to onboarding after short delay
            setTimeout(() => {
              router.push('/onboarding');
            }, 1500);
          } else {
            // Existing user - account already exists with this phone
            console.log('[PhoneSignup] Existing user - phone already registered');
            toast.info('Ce numéro est déjà enregistré', {
              description: 'Vous avez été connecté à votre compte existant',
              duration: 5000,
            });
            // Redirect to dashboard (not onboarding) since they already have an account
            router.push('/');
          }
        }
      } catch (err: any) {
        console.error('[PhoneSignup] Verify OTP error:', err);
        console.error('[PhoneSignup] Error details:', {
          message: err?.message,
          data: err?.data,
          code: err?.code,
        });
        const message = err?.message || 'Erreur lors de la vérification';
        setError(message);
        toast.error('Erreur', { description: message });
      }
    });
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (!formData) return;

    try {
      await sendOtp.mutateAsync({ phone: formData.phone });
      toast.success('Nouveau code envoyé!');
    } catch (err: any) {
      console.error('[PhoneSignup] Resend OTP error:', err);
      toast.error('Erreur', {
        description: err?.message || 'Impossible d\'envoyer le code',
      });
      throw err; // Re-throw for OtpInput to handle
    }
  };

  // Step 3: Success screen
  if (step === 3) {
    return (
      <div className="text-center py-8 space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-green-700">
            Compte créé avec succès!
          </h2>
          <p className="text-muted-foreground">
            Bienvenue {formData?.firstName}! Redirection en cours...
          </p>
        </div>
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-preem-teal" />
        </div>
      </div>
    );
  }

  // Step 2: OTP verification
  if (step === 2) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(1)}
          className="min-h-[44px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Modifier le numéro
        </Button>

        <OtpInput
          phoneNumber={phone}
          onComplete={handleOtpComplete}
          onResend={handleResendOtp}
          isVerifying={isPending}
          error={error || undefined}
          expirySeconds={300} // 5 minutes for slow 3G
          resendCooldown={30}
        />

        {/* Additional help */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            💡 Le code arrive généralement en moins d&apos;une minute.
            <br />
            Vérifiez vos SMS et ne fermez pas cette page.
          </p>
        </div>
      </div>
    );
  }

  // Step 1: Phone + Info form
  return (
    <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-6">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="min-h-[44px]"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Changer de méthode
      </Button>

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

      {/* First Name & Last Name */}
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

      {/* Phone Input */}
      <PhoneInput
        value={phone}
        onChange={handlePhoneChange}
        defaultCountryCode="CI"
        disabled={isPending}
        error={errors.phone?.message}
        required
      />

      {/* Hidden field for form validation */}
      <input type="hidden" {...register('phone')} />

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-base font-medium text-red-900 mb-1">
                Erreur
              </p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full min-h-[56px] text-lg bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal transition-all"
        disabled={isPending || sendOtp.isPending}
      >
        {isPending || sendOtp.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Envoi du code...
          </>
        ) : (
          <>
            Recevoir le code SMS
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>

      {/* Benefits */}
      <div className="text-center pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          ✅ Pas de mot de passe à retenir
          <br />
          ✅ Connexion rapide par SMS
        </p>
      </div>
    </form>
  );
}
