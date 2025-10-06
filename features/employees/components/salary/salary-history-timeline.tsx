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

interface SalaryHistoryEntry {
  id: string;
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string;
  notes?: string;
  createdBy: string;
}

interface SalaryHistoryTimelineProps {
  history: SalaryHistoryEntry[];
  showAllInitially?: boolean;
}

export function SalaryHistoryTimeline({
  history,
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
    return (
      entry.baseSalary +
      (entry.housingAllowance || 0) +
      (entry.transportAllowance || 0) +
      (entry.mealAllowance || 0)
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
                          {formatCurrency(totalSalary)}
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
                    {/* Breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Base:</span>
                        <span className="font-medium ml-2">
                          {formatCurrency(entry.baseSalary)}
                        </span>
                      </div>

                      {entry.housingAllowance && entry.housingAllowance > 0 && (
                        <div>
                          <span className="text-muted-foreground">Logement:</span>
                          <span className="font-medium ml-2">
                            {formatCurrency(entry.housingAllowance)}
                          </span>
                        </div>
                      )}

                      {entry.transportAllowance && entry.transportAllowance > 0 && (
                        <div>
                          <span className="text-muted-foreground">Transport:</span>
                          <span className="font-medium ml-2">
                            {formatCurrency(entry.transportAllowance)}
                          </span>
                        </div>
                      )}

                      {entry.mealAllowance && entry.mealAllowance > 0 && (
                        <div>
                          <span className="text-muted-foreground">Repas:</span>
                          <span className="font-medium ml-2">
                            {formatCurrency(entry.mealAllowance)}
                          </span>
                        </div>
                      )}
                    </div>

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
