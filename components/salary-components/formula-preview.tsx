/**
 * Formula Preview Component
 *
 * Shows a live preview of formula calculation with sample data
 * Helps users understand the formula before saving
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CIComponentMetadata } from '@/features/employees/types/salary-components';

export interface FormulaPreviewProps {
  metadata: CIComponentMetadata;
}

export function FormulaPreview({ metadata }: FormulaPreviewProps) {
  const [baseSalary, setBaseSalary] = useState(300000); // Default sample salary
  const [yearsOfService, setYearsOfService] = useState(5); // Default sample years

  const calculationResult = useMemo(() => {
    const rule = metadata.calculationRule;
    if (!rule) return null;

    if (rule.type === 'fixed') {
      return {
        amount: rule.baseAmount || 0,
        formula: `Montant fixe: ${(rule.baseAmount || 0).toLocaleString('fr-FR')} FCFA`,
      };
    }

    if (rule.type === 'percentage') {
      const percentage = (rule.rate || 0) * 100;
      const amount = baseSalary * (rule.rate || 0);
      return {
        amount,
        formula: `${baseSalary.toLocaleString('fr-FR')} × ${percentage.toFixed(1)}% = ${Math.round(amount).toLocaleString('fr-FR')} FCFA`,
      };
    }

    if (rule.type === 'auto-calculated') {
      const ratePerYear = (rule.rate || 0) * 100;
      const maxRate = (rule.cap || 0) * 100;
      const calculatedRate = yearsOfService * (rule.rate || 0);
      const effectiveRate = Math.min(calculatedRate, rule.cap || 1);
      const amount = baseSalary * effectiveRate;
      const isCapped = calculatedRate > (rule.cap || 1);

      return {
        amount,
        formula: isCapped
          ? `${baseSalary.toLocaleString('fr-FR')} × ${maxRate.toFixed(1)}% (plafonné) = ${Math.round(amount).toLocaleString('fr-FR')} FCFA`
          : `${baseSalary.toLocaleString('fr-FR')} × (${yearsOfService} ans × ${ratePerYear.toFixed(1)}%) = ${Math.round(amount).toLocaleString('fr-FR')} FCFA`,
        details: `Taux calculé: ${(calculatedRate * 100).toFixed(1)}% ${isCapped ? `(plafond: ${maxRate}%)` : ''}`,
      };
    }

    return null;
  }, [metadata, baseSalary, yearsOfService]);

  if (!metadata.calculationRule) {
    return null;
  }

  const calculationType = metadata.calculationRule.type;

  return (
    <Card className="bg-muted/50 border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">Aperçu du calcul</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sample Data Inputs */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Données de test:</p>

          {(calculationType === 'percentage' || calculationType === 'auto-calculated') && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Salaire de base (FCFA)</label>
              <Input
                type="number"
                min={0}
                step={10000}
                value={baseSalary}
                onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
                className="min-h-[44px] bg-white"
              />
            </div>
          )}

          {calculationType === 'auto-calculated' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Années de service</label>
              <Input
                type="number"
                min={0}
                max={40}
                value={yearsOfService}
                onChange={(e) => setYearsOfService(parseFloat(e.target.value) || 0)}
                className="min-h-[44px] bg-white"
              />
            </div>
          )}
        </div>

        {/* Calculation Formula */}
        {calculationResult && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Formule:</p>
            <p className="text-sm font-mono bg-white p-3 rounded-md border">
              {calculationResult.formula}
            </p>
            {calculationResult.details && (
              <p className="text-xs text-muted-foreground italic">{calculationResult.details}</p>
            )}
          </div>
        )}

        {/* Result */}
        <div className="mt-4 p-4 bg-white rounded-lg border-2 border-primary/20">
          <p className="text-sm text-muted-foreground mb-1">Résultat estimé:</p>
          <p className="text-3xl font-bold text-primary">
            {calculationResult ? Math.round(calculationResult.amount).toLocaleString('fr-FR') : '—'}{' '}
            <span className="text-xl">FCFA</span>
          </p>
        </div>

        {/* Examples for Different Scenarios */}
        {calculationType === 'auto-calculated' && (
          <div className="mt-4 p-3 bg-white rounded-md border space-y-2">
            <p className="text-sm font-medium">Exemples sur plusieurs années:</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              {[1, 5, 10, 15].map((years) => {
                const rate = Math.min(years * (metadata.calculationRule?.rate || 0), metadata.calculationRule?.cap || 1);
                const amount = baseSalary * rate;
                return (
                  <div key={years} className="flex justify-between">
                    <span>Après {years} an{years > 1 ? 's' : ''}:</span>
                    <span className="font-mono">
                      {Math.round(amount).toLocaleString('fr-FR')} FCFA ({(rate * 100).toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
