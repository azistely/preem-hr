'use client';

/**
 * Custom Salary Component Creation Wizard
 *
 * 4-step wizard for creating compliant custom salary components:
 * 1. Basic Info (name, category, isReimbursement)
 * 2. Template Suggestion (if similar templates found)
 * 3. Tax & Social Security Treatment
 * 4. Calculation Method & Amount
 *
 * Reference: docs/COMPLIANCE-GUIDED-COMPONENT-CREATION.md
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Check, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

// ============================================================================
// Form Schema
// ============================================================================

const wizardSchema = z.object({
  // Step 1: Basic Info
  name: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
  category: z.enum(['allowance', 'bonus', 'deduction', 'benefit'], {
    required_error: 'Veuillez sélectionner une catégorie',
  }),
  isReimbursement: z.boolean().default(false),

  // Step 3: Tax & Social Security
  isTaxable: z.boolean().default(true),
  isSubjectToSocialSecurity: z.boolean().default(true),

  // Step 4: Calculation Method
  calculationMethod: z.enum(['fixed', 'percentage', 'variable'], {
    required_error: 'Veuillez sélectionner une méthode de calcul',
  }),
  amount: z.number().optional(),
  rate: z.number().min(0).max(100).optional(),
});

type WizardFormData = z.infer<typeof wizardSchema>;

// ============================================================================
// Component Props
// ============================================================================

interface CustomComponentWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (component?: any) => void;
  countryCode: string;
  embeddedMode?: boolean; // When true, renders without Dialog wrapper
}

// ============================================================================
// Main Component
// ============================================================================

// Default form values
const FORM_DEFAULTS: Partial<WizardFormData> = {
  name: '',
  category: undefined,
  isReimbursement: false,
  isTaxable: true,
  isSubjectToSocialSecurity: true,
  calculationMethod: 'fixed',
  amount: undefined,
  rate: undefined,
};

export function CustomComponentWizard({
  open,
  onClose,
  onSuccess,
  countryCode,
  embeddedMode = false,
}: CustomComponentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showTemplateSuggestions, setShowTemplateSuggestions] = useState(false);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema) as any,
    defaultValues: FORM_DEFAULTS,
  });

  // Get form values for conditional logic
  const watchName = form.watch('name');
  const watchCategory = form.watch('category');
  const watchIsReimbursement = form.watch('isReimbursement');
  const watchIsTaxable = form.watch('isTaxable');
  const watchCalculationMethod = form.watch('calculationMethod');

  // Query similar templates (triggered when name + category filled)
  const { data: suggestions, isLoading: loadingSuggestions } =
    trpc.salaryComponents.getSimilarTemplates.useQuery(
      {
        name: watchName,
        category: watchCategory,
        countryCode,
      },
      {
        enabled: !!watchName && watchName.length >= 3 && !!watchCategory,
      }
    );

  // Create component mutation
  const createMutation = trpc.salaryComponents.createCustomComponentWizard.useMutation({
    onSuccess: (createdComponent) => {
      onSuccess?.(createdComponent);
      onClose();
      form.reset(FORM_DEFAULTS);
      setCurrentStep(1);
    },
  });

  // ============================================================================
  // Step Navigation
  // ============================================================================

  const handleNext = async () => {
    let fieldsToValidate: (keyof WizardFormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['name', 'category'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['isTaxable', 'isSubjectToSocialSecurity'];
    } else if (currentStep === 4) {
      fieldsToValidate = ['calculationMethod'];
      if (watchCalculationMethod === 'fixed') {
        fieldsToValidate.push('amount');
      } else if (watchCalculationMethod === 'percentage') {
        fieldsToValidate.push('rate');
      }
    }

    const isValid = await form.trigger(fieldsToValidate);

    if (!isValid) return;

    // After Step 1, check if we should show template suggestions
    if (currentStep === 1) {
      if (suggestions && suggestions.length > 0) {
        setShowTemplateSuggestions(true);
        setCurrentStep(2);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep === 3 && showTemplateSuggestions) {
      setCurrentStep(2);
    } else if (currentStep === 3) {
      setCurrentStep(1);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (data: WizardFormData) => {
    await createMutation.mutateAsync({
      name: data.name,
      category: data.category,
      isReimbursement: data.isReimbursement,
      isTaxable: data.isTaxable,
      isSubjectToSocialSecurity: data.isSubjectToSocialSecurity,
      calculationMethod: data.calculationMethod,
      amount: data.amount,
      rate: data.rate,
      countryCode,
    });
  };

  const handleSkipTemplates = () => {
    setShowTemplateSuggestions(false);
    setCurrentStep(3);
  };

  /**
   * Use a suggested template instead of creating custom component
   */
  const handleUseTemplate = (template: any) => {
    const componentData = {
      code: template.code,
      name: typeof template.name === 'object' ? template.name.fr : template.name,
      defaultValue: template.suggestedAmount?.toString() || '0',
      category: template.category,
      isTaxable: template.metadata?.taxTreatment?.isTaxable ?? true,
      isReimbursement: template.metadata?.taxTreatment?.isReimbursement ?? false,
    };
    onSuccess?.(componentData);
    onClose();
    form.reset(FORM_DEFAULTS);
    setCurrentStep(1);
  };

  /**
   * Handle cancel - reset wizard in embedded mode, close in dialog mode
   */
  const handleCancel = () => {
    if (embeddedMode) {
      // In embedded mode, just reset the wizard
      form.reset(FORM_DEFAULTS);
      setCurrentStep(1);
      setShowTemplateSuggestions(false);
    } else {
      // In dialog mode, close the dialog
      onClose();
    }
  };

  // ============================================================================
  // Auto-update tax treatment for reimbursements
  // ============================================================================

  // When isReimbursement changes, update isTaxable
  const handleReimbursementChange = (checked: boolean) => {
    form.setValue('isReimbursement', checked);
    if (checked) {
      form.setValue('isTaxable', false);
    }
  };

  // ============================================================================
  // Render Steps
  // ============================================================================

  const wizardContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header for embedded mode */}
        {embeddedMode && (
          <div className="space-y-2 pb-4 border-b">
            <h3 className="text-lg font-semibold">Créer un composant de salaire personnalisé</h3>
            <p className="text-sm text-muted-foreground">
              Étape {currentStep} sur 4 - Nous vous guiderons pour créer un composant conforme
            </p>
          </div>
        )}
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du composant</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Prime de déplacement, Indemnité de transport..."
                          {...field}
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Donnez un nom clair qui décrit la nature du paiement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Sélectionnez une catégorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="allowance">Prime</SelectItem>
                          <SelectItem value="bonus">Bonus</SelectItem>
                          <SelectItem value="deduction">Retenue</SelectItem>
                          <SelectItem value="benefit">Avantage en nature</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isReimbursement"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={handleReimbursementChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>S'agit-il d'un remboursement de frais ?</FormLabel>
                        <FormDescription>
                          Les remboursements de frais (déplacement, salissure, etc.) sont
                          automatiquement non imposables selon le Code Général des Impôts
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {watchIsReimbursement && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Ce composant sera automatiquement défini comme non imposable car c'est un
                      remboursement de frais.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 2: Template Suggestions */}
            {currentStep === 2 && showTemplateSuggestions && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Composants similaires trouvés</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous avons trouvé des composants existants qui ressemblent à ce que vous
                    créez. Voulez-vous utiliser l'un d'eux ?
                  </p>
                </div>

                <div className="space-y-3">
                  {suggestions?.map((suggestion) => (
                    <Card key={suggestion.template.id}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{suggestion.template.name.fr}</span>
                          <span className="text-sm text-muted-foreground">
                            {suggestion.similarity}% similaire
                          </span>
                        </CardTitle>
                        {suggestion.template.description && (
                          <CardDescription>{suggestion.template.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          Raison: {suggestion.matchReason}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(suggestion.template)}
                        >
                          Utiliser ce composant
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator />

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipTemplates}
                  className="w-full"
                >
                  Continuer avec mon composant personnalisé
                </Button>
              </div>
            )}

            {/* Step 3: Tax & Social Security */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Traitement fiscal et social</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez comment ce composant sera traité pour les impôts et cotisations
                    sociales
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="isTaxable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Imposable (ITS)</FormLabel>
                        <FormDescription>
                          Ce composant sera inclus dans le calcul de l'Impôt sur Traitement et
                          Salaires
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={watchIsReimbursement}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isSubjectToSocialSecurity"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Soumis à CNPS</FormLabel>
                        <FormDescription>
                          Ce composant sera inclus dans la base de calcul des cotisations CNPS
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!watchIsTaxable && !watchIsReimbursement && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Plafond de 10%</strong> - Les primes non imposables (hors
                      remboursements) ne peuvent pas dépasser 10% de la rémunération totale selon
                      le Code Général des Impôts.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 4: Calculation Method */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Méthode de calcul</h3>
                  <p className="text-sm text-muted-foreground">
                    Comment ce composant sera-t-il calculé pour chaque employé ?
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="calculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value}>
                          <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <RadioGroupItem value="fixed" />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                Montant fixe - Même montant pour tous les employés
                              </FormLabel>
                            </div>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <RadioGroupItem value="percentage" />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                Pourcentage du salaire - Calculé automatiquement
                              </FormLabel>
                            </div>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <RadioGroupItem value="variable" />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                Variable - Montant différent par employé
                              </FormLabel>
                            </div>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchCalculationMethod === 'fixed' && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant (FCFA)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ex: 30000"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Ce montant sera attribué à tous les employés par défaut
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchCalculationMethod === 'percentage' && (
                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pourcentage (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ex: 10"
                            min="0"
                            max="100"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Pourcentage du salaire de base à calculer automatiquement
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchCalculationMethod === 'variable' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Vous pourrez définir un montant spécifique pour chaque employé après avoir
                      créé ce composant.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Retour
                </Button>
              )}

              <div className="ml-auto flex gap-3">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Annuler
                </Button>

                {currentStep < 4 ? (
                  <Button type="button" onClick={handleNext}>
                    Suivant
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="min-h-[56px]"
                  >
                    {createMutation.isPending ? (
                      'Création en cours...'
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Créer le composant
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
      </form>
    </Form>
  );

  // Conditionally wrap with Dialog or render directly
  if (embeddedMode) {
    return wizardContent;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un composant de salaire personnalisé</DialogTitle>
          <DialogDescription>
            Étape {currentStep} sur 4 - Nous vous guiderons pour créer un composant conforme
          </DialogDescription>
        </DialogHeader>
        {wizardContent}
      </DialogContent>
    </Dialog>
  );
}
