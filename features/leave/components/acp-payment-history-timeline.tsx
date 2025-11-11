/**
 * ACP Payment History Timeline
 *
 * Visual timeline of ACP payments for an employee
 * Following HCI principles:
 * - Visual timeline (clear chronology)
 * - Progressive disclosure (show key info, expand for details)
 * - Mobile-responsive (stack on small screens)
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, DollarSign, Wallet, Medal, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ACPPaymentHistoryEntry {
  id: string;
  acpAmount: number;
  referencePeriodStart: Date | string;
  referencePeriodEnd: Date | string;
  leaveDaysTakenCalendar: number;
  seniorityBonusDays: number;
  numberOfMonths: number;
  dailyAverageSalary: number;
  totalGrossTaxableSalary: number;
  totalPaidDays: number;
  createdAt: Date | string;
  payrollRunId?: string;
}

interface ACPPaymentHistoryTimelineProps {
  history: ACPPaymentHistoryEntry[];
}

export function ACPPaymentHistoryTimeline({
  history,
}: ACPPaymentHistoryTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements ACP</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun paiement ACP enregistré</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'PPP', { locale: fr });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Sort by most recent first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalPaid = history.reduce((sum, entry) => sum + entry.acpAmount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Historique des paiements ACP
          </CardTitle>
          <Badge variant="outline" className="text-lg font-semibold">
            Total: {formatCurrency(totalPaid)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedHistory.map((entry, index) => {
          const isExpanded = expandedIds.has(entry.id);
          const isFirst = index === 0;

          return (
            <div key={entry.id} className="space-y-4">
              {!isFirst && <Separator />}

              {/* Payment Entry */}
              <div className="space-y-3">
                {/* Header - Payment Date & Amount */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Payé le {formatDate(entry.createdAt)}
                      </span>
                      {isFirst && (
                        <Badge variant="default" className="text-xs">
                          Plus récent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(entry.acpAmount)}
                      </span>
                      {entry.seniorityBonusDays > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Medal className="h-3 w-3 mr-1" />
                          +{entry.seniorityBonusDays}j ancienneté
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Toggle Details Button */}
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-3"
                  >
                    <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Key Info - Always Visible */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Jours de congé</p>
                    <p className="font-medium">{entry.leaveDaysTakenCalendar} jours</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Période de référence</p>
                    <p className="font-medium">
                      {entry.numberOfMonths.toFixed(1)} mois
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Salaire moyen journalier</p>
                    <p className="font-medium">{formatCurrency(entry.dailyAverageSalary)}</p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-3 border">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Détail du calcul
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Période de référence</p>
                        <p className="font-medium">
                          Du {formatDate(entry.referencePeriodStart)} au{' '}
                          {formatDate(entry.referencePeriodEnd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nombre de mois</p>
                        <p className="font-medium">{entry.numberOfMonths.toFixed(2)} mois</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salaire brut imposable total</p>
                        <p className="font-medium">
                          {formatCurrency(entry.totalGrossTaxableSalary)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total jours payés</p>
                        <p className="font-medium">{entry.totalPaidDays} jours</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salaire moyen journalier</p>
                        <p className="font-medium">{formatCurrency(entry.dailyAverageSalary)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jours de congé pris (calendaires)</p>
                        <p className="font-medium">{entry.leaveDaysTakenCalendar} jours</p>
                      </div>
                      {entry.seniorityBonusDays > 0 && (
                        <div className="col-span-full">
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Medal className="h-4 w-4" />
                            Jours bonus ancienneté
                          </p>
                          <p className="font-medium text-primary">
                            +{entry.seniorityBonusDays} jour{entry.seniorityBonusDays > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Calculation Formula */}
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-1">Formule de calcul:</p>
                      <p>
                        ACP = (Salaire moyen journalier × Jours de congé calendaires × 1,25)
                        {entry.seniorityBonusDays > 0 &&
                          ` + Bonus ancienneté (${entry.seniorityBonusDays} jour${entry.seniorityBonusDays > 1 ? 's' : ''})`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
