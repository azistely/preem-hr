/**
 * Batch Operations Management Page
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Full batch operations list with filtering, real-time progress, and detail view
 * Design: Mobile-first, zero learning curve, French language
 */

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileStack,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertCircle,
  Ban,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type BatchOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type OperationType = 'salary_update' | 'document_generation' | 'contract_renewal' | 'all';

const statusConfig = {
  pending: {
    label: 'En attente',
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    badgeVariant: 'secondary' as const,
  },
  running: {
    label: 'En cours',
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badgeVariant: 'default' as const,
  },
  completed: {
    label: 'Terminée',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    badgeVariant: 'secondary' as const,
  },
  failed: {
    label: 'Échouée',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    badgeVariant: 'destructive' as const,
  },
  cancelled: {
    label: 'Annulée',
    icon: Ban,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    badgeVariant: 'outline' as const,
  },
};

const operationTypeConfig = {
  salary_update: {
    label: 'Mise à jour des salaires',
    description: 'Modification groupée des salaires',
  },
  document_generation: {
    label: 'Génération de documents',
    description: 'Création en masse de documents',
  },
  contract_renewal: {
    label: 'Renouvellement de contrats',
    description: 'Renouvellement automatique des contrats',
  },
};

export default function BatchOperationsPage() {
  const utils = api.useUtils();

  // Filters
  const [status, setStatus] = useState<BatchOperationStatus | 'all'>('all');
  const [operationType, setOperationType] = useState<OperationType>('all');

  // Polling for running operations
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Fetch batch operations
  const { data, isLoading, isError } = api.batchOperations.list.useQuery(
    {
      status: status === 'all' ? undefined : status,
      operationType: operationType === 'all' ? undefined : operationType,
      limit: 50,
    },
    {
      refetchInterval: pollingEnabled ? 3000 : false, // Poll every 3s when enabled
    }
  );

  // Enable polling if there are running/pending operations
  useEffect(() => {
    const hasActiveOperations = data?.operations.some(
      (op: any) => op.status === 'running' || op.status === 'pending'
    );
    setPollingEnabled(!!hasActiveOperations);
  }, [data]);

  // Mutations
  const cancelMutation = api.batchOperations.cancel.useMutation({
    onSuccess: () => {
      toast.success('Opération annulée');
      utils.batchOperations.list.invalidate();
      utils.batchOperations.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    },
  });

  const retryMutation = api.batchOperations.retryFailed.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.batchOperations.list.invalidate();
      utils.batchOperations.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la nouvelle tentative');
    },
  });

  const deleteMutation = api.batchOperations.delete.useMutation({
    onSuccess: () => {
      toast.success('Opération supprimée');
      utils.batchOperations.list.invalidate();
      utils.batchOperations.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const handleCancel = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler cette opération ?')) {
      cancelMutation.mutate({ id });
    }
  };

  const handleRetry = (id: string) => {
    retryMutation.mutate({ id });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette opération ?')) {
      deleteMutation.mutate({ id });
    }
  };

  const operations = data?.operations || [];

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileStack className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Actions groupées</h1>
          </div>

          {pollingEnabled && (
            <Badge variant="secondary" className="gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Mise à jour en direct
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground">
          Modifiez plusieurs employés en même temps - Gagnez du temps
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Status Tabs */}
        <Tabs
          value={status}
          onValueChange={(v) => setStatus(v as BatchOperationStatus | 'all')}
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="all" className="min-h-[44px]">
              Toutes
            </TabsTrigger>
            <TabsTrigger value="running" className="min-h-[44px]">
              En cours
            </TabsTrigger>
            <TabsTrigger value="pending" className="min-h-[44px]">
              En attente
            </TabsTrigger>
            <TabsTrigger value="completed" className="min-h-[44px]">
              Terminées
            </TabsTrigger>
            <TabsTrigger value="failed" className="min-h-[44px]">
              Échouées
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="min-h-[44px]">
              Annulées
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Operation Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          <Select value={operationType} onValueChange={(v) => setOperationType(v as OperationType)}>
            <SelectTrigger className="w-[240px] min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="salary_update">Mise à jour des salaires</SelectItem>
              <SelectItem value="document_generation">Génération de documents</SelectItem>
              <SelectItem value="contract_renewal">Renouvellement de contrats</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">
            Erreur lors du chargement des opérations
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && operations.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <FileStack className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {status === 'all'
              ? 'Aucune opération groupée'
              : `Aucune opération ${statusConfig[status as BatchOperationStatus]?.label.toLowerCase()}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            Les opérations groupées apparaîtront ici lorsque vous les créerez
          </p>
        </div>
      )}

      {/* Operations List */}
      {!isLoading && !isError && operations.length > 0 && (
        <div className="space-y-4">
          {operations.map((operation: any) => {
            const config = statusConfig[operation.status as BatchOperationStatus];
            const typeConfig = operationTypeConfig[operation.operationType as keyof typeof operationTypeConfig];
            const Icon = config.icon;

            const progressPercentage =
              operation.totalCount > 0
                ? Math.round((operation.processedCount / operation.totalCount) * 100)
                : 0;

            const isActive = operation.status === 'running' || operation.status === 'pending';
            const isFailed = operation.status === 'failed';
            const isCompleted = operation.status === 'completed';
            const isCancellable = isActive;
            const isRetryable = isFailed && operation.errorCount > 0;
            const isDeletable = !isActive;

            return (
              <div
                key={operation.id}
                className={`border rounded-lg p-4 md:p-6 ${config.bgColor} transition-all hover:shadow-md`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-full ${config.bgColor}`}>
                      <Icon
                        className={`h-5 w-5 ${config.color} ${
                          operation.status === 'running' ? 'animate-spin' : ''
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">
                          {typeConfig?.label || operation.operationType}
                        </h3>
                        <Badge variant={config.badgeVariant}>{config.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {typeConfig?.description || 'Opération groupée'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar (for running operations) */}
                {isActive && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progression</span>
                      <span className="text-sm text-muted-foreground">
                        {operation.processedCount} / {operation.totalCount} ({progressPercentage}%)
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    {operation.estimatedCompletionAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fin estimée:{' '}
                        {formatDistanceToNow(new Date(operation.estimatedCompletionAt), {
                          locale: fr,
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-background/50 rounded p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="text-xl font-bold">{operation.totalCount}</p>
                  </div>
                  <div className="bg-background/50 rounded p-3">
                    <p className="text-xs text-muted-foreground mb-1">Réussis</p>
                    <p className="text-xl font-bold text-green-600">{operation.successCount}</p>
                  </div>
                  <div className="bg-background/50 rounded p-3">
                    <p className="text-xs text-muted-foreground mb-1">Échoués</p>
                    <p className="text-xl font-bold text-red-600">{operation.errorCount}</p>
                  </div>
                  <div className="bg-background/50 rounded p-3">
                    <p className="text-xs text-muted-foreground mb-1">En attente</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {operation.totalCount - operation.processedCount}
                    </p>
                  </div>
                </div>

                {/* Error Details */}
                {isFailed && operation.errors && operation.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900 mb-1">
                          {operation.errors.length} erreur(s) détectée(s)
                        </p>
                        <details className="text-xs text-red-800">
                          <summary className="cursor-pointer hover:underline">
                            Voir les détails
                          </summary>
                          <ul className="mt-2 space-y-1 list-disc list-inside">
                            {operation.errors.slice(0, 5).map((error: any, idx: number) => (
                              <li key={idx}>{error.error}</li>
                            ))}
                            {operation.errors.length > 5 && (
                              <li>... et {operation.errors.length - 5} autre(s)</li>
                            )}
                          </ul>
                        </details>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span>
                    Créée{' '}
                    {formatDistanceToNow(new Date(operation.createdAt), {
                      locale: fr,
                      addSuffix: true,
                    })}
                  </span>
                  {operation.completedAt && (
                    <span>
                      Terminée{' '}
                      {formatDistanceToNow(new Date(operation.completedAt), {
                        locale: fr,
                        addSuffix: true,
                      })}
                    </span>
                  )}
                  {operation.startedBy && (
                    <span>Par: {operation.startedBy.email || 'Système'}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {isCancellable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(operation.id)}
                      disabled={cancelMutation.isPending}
                      className="min-h-[36px]"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  )}
                  {isRetryable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(operation.id)}
                      disabled={retryMutation.isPending}
                      className="min-h-[36px]"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Réessayer ({operation.errorCount})
                    </Button>
                  )}
                  {isDeletable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(operation.id)}
                      disabled={deleteMutation.isPending}
                      className="min-h-[36px] text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Load More (if hasMore) */}
          {data?.hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" className="min-h-[44px]">
                Charger plus d'opérations
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay for mutations */}
      {(cancelMutation.isPending || retryMutation.isPending || deleteMutation.isPending) && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Traitement en cours...</span>
          </div>
        </div>
      )}
    </div>
  );
}
