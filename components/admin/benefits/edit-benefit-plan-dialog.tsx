/**
 * Edit Benefit Plan Dialog
 *
 * Dialog for editing an existing benefit plan.
 * Uses a simplified form (not wizard) for quick edits.
 */

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formSchema = z.object({
  planName: z.string().min(1, 'Le nom du plan est requis'),
  description: z.string().optional(),
  providerName: z.string().optional(),
  employeeCost: z.string().optional(),
  employerCost: z.string().optional(),
  costFrequency: z.enum(['monthly', 'annual', 'per_payroll']),
  eligibleEmployeeTypes: z.array(z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'])).optional(),
  waitingPeriodDays: z.number().int().min(0),
  effectiveFrom: z.string().min(1, 'La date de début est requise'),
  effectiveTo: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface BenefitPlan {
  id: string;
  planName: string;
  planCode: string;
  benefitType: string;
  description: string | null;
  providerName: string | null;
  employeeCost: string | null;
  employerCost: string | null;
  totalCost: string | null;
  currency: string | null;
  costFrequency: string;
  eligibleEmployeeTypes: string[] | null;
  waitingPeriodDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

interface EditBenefitPlanDialogProps {
  plan: BenefitPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditBenefitPlanDialog({
  plan,
  open,
  onOpenChange,
  onSuccess,
}: EditBenefitPlanDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      planName: plan.planName,
      description: plan.description || '',
      providerName: plan.providerName || '',
      employeeCost: plan.employeeCost || '',
      employerCost: plan.employerCost || '',
      costFrequency: plan.costFrequency as 'monthly' | 'annual' | 'per_payroll',
      eligibleEmployeeTypes: (plan.eligibleEmployeeTypes as ('LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE')[]) || [],
      waitingPeriodDays: plan.waitingPeriodDays || 0,
      effectiveFrom: plan.effectiveFrom,
      effectiveTo: plan.effectiveTo || '',
      isActive: plan.isActive,
    },
  });

  // Reset form when plan changes
  useEffect(() => {
    if (open) {
      form.reset({
        planName: plan.planName,
        description: plan.description || '',
        providerName: plan.providerName || '',
        employeeCost: plan.employeeCost || '',
        employerCost: plan.employerCost || '',
        costFrequency: plan.costFrequency as 'monthly' | 'annual' | 'per_payroll',
        eligibleEmployeeTypes: (plan.eligibleEmployeeTypes as ('LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE')[]) || [],
        waitingPeriodDays: plan.waitingPeriodDays || 0,
        effectiveFrom: plan.effectiveFrom,
        effectiveTo: plan.effectiveTo || '',
        isActive: plan.isActive,
      });
    }
  }, [plan, open, form]);

  const updateMutation = api.benefits.updatePlan.useMutation({
    onSuccess: () => {
      toast({
        title: 'Plan modifié',
        description: 'Le plan d\'avantages a été mis à jour avec succès',
      });
      queryClient.invalidateQueries({ queryKey: [['benefits', 'listPlans']] });
      onOpenChange(false);
      onSuccess?.();
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

    updateMutation.mutate({
      id: plan.id,
      ...values,
      totalCost: totalCost > 0 ? totalCost.toString() : undefined,
      effectiveTo: values.effectiveTo || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le Plan</DialogTitle>
          <DialogDescription>
            {plan.planCode} - {plan.planName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="costs">Coûts</TabsTrigger>
                <TabsTrigger value="eligibility">Éligibilité</TabsTrigger>
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="planName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du Plan</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: CMU Basique"
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="providerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fournisseur</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: CGRAE, NSIA"
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Décrivez les avantages de ce plan"
                          className="min-h-[100px]"
                        />
                      </FormControl>
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
                          Plan actif
                        </FormLabel>
                        <FormDescription>
                          Les employés peuvent s'inscrire à ce plan
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Costs Tab */}
              <TabsContent value="costs" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="costFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fréquence</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employeeCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coût Employé ({plan.currency || 'XOF'})</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employerCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coût Employeur ({plan.currency || 'XOF'})</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Cost Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-2">Récapitulatif:</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Employé:</span>
                      <span>{form.watch('employeeCost') || '0'} {plan.currency || 'XOF'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Employeur:</span>
                      <span>{form.watch('employerCost') || '0'} {plan.currency || 'XOF'}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span>
                        {(parseFloat(form.watch('employeeCost') || '0') +
                          parseFloat(form.watch('employerCost') || '0')).toFixed(2)} {plan.currency || 'XOF'}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Eligibility Tab */}
              <TabsContent value="eligibility" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="eligibleEmployeeTypes"
                  render={() => (
                    <FormItem>
                      <FormLabel>Types d'Employés Éligibles</FormLabel>
                      <FormDescription>
                        Laissez vide pour tous les employés
                      </FormDescription>
                      <div className="space-y-3 mt-3">
                        {(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'] as const).map((type) => (
                          <FormField
                            key={type}
                            control={form.control}
                            name="eligibleEmployeeTypes"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(type)}
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
                        Nombre de jours avant activation de la couverture
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="effectiveFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de Début</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="effectiveTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de Fin (optionnel)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            className="min-h-[48px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="min-h-[48px] gap-2"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
