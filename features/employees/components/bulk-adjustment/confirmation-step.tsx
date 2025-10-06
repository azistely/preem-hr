/**
 * Confirmation Step - Bulk Salary Adjustment Wizard
 */

import { UseFormReturn } from 'react-hook-form';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check } from 'lucide-react';

interface ConfirmationStepProps {
  form: UseFormReturn<any>;
}

export function ConfirmationStep({ form }: ConfirmationStepProps) {
  const data = form.getValues();

  const getAdjustmentTypeLabel = (type: string) => {
    switch (type) {
      case 'percentage':
        return 'Pourcentage';
      case 'fixed_amount':
        return 'Montant fixe';
      case 'custom':
        return 'Personnalisé';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-green-500 rounded-full p-2">
            <Check className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900">
              Prêt à appliquer les ajustements
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Vérifiez un dernière fois les détails ci-dessous
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Détails de l'ajustement</h4>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Nom:</dt>
              <dd className="text-sm font-medium">{data.name}</dd>
            </div>
            {data.description && (
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Description:</dt>
                <dd className="text-sm font-medium">{data.description}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Type:</dt>
              <dd className="text-sm font-medium">
                {getAdjustmentTypeLabel(data.adjustmentType)}
              </dd>
            </div>
            {data.adjustmentValue && (
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Valeur:</dt>
                <dd className="text-sm font-medium">
                  {data.adjustmentType === 'percentage'
                    ? `${data.adjustmentValue}%`
                    : `${data.adjustmentValue.toLocaleString('fr-FR')} FCFA`}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Date d'effet:</dt>
              <dd className="text-sm font-medium">
                {format(data.effectiveFrom, 'PPP', { locale: fr })}
              </dd>
            </div>
          </dl>
        </div>

        {data.filters && Object.keys(data.filters).length > 0 && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Filtres appliqués</h4>
            <ul className="space-y-2">
              {data.filters.positionIds && data.filters.positionIds.length > 0 && (
                <li className="text-sm">
                  <span className="text-muted-foreground">Postes:</span>{' '}
                  <span className="font-medium">{data.filters.positionIds.length} sélectionné(s)</span>
                </li>
              )}
              {data.filters.minSalary && (
                <li className="text-sm">
                  <span className="text-muted-foreground">Salaire min:</span>{' '}
                  <span className="font-medium">{data.filters.minSalary.toLocaleString('fr-FR')} FCFA</span>
                </li>
              )}
              {data.filters.maxSalary && (
                <li className="text-sm">
                  <span className="text-muted-foreground">Salaire max:</span>{' '}
                  <span className="font-medium">{data.filters.maxSalary.toLocaleString('fr-FR')} FCFA</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Information:</strong> Les ajustements seront immédiatement appliqués et pris en compte
          dans les prochains calculs de paie à partir de la date d'effet.
        </p>
      </div>
    </div>
  );
}
