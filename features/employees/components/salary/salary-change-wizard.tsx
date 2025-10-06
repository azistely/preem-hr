/**
 * Salary Change Wizard
 *
 * Multi-step wizard for changing employee salary
 * Following HCI principles:
 * - Task-oriented design ("Changer un salaire")
 * - Progressive disclosure (3-5 simple steps)
 * - Error prevention (real-time SMIG validation)
 * - Smart defaults (effective date, reason)
 * - Immediate feedback (visual confirmation)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  FileText,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/trpc/client';
import { useSalaryValidation, formatCurrency } from '../../hooks/use-salary-validation';
import { SalaryComparisonCard } from './salary-comparison-card';
import { toast } from 'sonner';

// Validation schema
const salaryChangeSchema = z.object({
  newBaseSalary: z.number().min(1, 'Le salaire de base est requis'),
  housingAllowance: z.number().optional(),
  transportAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
  effectiveFrom: z.string(),
  changeReason: z.string().min(1, 'La raison du changement est requise'),
  notes: z.string().optional(),
});

type SalaryChangeFormData = z.infer<typeof salaryChangeSchema>;

interface SalaryChangeWizardProps {
  employeeId: string;
  currentSalary: {
    baseSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    mealAllowance?: number;
  };
  employeeName: string;
  onSuccess?: () => void;
}

const CHANGE_REASONS = [
  { value: 'promotion', label: 'Promotion' },
  { value: 'annual_review', label: 'Révision annuelle' },
  { value: 'market_adjustment', label: 'Ajustement au marché' },
  { value: 'cost_of_living', label: 'Ajustement coût de la vie' },
  { value: 'merit_increase', label: 'Augmentation au mérite' },
  { value: 'correction', label: 'Correction' },
  { value: 'other', label: 'Autre' },
];

export function SalaryChangeWizard({
  employeeId,
  currentSalary,
  employeeName,
  onSuccess,
}: SalaryChangeWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Smart default: First day of next month
  const defaultEffectiveDate = startOfMonth(addMonths(new Date(), 1));

  const form = useForm<SalaryChangeFormData>({
    resolver: zodResolver(salaryChangeSchema),
    defaultValues: {
      newBaseSalary: currentSalary.baseSalary,
      housingAllowance: currentSalary.housingAllowance || 0,
      transportAllowance: currentSalary.transportAllowance || 0,
      mealAllowance: currentSalary.mealAllowance || 0,
      effectiveFrom: format(defaultEffectiveDate, 'yyyy-MM-dd'),
      changeReason: '',
      notes: '',
    },
  });

  const watchedSalary = form.watch('newBaseSalary');
  const watchedHousing = form.watch('housingAllowance') || 0;
  const watchedTransport = form.watch('transportAllowance') || 0;
  const watchedMeal = form.watch('mealAllowance') || 0;

  // Real-time SMIG validation
  const { validationResult, isLoading: validatingSmig } = useSalaryValidation(watchedSalary);

  const totalNewSalary = watchedSalary + watchedHousing + watchedTransport + watchedMeal;
  const totalCurrentSalary =
    currentSalary.baseSalary +
    (currentSalary.housingAllowance || 0) +
    (currentSalary.transportAllowance || 0) +
    (currentSalary.mealAllowance || 0);

  // Mutation
  const changeSalaryMutation = api.salaries.change.useMutation({
    onSuccess: () => {
      toast.success('Salaire modifié avec succès');
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/employees/${employeeId}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: SalaryChangeFormData) => {
    changeSalaryMutation.mutate({
      employeeId,
      ...data,
    });
  };

  const canProceedToStep2 =
    !!watchedSalary && validationResult?.isValid && !validatingSmig;
  const canProceedToStep3 = canProceedToStep2 && !!form.watch('effectiveFrom');
  const canSubmit = canProceedToStep3 && !!form.watch('changeReason');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-1 w-12 mx-2 ${
                  s < step ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Salaire et indemnités */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>Nouveau salaire</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Pour: {employeeName}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Base Salary */}
                <FormField
                  control={form.control}
                  name="newBaseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg">Salaire de base *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="75000"
                            className="min-h-[56px] text-2xl font-bold pr-16"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                            FCFA
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        {validationResult?.minimumWage && (
                          <span className="text-sm">
                            SMIG minimum: {formatCurrency(validationResult.minimumWage)}
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                      {/* Real-time SMIG validation */}
                      {validationResult && !validationResult.isValid && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-destructive font-medium">
                            {validationResult.errorMessage}
                          </p>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Allowances */}
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="housingAllowance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indemnité de logement</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="min-h-[48px]"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transportAllowance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indemnité de transport</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="min-h-[48px]"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mealAllowance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indemnité de repas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="min-h-[48px]"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Total */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Salaire brut total</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(totalNewSalary)}
                    </span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                    className="min-h-[48px] min-w-[120px]"
                  >
                    Suivant
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Date d'effet */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-primary" />
                  <CardTitle>Date d'effet</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg">
                        À partir de quand?
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="min-h-[56px] text-lg"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Habituellement le 1er du mois suivant
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* Navigation */}
                <div className="flex justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="min-h-[48px]"
                  >
                    Retour
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!canProceedToStep3}
                    className="min-h-[48px] min-w-[120px]"
                  >
                    Suivant
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Raison et notes */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <CardTitle>Raison du changement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="changeReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg">Pourquoi ce changement? *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="min-h-[56px] text-lg">
                            <SelectValue placeholder="Sélectionnez une raison" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHANGE_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes additionnelles (optionnel)</FormLabel>
                      <FormControl>
                        <textarea
                          className="w-full min-h-[120px] p-3 border rounded-md"
                          placeholder="Détails supplémentaires..."
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Navigation */}
                <div className="flex justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="min-h-[48px]"
                  >
                    Retour
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(4)}
                    disabled={!canSubmit}
                    className="min-h-[48px] min-w-[120px]"
                  >
                    Suivant
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-primary" />
                    <CardTitle>Confirmer le changement</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Salary Comparison */}
                  <SalaryComparisonCard
                    oldSalary={totalCurrentSalary}
                    newSalary={totalNewSalary}
                    label="Salaire brut total"
                  />

                  {/* Details Summary */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm text-muted-foreground">Employé</Label>
                      <p className="text-lg font-semibold">{employeeName}</p>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">Date d'effet</Label>
                      <p className="text-lg font-semibold">
                        {format(
                          new Date(form.watch('effectiveFrom')),
                          'd MMMM yyyy',
                          { locale: fr }
                        )}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-sm text-muted-foreground">Raison</Label>
                      <p className="text-lg font-semibold">
                        {CHANGE_REASONS.find(
                          (r) => r.value === form.watch('changeReason')
                        )?.label}
                      </p>
                    </div>

                    {form.watch('notes') && (
                      <div className="md:col-span-2">
                        <Label className="text-sm text-muted-foreground">Notes</Label>
                        <p className="text-base">{form.watch('notes')}</p>
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(3)}
                      className="min-h-[48px]"
                      disabled={changeSalaryMutation.isPending}
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={changeSalaryMutation.isPending}
                      className="min-h-[56px] min-w-[180px] bg-green-600 hover:bg-green-700"
                    >
                      {changeSalaryMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Confirmer le changement
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
