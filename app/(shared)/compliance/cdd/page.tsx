/**
 * CDD Compliance Dashboard Page
 *
 * Overview of all CDD contracts with compliance status:
 * - Summary cards (critical alerts, warnings, active CDDs)
 * - Active alerts list with employee details
 * - Actions: Convert to CDI, Renew contract
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md - Task-Oriented Design
 * @see docs/CONSOLIDATED-IMPLEMENTATION-PLAN-v3.0-EXTENDED.md (Lines 2618-2718)
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  AlertTriangle,
  Users,
  Clock,
  CheckCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Component
// ============================================================================

export default function CDDCompliancePage() {
  const { toast } = useToast();
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  // Fetch active alerts
  const {
    data: alertsData,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = trpc.compliance.getActiveAlerts.useQuery({
    limit: 50,
    offset: 0,
  });

  // Fetch active CDD contracts
  const {
    data: cddContracts,
    isLoading: contractsLoading,
  } = trpc.compliance.getActiveCDDContracts.useQuery();

  // Mutation: Convert to CDI
  const convertToCDI = trpc.compliance.convertToCDI.useMutation({
    onSuccess: () => {
      toast({
        title: 'Conversion réussie',
        description: 'Le contrat CDD a été converti en CDI avec succès.',
      });
      refetchAlerts();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message,
      });
    },
  });

  // Mutation: Dismiss alert
  const dismissAlert = trpc.compliance.dismissAlert.useMutation({
    onSuccess: () => {
      toast({
        title: 'Alerte fermée',
        description: 'L\'alerte a été marquée comme traitée.',
      });
      refetchAlerts();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message,
      });
    },
  });

  // Handle convert to CDI
  const handleConvertToCDI = async (contractId: string, alertId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir convertir ce CDD en CDI ?')) {
      return;
    }

    await convertToCDI.mutateAsync({ contractId });
    await dismissAlert.mutateAsync({
      alertId,
      actionTaken: 'converted_to_cdi',
    });
  };

  // Loading state
  if (alertsLoading || contractsLoading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">Conformité CDD</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = alertsData?.summary ?? { critical: 0, warning: 0, info: 0, totalCDD: 0 };
  const alerts = alertsData?.details ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* ========================================
          1. Page Header
      ======================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conformité CDD</h1>
          <p className="text-muted-foreground mt-1">
            Suivi des contrats à durée déterminée (2 ans / 2 renouvellements max)
          </p>
        </div>
        <Button onClick={() => refetchAlerts()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* ========================================
          2. Summary Cards
      ======================================== */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Critical Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertes Critiques</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.critical}</div>
            <p className="text-xs text-muted-foreground">Action immédiate requise</p>
          </CardContent>
        </Card>

        {/* Warning Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avertissements</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.warning}</div>
            <p className="text-xs text-muted-foreground">Action requise dans 30-90 jours</p>
          </CardContent>
        </Card>

        {/* Active CDDs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CDD Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalCDD}</div>
            <p className="text-xs text-muted-foreground">Contrats en cours</p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================
          3. Alerts List
      ======================================== */}
      <Card>
        <CardHeader>
          <CardTitle>Alertes Actives</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription>
                Aucune alerte active. Tous les contrats CDD sont conformes.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    selectedAlert === alert.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Alert Icon & Info */}
                  <div className="flex items-start gap-4 flex-1">
                    {alert.alertSeverity === 'critical' ? (
                      <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                    )}

                    <div className="space-y-2 flex-1">
                      {/* Employee Info */}
                      <div>
                        <Link
                          href={`/employees/${alert.employeeId}`}
                          className="font-medium hover:underline"
                        >
                          {alert.employeeName}
                        </Link>
                        <span className="text-sm text-muted-foreground ml-2">
                          #{alert.employeeNumber}
                        </span>
                      </div>

                      {/* Alert Message */}
                      <p className="text-sm text-muted-foreground">{alert.alertMessage}</p>

                      {/* Contract Details */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          <FileText className="inline h-3 w-3 mr-1" />
                          Contrat: {alert.contractNumber ?? 'N/A'}
                        </span>
                        {alert.contractEndDate && (
                          <span>
                            <Clock className="inline h-3 w-3 mr-1" />
                            Fin: {format(parseISO(alert.contractEndDate as string), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {alert.renewalCount ?? 0} renouvellement(s)
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleConvertToCDI(alert.contractId, alert.id)}
                      disabled={convertToCDI.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Convertir en CDI
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Navigate to renewal form (to be implemented)
                        toast({
                          title: 'Fonctionnalité à venir',
                          description: 'Le formulaire de renouvellement sera bientôt disponible.',
                        });
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Renouveler
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Marquer cette alerte comme traitée ?')) {
                          dismissAlert.mutate({
                            alertId: alert.id,
                            actionTaken: 'ignored',
                          });
                        }
                      }}
                    >
                      Ignorer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================
          4. All CDD Contracts (Quick View)
      ======================================== */}
      {cddContracts && cddContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tous les Contrats CDD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cddContracts.map((contract: any) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <Link
                        href={`/employees/${contract.employeeId}`}
                        className="font-medium hover:underline"
                      >
                        {contract.employeeName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {contract.compliance.totalMonths} / 24 mois • {contract.renewalCount} / 2 renouvellements
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {contract.compliance.criticalAlerts > 0 && (
                      <Badge variant="destructive">
                        {contract.compliance.criticalAlerts} alerte(s) critique(s)
                      </Badge>
                    )}
                    {contract.compliance.compliant ? (
                      <Badge variant="default" className="bg-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conforme
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Non conforme
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
