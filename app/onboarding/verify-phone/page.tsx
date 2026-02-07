/**
 * Phone Verification Page for Onboarding
 *
 * Required step for email users during onboarding
 * Verifies phone number using Twilio Verify via Supabase
 *
 * Flow:
 * 1. User signs up with email
 * 2. User verifies email
 * 3. User lands here to add phone
 * 4. After verification, proceeds to onboarding Q1
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear French messages for low digital literacy
 * - Explains why phone verification is important
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, Loader2, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { JamanaLogo } from '@/components/brand/jamana-logo';
import { PhoneInput } from '@/components/auth/phone-input';
import { OtpInput } from '@/components/auth/otp-input';
import { api } from '@/trpc/react';

type Step = 'intro' | 'phone' | 'verify' | 'success';

export default function VerifyPhonePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check auth status
  const { data: user, isLoading: isUserLoading } = api.auth.me.useQuery();

  // tRPC mutations - use new Twilio Verify based procedures
  const sendOtp = api.auth.sendPhoneVerificationOtp.useMutation();
  const verifyPhone = api.auth.verifyAndAddPhone.useMutation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Redirect if user signed up with phone (they already have phone verified)
  // or if they already have a verified phone
  useEffect(() => {
    if (user) {
      // Phone users don't need this - they're already verified
      if (user.authMethod === 'phone') {
        router.push('/onboarding/q1');
        return;
      }
      // Email users who already have phone verified can skip
      if (user.phoneVerified) {
        router.push('/onboarding/q1');
        return;
      }
    }
  }, [user, router]);

  // Step 1: Send OTP to phone
  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) {
      setError('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await sendOtp.mutateAsync({ phone });

      // Check if OTP was skipped (phone set directly via admin API)
      if (result.skipOtp) {
        setStep('success');
        toast.success('Numéro de téléphone enregistré!');
        setTimeout(() => {
          router.push('/onboarding/q1');
        }, 2000);
        return;
      }

      // Normal flow - go to OTP verification
      setStep('verify');
      toast.success('Code SMS envoyé!');
    } catch (err: any) {
      console.error('[VerifyPhone] Send OTP error:', err);

      const message = err?.message || 'Erreur lors de l\'envoi du SMS';

      // Handle specific error messages
      if (message.includes('déjà utilisé')) {
        setError('Ce numéro de téléphone est déjà utilisé par un autre compte. Veuillez utiliser un autre numéro.');
      } else if (message.includes('SMS non configuré')) {
        // SMS provider not configured - allow skip
        toast.info('Vérification téléphone non disponible', {
          description: 'Vous pouvez configurer la sécurité plus tard',
          duration: 4000,
        });
        setTimeout(() => {
          router.push('/onboarding/q1');
        }, 1500);
        return;
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOtpComplete = async (otp: string) => {
    setError(null);
    setIsLoading(true);

    try {
      await verifyPhone.mutateAsync({ phone, token: otp });
      setStep('success');
      toast.success('Numéro de téléphone vérifié!');

      // Redirect to onboarding Q1 after short delay
      setTimeout(() => {
        router.push('/onboarding/q1');
      }, 2000);
    } catch (err: any) {
      console.error('[VerifyPhone] Verify error:', err);
      const message = err?.message || 'Erreur lors de la vérification';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      await sendOtp.mutateAsync({ phone });
      toast.success('Nouveau code envoyé!');
    } catch (err: any) {
      console.error('[VerifyPhone] Resend error:', err);
      toast.error('Erreur', { description: 'Impossible d\'envoyer le code' });
      throw err;
    }
  };

  // Skip phone verification (for beta)
  const handleSkip = () => {
    router.push('/onboarding/q1');
  };

  // Loading state
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-preem-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-center justify-center">
          <JamanaLogo size="default" />
        </div>

        {/* Progress indicator */}
        <div className="mb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Étape 1 sur 3 • Configuration du compte
          </p>
        </div>

        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
          {/* Intro Step */}
          {step === 'intro' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-preem-teal/10">
                  <Shield className="h-8 w-8 text-preem-teal" />
                </div>
                <CardTitle className="text-2xl">Vérifiez votre téléphone</CardTitle>
                <CardDescription className="text-base">
                  Ajoutez votre numéro de téléphone pour sécuriser votre compte
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Benefits */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Récupération de compte</p>
                      <p className="text-sm text-green-700">
                        Récupérez votre compte si vous perdez votre mot de passe
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <Smartphone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">Notifications importantes</p>
                      <p className="text-sm text-blue-700">
                        Recevez les alertes urgentes par SMS
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  onClick={() => setStep('phone')}
                  className="w-full min-h-[56px] text-lg bg-preem-teal hover:bg-preem-teal-600 text-white"
                >
                  Ajouter mon téléphone
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                {/* Skip option (beta) */}
                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Configurer plus tard
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Phone Input Step */}
          {step === 'phone' && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Votre numéro de téléphone</CardTitle>
                <CardDescription className="text-base">
                  Nous enverrons un code SMS pour vérifier votre numéro
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  defaultCountryCode="CI"
                  disabled={isLoading}
                  error={error || undefined}
                  required
                />

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 flex items-center gap-2">
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handlePhoneSubmit}
                    disabled={isLoading || !phone}
                    className="w-full min-h-[56px] text-lg bg-preem-teal hover:bg-preem-teal-600 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        Recevoir le code SMS
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setStep('intro')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Retour
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* OTP Verification Step */}
          {step === 'verify' && (
            <CardContent className="py-6">
              <OtpInput
                phoneNumber={phone}
                onComplete={handleOtpComplete}
                onResend={handleResendOtp}
                isVerifying={isLoading}
                error={error || undefined}
                expirySeconds={300}
                resendCooldown={30}
              />

              {/* Back button */}
              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  Modifier le numéro
                </Button>
              </div>
            </CardContent>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <CardContent className="py-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-green-700">
                    Téléphone vérifié!
                  </h2>
                  <p className="text-muted-foreground">
                    Votre numéro de téléphone a été enregistré.
                    <br />
                    Redirection vers la configuration...
                  </p>
                </div>
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-preem-teal" />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Besoin d&apos;aide ? support@jamana.app
          </p>
        </div>
      </div>
    </div>
  );
}
