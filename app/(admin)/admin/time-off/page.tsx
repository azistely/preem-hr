/**
 * Time-Off Admin Dashboard
 *
 * Allows HR managers to:
 * - View pending time-off requests
 * - Approve/reject requests individually or in bulk
 * - Filter by leave type
 * - View balance impacts and conflicts
 */

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2 } from 'lucide-react';

type PolicyTypeFilter = 'all' | 'annual_leave' | 'sick_leave' | 'maternity' | 'paternity' | 'unpaid';

const policyTypeLabels: Record<string, string> = {
  all: 'Tous les types',
  annual_leave: 'Congés annuels',
  sick_leave: 'Congés maladie',
  maternity: 'Congés maternité',
  paternity: 'Congés paternité',
  unpaid: 'Congés sans solde',
};

export default function TimeOffAdminPage() {
  const { toast } = useToast();
  const [policyTypeFilter, setPolicyTypeFilter] = useState<PolicyTypeFilter>('all');
  const [requestConflicts, setRequestConflicts] = useState<Record<string, any[]>>({});

  // Fetch pending requests
  const {
    data: requests,
    isLoading,
    refetch,
  } = api.timeOff.getPendingRequestsWithBalances.useQuery();

  // Fetch summary
  const { data: summary } = api.timeOff.getPendingSummary.useQuery();

  // Note: Conflict detection disabled for now
  // TODO: Implement proper conflict detection with useQuery or server-side batching
  useEffect(() => {
    if (!requests) return;
    // Initialize empty conflicts for all requests
    const conflictsMap: Record<string, any[]> = {};
    for (const request of requests) {
      conflictsMap[request.id] = [];
    }
    setRequestConflicts(conflictsMap);
  }, [requests]);

  // Mutations
  const approveMutation = api.timeOff.approve.useMutation({
    onSuccess: () => {
      toast({
        title: 'Approuvé',
        description: 'La demande a été approuvée avec succès',
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

  const rejectMutation = api.timeOff.reject.useMutation({
    onSuccess: () => {
      toast({
        title: 'Rejeté',
        description: 'La demande a été rejetée',
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

  const bulkApproveMutation = api.timeOff.bulkApprove.useMutation({
    onSuccess: () => {
      toast({
        title: 'Approuvé',
        description: `${filteredRequests?.length || 0} demandes approuvées`,
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

  const handleApprove = async (requestId: string) => {
    await approveMutation.mutateAsync({ requestId });
  };

  const handleReject = async (requestId: string, reviewNotes: string) => {
    await rejectMutation.mutateAsync({ requestId, reviewNotes });
  };

  const handleBulkApprove = async () => {
    if (!filteredRequests || filteredRequests.length === 0) return;

    const requestIds = filteredRequests.map((r) => r.id);
    await bulkApproveMutation.mutateAsync({ requestIds });
  };

  // Filter requests by policy type
  const filteredRequests = requests?.filter((request) => {
    if (policyTypeFilter === 'all') return true;
    return (request.policy as any).policyType === policyTypeFilter;
  });

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

        {/* Policy type filter */}
        <Select
          value={policyTypeFilter}
          onValueChange={(value) => setPolicyTypeFilter(value as PolicyTypeFilter)}
        >
          <SelectTrigger className="w-[200px] min-h-[44px]">
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

      {/* Summary widget */}
      {summary && (
        <PendingSummaryWidget
          pendingCount={summary.pendingCount}
          onBulkApprove={
            filteredRequests && filteredRequests.length > 0 ? handleBulkApprove : undefined
          }
          isLoading={bulkApproveMutation.isPending}
          type="time-off"
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredRequests && filteredRequests.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-lg font-medium text-muted-foreground">
            Aucune demande en attente
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {policyTypeFilter === 'all'
              ? 'Toutes les demandes ont été traitées'
              : `Aucune demande de type "${policyTypeLabels[policyTypeFilter]}"`}
          </p>
        </div>
      )}

      {/* Requests list */}
      {!isLoading && filteredRequests && filteredRequests.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {filteredRequests.length} demande{filteredRequests.length > 1 ? 's' : ''} en attente
            {policyTypeFilter !== 'all' && ` (${policyTypeLabels[policyTypeFilter]})`}
          </p>

          <div className="grid gap-4">
            {filteredRequests.map((request) => (
              <LeaveRequestCard
                key={request.id}
                request={request as unknown as LeaveRequest}
                conflicts={requestConflicts[request.id] || []}
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
