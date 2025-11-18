'use client';

/**
 * HR Pending Approvals Dashboard
 *
 * Shows all pending salary advance requests for HR approval
 * HCI Principles: Clear overview, quick actions, status filtering
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Clock,
  User,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Info,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';
import { ApprovalModal } from './approval-modal';

export function PendingApprovalsDashboard() {
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);

  // Get pending approvals
  const { data: pendingAdvances, isLoading, refetch } =
    api.salaryAdvances.getPendingApprovals.useQuery();

  // Get statistics
  const { data: stats } = api.salaryAdvances.getStatistics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const pending = pendingAdvances ?? [];
  const totalPendingAmount = pending.reduce(
    (sum, adv) => sum + Number(adv.requestedAmount),
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>En attente d'approbation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{pending.length}</span>
              <span className="text-muted-foreground">demande(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Montant total demandé</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(totalPendingAmount, 'FCFA')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avances actives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{stats?.activeCount ?? 0}</span>
              <span className="text-muted-foreground">en cours</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes en attente</CardTitle>
          <CardDescription>
            {pending.length === 0
              ? 'Aucune demande en attente'
              : `${pending.length} demande(s) à traiter`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Toutes les demandes sont traitées</h3>
              <p className="text-muted-foreground">
                Aucune demande d'avance en attente d'approbation
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((advance) => {
                const requestedAmount = Number(advance.requestedAmount);
                const netSalary = advance.employeeNetSalaryAtRequest
                  ? Number(advance.employeeNetSalaryAtRequest)
                  : 0;
                const monthlyDeduction = Math.ceil(requestedAmount / advance.repaymentMonths);
                const deductionPercentage = netSalary > 0
                  ? ((monthlyDeduction / netSalary) * 100).toFixed(1)
                  : '0';

                // Calculate days waiting
                const requestDate = new Date(advance.requestDate);
                const daysWaiting = Math.floor(
                  (Date.now() - requestDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                const isUrgent = daysWaiting > 3;

                return (
                  <div
                    key={advance.id}
                    className={`p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors ${
                      isUrgent ? 'border-orange-300 bg-orange-50' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-lg">{advance.employeeName}</span>
                            <Badge variant="outline">{advance.employeeNumber}</Badge>
                          </div>
                          {isUrgent && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Urgent ({daysWaiting}j)
                            </Badge>
                          )}
                        </div>

                        {/* Request Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Montant demandé</p>
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(requestedAmount, 'FCFA')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Période</p>
                            <p className="text-lg font-semibold">{advance.repaymentMonths} mois</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Déduction/mois</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(monthlyDeduction, 'FCFA')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ({deductionPercentage}% du salaire)
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Demandée le</p>
                            <p className="text-sm font-medium">
                              {formatDate(requestDate, 'dd MMM yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              il y a {daysWaiting}j
                            </p>
                          </div>
                        </div>

                        {/* Reason Preview */}
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Raison:
                          </p>
                          <p className="text-sm line-clamp-2">{advance.requestReason}</p>
                        </div>

                        {/* Salary Info */}
                        {netSalary > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Info className="h-4 w-4 text-blue-500" />
                            <span className="text-muted-foreground">
                              Salaire net:{' '}
                              <span className="font-semibold">{formatCurrency(netSalary, 'FCFA')}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => setSelectedAdvanceId(advance.id)}
                          size="lg"
                          className="min-h-[56px]"
                        >
                          Traiter
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {selectedAdvanceId && (
        <ApprovalModal
          advanceId={selectedAdvanceId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedAdvanceId(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
