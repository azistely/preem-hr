'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from './form-field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

const employeeSchemaV2 = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().min(1, 'Le téléphone est requis'),
  positionTitle: z.string().min(1, 'La fonction est requise'),
  baseSalary: z.number().min(75000, 'Inférieur au SMIG de Côte d\'Ivoire (75,000 FCFA)'),
  hireDate: z.date({ required_error: 'La date d\'embauche est requise', invalid_type_error: 'Date invalide' }),
  // CRITICAL: Family status
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
  dependentChildren: z.number().min(0).max(10),
  // OPTIONAL: Allowances
  transportAllowance: z.number().optional(),
  housingAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchemaV2>;

interface EmployeeFormV2Props {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  isSubmitting?: boolean;
}

// Helper: Calculate fiscal parts for preview
function calculateFiscalParts(maritalStatus: string, dependents: number): number {
  let parts = 1.0; // Base

  if (maritalStatus === 'married') {
    parts += 1.0; // +1 for spouse
  }

  // +0.5 per child (max 4 children counted)
  const countedChildren = Math.min(dependents, 4);
  parts += countedChildren * 0.5;

  return parts;
}

export function EmployeeFormV2({ defaultValues, onSubmit, isSubmitting = false }: EmployeeFormV2Props) {
  const [showAllowances, setShowAllowances] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchemaV2),
    defaultValues: {
      maritalStatus: 'single',
      dependentChildren: 0,
      ...defaultValues,
    },
  });

  const maritalStatus = watch('maritalStatus');
  const dependentChildren = watch('dependentChildren') || 0;
  const fiscalParts = calculateFiscalParts(maritalStatus, dependentChildren);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Informations de base</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Prénom"
            {...register('firstName')}
            error={errors.firstName?.message}
            required
            placeholder="Ex: Jean"
          />

          <FormField
            label="Nom"
            {...register('lastName')}
            error={errors.lastName?.message}
            required
            placeholder="Ex: Kouassi"
          />
        </div>

        <FormField
          label="Email (optionnel)"
          type="email"
          {...register('email')}
          error={errors.email?.message}
          placeholder="Ex: jean.kouassi@example.com"
        />

        <FormField
          label="Téléphone"
          type="tel"
          {...register('phone')}
          error={errors.phone?.message}
          placeholder="+225 01 23 45 67 89"
          required
        />

        <FormField
          label="Fonction"
          {...register('positionTitle')}
          error={errors.positionTitle?.message}
          placeholder="Ex: Gérant, Vendeur, Caissier"
          required
        />

        <FormField
          label="Date d'embauche"
          type="date"
          {...register('hireDate', {
            setValueAs: (value) => {
              // Handle empty string or undefined
              if (!value || value === '') return undefined;
              const date = new Date(value);
              return isNaN(date.getTime()) ? undefined : date;
            },
          })}
          error={errors.hireDate?.message}
          required
        />
      </div>

      {/* CRITICAL: Family Status (for tax calculation) */}
      <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
        <div>
          <h3 className="text-lg font-semibold">
            Situation familiale
          </h3>
          <p className="text-sm text-muted-foreground">
            Pour le calcul de l'impôt sur le revenu (ITS)
          </p>
        </div>

        <FormField
          label="Statut marital"
          type="select"
          {...register('maritalStatus')}
          error={errors.maritalStatus?.message}
          required
        >
          <option value="single">Célibataire</option>
          <option value="married">Marié(e)</option>
          <option value="divorced">Divorcé(e)</option>
          <option value="widowed">Veuf/Veuve</option>
        </FormField>

        <FormField
          label="Nombre d'enfants à charge"
          type="number"
          {...register('dependentChildren', {
            setValueAs: (value) => value ? parseInt(value, 10) : 0,
          })}
          error={errors.dependentChildren?.message}
          required
          helperText="Réduit l'impôt sur le revenu (ITS)"
        />

        {/* Show fiscal parts preview */}
        <div className="text-sm p-3 bg-white rounded border">
          <strong>Parts fiscales calculées: {fiscalParts}</strong>
          <p className="text-muted-foreground mt-1">
            1.0 (base)
            {maritalStatus === 'married' && ' + 1.0 (marié)'}
            {dependentChildren > 0 && ` + ${Math.min(dependentChildren, 4) * 0.5} (${Math.min(dependentChildren, 4)} enfant${Math.min(dependentChildren, 4) > 1 ? 's' : ''})`}
          </p>
          {dependentChildren > 4 && (
            <p className="text-xs text-orange-600 mt-1">
              Note: Maximum 4 enfants pris en compte pour le calcul fiscal
            </p>
          )}
        </div>
      </div>

      {/* Salary */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Rémunération</h3>

        <FormField
          label="Salaire de base mensuel"
          type="number"
          {...register('baseSalary', {
            setValueAs: (value) => value ? parseFloat(value) : undefined,
          })}
          error={errors.baseSalary?.message}
          suffix="FCFA"
          required
          helperText="Minimum légal: 75,000 FCFA (SMIG Côte d'Ivoire)"
        />

        {/* Optional: Allowances (collapsible) */}
        <Collapsible open={showAllowances} onOpenChange={setShowAllowances}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full"
            >
              {showAllowances ? 'Masquer' : 'Ajouter'} les indemnités (transport, logement)
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4">
            <FormField
              label="Indemnité de transport"
              type="number"
              {...register('transportAllowance', {
                setValueAs: (value) => value ? parseFloat(value) : undefined,
              })}
              error={errors.transportAllowance?.message}
              suffix="FCFA"
              placeholder="Ex: 25,000"
              helperText="Montant mensuel (optionnel)"
            />

            <FormField
              label="Indemnité de logement"
              type="number"
              {...register('housingAllowance', {
                setValueAs: (value) => value ? parseFloat(value) : undefined,
              })}
              error={errors.housingAllowance?.message}
              suffix="FCFA"
              placeholder="Ex: 50,000"
              helperText="Montant mensuel (optionnel)"
            />

            <FormField
              label="Indemnité de repas"
              type="number"
              {...register('mealAllowance', {
                setValueAs: (value) => value ? parseFloat(value) : undefined,
              })}
              error={errors.mealAllowance?.message}
              suffix="FCFA"
              placeholder="Ex: 15,000"
              helperText="Montant mensuel (optionnel)"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full min-h-[56px]"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Ajout en cours...' : 'Ajouter cet employé →'}
      </Button>
    </form>
  );
}
