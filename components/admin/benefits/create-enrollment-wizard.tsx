/**
 * Create Enrollment Wizard
 *
 * Simple 2-step wizard for enrolling employees in benefit plans:
 * 1. Select employee and plan
 * 2. Enrollment details (dates, coverage, enrollment number)
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  employeeId: z.string().uuid('Veuillez sélectionner un employé'),
  benefitPlanId: z.string().uuid('Veuillez sélectionner un plan'),
  enrollmentDate: z.string().min(1, 'La date d\'inscription est requise'),
  effectiveDate: z.string().min(1, 'La date d\'effet est requise'),
  enrollmentNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateEnrollmentWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateEnrollmentWizard({
  onSuccess,
  onCancel,
}: CreateEnrollmentWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      benefitPlanId: '',
      enrollmentDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      enrollmentNumber: '',
      policyNumber: '',
      coverageLevel: undefined,
      notes: '',
    },
  });

  // Fetch employees
  const { data: employees, isLoading: loadingEmployees } = api.employees.list.useQuery({
    status: 'active',
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
      ...values,
      enrollmentStatus: 'active',
    });
  };

  const handleNext = async () => {
    const fields = step === 1 ? ['employeeId', 'benefitPlanId'] : [];
    const isValid = await form.trigger(fields as any);
    if (isValid) {
      setStep(2);
    }
  };

  const handlePrevious = () => {
    setStep(1);
  };

  if (loadingEmployees || loadingPlans) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Select Employee and Plan */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Employé et Plan</h3>
              <p className="text-sm text-muted-foreground">
                Sélectionnez l'employé et le plan d'avantages
              </p>
            </div>

            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Employé</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez un employé" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(employees?.employees || []).map((employee: any) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                          {employee.employeeNumber && ` (${employee.employeeNumber})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.planName} ({plan.planCode})
                        </SelectItem>
                      ))}
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
          </div>
        )}

        {/* Step 2: Enrollment Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Détails d'Inscription</h3>
              <p className="text-sm text-muted-foreground">
                Configurez les détails de l'inscription
              </p>
            </div>

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
              name="policyNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de Police (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Numéro de police d'assurance"
                      className="min-h-[48px]"
                    />
                  </FormControl>
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
          {step < 2 ? (
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
                  Inscription...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Inscrire l'Employé
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
