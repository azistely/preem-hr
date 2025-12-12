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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
} from 'lucide-react';

// Wizard steps
const STEPS = [
  { id: 'basics', title: 'Informations', icon: ClipboardList },
  { id: 'period', title: 'Période', icon: CalendarIcon },
  { id: 'options', title: 'Options', icon: Target },
  { id: 'confirm', title: 'Confirmation', icon: Check },
];

// Cycle types with French labels (must match API enum)
const CYCLE_TYPES = [
  { value: 'annual', label: 'Évaluation annuelle', description: 'Une fois par an' },
  { value: 'semi_annual', label: 'Évaluation semestrielle', description: 'Deux fois par an' },
  { value: 'quarterly', label: 'Évaluation trimestrielle', description: 'Quatre fois par an' },
] as const;

type CycleType = 'annual' | 'semi_annual' | 'quarterly';

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
  includeCalibration: boolean;
  selfEvaluationDeadline: Date | null;
  managerEvaluationDeadline: Date | null;
}

export default function NewPerformanceCyclePage() {
  const router = useRouter();
  const { toast } = useToast();
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
    includeCalibration: false,
    selfEvaluationDeadline: addMonths(defaultEnd, 1),
    managerEvaluationDeadline: addMonths(defaultEnd, 2),
  });

  // Create cycle mutation
  const createCycle = api.performance.cycles.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Cycle créé',
        description: `Le cycle "${data.name}" a été créé avec succès.`,
      });
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
      case 3: // Confirm
        return true;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

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
      includeCalibration: formData.includeCalibration,
      selfEvaluationDeadline: formData.selfEvaluationDeadline?.toISOString().split('T')[0],
      managerEvaluationDeadline: formData.managerEvaluationDeadline?.toISOString().split('T')[0],
    });
  }, [formData, createCycle]);

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
          <h1 className="text-2xl font-bold">Nouveau cycle d'évaluation</h1>
          <p className="text-muted-foreground">
            Étape {currentStep + 1} sur {STEPS.length}
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
              <div className="space-y-2">
                <Label htmlFor="cycleType" className="text-base font-medium">
                  Type de cycle <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium">
                  Nom du cycle <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder="Ex: Évaluation annuelle 2024"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium">
                  Description (optionnel)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Décrivez les objectifs de ce cycle d'évaluation..."
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
                <Label className="text-base font-medium">Composantes de l'évaluation</Label>

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
                      <div className="font-medium">Auto-évaluation</div>
                      <div className="text-sm text-muted-foreground">
                        L'employé évalue sa propre performance
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
                      <div className="font-medium">Évaluation manager</div>
                      <div className="text-sm text-muted-foreground">
                        Le manager évalue la performance de l'employé
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
                      <div className="font-medium">Feedback des pairs</div>
                      <div className="text-sm text-muted-foreground">
                        Les collègues peuvent donner leur feedback
                      </div>
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
                      <div className="font-medium">Objectifs</div>
                      <div className="text-sm text-muted-foreground">
                        Suivi des objectifs individuels et d'équipe
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={formData.includeCalibration}
                      onCheckedChange={(checked) =>
                        updateFormData({ includeCalibration: !!checked })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">Calibration</div>
                      <div className="text-sm text-muted-foreground">
                        Session de calibration pour harmoniser les évaluations
                      </div>
                      <Badge variant="outline" className="mt-1">Grandes entreprises</Badge>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 3 && (
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
                      <Badge variant="secondary">Évaluation manager</Badge>
                    )}
                    {formData.includePeerFeedback && (
                      <Badge variant="secondary">Feedback pairs</Badge>
                    )}
                    {formData.includeObjectives && (
                      <Badge variant="secondary">Objectifs</Badge>
                    )}
                    {formData.includeCalibration && (
                      <Badge variant="secondary">Calibration</Badge>
                    )}
                  </div>
                </div>

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
