/**
 * Edit Performance Cycle Page
 *
 * Allows editing cycle name, description, deadlines, options, and templates.
 * Cannot change period dates once created.
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  FileText,
  Building2,
  ChevronDown,
  Plus,
  ExternalLink,
} from 'lucide-react';

// Type for template assignment (dept/position override)
interface TemplateAssignment {
  departmentId?: string;
  positionId?: string;
  evaluationType: 'self' | 'manager';
  templateId: string;
}

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

  // Fetch templates for selection
  const { data: templatesData } = api.hrForms.templates.list.useQuery({
    module: 'performance',
    limit: 100,
  });
  const templates = templatesData?.data ?? [];

  // Fetch departments for targeting
  const { data: departments } = api.performance.departments.list.useQuery({ status: 'active' });

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
    // Template fields
    selfEvaluationTemplateId: null as string | null,
    managerEvaluationTemplateId: null as string | null,
    templateAssignments: [] as TemplateAssignment[],
    useDepartmentTemplates: false,
  });

  // Collapsible state for department templates section
  const [deptTemplatesOpen, setDeptTemplatesOpen] = useState(false);

  // Populate form when data loads
  useEffect(() => {
    if (cycle) {
      // Parse existing template assignments to get default self/manager templates
      const existingAssignments = (cycle.templateAssignments as TemplateAssignment[] | null) ?? [];
      const selfDefault = existingAssignments.find(a => a.evaluationType === 'self' && !a.departmentId && !a.positionId);
      const managerDefault = existingAssignments.find(a => a.evaluationType === 'manager' && !a.departmentId && !a.positionId);

      // Check if there are any department-level overrides
      const hasDeptOverrides = existingAssignments.some(a => a.departmentId);

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
        selfEvaluationTemplateId: selfDefault?.templateId ?? cycle.evaluationTemplateId ?? null,
        managerEvaluationTemplateId: managerDefault?.templateId ?? cycle.evaluationTemplateId ?? null,
        templateAssignments: existingAssignments,
        useDepartmentTemplates: hasDeptOverrides,
      });

      if (hasDeptOverrides) {
        setDeptTemplatesOpen(true);
      }
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
      utils.performance.getGuideStatus.invalidate();
      utils.performance.getReadinessChecks.invalidate();
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

    // Build template assignments array
    const templateAssignments: TemplateAssignment[] = [];

    // Add default self-evaluation template (no dept/position)
    if (formData.selfEvaluationTemplateId) {
      templateAssignments.push({
        evaluationType: 'self',
        templateId: formData.selfEvaluationTemplateId,
      });
    }

    // Add default manager template (no dept/position)
    if (formData.managerEvaluationTemplateId) {
      templateAssignments.push({
        evaluationType: 'manager',
        templateId: formData.managerEvaluationTemplateId,
      });
    }

    // Add department-level overrides if enabled
    if (formData.useDepartmentTemplates) {
      const deptOverrides = formData.templateAssignments.filter(a => a.departmentId);
      templateAssignments.push(...deptOverrides);
    }

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
      evaluationTemplateId: formData.selfEvaluationTemplateId ?? null,
      templateAssignments: templateAssignments.length > 0 ? templateAssignments : null,
    });
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Helper to get/set department template override
  const getDeptTemplateId = (deptId: string, type: 'self' | 'manager'): string | null => {
    const assignment = formData.templateAssignments.find(
      a => a.departmentId === deptId && a.evaluationType === type
    );
    return assignment?.templateId ?? null;
  };

  const setDeptTemplate = (deptId: string, type: 'self' | 'manager', templateId: string | null) => {
    const newAssignments = formData.templateAssignments.filter(
      a => !(a.departmentId === deptId && a.evaluationType === type)
    );

    if (templateId) {
      newAssignments.push({
        departmentId: deptId,
        evaluationType: type,
        templateId,
      });
    }

    updateFormData({ templateAssignments: newAssignments });
  };

  // Filter templates by category
  const selfEvalTemplates = templates.filter(
    t => t.category === 'self_evaluation' || t.category === 'quick_checkin'
  );
  const managerEvalTemplates = templates.filter(
    t => t.category === 'manager_evaluation' || t.category === 'probation_review'
  );

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
  // Cannot edit templates after launch
  const isLaunched = cycle.status !== 'planning' && cycle.status !== 'objective_setting';

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

        {/* Templates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modèles d'évaluation
            </CardTitle>
            <CardDescription>
              Choisissez les questionnaires pour les évaluations
              {isLaunched && (
                <span className="block mt-1 text-amber-600">
                  Les modèles ne peuvent plus être modifiés après le lancement du cycle.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Self-evaluation template */}
            {formData.includeSelfEvaluation && (
              <div className="space-y-2">
                <Label>Modèle auto-évaluation</Label>
                <Select
                  value={formData.selfEvaluationTemplateId ?? 'none'}
                  onValueChange={(v) => updateFormData({ selfEvaluationTemplateId: v === 'none' ? null : v })}
                  disabled={isLocked || isLaunched}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Choisir un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun modèle (questions par défaut)</SelectItem>
                    {selfEvalTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                    {/* Show all templates if no self-eval specific ones */}
                    {selfEvalTemplates.length === 0 && templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manager evaluation template */}
            {formData.includeManagerEvaluation && (
              <div className="space-y-2">
                <Label>Modèle évaluation manager</Label>
                <Select
                  value={formData.managerEvaluationTemplateId ?? 'none'}
                  onValueChange={(v) => updateFormData({ managerEvaluationTemplateId: v === 'none' ? null : v })}
                  disabled={isLocked || isLaunched}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Choisir un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun modèle (questions par défaut)</SelectItem>
                    <SelectItem value="same">Même que l'auto-évaluation</SelectItem>
                    {managerEvalTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                    {/* Show all templates if no manager-eval specific ones */}
                    {managerEvalTemplates.length === 0 && templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Department-level template overrides */}
            {departments && departments.length > 0 && !isLaunched && (
              <Collapsible open={deptTemplatesOpen} onOpenChange={setDeptTemplatesOpen}>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Modèles par département</span>
                      <p className="text-sm text-muted-foreground">
                        Utiliser des modèles différents selon le département
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.useDepartmentTemplates}
                      onCheckedChange={(checked) => {
                        updateFormData({ useDepartmentTemplates: checked });
                        if (checked) setDeptTemplatesOpen(true);
                      }}
                      disabled={isLocked}
                    />
                    {formData.useDepartmentTemplates && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <ChevronDown className={`h-4 w-4 transition-transform ${deptTemplatesOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>

                <CollapsibleContent className="mt-4 space-y-4">
                  {departments.map((dept) => (
                    <Card key={dept.id} className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{dept.name}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Self-eval template for this dept */}
                        {formData.includeSelfEvaluation && (
                          <div className="space-y-2">
                            <Label className="text-sm">Auto-évaluation</Label>
                            <Select
                              value={getDeptTemplateId(dept.id, 'self') ?? 'default'}
                              onValueChange={(v) => setDeptTemplate(dept.id, 'self', v === 'default' ? null : v)}
                              disabled={isLocked}
                            >
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Par défaut</SelectItem>
                                {templates.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Manager-eval template for this dept */}
                        {formData.includeManagerEvaluation && (
                          <div className="space-y-2">
                            <Label className="text-sm">Éval. manager</Label>
                            <Select
                              value={getDeptTemplateId(dept.id, 'manager') ?? 'default'}
                              onValueChange={(v) => setDeptTemplate(dept.id, 'manager', v === 'default' ? null : v)}
                              disabled={isLocked}
                            >
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Par défaut</SelectItem>
                                {templates.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Link to create new template */}
            <div className="pt-2">
              <Link
                href="/performance/templates/new"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Plus className="h-4 w-4" />
                Créer un nouveau modèle
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
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
