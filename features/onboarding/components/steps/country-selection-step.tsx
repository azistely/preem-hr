'use client';

import { api } from '@/trpc/react';
import { QuestionOptionCard } from '../question-option-card';
import { HelpBox } from '../help-box';
import { toast } from 'sonner';

interface CountrySelectionStepProps {
  onComplete: () => void;
}

export function CountrySelectionStep({ onComplete }: CountrySelectionStepProps) {
  const selectCountry = api.onboarding.selectCountry.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const handleSelectCountry = async (countryCode: string) => {
    try {
      // Select country
      await selectCountry.mutateAsync({ countryCode });

      // Complete step
      await completeStep.mutateAsync({ stepId: 'country_selection' });

      toast.success('Pays sélectionné avec succès !');

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sélection');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <QuestionOptionCard
          icon="🇨🇮"
          label="Côte d'Ivoire"
          description="CNPS, ITS, SMIG 75 000 FCFA"
          onClick={() => handleSelectCountry('CI')}
          className="min-h-[60px]"
        />

        <QuestionOptionCard
          icon="🇸🇳"
          label="Sénégal"
          description="Bientôt disponible"
          onClick={() => {}}
          disabled
        />

        <QuestionOptionCard
          icon="🇧🇫"
          label="Burkina Faso"
          description="Bientôt disponible"
          onClick={() => {}}
          disabled
        />
      </div>

      <HelpBox className="mt-6">
        💡 Les règles de paie (CNPS, ITS, SMIG) seront configurées automatiquement selon votre pays
      </HelpBox>
    </>
  );
}
