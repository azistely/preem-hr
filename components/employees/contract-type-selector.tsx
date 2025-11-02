/**
 * Contract Type Selector
 *
 * Selector for employment contract types with descriptions
 */

'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type ContractType = 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';

interface ContractTypeSelectorProps {
  value: ContractType;
  onChange: (value: ContractType) => void;
  className?: string;
}

const CONTRACT_TYPES = [
  {
    value: 'CDI' as const,
    label: 'CDI - Contrat à Durée Indéterminée',
    description: 'Contrat permanent sans date de fin',
  },
  {
    value: 'CDD' as const,
    label: 'CDD - Contrat à Durée Déterminée',
    description: 'Contrat temporaire avec date de fin fixe',
  },
  {
    value: 'CDDTI' as const,
    label: 'CDDTI - Contrat Journalier',
    description: 'Contrat temporaire payé à l\'heure (tâcherons)',
  },
  {
    value: 'INTERIM' as const,
    label: 'Intérim',
    description: 'Travail temporaire via agence',
  },
  {
    value: 'STAGE' as const,
    label: 'Stage',
    description: 'Contrat de formation/apprentissage',
  },
];

export function ContractTypeSelector({
  value,
  onChange,
  className,
}: ContractTypeSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Label>Type de contrat *</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as ContractType)}
        className="space-y-3"
      >
        {CONTRACT_TYPES.map((type) => (
          <div
            key={type.value}
            className={cn(
              'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
              value === type.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <RadioGroupItem
              value={type.value}
              id={type.value}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor={type.value}
                className="font-medium cursor-pointer"
              >
                {type.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {type.description}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
