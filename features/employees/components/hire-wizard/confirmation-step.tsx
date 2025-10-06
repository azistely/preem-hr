/**
 * Confirmation Step - Hire Wizard
 */

import { UseFormReturn } from 'react-hook-form';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

interface ConfirmationStepProps {
  form: UseFormReturn<any>;
}

export function ConfirmationStep({ form }: ConfirmationStepProps) {
  const values = form.getValues();

  const totalGross =
    (values.baseSalary || 0) +
    (values.housingAllowance || 0) +
    (values.transportAllowance || 0) +
    (values.mealAllowance || 0);

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
            <span className="text-muted-foreground">Salaire de base</span>
            <span className="font-medium">{formatCurrency(values.baseSalary)}</span>
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
    </div>
  );
}
