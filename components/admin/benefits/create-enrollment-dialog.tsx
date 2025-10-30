/**
 * Create Enrollment Dialog
 *
 * Simplified enrollment dialog pre-filled with employee info.
 * Used when adding benefits from the employee benefits table.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, Check, Heart, Smile, Eye, Shield, PiggyBank, AlertCircle, Car, UtensilsCrossed, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  benefitPlanId: z.string().uuid('Veuillez sélectionner un plan'),
  enrollmentDate: z.string().min(1, 'La date d\'inscription est requise'),
  effectiveDate: z.string().min(1, 'La date d\'effet est requise'),
  enrollmentNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: () => void;
}

const benefitTypeIcons = {
  health: Heart,
  dental: Smile,
  vision: Eye,
  life_insurance: Shield,
  retirement: PiggyBank,
  disability: AlertCircle,
  transport: Car,
  meal: UtensilsCrossed,
  other: Package,
};

export function CreateEnrollmentDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: CreateEnrollmentDialogProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      benefitPlanId: '',
      enrollmentDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      enrollmentNumber: '',
      policyNumber: '',
      coverageLevel: undefined,
      notes: '',
    },
  });

  // Fetch benefit plans
  const { data: plans, isLoading: loadingPlans } = api.benefits.listPlans.useQuery({
    isActive: true,
  });

  // Get selected plan details
  useEffect(() => {
    const planId = form.watch('benefitPlanId');
    if (planId && plans) {
      const plan = plans.find(p => p.id === planId);
      setSelectedPlan(plan);

      // Auto-calculate effective date based on waiting period
      if (plan?.waitingPeriodDays) {
        const enrollmentDate = new Date(form.watch('enrollmentDate'));
        const effectiveDate = new Date(enrollmentDate);
        effectiveDate.setDate(effectiveDate.getDate() + plan.waitingPeriodDays);
        form.setValue('effectiveDate', effectiveDate.toISOString().split('T')[0]);
      }
    }
  }, [form.watch('benefitPlanId'), form.watch('enrollmentDate'), plans]);

  const createMutation = api.benefits.createEnrollment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Inscription créée',
        description: 'L\'employé a été inscrit au plan avec succès',
      });
      form.reset();
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
    createMutation.mutate({
      employeeId,
      benefitPlanId: values.benefitPlanId,
      enrollmentDate: values.enrollmentDate,
      effectiveDate: values.effectiveDate,
      enrollmentNumber: values.enrollmentNumber?.trim() || undefined,
      policyNumber: values.policyNumber?.trim() || undefined,
      coverageLevel: values.coverageLevel || undefined,
      notes: values.notes?.trim() || undefined,
      enrollmentStatus: 'active',
    });
  };

  if (loadingPlans) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chargement...</DialogTitle>
            <DialogDescription>
              Chargement des plans d'avantages
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrire un Employé</DialogTitle>
          <DialogDescription>
            Inscrire {employeeName} à un plan d'avantages
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Plan Selection */}
            <FormField
              control={form.control}
              name="benefitPlanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Plan d'Avantages</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez un plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plans?.map((plan) => {
                        const Icon = benefitTypeIcons[plan.benefitType as keyof typeof benefitTypeIcons] || Package;
                        return (
                          <SelectItem key={plan.id} value={plan.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {plan.planName} ({plan.planCode})
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show plan details */}
            {selectedPlan && (
              <Alert>
                <AlertDescription className="space-y-2">
                  <div className="font-medium">Détails du Plan:</div>
                  <div className="text-sm space-y-1">
                    <div>Type: {selectedPlan.benefitType}</div>
                    {selectedPlan.providerName && (
                      <div>Fournisseur: {selectedPlan.providerName}</div>
                    )}
                    {selectedPlan.waitingPeriodDays > 0 && (
                      <div>Période d'attente: {selectedPlan.waitingPeriodDays} jours</div>
                    )}
                    {selectedPlan.employeeCost && (
                      <div>Coût employé: {selectedPlan.employeeCost} {selectedPlan.currency}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enrollmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date d'Inscription</FormLabel>
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
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date d'Effet</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      {selectedPlan?.waitingPeriodDays > 0 &&
                        `Calculée automatiquement (${selectedPlan.waitingPeriodDays} jours après inscription)`
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Optional Fields */}
            <FormField
              control={form.control}
              name="enrollmentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro d'Inscription (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: N° CMU, N° de police"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro externe d'inscription (N° CMU pour la Côte d'Ivoire, par exemple)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverageLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niveau de Couverture (optionnel)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez un niveau" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individuel</SelectItem>
                      <SelectItem value="family">Familial</SelectItem>
                      <SelectItem value="employee_spouse">Employé + Conjoint</SelectItem>
                      <SelectItem value="employee_children">Employé + Enfants</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notes ou informations supplémentaires"
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 min-h-[56px] gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Inscription...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Inscrire l'Employé
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
