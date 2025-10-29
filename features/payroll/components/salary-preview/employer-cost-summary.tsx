'use client';

/**
 * Employer Cost Summary Component
 *
 * Shows employer contributions (charges patronales) with detailed line items:
 * - CNPS Employer (pension, family benefits, work accident)
 * - CMU Employer (health coverage)
 * - Total cost to company
 *
 * NEW: Shows itemized breakdown when contributionDetails are available
 */

import { Building2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatPercentage } from './utils';
import type { ContributionDetail, OtherTaxDetail } from './types';

interface EmployerCostSummaryProps {
  cnps: number;
  cmu: number;
  totalCost: number;
  netSalary?: number; // For showing comparison
  contributionDetails?: ContributionDetail[]; // NEW: Detailed social security contributions
  otherTaxesDetails?: OtherTaxDetail[]; // NEW: Other employer taxes (FDFP, etc.)
}

export function EmployerCostSummary({
  cnps,
  cmu,
  totalCost,
  netSalary,
  contributionDetails = [],
  otherTaxesDetails = [],
}: EmployerCostSummaryProps) {
  // Filter employer-only contributions
  const employerContributions = contributionDetails.filter(c => c.paidBy === 'employer');

  // Filter employer-only taxes (FDFP, etc.)
  const employerTaxes = otherTaxesDetails.filter(t => t.paidBy === 'employer');

  // Use detailed breakdown if available
  const hasDetailedBreakdown = employerContributions.length > 0 || employerTaxes.length > 0;
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">Charges patronales</h4>
      </div>

      {/* Employer Contributions */}
      <div className="space-y-2 text-sm">
        {hasDetailedBreakdown ? (
          <>
            {/* Itemized Breakdown - Show every employer contribution */}
            {employerContributions.map((contrib) => (
              <div key={contrib.code} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{contrib.name}</div>
                  {contrib.rate && (
                    <div className="text-xs text-muted-foreground">
                      {formatPercentage(contrib.rate)} du salaire
                    </div>
                  )}
                  {!contrib.rate && contrib.base && (
                    <div className="text-xs text-muted-foreground">
                      Base: {formatCurrency(contrib.base)}
                    </div>
                  )}
                </div>
                <div className="font-semibold">{formatCurrency(contrib.amount)}</div>
              </div>
            ))}

            {/* Other Employer Taxes (FDFP, etc.) */}
            {employerTaxes.map((tax) => (
              <div key={tax.code} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{tax.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercentage(tax.rate)} du salaire
                  </div>
                </div>
                <div className="font-semibold">{formatCurrency(tax.amount)}</div>
              </div>
            ))}

            <Separator />

            {/* Total Employer Cost */}
            <div className="bg-primary/10 p-3 rounded-lg space-y-2">
              <div className="flex justify-between items-center font-semibold text-primary">
                <span>Coût total employeur</span>
                <span className="text-lg">{formatCurrency(totalCost)}</span>
              </div>

              {netSalary && (
                <div className="text-xs text-muted-foreground">
                  Pour un salaire net de {formatCurrency(netSalary)}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Fallback: Aggregated view (backward compatibility) */}
            {/* CNPS Employer */}
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">CNPS (employeur)</div>
                <div className="text-xs text-muted-foreground">
                  Retraite + Allocations + AT (16,45%)
                </div>
              </div>
              <div className="font-semibold">{formatCurrency(cnps)}</div>
            </div>

            {/* CMU Employer */}
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">CMU (employeur)</div>
                <div className="text-xs text-muted-foreground">
                  Part employeur (500-4,000 FCFA)
                </div>
              </div>
              <div className="font-semibold">{formatCurrency(cmu)}</div>
            </div>

            <Separator />

            {/* Total Employer Cost */}
            <div className="bg-primary/10 p-3 rounded-lg space-y-2">
              <div className="flex justify-between items-center font-semibold text-primary">
                <span>Coût total employeur</span>
                <span className="text-lg">{formatCurrency(totalCost)}</span>
              </div>

              {netSalary && (
                <div className="text-xs text-muted-foreground">
                  Pour un salaire net de {formatCurrency(netSalary)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Explanation */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
        <p>
          <strong>Charges patronales :</strong> Contributions versées par l'employeur
          en plus du salaire brut. Ces montants ne sont pas déduits du salaire de l'employé.
        </p>
      </div>
    </div>
  );
}
