/**
 * Payroll Preview Card
 *
 * Shows calculated payroll preview with before/after comparison
 * Uses tRPC salaries.previewPayroll endpoint for server-side calculation
 *
 * HCI Principles:
 * - Progressive disclosure: Only shown when user clicks "Calculer l'aperçu"
 * - Immediate feedback: Shows loading state during calculation
 * - Clear visual comparison: Before vs After with percentage change
 * - French language: All labels in French
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { formatCurrency, calculatePercentageChange } from '../../hooks/use-salary-validation';
import { trpc } from '@/lib/trpc/client';
import type { SalaryComponentInstance } from '../../types/salary-components';
import { Separator } from '@/components/ui/separator';
import { getGrossSalaryLabel, getNetSalaryLabel, formatCurrencyWithRate } from '../../utils/rate-type-labels';
import type { RateType } from '../../utils/rate-type-labels';

interface PayrollPreviewCardProps {
  employeeId: string;
  countryCode: string;
  newComponents: SalaryComponentInstance[];
  currentComponents?: SalaryComponentInstance[]; // Pass current components to calculate old net
  onCalculate?: () => void;
  isCalculating?: boolean;
  rateType?: RateType; // Add rate type for rate-aware labels
}

export function PayrollPreviewCard({
  employeeId,
  countryCode,
  newComponents,
  currentComponents,
  onCalculate,
  isCalculating,
  rateType = 'MONTHLY',
}: PayrollPreviewCardProps) {
  // Use tRPC query for NEW salary payroll calculation
  const { data: newBreakdown, isLoading: loadingNew, error: errorNew } = trpc.salaries.previewPayroll.useQuery(
    {
      employeeId,
      components: newComponents.map(c => ({
        code: c.code,
        name: c.name,
        amount: c.amount,
        sourceType: c.sourceType,
      })),
      countryCode,
    },
    {
      enabled: newComponents.length > 0, // Only run query if components exist
      retry: 1,
    }
  );

  // Use tRPC query for CURRENT salary payroll calculation (for proper comparison)
  const { data: currentBreakdown, isLoading: loadingCurrent, error: errorCurrent } = trpc.salaries.previewPayroll.useQuery(
    {
      employeeId,
      components: (currentComponents || []).map(c => ({
        code: c.code,
        name: c.name,
        amount: c.amount,
        sourceType: c.sourceType,
      })),
      countryCode,
    },
    {
      enabled: !!currentComponents && currentComponents.length > 0, // Only run if current components exist
      retry: 1,
    }
  );

  const loading = loadingNew || loadingCurrent;
  const error = errorNew || errorCurrent;
  const breakdown = newBreakdown;

  // Notify parent when calculation completes
  useEffect(() => {
    if (breakdown && onCalculate) {
      onCalculate();
    }
  }, [breakdown, onCalculate]);

  if (loading || isCalculating) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Calcul en cours...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <p className="text-sm text-destructive text-center">
            {error.message || 'Erreur lors du calcul'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return null;
  }

  // Calculate net change using proper NET to NET comparison
  const currentNetSalary = currentBreakdown?.netSalary || 0;
  const netChange = currentNetSalary ? breakdown.netSalary - currentNetSalary : 0;
  const percentChange = currentNetSalary
    ? calculatePercentageChange(currentNetSalary, breakdown.netSalary)
    : 0;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Aperçu de la paie</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Calcul basé sur les nouveaux composants de salaire
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gross Salary */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">{getGrossSalaryLabel(rateType)}</p>
          <p className="text-2xl font-bold">
            {formatCurrencyWithRate(breakdown.grossSalary, rateType)}
          </p>
        </div>

        <Separator />

        {/* Deductions */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Déductions</p>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">CNPS employé</span>
            <span className="text-sm font-medium">
              -{formatCurrency(breakdown.cnpsEmployee)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">ITS (Impôt)</span>
            <span className="text-sm font-medium">
              -{formatCurrency(breakdown.tax)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Net Salary */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">{getNetSalaryLabel(rateType)}</p>
          <p className="text-3xl font-bold text-primary">
            {formatCurrencyWithRate(breakdown.netSalary, rateType)}
          </p>
        </div>

        {/* Comparison with current salary */}
        {currentNetSalary && currentNetSalary > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Comparaison</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Actuel</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(currentNetSalary)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Nouveau</p>
                <p className="text-lg font-semibold text-primary">
                  {formatCurrency(breakdown.netSalary)}
                </p>
              </div>
            </div>

            {/* Change indicator */}
            <div className={`mt-3 flex items-center gap-2 p-3 rounded-md ${
              netChange > 0
                ? 'bg-green-500/10 text-green-700'
                : netChange < 0
                ? 'bg-red-500/10 text-red-700'
                : 'bg-muted'
            }`}>
              {netChange > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Augmentation de {formatCurrency(netChange)} ({percentChange.toFixed(1)}%)
                  </span>
                </>
              ) : netChange < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Diminution de {formatCurrency(Math.abs(netChange))} ({Math.abs(percentChange).toFixed(1)}%)
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Aucun changement
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
