/**
 * Monthly Overtime Report Page
 *
 * Task-oriented design: "Voir le rapport mensuel des heures supplémentaires"
 * Following HCI principles:
 * - Zero learning curve (month picker obvious)
 * - Smart defaults (current month pre-selected)
 * - Progressive disclosure (details hidden until needed)
 * - Export to CSV (one-click download)
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  Calendar,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function MonthlyOvertimeReportPage() {
  // Smart default: current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  // Generate last 12 months for selector
  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      result.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: fr }),
      });
    }
    return result;
  }, []);

  // Parse selected month to date range
  const dateRange = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  }, [selectedMonth]);

  // Fetch monthly overtime report using aggregated endpoint
  const { data: reportData, isLoading } = trpc.timeTracking.getMonthlyOvertimeReport.useQuery({
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
  });

  const overtimeData = reportData?.overtimeData || [];
  const totals = reportData?.totals || { totalHours: 0, totalPay: 0, employeesWithOvertime: 0 };
  const totalEmployees = reportData?.totalEmployees || 0;
  const hasData = overtimeData.length > 0;

  // Export to CSV
  const handleExportCSV = () => {
    const csv: string[] = [];

    // Headers
    csv.push('Employé,Heures totales,41-46h (×1.15),46+ (×1.50),Samedi (×1.50),Dimanche (×1.75),Nuit (×1.75),Jour férié (×2.00),Montant FCFA');

    // Data rows
    overtimeData.forEach(({ employee, summary }) => {
      if (summary && summary.totalOvertimeHours > 0) {
        const breakdown = summary.breakdown;
        csv.push(
          `"${employee.firstName} ${employee.lastName}",` +
          `${summary.totalOvertimeHours.toFixed(2)},` +
          `${breakdown.hours_41_to_46?.toFixed(2) || 0},` +
          `${breakdown.hours_above_46?.toFixed(2) || 0},` +
          `${breakdown.saturday?.toFixed(2) || 0},` +
          `${breakdown.sunday?.toFixed(2) || 0},` +
          `${breakdown.night_work?.toFixed(2) || 0},` +
          `${breakdown.public_holiday?.toFixed(2) || 0},` +
          `${summary.overtimePay?.toFixed(0) || 0}`
        );
      }
    });

    // Totals row
    csv.push('');
    csv.push(`TOTAL,${totals.totalHours.toFixed(2)},,,,,,,${totals.totalPay.toFixed(0)}`);

    // Download
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `heures-supplementaires-${selectedMonth}.csv`;
    link.click();
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Rapport heures supplémentaires</h1>
        <p className="text-muted-foreground mt-2">
          Analysez les heures supplémentaires par employé
        </p>
      </div>

      {/* Month Selector + Export - Level 1: Primary Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Card className="flex-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Période</p>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button
              className="min-h-[48px] w-full md:w-auto"
              onClick={handleExportCSV}
              disabled={!hasData || isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter en CSV
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Télécharger pour Excel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Level 1: Essential Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total heures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                formatDuration(totals.totalHours)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              heures supplémentaires
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Coût total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>{(totals.totalPay / 1000).toFixed(0)}k</>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              FCFA en heures sup.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Employés concernés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                totals.employeesWithOvertime
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              sur {totalEmployees} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Moyenne/employé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : totals.employeesWithOvertime > 0 ? (
                formatDuration(totals.totalHours / totals.employeesWithOvertime)
              ) : (
                '0h'
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              heures par employé
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Breakdown - Level 2: Detailed Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Détail par employé
          </CardTitle>
          <CardDescription>
            Heures supplémentaires et coûts pour {format(dateRange.start, 'MMMM yyyy', { locale: fr })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement des données...</span>
            </div>
          ) : !hasData ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucune heure supplémentaire</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun employé n'a fait d'heures supplémentaires ce mois-ci
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {overtimeData
                .filter((d) => d.summary && d.summary.totalOvertimeHours > 0)
                .sort((a, b) => (b.summary?.totalOvertimeHours || 0) - (a.summary?.totalOvertimeHours || 0))
                .map(({ employee, summary }) => {
                  if (!summary) return null;

                  const weeklyLimit = 15;
                  const weeksInMonth = 4.33;
                  const monthlyLimit = weeklyLimit * weeksInMonth;
                  const percentage = (summary.totalOvertimeHours / monthlyLimit) * 100;
                  const isHighUsage = percentage > 80;

                  return (
                    <div
                      key={employee.id}
                      className={`p-4 border rounded-lg ${
                        isHighUsage ? 'border-orange-300 bg-orange-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-lg">
                              {employee.firstName} {employee.lastName}
                            </p>
                            {isHighUsage && (
                              <Badge variant="secondary" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Usage élevé ({percentage.toFixed(0)}%)
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {employee.position || 'Position non définie'}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {formatDuration(summary.totalOvertimeHours)}
                          </p>
                          <p className="text-sm font-semibold text-orange-600 mt-1">
                            {formatCurrency(summary.overtimePay || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Overtime Breakdown - Progressive Disclosure */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
                          <ChevronDown className="h-4 w-4" />
                          Voir le détail par type
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                            {summary.breakdown.hours_41_to_46 > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Heures 41-46</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.hours_41_to_46)}
                                </span>
                                <span className="text-xs text-green-600">×1.15</span>
                              </div>
                            )}
                            {summary.breakdown.hours_above_46 > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Heures 46+</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.hours_above_46)}
                                </span>
                                <span className="text-xs text-green-600">×1.50</span>
                              </div>
                            )}
                            {summary.breakdown.saturday > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Samedi</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.saturday)}
                                </span>
                                <span className="text-xs text-green-600">×1.50</span>
                              </div>
                            )}
                            {summary.breakdown.sunday > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Dimanche</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.sunday)}
                                </span>
                                <span className="text-xs text-orange-600">×1.75</span>
                              </div>
                            )}
                            {summary.breakdown.night_work > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Travail de nuit</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.night_work)}
                                </span>
                                <span className="text-xs text-orange-600">×1.75</span>
                              </div>
                            )}
                            {summary.breakdown.public_holiday > 0 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Jour férié</span>
                                <span className="font-semibold">
                                  {formatDuration(summary.breakdown.public_holiday)}
                                </span>
                                <span className="text-xs text-red-600">×2.00</span>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
