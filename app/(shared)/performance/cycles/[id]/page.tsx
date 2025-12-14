/**
 * Performance Cycle Detail Page
 *
 * Shows cycle information, allows launching the cycle, and displays evaluation progress.
 * HR can manage the cycle, employees can view their assignments.
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Users,
  ClipboardCheck,
  Target,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  ChevronRight,
  Clock,
  AlertCircle,
  BarChart3,
  UserCheck,
  FileText,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

// Status badge colors
const statusColors: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  objective_setting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  calibration: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  closed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const statusLabels: Record<string, string> = {
  planning: 'Planification',
  objective_setting: 'Définition des objectifs',
  active: 'En cours',
  calibration: 'Calibration',
  closed: 'Clôturé',
};

const cycleTypeLabels: Record<string, string> = {
  annual: 'Évaluation annuelle',
  semi_annual: 'Évaluation semestrielle',
  quarterly: 'Évaluation trimestrielle',
};

// Evaluation status badges
const evaluationStatusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  shared: 'Partagé',
};

const evaluationStatusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  validated: 'bg-green-100 text-green-800',
  shared: 'bg-purple-100 text-purple-800',
};

export default function CycleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = params.id as string;
  const actionParam = searchParams.get('action'); // Support ?action=release from guide

  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(actionParam === 'release'); // Open share dialog if action=release
  const [selectedTab, setSelectedTab] = useState('overview');

  const utils = api.useUtils();

  // Fetch cycle details
  const { data: cycle, isLoading: cycleLoading } = api.performance.cycles.getById.useQuery(
    { id: cycleId },
    { enabled: !!cycleId }
  );

  // Fetch evaluations for this cycle
  const { data: evaluationsData, isLoading: evaluationsLoading } = api.performance.evaluations.list.useQuery(
    { cycleId, limit: 50 },
    { enabled: !!cycleId }
  );

  // Fetch objectives for this cycle
  const { data: objectivesData, isLoading: objectivesLoading } = api.performance.objectives.list.useQuery(
    { cycleId, limit: 50 },
    { enabled: !!cycleId }
  );

  // Fetch readiness checks for pre-launch validation (hard block per plan)
  const shouldFetchReadiness = cycle && (cycle.status === 'planning' || cycle.status === 'objective_setting');
  const { data: readinessData } = api.performance.getReadinessChecks.useQuery(
    { cycleId },
    { enabled: !!cycleId && !!shouldFetchReadiness }
  );

  // Mutations
  const launchCycle = api.performance.cycles.launch.useMutation({
    onSuccess: (data) => {
      toast.success(`Cycle lancé avec succès! ${data.evaluationsCreated} évaluations créées.`);
      setShowLaunchDialog(false);
      utils.performance.cycles.getById.invalidate({ id: cycleId });
      utils.performance.evaluations.list.invalidate({ cycleId });
      // Invalidate sidebar queries to reflect the launched state
      utils.performance.getGuideStatus.invalidate();
      utils.performance.getReadinessChecks.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du lancement du cycle');
    },
  });

  const updateStatus = api.performance.cycles.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      utils.performance.cycles.getById.invalidate({ id: cycleId });
      // Invalidate sidebar queries to reflect status change
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const deleteCycle = api.performance.cycles.delete.useMutation({
    onSuccess: () => {
      toast.success('Cycle supprimé');
      // Invalidate sidebar queries
      utils.performance.getGuideStatus.invalidate();
      router.push('/performance/cycles');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  // Release results mutation - mark cycle as closed and evaluations as shared
  const releaseResults = api.performance.cycles.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Resultats partages avec les employes');
      setShowShareDialog(false);
      utils.performance.cycles.getById.invalidate({ id: cycleId });
      utils.performance.evaluations.list.invalidate({ cycleId });
      utils.performance.getGuideStatus.invalidate();
      // Clear the action param from URL
      router.replace(`/performance/cycles/${cycleId}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du partage des resultats');
    },
  });

  if (cycleLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Cycle non trouvé</h3>
            <p className="text-muted-foreground mb-6">
              Ce cycle d'évaluation n'existe pas ou vous n'avez pas les droits d'accès.
            </p>
            <Button onClick={() => router.push('/performance/cycles')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const evaluations = evaluationsData?.data ?? [];
  const objectives = objectivesData?.data ?? [];
  const stats = cycle.stats;

  // Calculate progress
  const evaluationProgress = stats?.evaluations?.total
    ? Math.round((stats.evaluations.completed / stats.evaluations.total) * 100)
    : 0;

  const objectiveProgress = stats?.objectives?.total
    ? Math.round((stats.objectives.achieved / stats.objectives.total) * 100)
    : 0;

  // Group evaluations by type
  const selfEvaluations = evaluations.filter((e) => e.evaluationType === 'self');
  const managerEvaluations = evaluations.filter((e) => e.evaluationType === 'manager');

  // Status actions
  // Can launch when:
  // - Status check + objectives check (legacy)
  // - AND readiness checks pass (hard block per plan - competencies, employees, dates)
  const hasApprovedObjectives = objectives.filter(o => o.status === 'approved').length > 0;
  const needsObjectives = cycle.includeObjectives && !hasApprovedObjectives &&
    (cycle.status === 'planning' || cycle.status === 'objective_setting');
  const statusAllowsLaunch = cycle.includeObjectives
    ? cycle.status === 'objective_setting' && hasApprovedObjectives  // Must define objectives first
    : (cycle.status === 'planning' || cycle.status === 'objective_setting');
  // Hard block: readiness checks must pass (includes competencies, employees, dates, objectives)
  const readinessAllowsLaunch = readinessData?.canLaunch ?? false;
  // Can only launch if both status conditions AND readiness checks pass
  const canLaunch = statusAllowsLaunch && readinessAllowsLaunch;
  const failedReadinessChecks = readinessData?.checks.filter(c => c.status === 'failed') ?? [];
  const canDelete = cycle.status === 'planning';
  const canClose = cycle.status === 'active' || cycle.status === 'calibration';
  // Can share when all evaluations are complete (or at least cycle is active/calibration)
  const allEvaluationsComplete = evaluations.length > 0 &&
    evaluations.every(e => ['submitted', 'validated', 'shared'].includes(e.status));
  const canShareResults = (cycle.status === 'active' || cycle.status === 'calibration') && allEvaluationsComplete;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/performance/cycles')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux cycles
          </Button>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{cycle.name}</h1>
            <Badge className={statusColors[cycle.status]}>
              {statusLabels[cycle.status]}
            </Badge>
          </div>

          {cycle.description && (
            <p className="text-muted-foreground">{cycle.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(cycle.periodStart), 'dd MMM yyyy', { locale: fr })}
                {' - '}
                {format(new Date(cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{cycleTypeLabels[cycle.cycleType] || cycle.cycleType}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Button to go to objectives tab - shown when objectives need to be defined */}
          {needsObjectives && (
            <Button
              onClick={() => {
                // If still in planning, transition to objective_setting first
                if (cycle.status === 'planning') {
                  updateStatus.mutate({ id: cycleId, status: 'objective_setting' });
                }
                // Switch to objectives tab
                setSelectedTab('objectives');
              }}
              disabled={updateStatus.isPending}
              className="min-h-[48px]"
            >
              <Target className="mr-2 h-4 w-4" />
              Définir les objectifs
            </Button>
          )}

          {/* Launch button - hard blocked until ALL readiness checks pass */}
          {statusAllowsLaunch && (
            <div className="flex flex-col items-start gap-1">
              <Button
                onClick={() => setShowLaunchDialog(true)}
                className="min-h-[48px]"
                disabled={!canLaunch}
              >
                <Play className="mr-2 h-4 w-4" />
                {canLaunch ? 'Lancer le cycle' : 'Résoudre les problèmes'}
              </Button>
              {!canLaunch && failedReadinessChecks.length > 0 && (
                <span className="text-xs text-destructive">
                  {failedReadinessChecks.length} vérification{failedReadinessChecks.length > 1 ? 's' : ''} à résoudre
                </span>
              )}
            </div>
          )}

          {canShareResults && (
            <Button
              onClick={() => setShowShareDialog(true)}
              className="min-h-[48px] bg-green-600 hover:bg-green-700"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Partager les résultats
            </Button>
          )}

          {canClose && !canShareResults && (
            <Button
              variant="outline"
              onClick={() => updateStatus.mutate({ id: cycleId, status: 'closed' })}
              className="min-h-[48px]"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Clôturer
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => router.push(`/performance/cycles/${cycleId}/edit`)}
            className="min-h-[48px]"
          >
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>

          {canDelete && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="min-h-[48px] text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Évaluations</p>
                <p className="text-2xl font-bold">
                  {stats?.evaluations?.completed ?? 0}/{stats?.evaluations?.total ?? 0}
                </p>
              </div>
            </div>
            <Progress value={evaluationProgress} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto-évaluations</p>
                <p className="text-2xl font-bold">
                  {stats?.evaluations?.self ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Éval. manager</p>
                <p className="text-2xl font-bold">
                  {stats?.evaluations?.manager ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Objectifs</p>
                <p className="text-2xl font-bold">
                  {stats?.objectives?.achieved ?? 0}/{stats?.objectives?.total ?? 0}
                </p>
              </div>
            </div>
            <Progress value={objectiveProgress} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="min-h-[44px]">
            <BarChart3 className="mr-2 h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="min-h-[44px]">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Évaluations ({evaluations.length})
          </TabsTrigger>
          <TabsTrigger value="objectives" className="min-h-[44px]">
            <Target className="mr-2 h-4 w-4" />
            Objectifs ({objectives.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="min-h-[44px]">
            <Clock className="mr-2 h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendrier du cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <TimelineItem
                    label="Période d'évaluation"
                    date={`${format(new Date(cycle.periodStart), 'dd MMM yyyy', { locale: fr })} - ${format(new Date(cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}`}
                    status="active"
                  />
                  {cycle.objectiveSettingDeadline && (
                    <TimelineItem
                      label="Définition des objectifs"
                      date={format(new Date(cycle.objectiveSettingDeadline), 'dd MMM yyyy', { locale: fr })}
                      status={new Date(cycle.objectiveSettingDeadline) < new Date() ? 'completed' : 'pending'}
                    />
                  )}
                  {cycle.selfEvaluationDeadline && (
                    <TimelineItem
                      label="Auto-évaluation"
                      date={format(new Date(cycle.selfEvaluationDeadline), 'dd MMM yyyy', { locale: fr })}
                      status={new Date(cycle.selfEvaluationDeadline) < new Date() ? 'completed' : 'pending'}
                    />
                  )}
                  {cycle.managerEvaluationDeadline && (
                    <TimelineItem
                      label="Évaluation manager"
                      date={format(new Date(cycle.managerEvaluationDeadline), 'dd MMM yyyy', { locale: fr })}
                      status={new Date(cycle.managerEvaluationDeadline) < new Date() ? 'completed' : 'pending'}
                    />
                  )}
                  {cycle.calibrationDeadline && (
                    <TimelineItem
                      label="Calibration"
                      date={format(new Date(cycle.calibrationDeadline), 'dd MMM yyyy', { locale: fr })}
                      status={new Date(cycle.calibrationDeadline) < new Date() ? 'completed' : 'pending'}
                    />
                  )}
                  {cycle.resultsReleaseDate && (
                    <TimelineItem
                      label="Publication des résultats"
                      date={format(new Date(cycle.resultsReleaseDate), 'dd MMM yyyy', { locale: fr })}
                      status={new Date(cycle.resultsReleaseDate) < new Date() ? 'completed' : 'pending'}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Options enabled */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Options du cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <OptionRow
                    label="Auto-évaluation"
                    enabled={cycle.includeSelfEvaluation}
                  />
                  <OptionRow
                    label="Évaluation manager"
                    enabled={cycle.includeManagerEvaluation}
                  />
                  <OptionRow
                    label="Objectifs"
                    enabled={cycle.includeObjectives}
                  />
                  <OptionRow
                    label="Feedback des pairs"
                    enabled={cycle.includePeerFeedback}
                  />
                  <OptionRow
                    label="Feedback 360°"
                    enabled={cycle.include360Feedback}
                  />
                  <OptionRow
                    label="Calibration"
                    enabled={cycle.includeCalibration}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent evaluations */}
          {evaluations.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Évaluations récentes</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTab('evaluations')}
                >
                  Voir tout
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {evaluations.slice(0, 5).map((evaluation) => (
                    <div
                      key={evaluation.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium">
                            {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {evaluation.evaluationType === 'self'
                              ? 'Auto-évaluation'
                              : 'Évaluation manager'}
                          </p>
                        </div>
                      </div>
                      <Badge className={evaluationStatusColors[evaluation.status]}>
                        {evaluationStatusLabels[evaluation.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="space-y-4 mt-4">
          {evaluationsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : evaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune évaluation</h3>
                <p className="text-muted-foreground mb-6">
                  {canLaunch
                    ? 'Lancez le cycle pour créer les évaluations'
                    : 'Aucune évaluation n\'a encore été créée'}
                </p>
                {canLaunch && (
                  <Button onClick={() => setShowLaunchDialog(true)}>
                    <Play className="mr-2 h-4 w-4" />
                    Lancer le cycle
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Self evaluations */}
              {selfEvaluations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UserCheck className="h-5 w-5" />
                      Auto-évaluations ({selfEvaluations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selfEvaluations.map((evaluation) => (
                        <Link
                          key={evaluation.id}
                          href={`/performance/evaluations/${evaluation.id}`}
                        >
                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                            <div>
                              <p className="font-medium">
                                {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {evaluation.employee?.employeeNumber}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={evaluationStatusColors[evaluation.status]}>
                                {evaluationStatusLabels[evaluation.status]}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Manager evaluations */}
              {managerEvaluations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Évaluations manager ({managerEvaluations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {managerEvaluations.map((evaluation) => (
                        <Link
                          key={evaluation.id}
                          href={`/performance/evaluations/${evaluation.id}`}
                        >
                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                            <div>
                              <p className="font-medium">
                                {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {evaluation.employee?.employeeNumber}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={evaluationStatusColors[evaluation.status]}>
                                {evaluationStatusLabels[evaluation.status]}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Objectives Tab */}
        <TabsContent value="objectives" className="space-y-4 mt-4">
          {objectivesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun objectif</h3>
                <p className="text-muted-foreground mb-6">
                  Aucun objectif n'a été défini pour ce cycle
                </p>
                {cycle.includeObjectives && (
                  <Button onClick={() => router.push(`/performance/objectives/new?cycleId=${cycleId}`)}>
                    <Target className="mr-2 h-4 w-4" />
                    Ajouter un objectif
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {objectives.map((objective) => (
                <Card key={objective.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{objective.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {objective.objectiveLevel === 'company' && 'Entreprise'}
                            {objective.objectiveLevel === 'team' && 'Équipe'}
                            {objective.objectiveLevel === 'individual' && 'Individuel'}
                          </Badge>
                        </div>
                        {objective.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {objective.description}
                          </p>
                        )}
                        {objective.employee && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {objective.employee.firstName} {objective.employee.lastName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          className={
                            objective.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : objective.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {objective.status === 'draft' && 'Brouillon'}
                          {objective.status === 'proposed' && 'Proposé'}
                          {objective.status === 'approved' && 'Approuvé'}
                          {objective.status === 'in_progress' && 'En cours'}
                          {objective.status === 'completed' && 'Terminé'}
                          {objective.status === 'cancelled' && 'Annulé'}
                        </Badge>
                        {objective.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Échéance: {format(new Date(objective.dueDate), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Échéances</CardTitle>
              <CardDescription>
                Dates limites pour chaque phase du cycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <ConfigItem
                  label="Définition des objectifs"
                  value={
                    cycle.objectiveSettingDeadline
                      ? format(new Date(cycle.objectiveSettingDeadline), 'dd MMMM yyyy', { locale: fr })
                      : 'Non défini'
                  }
                />
                <ConfigItem
                  label="Auto-évaluation"
                  value={
                    cycle.selfEvaluationDeadline
                      ? format(new Date(cycle.selfEvaluationDeadline), 'dd MMMM yyyy', { locale: fr })
                      : 'Non défini'
                  }
                />
                <ConfigItem
                  label="Évaluation manager"
                  value={
                    cycle.managerEvaluationDeadline
                      ? format(new Date(cycle.managerEvaluationDeadline), 'dd MMMM yyyy', { locale: fr })
                      : 'Non défini'
                  }
                />
                <ConfigItem
                  label="Calibration"
                  value={
                    cycle.calibrationDeadline
                      ? format(new Date(cycle.calibrationDeadline), 'dd MMMM yyyy', { locale: fr })
                      : 'Non défini'
                  }
                />
                <ConfigItem
                  label="Publication des résultats"
                  value={
                    cycle.resultsReleaseDate
                      ? format(new Date(cycle.resultsReleaseDate), 'dd MMMM yyyy', { locale: fr })
                      : 'Non défini'
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations techniques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <ConfigItem label="ID du cycle" value={cycle.id} />
                <ConfigItem
                  label="Profil entreprise"
                  value={
                    cycle.companySizeProfile === 'small'
                      ? 'Petite (< 50)'
                      : cycle.companySizeProfile === 'medium'
                      ? 'Moyenne (50-200)'
                      : cycle.companySizeProfile === 'large'
                      ? 'Grande (> 200)'
                      : 'Non défini'
                  }
                />
                <ConfigItem
                  label="Créé le"
                  value={format(new Date(cycle.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                />
                <ConfigItem
                  label="Modifié le"
                  value={format(new Date(cycle.updatedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Launch Dialog */}
      <Dialog open={showLaunchDialog} onOpenChange={setShowLaunchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lancer le cycle d'évaluation</DialogTitle>
            <DialogDescription>
              Cette action va créer les évaluations pour tous les employés actifs.
              Les employés et managers recevront une notification.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm">
                <strong>Options activées:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {cycle.includeSelfEvaluation && <li>• Auto-évaluation</li>}
                {cycle.includeManagerEvaluation && <li>• Évaluation manager</li>}
                {cycle.includeObjectives && <li>• Objectifs</li>}
                {cycle.includePeerFeedback && <li>• Feedback des pairs</li>}
                {cycle.include360Feedback && <li>• Feedback 360°</li>}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLaunchDialog(false)}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={() => launchCycle.mutate({ id: cycleId })}
              disabled={launchCycle.isPending}
              className="min-h-[48px]"
            >
              {launchCycle.isPending ? 'Lancement...' : 'Confirmer le lancement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à ce cycle
              seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[48px]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCycle.mutate({ id: cycleId })}
              className="min-h-[48px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCycle.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Results Dialog */}
      <Dialog open={showShareDialog} onOpenChange={(open) => {
        setShowShareDialog(open);
        // Clear URL param when closing dialog
        if (!open && actionParam === 'release') {
          router.replace(`/performance/cycles/${cycleId}`);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-green-600" />
              Partager les résultats
            </DialogTitle>
            <DialogDescription>
              Les employés pourront voir leurs évaluations et les notes de leur manager.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-200">Prêt à partager</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Évaluations</p>
                  <p className="font-medium">{evaluations.length} terminées</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employés concernés</p>
                  <p className="font-medium">
                    {new Set(evaluations.map(e => e.employeeId)).size} personnes
                  </p>
                </div>
              </div>
            </div>

            {/* What happens */}
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">Ce qui va se passer:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Les employés recevront une notification</li>
                <li>• Ils pourront consulter leur évaluation complète</li>
                <li>• Le cycle sera marqué comme clôturé</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowShareDialog(false);
                if (actionParam === 'release') {
                  router.replace(`/performance/cycles/${cycleId}`);
                }
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={() => releaseResults.mutate({ id: cycleId, status: 'closed' })}
              disabled={releaseResults.isPending}
              className="min-h-[48px] bg-green-600 hover:bg-green-700"
            >
              <Share2 className="mr-2 h-4 w-4" />
              {releaseResults.isPending ? 'Partage en cours...' : 'Confirmer le partage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function TimelineItem({
  label,
  date,
  status,
}: {
  label: string;
  date: string;
  status: 'completed' | 'active' | 'pending';
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${
          status === 'completed'
            ? 'bg-green-500'
            : status === 'active'
            ? 'bg-blue-500'
            : 'bg-muted-foreground/30'
        }`}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      {status === 'completed' && (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      )}
    </div>
  );
}

function OptionRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      {enabled ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
