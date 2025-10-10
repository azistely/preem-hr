/**
 * Onboarding Q3: Payroll Frequency
 *
 * Final configuration step before success.
 * User selects how often they want to run payroll (monthly or bi-weekly).
 */

'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { FrequencySelector } from '@/features/onboarding/components/frequency-selector';
import { toast } from 'sonner';

export default function OnboardingQ3Page() {
  const router = useRouter();

  // tRPC mutation
  const createPayrollRunMutation = api.onboarding.createFirstPayrollRun.useMutation();

  const handleFrequencySelect = async (frequency: 'monthly' | 'bi_weekly') => {
    try {
      await createPayrollRunMutation.mutateAsync({
        frequency,
      });

      toast.success('Configuration enregistrée');

      // Navigate to success page
      router.push('/onboarding/success');
    } catch (error: any) {
      toast.error(error.message || 'Impossible de configurer la fréquence');
    }
  };

  return (
    <OnboardingQuestion
      title="À quelle fréquence payez-vous vos employés ?"
      subtitle="Choisissez la fréquence de paie la plus courante dans votre entreprise"
      progress={{ current: 3, total: 3 }}
    >
      <FrequencySelector onSelect={handleFrequencySelect} />
    </OnboardingQuestion>
  );
}
