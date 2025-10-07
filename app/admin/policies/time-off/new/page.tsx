/**
 * Create Time-Off Policy Wizard
 *
 * 3-Step wizard for creating compliant time-off policies:
 * Step 1: Type de congé (Essential - Template, Name, Effective Date)
 * Step 2: Règles d'acquisition (Helpful - Accrual, Approval)
 * Step 3: Options avancées (Expert - Collapsible advanced options)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc/client';
import { EffectiveDatePicker } from '@/features/policies/components/effective-date-picker';
import { LegalMinimumDisplay, LegalMinimumAlert } from '@/features/policies/components/legal-minimum-display';
import { FileText, Calendar, Settings, ArrowLeft, ArrowRight, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ============================================================================
// Schema
// ============================================================================

const policySchema = z.object({
  // Step 1: Essential
  templateId: z.string().optional(),
  policyType: z.enum(['annual_leave', 'sick_leave', 'maternity', 'paternity', 'unpaid']),
  name: z.string().min(1, 'Le nom est requis'),
  effectiveFrom: z.date(),

  // Step 2: Helpful
  accrualMethod: z.enum(['fixed', 'accrued_monthly', 'accrued_hourly']),
  accrualRate: z.number().min(0.1, 'Le taux doit être positif'),
  requiresApproval: z.boolean(),
  advanceNoticeDays: z.number().int().min(0),

  // Step 3: Expert (Optional)
  maxBalance: z.number().positive().optional(),
  minDaysPerRequest: z.number().positive().optional(),
  maxDaysPerRequest: z.number().positive().optional(),
  blackoutPeriods: z.string().optional(), // JSON string
  isPaid: z.boolean(),
});

type PolicyFormData = z.infer<typeof policySchema>;

// ============================================================================
// Main Component
// ============================================================================

export default function NewPolicyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      policyType: 'annual_leave',
      accrualMethod: 'accrued_monthly',
      accrualRate: 2.0,
      requiresApproval: true,
      advanceNoticeDays: 15,
      minDaysPerRequest: 0.5,
      isPaid: true,
      effectiveFrom: new Date(),
    },
  });

  // Get templates
  const { data: templates } = trpc.policies.getTemplates.useQuery({
    countryCode: 'CI',
  });

  // Real-time compliance validation
  const watchedValues = form.watch();
  const { data: validation } = trpc.policies.validatePolicyCompliance.useQuery(
    {
      policy: {
        accrualRate: watchedValues.accrualRate,
        maxBalance: watchedValues.maxBalance,
      },
      countryCode: 'CI',
    },
    {
      enabled: step === 2, // Only validate on step 2
    }
  );

  // Get legal minimums
  const { data: legalMinimums } = trpc.policies.getLegalMinimums.useQuery({
    countryCode: 'CI',
  });

  // Create mutation
  const createMutation = trpc.policies.createTimeOffPolicy.useMutation({
    onSuccess: () => {
      toast({
        title: 'Politique créée',
        description: 'La politique de congés a été créée avec succès.',
      });
      router.push('/admin/policies/time-off');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PolicyFormData) => {
    // Parse blackout periods if provided
    let blackoutPeriods = undefined;
    if (data.blackoutPeriods) {
      try {
        blackoutPeriods = JSON.parse(data.blackoutPeriods);
      } catch (e) {
        toast({
          title: 'Erreur',
          description: 'Format JSON invalide pour les périodes interdites',
          variant: 'destructive',
        });
        return;
      }
    }

    createMutation.mutate({
      ...data,
      blackoutPeriods,
    });
  };

  const nextStep = () => {
    if (step === 1) {
      // Validate step 1 fields
      const isValid = form.trigger(['policyType', 'name', 'effectiveFrom']);
      if (isValid) setStep(2);
    } else if (step === 2) {
      // Validate step 2 fields
      const isValid = form.trigger(['accrualMethod', 'accrualRate']);
      if (isValid) setStep(3);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold">Nouvelle politique de congés</h1>
        <p className="text-muted-foreground mt-2">
          Créez une politique conforme à la Convention Collective
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Étape {step} sur 3
          </span>
          <span className="text-sm text-muted-foreground">
            {step === 1 && 'Type de congé'}
            {step === 2 && "Règles d'acquisition"}
            {step === 3 && 'Options avancées'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Type de congé (Essential) */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Type de congé</CardTitle>
                    <CardDescription>
                      Choisissez un modèle pré-configuré ou créez une politique personnalisée
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="policyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Choisir un modèle</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="min-h-[56px]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual_leave">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📅</span>
                              <div>
                                <div className="font-medium">Congés payés annuels</div>
                                <div className="text-xs text-muted-foreground">
                                  24 jours/an (2.0 jours/mois)
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="sick_leave">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🤒</span>
                              <div className="font-medium">Congé maladie</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="maternity">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🤱</span>
                              <div>
                                <div className="font-medium">Congé de maternité</div>
                                <div className="text-xs text-muted-foreground">
                                  14 semaines
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="paternity">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👨‍👧</span>
                              <div className="font-medium">Congé de paternité</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="unpaid">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎨</span>
                              <div className="font-medium">Personnalisé</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Les modèles sont pré-configurés selon la Convention Collective
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la politique</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Congés annuels 2025"
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Donnez un nom descriptif à cette politique
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <EffectiveDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        label="À partir du"
                        description="Date de prise d'effet de cette politique"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Règles d'acquisition (Helpful) */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Règles d'acquisition</CardTitle>
                    <CardDescription>
                      Configurez comment les congés sont accumulés
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Compliance Warnings */}
                {validation && !validation.isCompliant && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Non conforme</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {validation.violations
                          .filter((v) => v.severity === 'critical')
                          .map((v, i) => (
                            <li key={i}>{v.message}</li>
                          ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="accrualMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Méthode d'acquisition</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="space-y-3"
                        >
                          <div className="flex items-center space-x-2 rounded-lg border p-4">
                            <RadioGroupItem value="accrued_monthly" id="monthly" />
                            <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                              <div className="font-medium">Mensuelle</div>
                              <div className="text-sm text-muted-foreground">
                                Acquisition progressive chaque mois
                              </div>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 rounded-lg border p-4">
                            <RadioGroupItem value="fixed" id="anniversary" />
                            <Label htmlFor="anniversary" className="flex-1 cursor-pointer">
                              <div className="font-medium">À la date d'anniversaire</div>
                              <div className="text-sm text-muted-foreground">
                                Montant complet une fois par an
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accrualRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux d'acquisition</FormLabel>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min={legalMinimums?.annualLeave.accrualRate || 2.0}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          jours/mois
                        </span>
                        <LegalMinimumDisplay
                          minimum={legalMinimums?.annualLeave.accrualRate || 2.0}
                          unit="jours/mois"
                          reference={legalMinimums?.annualLeave.legalReference}
                        />
                      </div>
                      <FormDescription>
                        {field.value && `= ${(field.value * 12).toFixed(1)} jours par an`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="requiresApproval"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Approbation du manager</FormLabel>
                        <FormDescription>
                          Requiert l'approbation avant validation
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="h-6 w-6"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="advanceNoticeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Préavis (jours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Nombre de jours de préavis requis pour les demandes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Options avancées (Expert - Collapsible) */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Options avancées</CardTitle>
                    <CardDescription>
                      Configuration optionnelle pour des besoins spécifiques
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Collapsible className="space-y-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px] justify-between"
                    >
                      <span>Options avancées (facultatif)</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 pt-4">
                    <FormField
                      control={form.control}
                      name="maxBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Solde maximum (jours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="48"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              value={field.value || ''}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Limite maximale de report (laissez vide pour illimité)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minDaysPerRequest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum par demande (jours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              value={field.value || ''}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Durée minimale d'une demande de congé
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxDaysPerRequest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum par demande (jours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="30"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              value={field.value || ''}
                              className="min-h-[48px]"
                            />
                          </FormControl>
                          <FormDescription>
                            Durée maximale d'une demande de congé
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="blackoutPeriods"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Périodes interdites (JSON)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder='[{"start": "2025-12-20", "end": "2025-12-31", "reason": "Période de fin d\'année"}]'
                              className="font-mono text-sm"
                              rows={4}
                            />
                          </FormControl>
                          <FormDescription>
                            Format: tableau JSON avec start, end, reason
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Summary */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium text-sm">Résumé de la politique</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {form.watch('policyType') === 'annual_leave' && 'Congés payés annuels'}
                        {form.watch('policyType') === 'sick_leave' && 'Congé maladie'}
                        {form.watch('policyType') === 'maternity' && 'Congé de maternité'}
                        {form.watch('policyType') === 'paternity' && 'Congé de paternité'}
                        {form.watch('policyType') === 'unpaid' && 'Personnalisé'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Acquisition</p>
                      <p className="font-medium">
                        {form.watch('accrualRate')} jours/mois = {(form.watch('accrualRate') * 12).toFixed(1)} jours/an
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Approbation</p>
                      <p className="font-medium">
                        {form.watch('requiresApproval') ? 'Requise' : 'Non requise'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Préavis</p>
                      <p className="font-medium">
                        {form.watch('advanceNoticeDays')} jours
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-4">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="min-h-[56px] gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Précédent
              </Button>
            )}

            <div className="flex-1" />

            {step < 3 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="min-h-[56px] gap-2"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="min-h-[56px] gap-2"
              >
                <Check className="h-4 w-4" />
                {createMutation.isPending ? 'Création...' : 'Créer la politique'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
