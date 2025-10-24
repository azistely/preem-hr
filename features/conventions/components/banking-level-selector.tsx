/**
 * Banking Level Selector (GAP-CONV-BANK-001)
 *
 * Component to select banking professional level (I-IX) with validation
 */

'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface BankingLevelSelectorProps {
  value: number | null;
  onChange: (level: number) => void;
  baseSalary: number;
  countryCode?: string;
}

export function BankingLevelSelector({
  value,
  onChange,
  baseSalary,
  countryCode = 'CI',
}: BankingLevelSelectorProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: levels, isLoading } = trpc.banking.getLevels.useQuery({
    countryCode,
  });

  const { data: validation } = trpc.banking.validateSalary.useQuery(
    {
      salary: baseSalary,
      levelNumber: value || 1,
      countryCode,
    },
    { enabled: !!value && baseSalary > 0 }
  );

  useEffect(() => {
    if (validation && !validation.isValid) {
      setValidationError(validation.errorMessage || null);
    } else {
      setValidationError(null);
    }
  }, [validation]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  const selectedLevel = levels?.find((l: { levelNumber: number }) => l.levelNumber === value);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="professionalLevel">Niveau professionnel bancaire</Label>
        <Select
          value={value?.toString() || ''}
          onValueChange={(val) => onChange(parseInt(val))}
        >
          <SelectTrigger id="professionalLevel">
            <SelectValue placeholder="Sélectionner un niveau" />
          </SelectTrigger>
          <SelectContent>
            {levels?.map((level: { levelNumber: number; levelName: string; minimumSalary: number }) => (
              <SelectItem key={level.levelNumber} value={level.levelNumber.toString()}>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Niveau {level.levelName}</span>
                  <span className="text-xs text-muted-foreground">
                    Min: {level.minimumSalary.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedLevel && (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Salaire minimum:</span>{' '}
            <span className="font-medium">
              {selectedLevel.minimumSalary.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {selectedLevel.typicalPositions && selectedLevel.typicalPositions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedLevel.typicalPositions.map((position: string) => (
                <Badge key={position} variant="secondary">
                  {position}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {validation && validation.isValid && value && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Le salaire est conforme au niveau {selectedLevel?.levelName}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
