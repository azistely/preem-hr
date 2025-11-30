/**
 * Phone Login Form Component
 *
 * Passwordless login flow:
 * 1. Enter phone number
 * 2. Receive OTP via SMS
 * 3. Verify OTP and login
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear French messages for low digital literacy
 */

'use client';

import React, { useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PhoneInput } from '@/components/auth/phone-input';
import { OtpInput } from '@/components/auth/otp-input';
import { api } from '@/trpc/react';
import { createAuthClient } from '@/lib/supabase/auth-client';

/**
 * Step 1 validation schema: Phone number only
 */
const step1Schema = z.object({
  phone: z.string().min(10, { message: 'Numéro de téléphone invalide' }),
});

type Step1FormData = z.infer<typeof step1Schema>;

interface PhoneLoginFormProps {
  onBack: () => void;
  redirectUrl: string;
}

export function PhoneLoginForm({ onBack, redirectUrl }: PhoneLoginFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations
  const sendOtp = api.auth.sendPhoneOtp.useMutation();
  const verifyPhoneOtp = api.auth.verifyPhoneOtp.useMutation();

  // Step 1 form
  const {
    setValue,
    handleSubmit,
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

    console.log('[PhoneLogin] ========== STEP 1: SEND OTP ==========');
    console.log('[PhoneLogin] Phone:', data.phone);
    console.log('[PhoneLogin] Phone length:', data.phone.length);

    startTransition(async () => {
      try {
        console.log('[PhoneLogin] Calling sendOtp.mutateAsync...');
        await sendOtp.mutateAsync({ phone: data.phone });
        console.log('[PhoneLogin] OTP sent successfully!');
        toast.success('Code SMS envoyé!', {
          description: 'Vérifiez votre téléphone',
        });
        setStep(2);
      } catch (err: any) {
        console.error('[PhoneLogin] Send OTP error:', err);
        console.error('[PhoneLogin] Error details:', {
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

  // Step 2: Verify OTP and login
  const handleOtpComplete = async (otp: string) => {
    setError(null);

    console.log('[PhoneLogin] ========== STEP 2: VERIFY OTP ==========');
    console.log('[PhoneLogin] OTP entered:', otp);
    console.log('[PhoneLogin] Phone:', phone);

    startTransition(async () => {
      try {
        console.log('[PhoneLogin] Calling verifyPhoneOtp.mutateAsync...');
        const result = await verifyPhoneOtp.mutateAsync({
          phone,
          token: otp,
        });

        console.log('[PhoneLogin] Verify result:', result);

        if (result.success) {
          // Set session in browser client so user is authenticated
          if (result.session) {
            console.log('[PhoneLogin] Setting browser session...');
            const supabase = createAuthClient();
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
            });

            if (sessionError) {
              console.error('[PhoneLogin] Failed to set session:', sessionError);
              // Continue anyway - redirect will handle auth
            } else {
              console.log('[PhoneLogin] Browser session established successfully');
            }
          }

          console.log('[PhoneLogin] Login successful, redirecting to:', redirectUrl);
          toast.success('Connexion réussie!');
          setStep(3);
          // Redirect after short delay
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        }
      } catch (err: any) {
        console.error('[PhoneLogin] Verify OTP error:', err);
        console.error('[PhoneLogin] Error details:', {
          message: err?.message,
          data: err?.data,
          code: err?.code,
        });
        const message = err?.message || 'Erreur lors de la vérification';
        setError(message);

        // Check if user needs to sign up
        if (message.includes('inscription') || message.includes('inscrire')) {
          toast.error('Compte non trouvé', {
            description: 'Créez un compte pour continuer',
            action: {
              label: 'S\'inscrire',
              onClick: () => {
                window.location.href = '/signup';
              },
            },
          });
        } else {
          toast.error('Erreur', { description: message });
        }
      }
    });
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    try {
      await sendOtp.mutateAsync({ phone });
      toast.success('Nouveau code envoyé!');
    } catch (err: any) {
      console.error('[PhoneLogin] Resend OTP error:', err);
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
            Connexion réussie!
          </h2>
          <p className="text-muted-foreground">
            Redirection en cours...
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
          expirySeconds={300}
          resendCooldown={30}
        />

        {/* Additional help */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            💡 Le code arrive généralement en moins d&apos;une minute.
          </p>
        </div>
      </div>
    );
  }

  // Step 1: Phone input form
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

      {/* Phone Input */}
      <PhoneInput
        value={phone}
        onChange={handlePhoneChange}
        defaultCountryCode="CI"
        disabled={isPending}
        error={errors.phone?.message}
        required
        label="Numéro de téléphone"
        helperText="Entrez le numéro utilisé lors de l'inscription"
      />

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

      {/* Signup link for users without account */}
      <div className="text-center pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <a href="/signup" className="text-preem-teal font-medium hover:underline">
            Créer un compte
          </a>
        </p>
      </div>
    </form>
  );
}
