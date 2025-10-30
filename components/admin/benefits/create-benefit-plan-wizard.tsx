/**
 * Create Benefit Plan Wizard
 *
 * Simple 3-step wizard for creating benefit plans following HCI principles:
 * 1. Basic info (type, name, provider)
 * 2. Costs (employee/employer split)
 * 3. Eligibility and activation
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check } from 'lucide-react';

const formSchema = z.object({
  // Step 1: Basic Info
  planName: z.string().min(1, 'Le nom du plan est requis'),
  planCode: z.string().min(1, 'Le code du plan est requis'),
  benefitType: z.enum(['health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other']),
  providerName: z.string().optional(),
  description: z.string().optional(),

  // Step 2: Costs
  employeeCost: z.string().optional(),
  employerCost: z.string().optional(),
  currency: z.string(),
  costFrequency: z.enum(['monthly', 'annual', 'per_payroll']),

  // Step 3: Eligibility
  eligibleEmployeeTypes: z.array(z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'])).optional(),
  waitingPeriodDays: z.number().int().min(0),
  effectiveFrom: z.string().min(1, 'La date de début est requise'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateBenefitPlanWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateBenefitPlanWizard({
  onSuccess,
  onCancel,
}: CreateBenefitPlanWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      planName: '',
      planCode: '',
      benefitType: 'health',
      providerName: '',
      description: '',
      employeeCost: '',
      employerCost: '',
      currency: 'XOF',
      costFrequency: 'monthly',
      eligibleEmployeeTypes: [],
      waitingPeriodDays: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      isActive: true,
    },
  });

  const createMutation = api.benefits.createPlan.useMutation({
    onSuccess: () => {
      toast({
        title: 'Plan créé',
        description: 'Le plan d\'avantages a été créé avec succès',
      });
      // Invalidate the benefits list query to refresh the data
      queryClient.invalidateQueries({ queryKey: [['benefits', 'listPlans']] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    // Calculate total cost
    const employeeCost = values.employeeCost ? parseFloat(values.employeeCost) : 0;
    const employerCost = values.employerCost ? parseFloat(values.employerCost) : 0;
    const totalCost = employeeCost + employerCost;

    createMutation.mutate({
      ...values,
      totalCost: totalCost > 0 ? totalCost.toString() : undefined,
    });
  };

  const handleNext = async () => {
    const fields = step === 1
      ? ['planName', 'planCode', 'benefitType']
      : step === 2
      ? ['currency', 'costFrequency']
      : [];

    const isValid = await form.trigger(fields as any);
    if (isValid) {
      setStep((prev) => Math.min(3, prev + 1) as 1 | 2 | 3);
    }
  };

  const handlePrevious = () => {
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Informations de Base</h3>
              <p className="text-sm text-muted-foreground">
                Définissez le type et les détails du plan
              </p>
            </div>

            <FormField
              control={form.control}
              name="benefitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Type d'Avantage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="health">Santé</SelectItem>
                      <SelectItem value="dental">Dentaire</SelectItem>
                      <SelectItem value="vision">Vision</SelectItem>
                      <SelectItem value="life_insurance">Assurance Vie</SelectItem>
                      <SelectItem value="retirement">Retraite</SelectItem>
                      <SelectItem value="disability">Invalidité</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="meal">Restauration</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="planName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Nom du Plan</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CMU Basique, Assurance Vie Premium"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="planCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Code du Plan</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CMU-001, AVP-001"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Code unique pour identifier le plan
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="providerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fournisseur (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CGRAE, NSIA, Allianz"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Décrivez les couvertures et avantages de ce plan"
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Step 2: Costs */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Coûts</h3>
              <p className="text-sm text-muted-foreground">
                Définissez la répartition des coûts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devise</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fréquence</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="annual">Annuel</SelectItem>
                        <SelectItem value="per_payroll">Par Paie</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="employeeCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Coût Employé</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Montant payé par l'employé (peut être 0)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employerCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Coût Employeur</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Montant payé par l'employeur
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cost Summary */}
            {(form.watch('employeeCost') || form.watch('employerCost')) && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">Récapitulatif des Coûts:</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Employé:</span>
                    <span>{form.watch('employeeCost') || '0'} {form.watch('currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employeur:</span>
                    <span>{form.watch('employerCost') || '0'} {form.watch('currency')}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>
                      {(parseFloat(form.watch('employeeCost') || '0') +
                        parseFloat(form.watch('employerCost') || '0')).toFixed(2)} {form.watch('currency')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Eligibility */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Éligibilité et Activation</h3>
              <p className="text-sm text-muted-foreground">
                Définissez qui peut bénéficier de ce plan
              </p>
            </div>

            <FormField
              control={form.control}
              name="eligibleEmployeeTypes"
              render={() => (
                <FormItem>
                  <FormLabel className="text-lg">Types d'Employés Éligibles</FormLabel>
                  <FormDescription>
                    Laissez vide pour rendre le plan disponible à tous
                  </FormDescription>
                  <div className="space-y-3 mt-3">
                    {['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'].map((type) => (
                      <FormField
                        key={type}
                        control={form.control}
                        name="eligibleEmployeeTypes"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(type as any)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, type]);
                                  } else {
                                    field.onChange(current.filter((t) => t !== type));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {type}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="waitingPeriodDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Période d'Attente (jours)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Nombre de jours avant que la couverture ne devienne active
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
                  <FormLabel className="text-lg">Date de Début</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    À partir de quand ce plan est disponible
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Activer ce plan immédiatement
                    </FormLabel>
                    <FormDescription>
                      Les employés pourront s'inscrire dès la création
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-6 border-t">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              className="flex-1 min-h-[48px]"
            >
              Précédent
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="flex-1 min-h-[48px]"
            >
              Suivant
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 min-h-[56px] gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Créer le Plan
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
