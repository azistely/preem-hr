'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/server/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  User,
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Archive,
  Play,
  Pencil,
  Trash2,
  Plus,
  BookOpen,
  TrendingUp,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DevelopmentGoal, RecommendedTraining } from '@/lib/db/schema/performance';

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: FileText },
  active: { label: 'En cours', color: 'bg-blue-100 text-blue-800', icon: Target },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-500', icon: Archive },
} as const;

const GOAL_STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
} as const;

const PRIORITY_CONFIG = {
  high: { label: 'Haute', color: 'bg-red-100 text-red-800' },
  medium: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Basse', color: 'bg-green-100 text-green-800' },
} as const;

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function DevelopmentPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DevelopmentGoal | null>(null);
  const [goalStatus, setGoalStatus] = useState<string>('');
  const [goalProgress, setGoalProgress] = useState<number>(0);
  const [goalNotes, setGoalNotes] = useState<string>('');

  // Data fetching
  const { data: plan, isLoading, refetch } = api.developmentPlans.getById.useQuery(
    { planId },
    { enabled: !!planId }
  );

  // Mutations
  const approveMutation = api.developmentPlans.approve.useMutation({
    onSuccess: () => {
      refetch();
      setApproveDialogOpen(false);
    },
  });

  const archiveMutation = api.developmentPlans.archive.useMutation({
    onSuccess: () => {
      router.push('/performance/development-plans');
    },
  });

  const updateGoalMutation = api.developmentPlans.updateGoal.useMutation({
    onSuccess: () => {
      refetch();
      setGoalDialogOpen(false);
      setSelectedGoal(null);
    },
  });

  // Handlers
  const handleOpenGoalDialog = (goal: DevelopmentGoal) => {
    setSelectedGoal(goal);
    setGoalStatus(goal.status);
    setGoalProgress(goal.progress);
    setGoalNotes(goal.notes ?? '');
    setGoalDialogOpen(true);
  };

  const handleUpdateGoal = async () => {
    if (!selectedGoal) return;
    await updateGoalMutation.mutateAsync({
      planId,
      goalId: selectedGoal.id,
      status: goalStatus as 'pending' | 'in_progress' | 'completed' | 'cancelled',
      progress: goalProgress,
      notes: goalNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Plan non trouvé</p>
            <Button
              variant="outline"
              onClick={() => router.push('/performance/development-plans')}
              className="mt-4"
            >
              Retour à la liste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = config?.icon ?? FileText;
  const goals = (plan.goals ?? []) as DevelopmentGoal[];
  const trainings = (plan.recommendedTrainings ?? []) as RecommendedTraining[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/performance/development-plans')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{plan.title}</h1>
              <Badge className={config?.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config?.label ?? plan.status}
              </Badge>
            </div>
            {plan.description && (
              <p className="text-muted-foreground mt-1">{plan.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {plan.status === 'draft' && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push(`/performance/development-plans/${planId}/edit`)}
                className="min-h-[44px]"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
              <Button
                onClick={() => setApproveDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Activer le plan
              </Button>
            </>
          )}
          {plan.status !== 'archived' && (
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(true)}
              className="min-h-[44px]"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archiver
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Employee Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Employé
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plan.employee ? (
              <div>
                <p className="font-medium text-lg">
                  {plan.employee.lastName} {plan.employee.firstName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.employee.employeeNumber}
                </p>
                {plan.employee.jobTitle && (
                  <p className="text-sm text-muted-foreground">{plan.employee.jobTitle}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Non disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Période
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Début</span>
                <span className="text-sm font-medium">
                  {plan.startDate
                    ? format(new Date(plan.startDate), 'dd MMM yyyy', { locale: fr })
                    : 'Non définie'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Échéance</span>
                <span className="text-sm font-medium">
                  {plan.targetEndDate
                    ? format(new Date(plan.targetEndDate), 'dd MMM yyyy', { locale: fr })
                    : 'Non définie'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{plan.progressPercentage ?? 0}%</div>
            <Progress value={plan.progressPercentage ?? 0} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {plan.completedGoals ?? 0} sur {plan.totalGoals ?? 0} objectifs terminés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Objectifs de développement
              </CardTitle>
              <CardDescription>
                Actions et objectifs à atteindre
              </CardDescription>
            </div>
            {plan.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => router.push(`/performance/development-plans/${planId}/edit`)}
                className="min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un objectif
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun objectif défini</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal, index) => {
                const goalConfig = GOAL_STATUS_CONFIG[goal.status as keyof typeof GOAL_STATUS_CONFIG];
                return (
                  <div
                    key={goal.id}
                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => plan.status !== 'archived' && handleOpenGoalDialog(goal)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Objectif {index + 1}</span>
                          <Badge className={goalConfig?.color} variant="outline">
                            {goalConfig?.label ?? goal.status}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{goal.description}</p>
                        {goal.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            Note: {goal.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm text-muted-foreground">
                          Échéance: {format(new Date(goal.targetDate), 'dd MMM yyyy', { locale: fr })}
                        </div>
                        <div className="mt-2 w-24">
                          <Progress value={goal.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Recommendations */}
      {trainings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Formations recommandées
            </CardTitle>
            <CardDescription>
              Formations suggérées pour le développement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trainings.map((training, index) => {
                const priorityConfig = PRIORITY_CONFIG[training.priority as keyof typeof PRIORITY_CONFIG];
                return (
                  <div
                    key={training.courseId || index}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium">{training.courseName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={priorityConfig?.color} variant="outline">
                          Priorité {priorityConfig?.label ?? training.priority}
                        </Badge>
                        {training.enrolled && (
                          <Badge className="bg-green-100 text-green-800">Inscrit</Badge>
                        )}
                        {training.completedAt && (
                          <Badge className="bg-blue-100 text-blue-800">
                            Terminé le {format(new Date(training.completedAt), 'dd/MM/yyyy')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competency Gaps */}
      {plan.competencyGaps && (plan.competencyGaps as Array<{
        competencyId: string;
        competencyName: string;
        currentLevel: number;
        requiredLevel: number;
        gap: number;
      }>).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Écarts de compétences
            </CardTitle>
            <CardDescription>
              Compétences à développer identifiées lors de l'évaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(plan.competencyGaps as Array<{
                competencyId: string;
                competencyName: string;
                currentLevel: number;
                requiredLevel: number;
                gap: number;
              }>).map((gap) => (
                <div key={gap.competencyId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{gap.competencyName}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-muted-foreground">
                        Actuel: {gap.currentLevel}/5
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Requis: {gap.requiredLevel}/5
                      </span>
                      <Badge
                        className={gap.gap > 1 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}
                      >
                        Écart: {gap.gap}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Section */}
      {(plan.managerNotes || plan.employeeNotes) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.managerNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes du manager</p>
                <p className="text-sm whitespace-pre-wrap">{plan.managerNotes}</p>
              </div>
            )}
            {plan.employeeNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes de l'employé</p>
                <p className="text-sm whitespace-pre-wrap">{plan.employeeNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linked Evaluation */}
      {plan.evaluation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Évaluation source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {plan.cycle?.name ?? 'Évaluation ad-hoc'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Soumise le {plan.evaluation.submittedAt
                    ? format(new Date(plan.evaluation.submittedAt), 'dd MMM yyyy', { locale: fr })
                    : 'Non soumise'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/performance/evaluations/${plan.evaluationId}`)}
                className="min-h-[44px]"
              >
                Voir l'évaluation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer le plan</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir activer ce plan de développement ?
              L'employé pourra alors commencer à suivre sa progression.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              onClick={() => approveMutation.mutateAsync({ planId })}
              disabled={approveMutation.isPending}
              className="min-h-[44px]"
            >
              {approveMutation.isPending ? 'Activation...' : 'Activer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archiver le plan</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir archiver ce plan de développement ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => archiveMutation.mutateAsync({ planId })}
              disabled={archiveMutation.isPending}
              className="min-h-[44px]"
            >
              {archiveMutation.isPending ? 'Archivage...' : 'Archiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre à jour l'objectif</DialogTitle>
            <DialogDescription>
              {selectedGoal?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Statut</label>
              <Select value={goalStatus} onValueChange={setGoalStatus}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Progression ({goalProgress}%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={goalProgress}
                onChange={(e) => setGoalProgress(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
                placeholder="Ajouter une note sur l'avancement..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGoalDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateGoal}
              disabled={updateGoalMutation.isPending}
              className="min-h-[44px]"
            >
              {updateGoalMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
