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
  // ✅ MAJOR OPTIMIZATION: auth.me now uses context data (near-instant!)
  // BEFORE: 4 DB queries (user + tenant + availableTenants join) = ~1.5-2 seconds
  // AFTER: 0 DB queries (context already has data) = <100ms
  const { data: user, isLoading, isError } = api.auth.me.useQuery(undefined, {
    // ✅ Use cache from login redirect instead of refetching
    // Context is fresh from SSR, no need to refetch
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // ✅ Aggressive caching - auth data rarely changes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    // Debug logging
    console.log('[Onboarding] isLoading:', isLoading, 'isError:', isError, 'user:', user);

    if (isLoading) return;

    // If no user after loading (not authenticated), redirect to login
    if (!user) {
      console.log('[Onboarding] No user found, redirecting to login');
      router.push('/login');
      return;
    }

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

  // Loading state - show minimal UI while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-preem-teal mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Chargement de votre profil...</p>
        </div>
      </div>
    );
  }

  // This should never render since useEffect handles all cases
  return null;
}
