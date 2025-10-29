'use client';

/**
 * Fiscal Parts Breakdown Component
 *
 * Shows how fiscal parts (parts fiscales) are calculated based on:
 * - Marital status (célibataire, marié, divorcé, veuf)
 * - Number of dependent children
 *
 * Used to help users understand tax deductions (ITS calculation).
 */

import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getMaritalStatusLabel, getFiscalPartsFormula } from './utils';

interface FiscalPartsBreakdownProps {
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number;
  fiscalParts: number;
}

export function FiscalPartsBreakdown({
  maritalStatus,
  dependentChildren,
  fiscalParts,
}: FiscalPartsBreakdownProps) {
  const { formula, explanation } = getFiscalPartsFormula(maritalStatus, dependentChildren);

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">Parts fiscales</h4>
      </div>

      {/* Visual Status Display */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-base py-1 px-3">
          {getMaritalStatusLabel(maritalStatus)}
        </Badge>
        {dependentChildren > 0 && (
          <Badge variant="outline" className="text-base py-1 px-3">
            {dependentChildren} enfant{dependentChildren > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Calculation Formula */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <div className="font-mono bg-background p-3 rounded text-sm">
            {formula}
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">=</span>
          <span className="text-3xl font-bold text-primary">{fiscalParts.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">parts</span>
        </div>
      </div>

      {/* Impact Explanation */}
      <div className="text-xs text-muted-foreground bg-background p-3 rounded">
        <p className="font-semibold mb-1">💡 Qu'est-ce que c'est ?</p>
        <p>
          Plus vous avez de parts fiscales, moins vous payez d'ITS (impôt sur les traitements et salaires).
          Les parts prennent en compte votre situation familiale.
        </p>
      </div>
    </div>
  );
}
