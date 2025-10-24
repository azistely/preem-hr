'use client';

/**
 * Salary Input Component
 *
 * Smart salary input that adapts based on rate type.
 * Shows appropriate labels and helper text for MONTHLY, DAILY, or HOURLY rates.
 *
 * Design Principles:
 * - Clear labels that match rate type
 * - Helpful examples
 * - Minimum wage validation messaging
 * - Touch-friendly input (min 48px height)
 */

import { FormField } from '@/features/onboarding/components/form-field';
import type { RateType } from './rate-type-selector';

interface SalaryInputProps {
  rateType: RateType;
  value?: number;
  onChange: (value: number) => void;
  error?: string;
  minimumWage?: number;
  disabled?: boolean;
  name?: string;
}

const RATE_TYPE_CONFIG = {
  MONTHLY: {
    label: 'Salaire mensuel brut',
    placeholder: '300000',
    suffix: 'FCFA/mois',
    helperPrefix: 'Minimum',
    example: 'Ex: 300,000 FCFA pour un employé permanent',
  },
  DAILY: {
    label: 'Tarif journalier',
    placeholder: '5000',
    suffix: 'FCFA/jour',
    helperPrefix: 'Tarif minimum recommandé',
    example: 'Ex: 5,000 FCFA pour un journalier',
  },
  HOURLY: {
    label: 'Tarif horaire',
    placeholder: '625',
    suffix: 'FCFA/heure',
    helperPrefix: 'Tarif minimum recommandé',
    example: 'Ex: 625 FCFA pour un travailleur horaire',
  },
};

export function SalaryInput({
  rateType,
  value,
  onChange,
  error,
  minimumWage = 75000,
  disabled = false,
  name = 'baseSalary',
}: SalaryInputProps) {
  const config = RATE_TYPE_CONFIG[rateType];

  // Calculate recommended minimum based on rate type
  // For DAILY: assume 22 working days/month → 75000/22 ≈ 3409 FCFA/day
  // For HOURLY: assume 173.33 hours/month → 75000/173.33 ≈ 433 FCFA/hour
  let recommendedMinimum = minimumWage;
  if (rateType === 'DAILY') {
    recommendedMinimum = Math.ceil(minimumWage / 22);
  } else if (rateType === 'HOURLY') {
    recommendedMinimum = Math.ceil(minimumWage / 173.33);
  }

  const helperText = rateType === 'MONTHLY'
    ? `${config.helperPrefix}: ${minimumWage.toLocaleString('fr-FR')} FCFA/mois (SMIG)`
    : `${config.helperPrefix}: ${recommendedMinimum.toLocaleString('fr-FR')} ${config.suffix}`;

  return (
    <div className="space-y-2">
      <FormField
        label={config.label}
        type="number"
        name={name}
        value={value}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            onChange(val);
          }
        }}
        error={error}
        disabled={disabled}
        placeholder={config.placeholder}
        suffix={config.suffix}
        helperText={helperText}
        required
      />

      {/* Visual Examples */}
      <div className="p-3 bg-muted/50 rounded-lg border">
        <p className="text-xs text-muted-foreground">
          {config.example}
        </p>
        {rateType !== 'MONTHLY' && (
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Note:</strong> Le salaire mensuel sera calculé selon les {rateType === 'DAILY' ? 'jours' : 'heures'} travaillés.
          </p>
        )}
      </div>

      {/* Warning for DAILY/HOURLY workers */}
      {rateType !== 'MONTHLY' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Important:</strong> Pour calculer la paie de cet employé, vous devrez saisir les {rateType === 'DAILY' ? 'jours travaillés' : 'heures travaillées'} lors de chaque paie.
          </p>
        </div>
      )}
    </div>
  );
}
