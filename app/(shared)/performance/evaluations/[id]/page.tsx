/**
 * Evaluation Detail Page
 *
 * Shows the evaluation form for completing or viewing an evaluation.
 * - For pending/in_progress evaluations: shows editable form
 * - For submitted evaluations: shows read-only view
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DetailPageSkeleton } from '@/components/skeletons';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  User,
  Briefcase,
  Save,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Target,
  Building,
  Users,
  TrendingUp,
  Award,
  Printer,
  ClipboardList,
  Eye,
  Timer,
  CalendarOff,
  GraduationCap,
  AlertTriangle,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { CompetencyRatingInput, type CompetencyRatingValue } from '@/components/performance/competency-rating-input';
import { isPercentageScale, type ProficiencyLevel } from '@/lib/constants/competency-scales';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

// Status badge styling
const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  validated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  shared: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  shared: 'Partagé',
};

const typeLabels: Record<string, string> = {
  self: 'Auto-évaluation',
  manager: 'Évaluation manager',
  peer: 'Évaluation pair',
  '360_report': 'Rapport 360°',
};

// Simple rating component
function RatingInput({
  value,
  onChange,
  max = 5,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => !disabled && onChange(rating)}
          disabled={disabled}
          className={`p-1 transition-colors ${
            disabled ? 'cursor-default' : 'cursor-pointer hover:text-yellow-400'
          }`}
        >
          <Star
            className={`h-6 w-6 ${
              rating <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Rating labels
const ratingLabels = [
  '',
  'Insuffisant',
  'À améliorer',
  'Satisfaisant',
  'Très bien',
  'Excellent',
];

// Objective level icons and labels
const levelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building,
  team: Users,
  individual: User,
};

const levelLabels: Record<string, string> = {
  company: 'Entreprise',
  team: 'Équipe',
  individual: 'Individuel',
};

const levelColors: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  team: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  individual: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

// Objective score type
type ObjectiveScore = {
  objectiveId: string;
  score: number; // 0-100
  comment: string;
};

// Competency rating type for form state
type CompetencyRating = {
  competencyId: string;
  rating: number;
  comment: string;
  expectedLevel?: number;
  maxLevel: number;
};

export default function EvaluationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = params.id as string;

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [overallRating, setOverallRating] = useState(0);
  const [strengthsComment, setStrengthsComment] = useState('');
  const [improvementAreasComment, setImprovementAreasComment] = useState('');
  const [developmentPlanComment, setDevelopmentPlanComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [objectiveScores, setObjectiveScores] = useState<Record<string, ObjectiveScore>>({});
  const [competencyRatings, setCompetencyRatings] = useState<Record<string, CompetencyRating>>({});
  const [objectivesExpanded, setObjectivesExpanded] = useState(true);
  const [competenciesExpanded, setCompetenciesExpanded] = useState(true);
  const [contextExpanded, setContextExpanded] = useState(true);

  const utils = api.useUtils();

  // Fetch evaluation
  const { data: evaluation, isLoading } = api.performance.evaluations.getById.useQuery(
    { id: evaluationId },
    { enabled: !!evaluationId }
  );

  // Get employee ID and evaluation period for context queries
  const employeeId = evaluation?.employee?.id;
  const periodStart = evaluation?.cycle?.periodStart;
  const periodEnd = evaluation?.cycle?.periodEnd;

  // Fallback dates for time tracking: use hire date from evaluation join if no period, current date as end
  const timeTrackingStartDate = periodStart ?? evaluation?.employee?.hireDate;
  const timeTrackingEndDate = periodEnd ?? new Date().toISOString();

  // Fetch observations for the employee during the evaluation period
  const { data: observationsData } = api.observations.list.useQuery(
    {
      employeeId: employeeId!,
      dateFrom: periodStart ?? undefined,
      dateTo: periodEnd ?? undefined,
      limit: 50,
    },
    { enabled: !!employeeId }
  );

  // Fetch time off taken during the evaluation period
  const { data: timeOffData } = api.timeOff.getEmployeeRequests.useQuery(
    {
      employeeId: employeeId!,
    },
    { enabled: !!employeeId }
  );

  // Fetch training completed
  const { data: trainingData } = api.training.enrollments.list.useQuery(
    {
      employeeId: employeeId!,
      status: 'completed',
      limit: 20,
    },
    { enabled: !!employeeId }
  );

  // Fetch work accidents for the employee
  const { data: accidentsData } = api.complianceTrackers.list.useQuery(
    {
      employeeId: employeeId!,
      typeSlug: 'accidents',
      limit: 20,
    },
    { enabled: !!employeeId }
  );

  // Fetch time entries (uses hire date as fallback if no evaluation period)
  const { data: timeEntriesData } = api.timeTracking.getEntries.useQuery(
    {
      employeeId: employeeId!,
      startDate: timeTrackingStartDate ? new Date(timeTrackingStartDate) : new Date(),
      endDate: timeTrackingEndDate ? new Date(timeTrackingEndDate) : new Date(),
    },
    { enabled: !!employeeId && !!timeTrackingStartDate }
  );

  // Fetch overtime summary (uses hire date as fallback if no evaluation period)
  const { data: overtimeData } = api.timeTracking.getOvertimeSummary.useQuery(
    {
      employeeId: employeeId!,
      periodStart: timeTrackingStartDate ? new Date(timeTrackingStartDate) : new Date(),
      periodEnd: timeTrackingEndDate ? new Date(timeTrackingEndDate) : new Date(),
    },
    { enabled: !!employeeId && !!timeTrackingStartDate }
  );

  // Pre-fill form with existing data when evaluation loads
  useEffect(() => {
    if (evaluation) {
      if (evaluation.overallRating) {
        setOverallRating(parseInt(evaluation.overallRating) || 0);
      }
      if (evaluation.strengthsComment) setStrengthsComment(evaluation.strengthsComment);
      if (evaluation.improvementAreasComment) setImprovementAreasComment(evaluation.improvementAreasComment);
      if (evaluation.developmentPlanComment) setDevelopmentPlanComment(evaluation.developmentPlanComment);
      if (evaluation.generalComment) setGeneralComment(evaluation.generalComment);

      // Initialize objective scores from loaded data
      if (evaluation.objectiveScores && evaluation.objectiveScores.length > 0) {
        const initialScores: Record<string, ObjectiveScore> = {};
        evaluation.objectiveScores.forEach(score => {
          initialScores[score.objectiveId] = {
            objectiveId: score.objectiveId,
            score: score.score,
            comment: score.comment ?? '',
          };
        });
        setObjectiveScores(initialScores);
      }

      // Initialize competency ratings from loaded data
      if (evaluation.competencyRatings && evaluation.competencyRatings.length > 0 && evaluation.positionCompetencies) {
        const initialRatings: Record<string, CompetencyRating> = {};
        evaluation.competencyRatings.forEach(rating => {
          // Find the position competency to get maxLevel
          const posCompetency = evaluation.positionCompetencies?.find(pc => pc.competency.id === rating.competencyId);
          const proficiencyLevels = posCompetency?.proficiencyLevels ?? [];
          const maxLevel = proficiencyLevels.length > 0
            ? Math.max(...proficiencyLevels.map(l => l.level))
            : 5;

          initialRatings[rating.competencyId] = {
            competencyId: rating.competencyId,
            rating: rating.rating,
            comment: rating.comment ?? '',
            expectedLevel: rating.expectedLevel ?? undefined,
            maxLevel,
          };
        });
        setCompetencyRatings(initialRatings);
      }
    }
  }, [evaluation]);

  // Create map for self-evaluation scores (for manager evaluations)
  const selfEvalScoresMap = new Map(
    (evaluation?.selfEvalObjectiveScores ?? []).map(s => [s.objectiveId, s])
  );

  // Save draft mutation
  const saveDraft = api.performance.evaluations.saveDraft.useMutation({
    onSuccess: () => {
      toast.success('Brouillon enregistré');
      utils.performance.evaluations.getById.invalidate({ id: evaluationId });
      utils.performance.getGuideStatus.invalidate();
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
      setIsSaving(false);
    },
  });

  // Submit mutation
  const submitEvaluation = api.performance.evaluations.submit.useMutation({
    onSuccess: () => {
      toast.success('Évaluation soumise avec succès');
      setShowSubmitDialog(false);
      utils.performance.evaluations.getById.invalidate({ id: evaluationId });
      utils.performance.evaluations.list.invalidate();
      // Invalidate sidebar queries to reflect updated progress
      utils.performance.getGuideStatus.invalidate();
      // Redirect to evaluations list
      router.push('/performance/evaluations');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la soumission');
    },
  });

  // Create IDP from evaluation
  const createIdpMutation = api.developmentPlans.createFromEvaluation.useMutation({
    onSuccess: (data) => {
      toast.success('Plan de développement créé');
      router.push(`/performance/development-plans/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création du plan');
    },
  });

  // Update objective score
  const updateObjectiveScore = useCallback((objectiveId: string, score: number, comment: string = '') => {
    setObjectiveScores(prev => ({
      ...prev,
      [objectiveId]: { objectiveId, score, comment },
    }));
  }, []);

  // Update competency rating
  const updateCompetencyRating = useCallback((
    competencyId: string,
    value: CompetencyRatingValue,
    expectedLevel: number | undefined,
    maxLevel: number
  ) => {
    setCompetencyRatings(prev => ({
      ...prev,
      [competencyId]: {
        competencyId,
        rating: value.rating,
        comment: value.comment,
        expectedLevel,
        maxLevel,
      },
    }));
  }, []);

  // Calculate average objective score (weighted if weights exist)
  const calculateObjectivesScore = useCallback(() => {
    const objectives = evaluation?.objectives ?? [];
    if (objectives.length === 0) return null;

    const scoredObjectives = objectives.filter(obj => objectiveScores[obj.id]?.score !== undefined);
    if (scoredObjectives.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    scoredObjectives.forEach(obj => {
      const weight = obj.weight ? parseFloat(obj.weight) : 1;
      const score = objectiveScores[obj.id]?.score ?? 0;
      weightedSum += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  }, [evaluation?.objectives, objectiveScores]);

  const objectivesAverageScore = calculateObjectivesScore();

  // Save handler
  const handleSave = useCallback(() => {
    setIsSaving(true);
    saveDraft.mutate({
      id: evaluationId,
      responses: { objectiveScores },
      overallRating: overallRating.toString(),
    });
  }, [evaluationId, overallRating, objectiveScores, saveDraft]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    // Convert objectiveScores from Record to Array
    const objectiveScoresArray = Object.values(objectiveScores).map(score => ({
      objectiveId: score.objectiveId,
      score: score.score,
      comment: score.comment || undefined,
    }));

    // Convert competencyRatings from Record to Array
    const competencyRatingsArray = Object.values(competencyRatings).map(rating => ({
      competencyId: rating.competencyId,
      rating: rating.rating,
      comment: rating.comment || undefined,
      expectedLevel: rating.expectedLevel,
      maxLevel: rating.maxLevel,
    }));

    submitEvaluation.mutate({
      id: evaluationId,
      responses: { objectiveScores }, // Keep for backward compatibility
      overallRating: overallRating.toString(),
      overallScore: objectivesAverageScore?.toString(),
      strengthsComment,
      improvementAreasComment,
      developmentPlanComment,
      objectiveScores: objectiveScoresArray.length > 0 ? objectiveScoresArray : undefined,
      competencyRatings: competencyRatingsArray.length > 0 ? competencyRatingsArray : undefined,
    });
  }, [evaluationId, overallRating, objectiveScores, objectivesAverageScore, strengthsComment, improvementAreasComment, developmentPlanComment, competencyRatings, submitEvaluation]);

  // Validation
  const canSubmit = overallRating > 0;
  const isEditable = evaluation?.status === 'pending' || evaluation?.status === 'in_progress';
  const hasObjectives = (evaluation?.objectives?.length ?? 0) > 0;
  const hasCompetencies = (evaluation?.positionCompetencies?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="container max-w-3xl mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Évaluation non trouvée</h3>
            <p className="text-muted-foreground mb-6">
              Cette évaluation n'existe pas ou vous n'avez pas les droits d'accès.
            </p>
            <Button onClick={() => router.push('/performance/evaluations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux évaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/performance/evaluations')}
            className="-ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux évaluations
          </Button>
          <div className="flex gap-2">
            {evaluation.status === 'submitted' || evaluation.status === 'validated' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => createIdpMutation.mutate({ evaluationId })}
                disabled={createIdpMutation.isPending}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                {createIdpMutation.isPending ? 'Création...' : 'Créer un plan'}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/performance/evaluations/${evaluationId}/print`)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">
                {typeLabels[evaluation.evaluationType]}
              </h1>
              <Badge className={statusColors[evaluation.status]}>
                {statusLabels[evaluation.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {evaluation.cycle?.name}
            </p>
          </div>

          {isEditable && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                className="min-h-[48px]"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={!canSubmit}
                className="min-h-[48px]"
              >
                <Send className="mr-2 h-4 w-4" />
                Soumettre
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employé évalué</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                {evaluation.employee?.firstName} {evaluation.employee?.lastName}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                {evaluation.employee?.employeeNumber && (
                  <span>{evaluation.employee.employeeNumber}</span>
                )}
                {evaluation.employee?.jobTitle && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>{evaluation.employee.jobTitle}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Period */}
      {evaluation.cycle && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Période:{' '}
                {format(new Date(evaluation.cycle.periodStart), 'dd MMM yyyy', { locale: fr })}
                {' - '}
                {format(new Date(evaluation.cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Context Section - Observations, Time Off, Training */}
      <Collapsible open={contextExpanded} onOpenChange={setContextExpanded}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Contexte de l'employé
                </CardTitle>
                {(observationsData?.total ?? 0) > 0 && (
                  <Badge variant="secondary">
                    {observationsData?.total} observation{(observationsData?.total ?? 0) > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {contextExpanded ? (
                    <>
                      Réduire
                      <ChevronUp className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Voir le contexte
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CardDescription>
              Données collectées pendant la période d'évaluation pour aider à l'évaluation
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Observations Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Observations KPI</span>
                </div>
                {(observationsData?.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucune observation enregistrée pour cette période
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {/* Show summary stats if available */}
                    {observationsData?.data && observationsData.data.length > 0 && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-2xl font-bold">{observationsData.total}</p>
                            <p className="text-xs text-muted-foreground">Observations</p>
                          </div>
                          {/* Calculate average scores from observations */}
                          {(() => {
                            const obs = observationsData.data;
                            type ObsType = typeof obs[number];
                            const avgQuality = obs.reduce((sum: number, o: ObsType) => sum + ((o.kpiData as Record<string, number | undefined>)?.qualityScore ?? 0), 0) / obs.length;
                            const avgSafety = obs.reduce((sum: number, o: ObsType) => sum + ((o.kpiData as Record<string, number | undefined>)?.safetyScore ?? 0), 0) / obs.length;
                            const avgTeamwork = obs.reduce((sum: number, o: ObsType) => sum + ((o.kpiData as Record<string, number | undefined>)?.teamworkScore ?? 0), 0) / obs.length;
                            return (
                              <>
                                {avgQuality > 0 && (
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-2xl font-bold">{avgQuality.toFixed(1)}/5</p>
                                    <p className="text-xs text-muted-foreground">Qualité moy.</p>
                                  </div>
                                )}
                                {avgSafety > 0 && (
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-2xl font-bold">{avgSafety.toFixed(1)}/5</p>
                                    <p className="text-xs text-muted-foreground">Sécurité moy.</p>
                                  </div>
                                )}
                                {avgTeamwork > 0 && (
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-2xl font-bold">{avgTeamwork.toFixed(1)}/5</p>
                                    <p className="text-xs text-muted-foreground">Travail équipe</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* Show recent observations */}
                        <div className="space-y-2 mt-3">
                          <p className="text-xs font-medium text-muted-foreground">Observations récentes:</p>
                          {observationsData.data.slice(0, 5).map((obs) => {
                            const kpiData = obs.kpiData as Record<string, number | boolean | undefined> | null;
                            return (
                              <div key={obs.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                <span>{format(new Date(obs.observationDate), 'dd MMM yyyy', { locale: fr })}</span>
                                <div className="flex items-center gap-2">
                                  {kpiData?.qualityScore && (
                                    <Badge variant="outline" className="text-xs">
                                      Qualité: {kpiData.qualityScore}/5
                                    </Badge>
                                  )}
                                  {kpiData?.incidentReported && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Incident
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Time Off Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Congés et absences</span>
                </div>
                {(timeOffData?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucun congé pendant cette période
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {timeOffData?.slice(0, 5).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{req.timeOffPolicy?.name ?? 'Congé'}</Badge>
                          <span>
                            {format(new Date(req.startDate), 'dd MMM', { locale: fr })} - {format(new Date(req.endDate), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </div>
                        <Badge variant={req.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                          {req.status === 'approved' ? 'Approuvé' : req.status === 'pending' ? 'En attente' : req.status}
                        </Badge>
                      </div>
                    ))}
                    {(timeOffData?.length ?? 0) > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {(timeOffData?.length ?? 0) - 5} autres congés
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Time Entries & Overtime Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Temps de travail</span>
                  {!periodStart && timeTrackingStartDate && (
                    <Badge variant="outline" className="text-xs">
                      Depuis l'embauche
                    </Badge>
                  )}
                </div>
                {!timeTrackingStartDate ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucune date de référence disponible
                  </p>
                ) : (timeEntriesData?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucune pointage enregistré pour cette période
                  </p>
                ) : (
                  <div className="space-y-3 pl-6">
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold">{timeEntriesData?.length ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Pointages</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold">
                          {timeEntriesData?.reduce((sum, entry) => sum + (parseFloat(entry.totalHours ?? '0') || 0), 0).toFixed(1)}h
                        </p>
                        <p className="text-xs text-muted-foreground">Heures totales</p>
                      </div>
                      {overtimeData && (overtimeData.totalOvertimeHours ?? 0) > 0 && (
                        <>
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                            <p className="text-2xl font-bold text-amber-600">
                              {(overtimeData.totalOvertimeHours ?? 0).toFixed(1)}h
                            </p>
                            <p className="text-xs text-muted-foreground">Heures sup.</p>
                          </div>
                          {overtimeData.breakdown && (
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <p className="text-lg font-bold">
                                {Object.keys(overtimeData.breakdown).length}
                              </p>
                              <p className="text-xs text-muted-foreground">Types d'HS</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Overtime breakdown if exists */}
                    {overtimeData && overtimeData.breakdown && Object.keys(overtimeData.breakdown).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Détail heures supplémentaires:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(overtimeData.breakdown).map(([type, hours]) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}: {typeof hours === 'number' ? hours.toFixed(1) : hours}h
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent entries */}
                    {timeEntriesData && timeEntriesData.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Pointages récents:</p>
                        {timeEntriesData.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{format(new Date(entry.clockIn), 'dd MMM', { locale: fr })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {format(new Date(entry.clockIn), 'HH:mm')}
                                {entry.clockOut && ` - ${format(new Date(entry.clockOut), 'HH:mm')}`}
                              </span>
                              <Badge
                                variant={entry.status === 'approved' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {entry.totalHours ? `${parseFloat(entry.totalHours).toFixed(1)}h` : 'En cours'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {timeEntriesData.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            + {timeEntriesData.length - 5} autres pointages
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Training Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Formations complétées</span>
                </div>
                {(trainingData?.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucune formation complétée pendant cette période
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {trainingData?.data?.slice(0, 5).map((enrollment) => (
                      <div key={enrollment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>{enrollment.course?.name ?? 'Formation'}</span>
                        </div>
                        {enrollment.completedAt && (
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(enrollment.completedAt), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                      </div>
                    ))}
                    {(trainingData?.data?.length ?? 0) > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {(trainingData?.data?.length ?? 0) - 5} autres formations
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Work Accidents Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Accidents du travail</span>
                  {(accidentsData?.total ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {accidentsData?.total}
                    </Badge>
                  )}
                </div>
                {(accidentsData?.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    Aucun accident du travail déclaré
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {accidentsData?.data?.slice(0, 5).map((accident) => (
                      <div key={accident.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="truncate max-w-[200px]">{accident.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={accident.status === 'cloture' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {accident.status === 'cloture' ? 'Clôturé' :
                             accident.status === 'nouveau' ? 'Nouveau' :
                             accident.status === 'analyse' ? 'Analyse' :
                             accident.status === 'plan_action' ? 'Plan d\'action' :
                             accident.status}
                          </Badge>
                          {accident.createdAt && (
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(accident.createdAt), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(accidentsData?.data?.length ?? 0) > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {(accidentsData?.data?.length ?? 0) - 5} autres accidents
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Objectives Section */}
      {hasObjectives && (
        <Collapsible open={objectivesExpanded} onOpenChange={setObjectivesExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Objectifs à évaluer
                  </CardTitle>
                  <Badge variant="secondary">
                    {evaluation.objectives?.length} objectif{(evaluation.objectives?.length ?? 0) > 1 ? 's' : ''}
                  </Badge>
                  {objectivesAverageScore !== null && (
                    <Badge variant={objectivesAverageScore >= 70 ? 'default' : objectivesAverageScore >= 50 ? 'secondary' : 'destructive'}>
                      Score moyen: {objectivesAverageScore}%
                    </Badge>
                  )}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {objectivesExpanded ? (
                      <>
                        Réduire
                        <ChevronUp className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Voir les objectifs
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CardDescription>
                {evaluation.evaluationType === 'self'
                  ? 'Évaluez votre propre atteinte de chaque objectif (0-100%)'
                  : 'Évaluez l\'atteinte de chaque objectif par l\'employé (0-100%)'}
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Group objectives by level */}
                {['company', 'team', 'individual'].map(level => {
                  const levelObjectives = evaluation.objectives?.filter(o => o.objectiveLevel === level) ?? [];
                  if (levelObjectives.length === 0) return null;

                  const LevelIcon = levelIcons[level] || Target;

                  return (
                    <div key={level} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${levelColors[level]}`}>
                          <LevelIcon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm">{levelLabels[level]}</span>
                        <Badge variant="outline" className="text-xs">
                          {levelObjectives.length}
                        </Badge>
                      </div>

                      <div className="space-y-3 pl-8">
                        {levelObjectives.map(objective => {
                          const currentScore = objectiveScores[objective.id]?.score;
                          const hasScore = currentScore !== undefined;

                          return (
                            <div
                              key={objective.id}
                              className="p-4 border rounded-lg space-y-3 bg-card hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{objective.title}</h4>
                                    {objective.weight && (
                                      <Badge variant="outline" className="text-xs">
                                        Poids: {objective.weight}%
                                      </Badge>
                                    )}
                                  </div>
                                  {objective.description && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {objective.description}
                                    </p>
                                  )}
                                  {objective.targetValue && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <TrendingUp className="h-3 w-3" />
                                      <span>
                                        Cible: {objective.targetValue}
                                        {objective.targetUnit && ` ${objective.targetUnit}`}
                                        {objective.currentValue && (
                                          <span className="text-foreground font-medium">
                                            {' '}• Actuel: {objective.currentValue}
                                            {objective.targetUnit && ` ${objective.targetUnit}`}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Score input */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                  <Label className="text-sm whitespace-nowrap">
                                    Score d'atteinte
                                  </Label>
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={currentScore ?? ''}
                                      onChange={(e) => {
                                        const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                        updateObjectiveScore(objective.id, value);
                                      }}
                                      disabled={!isEditable}
                                      placeholder="0-100"
                                      className="w-24 min-h-[44px]"
                                    />
                                    <span className="text-sm text-muted-foreground">%</span>
                                    {hasScore && (
                                      <Progress
                                        value={currentScore}
                                        className="flex-1 h-2"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 pl-[100px]">
                                  {hasScore && (
                                    <p className="text-xs text-muted-foreground">
                                      {currentScore >= 90 ? '🌟 Excellent' :
                                       currentScore >= 70 ? '✅ Atteint' :
                                       currentScore >= 50 ? '⚠️ Partiellement atteint' :
                                       '❌ Non atteint'}
                                    </p>
                                  )}
                                  {/* Show self-evaluation score for manager evaluations */}
                                  {evaluation.evaluationType === 'manager' && selfEvalScoresMap.has(objective.id) && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded">
                                      <User className="h-3 w-3" />
                                      <span>Auto-évaluation: {selfEvalScoresMap.get(objective.id)?.score}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Summary */}
                {objectivesAverageScore !== null && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Score moyen des objectifs</span>
                      <div className="flex items-center gap-2">
                        <Progress value={objectivesAverageScore} className="w-32 h-3" />
                        <span className="font-bold text-lg">{objectivesAverageScore}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Competencies Section */}
      {hasCompetencies && (
        <Collapsible open={competenciesExpanded} onOpenChange={setCompetenciesExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Compétences du poste
                  </CardTitle>
                  <Badge variant="secondary">
                    {evaluation?.positionCompetencies?.length} compétence{(evaluation?.positionCompetencies?.length ?? 0) > 1 ? 's' : ''}
                  </Badge>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {competenciesExpanded ? (
                      <>
                        Réduire
                        <ChevronUp className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Voir les compétences
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CardDescription>
                {evaluation?.evaluationType === 'self'
                  ? 'Évaluez votre niveau de maîtrise pour chaque compétence'
                  : 'Évaluez le niveau de maîtrise de l\'employé pour chaque compétence'}
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {evaluation?.positionCompetencies?.map((posCompetency) => {
                  const competency = posCompetency.competency;
                  const proficiencyLevels = posCompetency.proficiencyLevels as ProficiencyLevel[];
                  // Check if this is a percentage scale based on the proficiency levels
                  const isPercentage = proficiencyLevels.some(l => l.level === 100) && proficiencyLevels.length <= 5;
                  const maxLevel = isPercentage
                    ? 100
                    : proficiencyLevels.length > 0
                      ? Math.max(...proficiencyLevels.map(l => l.level))
                      : 5;

                  const currentRating = competencyRatings[competency.id];
                  // selfRating is the full competency_ratings row from position competencies
                  const selfRatingValue = posCompetency.selfRating?.rating;

                  return (
                    <CompetencyRatingInput
                      key={competency.id}
                      competency={{
                        id: competency.id,
                        name: competency.name,
                        description: competency.description,
                        category: competency.category,
                      }}
                      proficiencyLevels={proficiencyLevels}
                      requiredLevel={posCompetency.requiredLevel}
                      isCritical={posCompetency.isCritical}
                      value={currentRating ? { rating: currentRating.rating, comment: currentRating.comment } : undefined}
                      selfRating={selfRatingValue}
                      onChange={(value) => updateCompetencyRating(
                        competency.id,
                        value,
                        posCompetency.requiredLevel,
                        maxLevel
                      )}
                      evaluationType={evaluation.evaluationType as 'self' | 'manager'}
                      disabled={!isEditable}
                      isPercentageScale={isPercentage}
                    />
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Evaluation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Évaluation</CardTitle>
          <CardDescription>
            {isEditable
              ? 'Complétez l\'évaluation ci-dessous'
              : 'Cette évaluation a été soumise'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Rating */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Note globale <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-4">
              <RatingInput
                value={overallRating}
                onChange={setOverallRating}
                disabled={!isEditable}
              />
              {overallRating > 0 && (
                <span className="text-sm text-muted-foreground">
                  {ratingLabels[overallRating]}
                </span>
              )}
            </div>
          </div>

          <Separator />

          {/* Strengths */}
          <div className="space-y-2">
            <Label htmlFor="strengths" className="text-base font-medium">
              Points forts
            </Label>
            <Textarea
              id="strengths"
              placeholder="Quels sont les points forts de cet employé?"
              value={strengthsComment}
              onChange={(e) => setStrengthsComment(e.target.value)}
              disabled={!isEditable}
              className="min-h-[100px]"
            />
          </div>

          {/* Areas for improvement */}
          <div className="space-y-2">
            <Label htmlFor="improvement" className="text-base font-medium">
              Axes d'amélioration
            </Label>
            <Textarea
              id="improvement"
              placeholder="Quels aspects peuvent être améliorés?"
              value={improvementAreasComment}
              onChange={(e) => setImprovementAreasComment(e.target.value)}
              disabled={!isEditable}
              className="min-h-[100px]"
            />
          </div>

          {/* Development plan */}
          <div className="space-y-2">
            <Label htmlFor="development" className="text-base font-medium">
              Plan de développement
            </Label>
            <Textarea
              id="development"
              placeholder="Quelles actions de développement recommandez-vous?"
              value={developmentPlanComment}
              onChange={(e) => setDevelopmentPlanComment(e.target.value)}
              disabled={!isEditable}
              className="min-h-[100px]"
            />
          </div>

          {/* General comment */}
          <div className="space-y-2">
            <Label htmlFor="general" className="text-base font-medium">
              Commentaire général
            </Label>
            <Textarea
              id="general"
              placeholder="Autres commentaires..."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              disabled={!isEditable}
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submission info */}
      {evaluation.submittedAt && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                Soumis le {format(new Date(evaluation.submittedAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soumettre l'évaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              Une fois soumise, vous ne pourrez plus modifier cette évaluation.
              Assurez-vous que toutes les informations sont correctes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[48px]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitEvaluation.isPending}
              className="min-h-[48px]"
            >
              {submitEvaluation.isPending ? 'Soumission...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
