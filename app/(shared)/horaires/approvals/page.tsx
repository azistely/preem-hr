/**
 * Schedule Approvals Page - Manager approval dashboard
 *
 * Features:
 * - List pending weekly schedules
 * - Bulk approve/reject
 * - Filter by employee/date
 * - Summary statistics
 *
 * UX: Decision-making oriented, batch operations, clear feedback
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScheduleApprovalCard } from '@/components/work-schedules/schedule-approval-card';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Check, X, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ScheduleApprovalsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedules, setSelectedSchedules] = useState<Set<string>>(new Set());

  // Fetch pending schedules
  const { data: pendingSchedules, isLoading, refetch } = trpc.workSchedules.getPending.useQuery({});

  // Fetch summary stats
  const { data: summary } = trpc.workSchedules.getSummary.useQuery({});

  // Fetch employees (for name lookup)
  // TODO: Optimize with a single query that includes employee data
  const { data: employees } = trpc.employees.list.useQuery({ limit: 100 }); // Max allowed by tRPC

  // Mutations
  const approveMutation = trpc.workSchedules.approve.useMutation({
    onSuccess: (_, variables) => {
      toast({
        title: 'Horaires approuvés',
        description: `${variables.scheduleIds.length} horaire(s) approuvé(s) avec succès`,
      });
      refetch();
      setSelectedSchedules(new Set());
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = trpc.workSchedules.reject.useMutation({
    onSuccess: (_, variables) => {
      toast({
        title: 'Horaires rejetés',
        description: `${variables.scheduleIds.length} horaire(s) rejeté(s)`,
      });
      refetch();
      setSelectedSchedules(new Set());
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get employee name
  const getEmployeeName = (employeeId: string): string => {
    const employee = employees?.employees.find((e: any) => e.id === employeeId);
    if (!employee) return 'Employé inconnu';
    return `${(employee as any).firstName} ${(employee as any).lastName}`;
  };

  const getEmployeeNumber = (employeeId: string): string | undefined => {
    const employee = employees?.employees.find((e: any) => e.id === employeeId);
    return (employee as any)?.employeeNumber;
  };

  // Filter schedules
  const filteredSchedules = pendingSchedules?.filter((schedule) => {
    if (!searchTerm) return true;
    const employeeName = getEmployeeName(schedule.employeeId).toLowerCase();
    const employeeNumber = getEmployeeNumber(schedule.employeeId)?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return employeeName.includes(search) || employeeNumber.includes(search);
  }) || [];

  // Selection handlers
  const toggleScheduleSelection = (weekKey: string) => {
    const newSelected = new Set(selectedSchedules);
    if (newSelected.has(weekKey)) {
      newSelected.delete(weekKey);
    } else {
      newSelected.add(weekKey);
    }
    setSelectedSchedules(newSelected);
  };

  const selectAll = () => {
    const allKeys = filteredSchedules.map((s) => `${s.employeeId}-${s.weekStartDate}`);
    setSelectedSchedules(new Set(allKeys));
  };

  const deselectAll = () => {
    setSelectedSchedules(new Set());
  };

  // Bulk approve
  const bulkApprove = async () => {
    const scheduleIds: string[] = [];

    filteredSchedules.forEach((schedule) => {
      const key = `${schedule.employeeId}-${schedule.weekStartDate}`;
      if (selectedSchedules.has(key)) {
        scheduleIds.push(...schedule.schedules.map((s) => s.id));
      }
    });

    if (scheduleIds.length === 0) return;

    await approveMutation.mutateAsync({ scheduleIds });
  };

  // Handlers for individual cards
  const handleApprove = async (scheduleIds: string[]) => {
    await approveMutation.mutateAsync({ scheduleIds });
  };

  const handleReject = async (scheduleIds: string[], reason: string) => {
    await rejectMutation.mutateAsync({ scheduleIds, rejectedReason: reason });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Approbation des Horaires</h1>
        <p className="text-muted-foreground mt-2">
          Approuvez ou rejetez les horaires soumis par votre équipe
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">
              {summary?.pendingDays || 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              jours en attente
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Approuvés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {summary?.approvedDays || 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              jours approuvés ce mois
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Employés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {filteredSchedules.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              soumissions en attente
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Bulk Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou matricule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={filteredSchedules.length === 0}
              >
                Tout sélectionner
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedSchedules.size === 0}
              >
                Tout désélectionner
              </Button>
              {selectedSchedules.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={bulkApprove}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approuver ({selectedSchedules.size})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Schedules List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground">Chargement des horaires en attente...</div>
          </CardContent>
        </Card>
      ) : filteredSchedules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="text-xl font-semibold mb-2">
              {searchTerm ? 'Aucun résultat' : 'Aucun horaire en attente'}
            </div>
            <div className="text-muted-foreground">
              {searchTerm
                ? 'Essayez une autre recherche'
                : 'Tous les horaires sont approuvés ou aucun horaire n\'a été soumis'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSchedules.map((schedule) => {
            const weekKey = `${schedule.employeeId}-${schedule.weekStartDate}`;
            return (
              <ScheduleApprovalCard
                key={weekKey}
                weeklySchedule={schedule}
                employeeName={getEmployeeName(schedule.employeeId)}
                employeeNumber={getEmployeeNumber(schedule.employeeId)}
                onApprove={handleApprove}
                onReject={handleReject}
                selected={selectedSchedules.has(weekKey)}
                onSelectionChange={(selected) => toggleScheduleSelection(weekKey)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
