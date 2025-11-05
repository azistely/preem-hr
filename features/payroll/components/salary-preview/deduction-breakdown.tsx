'use client';

/**
 * Deduction Breakdown Component
 *
 * Shows employee deductions from gross salary with detailed line items:
 * - CNPS (Caisse Nationale de Prévoyance Sociale) - pension, family benefits
 * - CMU (Couverture Maladie Universelle) - universal health coverage
 * - ITS (Impôt sur les Traitements et Salaires) - income tax
 *
 * NEW: Shows itemized breakdown when contributionDetails/deductionsDetails are available
 */

import { MinusCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatPercentage } from './utils';
import type { ContributionDetail } from './types';

interface DeductionBreakdownProps {
  cnps: number;
  its: number;
  cmu: number;
  grossSalary?: number; // For showing percentages
  contributionDetails?: ContributionDetail[]; // NEW: Detailed line items
  deductionsDetails?: Array<{
    type: string;
    description: string;
    amount: number;
  }>; // NEW: Formatted deduction labels
}

export function DeductionBreakdown({
  cnps,
  its,
  cmu,
  grossSalary,
  contributionDetails = [],
  deductionsDetails = [],
}: DeductionBreakdownProps) {
  const totalDeductions = cnps + its + cmu;

  // Filter employee-only contributions
  const employeeContributions = contributionDetails.filter(c => c.paidBy === 'employee');

  // Use detailed breakdown if available, otherwise fall back to aggregated values
  const hasDetailedBreakdown = deductionsDetails.length > 0 || employeeContributions.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MinusCircle className="h-4 w-4 text-destructive" />
        <h4 className="font-semibold">Retenues (employé)</h4>
      </div>

      {/* Deductions List */}
      <div className="space-y-2 text-sm">
        {hasDetailedBreakdown ? (
          <>
            {/* Itemized Breakdown - Show every line item */}
            {deductionsDetails.map((deduction, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{deduction.description.split('(')[0].trim()}</div>
                  {deduction.description.includes('(') && (
                    <div className="text-xs text-muted-foreground">
                      {deduction.description.match(/\(([^)]+)\)/)?.[1]}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold">- {formatCurrency(deduction.amount)}</div>
                </div>
              </div>
            ))}

            {/* If deductionsDetails is empty but contributionDetails has employee items, show those */}
            {deductionsDetails.length === 0 && employeeContributions.map((contrib) => (
              <div key={contrib.code} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{contrib.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">- {formatCurrency(contrib.amount)}</div>
                </div>
              </div>
            ))}

            <Separator />

            {/* Total Deductions */}
            <div className="flex justify-between items-center font-semibold text-destructive">
              <span>Total retenues</span>
              <div className="text-right">
                <div>- {formatCurrency(totalDeductions)}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Fallback: Aggregated view (backward compatibility) */}
            {/* CNPS Employee */}
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">CNPS</div>
                <div className="text-xs text-muted-foreground">
                  Retraite + Allocations familiales
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">- {formatCurrency(cnps)}</div>
              </div>
            </div>

            {/* CMU Employee */}
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">CMU</div>
                <div className="text-xs text-muted-foreground">
                  Couverture maladie
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">- {formatCurrency(cmu)}</div>
              </div>
            </div>

            {/* ITS (Income Tax) */}
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">ITS</div>
                <div className="text-xs text-muted-foreground">
                  Impôt sur le salaire
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">- {formatCurrency(its)}</div>
              </div>
            </div>

            <Separator />

            {/* Total Deductions */}
            <div className="flex justify-between items-center font-semibold text-destructive">
              <span>Total retenues</span>
              <div className="text-right">
                <div>- {formatCurrency(totalDeductions)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Explanation */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
        <p>
          Ces retenues sont déduites de votre salaire brut et versées par l'employeur
          aux organismes sociaux (CNPS, CMU) et au Trésor Public (ITS).
        </p>
      </div>
    </div>
  );
}
