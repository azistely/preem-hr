'use client';

/**
 * Unified Salary Preview Card Component
 *
 * Mobile-first, outcome-focused salary preview that works for:
 * - Employee hiring (onboarding)
 * - Salary editing (employee management)
 * - What-if scenarios (family status changes)
 *
 * Design Principles:
 * 1. Big numbers first - Net salary is the hero (text-5xl)
 * 2. Progressive disclosure - Details hidden by default (Collapsible)
 * 3. Touch-friendly - All buttons ≥44px, primary CTA ≥56px
 * 4. Context-aware - Different modes for hiring/editing/what-if
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { FiscalPartsBreakdown } from './fiscal-parts-breakdown';
import { DeductionBreakdown } from './deduction-breakdown';
import { EmployerCostSummary } from './employer-cost-summary';
import { formatCurrency, getRateTypeLabel, getContractTypeLabel } from './utils';
import type { SalaryPreviewData, SalaryPreviewContext, SalaryPreviewComparison } from './types';

interface SalaryPreviewCardProps {
  preview: SalaryPreviewData;
  context?: SalaryPreviewContext;
  comparison?: SalaryPreviewComparison; // For salary_edit context
  onConfirm?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SalaryPreviewCard({
  preview,
  context = 'hiring',
  comparison,
  onConfirm,
  onCancel,
  isLoading = false,
}: SalaryPreviewCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const netDifference = comparison?.netDifference ?? 0;
  const showComparison = context === 'salary_edit' && comparison;

  return (
    <Card className="w-full shadow-lg">
      {/* HERO SECTION - Big Number First (Mobile Priority) */}
      <CardHeader className="pb-4">
        <div className="text-center space-y-3">
          {/* Context Badge */}
          {context === 'what_if' && (
            <Badge variant="outline" className="text-sm">
              Simulation
            </Badge>
          )}

          {/* Label */}
          <div className="text-sm font-medium text-muted-foreground">
            Salaire net à payer
          </div>

          {/* Net Salary - Biggest Number */}
          <div className="text-5xl sm:text-6xl font-bold text-primary leading-none">
            {formatCurrency(preview.netSalary, preview.countryCode)}
          </div>

          {/* Comparison Badge (Salary Edit Mode) */}
          {showComparison && netDifference !== 0 && (
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant={netDifference > 0 ? 'default' : 'secondary'}
                className="text-base py-1 px-3"
              >
                {netDifference > 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {netDifference > 0 ? '+' : ''}
                {formatCurrency(netDifference, preview.countryCode)}
              </Badge>
            </div>
          )}

          {/* Rate Type & Contract */}
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {getRateTypeLabel(preview.rateType)}
            </Badge>
            {preview.contractType && (
              <Badge variant="outline">
                {getContractTypeLabel(preview.contractType)}
              </Badge>
            )}
          </div>

          {/* Payment Period Context (for non-monthly workers) */}
          {preview.paymentPeriodContext && preview.paymentPeriodContext.paymentFrequency !== 'MONTHLY' && (
            <div className="mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs font-medium text-blue-900">
                Aperçu pour 1 {preview.paymentPeriodContext.periodLabel}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {preview.paymentPeriodContext.hoursInPeriod}h ({preview.paymentPeriodContext.weeklyHoursRegime} régime) • {preview.paymentPeriodContext.daysInPeriod} jours
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Summary - Always Visible */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salaire brut</span>
            <span className="font-semibold">{formatCurrency(preview.grossSalary, preview.countryCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Brut imposable</span>
            <span className="font-medium text-orange-700">{formatCurrency(preview.brutImposable, preview.countryCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retenues employé</span>
            <span className="font-semibold text-destructive">
              - {formatCurrency(preview.cnpsEmployee + preview.its + preview.cmuEmployee, preview.countryCode)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Coût employeur</span>
            <span className="font-semibold text-primary">
              {formatCurrency(preview.totalEmployerCost, preview.countryCode)}
            </span>
          </div>
        </div>

        {/* Progressive Disclosure - Detailed Breakdown */}
        <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between min-h-[44px] hover:bg-muted/50"
            >
              <span className="font-medium">
                {isDetailsOpen ? 'Masquer les détails' : 'Voir les détails'}
              </span>
              {isDetailsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-6 pt-4">
            {/* Fiscal Parts Breakdown */}
            <FiscalPartsBreakdown
              maritalStatus={preview.maritalStatus}
              dependentChildren={preview.dependentChildren}
              fiscalParts={preview.fiscalParts}
            />

            {/* Components Breakdown */}
            <div className="space-y-3">
              <h4 className="font-semibold">Composantes du salaire</h4>
              <div className="space-y-2 text-sm">
                <TooltipProvider>
                  {preview.components.map((component, index) => {
                    const isACP = component.code?.toLowerCase().includes('acp') ||
                                  component.name?.toLowerCase().includes('acp');

                    return (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-2">
                          {isACP && <Calendar className="h-3 w-3" />}
                          {component.name}
                          {isACP && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help text-blue-600" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm font-semibold mb-1">
                                  Allocations de congés payés (ACP)
                                </p>
                                <p className="text-xs">
                                  Montant calculé selon les jours de congé pris
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                        <span className="font-medium">{formatCurrency(component.amount, preview.countryCode)}</span>
                      </div>
                    );
                  })}
                </TooltipProvider>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total brut</span>
                  <span>{formatCurrency(preview.grossSalary, preview.countryCode)}</span>
                </div>
              </div>
            </div>

            {/* Employee Deductions */}
            <DeductionBreakdown
              cnps={preview.cnpsEmployee}
              its={preview.its}
              cmu={preview.cmuEmployee}
              grossSalary={preview.grossSalary}
              contributionDetails={preview.contributionDetails}
              deductionsDetails={preview.deductionsDetails}
            />

            {/* Employer Costs */}
            <EmployerCostSummary
              cnps={preview.cnpsEmployer}
              cmu={preview.cmuEmployer}
              totalCost={preview.totalEmployerCost}
              netSalary={preview.netSalary}
              contributionDetails={preview.contributionDetails}
              otherTaxesDetails={preview.otherTaxesDetails}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* What-If Mode Info */}
        {context === 'what_if' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Ceci est une simulation. Modifiez le statut familial pour voir l'impact sur les retenues fiscales.
            </AlertDescription>
          </Alert>
        )}

        {/* Hiring Mode Info */}
        {context === 'hiring' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Ce calcul est basé sur un mois complet de travail. Le premier mois sera proratisé selon la date d'embauche.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Action Buttons - Touch-Friendly */}
      {(onConfirm || onCancel) && (
        <CardFooter className="flex flex-col gap-3 pt-4">
          {onConfirm && (
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="w-full min-h-[56px] text-lg font-semibold"
              size="lg"
            >
              {isLoading ? 'Traitement en cours...' : 'Confirmer'}
            </Button>
          )}
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="outline"
              disabled={isLoading}
              className="w-full min-h-[44px]"
            >
              Retour
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
