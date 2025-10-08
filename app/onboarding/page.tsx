'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';

/**
 * Onboarding Entry Point
 *
 * Intelligently routes users based on onboarding state:
 * - Not started → Questionnaire
 * - Questionnaire complete → Preview
 * - In progress → Current step
 * - Complete → Dashboard
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { data: state, isLoading } = api.onboarding.getState.useQuery();

  useEffect(() => {
    if (!state || isLoading) return;

    // Onboarding complete → Dashboard
    if (state.onboarding_complete) {
      router.push('/dashboard');
      return;
    }

    // In progress → Resume at current step
    if (state.current_step) {
      router.push(`/onboarding/steps/${state.current_step}`);
      return;
    }

    // Questionnaire complete → Preview
    if (state.questionnaire_complete) {
      router.push('/onboarding/preview');
      return;
    }

    // Not started → Questionnaire
    router.push('/onboarding/questionnaire');
  }, [state, isLoading, router]);

  // Loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}
