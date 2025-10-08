'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { HelpBox } from '../help-box';

const firstEmployeeSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().min(1, 'Le numéro de téléphone est requis'),
  positionTitle: z.string().min(2, 'Le poste doit contenir au moins 2 caractères'),
  baseSalary: z.string().min(1, 'Le salaire est requis'),
  hireDate: z.string().min(1, 'La date d\'embauche est requise'),
});

type FirstEmployeeForm = z.infer<typeof firstEmployeeSchema>;

interface FirstEmployeeStepProps {
  onComplete: () => void;
}

export function FirstEmployeeStep({ onComplete }: FirstEmployeeStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createFirstEmployee = api.onboarding.createFirstEmployee.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstEmployeeForm>({
    resolver: zodResolver(firstEmployeeSchema),
    defaultValues: {
      hireDate: new Date().toISOString().split('T')[0],
      positionTitle: 'Propriétaire',
    },
  });

  const onSubmit = async (data: FirstEmployeeForm) => {
    setIsSubmitting(true);

    try {
      // Convert salary to number
      const baseSalary = parseFloat(data.baseSalary);

      if (isNaN(baseSalary) || baseSalary <= 0) {
        toast.error('Le salaire doit être un nombre valide');
        return;
      }

      // Create first employee
      await createFirstEmployee.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        positionTitle: data.positionTitle,
        baseSalary,
        hireDate: new Date(data.hireDate),
      });

      // Complete step
      await completeStep.mutateAsync({ stepId: 'first_employee' });

      toast.success('Premier employé créé avec succès !');

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de l\'employé');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <HelpBox>
        Ajoutez-vous comme premier employé. Ces informations apparaîtront sur vos bulletins de paie.
      </HelpBox>

      <div className="space-y-4">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-base">
            Prénom
          </Label>
          <Input
            id="firstName"
            {...register('firstName')}
            placeholder="Ex: Jean"
            className="min-h-[48px]"
            autoFocus
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-base">
            Nom
          </Label>
          <Input
            id="lastName"
            {...register('lastName')}
            placeholder="Ex: Kouassi"
            className="min-h-[48px]"
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-base">
            Téléphone
          </Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
            placeholder="Ex: +225 01 23 45 67 89"
            className="min-h-[48px]"
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">
            Email
            <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="Ex: jean.kouassi@example.com"
            className="min-h-[48px]"
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Position Title */}
        <div className="space-y-2">
          <Label htmlFor="positionTitle" className="text-base">
            Poste
          </Label>
          <Input
            id="positionTitle"
            {...register('positionTitle')}
            placeholder="Ex: Propriétaire, Gérant, Directeur"
            className="min-h-[48px]"
          />
          {errors.positionTitle && (
            <p className="text-sm text-destructive">{errors.positionTitle.message}</p>
          )}
        </div>

        {/* Base Salary */}
        <div className="space-y-2">
          <Label htmlFor="baseSalary" className="text-base">
            Salaire mensuel brut
          </Label>
          <div className="relative">
            <Input
              id="baseSalary"
              type="number"
              step="1000"
              {...register('baseSalary')}
              placeholder="Ex: 500000"
              className="min-h-[48px] pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              FCFA
            </span>
          </div>
          {errors.baseSalary && (
            <p className="text-sm text-destructive">{errors.baseSalary.message}</p>
          )}
          <p className="text-sm text-muted-foreground">
            💡 Le minimum légal en Côte d'Ivoire est 75,000 FCFA
          </p>
        </div>

        {/* Hire Date */}
        <div className="space-y-2">
          <Label htmlFor="hireDate" className="text-base">
            Date d'embauche
          </Label>
          <Input
            id="hireDate"
            type="date"
            {...register('hireDate')}
            className="min-h-[48px]"
          />
          {errors.hireDate && (
            <p className="text-sm text-destructive">{errors.hireDate.message}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[48px] text-lg"
      >
        {isSubmitting ? 'Création...' : 'Créer mon profil'}
      </Button>
    </form>
  );
}
