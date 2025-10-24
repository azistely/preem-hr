/**
 * Seniority Bonus Display Component
 *
 * Shows calculated seniority bonus for banking employees
 */

'use client';

import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';

interface SeniorityBonusDisplayProps {
  baseSalary: number;
  hireDate: Date;
  countryCode?: string;
}

export function SeniorityBonusDisplay({
  baseSalary,
  hireDate,
  countryCode = 'CI',
}: SeniorityBonusDisplayProps) {
  const { data: bonus, isLoading } = trpc.banking.calculateSeniorityBonus.useQuery({
    baseSalary,
    hireDate: hireDate.toISOString(),
    countryCode,
  });

  if (isLoading) {
    return null;
  }

  if (!bonus || bonus.bonusAmount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Prime d'ancienneté automatique
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Années de service:</span>
          <span className="font-medium">{bonus.yearsOfService} ans</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pourcentage:</span>
          <span className="font-medium">{bonus.bonusPercentage}%</span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="font-semibold">Montant mensuel:</span>
          <span className="text-lg font-bold text-primary">
            {bonus.bonusAmount.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Cette prime est calculée automatiquement et ajoutée au salaire brut.
        </p>
      </CardContent>
    </Card>
  );
}
