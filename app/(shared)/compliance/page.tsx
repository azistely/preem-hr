/**
 * Compliance Dashboard Page
 *
 * Overview of all compliance trackers with KPIs and quick actions.
 * Features:
 * - Summary stats (open trackers, critical, action completion rate, overdue)
 * - Breakdown by tracker type
 * - Urgent actions widget
 * - Quick navigation to trackers and actions
 *
 * HR Manager + Admin only access
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  ArrowRight,
  AlertCircle,
  Briefcase,
  ClipboardList,
  Award,
  Gavel,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Map tracker type slugs to icons
const trackerTypeIcons: Record<string, React.ReactNode> = {
  accidents: <AlertTriangle className="h-5 w-5" />,
  visites: <Briefcase className="h-5 w-5" />,
  certifications: <Award className="h-5 w-5" />,
  disciplinaire: <Gavel className="h-5 w-5" />,
};

// Map priority to badge variant
const priorityVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
  critical: 'destructive',
};

// Map status to badge variant
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  cancelled: 'secondary',
};

export default function ComplianceDashboardPage() {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = api.complianceTrackers.getDashboardStats.useQuery();

  // Fetch trackers by type for breakdown
  const { data: trackerTypes, isLoading: typesLoading } = api.complianceTrackerTypes.list.useQuery();

  // Fetch overdue actions
  const { data: overdueActions, isLoading: actionsLoading } = api.complianceActionItems.getOverdue.useQuery();

  // Fetch recent trackers
  const { data: recentTrackers, isLoading: recentLoading } = api.complianceTrackers.list.useQuery({
    limit: 5,
  });

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Conformité</h1>
          </div>

          <Link href="/compliance/trackers/new">
            <Button className="min-h-[56px] w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Button>
          </Link>
        </div>

        <p className="text-muted-foreground">
          Suivi des accidents, visites réglementaires, certifications et procédures disciplinaires
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dossiers ouverts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{stats?.openTrackers ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <div className="text-3xl font-bold text-destructive">
                  {stats?.criticalTrackers ?? 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actions réalisées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                <div className="text-3xl font-bold text-green-600">
                  {stats?.completionRate ?? 0}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-600" />
                <div className="text-3xl font-bold text-amber-600">
                  {stats?.actionItemsOverdue ?? 0}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tracker Types Breakdown */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Par type de suivi</CardTitle>
          <CardDescription>Cliquez sur un type pour voir les dossiers</CardDescription>
        </CardHeader>
        <CardContent>
          {typesLoading ? (
            <div className="grid gap-3 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : trackerTypes && trackerTypes.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-4">
              {trackerTypes.map((type) => {
                const typeStats = stats?.byType?.find((t) => t.typeId === type.id);
                return (
                  <Link
                    key={type.id}
                    href={`/compliance/trackers?type=${type.slug}`}
                    className="block"
                  >
                    <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {trackerTypeIcons[type.slug] || <FileText className="h-5 w-5" />}
                          </div>
                          <div className="font-medium">{type.name}</div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-2xl font-bold">
                            {typeStats?.count ?? 0}
                          </span>
                          <span className="text-sm text-muted-foreground">ouverts</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun type de suivi configuré
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Urgent Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Actions urgentes
              </CardTitle>
              <CardDescription>Actions en retard ou à échéance proche</CardDescription>
            </div>
            <Link href="/compliance/action-items">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {actionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : overdueActions && overdueActions.length > 0 ? (
              <div className="space-y-3">
                {overdueActions.slice(0, 5).map((action) => (
                  <Link
                    key={action.id}
                    href={`/compliance/trackers/${action.tracker?.id || action.trackerId}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{action.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          {action.assignee && (
                            <>
                              <Users className="h-3 w-3" />
                              <span className="truncate">{action.assignee.firstName} {action.assignee.lastName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={priorityVariants[action.priority] || 'default'}>
                          {action.priority === 'critical' && 'Critique'}
                          {action.priority === 'high' && 'Haute'}
                          {action.priority === 'medium' && 'Moyenne'}
                          {action.priority === 'low' && 'Basse'}
                        </Badge>
                        {action.dueDate && (
                          <span className="text-xs text-destructive">
                            {new Date(action.dueDate) < new Date()
                              ? `En retard de ${formatDistanceToNow(new Date(action.dueDate), { locale: fr })}`
                              : `Échéance ${formatDistanceToNow(new Date(action.dueDate), { locale: fr, addSuffix: true })}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune action urgente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trackers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dossiers récents
              </CardTitle>
              <CardDescription>Derniers dossiers créés ou mis à jour</CardDescription>
            </div>
            <Link href="/compliance/trackers">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentTrackers?.data && recentTrackers.data.length > 0 ? (
              <div className="space-y-3">
                {recentTrackers.data.map((tracker) => (
                  <Link
                    key={tracker.id}
                    href={`/compliance/trackers/${tracker.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                          {trackerTypeIcons[tracker.trackerType?.slug || ''] || (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tracker.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {tracker.referenceNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={statusVariants[tracker.status] || 'secondary'}>
                          {tracker.status === 'nouveau' && 'Nouveau'}
                          {tracker.status === 'analyse' && 'Analyse'}
                          {tracker.status === 'plan_action' && 'Plan action'}
                          {tracker.status === 'cloture' && 'Clôturé'}
                          {!['nouveau', 'analyse', 'plan_action', 'cloture'].includes(tracker.status) && tracker.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tracker.createdAt), { locale: fr, addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucun dossier</p>
                <Link href="/compliance/trackers/new">
                  <Button variant="outline" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un dossier
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Accès rapide</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Link href="/compliance/trackers">
            <Button variant="outline" className="w-full min-h-[56px] justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Tous les dossiers
            </Button>
          </Link>
          <Link href="/compliance/action-items">
            <Button variant="outline" className="w-full min-h-[56px] justify-start">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Toutes les actions
            </Button>
          </Link>
          <Link href="/compliance/registre-personnel">
            <Button variant="outline" className="w-full min-h-[56px] justify-start">
              <Users className="mr-2 h-4 w-4" />
              Registre du personnel
            </Button>
          </Link>
          <Link href="/compliance/cdd">
            <Button variant="outline" className="w-full min-h-[56px] justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Suivi des CDD
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
