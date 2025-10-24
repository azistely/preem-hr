'use client';

/**
 * Rate Type Selector Component
 *
 * Allows selection between MONTHLY, DAILY, and HOURLY payment types.
 * Changes the salary input label and helper text dynamically.
 *
 * Design Principles:
 * - Simple toggle UI (3 options)
 * - Clear visual feedback for selected type
 * - Touch-friendly buttons (min 44px height)
 * - French language
 */

import { useState } from 'react';
import { Calendar, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RateType = 'MONTHLY' | 'DAILY' | 'HOURLY';

interface RateTypeSelectorProps {
  value: RateType;
  onChange: (rateType: RateType) => void;
  disabled?: boolean;
}

const RATE_TYPES = [
  {
    value: 'MONTHLY' as const,
    label: 'Mensuel',
    icon: Calendar,
    description: 'Salaire mensuel fixe',
    example: '300,000 FCFA/mois',
  },
  {
    value: 'DAILY' as const,
    label: 'Journalier',
    icon: DollarSign,
    description: 'Tarif à la journée',
    example: '5,000 FCFA/jour',
  },
  {
    value: 'HOURLY' as const,
    label: 'Horaire',
    icon: Clock,
    description: 'Tarif à l\'heure',
    example: '625 FCFA/heure',
  },
];

export function RateTypeSelector({ value, onChange, disabled = false }: RateTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Type de rémunération
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {RATE_TYPES.map((rateType) => {
          const Icon = rateType.icon;
          const isSelected = value === rateType.value;

          return (
            <button
              key={rateType.value}
              type="button"
              onClick={() => onChange(rateType.value)}
              disabled={disabled}
              className={cn(
                'min-h-[56px] p-4 rounded-lg border-2 transition-all',
                'flex flex-col items-start gap-1',
                'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon className={cn(
                  'h-5 w-5',
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'font-medium',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}>
                  {rateType.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                {rateType.description}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 'MONTHLY' && 'Le salaire mensuel est fixe, indépendamment des jours travaillés (sauf proration pour embauche/départ).'}
        {value === 'DAILY' && 'Le salaire est calculé selon le nombre de jours travaillés dans le mois.'}
        {value === 'HOURLY' && 'Le salaire est calculé selon le nombre d\'heures travaillées dans le mois.'}
      </p>
    </div>
  );
}
