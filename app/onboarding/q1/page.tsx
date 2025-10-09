/**
 * Onboarding Q1: Country + Company Info
 *
 * First question in the 3-question task-first onboarding flow.
 * Collects country (for tax/social security rules) and company info (including sector).
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { CountrySelector } from '@/features/onboarding/components/country-selector';
import { CompanyInfoForm } from '@/features/onboarding/components/company-info-form';
import { toast } from 'sonner';

export default function OnboardingQ1Page() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryStatus, setCountryStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // tRPC mutations
  const selectCountryMutation = api.onboarding.selectCountry.useMutation();
  const setCompanyInfoMutation = api.onboarding.setCompanyInfoV2.useMutation();

  // Get user info for pre-filling
  const { data: user } = api.auth.me.useQuery();

  const handleCountrySelect = async (countryCode: string) => {
    // Optimistic UI: Update immediately
    setSelectedCountry(countryCode);
    setCountryStatus('saving');

    try {
      // Background mutation
      await selectCountryMutation.mutateAsync({ countryCode });

      // Success
      setCountryStatus('saved');
      toast.success('Pays configuré automatiquement');
    } catch (error: any) {
      // Rollback on error
      setSelectedCountry(null);
      setCountryStatus('error');
      toast.error(error.message || 'Impossible de sélectionner le pays');
    }
  };

  const handleCompanyInfoSubmit = async (data: {
    legalName: string;
    industry: string;
    sector: 'SERVICES' | 'COMMERCE' | 'TRANSPORT' | 'INDUSTRIE' | 'CONSTRUCTION';
    taxId?: string;
  }) => {
    try {
      await setCompanyInfoMutation.mutateAsync(data);
      toast.success('Informations enregistrées');

      // Navigate to Q2
      router.push('/onboarding/q2');
    } catch (error: any) {
      toast.error(error.message || 'Impossible d\'enregistrer les informations');
    }
  };

  return (
    <OnboardingQuestion
      title="Où est située votre entreprise ?"
      subtitle="Nous configurons automatiquement les règles de paie (CNPS, ITS, SMIG)"
      progress={{ current: 1, total: 3 }}
    >
      {/* Step 1: Country Selection */}
      <CountrySelector
        value={selectedCountry}
        status={countryStatus}
        onSelect={handleCountrySelect}
      />

      {/* Step 2: Company Info (appears after country selected) */}
      {selectedCountry && countryStatus === 'saved' && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">
            Informations sur votre entreprise
          </h3>
          <CompanyInfoForm
            defaultValues={{
              legalName: user?.companyName || '',
            }}
            onSubmit={handleCompanyInfoSubmit}
            isSubmitting={setCompanyInfoMutation.isPending}
          />
        </div>
      )}
    </OnboardingQuestion>
  );
}
