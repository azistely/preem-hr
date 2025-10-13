/**
 * Onboarding Q1: Country + Company Info
 *
 * Single-form approach: All company info in one form (country + details)
 * Follows HCI principle: Complete primary action in fewer than 3 steps
 */

'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { FormField } from '@/features/onboarding/components/form-field';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const companySetupSchema = z.object({
  countryCode: z.string().min(2, 'Sélectionnez un pays'),
  legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  industry: z.string().min(2, 'Le secteur est requis'),
  sector: z.enum(['SERVICES', 'COMMERCE', 'TRANSPORT', 'INDUSTRIE', 'CONSTRUCTION']),
  taxId: z.string().optional(),
});

type CompanySetupFormData = z.infer<typeof companySetupSchema>;

export default function OnboardingQ1Page() {
  const router = useRouter();

  // Get user info for pre-filling
  const { data: user } = api.auth.me.useQuery();

  // ✅ OPTIMIZATION: Single mutation instead of two sequential calls
  // BEFORE: selectCountry + setCompanyInfoV2 = 2 API calls = ~2-3 seconds
  // AFTER: setCompanyInfoV2 with country = 1 API call = ~1 second
  const setCompanyInfoMutation = api.onboarding.setCompanyInfoV2.useMutation();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompanySetupFormData>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      countryCode: 'CI', // Default to Côte d'Ivoire
      legalName: user?.companyName || '',
      sector: 'SERVICES',
    },
  });

  const onSubmit = async (data: CompanySetupFormData) => {
    try {
      // Save country + company info in ONE call (optimized)
      await setCompanyInfoMutation.mutateAsync({
        countryCode: data.countryCode,
        legalName: data.legalName,
        industry: data.industry,
        sector: data.sector,
        taxId: data.taxId,
      });

      toast.success('Configuration enregistrée');

      // Navigate to Q2
      router.push('/onboarding/q2');
    } catch (error: any) {
      toast.error(error.message || 'Impossible d\'enregistrer les informations');
    }
  };

  return (
    <OnboardingQuestion
      title="Configurez votre entreprise"
      subtitle="Nous configurons automatiquement les règles de paie pour votre pays"
      progress={{ current: 1, total: 3 }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Country Selection */}
        <FormField
          label="Pays"
          type="select"
          {...register('countryCode')}
          error={errors.countryCode?.message}
          required
          helperText="Détermine CNPS/IPRES, ITS/IRPP, SMIG"
        >
          <option value="CI">🇨🇮 Côte d'Ivoire (CNPS 6.3%, ITS, SMIG 75,000)</option>
          <option value="SN" disabled>🇸🇳 Sénégal (Bientôt disponible)</option>
          <option value="BF" disabled>🇧🇫 Burkina Faso (Bientôt disponible)</option>
          <option value="ML" disabled>🇲🇱 Mali (Bientôt disponible)</option>
        </FormField>

        {/* Company Name */}
        <FormField
          label="Nom de l'entreprise"
          {...register('legalName')}
          error={errors.legalName?.message}
          required
          placeholder="Ex: Ma Boutique"
        />

        {/* Sector (Work Accident Rate) */}
        <FormField
          label="Secteur d'activité"
          type="select"
          {...register('sector')}
          error={errors.sector?.message}
          required
          helperText="Détermine le taux de cotisation accident du travail (2-5%)"
        >
          <option value="SERVICES">Services (2% cotisation AT)</option>
          <option value="COMMERCE">Commerce (2% cotisation AT)</option>
          <option value="TRANSPORT">Transport (3% cotisation AT)</option>
          <option value="INDUSTRIE">Industrie (4% cotisation AT)</option>
          <option value="CONSTRUCTION">Construction (5% cotisation AT)</option>
        </FormField>

        {/* Industry Detail */}
        <FormField
          label="Type d'activité"
          {...register('industry')}
          error={errors.industry?.message}
          placeholder="Ex: Vente de vêtements, Restaurant, Coiffure"
          required
        />

        {/* Tax ID (Optional) */}
        <FormField
          label="Numéro fiscal (optionnel)"
          {...register('taxId')}
          error={errors.taxId?.message}
          placeholder="Ex: CI-123456789"
        />

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          className="w-full min-h-[56px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enregistrement...' : 'Continuer →'}
        </Button>
      </form>
    </OnboardingQuestion>
  );
}
