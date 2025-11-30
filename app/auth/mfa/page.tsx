/**
 * MFA Challenge Page
 *
 * Required step for email users who have MFA enabled.
 * After email+password login, users must verify their phone OTP
 * to complete the sign-in process (AAL2).
 *
 * Flow:
 * 1. User logs in with email+password (AAL1)
 * 2. User is redirected here if MFA is enabled
 * 3. System sends OTP to their registered phone
 * 4. User verifies OTP to complete login (AAL2)
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear French messages for low digital literacy
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PreemLogo } from '@/components/brand/preem-logo';
import { OtpInput } from '@/components/auth/otp-input';
import { createAuthClient } from '@/lib/supabase/auth-client';

type Step = 'loading' | 'challenge' | 'success' | 'error';

export default function MfaChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get Supabase client
  const supabase = createAuthClient();

  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect') || '/onboarding';

  // Initialize MFA challenge on mount
  useEffect(() => {
    initializeMfaChallenge();
  }, []);

  // Initialize MFA challenge - get factors and create challenge
  const initializeMfaChallenge = async () => {
    try {
      // Get user's MFA factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('[MFA] List factors error:', factorsError);
        setError('Erreur lors de la récupération des facteurs MFA');
        setStep('error');
        return;
      }

      // Find verified phone factor
      const phoneFactors = factorsData.totp || [];
      const phoneFactor = phoneFactors.find(f => f.factor_type === 'phone' && f.status === 'verified');

      // Check all factors for phone type
      const allFactors = factorsData.all || [];
      const verifiedPhoneFactor = allFactors.find(f => f.factor_type === 'phone' && f.status === 'verified');

      if (!verifiedPhoneFactor) {
        // No phone MFA set up - redirect to onboarding to set it up
        console.log('[MFA] No verified phone factor found, redirecting to setup');
        router.push('/onboarding/verify-phone');
        return;
      }

      setFactorId(verifiedPhoneFactor.id);

      // Create challenge to send OTP
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedPhoneFactor.id,
      });

      if (challengeError) {
        console.error('[MFA] Challenge error:', challengeError);
        setError('Erreur lors de l\'envoi du code SMS');
        setStep('error');
        return;
      }

      setChallengeId(challengeData.id);

      // Extract phone hint from factor (last 4 digits)
      const phone = (verifiedPhoneFactor as any).phone || '';
      if (phone) {
        setPhoneHint(`***${phone.slice(-4)}`);
      }

      setStep('challenge');
      toast.success('Code SMS envoyé!');
    } catch (err: any) {
      console.error('[MFA] Init error:', err);
      setError(err?.message || 'Erreur lors de l\'initialisation');
      setStep('error');
    }
  };

  // Verify OTP
  const handleOtpComplete = async (otp: string) => {
    if (!factorId || !challengeId) {
      setError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: otp,
      });

      if (verifyError) {
        console.error('[MFA] Verify error:', verifyError);

        if (verifyError.message.includes('expired')) {
          setError('Ce code a expiré. Demandez un nouveau code.');
        } else if (verifyError.message.includes('invalid') || verifyError.message.includes('incorrect')) {
          setError('Code incorrect. Vérifiez et réessayez.');
        } else {
          setError(verifyError.message || 'Erreur de vérification');
        }
        setIsLoading(false);
        return;
      }

      // Success! Redirect to intended destination
      setStep('success');
      toast.success('Connexion réussie!');

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1000);
    } catch (err: any) {
      console.error('[MFA] Error:', err);
      setError(err?.message || 'Erreur lors de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!factorId) {
      setError('Session expirée. Veuillez vous reconnecter.');
      throw new Error('No factor ID');
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      setChallengeId(challengeData.id);
      toast.success('Nouveau code envoyé!');
    } catch (err: any) {
      console.error('[MFA] Resend error:', err);
      toast.error('Erreur', { description: 'Impossible d\'envoyer le code' });
      throw err;
    }
  };

  // Cancel and go back to login
  const handleCancel = async () => {
    // Sign out to clear partial session
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-preem-teal mx-auto mb-4" />
          <p className="text-muted-foreground">Préparation de la vérification...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center">
            <PreemLogo size="default" />
          </div>

          <Card className="border-2 border-red-200">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-red-700">
                  Erreur de vérification
                </h2>
                <p className="text-muted-foreground">{error}</p>
                <div className="pt-4 space-y-2">
                  <Button
                    onClick={() => initializeMfaChallenge()}
                    className="w-full"
                  >
                    Réessayer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full"
                  >
                    Retour à la connexion
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-2 border-green-200">
            <CardContent className="py-8">
              <div className="text-center space-y-6">
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Challenge state - main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-center justify-center">
          <PreemLogo size="default" />
        </div>

        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-preem-teal/10">
              <Shield className="h-8 w-8 text-preem-teal" />
            </div>
            <CardTitle className="text-2xl">Vérification en deux étapes</CardTitle>
            <CardDescription className="text-base">
              Un code SMS a été envoyé à votre téléphone {phoneHint}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <OtpInput
              phoneNumber={phoneHint}
              onComplete={handleOtpComplete}
              onResend={handleResendOtp}
              isVerifying={isLoading}
              error={error || undefined}
              expirySeconds={300}
              resendCooldown={30}
            />

            {/* Cancel button */}
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-muted-foreground"
              >
                Annuler et retourner à la connexion
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Besoin d&apos;aide ? support@preemhq.com
          </p>
        </div>
      </div>
    </div>
  );
}
