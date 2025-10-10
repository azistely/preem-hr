/**
 * Time Tracking Dashboard
 *
 * Mobile-first page for employees to clock in/out and view time entries
 * Following HCI principles: large touch targets, French labels, immediate feedback
 */

'use client';

import { useState, useMemo } from 'react';
import { ClockInButton } from '@/features/time-tracking/components/clock-in-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCurrentEmployee } from '@/hooks/use-current-employee';
import { Loader2 } from 'lucide-react';
import type { OvertimeSummary } from '@/features/time-tracking/types/overtime';

export default function TimeTrackingPage() {
  // Get current employee from auth context
  const { employeeId, employee, isLoading: loadingEmployee } = useCurrentEmployee();

  // Memoize dates to prevent infinite re-renders
  const dateRange = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return { startDate: sevenDaysAgo, endDate: today };
  }, []);

  const monthRange = useMemo(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: firstOfMonth, endDate: today };
  }, []);

  // Fetch current entry
  const { data: currentEntry, isLoading: loadingCurrent, refetch: refetchCurrent } = trpc.timeTracking.getCurrentEntry.useQuery({
    employeeId: employeeId || '',
  }, {
    enabled: !!employeeId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Fetch recent entries (last 7 days)
  const { data: recentEntries, isLoading: loadingEntries } = trpc.timeTracking.getEntries.useQuery({
    employeeId: employeeId || '',
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  }, {
    enabled: !!employeeId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Fetch overtime summary for current month
  const { data: overtimeSummary } = trpc.timeTracking.getOvertimeSummary.useQuery({
    employeeId: employeeId || '',
    periodStart: monthRange.startDate,
    periodEnd: monthRange.endDate,
  }, {
    enabled: !!employeeId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  }) as { data: OvertimeSummary | undefined };

  // Show loading state while fetching employee
  if (loadingEmployee || !employeeId) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pointage</h1>
        <p className="text-muted-foreground mt-2">
          Enregistrez vos heures de travail
        </p>
      </div>

      {/* Clock In/Out Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pointer votre présence
          </CardTitle>
          <CardDescription>
            {currentEntry
              ? 'Vous êtes actuellement au travail'
              : 'Commencez votre journée de travail'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClockInButton
            employeeId={employeeId}
            currentEntry={currentEntry}
            onUpdate={refetchCurrent}
          />

          {currentEntry && (
            <div className="mt-4 p-4 bg-primary/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Arrivée</p>
              <p className="text-lg font-semibold">
                {new Date(currentEntry.clockIn).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Il y a{' '}
                {formatDistanceToNow(new Date(currentEntry.clockIn), {
                  locale: fr,
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overtime Summary */}
      {overtimeSummary && overtimeSummary.totalOvertimeHours > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Heures supplémentaires ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatDuration(overtimeSummary.totalOvertimeHours)}
            </div>

            <Collapsible className="mt-4">
              <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
                Voir le détail ↓
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-2">
                {(overtimeSummary.breakdown.hours_41_to_46 || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Heures 41-46 (×1.15)</span>
                    <span className="font-medium">
                      {formatDuration(overtimeSummary.breakdown.hours_41_to_46 || 0)}
                    </span>
                  </div>
                )}
                {(overtimeSummary.breakdown.hours_above_46 || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Heures 46+ (×1.50)</span>
                    <span className="font-medium">
                      {formatDuration(overtimeSummary.breakdown.hours_above_46 || 0)}
                    </span>
                  </div>
                )}
                {(overtimeSummary.breakdown.night_work || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Travail de nuit (×1.75)</span>
                    <span className="font-medium">
                      {formatDuration(overtimeSummary.breakdown.night_work || 0)}
                    </span>
                  </div>
                )}
                {(overtimeSummary.breakdown.weekend || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Weekend (×1.75)</span>
                    <span className="font-medium">
                      {formatDuration(overtimeSummary.breakdown.weekend || 0)}
                    </span>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique (7 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEntries ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : recentEntries && recentEntries.length > 0 ? (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(entry.clockIn).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.clockIn).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {entry.clockOut
                        ? new Date(entry.clockOut).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'En cours'}
                    </p>
                  </div>
                  <div className="text-right">
                    {entry.totalHours && (
                      <p className="font-semibold">
                        {formatDuration(Number(entry.totalHours))}
                      </p>
                    )}
                    <Badge
                      variant={
                        entry.status === 'approved'
                          ? 'default'
                          : entry.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs mt-1"
                    >
                      {entry.status === 'approved'
                        ? 'Approuvé'
                        : entry.status === 'rejected'
                        ? 'Rejeté'
                        : 'En attente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune entrée cette semaine
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
