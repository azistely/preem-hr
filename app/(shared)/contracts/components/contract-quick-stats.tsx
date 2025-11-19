/**
 * Contract Quick Stats Component
 *
 * Displays quick statistics at the bottom of the contracts page:
 * - Contracts to renew (< 30 days)
 * - Critical alerts count
 * - New contracts this month
 */

'use client';

import { api } from '@/trpc/react';
import { Skeleton } from '@/components/ui/skeleton';

export function ContractQuickStats() {
  const { data: stats } = api.contracts.getContractStats.useQuery();
  const { data: alerts } = api.compliance.getActiveAlerts.useQuery({
    limit: 100,
    offset: 0,
  });

  if (!stats || !alerts) {
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
      <p>
        • <span className="font-medium">{stats.expiringSoon}</span> contrat(s) à
        renouveler dans les 30 prochains jours
      </p>
      <p>
        • <span className="font-medium text-destructive">
          {alerts.summary.critical}
        </span>{' '}
        alerte(s) critique(s) à traiter
      </p>
      <p>
        • <span className="font-medium">{alerts.summary.warning}</span> alerte(s)
        d'avertissement
      </p>
    </div>
  );
}
