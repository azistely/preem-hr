'use client';

/**
 * Salary Advances History
 *
 * Shows completed, rejected, and cancelled advances
 * HCI Principles: Filterable history, clear status indicators, search
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  Ban,
  Search,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

const statusConfig = {
  completed: {
    label: 'Terminée',
    icon: CheckCircle2,
    variant: 'outline' as const,
    description: 'Remboursement terminé',
  },
  rejected: {
    label: 'Refusée',
    icon: XCircle,
    variant: 'destructive' as const,
    description: 'Demande refusée',
  },
  cancelled: {
    label: 'Annulée',
    icon: Ban,
    variant: 'outline' as const,
    description: 'Demande annulée',
  },
};

type HistoryStatus = 'all' | 'completed' | 'rejected' | 'cancelled';

export function AdvancesHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatus>('all');

  // Get all advances (limited to 100 by backend, we'll filter client-side)
  const { data: allAdvances, isLoading } = api.salaryAdvances.list.useQuery({
    limit: 100,
  });

  const historyAdvances = allAdvances?.advances.filter(advance => {
    // Filter by status
    const isHistoryStatus = ['completed', 'rejected', 'cancelled'].includes(advance.status);
    if (!isHistoryStatus) return false;

    // Apply status filter
    if (statusFilter !== 'all' && advance.status !== statusFilter) return false;

    // Apply search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        advance.employeeName?.toLowerCase().includes(search) ||
        advance.employeeNumber?.toLowerCase().includes(search)
      );
    }

    return true;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as HistoryStatus)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="completed">Terminées</SelectItem>
            <SelectItem value="rejected">Refusées</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>
            {historyAdvances.length === 0
              ? 'Aucun historique'
              : `${historyAdvances.length} avance(s)`}
            {historyAdvances.length >= 100 && (
              <span className="text-orange-600 block mt-1">
                (Affichage limité aux 100 premières - utilisez les filtres)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyAdvances.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Aucune avance trouvée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyAdvances.map((advance) => {
                const status = statusConfig[advance.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;
                const amount = Number(advance.approvedAmount || advance.requestedAmount);

                return (
                  <div
                    key={advance.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{advance.employeeName}</span>
                          <Badge variant="outline">{advance.employeeNumber}</Badge>
                        </div>
                        <Badge variant={status.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>

                      {/* Financial Info */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Montant</p>
                          <p className="text-lg font-bold">
                            {formatCurrency(amount, 'FCFA')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Période</p>
                          <p className="text-lg font-semibold">{advance.repaymentMonths} mois</p>
                        </div>
                        {advance.status === 'completed' && advance.totalRepaid && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Remboursé</p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatCurrency(Number(advance.totalRepaid), 'FCFA')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Demandée le {formatDate(new Date(advance.requestDate), 'dd MMM yyyy')}</span>
                        </div>
                        {advance.status === 'rejected' && advance.rejectedAt && (
                          <div>
                            Refusée le {formatDate(new Date(advance.rejectedAt), 'dd MMM yyyy')}
                          </div>
                        )}
                      </div>

                      {/* Rejection Reason */}
                      {advance.status === 'rejected' && advance.rejectedReason && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            <strong>Raison du refus:</strong> {advance.rejectedReason}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Request Reason */}
                      {advance.requestReason && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Raison:</p>
                          <p className="text-sm">{advance.requestReason}</p>
                        </div>
                      )}
                    </div>
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
