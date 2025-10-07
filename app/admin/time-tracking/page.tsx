/**
 * Time Tracking Admin Dashboard
 *
 * Allows HR managers to:
 * - View pending time entries
 * - Approve/reject entries individually or in bulk
 * - Filter by date range
 * - View overtime summaries
 */

'use client';

import { useState } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  TimeEntryApprovalCard,
  type TimeEntry,
} from '@/components/admin/time-entry-approval-card';
import { PendingSummaryWidget } from '@/components/admin/pending-summary-widget';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

type DateFilter = 'all' | 'today' | 'week' | 'month';

export default function TimeTrackingAdminPage() {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return {
          startDate: new Date(now.setHours(0, 0, 0, 0)),
          endDate: new Date(now.setHours(23, 59, 59, 999)),
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

  const dateRange = getDateRange();

  // Fetch pending entries
  const {
    data: entries,
    isLoading,
    refetch,
  } = api.timeTracking.getPendingEntries.useQuery(dateRange);

  // Fetch summary
  const { data: summary } = api.timeTracking.getPendingSummary.useQuery();

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

    const entryIds = entries.map((e) => e.id);
    await bulkApproveMutation.mutateAsync({ entryIds });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Approbation des heures</h1>
          <p className="text-muted-foreground">
            Gérez les entrées de temps de vos employés
          </p>
        </div>

        {/* Date filter */}
        <Select
          value={dateFilter}
          onValueChange={(value) => setDateFilter(value as DateFilter)}
        >
          <SelectTrigger className="w-[180px] min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary widget */}
      {summary && (
        <PendingSummaryWidget
          pendingCount={summary.pendingCount}
          totalOvertimeHours={summary.totalOvertimeHours}
          onBulkApprove={
            entries && entries.length > 0 ? handleBulkApprove : undefined
          }
          isLoading={bulkApproveMutation.isPending}
          type="time-tracking"
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries && entries.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-lg font-medium text-muted-foreground">
            Aucune entrée en attente
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Toutes les entrées ont été traitées
          </p>
        </div>
      )}

      {/* Entries list */}
      {!isLoading && entries && entries.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {entries.length} entrée{entries.length > 1 ? 's' : ''} en attente
          </p>

          <div className="grid gap-4">
            {entries.map((entry) => (
              <TimeEntryApprovalCard
                key={entry.id}
                entry={entry as TimeEntry}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={
                  approveMutation.isPending || rejectMutation.isPending
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
