/**
 * Performance Management Dashboard
 *
 * Main dashboard for performance management module.
 * Shows:
 * - Active evaluation cycles
 * - Pending evaluations (for current user)
 * - Team performance summary (for managers)
 * - Quick actions
 *
 * Adapts based on user role:
 * - Employee: My evaluations, my objectives
 * - Manager: Team evaluations, team objectives
 * - HR: All cycles, all evaluations, analytics
 */

'use client';

import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  Target,
  ClipboardCheck,
  Users,
  TrendingUp,
  Calendar,
  MessageSquare,
  Plus,
  ChevronRight,
  Award,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Status badge colors
const cycleStatusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-800',
};

const cycleStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  in_progress: 'En cours',
  completed: 'Terminé',
  archived: 'Archivé',
};

const evaluationStatusLabels: Record<string, string> = {
  pending: 'En attente',
  self_review: 'Auto-évaluation',
  manager_review: 'Évaluation manager',
  submitted: 'Soumis',
  acknowledged: 'Accusé de réception',
};

export default function PerformanceDashboard() {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = api.performance.dashboard.stats.useQuery();

  // Fetch active cycles
  const { data: cyclesData, isLoading: cyclesLoading } = api.performance.cycles.list.useQuery({
    status: 'active',
    limit: 3,
  });
  const cycles = cyclesData?.data ?? [];

  // Fetch pending evaluations for current user (use list with myEvaluations flag)
  const { data: pendingEvalsData, isLoading: evalLoading } = api.performance.evaluations.list.useQuery({
    myEvaluations: true,
    status: 'pending',
    limit: 5,
  });
  const pendingEvaluations = pendingEvalsData?.data ?? [];

  // Fetch recent objectives (use list)
  const { data: objectivesData, isLoading: objLoading } = api.performance.objectives.list.useQuery({
    limit: 5,
  });
  const objectives = objectivesData?.data ?? [];

  // Fetch recent feedback (use list)
  const { data: feedbackData, isLoading: feedbackLoading } = api.performance.feedback.list.useQuery({
    limit: 5,
  });
  const feedback = feedbackData?.data ?? [];

  const isLoading = statsLoading || cyclesLoading || evalLoading || objLoading || feedbackLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion de la Performance</h1>
          <p className="text-muted-foreground">
            Evaluations, objectifs et developpement des competences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/performance/feedback/new">
              <MessageSquare className="mr-2 h-4 w-4" />
              Donner un feedback
            </Link>
          </Button>
          <Button asChild>
            <Link href="/performance/cycles/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau cycle
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cycles actifs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.activeCycles ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Évaluations en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mes évaluations</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.pendingEvaluations ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              En attente de complétion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objectifs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.activeObjectives ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Objectifs en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback reçu</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.feedbackThisMonth ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Ce mois-ci
            </p>
          </CardContent>
        </Card>
      </div>

      {/* eslint-disable @typescript-eslint/no-explicit-any */}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Cycles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cycles d&apos;évaluation</CardTitle>
              <CardDescription>Cycles actifs et à venir</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/performance/cycles">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {cyclesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : cycles && cycles.length > 0 ? (
              <div className="space-y-4">
                {cycles.map((cycle) => (
                  <Link
                    key={cycle.id}
                    href={`/performance/cycles/${cycle.id}`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{cycle.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {cycle.periodStart && cycle.periodEnd && (
                            <>
                              {format(new Date(cycle.periodStart), 'dd MMM yyyy', { locale: fr })} - {format(new Date(cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}
                            </>
                          )}
                        </div>
                      </div>
                      <Badge className={cycleStatusColors[cycle.status] || 'bg-slate-100'}>
                        {cycleStatusLabels[cycle.status] || cycle.status}
                      </Badge>
                    </div>
                    {/* Progress bar if available */}
                    {cycle.status === 'in_progress' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progression</span>
                          <span>45%</span>
                        </div>
                        <Progress value={45} className="h-2" />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun cycle actif</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/performance/cycles/new">Créer un cycle</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Evaluations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mes évaluations</CardTitle>
              <CardDescription>Évaluations à compléter</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/performance/evaluations">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {evalLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingEvaluations && pendingEvaluations.length > 0 ? (
              <div className="space-y-3">
                {pendingEvaluations.map((evaluation) => (
                  <Link
                    key={evaluation.id}
                    href={`/performance/evaluations/${evaluation.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {evaluation.status === 'self_review' ? 'Auto-évaluation' : 'Évaluation'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {evaluationStatusLabels[evaluation.status] || evaluation.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {evaluation.cycle?.periodEnd && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(evaluation.cycle.periodEnd), { addSuffix: true, locale: fr })}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune évaluation en attente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vous serez notifié lorsqu&apos;un cycle démarre
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objectives */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mes objectifs</CardTitle>
              <CardDescription>Suivi de vos objectifs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/performance/objectives">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {objLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : objectives && objectives.length > 0 ? (
              <div className="space-y-3">
                {objectives.map((objective) => (
                  <div
                    key={objective.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium">{objective.title}</div>
                      <Badge variant="outline">
                        {objective.objectiveType === 'individual' ? 'Individuel' :
                         objective.objectiveType === 'team' ? 'Équipe' : 'Entreprise'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span>{objective.status === 'completed' ? 'Atteint' : 'En cours'}</span>
                      </div>
                      {objective.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(objective.dueDate), 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                    {/* Progress if available */}
                    {objective.status !== 'completed' && (
                      <div className="mt-2">
                        <Progress value={30} className="h-2" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun objectif défini</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/performance/objectives/new">Créer un objectif</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Feedback */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Feedback récent</CardTitle>
              <CardDescription>Feedback et reconnaissance reçus</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/performance/feedback">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feedbackLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : feedback && feedback.length > 0 ? (
              <div className="space-y-3">
                {feedback.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        item.feedbackType === 'recognition' ? 'bg-green-100' :
                        item.feedbackType === 'improvement' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {item.feedbackType === 'recognition' ? (
                          <Award className="h-4 w-4 text-green-600" />
                        ) : item.feedbackType === 'improvement' ? (
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{item.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.createdAt && formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun feedback reçu</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Les feedbacks de vos collègues apparaîtront ici
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions for HR */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>Gérer les évaluations et le développement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/performance/cycles/new">
                <Plus className="h-5 w-5" />
                <span>Créer un cycle</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/performance/objectives">
                <Target className="h-5 w-5" />
                <span>Gérer les objectifs</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/performance/feedback/new">
                <MessageSquare className="h-5 w-5" />
                <span>Donner un feedback</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/performance/settings/templates">
                <ClipboardCheck className="h-5 w-5" />
                <span>Modèles d&apos;évaluation</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
