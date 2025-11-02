/**
 * Salary History Timeline
 *
 * Visual timeline of salary changes for an employee
 * Following HCI principles:
 * - Visual timeline (clear chronology)
 * - Progressive disclosure (collapse old entries)
 * - Mobile-responsive (stack on small screens)
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Circle, DollarSign } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, calculatePercentageChange } from '../../hooks/use-salary-validation';
import { formatCurrencyWithRate, convertMonthlyAmountToRateType } from '../../utils/rate-type-labels';
import type { RateType } from '../../utils/rate-type-labels';

interface SalaryComponent {
  code: string;
  name: string;
  amount: number;
  metadata?: any;
  sourceType: 'standard' | 'custom' | 'template';
  sourceId?: string;
}

interface SalaryHistoryEntry {
  id: string;
  baseSalary: number;
  components?: SalaryComponent[]; // New components architecture
  housingAllowance?: number; // Legacy - for backward compatibility
  transportAllowance?: number; // Legacy
  mealAllowance?: number; // Legacy
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string;
  notes?: string;
  createdBy: string;
}

interface SalaryHistoryTimelineProps {
  history: SalaryHistoryEntry[];
  rateType?: RateType | null;
  contractType?: string;
  showAllInitially?: boolean;
}

export function SalaryHistoryTimeline({
  history,
  rateType,
  contractType,
  showAllInitially = false,
}: SalaryHistoryTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun historique disponible</p>
        </CardContent>
      </Card>
    );
  }

  const calculateTotalSalary = (entry: SalaryHistoryEntry) => {
    const baseSalary = typeof entry.baseSalary === 'string'
      ? parseFloat(entry.baseSalary)
      : entry.baseSalary;

    // For CDDTI workers, all components are already stored in hourly format
    const componentsAlreadyInRateType = contractType === 'CDDTI';

    // New components architecture (preferred)
    if (entry.components && entry.components.length > 0) {
      // Check if components include base salary codes (11, 12)
      const hasBaseSalaryInComponents = entry.components.some(
        c => c.code === '11' || c.code === '12'
      );

      if (hasBaseSalaryInComponents) {
        // Components array includes base salary - use ONLY components total with rate conversion
        return entry.components.reduce((sum, component) => {
          // Base salary (code '11', '12') is already in correct rate type
          const isBaseSalary = component.code === '11' || component.code === '12' || component.code === '01';
          // For CDDTI, all components are already in hourly format
          if (isBaseSalary || componentsAlreadyInRateType) {
            return sum + (component.amount || 0);
          }
          // Convert other components from monthly to employee's rate type
          return sum + convertMonthlyAmountToRateType(component.amount || 0, rateType);
        }, 0);
      } else {
        // Legacy: components are only allowances, add to baseSalary with conversion
        return (
          baseSalary +
          entry.components.reduce((sum, component) => {
            // For CDDTI, components are already in hourly format
            if (componentsAlreadyInRateType) {
              return sum + (component.amount || 0);
            }
            // Convert components from monthly to employee's rate type
            return sum + convertMonthlyAmountToRateType(component.amount || 0, rateType);
          }, 0)
        );
      }
    }

    // Fallback to legacy allowances architecture with rate conversion
    return (
      baseSalary +
      convertMonthlyAmountToRateType(entry.housingAllowance || 0, rateType) +
      convertMonthlyAmountToRateType(entry.transportAllowance || 0, rateType) +
      convertMonthlyAmountToRateType(entry.mealAllowance || 0, rateType)
    );
  };

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      promotion: 'Promotion',
      annual_review: 'Révision annuelle',
      market_adjustment: 'Ajustement au marché',
      cost_of_living: 'Ajustement coût de la vie',
      merit_increase: 'Augmentation au mérite',
      correction: 'Correction',
      bulk_adjustment: 'Ajustement en masse',
      hire: 'Embauche',
      other: 'Autre',
    };
    return reasons[reason] || reason;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Historique salarial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {history.map((entry, index) => {
          const totalSalary = calculateTotalSalary(entry);
          const isCurrentSalary = entry.effectiveTo === null;
          const isMostRecent = index === 0;

          // Calculate change from previous
          let change: number | null = null;
          let percentageChange: number | null = null;
          if (index < history.length - 1) {
            const previousTotal = calculateTotalSalary(history[index + 1]);
            change = totalSalary - previousTotal;
            percentageChange = calculatePercentageChange(previousTotal, totalSalary);
          }

          // Calculate duration
          const startDate = new Date(entry.effectiveFrom);
          const endDate = entry.effectiveTo
            ? new Date(entry.effectiveTo)
            : new Date();
          const durationDays = differenceInDays(endDate, startDate);

          return (
            <div key={entry.id} className="relative">
              {/* Timeline Line */}
              {!isMostRecent && (
                <div className="absolute left-[23px] top-12 bottom-0 w-0.5 bg-border" />
              )}

              <div className="flex gap-4">
                {/* Timeline Dot */}
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      isCurrentSalary
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Circle className={`h-6 w-6 ${isCurrentSalary ? 'fill-current' : ''}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">
                          {formatCurrencyWithRate(totalSalary, rateType)}
                        </h3>
                        {isCurrentSalary && (
                          <Badge variant="default" className="text-xs">
                            Actuel
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(startDate, 'd MMMM yyyy', { locale: fr })}
                        {entry.effectiveTo && (
                          <>
                            {' → '}
                            {format(new Date(entry.effectiveTo), 'd MMMM yyyy', {
                              locale: fr,
                            })}
                            <span className="ml-2 text-xs">
                              ({Math.floor(durationDays / 30)} mois)
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Change Badge */}
                    {change !== null && percentageChange !== null && (
                      <Badge
                        variant={change > 0 ? 'default' : 'destructive'}
                        className="flex items-center gap-1"
                      >
                        {change > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {change > 0 ? '+' : ''}
                        {percentageChange.toFixed(1)}%
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                    {/* Breakdown - New components architecture */}
                    {entry.components && entry.components.length > 0 ? (
                      <div className="space-y-3">
                        {/* Base Salary Components (Code 11, 12) */}
                        {entry.components.some(c => c.code === '11' || c.code === '12') && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground mb-2">
                              Salaire de base
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {entry.components
                                .filter(c => c.code === '11' || c.code === '12')
                                .map((component, idx) => (
                                  <div key={idx}>
                                    <span className="text-muted-foreground">{component.name}:</span>
                                    <span className="font-medium ml-2">
                                      {formatCurrencyWithRate(component.amount, rateType)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Other Components (Allowances, Bonuses) */}
                        {entry.components.some(c => c.code !== '11' && c.code !== '12') && (
                          <div>
                            {entry.components.some(c => c.code === '11' || c.code === '12') && (
                              <Separator className="my-2" />
                            )}
                            {entry.components.some(c => c.code === '11' || c.code === '12') && (
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                Indemnités et primes
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              {entry.components
                                .filter(c => c.code !== '11' && c.code !== '12')
                                .map((component, idx) => {
                                  // For CDDTI, components are already in hourly format
                                  const componentsAlreadyInRateType = contractType === 'CDDTI';
                                  const displayAmount = componentsAlreadyInRateType
                                    ? component.amount
                                    : convertMonthlyAmountToRateType(component.amount, rateType);
                                  return (
                                    <div key={idx}>
                                      <span className="text-muted-foreground">{component.name}:</span>
                                      <span className="font-medium ml-2">
                                        {formatCurrencyWithRate(displayAmount, rateType)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback to legacy allowances display */
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Base:</span>
                          <span className="font-medium ml-2">
                            {formatCurrencyWithRate(entry.baseSalary, rateType)}
                          </span>
                        </div>

                        {entry.housingAllowance && entry.housingAllowance > 0 && (
                          <div>
                            <span className="text-muted-foreground">Logement:</span>
                            <span className="font-medium ml-2">
                              {formatCurrencyWithRate(
                                convertMonthlyAmountToRateType(entry.housingAllowance, rateType),
                                rateType
                              )}
                            </span>
                          </div>
                        )}

                        {entry.transportAllowance && entry.transportAllowance > 0 && (
                          <div>
                            <span className="text-muted-foreground">Transport:</span>
                            <span className="font-medium ml-2">
                              {formatCurrencyWithRate(
                                convertMonthlyAmountToRateType(entry.transportAllowance, rateType),
                                rateType
                              )}
                            </span>
                          </div>
                        )}

                        {entry.mealAllowance && entry.mealAllowance > 0 && (
                          <div>
                            <span className="text-muted-foreground">Repas:</span>
                            <span className="font-medium ml-2">
                              {formatCurrencyWithRate(
                                convertMonthlyAmountToRateType(entry.mealAllowance, rateType),
                                rateType
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reason */}
                    <Separator className="my-2" />
                    <div>
                      <span className="text-muted-foreground">Raison:</span>
                      <span className="font-medium ml-2">
                        {getReasonLabel(entry.changeReason)}
                      </span>
                    </div>

                    {entry.notes && (
                      <div className="text-xs text-muted-foreground italic mt-2">
                        "{entry.notes}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
