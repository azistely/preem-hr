/**
 * Confirmation Step - Hire Wizard
 */

'use client';

import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SalaryPreviewCard } from '@/features/payroll/components/salary-preview';
import type { SalaryPreviewData } from '@/features/payroll/components/salary-preview/types';

interface ConfirmationStepProps {
  form: UseFormReturn<any>;
}

export function ConfirmationStep({ form }: ConfirmationStepProps) {
  const values = form.getValues();
  const [salaryPreview, setSalaryPreview] = useState<SalaryPreviewData | null>(null);

  // Calculate salary preview using unified endpoint
  const calculatePreviewMutation = api.payroll.calculateSalaryPreview.useMutation();

  // Calculate total gross from components or individual allowances
  const components = values.components || [];
  const baseComponents = values.baseComponents || {};
  const componentTotal = components.reduce((sum: number, c: any) => sum + c.amount, 0);
  const baseSalaryTotal = Object.keys(baseComponents).length > 0
    ? Object.values(baseComponents).reduce((sum: number, amt: any) => sum + (amt || 0), 0)
    : (values.baseSalary || 0);

  const rateType = values.rateType || 'MONTHLY';
  const contractType = values.contractType || 'CDI';
  const paymentFrequency = values.paymentFrequency;
  const weeklyHoursRegime = values.weeklyHoursRegime;
  const totalGross = baseSalaryTotal + componentTotal;

  // Calculate preview when component mounts or when relevant values change
  useEffect(() => {
    const calculatePreview = async () => {
      try {
        // Only calculate if we have the minimum required data
        if (!values.hireDate || (baseSalaryTotal === 0 && componentTotal === 0)) {
          return;
        }

        // Pass base salary or base components as-is (in their original rate type)
        // Backend will handle conversion based on rateType, contractType, and paymentFrequency
        const previewBaseSalary = Object.keys(baseComponents).length === 0
          ? baseSalaryTotal
          : undefined;

        const previewBaseComponents: Record<string, number> | undefined = Object.keys(baseComponents).length > 0
          ? (baseComponents as Record<string, number>)
          : undefined;

        const result = await calculatePreviewMutation.mutateAsync({
          context: 'hiring',
          baseSalary: previewBaseSalary,
          baseComponents: previewBaseComponents,
          rateType,
          contractType,
          paymentFrequency,
          weeklyHoursRegime,
          hireDate: values.hireDate instanceof Date ? values.hireDate : new Date(values.hireDate),
          maritalStatus: values.maritalStatus || 'single',
          dependentChildren: values.taxDependents || 0,
          components: components.length > 0 ? components : undefined,
          // Map employeeType to isExpat boolean for ITS tax calculation (EXPAT = 10.4%, others = 1.2%)
          isExpat: values.employeeType === 'EXPAT',
        });

        setSalaryPreview(result.preview);
      } catch (error: any) {
        console.error('Error calculating salary preview:', error);
      }
    };

    calculatePreview();
  }, [
    values.hireDate,
    baseSalaryTotal,
    componentTotal,
    rateType,
    contractType,
    paymentFrequency,
    weeklyHoursRegime,
    components.length,
    values.taxDependents,
    values.employeeType,
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          Vérifiez les informations ci-dessous avant de confirmer l'embauche.
        </p>
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="font-semibold mb-3">Informations personnelles</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nom complet</span>
            <span className="font-medium">
              {values.firstName} {values.lastName}
            </span>
          </div>
          {values.preferredName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom préféré</span>
              <span className="font-medium">{values.preferredName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{values.email}</span>
          </div>
          {values.phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Téléphone</span>
              <span className="font-medium">{values.phone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Situation matrimoniale</span>
            <span className="font-medium">
              {values.maritalStatus === 'married' && 'Marié(e)'}
              {values.maritalStatus === 'divorced' && 'Divorcé(e)'}
              {values.maritalStatus === 'widowed' && 'Veuf/Veuve'}
              {(!values.maritalStatus || values.maritalStatus === 'single') && 'Célibataire'}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Employment Info */}
      <div>
        <h3 className="font-semibold mb-3">Informations d'emploi</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date d'embauche</span>
            <span className="font-medium">
              {format(values.hireDate, 'PPP', { locale: fr })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Poste</span>
            <span className="font-medium">Poste sélectionné</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Salary Info */}
      <div>
        <h3 className="font-semibold mb-3">Rémunération</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Salaire de base{rateType !== 'MONTHLY' ? ` (${rateType === 'DAILY' ? 'journalier' : 'horaire'})` : ''}
            </span>
            <span className="font-medium">
              {formatCurrency(baseSalaryTotal)}{rateType !== 'MONTHLY' ? `/${rateType === 'DAILY' ? 'jour' : 'heure'}` : ''}
            </span>
          </div>
          {values.housingAllowance > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Indemnité de logement</span>
              <span className="font-medium">{formatCurrency(values.housingAllowance)}</span>
            </div>
          )}
          {values.transportAllowance > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Indemnité de transport</span>
              <span className="font-medium">{formatCurrency(values.transportAllowance)}</span>
            </div>
          )}
          {values.mealAllowance > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Indemnité de repas</span>
              <span className="font-medium">{formatCurrency(values.mealAllowance)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base">
            <span className="font-semibold">Salaire brut total</span>
            <span className="font-bold text-primary text-xl">
              {formatCurrency(totalGross)}
            </span>
          </div>
        </div>
      </div>

      {/* Banking Info */}
      {(values.bankName || values.bankAccount) && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold mb-3">Informations bancaires</h3>
            <div className="space-y-2 text-sm">
              {values.bankName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Banque</span>
                  <span className="font-medium">{values.bankName}</span>
                </div>
              )}
              {values.bankAccount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compte</span>
                  <span className="font-medium font-mono">{values.bankAccount}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Salary Preview */}
      <div>
        <h3 className="font-semibold mb-3">
          {rateType === 'MONTHLY'
            ? 'Aperçu de la paie mensuelle'
            : 'Aperçu de la paie (mois type)'}
        </h3>

        {rateType !== 'MONTHLY' && (
          <Alert className="mb-3">
            <AlertDescription>
              <strong>Travailleur {rateType === 'DAILY' ? 'journalier' : 'horaire'}:</strong>{' '}
              Cet aperçu est basé sur un mois type de{' '}
              {rateType === 'DAILY' ? '30 jours' : '240 heures (30 jours × 8h)'}.{' '}
              Le salaire réel variera selon les jours/heures effectivement travaillés.
            </AlertDescription>
          </Alert>
        )}

        {calculatePreviewMutation.isPending ? (
          <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Calcul de la paie en cours...</span>
          </div>
        ) : calculatePreviewMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Impossible de calculer l'aperçu de la paie. Veuillez vérifier les informations saisies.
            </AlertDescription>
          </Alert>
        ) : salaryPreview ? (
          <SalaryPreviewCard
            preview={salaryPreview}
            context="hiring"
          />
        ) : (
          <Alert>
            <AlertDescription>
              Remplissez les informations de salaire pour voir l'aperçu de la paie.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
