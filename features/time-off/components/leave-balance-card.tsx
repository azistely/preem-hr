/**
 * Leave Balance Card
 *
 * Display leave balance summary with stat cards
 * Following HCI principles:
 * - Large numbers (outcomes)
 * - Color coding (success for available)
 * - Expiration warnings
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TimeOffBalance {
  id: string;
  employeeId: string;
  policyId: string;
  balance: string;
  pending: string;
  periodStart: string;
  periodEnd: string;
  expiresAt: string | null;
  policy?: {
    id: string;
    name: string;
    policyType: string;
  };
}

interface LeaveBalanceCardProps {
  balances: TimeOffBalance[];
}

export function LeaveBalanceCard({ balances }: LeaveBalanceCardProps) {
  if (!balances || balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Solde de congés</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucun solde de congés disponible</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalAvailable = balances.reduce(
    (sum, b) => sum + (parseFloat(b.balance) - parseFloat(b.pending)),
    0
  );
  const totalUsed = balances.reduce(
    (sum, b) => sum + parseFloat(b.pending),
    0
  );
  const totalPending = totalUsed; // Pending is the amount currently requested

  // Check for expiring balances (within 30 days)
  const expiringBalances = balances.filter((b) => {
    if (!b.expiresAt) return false;
    const daysUntilExpiry = differenceInDays(new Date(b.expiresAt), new Date());
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Solde de congés
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Available Balance */}
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300 mb-1">Disponible</p>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100">
              {totalAvailable.toFixed(1)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">jours</p>
          </div>

          {/* Pending Requests */}
          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">En attente</p>
            <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
              {totalPending.toFixed(1)}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">jours</p>
          </div>

          {/* Period */}
          <div className="bg-muted p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-1">Période</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {balances[0] && (
                <>
                  {format(new Date(balances[0].periodStart), 'MMM yyyy', { locale: fr })}
                  {' - '}
                  {format(new Date(balances[0].periodEnd), 'MMM yyyy', { locale: fr })}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Detailed Balances by Policy */}
        {balances.length > 1 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Détail par type</p>
            {balances.map((balance) => {
              const available = parseFloat(balance.balance) - parseFloat(balance.pending);
              return (
                <div key={balance.id} className="flex justify-between items-center">
                  <span className="text-sm">{balance.policy?.name || 'Type inconnu'}</span>
                  <span className="text-sm font-medium">
                    {available.toFixed(1)} jours
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expiration Warnings */}
        {expiringBalances.length > 0 && (
          <Alert variant="default" className="border-yellow-500">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <p className="font-medium mb-1">Congés à expirer bientôt</p>
              {expiringBalances.map((balance) => {
                const daysUntilExpiry = differenceInDays(
                  new Date(balance.expiresAt!),
                  new Date()
                );
                return (
                  <p key={balance.id} className="text-sm">
                    {balance.policy?.name}: {parseFloat(balance.balance).toFixed(1)} jours
                    expire dans {daysUntilExpiry} jour{daysUntilExpiry > 1 ? 's' : ''}
                  </p>
                );
              })}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
