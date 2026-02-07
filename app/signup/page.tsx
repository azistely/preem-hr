/**
 * Signup Page
 *
 * Simple, guided signup flow for Preem HR
 * Creates tenant + user, then redirects to onboarding
 *
 * Phone-only signup (passwordless):
 * - Enter phone number + company info
 * - Receive OTP via SMS
 * - Verify OTP and complete signup
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear error messages in French
 * - Smart defaults and validation
 * - Loading states for all actions
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JamanaLogo } from '@/components/brand/jamana-logo';
import { PhoneSignupForm } from './phone-signup-form';

export default function SignupPage() {
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
          <JamanaLogo size="default" />
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
            {/* Phone Signup Form - Direct entry without method selection */}
            <PhoneSignupForm onBack={() => window.history.back()} />

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
