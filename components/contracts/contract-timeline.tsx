/**
 * Contract Timeline Component
 *
 * Visual timeline showing CDD contract history with:
 * - Duration progress bar (0-24 months)
 * - Renewals progress (0-2 renewals)
 * - Contract history timeline
 * - Compliance alerts
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md - Progressive Disclosure Pattern
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ComplianceStatus } from '@/lib/compliance/cdd-compliance.service';

// ============================================================================
// Types
// ============================================================================

interface ContractTimelineProps {
  employeeId: string;
  compliance: ComplianceStatus;
}

// ============================================================================
// Component
// ============================================================================

export function ContractTimeline({ employeeId, compliance }: ContractTimelineProps) {
  // If no active CDD contract, show info message
  if (!compliance.contract || compliance.contract.contractType !== 'CDD') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-5 w-5 text-success" />
            <span>CDI - Aucun suivi de conformité requis</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalMonths = compliance.totalMonths ?? 0;
  const remainingMonths = compliance.remainingMonths ?? (24 - totalMonths);
  const renewalsRemaining = compliance.renewalsRemaining ?? (2 - (compliance.contract?.renewalCount ?? 0));

  // Calculate progress percentages
  const durationProgress = Math.min((totalMonths / 24) * 100, 100);
  const renewalProgress = ((compliance.contract?.renewalCount ?? 0) / 2) * 100;

  // Determine progress color
  const getDurationColor = () => {
    if (totalMonths >= 24) return 'bg-destructive';
    if (totalMonths >= 21) return 'bg-yellow-500';
    if (totalMonths >= 18) return 'bg-orange-500';
    return 'bg-primary';
  };

  const getRenewalColor = () => {
    const renewalCount = compliance.contract?.renewalCount ?? 0;
    if (renewalCount >= 2) return 'bg-destructive';
    if (renewalCount >= 1) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Conformité CDD</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ========================================
            1. Duration Progress
        ======================================== */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Durée Totale CDD</span>
            <span className="text-sm font-bold">
              {totalMonths} / 24 mois
            </span>
          </div>
          <Progress
            value={durationProgress}
            className={`h-3 ${getDurationColor()}`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {remainingMonths > 0 ? (
              <>
                <Clock className="inline h-3 w-3 mr-1" />
                {remainingMonths} mois restants
              </>
            ) : (
              <>
                <AlertCircle className="inline h-3 w-3 mr-1 text-destructive" />
                Limite atteinte - Conversion CDI requise
              </>
            )}
          </p>
        </div>

        {/* ========================================
            2. Renewals Progress
        ======================================== */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Renouvellements</span>
            <span className="text-sm font-bold">
              {compliance.contract?.renewalCount ?? 0} / 2
            </span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => {
              const renewalCount = compliance.contract?.renewalCount ?? 0;
              return (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded transition-colors ${
                    i < renewalCount
                      ? getRenewalColor()
                      : i === renewalCount
                      ? 'bg-yellow-200'
                      : 'bg-gray-200'
                  }`}
                  title={
                    i < renewalCount
                      ? 'Renouvellement effectué'
                      : i === renewalCount
                      ? 'Renouvellement actuel'
                      : 'Renouvellement disponible'
                  }
                />
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {renewalsRemaining > 0 ? (
              <>
                {renewalsRemaining} renouvellement(s) possible(s)
              </>
            ) : (
              <>
                <AlertCircle className="inline h-3 w-3 mr-1 text-destructive" />
                Maximum atteint - Aucun renouvellement supplémentaire
              </>
            )}
          </p>
        </div>

        {/* ========================================
            3. Contract Timeline
        ======================================== */}
        {compliance.history && compliance.history.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Historique des Contrats</h4>
            <div className="space-y-3">
              {/* Current contract */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {(compliance.contract?.renewalCount ?? 0) + 1}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium">
                    {(compliance.contract?.renewalCount ?? 0) === 0
                      ? 'Contrat Initial'
                      : `Renouvellement ${compliance.contract?.renewalCount}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {compliance.contract?.startDate && format(parseISO(compliance.contract.startDate as string), 'dd MMM yyyy', { locale: fr })}
                    {' → '}
                    {compliance.contract?.endDate
                      ? format(parseISO(compliance.contract.endDate as string), 'dd MMM yyyy', { locale: fr })
                      : 'En cours'}
                    {compliance.contract?.endDate && compliance.contract?.startDate && (
                      <span className="ml-2 text-xs">
                        ({Math.abs(
                          Math.floor(
                            (new Date(compliance.contract.endDate as string).getTime() -
                              new Date(compliance.contract.startDate as string).getTime()) /
                              (1000 * 60 * 60 * 24 * 30)
                          )
                        )}{' '}
                        mois)
                      </span>
                    )}
                  </p>
                  {compliance.contract?.cddReason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Motif: {compliance.contract.cddReason}
                    </p>
                  )}
                </div>
                <Badge variant="default" className="mt-1">
                  Actif
                </Badge>
              </div>

              {/* Renewal history */}
              {compliance.history.map((renewal, idx) => (
                <div key={renewal.id} className="flex items-start gap-3 opacity-60">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    {compliance.history!.length - idx}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium">
                      {idx === compliance.history!.length - 1
                        ? 'Contrat Initial'
                        : `Renouvellement ${compliance.history!.length - idx - 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(renewal.previousEndDate as string), 'dd MMM yyyy', { locale: fr })}
                      {' → '}
                      {format(parseISO(renewal.newEndDate as string), 'dd MMM yyyy', { locale: fr })}
                      <span className="ml-2">({renewal.renewalDurationMonths} mois)</span>
                    </p>
                    {renewal.renewalReason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Motif: {renewal.renewalReason}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    Terminé
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================
            4. Compliance Alerts
        ======================================== */}
        {compliance.alerts && compliance.alerts.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Alertes de Conformité
            </h4>
            <div className="space-y-2">
              {compliance.alerts.map((alert, idx) => (
                <Alert
                  key={idx}
                  variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                  className={
                    alert.severity === 'warning'
                      ? 'border-yellow-500 bg-yellow-50'
                      : ''
                  }
                >
                  <div className="flex items-start gap-2">
                    {alert.severity === 'critical' ? (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <AlertTitle className="text-sm font-medium">
                        {alert.message}
                      </AlertTitle>
                      <AlertDescription className="text-xs">
                        <strong>Action requise:</strong> {alert.actionRequired}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* ========================================
            5. Compliance Status Badge
        ======================================== */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">Statut de conformité:</span>
          {compliance.compliant ? (
            <Badge variant="default" className="bg-success text-success-foreground">
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
      </CardContent>
    </Card>
  );
}
