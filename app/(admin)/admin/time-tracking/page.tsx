/**
 * Time Tracking Admin Dashboard
 *
 * Comprehensive time entry management:
 * - View all time entries (pending, approved, rejected)
 * - Approve/reject entries individually or in bulk
 * - Filter by date range and status
 * - View overtime summaries
 * - Link to manual entry and overtime reports
 *
 * HCI Principles:
 * - Task-oriented tabs (pending first, then approved, then all)
 * - Smart defaults (show pending by default)
 * - Progressive disclosure (details hidden until needed)
 */

'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  TimeEntryApprovalCard,
  type TimeEntry,
} from '@/components/admin/time-entry-approval-card';
import { CompactTimeEntry } from '@/components/admin/compact-time-entry';
import { DailyWorkersQuickEntry } from '@/components/admin/daily-workers-quick-entry';
import { ComplianceOverview } from '@/components/admin/compliance-overview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  List as ListIcon,
  Calendar,
  FileEdit,
  BarChart3,
  Users,
  TrendingUp,
  AlertCircle,
  LayoutList,
  Shield,
  Upload,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';
type StatusFilter = 'pending' | 'approved' | 'rejected' | 'compliance';

export default function TimeTrackingAdminPage() {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusTab, setStatusTab] = useState<StatusFilter>('pending');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Stable reference to today's date (prevents infinite re-renders)
  const todayRef = useRef(new Date());
  const today = todayRef.current;

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
        };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return {
          startDate: startOfDay(yesterday),
          endDate: endOfDay(yesterday),
        };
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
      default:
        return {};
    }
  };

  // Format date range for display
  const getDateRangeLabel = () => {
    const range = getDateRange();
    if (!range.startDate || !range.endDate) return '';

    const start = range.startDate;
    const end = range.endDate;

    // Same day
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'd MMMM yyyy', { locale: fr });
    }

    // Same month
    if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
      return `Du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
    }

    // Different months
    return `Du ${format(start, 'd MMMM', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
  };

  const dateRange = getDateRange();

  // Fetch entries based on current tab (skip for compliance tab)
  const {
    data: entries,
    isLoading,
    refetch,
  } = api.timeTracking.getAllEntries.useQuery({
    status: statusTab === 'compliance' ? 'pending' : statusTab,
    ...dateRange,
  }, {
    enabled: statusTab !== 'compliance',
  });

  // Fetch summary
  const { data: summary } = api.timeTracking.getPendingSummary.useQuery();

  // Fetch employees needing hours for today
  const { data: employeesNeedingHours } =
    api.timeTracking.getEmployeesNeedingHours.useQuery({
      date: today,
    });

  // Fetch compliance data
  const { data: employeesAtRisk } =
    api.timeTracking.getEmployeesApproachingLimits.useQuery({
      warningThreshold: 0.8,
      countryCode: 'CI',
    });

  const { data: protectedEmployees } =
    api.timeTracking.getProtectedEmployees.useQuery();

  // Mutations
  const approveMutation = api.timeTracking.approveEntry.useMutation({
    onSuccess: () => {
      toast({
        title: 'Approuvé',
        description: "L'entrée a été approuvée avec succès",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = api.timeTracking.rejectEntry.useMutation({
    onSuccess: () => {
      toast({
        title: 'Rejeté',
        description: "L'entrée a été rejetée",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const bulkApproveMutation = api.timeTracking.bulkApprove.useMutation({
    onSuccess: () => {
      toast({
        title: 'Approuvé',
        description: `${entries?.length || 0} entrées approuvées`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApprove = async (entryId: string) => {
    await approveMutation.mutateAsync({ entryId });
  };

  const handleReject = async (entryId: string, rejectionReason: string) => {
    await rejectMutation.mutateAsync({ entryId, rejectionReason });
  };

  const handleBulkApprove = async () => {
    if (!entries || entries.length === 0) return;

    // Only approve pending entries
    const pendingIds = entries.filter((e) => e.status === 'pending').map((e) => e.id);
    if (pendingIds.length === 0) {
      toast({
        title: 'Aucune entrée',
        description: 'Aucune entrée en attente à approuver',
        variant: 'destructive',
      });
      return;
    }

    await bulkApproveMutation.mutateAsync({ entryIds: pendingIds });
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  // Calculate stats for current view
  const stats = useMemo(() => {
    if (!entries) return {
      total: 0,
      totalHours: 0,
      totalOvertime: 0,
      uniqueEmployees: 0,
      pendingOvertimeHours: 0
    };

    const totalHours = entries.reduce((sum, e) => sum + (Number(e.totalHours) || 0), 0);
    const totalOvertime = entries.reduce((sum, e) => {
      const breakdown = e.overtimeBreakdown as any;
      if (!breakdown) return sum;
      return (
        sum +
        (Number(breakdown.hours_41_to_46) || 0) +
        (Number(breakdown.hours_above_46) || 0) +
        (Number(breakdown.saturday) || 0) +
        (Number(breakdown.sunday) || 0) +
        (Number(breakdown.night_work) || 0) +
        (Number(breakdown.public_holiday) || 0)
      );
    }, 0);

    // Count unique employees
    const uniqueEmployeeIds = new Set(entries.map(e => e.employee.id));
    const uniqueEmployees = uniqueEmployeeIds.size;

    // For pending tab: calculate pending overtime hours
    const pendingOvertimeHours = statusTab === 'pending'
      ? entries.reduce((sum, e) => {
          if (e.status !== 'pending') return sum;
          const breakdown = e.overtimeBreakdown as any;
          if (!breakdown) return sum;
          return sum + (
            (Number(breakdown.hours_41_to_46) || 0) +
            (Number(breakdown.hours_above_46) || 0) +
            (Number(breakdown.saturday) || 0) +
            (Number(breakdown.sunday) || 0) +
            (Number(breakdown.night_work) || 0) +
            (Number(breakdown.public_holiday) || 0)
          );
        }, 0)
      : 0;

    return {
      total: entries.length,
      totalHours,
      totalOvertime,
      uniqueEmployees,
      pendingOvertimeHours,
    };
  }, [entries, statusTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Pointages</h1>
          <p className="text-muted-foreground">
            Gérez toutes les entrées de temps de vos employés
          </p>
        </div>

        {/* Date filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Période:</span>
            <Select
              value={dateFilter}
              onValueChange={(value) => setDateFilter(value as DateFilter)}
            >
              <SelectTrigger className="w-[200px] min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="yesterday">Hier</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois-ci</SelectItem>
                <SelectItem value="all">Toutes les périodes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateFilter !== 'all' && (
            <p className="text-xs text-muted-foreground text-right">
              {getDateRangeLabel()}
            </p>
          )}
        </div>
      </div>

      {/* Primary Action: Pending Approvals */}
      {summary && summary.pendingCount > 0 && statusTab === 'pending' && (
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-amber-900">
                  {summary.pendingCount} {summary.pendingCount === 1 ? 'employé attend' : 'employés attendent'} votre approbation
                </CardTitle>
                <CardDescription className="text-amber-700">
                  Les heures doivent être approuvées avant la paie
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.totalOvertimeHours > 0 && (
              <div className="flex items-center gap-2 text-amber-800">
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm">
                  Dont <span className="font-bold">{summary.totalOvertimeHours.toFixed(1)}h</span> d'heures supplémentaires
                </p>
              </div>
            )}
            <Button
              className="w-full min-h-[56px] text-lg"
              variant="default"
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Approbation en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-6 w-6" />
                  Approuver maintenant
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions - show when no pending or when not on pending tab */}
      {(!summary || summary.pendingCount === 0 || statusTab !== 'pending') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Quick Entry for employees needing hours */}
          {employeesNeedingHours && employeesNeedingHours.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Saisie rapide</h3>
                    <p className="text-sm text-muted-foreground">
                      {employeesNeedingHours.length}{' '}
                      {employeesNeedingHours.length > 1 ? 'employés' : 'employé'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setQuickEntryOpen(true)}
                  className="w-full min-h-[44px]"
                >
                  Saisir heures
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Upload className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Importer pointages</h3>
                  <p className="text-sm text-muted-foreground">
                    Depuis appareil biométrique
                  </p>
                </div>
              </div>
              <Link href="/admin/time-tracking/import" className="block">
                <Button className="w-full min-h-[44px]">Importer</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileEdit className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Saisie manuelle</h3>
                  <p className="text-sm text-muted-foreground">
                    Enregistrer manuellement
                  </p>
                </div>
              </div>
              <Link href="/manager/time-tracking/manual-entry" className="block">
                <Button className="w-full min-h-[44px]">Ouvrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Rapport heures sup</h3>
                  <p className="text-sm text-muted-foreground">
                    Voir les heures sup
                  </p>
                </div>
              </div>
              <Link href="/manager/reports/overtime" className="block">
                <Button className="w-full min-h-[44px]">Ouvrir</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Context-aware Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statusTab === 'pending' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  À approuver
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">entrées en attente</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Heures sup à vérifier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : formatDuration(stats.pendingOvertimeHours)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">heures supplémentaires</p>
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
                <div className="text-3xl font-bold text-blue-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stats.uniqueEmployees}
                </div>
                <p className="text-xs text-muted-foreground mt-1">employés uniques</p>
              </CardContent>
            </Card>
          </>
        )}

        {statusTab === 'approved' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Heures validées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : formatDuration(stats.totalHours)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">pour cette période</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Heures sup validées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : formatDuration(stats.totalOvertime)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">heures supplémentaires</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Employés payés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stats.uniqueEmployees}
                </div>
                <p className="text-xs text-muted-foreground mt-1">employés</p>
              </CardContent>
            </Card>
          </>
        )}

        {statusTab === 'rejected' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  À corriger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">entrées rejetées</p>
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
                <div className="text-3xl font-bold text-blue-600">
                  {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stats.uniqueEmployees}
                </div>
                <p className="text-xs text-muted-foreground mt-1">employés</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Action requise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mt-2">
                  Erreurs d'horaire ou localisation
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Compliance Overview */}
      {employeesAtRisk && protectedEmployees && (
        <ComplianceOverview
          employeesAtRisk={employeesAtRisk}
          protectedEmployees={protectedEmployees}
          isLoading={!employeesAtRisk || !protectedEmployees}
        />
      )}

      {/* Tabs for status filtering */}
      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusFilter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            À approuver
            {summary && summary.pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {summary.pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Validées
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            À corriger
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <Shield className="h-4 w-4" />
            Conformité
            {employeesAtRisk && protectedEmployees && (employeesAtRisk.length + protectedEmployees.length) > 0 && (
              <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-900">
                {employeesAtRisk.length + protectedEmployees.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Compliance Tab Content */}
        <TabsContent value="compliance" className="mt-6">
          {employeesAtRisk && protectedEmployees ? (
            <ComplianceOverview
              employeesAtRisk={employeesAtRisk}
              protectedEmployees={protectedEmployees}
              isLoading={!employeesAtRisk || !protectedEmployees}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>

        {/* Status Tabs Content (pending, approved, rejected) */}
        <TabsContent value={statusTab} className="mt-6">
          {/* Loading state */}
          {isLoading && statusTab !== 'compliance' && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && entries && entries.length === 0 && statusTab !== 'compliance' && (
            <div className="text-center py-12 rounded-lg border border-dashed">
              {statusTab === 'pending' && (
                <>
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Aucune entrée en attente
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Toutes les entrées ont été traitées
                  </p>
                </>
              )}
              {statusTab === 'approved' && (
                <>
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Aucune entrée validée
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Pas d'entrées validées pour cette période
                  </p>
                </>
              )}
              {statusTab === 'rejected' && (
                <>
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Aucune entrée rejetée
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Pas d'entrées rejetées pour cette période
                  </p>
                </>
              )}
            </div>
          )}

          {/* Entries list */}
          {!isLoading && entries && entries.length > 0 && statusTab !== 'compliance' && (
            <div className="space-y-4">
              {/* View mode toggle and count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {entries.length} entrée{entries.length > 1 ? 's' : ''}{' '}
                  {statusTab === 'pending' ? 'à approuver' : statusTab === 'approved' ? 'validée(s)' : 'rejetée(s)'}
                </p>

                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as 'detailed' | 'compact')}
                >
                  <ToggleGroupItem value="detailed" aria-label="Vue détaillée" className="min-h-[44px]">
                    <ListIcon className="h-4 w-4 mr-2" />
                    Détaillé
                  </ToggleGroupItem>
                  <ToggleGroupItem value="compact" aria-label="Vue compacte" className="min-h-[44px]">
                    <LayoutList className="h-4 w-4 mr-2" />
                    Compact
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="grid gap-4">
                {entries.map((entry) =>
                  viewMode === 'compact' ? (
                    <CompactTimeEntry
                      key={entry.id}
                      entry={entry as TimeEntry}
                      onApprove={entry.status === 'pending' ? handleApprove : undefined}
                      onReject={entry.status === 'pending' ? handleReject : undefined}
                      isLoading={
                        approveMutation.isPending || rejectMutation.isPending
                      }
                    />
                  ) : (
                    <TimeEntryApprovalCard
                      key={entry.id}
                      entry={entry as TimeEntry}
                      onApprove={entry.status === 'pending' ? handleApprove : undefined}
                      onReject={entry.status === 'pending' ? handleReject : undefined}
                      isLoading={
                        approveMutation.isPending || rejectMutation.isPending
                      }
                    />
                  )
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Entry Modal */}
      <DailyWorkersQuickEntry
        open={quickEntryOpen}
        onOpenChange={setQuickEntryOpen}
        date={today}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
