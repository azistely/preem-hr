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

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PreemLogo } from '@/components/brand/preem-logo';
import { LoginFormClient } from './login-form-client';

/**
 * Login page wrapper with Suspense boundary
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-preem-teal" />
      </div>
    }>
      <LoginFormClient />
    </Suspense>
  );
}
