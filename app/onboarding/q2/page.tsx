/**
 * Onboarding Q2: Employee Data Migration
 *
 * HCI-compliant wizard for importing existing employees
 * Three paths: Self-service, Guided, WhatsApp assistance
 *
 * ORIGINAL VERSION BACKED UP at: page-original-backup.tsx
 */

'use client';

import { useRouter } from 'next/navigation';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { EmployeeMigrationWizard } from './components/employee-migration-wizard';

export default function OnboardingQ2Page() {
  const router = useRouter();

  const handleComplete = () => {
    // Navigate to success after employee import
    router.push('/onboarding/success');
  };

  const handleSkip = () => {
    // Allow skipping employee import (can add later)
    router.push('/onboarding/success');
  };

  return (
    <OnboardingQuestion
      title="Ajoutez vos employés"
      subtitle="Importez vos données existantes ou démarrez de zéro"
      progress={{ current: 3, total: 3 }}
    >
      <EmployeeMigrationWizard
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </OnboardingQuestion>
  );
}
