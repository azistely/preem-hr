/**
 * Edit Performance Cycle Page
 *
 * Allows editing cycle name, description, deadlines, and options.
 * Cannot change period dates once created.
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  Save,
  Info,
  Lock,
} from 'lucide-react';

export default function EditPerformanceCyclePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const cycleId = params.id as string;

  // Fetch cycle data
  const { data: cycle, isLoading, error } = api.performance.cycles.getById.useQuery(
    { id: cycleId },
    { enabled: !!cycleId }
  );

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    objectiveSettingDeadline: null as Date | null,
    selfEvaluationDeadline: null as Date | null,
    managerEvaluationDeadline: null as Date | null,
    calibrationDeadline: null as Date | null,
    resultsReleaseDate: null as Date | null,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: false,
    includeObjectives: true,
    includeCompetencies: true,
    includeCalibration: false,
  });

  // Populate form when data loads
  useEffect(() => {
    if (cycle) {
      setFormData({
        name: cycle.name,
        description: cycle.description || '',
        objectiveSettingDeadline: cycle.objectiveSettingDeadline ? new Date(cycle.objectiveSettingDeadline) : null,
        selfEvaluationDeadline: cycle.selfEvaluationDeadline ? new Date(cycle.selfEvaluationDeadline) : null,
        managerEvaluationDeadline: cycle.managerEvaluationDeadline ? new Date(cycle.managerEvaluationDeadline) : null,
        calibrationDeadline: cycle.calibrationDeadline ? new Date(cycle.calibrationDeadline) : null,
        resultsReleaseDate: cycle.resultsReleaseDate ? new Date(cycle.resultsReleaseDate) : null,
        includeSelfEvaluation: cycle.includeSelfEvaluation,
        includeManagerEvaluation: cycle.includeManagerEvaluation,
        includePeerFeedback: cycle.includePeerFeedback,
        includeObjectives: cycle.includeObjectives,
        includeCompetencies: cycle.includeCompetencies,
        includeCalibration: cycle.includeCalibration,
      });
    }
  }, [cycle]);

  // Update mutation
  const utils = api.useUtils();
  const updateCycle = api.performance.cycles.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Cycle mis à jour',
        description: 'Les modifications ont été enregistrées.',
      });
      utils.performance.cycles.getById.invalidate({ id: cycleId });
      router.push(`/performance/cycles/${cycleId}`);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateCycle.mutate({
      id: cycleId,
      name: formData.name,
      description: formData.description || undefined,
      objectiveSettingDeadline: formData.objectiveSettingDeadline?.toISOString().split('T')[0] ?? null,
      selfEvaluationDeadline: formData.selfEvaluationDeadline?.toISOString().split('T')[0] ?? null,
      managerEvaluationDeadline: formData.managerEvaluationDeadline?.toISOString().split('T')[0] ?? null,
      calibrationDeadline: formData.calibrationDeadline?.toISOString().split('T')[0] ?? null,
      resultsReleaseDate: formData.resultsReleaseDate?.toISOString().split('T')[0] ?? null,
      includeSelfEvaluation: formData.includeSelfEvaluation,
      includeManagerEvaluation: formData.includeManagerEvaluation,
      includePeerFeedback: formData.includePeerFeedback,
      includeObjectives: formData.includeObjectives,
      includeCompetencies: formData.includeCompetencies,
      includeCalibration: formData.includeCalibration,
    });
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !cycle) {
    return (
      <div className="container max-w-3xl mx-auto py-6">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || 'Cycle non trouvé'}
          </AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  // Cannot edit closed cycles
  const isLocked = cycle.status === 'closed';

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Modifier le cycle</h1>
          <p className="text-muted-foreground">{cycle.name}</p>
        </div>
      </div>

      {isLocked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Ce cycle est clôturé et ne peut plus être modifié.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>Nom et description du cycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du cycle</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                disabled={isLocked}
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                disabled={isLocked}
                rows={3}
              />
            </div>

            {/* Period dates (read-only) */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Les dates de période ne peuvent pas être modifiées
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Début:</span>{' '}
                  <span className="font-medium">
                    {format(new Date(cycle.periodStart), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fin:</span>{' '}
                  <span className="font-medium">
                    {format(new Date(cycle.periodEnd), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Dates limites</CardTitle>
            <CardDescription>Définissez les échéances pour chaque étape</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Objective Setting Deadline */}
              <div className="space-y-2">
                <Label>Date limite objectifs</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                      disabled={isLocked}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.objectiveSettingDeadline
                        ? format(formData.objectiveSettingDeadline, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.objectiveSettingDeadline ?? undefined}
                      onSelect={(date) => updateFormData({ objectiveSettingDeadline: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Self Evaluation Deadline */}
              <div className="space-y-2">
                <Label>Date limite auto-évaluation</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                      disabled={isLocked}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.selfEvaluationDeadline
                        ? format(formData.selfEvaluationDeadline, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.selfEvaluationDeadline ?? undefined}
                      onSelect={(date) => updateFormData({ selfEvaluationDeadline: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Manager Evaluation Deadline */}
              <div className="space-y-2">
                <Label>Date limite évaluation manager</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                      disabled={isLocked}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.managerEvaluationDeadline
                        ? format(formData.managerEvaluationDeadline, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.managerEvaluationDeadline ?? undefined}
                      onSelect={(date) => updateFormData({ managerEvaluationDeadline: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Results Release Date */}
              <div className="space-y-2">
                <Label>Date de partage des résultats</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                      disabled={isLocked}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.resultsReleaseDate
                        ? format(formData.resultsReleaseDate, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.resultsReleaseDate ?? undefined}
                      onSelect={(date) => updateFormData({ resultsReleaseDate: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle>Étapes du cycle</CardTitle>
            <CardDescription>Activez ou désactivez les différentes étapes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={formData.includeSelfEvaluation}
                onCheckedChange={(checked) => updateFormData({ includeSelfEvaluation: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Auto-évaluation</span>
                  <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Les employés s'évaluent eux-mêmes
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={formData.includeManagerEvaluation}
                onCheckedChange={(checked) => updateFormData({ includeManagerEvaluation: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Évaluation manager</span>
                  <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Le manager évalue ses collaborateurs
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={formData.includePeerFeedback}
                onCheckedChange={(checked) => updateFormData({ includePeerFeedback: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <span className="font-medium">Feedback des pairs</span>
                <p className="text-sm text-muted-foreground">
                  Les collègues donnent leur avis
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={formData.includeObjectives}
                onCheckedChange={(checked) => updateFormData({ includeObjectives: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <span className="font-medium">Suivi des objectifs</span>
                <p className="text-sm text-muted-foreground">
                  Définir et suivre les objectifs des employés
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={formData.includeCompetencies}
                onCheckedChange={(checked) => updateFormData({ includeCompetencies: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Évaluation des compétences</span>
                  <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Évaluer les compétences associées au poste
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20">
              <Checkbox
                checked={formData.includeCalibration}
                onCheckedChange={(checked) => updateFormData({ includeCalibration: !!checked })}
                disabled={isLocked}
                className="mt-1"
              />
              <div>
                <span className="font-medium text-muted-foreground">Calibration</span>
                <p className="text-sm text-muted-foreground">
                  Session de revue pour harmoniser les notes
                </p>
                <Badge variant="outline" className="mt-1 text-xs">Grandes entreprises (50+ employés)</Badge>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isLocked || updateCycle.isPending || !formData.name.trim()}
            className="min-h-[56px] px-8"
          >
            {updateCycle.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
