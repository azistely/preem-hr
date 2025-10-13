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
  // ✅ OPTIMIZATION: Only call auth.me (includes onboarding status now)
  // BEFORE: 2 queries (auth.me + onboarding.getState) = ~3-5 seconds
  // AFTER: 1 query (auth.me with onboarding status) = ~1.5-2 seconds
  const { data: user, isLoading } = api.auth.me.useQuery();

  useEffect(() => {
    if (isLoading || !user) return;

    // If onboarding complete, redirect to role-specific dashboard
    if (user.onboardingComplete) {
      const role = user.role || 'employee';

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
  }, [user, isLoading, router]);

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
