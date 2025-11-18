'use client';

/**
 * Employee Salary Advances List
 *
 * Shows employee's salary advances with statuses and details
 * HCI Principles: Task-oriented, clear status indicators, touch-friendly
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  TrendingUp,
  Calendar,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

interface AdvancesListProps {
  employeeId: string;
  onRequestNew?: () => void;
}

// Status badge configuration
const statusConfig = {
  pending: {
    label: 'En attente',
    icon: Clock,
    variant: 'secondary' as const,
    description: 'Demande en cours de traitement',
  },
  approved: {
    label: 'Approuvée',
    icon: CheckCircle2,
    variant: 'default' as const,
    description: 'Approuvée, en attente de versement',
  },
  disbursed: {
    label: 'Versée',
    icon: TrendingUp,
    variant: 'default' as const,
    description: 'Montant versé',
  },
  active: {
    label: 'En cours',
    icon: TrendingUp,
    variant: 'default' as const,
    description: 'Remboursement en cours',
  },
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

export function AdvancesList({ employeeId, onRequestNew }: AdvancesListProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Get employee stats
  const { data: stats, isLoading: isLoadingStats } =
    api.salaryAdvances.getEmployeeStats.useQuery({
      employeeId,
    });

  // Get advances list
  const { data: advances, isLoading: isLoadingAdvances } =
    api.salaryAdvances.list.useQuery({
      employeeId,
      status: selectedStatus as any,
      limit: 50,
    });

  const isLoading = isLoadingStats || isLoadingAdvances;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasActiveAdvance = stats?.hasActiveAdvance ?? false;
  const canRequestNew = stats?.canRequestNewAdvance ?? false;
  const advancesList = advances?.advances ?? [];

  return (
    <div className="space-y-6">
      {/* Stats Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Votre situation</CardTitle>
          <CardDescription>Résumé de vos avances sur salaire</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasActiveAdvance ? (
              <>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    Solde restant à rembourser
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(stats?.activeAdvanceBalance ?? 0, 'FCFA')}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Prochaine déduction</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(stats?.nextDeductionAmount ?? 0, 'FCFA')}
                  </p>
                  {stats?.nextDeductionMonth && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(new Date(stats.nextDeductionMonth), 'MMMM yyyy')}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 bg-green-50 rounded-lg md:col-span-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-lg font-semibold text-green-900">
                    Aucune avance en cours
                  </p>
                </div>
                {canRequestNew && (
                  <p className="text-sm text-green-700 mt-1">
                    Vous pouvez demander une nouvelle avance de maximum{' '}
                    {formatCurrency(stats?.maxAllowedAmount ?? 0, 'FCFA')}
                  </p>
                )}
              </div>
            )}
          </div>

          {canRequestNew && onRequestNew && (
            <div className="mt-4">
              <Button onClick={onRequestNew} className="w-full min-h-[48px]">
                Demander une nouvelle avance
              </Button>
            </div>
          )}

          {!canRequestNew && hasActiveAdvance && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Vous devez rembourser votre avance en cours avant de pouvoir en demander une
                nouvelle.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Advances List */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des avances</CardTitle>
          <CardDescription>
            {advancesList.length === 0
              ? 'Aucune avance pour le moment'
              : `${advancesList.length} avance(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {advancesList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune avance enregistrée</p>
              {canRequestNew && onRequestNew && (
                <Button onClick={onRequestNew} variant="outline" className="mt-4">
                  Faire une demande
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {advancesList.map((advance) => {
                const status = statusConfig[advance.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={advance.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={status.variant} className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(new Date(advance.requestDate), 'dd MMM yyyy')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Montant demandé:</span>
                            <p className="font-semibold">
                              {formatCurrency(Number(advance.requestedAmount), 'FCFA')}
                            </p>
                          </div>

                          {advance.approvedAmount && (
                            <div>
                              <span className="text-muted-foreground">Montant approuvé:</span>
                              <p className="font-semibold">
                                {formatCurrency(Number(advance.approvedAmount), 'FCFA')}
                              </p>
                            </div>
                          )}

                          {(advance.status === 'active' ||
                            advance.status === 'disbursed' ||
                            advance.status === 'completed') && (
                            <>
                              <div>
                                <span className="text-muted-foreground">Remboursé:</span>
                                <p className="font-semibold">
                                  {formatCurrency(Number(advance.totalRepaid ?? 0), 'FCFA')}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Restant:</span>
                                <p className="font-semibold">
                                  {formatCurrency(Number(advance.remainingBalance ?? 0), 'FCFA')}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {advance.requestReason && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Raison: </span>
                            <span className="italic">{advance.requestReason}</span>
                          </div>
                        )}

                        {advance.status === 'rejected' && advance.rejectedReason && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertDescription>
                              <strong>Raison du refus:</strong> {advance.rejectedReason}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
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
