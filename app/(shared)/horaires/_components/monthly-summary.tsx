/**
 * Monthly Summary Component
 *
 * HCI Principles Applied:
 * - Progressive disclosure: Summary always visible, details collapsible
 * - Primary metrics emphasized (large text for days/hours)
 * - Visual status indicators for approval state
 * - Color coding: Green for approved, Orange for pending
 * - Mobile-first: Responsive grid layout
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar, Clock, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WorkScheduleSummary } from '@/lib/db/schema/work-schedules';

type MonthlySummaryProps = {
  monthlyTotals?: WorkScheduleSummary;
  currentMonth: Date;
};

export function MonthlySummary({ monthlyTotals, currentMonth }: MonthlySummaryProps) {
  const daysWorked = monthlyTotals?.daysWorked || 0;
  const totalHours = monthlyTotals?.totalHours || 0;
  const pendingDays = monthlyTotals?.pendingDays || 0;
  const approvedDays = monthlyTotals?.approvedDays || 0;
  const hasUnapproved = monthlyTotals?.hasUnapproved || false;

  const monthName = format(currentMonth, 'MMMM yyyy', { locale: fr });

  return (
    <Card className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold capitalize flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            {monthName}
          </CardTitle>
          {hasUnapproved && (
            <Badge variant="secondary" className="bg-orange-500 text-white">
              <AlertCircle className="h-3 w-3 mr-1" />
              {pendingDays} jour(s) en attente
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Primary Metrics */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          {/* Days Worked */}
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-600">{daysWorked}</div>
            <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Calendar className="h-4 w-4" />
              Jours travaillés
            </div>
          </div>

          {/* Total Hours */}
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-600">
              {totalHours.toFixed(1)}
              <span className="text-2xl">h</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Clock className="h-4 w-4" />
              Heures totales
            </div>
          </div>
        </div>

        {/* Detailed Breakdown (Collapsible) */}
        {daysWorked > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-center gap-2 w-full p-2 hover:bg-blue-50 rounded-lg transition-colors">
              <span className="text-sm font-medium text-blue-700">Voir les détails</span>
              <ChevronDown className="h-4 w-4 text-blue-700" />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-3">
              <div className="border-t border-blue-200 pt-4">
                {/* Approved Days */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Jours approuvés</span>
                  </div>
                  <Badge className="bg-green-600">{approvedDays}</Badge>
                </div>

                {/* Pending Days */}
                {pendingDays > 0 && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">En attente d'approbation</span>
                    </div>
                    <Badge className="bg-orange-500">{pendingDays}</Badge>
                  </div>
                )}

                {/* Average Hours per Day */}
                {daysWorked > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mt-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Moyenne par jour</span>
                    </div>
                    <span className="font-bold text-blue-600">
                      {(totalHours / daysWorked).toFixed(1)}h
                    </span>
                  </div>
                )}
              </div>

              {/* Helper Text */}
              <div className="text-xs text-center text-muted-foreground pt-2">
                Seuls les jours approuvés seront pris en compte dans la paie
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty State */}
        {daysWorked === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Aucun jour travaillé ce mois-ci</p>
            <p className="text-xs mt-1">
              Commencez à enregistrer vos horaires ci-dessous
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
