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
import { trpc } from '@/lib/trpc/client';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfirmationStepProps {
  form: UseFormReturn<any>;
}

export function ConfirmationStep({ form }: ConfirmationStepProps) {
  const values = form.getValues();
  const [payslipPreview, setPayslipPreview] = useState<any>(null);

  // Calculate payslip preview
  const calculatePreviewMutation = trpc.onboarding.calculatePayslipPreview.useMutation();

  // Calculate total gross from components or individual allowances
  const components = values.components || [];
  const baseComponents = values.baseComponents || {};
  const componentTotal = components.reduce((sum: number, c: any) => sum + c.amount, 0);
  const baseSalaryTotal = Object.keys(baseComponents).length > 0
    ? Object.values(baseComponents).reduce((sum: number, amt: any) => sum + (amt || 0), 0)
    : (values.baseSalary || 0);

  const rateType = values.rateType || 'MONTHLY';

  // For preview calculation, convert daily/hourly rates to estimated monthly
  // This is ONLY for preview purposes - actual payroll uses real days/hours worked
  // IMPORTANT: Use 30 days (not 22) to match backend validation logic in onboarding.ts
  const getEstimatedMonthlySalary = () => {
    if (rateType === 'DAILY') {
      // Use 30 days to match backend SMIG validation (75,000 / 30 = 2,500/day)
      return Math.round(baseSalaryTotal * 30);
    } else if (rateType === 'HOURLY') {
      // Standard month = 240 hours (30 days × 8 hours)
      return Math.round(baseSalaryTotal * 240);
    }
    return baseSalaryTotal; // MONTHLY
  };

  const estimatedMonthlySalary = getEstimatedMonthlySalary();
  const totalGross = baseSalaryTotal + componentTotal;

  // Calculate preview when component mounts or when relevant values change
  useEffect(() => {
    const calculatePreview = async () => {
      try {
        // Only calculate if we have the minimum required data
        if (!values.hireDate || (baseSalaryTotal === 0 && componentTotal === 0)) {
          return;
        }

        // For preview, we need to pass monthly amounts to get accurate deductions
        // Convert base salary to monthly equivalent for daily/hourly workers
        const previewBaseSalary = Object.keys(baseComponents).length === 0
          ? estimatedMonthlySalary
          : undefined;

        // For base components, convert to monthly if needed
        // IMPORTANT: Use 30 days (not 22) to match backend validation
        const previewBaseComponents: Record<string, number> | undefined = Object.keys(baseComponents).length > 0
          ? Object.fromEntries(
              Object.entries(baseComponents).map(([code, amount]) => {
                const numAmount = typeof amount === 'number' ? amount : 0;
                return [
                  code,
                  rateType === 'DAILY'
                    ? Math.round(numAmount * 30)
                    : rateType === 'HOURLY'
                    ? Math.round(numAmount * 240)
                    : numAmount
                ];
              })
            ) as Record<string, number>
          : undefined;

        const result = await calculatePreviewMutation.mutateAsync({
          baseSalary: previewBaseSalary,
          baseComponents: previewBaseComponents,
          rateType: 'MONTHLY', // Always pass MONTHLY for preview calculation
          hireDate: values.hireDate instanceof Date ? values.hireDate : new Date(values.hireDate),
          maritalStatus: values.maritalStatus || 'single',
          dependentChildren: values.dependentChildren || 0,
          components: components.length > 0 ? components : undefined,
        });

        setPayslipPreview(result.payslipPreview);
      } catch (error: any) {
        console.error('Error calculating payslip preview:', error);
      }
    };

    calculatePreview();
  }, [values.hireDate, baseSalaryTotal, componentTotal, rateType, components.length]);

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

      {/* Payslip Preview */}
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
        ) : payslipPreview ? (
          <div className="p-4 bg-white rounded-lg border">
            <div className="space-y-2">
              {rateType !== 'MONTHLY' && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Taux {rateType === 'DAILY' ? 'journalier' : 'horaire'}:
                    </span>
                    <span className="font-medium">
                      {formatCurrency(baseSalaryTotal)}/{rateType === 'DAILY' ? 'jour' : 'heure'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      × {rateType === 'DAILY' ? '30 jours' : '240 heures'} (mois type):
                    </span>
                    <span className="font-medium">
                      {formatCurrency(estimatedMonthlySalary)}
                    </span>
                  </div>
                  <Separator />
                </>
              )}

              <div className="flex justify-between">
                <span>Salaire brut {rateType !== 'MONTHLY' ? 'estimé' : ''}:</span>
                <strong className="text-lg">{formatCurrency(payslipPreview.grossSalary)}</strong>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span>CNPS (6.3%):</span>
                <span className="text-red-600">-{formatCurrency(payslipPreview.cnpsEmployee)}</span>
              </div>

              {payslipPreview.cmuEmployee && payslipPreview.cmuEmployee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>CMU (1%):</span>
                  <span className="text-red-600">-{formatCurrency(payslipPreview.cmuEmployee)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span>ITS ({payslipPreview.fiscalParts ?? 1} parts):</span>
                <span className="text-red-600">-{formatCurrency(payslipPreview.incomeTax)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
                <span className="font-semibold">Salaire net {rateType !== 'MONTHLY' ? 'estimé' : ''}:</span>
                <strong className="text-2xl text-green-700">
                  {formatCurrency(payslipPreview.netSalary)}
                </strong>
              </div>

              <div className="text-xs text-muted-foreground mt-3">
                💡 Cet aperçu est basé sur un statut célibataire sans enfants. Vous pourrez ajuster ces informations après la création de l'employé.
              </div>
            </div>
          </div>
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
