'use client';

/**
 * Overtime Breakdown Card Component
 *
 * Shows overtime hour calculation breakdown for both draft and calculated modes
 * - Color-coded by rate (15%, 50%, 75%)
 * - Expandable daily view
 * - Reusable for both modes
 *
 * Design: Mobile-first, touch-friendly, progressive disclosure
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface OvertimeHours {
  rate15: number;  // Hours at 15% premium (hours 41-46)
  rate50: number;  // Hours at 50% premium (hours 47+)
  rate75?: number; // Hours at 75% premium (night/holiday)
}

interface OvertimePay {
  rate15Amount: number;
  rate50Amount: number;
  rate75Amount?: number;
}

interface DailyOvertimeBreakdown {
  date: string; // ISO date string
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  overtimeRate15?: number;
  overtimeRate50?: number;
  overtimeRate75?: number;
  overtimeAmount: number;
}

interface OvertimeBreakdownCardProps {
  employeeId: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: OvertimeHours;
  overtimePay: OvertimePay;
  hourlyRate: number;
  dailyBreakdown?: DailyOvertimeBreakdown[];
}

export function OvertimeBreakdownCard({
  totalHours,
  normalHours,
  overtimeHours,
  overtimePay,
  hourlyRate,
  dailyBreakdown,
}: OvertimeBreakdownCardProps) {
  const [showDaily, setShowDaily] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const totalOvertimeAmount =
    overtimePay.rate15Amount +
    overtimePay.rate50Amount +
    (overtimePay.rate75Amount || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Heures Supplémentaires
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Hours Summary */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Heures totales</span>
            <Badge variant="outline">{totalHours}h</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Heures normales</span>
            <span className="font-medium">{normalHours}h</span>
          </div>
        </div>

        <Separator />

        {/* Overtime Breakdown by Rate */}
        <div className="space-y-3">
          <p className="font-medium text-sm">Calcul Heures Supplémentaires</p>

          {/* 15% Rate */}
          {overtimeHours.rate15 > 0 && (
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-orange-900">
                  H41-46 (Majoration 15%)
                </span>
                <Badge variant="outline" className="bg-orange-100 text-orange-700">
                  {overtimeHours.rate15}h
                </Badge>
              </div>
              <div className="text-xs text-orange-700">
                {overtimeHours.rate15}h × {formatCurrency(hourlyRate)} FCFA × 1,15
              </div>
              <div className="text-sm font-semibold text-orange-900">
                = {formatCurrency(overtimePay.rate15Amount)} FCFA
              </div>
            </div>
          )}

          {/* 50% Rate */}
          {overtimeHours.rate50 > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-red-900">
                  H47+ (Majoration 50%)
                </span>
                <Badge variant="outline" className="bg-red-100 text-red-700">
                  {overtimeHours.rate50}h
                </Badge>
              </div>
              <div className="text-xs text-red-700">
                {overtimeHours.rate50}h × {formatCurrency(hourlyRate)} FCFA × 1,50
              </div>
              <div className="text-sm font-semibold text-red-900">
                = {formatCurrency(overtimePay.rate50Amount)} FCFA
              </div>
            </div>
          )}

          {/* 75% Rate (Night/Holiday) */}
          {overtimeHours.rate75 !== undefined && overtimeHours.rate75 > 0 && (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-purple-900">
                  Heures de nuit (Majoration 75%)
                </span>
                <Badge variant="outline" className="bg-purple-100 text-purple-700">
                  {overtimeHours.rate75}h
                </Badge>
              </div>
              <div className="text-xs text-purple-700">
                {overtimeHours.rate75}h × {formatCurrency(hourlyRate)} FCFA × 1,75
              </div>
              <div className="text-sm font-semibold text-purple-900">
                = {formatCurrency(overtimePay.rate75Amount || 0)} FCFA
              </div>
            </div>
          )}

          <Separator />

          {/* Total Overtime Pay */}
          <div className="flex justify-between items-center font-bold">
            <span>TOTAL SUPPLÉMENTAIRE</span>
            <span className="text-lg text-primary">
              {formatCurrency(totalOvertimeAmount)} FCFA
            </span>
          </div>
        </div>

        {/* Daily Breakdown (Collapsible) */}
        {dailyBreakdown && dailyBreakdown.length > 0 && (
          <Collapsible open={showDaily} onOpenChange={setShowDaily}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] gap-2"
              >
                {showDaily ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Masquer répartition par jour
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Voir répartition par jour
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {dailyBreakdown.map((day, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border bg-muted/30 text-sm space-y-1"
                >
                  <div className="flex justify-between items-center font-medium">
                    <span>{formatDate(day.date)}</span>
                    <Badge variant="outline">{day.totalHours}h</Badge>
                  </div>
                  {day.overtimeHours > 0 ? (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {day.overtimeRate15 !== undefined && day.overtimeRate15 > 0 && (
                        <div>• {day.overtimeRate15}h OT @15%</div>
                      )}
                      {day.overtimeRate50 !== undefined && day.overtimeRate50 > 0 && (
                        <div>• {day.overtimeRate50}h OT @50%</div>
                      )}
                      {day.overtimeRate75 !== undefined && day.overtimeRate75 > 0 && (
                        <div>• {day.overtimeRate75}h OT @75% (nuit)</div>
                      )}
                      <div className="font-medium text-primary mt-1">
                        = +{formatCurrency(day.overtimeAmount)} FCFA
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Normal</div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
