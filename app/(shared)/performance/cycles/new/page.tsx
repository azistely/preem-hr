/**
 * New Performance Cycle Wizard
 *
 * Multi-step wizard for creating a new performance evaluation cycle.
 * Adapts complexity based on company size (smart defaults).
 *
 * HCI Principles:
 * - 3-5 steps for manageable cognitive load
 * - Smart defaults pre-filled (95% of values)
 * - Clear progress indication
 * - Validation at each step
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  Loader2,
  Info,
  Users,
  Target,
  ClipboardList,
  Star,
  Award,
  FileText,
  Plus,
  Eye,
  Lock,
  MessageSquarePlus,
  Trash2,
  GripVertical,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { nanoid } from 'nanoid';

// Wizard steps - Simple user-friendly labels
const STEPS = [
  { id: 'basics', title: 'Type', icon: ClipboardList },
  { id: 'period', title: 'Dates', icon: CalendarIcon },
  { id: 'options', title: 'Etapes', icon: Target },
  { id: 'questions', title: 'Questions', icon: FileText },
  { id: 'confirm', title: 'Resume', icon: Check },
];

// Cycle types with user-friendly French labels (must match API enum)
const CYCLE_TYPES = [
  { value: 'annual', label: 'Une fois par an', description: 'Recommande pour la plupart des entreprises', recommended: true },
  { value: 'semi_annual', label: 'Deux fois par an', description: 'Ideal pour un suivi plus frequent' },
  { value: 'quarterly', label: 'Quatre fois par an', description: 'Pour les equipes agiles' },
] as const;

type CycleType = 'annual' | 'semi_annual' | 'quarterly';

// Custom question type
interface CustomQuestion {
  id: string;
  question: string;
  type: 'rating' | 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
  helpText?: string;
  appliesTo: 'self' | 'manager' | 'both';
}

// Template assignment by department/position
interface TemplateAssignment {
  departmentId?: string;
  positionId?: string;
  evaluationType: 'self' | 'manager';
  templateId: string;
}

interface FormData {
  name: string;
  description: string;
  cycleType: CycleType;
  periodStart: Date;
  periodEnd: Date;
  includeSelfEvaluation: boolean;
  includeManagerEvaluation: boolean;
  includePeerFeedback: boolean;
  includeObjectives: boolean;
  includeCompetencies: boolean;
  includeCalibration: boolean;
  selfEvaluationDeadline: Date | null;
  managerEvaluationDeadline: Date | null;
  // Template selection
  evaluationTemplateId: string | null; // Default template for all evaluations
  selfEvaluationTemplateId: string | null; // Specific template for self-evaluation
  managerEvaluationTemplateId: string | null; // Specific template for manager evaluation
  // Department-specific template overrides
  templateAssignments: TemplateAssignment[];
  useDepartmentTemplates: boolean; // Toggle for department-level customization
  // Custom questions for this cycle
  customQuestions: CustomQuestion[];
}

export default function NewPerformanceCyclePage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = api.useUtils();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default dates (current year)
  const currentYear = new Date().getFullYear();
  const defaultStart = startOfYear(new Date(currentYear, 0, 1));
  const defaultEnd = endOfYear(new Date(currentYear, 11, 31));

  // Form state with smart defaults
  const [formData, setFormData] = useState<FormData>({
    name: `Évaluation annuelle ${currentYear}`,
    description: '',
    cycleType: 'annual',
    periodStart: defaultStart,
    periodEnd: defaultEnd,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: false,
    includeObjectives: true,
    includeCompetencies: true,
    includeCalibration: false,
    selfEvaluationDeadline: addMonths(defaultEnd, 1),
    managerEvaluationDeadline: addMonths(defaultEnd, 2),
    evaluationTemplateId: null,
    selfEvaluationTemplateId: null,
    managerEvaluationTemplateId: null,
    templateAssignments: [],
    useDepartmentTemplates: false,
    customQuestions: [],
  });

  // Fetch departments for department-specific templates
  const { data: departments } = api.performance.departments.list.useQuery({ status: 'active' });

  // Fetch available templates
  const { data: templatesData, isLoading: isLoadingTemplates } = api.hrForms.templates.list.useQuery({
    module: 'performance',
    limit: 100,
  });

  const templates = templatesData?.data ?? [];
  const selfEvalTemplates = templates.filter(t =>
    t.category === 'self_evaluation' || t.category === 'manager_evaluation'
  );
  const managerEvalTemplates = templates.filter(t =>
    t.category === 'manager_evaluation' || t.category === 'self_evaluation'
  );

  // Create cycle mutation
  const createCycle = api.performance.cycles.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Cycle créé',
        description: `Le cycle "${data.name}" a été créé avec succès.`,
      });
      // Invalidate sidebar queries to show the new cycle
      utils.performance.getGuideStatus.invalidate();
      router.push(`/performance/cycles/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
  });

  // Update form data
  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle cycle type change (update dates and name)
  const handleCycleTypeChange = useCallback((type: CycleType) => {
    const now = new Date();
    const year = now.getFullYear();
    let start: Date;
    let end: Date;
    let name: string;

    switch (type) {
      case 'annual':
        start = startOfYear(now);
        end = endOfYear(now);
        name = `Évaluation annuelle ${year}`;
        break;
      case 'semi_annual':
        if (now.getMonth() < 6) {
          start = startOfYear(now);
          end = new Date(year, 5, 30);
          name = `Évaluation S1 ${year}`;
        } else {
          start = new Date(year, 6, 1);
          end = endOfYear(now);
          name = `Évaluation S2 ${year}`;
        }
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(year, quarter * 3, 1);
        end = endOfMonth(new Date(year, quarter * 3 + 2, 1));
        name = `Évaluation T${quarter + 1} ${year}`;
        break;
    }

    updateFormData({
      cycleType: type,
      periodStart: start,
      periodEnd: end,
      name,
      selfEvaluationDeadline: addMonths(end, 1),
      managerEvaluationDeadline: addMonths(end, 2),
    });
  }, [updateFormData]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Validate current step
  const isStepValid = useCallback(() => {
    switch (currentStep) {
      case 0: // Basics
        return formData.name.trim().length > 0 && formData.cycleType;
      case 1: // Period
        return formData.periodStart && formData.periodEnd && formData.periodStart < formData.periodEnd;
      case 2: // Options
        return formData.includeSelfEvaluation || formData.includeManagerEvaluation;
      case 3: // Questions (templates are optional)
        return true;
      case 4: // Confirm
        return true;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    // Use the self-evaluation template as default, or manager eval template if no self-eval
    const effectiveTemplateId = formData.selfEvaluationTemplateId
      || formData.managerEvaluationTemplateId
      || formData.evaluationTemplateId
      || undefined;

    createCycle.mutate({
      name: formData.name,
      description: formData.description || undefined,
      cycleType: formData.cycleType,
      periodStart: formData.periodStart.toISOString().split('T')[0],
      periodEnd: formData.periodEnd.toISOString().split('T')[0],
      includeSelfEvaluation: formData.includeSelfEvaluation,
      includeManagerEvaluation: formData.includeManagerEvaluation,
      includePeerFeedback: formData.includePeerFeedback,
      includeObjectives: formData.includeObjectives,
      includeCompetencies: formData.includeCompetencies,
      includeCalibration: formData.includeCalibration,
      selfEvaluationDeadline: formData.selfEvaluationDeadline?.toISOString().split('T')[0],
      managerEvaluationDeadline: formData.managerEvaluationDeadline?.toISOString().split('T')[0],
      evaluationTemplateId: effectiveTemplateId,
      templateAssignments: formData.templateAssignments.length > 0 ? formData.templateAssignments : undefined,
      customQuestions: formData.customQuestions.length > 0 ? formData.customQuestions : undefined,
    });
  }, [formData, createCycle]);

  // Add a new custom question
  const addCustomQuestion = useCallback(() => {
    const newQuestion: CustomQuestion = {
      id: nanoid(8),
      question: '',
      type: 'rating',
      required: true,
      appliesTo: 'both',
    };
    updateFormData({ customQuestions: [...formData.customQuestions, newQuestion] });
  }, [formData.customQuestions, updateFormData]);

  // Update a custom question
  const updateCustomQuestion = useCallback((id: string, updates: Partial<CustomQuestion>) => {
    updateFormData({
      customQuestions: formData.customQuestions.map(q =>
        q.id === id ? { ...q, ...updates } : q
      ),
    });
  }, [formData.customQuestions, updateFormData]);

  // Remove a custom question
  const removeCustomQuestion = useCallback((id: string) => {
    updateFormData({
      customQuestions: formData.customQuestions.filter(q => q.id !== id),
    });
  }, [formData.customQuestions, updateFormData]);

  // Progress percentage
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Lancer une evaluation</h1>
          <p className="text-muted-foreground">
            Etape {currentStep + 1} sur {STEPS.length}: {STEPS[currentStep].title}
          </p>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2" />

      {/* Step indicators */}
      <div className="flex justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 ${
                isActive ? 'text-primary' : isComplete ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isComplete
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : 'bg-muted'
                }`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Basics */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="cycleType" className="text-base font-medium">
                  A quelle frequence voulez-vous evaluer?
                </Label>
                <p className="text-sm text-muted-foreground -mt-1">
                  Choisissez la periodicite qui convient a votre entreprise
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {CYCLE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleCycleTypeChange(type.value as CycleType)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.cycleType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{type.label}</div>
                        {'recommended' in type && type.recommended && (
                          <Badge variant="secondary" className="text-xs">Recommande</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium">
                  Donnez un nom a cette evaluation
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder="Ex: Evaluation annuelle 2024"
                  className="min-h-[48px]"
                />
                <p className="text-xs text-muted-foreground">
                  Ce nom sera visible par tous les employes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium">
                  Ajoutez une description (optionnel)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Ex: Evaluation de fin d'annee pour tous les employes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Period */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Les dates ont été pré-remplies en fonction du type de cycle choisi.
                  Vous pouvez les modifier si nécessaire.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    Date de début <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full min-h-[48px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.periodStart, 'dd MMMM yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.periodStart}
                        onSelect={(date) => date && updateFormData({ periodStart: date })}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    Date de fin <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full min-h-[48px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.periodEnd, 'dd MMMM yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.periodEnd}
                        onSelect={(date) => date && updateFormData({ periodEnd: date })}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Durée du cycle:</strong>{' '}
                  {Math.ceil(
                    (formData.periodEnd.getTime() - formData.periodStart.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  jours
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Quelles etapes pour cette evaluation?</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cochez les etapes que vous souhaitez inclure dans ce cycle
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includeSelfEvaluation}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeSelfEvaluation: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">Les employes s'evaluent eux-memes</div>
                        <Badge variant="secondary" className="text-xs">Recommande</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Chaque employe note sa propre performance avant votre evaluation
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includeManagerEvaluation}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeManagerEvaluation: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">Vous evaluez vos employes</div>
                        <Badge variant="secondary" className="text-xs">Recommande</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Vous notez la performance de chaque employe
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includePeerFeedback}
                      onCheckedChange={(checked) =>
                        updateFormData({ includePeerFeedback: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">Les collegues donnent leur avis</div>
                      <div className="text-sm text-muted-foreground">
                        Permet aux collegues de donner un feedback sur les autres membres de l'equipe
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">Optionnel</Badge>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includeObjectives}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeObjectives: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">Suivre les objectifs</div>
                      <div className="text-sm text-muted-foreground">
                        Definir et suivre les objectifs de chaque employe pendant ce cycle
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">Optionnel</Badge>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includeCompetencies}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeCompetencies: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">Evaluer les competences</div>
                        <Badge variant="secondary" className="text-xs">Recommande</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Evaluer les competences techniques et comportementales associees au poste
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20">
                    <Checkbox
                      checked={formData.includeCalibration}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeCalibration: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-muted-foreground">Harmoniser les notes (Calibration)</div>
                      <div className="text-sm text-muted-foreground">
                        Session de revue pour harmoniser les notes entre evaluateurs
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">Grandes entreprises (50+ employes)</Badge>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Questions/Templates */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Choisissez les questions que vos employés devront répondre. Vous pouvez utiliser un modèle existant ou créer le vôtre.
                </AlertDescription>
              </Alert>

              {isLoadingTemplates ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Aucun modèle disponible</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Créez votre premier modèle d'évaluation pour personnaliser les questions
                    </p>
                    <Link href="/performance/templates/new">
                      <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Créer un modèle
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Self-Evaluation Template */}
                  {formData.includeSelfEvaluation && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-base font-medium">
                          Questions pour l'auto-évaluation
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Ce modèle sera utilisé quand les employés s'évaluent eux-mêmes
                        </p>
                      </div>
                      <Select
                        value={formData.selfEvaluationTemplateId || ''}
                        onValueChange={(value) =>
                          updateFormData({ selfEvaluationTemplateId: value || null })
                        }
                      >
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner un modèle..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selfEvalTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                {template.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {template.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.selfEvaluationTemplateId && (
                        <TemplatePreviewCard
                          template={templates.find(t => t.id === formData.selfEvaluationTemplateId)}
                        />
                      )}
                    </div>
                  )}

                  {/* Manager Evaluation Template */}
                  {formData.includeManagerEvaluation && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-base font-medium">
                          Questions pour l'évaluation manager
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Ce modèle sera utilisé quand les managers évaluent leurs équipes
                        </p>
                      </div>
                      <Select
                        value={formData.managerEvaluationTemplateId || ''}
                        onValueChange={(value) =>
                          updateFormData({ managerEvaluationTemplateId: value || null })
                        }
                      >
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner un modèle..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="same-as-self">
                            Utiliser le même modèle que l'auto-évaluation
                          </SelectItem>
                          {managerEvalTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                {template.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {template.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.managerEvaluationTemplateId && formData.managerEvaluationTemplateId !== 'same-as-self' && (
                        <TemplatePreviewCard
                          template={templates.find(t => t.id === formData.managerEvaluationTemplateId)}
                        />
                      )}
                    </div>
                  )}

                  {/* Department-specific template overrides */}
                  {departments && departments.length > 0 && (
                    <Collapsible
                      open={formData.useDepartmentTemplates}
                      onOpenChange={(open) => updateFormData({ useDepartmentTemplates: open })}
                      className="space-y-3 pt-4 border-t"
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                          <div>
                            <Label className="text-base font-medium flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Personnaliser par département
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Utiliser des modèles différents selon les départements
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={formData.useDepartmentTemplates}
                              onCheckedChange={(checked) => updateFormData({ useDepartmentTemplates: checked })}
                            />
                            <ChevronDown className={`h-4 w-4 transition-transform ${formData.useDepartmentTemplates ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-3">
                        {departments.map((dept: { id: string; name: string }) => {
                          const selfAssignment = formData.templateAssignments.find(
                            a => a.departmentId === dept.id && a.evaluationType === 'self'
                          );
                          const managerAssignment = formData.templateAssignments.find(
                            a => a.departmentId === dept.id && a.evaluationType === 'manager'
                          );

                          return (
                            <Card key={dept.id} className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{dept.name}</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {formData.includeSelfEvaluation && (
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Auto-évaluation</Label>
                                    <Select
                                      value={selfAssignment?.templateId || 'default'}
                                      onValueChange={(value) => {
                                        const newAssignments = formData.templateAssignments.filter(
                                          a => !(a.departmentId === dept.id && a.evaluationType === 'self')
                                        );
                                        if (value !== 'default') {
                                          newAssignments.push({
                                            departmentId: dept.id,
                                            evaluationType: 'self',
                                            templateId: value,
                                          });
                                        }
                                        updateFormData({ templateAssignments: newAssignments });
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="default">Par défaut</SelectItem>
                                        {selfEvalTemplates.map((t) => (
                                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                {formData.includeManagerEvaluation && (
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Évaluation manager</Label>
                                    <Select
                                      value={managerAssignment?.templateId || 'default'}
                                      onValueChange={(value) => {
                                        const newAssignments = formData.templateAssignments.filter(
                                          a => !(a.departmentId === dept.id && a.evaluationType === 'manager')
                                        );
                                        if (value !== 'default') {
                                          newAssignments.push({
                                            departmentId: dept.id,
                                            evaluationType: 'manager',
                                            templateId: value,
                                          });
                                        }
                                        updateFormData({ templateAssignments: newAssignments });
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="default">Par défaut</SelectItem>
                                        {managerEvalTemplates.map((t) => (
                                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                        <p className="text-xs text-muted-foreground">
                          Les départements sans modèle personnalisé utiliseront les modèles par défaut ci-dessus.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Link to create new template */}
                  <div className="pt-4 border-t">
                    <Link href="/performance/templates/new">
                      <Button variant="outline" className="w-full min-h-[48px]">
                        <Plus className="mr-2 h-4 w-4" />
                        Créer un nouveau modèle
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Quick Custom Questions Section */}
              <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2">
                      <MessageSquarePlus className="h-4 w-4" />
                      Questions rapides (optionnel)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Ajoutez des questions spécifiques à ce cycle, en plus du modèle choisi
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCustomQuestion}
                    className="min-h-[44px]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>

                {formData.customQuestions.length > 0 && (
                  <div className="space-y-4">
                    {formData.customQuestions.map((q, index) => (
                      <QuickQuestionEditor
                        key={q.id}
                        question={q}
                        index={index}
                        onUpdate={(updates) => updateCustomQuestion(q.id, updates)}
                        onRemove={() => removeCustomQuestion(q.id)}
                        showManagerOption={formData.includeManagerEvaluation}
                        showSelfOption={formData.includeSelfEvaluation}
                      />
                    ))}
                  </div>
                )}

                {formData.customQuestions.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                      <MessageSquarePlus className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucune question rapide ajoutée.
                        <br />
                        Ces questions s'ajoutent au modèle sélectionné.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Vérifiez les informations ci-dessous avant de créer le cycle.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nom:</span>
                    <span className="font-medium">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">
                      {CYCLE_TYPES.find((t) => t.value === formData.cycleType)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Période:</span>
                    <span className="font-medium">
                      {format(formData.periodStart, 'dd/MM/yyyy', { locale: fr })} -{' '}
                      {format(formData.periodEnd, 'dd/MM/yyyy', { locale: fr })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Composantes activées:</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.includeSelfEvaluation && (
                      <Badge variant="secondary">Auto-évaluation</Badge>
                    )}
                    {formData.includeManagerEvaluation && (
                      <Badge variant="secondary">Évaluation RH</Badge>
                    )}
                    {formData.includePeerFeedback && (
                      <Badge variant="secondary">Feedback pairs</Badge>
                    )}
                    {formData.includeObjectives && (
                      <Badge variant="secondary">Objectifs</Badge>
                    )}
                    {formData.includeCompetencies && (
                      <Badge variant="secondary">Compétences</Badge>
                    )}
                    {formData.includeCalibration && (
                      <Badge variant="secondary">Calibration</Badge>
                    )}
                  </div>
                </div>

                {/* Template info */}
                {(formData.selfEvaluationTemplateId || formData.managerEvaluationTemplateId) && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Modèles de questions:</Label>
                    <div className="flex flex-wrap gap-2">
                      {formData.selfEvaluationTemplateId && (
                        <Badge variant="outline">
                          Auto-éval: {templates.find(t => t.id === formData.selfEvaluationTemplateId)?.name || 'Modèle sélectionné'}
                        </Badge>
                      )}
                      {formData.managerEvaluationTemplateId && formData.managerEvaluationTemplateId !== 'same-as-self' && (
                        <Badge variant="outline">
                          Manager: {templates.find(t => t.id === formData.managerEvaluationTemplateId)?.name || 'Modèle sélectionné'}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Custom questions summary */}
                {formData.customQuestions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Questions rapides:</Label>
                    <div className="space-y-1">
                      {formData.customQuestions.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {q.appliesTo === 'both' ? 'Tous' : q.appliesTo === 'self' ? 'Auto-éval' : 'Manager'}
                          </Badge>
                          <span className="truncate">{q.question || `Question ${i + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.description && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Description:</Label>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 0}
          className="min-h-[48px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={goNext}
            disabled={!isStepValid()}
            className="min-h-[48px]"
          >
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isStepValid()}
            className="min-h-[56px] px-8"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Créer le cycle
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Template Preview Card - shows a compact preview of the selected template
interface TemplatePreviewCardProps {
  template?: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    isSystem: boolean;
    definition: {
      fields?: Array<{ type: string; label: string }>;
    };
  };
}

function TemplatePreviewCard({ template }: TemplatePreviewCardProps) {
  if (!template) return null;

  const questionCount = template.definition?.fields?.filter(
    (f) => f.type !== 'heading' && f.type !== 'paragraph'
  ).length ?? 0;

  return (
    <div className="p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {template.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
            <span className="font-medium text-sm truncate">{template.name}</span>
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {questionCount} question{questionCount > 1 ? 's' : ''}
        </Badge>
      </div>
      {template.definition?.fields && template.definition.fields.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1">Aperçu:</p>
          <ul className="text-xs space-y-0.5">
            {template.definition.fields
              .filter((f) => f.type !== 'heading' && f.type !== 'paragraph')
              .slice(0, 3)
              .map((field, i) => (
                <li key={i} className="truncate flex items-center gap-1">
                  <span className="text-muted-foreground">•</span>
                  {field.label}
                </li>
              ))}
            {questionCount > 3 && (
              <li className="text-muted-foreground">+{questionCount - 3} autres questions</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Quick Question Editor Component
const QUESTION_TYPES = [
  { value: 'rating', label: 'Note (1-5)', icon: Star },
  { value: 'text', label: 'Texte court', icon: FileText },
  { value: 'textarea', label: 'Texte long', icon: FileText },
  { value: 'select', label: 'Choix multiple', icon: ClipboardList },
] as const;

const APPLIES_TO_OPTIONS = [
  { value: 'both', label: 'Tous' },
  { value: 'self', label: 'Auto-évaluation' },
  { value: 'manager', label: 'Évaluation manager' },
] as const;

interface QuickQuestionEditorProps {
  question: CustomQuestion;
  index: number;
  onUpdate: (updates: Partial<CustomQuestion>) => void;
  onRemove: () => void;
  showManagerOption: boolean;
  showSelfOption: boolean;
}

function QuickQuestionEditor({
  question,
  index,
  onUpdate,
  onRemove,
  showManagerOption,
  showSelfOption,
}: QuickQuestionEditorProps) {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header with remove button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Question {index + 1}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Question text */}
        <div className="space-y-2">
          <Label htmlFor={`q-${question.id}`} className="text-sm">
            Question <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`q-${question.id}`}
            value={question.question}
            onChange={(e) => onUpdate({ question: e.target.value })}
            placeholder="Ex: Comment évaluez-vous votre performance ce trimestre?"
            className="min-h-[44px]"
          />
        </div>

        {/* Type and settings row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Question type */}
          <div className="space-y-2">
            <Label className="text-sm">Type</Label>
            <Select
              value={question.type}
              onValueChange={(value: CustomQuestion['type']) => onUpdate({ type: value })}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Applies to */}
          <div className="space-y-2">
            <Label className="text-sm">S'applique à</Label>
            <Select
              value={question.appliesTo}
              onValueChange={(value: CustomQuestion['appliesTo']) => onUpdate({ appliesTo: value })}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLIES_TO_OPTIONS.filter((opt) => {
                  if (opt.value === 'self' && !showSelfOption) return false;
                  if (opt.value === 'manager' && !showManagerOption) return false;
                  if (opt.value === 'both' && (!showSelfOption || !showManagerOption)) return false;
                  return true;
                }).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Required checkbox */}
          <div className="space-y-2">
            <Label className="text-sm">Obligatoire</Label>
            <div className="flex items-center min-h-[44px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={question.required}
                  onCheckedChange={(checked) => onUpdate({ required: !!checked })}
                />
                <span className="text-sm">Réponse requise</span>
              </label>
            </div>
          </div>
        </div>

        {/* Options for select type */}
        {question.type === 'select' && (
          <div className="space-y-2">
            <Label className="text-sm">Options (une par ligne)</Label>
            <Textarea
              value={question.options?.join('\n') || ''}
              onChange={(e) =>
                onUpdate({
                  options: e.target.value.split('\n').filter((o) => o.trim()),
                })
              }
              placeholder="Option 1&#10;Option 2&#10;Option 3"
              rows={3}
            />
          </div>
        )}

        {/* Help text (optional) */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Texte d'aide (optionnel)
          </Label>
          <Input
            value={question.helpText || ''}
            onChange={(e) => onUpdate({ helpText: e.target.value || undefined })}
            placeholder="Instructions supplémentaires pour l'utilisateur"
            className="min-h-[44px]"
          />
        </div>
      </div>
    </Card>
  );
}
