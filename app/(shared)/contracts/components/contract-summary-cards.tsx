/**
 * Contract Summary Cards Component
 *
 * Displays high-level statistics for all contracts:
 * - Total contracts
 * - CDI count and percentage
 * - CDD count and percentage
 * - CDDTI count and percentage
 * - Contracts expiring soon (< 30 days)
 */

'use client';

import { FileText, CheckCircle, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/trpc/react';
import { Skeleton } from '@/components/ui/skeleton';

export function ContractSummaryCards() {
  const { data: stats, isLoading } = api.contracts.getContractStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Total Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Contrats
          </CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.total}</div>
          <p className="text-sm text-muted-foreground mt-1">
            Contrats actifs
          </p>
        </CardContent>
      </Card>

      {/* CDI Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CDI
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.cdi}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.cdiPercentage}% du total
          </p>
        </CardContent>
      </Card>

      {/* CDD Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CDD
          </CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.cdd}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.cddPercentage}% du total
          </p>
        </CardContent>
      </Card>

      {/* CDDTI Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CDDTI
          </CardTitle>
          <CalendarClock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.cddti}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.cddtiPercentage}% du total
          </p>
        </CardContent>
      </Card>

      {/* Expiring Soon */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Expire bientôt
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.expiringSoon}</div>
          <p className="text-sm text-muted-foreground mt-1">
            Dans 30 jours
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
