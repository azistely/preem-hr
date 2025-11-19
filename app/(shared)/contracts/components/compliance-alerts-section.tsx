/**
 * Compliance Alerts Section Component
 *
 * Displays active compliance alerts for CDD and CDDTI contracts:
 * - CDD: 2-year/2-renewal limits
 * - CDDTI: 12-month limit
 *
 * Features:
 * - Tabbed view (All, CDD, CDDTI)
 * - Severity-based filtering (critical, warning, info)
 * - Inline actions (Convert to CDI, Renew, Dismiss)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ComplianceAlertsSection() {
  const [activeTab, setActiveTab] = useState<'all' | 'cdd' | 'cddti'>('all');

  const { data: alerts, isLoading } = api.compliance.getActiveAlerts.useQuery({
    limit: 50,
    offset: 0,
  });

  const utils = api.useUtils();

  const dismissAlert = api.compliance.dismissAlert.useMutation({
    onSuccess: () => {
      toast.success('Alerte fermée avec succès');
      utils.compliance.getActiveAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const convertToCDI = api.compliance.convertToCDI.useMutation({
    onSuccess: () => {
      toast.success('Contrat converti en CDI avec succès');
      utils.compliance.getActiveAlerts.invalidate();
      utils.contracts.getAllContracts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const convertCDDTIToCDI = api.compliance.convertCDDTIToCDI.useMutation({
    onSuccess: () => {
      toast.success('Contrat CDDTI converti en CDI avec succès');
      utils.compliance.getActiveAlerts.invalidate();
      utils.contracts.getAllContracts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Alertes de conformité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!alerts) {
    return null;
  }

  const cddAlerts = alerts.details.filter((a) => a.alertType.includes('year') || a.alertType.includes('renewal'));
  const cddtiAlerts = alerts.details.filter((a) => a.alertType.includes('month'));

  const getAlertsList = () => {
    switch (activeTab) {
      case 'cdd':
        return cddAlerts;
      case 'cddti':
        return cddtiAlerts;
      default:
        return alerts.details;
    }
  };

  const currentAlerts = getAlertsList();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Alertes de conformité
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              Tous ({alerts.details.length})
            </TabsTrigger>
            <TabsTrigger value="cdd">
              CDD (2 ans) ({cddAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="cddti">
              CDDTI (12 mois) ({cddtiAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {currentAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>Aucune alerte de conformité</p>
              </div>
            ) : (
              currentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start justify-between p-4 rounded-lg border',
                    alert.alertSeverity === 'critical' &&
                      'bg-destructive/10 border-destructive',
                    alert.alertSeverity === 'warning' && 'bg-orange-50 border-orange-300',
                    alert.alertSeverity === 'info' && 'bg-blue-50 border-blue-300'
                  )}
                >
                  <div className="flex items-start gap-3 flex-1">
                    {alert.alertSeverity === 'critical' ? (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    ) : alert.alertSeverity === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    )}

                    <div className="flex-1">
                      <p className="font-medium">
                        <Link
                          href={`/employees/${alert.employeeId}`}
                          className="hover:underline"
                        >
                          {alert.employeeName}
                        </Link>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.alertMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline">
                          {alert.contractNumber || 'Sans numéro'}
                        </Badge>
                        {alert.contractEndDate && (
                          <Badge variant="outline">
                            Expire: {format(new Date(alert.contractEndDate), 'dd MMM yyyy', { locale: fr })}
                          </Badge>
                        )}
                        {alert.renewalCount !== null && alert.renewalCount !== undefined && (
                          <Badge variant="outline">
                            Renouvellements: {alert.renewalCount}/2
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {/* Actions based on alert type */}
                    {alert.alertType.includes('month') ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            convertCDDTIToCDI.mutate({ contractId: alert.contractId })
                          }
                          disabled={convertCDDTIToCDI.isPending}
                        >
                          Convertir en CDI
                        </Button>
                        <Button size="sm" variant="outline">
                          Ajuster en CDD
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            convertToCDI.mutate({ contractId: alert.contractId })
                          }
                          disabled={convertToCDI.isPending}
                        >
                          Convertir en CDI
                        </Button>
                        {!alert.alertType.includes('renewal') &&
                          alert.renewalCount !== undefined &&
                          alert.renewalCount < 2 && (
                            <Button size="sm" variant="outline">
                              Renouveler
                            </Button>
                          )}
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        dismissAlert.mutate({
                          alertId: alert.id,
                          actionTaken: 'ignored',
                        })
                      }
                      disabled={dismissAlert.isPending}
                    >
                      Ignorer
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
