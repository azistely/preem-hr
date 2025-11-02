/**
 * Payment Frequency Selector
 *
 * Selector for CDDTI payment frequency with weekly hours regime
 */

'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type WeeklyHoursRegime = '40h' | '44h' | '48h';

interface PaymentFrequencySelectorProps {
  frequency: PaymentFrequency;
  weeklyHoursRegime: WeeklyHoursRegime;
  onFrequencyChange: (value: PaymentFrequency) => void;
  onWeeklyHoursChange: (value: WeeklyHoursRegime) => void;
  className?: string;
}

const PAYMENT_FREQUENCIES = [
  {
    value: 'DAILY' as const,
    label: 'Journalière',
    description: 'Paiement chaque jour travaillé',
  },
  {
    value: 'WEEKLY' as const,
    label: 'Hebdomadaire',
    description: 'Paiement chaque semaine',
  },
  {
    value: 'BIWEEKLY' as const,
    label: 'Bimensuelle',
    description: 'Paiement toutes les deux semaines',
  },
  {
    value: 'MONTHLY' as const,
    label: 'Mensuelle',
    description: 'Paiement chaque mois',
  },
];

const WEEKLY_HOURS_OPTIONS = [
  { value: '40h' as const, label: '40 heures/semaine' },
  { value: '44h' as const, label: '44 heures/semaine' },
  { value: '48h' as const, label: '48 heures/semaine' },
];

export function PaymentFrequencySelector({
  frequency,
  weeklyHoursRegime,
  onFrequencyChange,
  onWeeklyHoursChange,
  className,
}: PaymentFrequencySelectorProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-3">
        <Label>Fréquence de paiement *</Label>
        <RadioGroup
          value={frequency}
          onValueChange={(val) => onFrequencyChange(val as PaymentFrequency)}
          className="space-y-3"
        >
          {PAYMENT_FREQUENCIES.map((freq) => (
            <div
              key={freq.value}
              className={cn(
                'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
                frequency === freq.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem
                value={freq.value}
                id={freq.value}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor={freq.value}
                  className="font-medium cursor-pointer"
                >
                  {freq.label}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {freq.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>Régime horaire hebdomadaire *</Label>
        <Select
          value={weeklyHoursRegime}
          onValueChange={(val) => onWeeklyHoursChange(val as WeeklyHoursRegime)}
        >
          <SelectTrigger className="min-h-[48px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKLY_HOURS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Le nombre d'heures de travail par semaine pour ce travailleur journalier
        </p>
      </div>
    </div>
  );
}
