'use client';

/**
 * Employee Detail Content - Draft Mode
 *
 * Main content for employee detail sheet in draft review mode
 * - Quick stats summary
 * - Time entries list (for non-monthly workers)
 * - Overtime breakdown
 * - Pay variables management
 * - Quick actions
 *
 * Design: Mobile-first, progressive disclosure, touch-friendly
 */

import { useState } from 'react';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Clock,
  DollarSign,
  Plus,
  TrendingUp,
  Briefcase,
  Loader2,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/trpc/react';
import { TimeEntryRow } from './time-entry-row';
import { TimeEntryDetailModal } from './time-entry-detail-modal';
import { OvertimeBreakdownCard } from '../overtime-breakdown-card';
import { PayrollRunVariablesList } from '../../payroll-run-variables-list';

interface EmployeeDetailContentProps {
  employeeId: string;
  employeeName: string;
  runId: string;
  periodStart: Date;
  periodEnd: Date;
}

export function EmployeeDetailContent({
  employeeId,
  employeeName,
  runId,
  periodStart,
  periodEnd,
}: EmployeeDetailContentProps) {
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<any | null>(null);
  const { toast } = useToast();

  // Get employee details
  const { data: employee } = api.employees.getById.useQuery({ id: employeeId });

  // Get time entries for the period (for non-monthly workers)
  const { data: timeEntries = [], refetch: refetchTimeEntries } = api.timeTracking.getEmployeeEntries.useQuery(
    {
      employeeId,
      startDate: periodStart,
      endDate: periodEnd,
    },
    {
      enabled: employee?.paymentFrequency !== 'MONTHLY',
    }
  );

  const paymentFrequency = employee?.paymentFrequency || 'MONTHLY';
  const isMonthlyWorker = paymentFrequency === 'MONTHLY';

  // Calculate totals from time entries
  const approvedHours = timeEntries
    .filter((e: any) => e.status === 'approved')
    .reduce((sum: number, e: any) => sum + (parseFloat(e.totalHours?.toString() || '0')), 0);

  const pendingHours = timeEntries
    .filter((e: any) => e.status === 'pending')
    .reduce((sum: number, e: any) => sum + (parseFloat(e.totalHours?.toString() || '0')), 0);

  const totalHours = approvedHours + pendingHours;

  // Calculate overtime (simple example - hours > 40 per week)
  const overtimeHours = Math.max(0, totalHours - 40);

  // Generate daily breakdown for time entries
  const dailyEntries = eachDayOfInterval({ start: periodStart, end: periodEnd }).map((date) => {
    const dateStr = startOfDay(date).toISOString();
    const rawEntry = timeEntries.find((e: any) =>
      startOfDay(parseISO(e.clockIn)).getTime() === startOfDay(date).getTime()
    );

    // Convert totalHours from string to number and cast status type for TimeEntryRow component
    const entry = rawEntry ? {
      ...rawEntry,
      totalHours: rawEntry.totalHours ? parseFloat(rawEntry.totalHours.toString()) : null,
      status: rawEntry.status as 'approved' | 'pending' | 'rejected' | 'missing',
    } : null;

    return {
      date: dateStr,
      entry,
    };
  });

  const handleTimeEntryClick = (entry: any) => {
    if (entry) {
      setSelectedTimeEntry({
        id: entry.id,
        employeeName,
        employeeNumber: employee?.employeeNumber || '',
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        totalHours: parseFloat(entry.totalHours?.toString() || '0'),
        breakMinutes: entry.breakMinutes,
        status: entry.status,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
        rejectionReason: entry.rejectionReason,
        clockInLocation: entry.clockInLocation,
        clockOutLocation: entry.clockOutLocation,
        geofenceVerified: entry.geofenceVerified,
        clockInPhotoUrl: entry.clockInPhotoUrl,
        clockOutPhotoUrl: entry.clockOutPhotoUrl,
        notes: entry.notes,
      });
    }
  };

  // Mutations
  const approveEntry = api.timeTracking.approveEntry.useMutation({
    onSuccess: async () => {
      await refetchTimeEntries();
      toast({
        title: 'Heures approuvées',
        description: 'La saisie d\'heures a été approuvée avec succès.',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'approuver les heures.',
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  const rejectEntry = api.timeTracking.rejectEntry.useMutation({
    onSuccess: async () => {
      await refetchTimeEntries();
      toast({
        title: 'Heures rejetées',
        description: 'La saisie d\'heures a été rejetée.',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de rejeter les heures.',
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  const bulkApprove = api.timeTracking.bulkApprove.useMutation({
    onSuccess: async (_, variables) => {
      await refetchTimeEntries();
      toast({
        title: 'Heures approuvées en masse',
        description: `${variables.entryIds.length} saisie(s) d'heures approuvée(s) avec succès.`,
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'approuver les heures en masse.',
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  const handleQuickApprove = async (entryId: string) => {
    await approveEntry.mutateAsync({ entryId });
  };

  const handleQuickReject = async (entryId: string) => {
    await rejectEntry.mutateAsync({
      entryId,
      rejectionReason: 'Rejeté depuis la révision de paie',
    });
  };

  const handleBulkApprove = async () => {
    const pendingEntryIds = timeEntries
      .filter((e: any) => e.status === 'pending')
      .map((e: any) => e.id);

    if (pendingEntryIds.length > 0) {
      await bulkApprove.mutateAsync({ entryIds: pendingEntryIds });
    }
  };

  // Get pending entries count for bulk approve button
  const pendingEntriesCount = timeEntries.filter((e: any) => e.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Résumé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Période</div>
              <div className="font-medium">
                {format(periodStart, 'dd MMM', { locale: fr })} -{' '}
                {format(periodEnd, 'dd MMM yyyy', { locale: fr })}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Type</div>
              <Badge variant="outline">
                {paymentFrequency === 'MONTHLY' && 'Mensuel'}
                {paymentFrequency === 'WEEKLY' && 'Hebdomadaire'}
                {paymentFrequency === 'BIWEEKLY' && 'Quinzaine'}
                {paymentFrequency === 'DAILY' && 'Journalier'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries (Non-Monthly Workers Only) */}
      {!isMonthlyWorker && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Heures Travaillées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{Math.round(totalHours)}h</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{Math.round(approvedHours)}h</div>
                <div className="text-xs text-muted-foreground">Approuvées</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{Math.round(pendingHours)}h</div>
                <div className="text-xs text-muted-foreground">En attente</div>
              </div>
            </div>

            {/* Bulk Approve Button */}
            {pendingEntriesCount > 0 && (
              <Button
                onClick={handleBulkApprove}
                disabled={bulkApprove.isPending}
                className="w-full min-h-[48px] bg-green-600 hover:bg-green-700"
              >
                {bulkApprove.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approbation en cours...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Approuver tout ({pendingEntriesCount})
                  </>
                )}
              </Button>
            )}

            <Separator />

            {/* Daily Breakdown */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {dailyEntries.map(({ date, entry }) => (
                <TimeEntryRow
                  key={date}
                  date={date}
                  entry={entry}
                  onEntryClick={() => handleTimeEntryClick(entry)}
                  onQuickApprove={() => entry && handleQuickApprove(entry.id)}
                  onQuickReject={() => entry && handleQuickReject(entry.id)}
                  showActions={entry?.status === 'pending'}
                />
              ))}
            </div>

            {dailyEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucune saisie d'heures pour cette période</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overtime Breakdown */}
      {overtimeHours > 0 && (
        <OvertimeBreakdownCard
          employeeId={employeeId}
          totalHours={totalHours}
          normalHours={Math.min(totalHours, 40)}
          overtimeHours={{
            rate15: Math.min(overtimeHours, 6),
            rate50: Math.max(0, overtimeHours - 6),
          }}
          overtimePay={{
            rate15Amount: Math.min(overtimeHours, 6) * 480 * 1.15, // Example calculation
            rate50Amount: Math.max(0, overtimeHours - 6) * 480 * 1.50,
          }}
          hourlyRate={480} // TODO: Get from employee salary
        />
      )}

      {/* Pay Variables - Date Range Filtered */}
      <PayrollRunVariablesList
        employeeId={employeeId}
        employeeName={employeeName}
        employeeNumber={employee?.employeeNumber || ''}
        runPeriodStart={format(periodStart, 'yyyy-MM-dd')}
        runPeriodEnd={format(periodEnd, 'yyyy-MM-dd')}
      />

      {/* Monthly Worker Info */}
      {isMonthlyWorker && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="font-medium text-blue-900">Employé Mensuel</p>
              <p className="mt-1">
                Le salaire sera calculé sur la base du salaire mensuel configuré.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entry Detail Modal */}
      {selectedTimeEntry && (
        <TimeEntryDetailModal
          open={!!selectedTimeEntry}
          onClose={() => setSelectedTimeEntry(null)}
          entry={selectedTimeEntry}
          onApprove={async () => {
            await handleQuickApprove(selectedTimeEntry.id);
            setSelectedTimeEntry(null);
          }}
          onReject={async () => {
            await handleQuickReject(selectedTimeEntry.id);
            setSelectedTimeEntry(null);
          }}
        />
      )}
    </div>
  );
}
