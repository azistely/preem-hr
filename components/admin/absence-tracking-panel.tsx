/**
 * Absence Tracking Panel
 *
 * Displays employee absence summary by type and reason
 * - Aggregated view by employee
 * - Breakdown by policy type (congés annuels, maladie, etc.)
 * - Breakdown by reason/motif
 * - Date range filtering
 * - Export to Excel
 */

'use client';

import { Fragment, useState } from 'react';
import { api } from '@/trpc/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react';
import { format, startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

type DatePreset = 'ytd' | '1m' | '3m' | '6m' | '1y' | 'custom';

const datePresets: Record<DatePreset, string> = {
  ytd: 'Année en cours',
  '1m': 'Dernier mois',
  '3m': '3 derniers mois',
  '6m': '6 derniers mois',
  '1y': 'Dernière année',
  custom: 'Personnalisé',
};

const policyTypeLabels: Record<string, string> = {
  annual_leave: 'Congés annuels',
  sick_leave: 'Maladie',
  maternity: 'Maternité',
  paternity: 'Paternité',
  permission: 'Permission',
  unpaid_leave: 'Congé sans solde',
  unjustified_absence: 'Absence injustifiée',
  disciplinary_suspension: 'Mise à pied',
  strike: 'Grève',
};

function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();

  switch (preset) {
    case 'ytd':
      return { start: startOfYear(now), end: endOfYear(now) };
    case '1m':
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case '3m':
      return { start: startOfMonth(subMonths(now, 3)), end: now };
    case '6m':
      return { start: startOfMonth(subMonths(now, 6)), end: now };
    case '1y':
      return { start: subMonths(now, 12), end: now };
    case 'custom':
      return { start: startOfYear(now), end: now };
  }
}

export function AbsenceTrackingPanel() {
  const [datePreset, setDatePreset] = useState<DatePreset>('ytd');
  const [startDate, setStartDate] = useState<Date>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfYear(new Date()));
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedPolicyTypes, setExpandedPolicyTypes] = useState<Set<string>>(new Set());

  // Fetch absence summary
  const { data: summary, isLoading } = api.timeOff.getAbsenceSummary.useQuery({
    startDate,
    endDate,
  });

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getDateRangeFromPreset(preset);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const togglePolicyType = (key: string) => {
    const newExpanded = new Set(expandedPolicyTypes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPolicyTypes(newExpanded);
  };

  const handleExportToExcel = () => {
    if (!summary || summary.length === 0) return;

    // Create CSV data
    const csvRows: string[] = [];

    // Header
    csvRows.push('Employé,Numéro,Type de congé,Motif,Jours,Nombre de demandes');

    // Data rows
    for (const emp of summary) {
      for (const policy of emp.byPolicyType) {
        for (const reason of policy.byReason) {
          csvRows.push(
            `"${emp.employeeLastName} ${emp.employeeFirstName}",${emp.employeeNumber},"${policy.policyName}","${reason.reason}",${reason.totalDays},${reason.count}`
          );
        }
      }
    }

    // Create blob and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `suivi-absences-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAbsenceDays = summary?.reduce((sum, emp) => sum + emp.totalDays, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Suivi des absences</CardTitle>
              <CardDescription>
                Résumé des absences par employé, type et motif
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleExportToExcel}
              disabled={!summary || summary.length === 0}
              className="min-h-[44px]"
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter (CSV)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date range filters */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Preset selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Période</label>
              <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(datePresets).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal min-h-[44px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'PPP', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setDatePreset('custom');
                      }
                    }}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal min-h-[44px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'PPP', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setDatePreset('custom');
                      }
                    }}
                    locale={fr}
                    disabled={(date) => date < startDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Summary stats */}
          {summary && summary.length > 0 && (
            <div className="flex items-center gap-6 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Total employés</p>
                <p className="text-2xl font-bold">{summary.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total jours d'absence</p>
                <p className="text-2xl font-bold">{totalAbsenceDays.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moyenne par employé</p>
                <p className="text-2xl font-bold">
                  {(totalAbsenceDays / summary.length).toFixed(1)} jours
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!summary || summary.length === 0) && (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-lg font-medium text-muted-foreground">
            Aucune absence enregistrée
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Aucune absence approuvée pour cette période
          </p>
        </div>
      )}

      {/* Summary table */}
      {!isLoading && summary && summary.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Employé</TableHead>
                <TableHead className="text-right">Total jours</TableHead>
                <TableHead className="text-right">Par type</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((emp) => {
                const isExpanded = expandedEmployees.has(emp.employeeId);

                return (
                  <Fragment key={emp.employeeId}>
                    {/* Employee row */}
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {emp.employeeLastName} {emp.employeeFirstName}
                          </p>
                          <p className="text-sm text-muted-foreground">{emp.employeeNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-base px-3 py-1">
                          {emp.totalDays.toFixed(1)} jours
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {emp.byPolicyType.length} type{emp.byPolicyType.length > 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEmployee(emp.employeeId)}
                          className="min-h-[44px] min-w-[44px]"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded policy types */}
                    {isExpanded &&
                      emp.byPolicyType.map((policy) => {
                        const policyKey = `${emp.employeeId}-${policy.policyType}`;
                        const isPolicyExpanded = expandedPolicyTypes.has(policyKey);

                        return (
                          <Fragment key={policyKey}>
                            {/* Policy type row */}
                            <TableRow
                              className="bg-muted/30 hover:bg-muted/50"
                            >
                              <TableCell className="pl-12">
                                <p className="font-medium text-sm">
                                  {policyTypeLabels[policy.policyType] || policy.policyName}
                                </p>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-sm">
                                  {policy.totalDays.toFixed(1)} jours
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {policy.byReason.length} motif{policy.byReason.length > 1 ? 's' : ''}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePolicyType(policyKey)}
                                  className="min-h-[44px] min-w-[44px]"
                                >
                                  {isPolicyExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* Expanded reasons */}
                            {isPolicyExpanded &&
                              policy.byReason.map((reason, idx) => (
                                <TableRow
                                  key={`${policyKey}-${idx}`}
                                  className="bg-muted/10"
                                >
                                  <TableCell className="pl-24">
                                    <p className="text-sm text-muted-foreground">
                                      {reason.reason}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {reason.totalDays.toFixed(1)} jours
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-muted-foreground">
                                    {reason.count} demande{reason.count > 1 ? 's' : ''}
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
