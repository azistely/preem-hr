/**
 * Alerts Dashboard Widget
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Displays top 5 urgent alerts on dashboard
 * Design: Zero learning curve, mobile-first, French language
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, ChevronRight } from 'lucide-react';
import { AlertItem } from './alert-card';
import { api } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function AlertsDashboardWidget() {
  const router = useRouter();
  const utils = api.useUtils();

  // Fetch alerts summary
  const { data, isLoading } = api.alerts.getSummary.useQuery();

  // Dismiss alert mutation
  const dismissMutation = api.alerts.dismiss.useMutation({
    onSuccess: () => {
      toast.success('Alerte ignorée');
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ignorance de l\'alerte');
    },
  });

  // Complete alert mutation
  const completeMutation = api.alerts.complete.useMutation({
    onSuccess: () => {
      toast.success('Alerte marquée comme terminée');
      utils.alerts.getSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la completion de l\'alerte');
    },
  });

  const handleAlertClick = (actionUrl: string | null) => {
    if (actionUrl) {
      router.push(actionUrl);
    }
  };

  const urgentCount = data?.summary.urgent || 0;
  const totalCount = data?.summary.total || 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Alertes</CardTitle>
            {urgentCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {urgentCount}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/alerts')}
            className="h-8 text-sm"
          >
            Voir tout
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {totalCount > 0 && (
          <CardDescription>
            {urgentCount > 0 ? (
              <span className="text-red-600 font-medium">
                {urgentCount} alerte{urgentCount > 1 ? 's' : ''} urgente{urgentCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span>Aucune alerte urgente</span>
            )}
            {data && data.summary.warning > 0 && (
              <span className="text-muted-foreground">
                {' '}· {data.summary.warning} avertissement{data.summary.warning > 1 ? 's' : ''}
              </span>
            )}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !data || data.urgentAlerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
              <Bell className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aucune alerte pour le moment
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vous serez notifié des actions importantes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.urgentAlerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onClick={() => handleAlertClick(alert.actionUrl)}
              />
            ))}

            {totalCount > 5 && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => router.push('/alerts')}
              >
                Voir {totalCount - 5} autre{totalCount - 5 > 1 ? 's' : ''} alerte
                {totalCount - 5 > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Alert Summary Stats (for dashboard header)
 */
export function AlertsSummaryBadge() {
  const { data } = api.alerts.getUrgentCount.useQuery();

  if (!data || data === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      <AlertTriangle className="h-3 w-3 mr-1" />
      {data}
    </Badge>
  );
}
