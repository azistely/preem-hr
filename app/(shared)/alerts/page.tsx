/**
 * Alerts Management Page
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Full alerts list with filtering, bulk actions, and detail view
 * Design: Mobile-first, zero learning curve, French language
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { AlertCard } from '@/components/workflow/alert-card';
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
import { AlertTriangle, Bell, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

type AlertStatus = 'active' | 'dismissed' | 'completed';
type AlertSeverity = 'info' | 'warning' | 'urgent';
type AlertType = 'contract_expiry' | 'leave_request_pending' | 'leave_upcoming' | 'document_expiry' | 'payroll_reminder';

export default function AlertsPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Filters
  const [status, setStatus] = useState<AlertStatus>('active');
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [type, setType] = useState<AlertType | 'all'>('all');

  // Fetch alerts
  const { data, isLoading, isError } = api.alerts.list.useQuery({
    status,
    severity: severity === 'all' ? undefined : severity,
    type: type === 'all' ? undefined : type,
    limit: 50,
  });

  // Mutations
  const dismissMutation = api.alerts.dismiss.useMutation({
    onSuccess: () => {
      toast.success('Alerte ignorée');
      utils.alerts.list.invalidate();
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ignorance de l\'alerte');
    },
  });

  const completeMutation = api.alerts.complete.useMutation({
    onSuccess: () => {
      toast.success('Alerte marquée comme terminée');
      utils.alerts.list.invalidate();
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la completion de l\'alerte');
    },
  });

  const bulkDismissMutation = api.alerts.bulkDismiss.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} alerte${data.count > 1 ? 's' : ''} ignorée${data.count > 1 ? 's' : ''}`);
      utils.alerts.list.invalidate();
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ignorance des alertes');
    },
  });

  const markAllAsReadMutation = api.alerts.markAllAsRead.useMutation({
    onSuccess: (data) => {
      if (data.count === 0) {
        toast.info('Aucune alerte à marquer comme lue');
      } else {
        toast.success(`${data.count} alerte${data.count > 1 ? 's marquées' : ' marquée'} comme lue${data.count > 1 ? 's' : ''}`);
      }
      utils.alerts.list.invalidate();
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du marquage des alertes');
    },
  });

  const handleDismiss = (id: string) => {
    dismissMutation.mutate({ id });
  };

  const handleComplete = (id: string) => {
    completeMutation.mutate({ id });
  };

  const handleAction = (url: string) => {
    router.push(url);
  };

  const handleDismissAll = () => {
    if (!data?.alerts.length) return;

    const confirm = window.confirm(
      `Ignorer ${data.alerts.length} alerte${data.alerts.length > 1 ? 's' : ''} ?`
    );

    if (confirm) {
      bulkDismissMutation.mutate({
        ids: data.alerts.map((a: any) => a.id),
      });
    }
  };

  const handleMarkAllAsRead = () => {
    const confirm = window.confirm(
      'Marquer toutes les alertes actives comme lues ?'
    );

    if (confirm) {
      markAllAsReadMutation.mutate();
    }
  };

  const alerts = data?.alerts || [];

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Rappels automatiques</h1>
          </div>

          {status === 'active' && alerts.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
                className="min-h-[44px]"
              >
                Tout marquer comme lu
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissAll}
                disabled={bulkDismissMutation.isPending}
                className="min-h-[44px]"
              >
                Tout ignorer
              </Button>
            </div>
          )}
        </div>

        <p className="text-muted-foreground">
          Ne manquez aucune échéance importante - Soyez alerté automatiquement
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Status Tabs */}
        <Tabs value={status} onValueChange={(v) => setStatus(v as AlertStatus)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="active" className="min-h-[44px] flex-col gap-1">
              <span>Actives</span>
              {data?.total !== undefined && status === 'active' && (
                <Badge variant="secondary" className="text-xs">
                  {data.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dismissed" className="min-h-[44px]">
              Ignorées
            </TabsTrigger>
            <TabsTrigger value="completed" className="min-h-[44px]">
              Terminées
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters (only for active) */}
        {status === 'active' && (
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Select value={type} onValueChange={(v) => setType(v as AlertType | 'all')}>
                <SelectTrigger className="w-[200px] min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="contract_expiry">Expiration contrat</SelectItem>
                  <SelectItem value="leave_request_pending">Demande congé</SelectItem>
                  <SelectItem value="leave_upcoming">Congé à venir</SelectItem>
                  <SelectItem value="document_expiry">Document expiré</SelectItem>
                  <SelectItem value="payroll_reminder">Rappel paie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Gravité:</span>
              <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity | 'all')}>
                <SelectTrigger className="w-[180px] min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Urgentes
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      Avertissements
                    </div>
                  </SelectItem>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600" />
                      Informations
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">
            Erreur lors du chargement des alertes
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && alerts.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {status === 'active'
              ? 'Aucune alerte active'
              : status === 'dismissed'
              ? 'Aucune alerte ignorée'
              : 'Aucune alerte terminée'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {status === 'active'
              ? 'Vous êtes à jour ! Aucune action requise.'
              : status === 'dismissed'
              ? 'Vous n\'avez ignoré aucune alerte.'
              : 'Vous n\'avez pas encore terminé d\'alerte.'}
          </p>
        </div>
      )}

      {/* Alerts List */}
      {!isLoading && !isError && alerts.length > 0 && (
        <div className="space-y-4">
          {alerts.map((alert: any) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={status === 'active' ? handleDismiss : undefined}
              onComplete={status === 'active' ? handleComplete : undefined}
              onAction={handleAction}
            />
          ))}

          {/* Load More (if hasMore) */}
          {data?.hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" className="min-h-[44px]">
                Charger plus d'alertes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay for mutations */}
      {(dismissMutation.isPending ||
        completeMutation.isPending ||
        bulkDismissMutation.isPending ||
        markAllAsReadMutation.isPending) && (
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
