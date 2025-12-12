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
} from 'lucide-react';
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

  const utils = api.useUtils();

  // Fetch evaluation
  const { data: evaluation, isLoading } = api.performance.evaluations.getById.useQuery(
    { id: evaluationId },
    { enabled: !!evaluationId }
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
    }
  }, [evaluation]);

  // Save draft mutation
  const saveDraft = api.performance.evaluations.saveDraft.useMutation({
    onSuccess: () => {
      toast.success('Brouillon enregistré');
      utils.performance.evaluations.getById.invalidate({ id: evaluationId });
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
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la soumission');
    },
  });

  // Save handler
  const handleSave = useCallback(() => {
    setIsSaving(true);
    saveDraft.mutate({
      id: evaluationId,
      responses: {},
      overallRating: overallRating.toString(),
    });
  }, [evaluationId, overallRating, saveDraft]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    submitEvaluation.mutate({
      id: evaluationId,
      responses: {},
      overallRating: overallRating.toString(),
      strengthsComment,
      improvementAreasComment,
      developmentPlanComment,
    });
  }, [evaluationId, overallRating, strengthsComment, improvementAreasComment, developmentPlanComment, submitEvaluation]);

  // Validation
  const canSubmit = overallRating > 0;
  const isEditable = evaluation?.status === 'pending' || evaluation?.status === 'in_progress';

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/performance/evaluations')}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux évaluations
        </Button>

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
