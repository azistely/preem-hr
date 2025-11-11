/**
 * Time-Off Admin Dashboard (Enhanced)
 *
 * Allows HR managers to:
 * - View time-off requests with advanced filtering
 * - Filter by: status, policy type, date range, employee, department
 * - Multi-select requests for bulk actions
 * - Approve/reject requests individually or in bulk
 * - View conflicts and overlapping leaves
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import {
  LeaveRequestCard,
  type LeaveRequest,
} from '@/components/admin/leave-request-card';
import { PendingSummaryWidget } from '@/components/admin/pending-summary-widget';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Calendar as CalendarIcon,
  Search,
  X,
  CheckSquare,
  Square,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  List,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TimeOffCalendar } from '@/components/admin/time-off-calendar';
import { DayDetailPanel } from '@/components/admin/day-detail-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TimeOffRequestForm } from '@/features/time-off/components/time-off-request-form';
import { UserPlus } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';
type PolicyTypeFilter = 'all' | 'annual_leave' | 'sick_leave' | 'maternity' | 'paternity' | 'unpaid';

const statusLabels: Record<StatusFilter, string> = {
  all: 'Tous les statuts',
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
};

const policyTypeLabels: Record<PolicyTypeFilter, string> = {
  all: 'Tous les types',
  annual_leave: 'Congés annuels',
  sick_leave: 'Congés maladie',
  maternity: 'Congés maternité',
  paternity: 'Congés paternité',
  unpaid: 'Congés sans solde',
};

export default function TimeOffAdminPage() {
  // Tab state
  const [currentTab, setCurrentTab] = useState<'list' | 'calendar'>('list');

  // Filters state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [policyTypeFilter, setPolicyTypeFilter] = useState<PolicyTypeFilter>('all');
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>();
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>();
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Multi-select state
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());

  // Calendar view state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayRequests, setSelectedDayRequests] = useState<any[]>([]);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

  // Handle tab change: adjust status filter based on view
  const handleTabChange = (tab: string) => {
    setCurrentTab(tab as 'list' | 'calendar');

    // Calendar view should show approved leaves (to see who's away)
    // List view should show pending requests (for processing)
    if (tab === 'calendar') {
      setStatusFilter('approved');
    } else if (tab === 'list') {
      setStatusFilter('pending');
    }
  };

  // Create request on behalf state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // Fetch filtered requests
  const {
    data: requests,
    isLoading,
    refetch,
  } = api.timeOff.getFilteredRequests.useQuery({
    status: statusFilter,
    policyType: policyTypeFilter,
    startDate: startDateFilter,
    endDate: endDateFilter,
    employeeSearch: employeeSearch || undefined,
  });

  // Fetch summary (for pending count)
  const { data: summary } = api.timeOff.getPendingSummary.useQuery();

  // Fetch all employees for creating requests on behalf
  const { data: employeesData } = api.employees.list.useQuery({ limit: 100 });
  const allEmployees = employeesData?.employees || [];

  // Fetch conflicts for all pending requests in a single query
  // Only fetch when we have pending requests to avoid unnecessary queries
  const pendingRequests = (requests || []).filter((r) => r.status === 'pending');

  const { data: conflictsData } = api.timeOff.detectConflictsForRequests.useQuery(
    {
      requests: pendingRequests.map((r) => ({
        id: r.id,
        startDate: r.startDate,
        endDate: r.endDate,
      })),
    },
    {
      // Only fetch when there are pending requests
      enabled: pendingRequests.length > 0,
    }
  );

  const conflictsByRequestId = conflictsData || {};

  // Mutations
  const approveMutation = api.timeOff.approve.useMutation({
    onSuccess: () => {
      toast.success('Demande approuvée');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = api.timeOff.reject.useMutation({
    onSuccess: () => {
      toast.success('Demande rejetée');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const bulkApproveMutation = api.timeOff.bulkApprove.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`${variables.requestIds.length} demandes approuvées`);
      setSelectedRequestIds(new Set());
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = async (requestId: string) => {
    await approveMutation.mutateAsync({ requestId });
  };

  const handleReject = async (requestId: string, reviewNotes: string) => {
    await rejectMutation.mutateAsync({ requestId, reviewNotes });
  };

  const handleBulkApprove = async () => {
    if (selectedRequestIds.size === 0) {
      toast.error('Aucune demande sélectionnée');
      return;
    }

    await bulkApproveMutation.mutateAsync({
      requestIds: Array.from(selectedRequestIds),
    });
  };

  const handleSelectAll = () => {
    if (!requests) return;

    if (selectedRequestIds.size === requests.length) {
      // Deselect all
      setSelectedRequestIds(new Set());
    } else {
      // Select all
      setSelectedRequestIds(new Set(requests.map((r) => r.id)));
    }
  };

  const handleToggleSelect = (requestId: string) => {
    const newSelected = new Set(selectedRequestIds);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequestIds(newSelected);
  };

  const handleDayClick = (date: Date, dayRequests: any[]) => {
    setSelectedDate(date);
    setSelectedDayRequests(dayRequests);
    setDayPanelOpen(true);
  };

  const clearFilters = () => {
    setStatusFilter('pending');
    setPolicyTypeFilter('all');
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
    setEmployeeSearch('');
  };

  const activeFilterCount = [
    statusFilter !== 'pending' ? 1 : 0,
    policyTypeFilter !== 'all' ? 1 : 0,
    startDateFilter ? 1 : 0,
    endDateFilter ? 1 : 0,
    employeeSearch ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const allSelected = requests && requests.length > 0 && selectedRequestIds.size === requests.length;
  const someSelected = selectedRequestIds.size > 0 && !allSelected;

  // Calculate total conflicts across all requests
  const totalConflicts = Object.values(conflictsByRequestId).reduce(
    (sum, conflicts) => sum + conflicts.length,
    0
  );

  // Count how many requests have at least one conflict
  const requestsWithConflicts = Object.values(conflictsByRequestId).filter(
    (conflicts) => conflicts.length > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Demandes de congé</h1>
          <p className="text-muted-foreground">
            Gérez les demandes de congé de vos employés
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create request on behalf button */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px]">
                <UserPlus className="mr-2 h-4 w-4" />
                Créer une demande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une demande de congé</DialogTitle>
                <DialogDescription>
                  Sélectionnez un employé puis remplissez le formulaire
                </DialogDescription>
              </DialogHeader>

              {!selectedEmployeeId ? (
                <div className="space-y-4">
                  {/* Employee search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un employé..."
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      className="pl-9 min-h-[44px]"
                    />
                  </div>

                  {/* Employee list */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {allEmployees
                      ?.filter((emp) =>
                        employeeSearchQuery
                          ? `${emp.firstName} ${emp.lastName}`
                              .toLowerCase()
                              .includes(employeeSearchQuery.toLowerCase())
                          : true
                      )
                      .map((emp) => (
                        <Button
                          key={emp.id}
                          variant="outline"
                          className="w-full justify-start min-h-[44px]"
                          onClick={() => setSelectedEmployeeId(emp.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">
                                {emp.firstName} {emp.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </Button>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected employee */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">
                        {allEmployees?.find((e) => e.id === selectedEmployeeId)?.firstName}{' '}
                        {allEmployees?.find((e) => e.id === selectedEmployeeId)?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {allEmployees?.find((e) => e.id === selectedEmployeeId)?.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployeeId('')}
                    >
                      Changer
                    </Button>
                  </div>

                  {/* Request form */}
                  <TimeOffRequestForm
                    employeeId={selectedEmployeeId}
                    onSuccess={() => {
                      setShowCreateDialog(false);
                      setSelectedEmployeeId('');
                      setEmployeeSearchQuery('');
                      refetch();
                    }}
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Filter toggle button */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="min-h-[44px]"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtres
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs: List View vs Calendar View */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Liste
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendrier
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-6 mt-6">

      {/* Filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filtres</h3>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8"
                >
                  <X className="mr-2 h-4 w-4" />
                  Réinitialiser
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Status filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Policy type filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Type de congé</label>
                <Select
                  value={policyTypeFilter}
                  onValueChange={(value) => setPolicyTypeFilter(value as PolicyTypeFilter)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(policyTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Employé</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom ou prénom..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-9 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Start date filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de début (après)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal min-h-[44px]"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDateFilter ? format(startDateFilter, 'PPP', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDateFilter}
                      onSelect={setStartDateFilter}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End date filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de fin (avant)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal min-h-[44px]"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDateFilter ? format(endDateFilter, 'PPP', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDateFilter}
                      onSelect={setEndDateFilter}
                      locale={fr}
                      disabled={(date) => startDateFilter ? date < startDateFilter : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conflict alert */}
      {requestsWithConflicts > 0 && statusFilter === 'pending' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {requestsWithConflicts} demande{requestsWithConflicts > 1 ? 's' : ''} avec des conflits détectés
                </p>
                <p className="text-sm text-amber-700">
                  {totalConflicts} employé{totalConflicts > 1 ? 's' : ''} déjà en congé sur les mêmes périodes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary widget */}
      {summary && statusFilter === 'pending' && (
        <PendingSummaryWidget
          pendingCount={summary.pendingCount}
          type="time-off"
        />
      )}

      {/* Multi-select actions bar */}
      {selectedRequestIds.size > 0 && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="text-base px-3 py-1">
                  {selectedRequestIds.size} sélectionné{selectedRequestIds.size > 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRequestIds(new Set())}
                >
                  Désélectionner tout
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={handleBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                  className="min-h-[44px]"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approuver ({selectedRequestIds.size})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && requests && requests.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-lg font-medium text-muted-foreground">
            Aucune demande trouvée
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {activeFilterCount > 0
              ? 'Essayez de modifier les filtres'
              : 'Aucune demande correspondant aux critères'}
          </p>
        </div>
      )}

      {/* Requests list with multi-select */}
      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-4">
          {/* Select all header */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 hover:opacity-80 min-h-[44px] min-w-[44px] justify-center"
              >
                {allSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : someSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary opacity-50" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <span className="text-sm font-medium">
                {requests.length} demande{requests.length > 1 ? 's' : ''}
              </span>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Request cards */}
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="flex items-start gap-3">
                {/* Checkbox */}
                <div className="pt-6">
                  <button
                    onClick={() => handleToggleSelect(request.id)}
                    className="flex items-center justify-center min-h-[44px] min-w-[44px] hover:opacity-80"
                  >
                    {selectedRequestIds.has(request.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Request card */}
                <div className="flex-1">
                  <LeaveRequestCard
                    request={request as unknown as LeaveRequest}
                    conflicts={conflictsByRequestId[request.id] || []}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isLoading={approveMutation.isPending || rejectMutation.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-6 mt-6">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Calendar */}
          {!isLoading && requests && (
            <TimeOffCalendar
              requests={requests as any[]}
              onDayClick={handleDayClick}
            />
          )}

          {/* Day Detail Panel */}
          <DayDetailPanel
            date={selectedDate}
            requests={selectedDayRequests}
            open={dayPanelOpen}
            onOpenChange={setDayPanelOpen}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
