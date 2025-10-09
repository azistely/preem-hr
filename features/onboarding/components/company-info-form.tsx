'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from './form-field';

const companyInfoSchema = z.object({
  legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  industry: z.string().min(2, 'Le secteur est requis'),
  sector: z.enum(['SERVICES', 'COMMERCE', 'TRANSPORT', 'INDUSTRIE', 'CONSTRUCTION']),
  taxId: z.string().optional(),
});

type CompanyInfoFormData = z.infer<typeof companyInfoSchema>;

interface CompanyInfoFormProps {
  defaultValues?: Partial<CompanyInfoFormData>;
  onSubmit: (data: CompanyInfoFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function CompanyInfoForm({ defaultValues, onSubmit, isSubmitting = false }: CompanyInfoFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CompanyInfoFormData>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Nom de l'entreprise"
        {...register('legalName')}
        error={errors.legalName?.message}
        required
        placeholder="Ex: Ma Boutique"
      />

      <FormField
        label="Secteur d'activité"
        type="select"
        {...register('sector')}
        error={errors.sector?.message}
        required
        helperText="Détermine le taux de cotisation accident du travail (2-5%)"
      >
        <option value="">Sélectionnez un secteur</option>
        <option value="SERVICES">Services (2% cotisation AT)</option>
        <option value="COMMERCE">Commerce (2% cotisation AT)</option>
        <option value="TRANSPORT">Transport (3% cotisation AT)</option>
        <option value="INDUSTRIE">Industrie (4% cotisation AT)</option>
        <option value="CONSTRUCTION">Construction (5% cotisation AT)</option>
      </FormField>

      <FormField
        label="Secteur d'activité (détail)"
        {...register('industry')}
        error={errors.industry?.message}
        placeholder="Ex: Vente de vêtements, Restaurant, Coiffure"
        required
      />

      <FormField
        label="Numéro fiscal (optionnel)"
        {...register('taxId')}
        error={errors.taxId?.message}
        placeholder="Ex: CI-123456789"
      />

      <Button
        type="submit"
        size="lg"
        className="w-full min-h-[56px]"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Enregistrement...' : 'Continuer'}
      </Button>
    </form>
  );
}
