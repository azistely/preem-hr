/**
 * Onboarding Entry Point
 *
 * Redirects to the new V2 task-first onboarding flow.
 * This starts with Country + Company selection (Q1).
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: state, isLoading } = api.onboarding.getState.useQuery();
  const { data: user } = api.auth.me.useQuery();

  useEffect(() => {
    if (isLoading) return;

    // If onboarding complete, redirect to role-specific dashboard
    if (state?.onboarding_complete) {
      const role = user?.role || 'employee';

      // Redirect based on role
      switch (role) {
        case 'super_admin':
        case 'tenant_admin':
          router.push('/admin/settings/dashboard');
          break;
        case 'hr_manager':
          router.push('/admin/dashboard');
          break;
        case 'manager':
          router.push('/manager/dashboard');
          break;
        default:
          router.push('/employee/dashboard');
      }
      return;
    }

    // Otherwise, start V2 onboarding flow at Q1
    router.push('/onboarding/q1');
  }, [state, isLoading, user, router]);

  // Loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}
