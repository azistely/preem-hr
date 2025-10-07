/**
 * Policy Audit Trail Component
 *
 * Shows effective-dated history of policy changes
 * Displays timeline of modifications with who/when/what changed
 *
 * Usage:
 * <PolicyAuditTrail policyId="uuid" />
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface PolicyAuditTrailProps {
  policyId: string;
}

export function PolicyAuditTrail({ policyId }: PolicyAuditTrailProps) {
  const { data: history, isLoading } = api.policies.getPolicyHistory.useQuery(policyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des modifications</CardTitle>
          <CardDescription>Aucune modification enregistrée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique des modifications
        </CardTitle>
        <CardDescription>
          {history.length} version{history.length > 1 ? 's' : ''} de cette politique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-6">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

          {history.map((version, index) => {
            const isActive = !version.effectiveTo;
            const isFuture = version.effectiveFrom && new Date(version.effectiveFrom) > new Date();

            return (
              <div key={version.id} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-1 h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                    isActive
                      ? 'bg-primary border-primary'
                      : isFuture
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-muted border-border'
                  }`}
                >
                  {isActive && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>

                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {index === 0 ? 'Version actuelle' : `Version ${history.length - index}`}
                      </span>
                      {isActive && <Badge variant="default">Active</Badge>}
                      {isFuture && <Badge variant="secondary">Programmée</Badge>}
                      {!isActive && !isFuture && <Badge variant="outline">Archivée</Badge>}
                    </div>
                  </div>

                  {/* Period */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Du{' '}
                        {format(new Date(version.effectiveFrom || ''), 'd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    {version.effectiveTo && (
                      <>
                        <span>→</span>
                        <div className="flex items-center gap-1.5">
                          <span>
                            Au{' '}
                            {format(new Date(version.effectiveTo), 'd MMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      </>
                    )}
                    {!version.effectiveTo && isActive && (
                      <span className="text-primary">En cours</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Taux d&apos;accumulation:</span>
                        <span className="ml-2 font-medium">{version.accrualRate} jours/mois</span>
                      </div>
                      {version.maxBalance && (
                        <div>
                          <span className="text-muted-foreground">Solde maximum:</span>
                          <span className="ml-2 font-medium">{version.maxBalance} jours</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Approbation requise:</span>
                        <span className="ml-2 font-medium">
                          {version.requiresApproval ? 'Oui' : 'Non'}
                        </span>
                      </div>
                      {version.advanceNoticeDays && version.advanceNoticeDays > 0 && (
                        <div>
                          <span className="text-muted-foreground">Préavis:</span>
                          <span className="ml-2 font-medium">
                            {version.advanceNoticeDays} jour{version.advanceNoticeDays > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {version.legalReference && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground pt-2 border-t">
                        <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{version.legalReference}</span>
                      </div>
                    )}

                    {version.createdBy && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t">
                        <User className="h-3 w-3" />
                        <span>
                          Modifié le{' '}
                          {format(new Date(version.createdAt || ''), 'PPP à HH:mm', {
                            locale: fr,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {index < history.length - 1 && <Separator className="mt-6" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
