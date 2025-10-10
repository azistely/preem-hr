"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Layers,
  Zap,
  Filter,
  Target,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  UserPlus,
  Plane,
  AlertCircle
} from "lucide-react";
import { WorkflowTemplateCard } from "./workflow-template-card";
import { ConditionBuilder } from "./condition-builder";
import { ActionConfigurator } from "./action-configurator";
import { WorkflowPreview } from "./workflow-preview";

const WIZARD_STEPS = [
  { key: "template", title: "Choisir un modèle", icon: Layers },
  { key: "trigger", title: "Configurer le déclencheur", icon: Zap },
  { key: "conditions", title: "Ajouter des conditions", icon: Filter },
  { key: "actions", title: "Choisir les actions", icon: Target },
  { key: "review", title: "Résumé et activation", icon: CheckCircle },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]["key"];

interface WorkflowWizardProps {
  onComplete?: (workflowId: string) => void;
  initialTemplateId?: string;
}

const TRIGGER_OPTIONS = [
  {
    value: "contract_expiry",
    label: "Quand un contrat approche de sa fin",
    icon: Calendar,
    description: "Déclenché X jours avant l'expiration d'un contrat",
    defaultConfig: { days_before: 30 },
  },
  {
    value: "salary_change",
    label: "Quand un salaire est modifié",
    icon: DollarSign,
    description: "Déclenché lors d'une modification de salaire",
    defaultConfig: {},
  },
  {
    value: "employee_hired",
    label: "Quand un nouvel employé est embauché",
    icon: UserPlus,
    description: "Déclenché lors de l'embauche d'un employé",
    defaultConfig: {},
  },
  {
    value: "leave_approved",
    label: "Quand un congé est approuvé",
    icon: Plane,
    description: "Déclenché lors de l'approbation d'un congé",
    defaultConfig: {},
  },
];

export function WorkflowWizard({ onComplete, initialTemplateId }: WorkflowWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("template");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "",
    triggerConfig: {} as Record<string, any>,
    conditions: [] as any[],
    actions: [] as any[],
    templateId: initialTemplateId,
  });

  const { data: templates, isLoading: isLoadingTemplates } = api.workflows.getTemplates.useQuery({});

  const createWorkflowMutation = api.workflows.create.useMutation({
    onSuccess: (workflow) => {
      toast.success("Workflow créé avec succès");
      if (onComplete) {
        onComplete(workflow.id);
      } else {
        router.push(`/workflows/${workflow.id}`);
      }
    },
    onError: (error) => {
      toast.error(`Erreur lors de la création du workflow: ${error.message}`);
    },
  });

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100;
  const CurrentStepIcon = WIZARD_STEPS[currentStepIndex].icon;

  const handleNext = () => {
    // Validation for each step
    if (currentStep === "template" && !formData.templateId && !formData.triggerType) {
      toast.error("Veuillez choisir un modèle ou configurer un déclencheur");
      return;
    }
    if (currentStep === "trigger" && !formData.triggerType) {
      toast.error("Veuillez sélectionner un déclencheur");
      return;
    }
    if (currentStep === "actions" && formData.actions.length === 0) {
      toast.error("Veuillez choisir au moins une action");
      return;
    }

    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex + 1].key);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex - 1].key);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description || "",
        triggerType: template.triggerType,
        triggerConfig: template.triggerConfig as Record<string, any>,
        conditions: (template.conditions as any[]) || [],
        actions: (template.actions as any[]) || [],
        templateId: templateId,
      });
      setCurrentStep("trigger");
    }
  };

  const handleSkipTemplate = () => {
    setCurrentStep("trigger");
  };

  const handleTriggerSelect = (triggerType: string) => {
    const trigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType);
    setFormData({
      ...formData,
      triggerType,
      triggerConfig: trigger?.defaultConfig || {},
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Veuillez donner un nom au workflow");
      return;
    }

    createWorkflowMutation.mutate({
      name: formData.name,
      description: formData.description,
      triggerType: formData.triggerType,
      triggerConfig: formData.triggerConfig,
      conditions: formData.conditions,
      actions: formData.actions,
      status: "draft",
      templateId: formData.templateId,
    });
  };

  const handleActivate = () => {
    if (!formData.name) {
      toast.error("Veuillez donner un nom au workflow");
      return;
    }

    createWorkflowMutation.mutate({
      name: formData.name,
      description: formData.description,
      triggerType: formData.triggerType,
      triggerConfig: formData.triggerConfig,
      conditions: formData.conditions,
      actions: formData.actions,
      status: "active",
      templateId: formData.templateId,
    });
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CurrentStepIcon className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">{WIZARD_STEPS[currentStepIndex].title}</h2>
              <p className="text-sm text-muted-foreground">
                Étape {currentStepIndex + 1} sur {WIZARD_STEPS.length}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            {Math.round(progressPercentage)}% complété
          </Badge>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Choose Template */}
          {currentStep === "template" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Démarrage rapide avec un modèle</h3>
                <p className="text-sm text-muted-foreground">
                  Choisissez un modèle pré-configuré ou créez un workflow personnalisé
                </p>
              </div>

              {isLoadingTemplates ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Chargement des modèles...</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {templates?.map((template) => (
                    <WorkflowTemplateCard
                      key={template.id}
                      id={template.id}
                      name={template.name}
                      description={template.description || ""}
                      category={template.templateCategory || "other"}
                      triggerType={template.triggerType}
                      actionCount={(template.actions as any[])?.length || 0}
                      onUse={handleTemplateSelect}
                    />
                  ))}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Ou</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full min-h-[56px]"
                onClick={handleSkipTemplate}
              >
                Créer un workflow personnalisé
              </Button>
            </div>
          )}

          {/* Step 2: Configure Trigger */}
          {currentStep === "trigger" && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-base">
                  Nom du workflow
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Rappels de fin de contrat"
                  className="min-h-[48px] mt-2"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-base">
                  Description (optionnel)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Décrivez ce que fait ce workflow..."
                  className="min-h-[80px] mt-2"
                />
              </div>

              <div>
                <Label className="text-base mb-3 block">
                  Quand voulez-vous déclencher ce workflow?
                </Label>
                <div className="space-y-3">
                  {TRIGGER_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all hover:border-primary ${
                          formData.triggerType === option.value
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                        onClick={() => handleTriggerSelect(option.value)}
                      >
                        <CardContent className="p-4 flex items-start gap-3">
                          <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {option.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Trigger-specific configuration */}
              {formData.triggerType === "contract_expiry" && (
                <div>
                  <Label htmlFor="days_before" className="text-base">
                    Combien de jours avant l'expiration?
                  </Label>
                  <Input
                    id="days_before"
                    type="number"
                    min={1}
                    max={90}
                    value={formData.triggerConfig.days_before || 30}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerConfig: { days_before: parseInt(e.target.value) },
                      })
                    }
                    className="min-h-[48px] mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Le workflow sera déclenché {formData.triggerConfig.days_before || 30} jours avant la fin du contrat
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Add Conditions */}
          {currentStep === "conditions" && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">Conditions optionnelles</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Les conditions permettent de filtrer quand le workflow doit s'exécuter.
                    Si vous n'ajoutez pas de conditions, le workflow s'exécutera à chaque fois que le déclencheur est activé.
                  </p>
                </div>
              </div>

              <ConditionBuilder
                conditions={formData.conditions}
                onChange={(conditions) => setFormData({ ...formData, conditions })}
              />
            </div>
          )}

          {/* Step 4: Choose Actions */}
          {currentStep === "actions" && (
            <div className="space-y-6">
              <ActionConfigurator
                actions={formData.actions}
                onChange={(actions) => setFormData({ ...formData, actions })}
              />
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === "review" && (
            <div className="space-y-6">
              <WorkflowPreview
                name={formData.name}
                description={formData.description}
                triggerType={formData.triggerType}
                triggerConfig={formData.triggerConfig}
                conditions={formData.conditions}
                actions={formData.actions}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>

          <div className="flex gap-3">
            {currentStep === "review" ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleSubmit}
                  disabled={createWorkflowMutation.isPending}
                  className="min-h-[44px]"
                >
                  Enregistrer comme brouillon
                </Button>
                <Button
                  onClick={handleActivate}
                  disabled={createWorkflowMutation.isPending}
                  className="min-h-[56px]"
                >
                  {createWorkflowMutation.isPending ? "Création..." : "Activer le workflow"}
                </Button>
              </>
            ) : (
              <Button onClick={handleNext} className="min-h-[44px]">
                Continuer
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
