'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const companyInfoSchema = z.object({
  legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  industry: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
});

type CompanyInfoForm = z.infer<typeof companyInfoSchema>;

interface CompanyInfoStepProps {
  onComplete: () => void;
}

export function CompanyInfoStep({ onComplete }: CompanyInfoStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setCompanyInfo = api.onboarding.setCompanyInfo.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInfoForm>({
    resolver: zodResolver(companyInfoSchema),
  });

  const onSubmit = async (data: CompanyInfoForm) => {
    setIsSubmitting(true);

    try {
      // Save company info
      await setCompanyInfo.mutateAsync(data);

      // Complete step
      await completeStep.mutateAsync({ stepId: 'company_info' });

      toast.success('Informations enregistrées !');

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        {/* Legal Name */}
        <div className="space-y-2">
          <Label htmlFor="legalName" className="text-base">
            Nom légal de l'entreprise
          </Label>
          <Input
            id="legalName"
            {...register('legalName')}
            placeholder="Ex: Ma Boutique SARL"
            className="min-h-[48px]"
          />
          {errors.legalName && (
            <p className="text-sm text-destructive">{errors.legalName.message}</p>
          )}
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="industry" className="text-base">
            Secteur d'activité
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="industry"
            {...register('industry')}
            placeholder="Ex: Commerce, Services, Agriculture"
            className="min-h-[48px]"
          />
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <Label htmlFor="taxId" className="text-base">
            Numéro d'identification fiscale
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="taxId"
            {...register('taxId')}
            placeholder="Ex: CI-123456789"
            className="min-h-[48px]"
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address" className="text-base">
            Adresse
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="address"
            {...register('address')}
            placeholder="Ex: Abidjan, Cocody"
            className="min-h-[48px]"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-base">
            Téléphone
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
            placeholder="Ex: +225 01 23 45 67 89"
            className="min-h-[48px]"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">
            Email de l'entreprise
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="Ex: contact@maboutique.ci"
            className="min-h-[48px]"
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[48px] text-lg"
      >
        {isSubmitting ? 'Enregistrement...' : 'Continuer'}
      </Button>
    </form>
  );
}
