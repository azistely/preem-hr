'use client';

/**
 * Overtime Breakdown Card
 *
 * Shows detailed breakdown of overtime hours and calculations
 * for a specific employee in a payroll run
 */

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { api } from '@/trpc/react';

interface OvertimeBreakdownCardProps {
  runId: string;
  employeeId: string;
  employeeName: string;
  daysWorked?: number;
  daysAbsent?: number;
  formatCurrency: (amount: number | string) => string;
}

export function OvertimeBreakdownCard({
  runId,
  employeeId,
  employeeName,
  daysWorked = 0,
  daysAbsent = 0,
  formatCurrency,
}: OvertimeBreakdownCardProps) {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);

  // Fetch overtime breakdown
  const { data: breakdown, isLoading } = api.payrollReview.getOvertimeBreakdown.useQuery(
    { runId, employeeId },
    { enabled: !!runId && !!employeeId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temps de Travail et Congés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temps de Travail et Congés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Jours travaillés</span>
            </div>
            <Badge variant="outline">{daysWorked} jours</Badge>
          </div>
          {daysAbsent > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Jours d'absence</span>
              </div>
              <Badge variant="secondary">{daysAbsent} jours</Badge>
            </div>
          )}
          <div className="text-sm text-muted-foreground pt-2">
            Aucune donnée de pointage disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalHours, normalHours, overtimeHours, overtimePay, hourlyRate, entries } = breakdown;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Temps de Travail et Congés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Days Worked */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Jours travaillés</span>
          </div>
          <Badge variant="outline">{daysWorked} jours</Badge>
        </div>

        {/* Days Absent */}
        {daysAbsent > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Jours d'absence</span>
            </div>
            <Badge variant="secondary">{daysAbsent} jours</Badge>
          </div>
        )}

        <Separator />

        {/* Total Hours */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">⏱️ Heures Totales</span>
          <span className="font-medium">{totalHours.toFixed(1)} heures</span>
        </div>

        {/* Normal Hours */}
        <div className="flex justify-between text-sm pl-4">
          <span className="text-muted-foreground">├─ Heures normales</span>
          <span>{normalHours.toFixed(1)}h</span>
        </div>

        {/* Overtime Hours */}
        {overtimeHours.total > 0 && (
          <>
            {overtimeHours.rate15 > 0 && (
              <div className="flex justify-between text-sm pl-4">
                <span className="text-muted-foreground">├─ Heures sup 15%</span>
                <span className="font-medium text-orange-600">{overtimeHours.rate15.toFixed(1)}h</span>
              </div>
            )}
            {overtimeHours.rate50 > 0 && (
              <div className="flex justify-between text-sm pl-4">
                <span className="text-muted-foreground">└─ Heures sup 50%</span>
                <span className="font-medium text-red-600">{overtimeHours.rate50.toFixed(1)}h</span>
              </div>
            )}
          </>
        )}

        {/* Overtime Calculation Breakdown */}
        {overtimePay.total > 0 && (
          <>
            <Separator className="my-2" />
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">💰 Calcul Heures Supplémentaires</div>

              {overtimeHours.rate15 > 0 && (
                <div className="text-xs space-y-1">
                  <div className="text-muted-foreground">
                    H41-46 (15%): {overtimeHours.rate15.toFixed(1)}h × {Math.round(hourlyRate)} × 1,15
                  </div>
                  <div className="font-medium pl-4">
                    = {formatCurrency(overtimeHours.rate15 * hourlyRate * 1.15)} FCFA
                  </div>
                </div>
              )}

              {overtimeHours.rate50 > 0 && (
                <div className="text-xs space-y-1">
                  <div className="text-muted-foreground">
                    H47-52 (50%): {overtimeHours.rate50.toFixed(1)}h × {Math.round(hourlyRate)} × 1,50
                  </div>
                  <div className="font-medium pl-4">
                    = {formatCurrency(overtimeHours.rate50 * hourlyRate * 1.50)} FCFA
                  </div>
                </div>
              )}

              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total HS:</span>
                <span className="text-primary">{formatCurrency(overtimePay.total)} FCFA</span>
              </div>
            </div>
          </>
        )}

        {/* Daily Breakdown Toggle */}
        {entries && entries.length > 0 && (
          <Collapsible open={showDailyBreakdown} onOpenChange={setShowDailyBreakdown}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between mt-2"
              >
                <span className="text-sm">Voir heures par jour</span>
                {showDailyBreakdown ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <div className="bg-muted/30 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Détail Hebdomadaire - {employeeName}
                </div>
                {entries.map((entry, idx) => (
                  <div key={idx} className="text-xs flex justify-between py-1">
                    <span className="text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                    <span>{entry.hoursWorked.toFixed(1)}h</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="text-xs font-medium">
                  Total: {totalHours.toFixed(1)}h dont {overtimeHours.total.toFixed(1)}h supplémentaires
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
