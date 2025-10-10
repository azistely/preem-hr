/**
 * PolicyAuditTrail Component
 *
 * Timeline view of policy changes (effective-dated history)
 * Shows who changed what and when
 */

'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PolicyAuditTrailProps {
  policyId: string;
  className?: string;
}

export function PolicyAuditTrail({
  policyId,
  className,
}: PolicyAuditTrailProps) {
  const { data: history, isLoading } = trpc.policies.getPolicyHistory.useQuery(
    policyId
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Aucun historique disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {history.map((version, index) => {
        const isLatest = index === 0;
        const isCurrent = !version.effectiveTo;

        return (
          <Card
            key={version.id}
            className={cn(
              isCurrent && 'border-primary',
              'relative'
            )}
          >
            {/* Timeline connector */}
            {index < history.length - 1 && (
              <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-border -mb-4" />
            )}

            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Timeline dot */}
                <div
                  className={cn(
                    'h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0',
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Clock className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">
                          {isLatest ? 'Création initiale' : 'Modification'}
                        </h3>
                        {isCurrent && (
                          <Badge variant="default">En vigueur</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(
                          new Date(version.effectiveFrom),
                          'PPP',
                          { locale: fr }
                        )}
                        {version.effectiveTo && (
                          <>
                            {' '}
                            →{' '}
                            {format(
                              new Date(version.effectiveTo),
                              'PPP',
                              { locale: fr }
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    {version.createdBy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Système</span>
                      </div>
                    )}
                  </div>

                  {/* Changes */}
                  <div className="space-y-1 text-sm">
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Taux d'acquisition
                        </p>
                        <p className="font-medium">
                          {version.accrualRate} jours/mois
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Solde maximum
                        </p>
                        <p className="font-medium">
                          {version.maxBalance
                            ? `${version.maxBalance} jours`
                            : 'Illimité'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Approbation
                        </p>
                        <p className="font-medium">
                          {version.requiresApproval ? 'Requise' : 'Non requise'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Préavis
                        </p>
                        <p className="font-medium">
                          {version.advanceNoticeDays} jours
                        </p>
                      </div>
                    </div>

                    {(version as any).legalReference && (
                      <p className="text-xs text-muted-foreground italic mt-2">
                        Référence: {(version as any).legalReference}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function PolicyAuditTrailSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-20 w-full mt-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
