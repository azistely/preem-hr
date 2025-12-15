/**
 * Attendance Report Component
 *
 * Main report component that combines:
 * - Period selection (weekly/monthly toggle, navigation)
 * - Summary cards
 * - Calendar grid
 * - Export buttons
 *
 * HCI Principles:
 * - Task-oriented: "Voir le pointage de mon équipe"
 * - Smart defaults: Current week/month pre-selected
 * - Zero learning curve: Obvious controls
 * - Progressive disclosure: Details on click
 */

'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Search,
  Loader2,
  Users,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import { AttendanceSummaryCards } from './attendance-summary-cards';
import { AttendanceCalendarGrid } from './attendance-calendar-grid';
import type { AttendanceViewMode } from '@/features/attendance/types/attendance.types';

interface AttendanceReportProps {
  /**
   * 'team' = Manager view (direct reports only)
   * 'all' = Admin view (all employees)
   */
  scope: 'team' | 'all';
}

export function AttendanceReport({ scope }: AttendanceReportProps) {
  // View mode state (weekly or monthly)
  const [viewMode, setViewMode] = useState<AttendanceViewMode>('weekly');

  // Reference date for current period
  const [referenceDate, setReferenceDate] = useState(() => new Date());

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Department filter (admin only)
  const [departmentId, setDepartmentId] = useState<string | undefined>();

  // Pagination
  const [page, setPage] = useState(1);

  // Calculate period dates
  const periodDates = useMemo(() => {
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
    } else {
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
      };
    }
  }, [viewMode, referenceDate]);

  // Generate period label
  const periodLabel = useMemo(() => {
    if (viewMode === 'weekly') {
      const startDay = format(periodDates.start, 'd', { locale: fr });
      const endDate = format(periodDates.end, 'd MMMM yyyy', { locale: fr });
      return `Semaine du ${startDay} au ${endDate}`;
    } else {
      return format(periodDates.start, 'MMMM yyyy', { locale: fr });
    }
  }, [viewMode, periodDates]);

  // Fetch attendance report based on scope
  const reportQuery = scope === 'team'
    ? trpc.attendanceReport.getTeamReport.useQuery({
        viewMode,
        referenceDate: periodDates.start,
        departmentId,
        page,
        limit: 50,
      })
    : trpc.attendanceReport.getAllReport.useQuery({
        viewMode,
        referenceDate: periodDates.start,
        departmentId,
        page,
        limit: 50,
      });

  // Fetch departments for filter (admin only)
  const departmentsQuery = trpc.attendanceReport.getDepartments.useQuery(
    undefined,
    { enabled: scope === 'all' }
  );

  // Export mutations
  const exportMutation = trpc.attendanceReport.exportReport.useMutation();

  // Filter employees by search query (client-side)
  const filteredEmployees = useMemo(() => {
    if (!reportQuery.data?.employees) return [];
    if (!searchQuery.trim()) return reportQuery.data.employees;

    const query = searchQuery.toLowerCase();
    return reportQuery.data.employees.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(query) ||
        emp.employeeNumber.toLowerCase().includes(query) ||
        (emp.department?.toLowerCase().includes(query) ?? false)
    );
  }, [reportQuery.data?.employees, searchQuery]);

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === 'weekly') {
      setReferenceDate((prev) => subWeeks(prev, 1));
    } else {
      setReferenceDate((prev) => subMonths(prev, 1));
    }
    setPage(1);
  };

  const goToNext = () => {
    if (viewMode === 'weekly') {
      setReferenceDate((prev) => addWeeks(prev, 1));
    } else {
      setReferenceDate((prev) => addMonths(prev, 1));
    }
    setPage(1);
  };

  const goToCurrent = () => {
    setReferenceDate(new Date());
    setPage(1);
  };

  // Export handlers
  const handleExportPDF = async () => {
    try {
      const result = await exportMutation.mutateAsync({
        viewMode,
        referenceDate: periodDates.start,
        format: 'pdf',
        scope,
        departmentId,
      });

      // Download the file
      const blob = new Blob(
        [Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))],
        { type: result.contentType }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportMutation.mutateAsync({
        viewMode,
        referenceDate: periodDates.start,
        format: 'xlsx',
        scope,
        departmentId,
      });

      // Download the file
      const blob = new Blob(
        [Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))],
        { type: result.contentType }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  // View mode change handler
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode as AttendanceViewMode);
    setPage(1);
  };

  const isLoading = reportQuery.isLoading;
  const summary = reportQuery.data?.summary;
  const dates = reportQuery.data?.period.dates || [];

  return (
    <div className="space-y-6">
      {/* Header with Title */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Rapport de Pointage
        </h1>
        <p className="text-muted-foreground mt-1">
          {scope === 'team'
            ? 'Visualisez la présence de votre équipe'
            : 'Visualisez la présence de tous les employés'}
        </p>
      </div>

      {/* Controls Row */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Left: View Mode Toggle + Period Navigation */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Weekly/Monthly Toggle */}
              <Tabs
                value={viewMode}
                onValueChange={handleViewModeChange}
                className="w-auto"
              >
                <TabsList>
                  <TabsTrigger value="weekly">Semaine</TabsTrigger>
                  <TabsTrigger value="monthly">Mois</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Period Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrevious}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={goToCurrent}
                  className="min-w-[200px] font-medium"
                >
                  {periodLabel}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNext}
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right: Filters + Export */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Department Filter (admin only) */}
              {scope === 'all' && departmentsQuery.data && (
                <Select
                  value={departmentId || 'all'}
                  onValueChange={(v) =>
                    setDepartmentId(v === 'all' ? undefined : v)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Département" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les départements</SelectItem>
                    {departmentsQuery.data.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={exportMutation.isPending || isLoading}
                  className="gap-2"
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={exportMutation.isPending || isLoading}
                  className="gap-2"
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <AttendanceSummaryCards summary={summary} isLoading={isLoading} />
      )}

      {/* Calendar Grid */}
      <AttendanceCalendarGrid
        employees={filteredEmployees}
        dates={dates}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {reportQuery.data?.pagination && reportQuery.data.pagination.total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage de {filteredEmployees.length} sur{' '}
            {reportQuery.data.pagination.total} employés
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!reportQuery.data.pagination.hasMore}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
