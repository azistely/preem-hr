'use client';

/**
 * New Payroll Run Creation Page (Wizard)
 *
 * Multi-step wizard for creating payroll runs:
 * 1. Period Selection - Choose dates and payment date
 * 2. Employee Preview - Validate time entries for daily workers
 * 3. Confirmation - Review and create the run
 *
 * HCI Improvements:
 * - Error prevention: Validates time entries before calculation
 * - Immediate feedback: Shows which employees are ready
 * - Task-oriented: Guides user through the process
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths, startOfMonth, endOfMonth, parseISO, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, ArrowLeft, Loader2, AlertCircle, Check } from 'lucide-react';
import { api } from '@/trpc/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wizard, WizardStep } from '@/components/wizard/wizard';
import { EmployeePreviewStep } from './components/employee-preview-step';
import { PaymentFrequencyStep, PaymentFrequency, validatePaymentFrequency } from './components/payment-frequency-step';

// Form validation schema
const formSchema = z.object({
  countryCode: z.string().length(2, { message: 'Sélectionnez un pays' }),
  periodStart: z.string().min(1, { message: 'Date de début requise' }),
  periodEnd: z.string().min(1, { message: 'Date de fin requise' }),
  paymentDate: z.string().min(1, { message: 'Date de paiement requise' }),
  name: z.string().optional(),
  paymentFrequency: z.enum(['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY']).default('MONTHLY'),
  closureSequence: z.number().int().min(1).max(4).nullable().optional(),
}).refine(
  (data) => {
    // Compare as strings (YYYY-MM-DD format sorts correctly)
    return data.periodStart < data.periodEnd;
  },
  {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['periodEnd'],
  }
);

type FormValues = z.infer<typeof formSchema> & {
  paymentFrequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
};

export default function NewPayrollRunPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0); // Start at 0 (employee preview)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodEdit, setShowPeriodEdit] = useState(false);

  // Get authenticated user from auth context
  const { data: user } = api.auth.me.useQuery();
  const tenantId = user?.tenantId;
  const userId = user?.id;

  // Load available countries and tenant info
  const { data: availableCountries, isLoading: countriesLoading } = api.payroll.getAvailableCountries.useQuery();
  const { data: tenant } = api.tenant.getCurrent.useQuery();

  // Auto-calculate smart default period (monthly)
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const nextMonthStart = addMonths(currentMonthStart, 1);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any, // Type cast due to Zod .default() creating optional types
    defaultValues: {
      countryCode: tenant?.countryCode || 'CI',
      periodStart: format(currentMonthStart, 'yyyy-MM-dd'),
      periodEnd: format(currentMonthEnd, 'yyyy-MM-dd'),
      paymentDate: format(addMonths(nextMonthStart, 0).setDate(5), 'yyyy-MM-dd'),
      name: `Paie ${format(currentMonthStart, 'MMMM yyyy', { locale: fr })}`,
      paymentFrequency: 'MONTHLY' as const,
      closureSequence: null,
    },
  });

  // Create run mutation
  const createRun = api.payroll.createRun.useMutation({
    onSuccess: (data) => {
      // Redirect to run detail page
      router.push(`/payroll/runs/${data.id}`);
    },
    onError: (error) => {
      setError(error.message);
      setIsSubmitting(false);
    },
  });

  const handleCancel = () => {
    router.back();
  };

  // Quick fill buttons
  const fillCurrentMonth = () => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    form.setValue('periodStart', format(start, 'yyyy-MM-dd'));
    form.setValue('periodEnd', format(end, 'yyyy-MM-dd'));
    form.setValue('paymentDate', format(addMonths(start, 1).setDate(5), 'yyyy-MM-dd'));
    form.setValue('name', `Paie ${format(start, 'MMMM yyyy', { locale: fr })}`);
  };

  const fillLastMonth = () => {
    const start = startOfMonth(addMonths(new Date(), -1));
    const end = endOfMonth(addMonths(new Date(), -1));
    form.setValue('periodStart', format(start, 'yyyy-MM-dd'));
    form.setValue('periodEnd', format(end, 'yyyy-MM-dd'));
    form.setValue('paymentDate', format(addMonths(start, 1).setDate(5), 'yyyy-MM-dd'));
    form.setValue('name', `Paie ${format(start, 'MMMM yyyy', { locale: fr })}`);
  };

  const fillCurrentWeek = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday
    form.setValue('periodStart', format(start, 'yyyy-MM-dd'));
    form.setValue('periodEnd', format(end, 'yyyy-MM-dd'));
    form.setValue('paymentDate', format(addDays(end, 2), 'yyyy-MM-dd')); // Payment 2 days after period end
    form.setValue('name', `Paie semaine du ${format(start, 'd MMM', { locale: fr })}`);
  };

  const fillLastWeek = () => {
    const lastWeekDate = subWeeks(new Date(), 1);
    const start = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
    const end = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
    form.setValue('periodStart', format(start, 'yyyy-MM-dd'));
    form.setValue('periodEnd', format(end, 'yyyy-MM-dd'));
    form.setValue('paymentDate', format(addDays(end, 2), 'yyyy-MM-dd'));
    form.setValue('name', `Paie semaine du ${format(start, 'd MMM', { locale: fr })}`);
  };

  const fillLast2Weeks = () => {
    const twoWeeksAgo = subWeeks(new Date(), 2);
    const start = startOfWeek(twoWeeksAgo, { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    form.setValue('periodStart', format(start, 'yyyy-MM-dd'));
    form.setValue('periodEnd', format(end, 'yyyy-MM-dd'));
    form.setValue('paymentDate', format(addDays(end, 2), 'yyyy-MM-dd'));
    form.setValue('name', `Paie 2 semaines du ${format(start, 'd MMM', { locale: fr })}`);
  };

  // Handle final submission (Step 3)
  const handleComplete = async () => {
    if (!tenantId || !userId) {
      setError('Utilisateur non authentifié');
      return;
    }

    // Prevent submission if an existing run is detected
    if (existingRun) {
      setError(`Une paie existe déjà pour cette période (${existingRun.runNumber}). Veuillez modifier la période ou consulter la paie existante.`);
      return;
    }

    const values = form.getValues();

    try {
      setIsSubmitting(true);
      setError(null);

      await createRun.mutateAsync({
        tenantId,
        countryCode: values.countryCode,
        periodStart: parseISO(values.periodStart),
        periodEnd: parseISO(values.periodEnd),
        paymentDate: parseISO(values.paymentDate),
        name: values.name || undefined,
        createdBy: userId,
        paymentFrequency: values.paymentFrequency,
        closureSequence: values.closureSequence ?? undefined,
      });
    } catch (err) {
      console.error('Failed to create payroll run:', err);
      setIsSubmitting(false);
    }
  };

  // Get form values for preview and confirmation steps
  const formValues = form.watch();
  const periodStart = formValues.periodStart ? parseISO(formValues.periodStart) : currentMonthStart;
  const periodEnd = formValues.periodEnd ? parseISO(formValues.periodEnd) : currentMonthEnd;
  const paymentDate = formValues.paymentDate ? parseISO(formValues.paymentDate) : new Date();

  // Check for existing run
  const { data: existingRun } = api.payroll.checkExistingRun.useQuery(
    {
      tenantId: tenantId!,
      periodStart,
      periodEnd,
    },
    { enabled: !!tenantId }
  );

  // Wizard steps
  const wizardSteps: WizardStep[] = [
    // Step 1: Payment Frequency Selection
    {
      title: 'Fréquence de paiement',
      description: 'Sélectionnez la fréquence de paiement pour cette paie',
      content: (
        <PaymentFrequencyStep
          periodStart={periodStart}
          periodEnd={periodEnd}
          paymentFrequency={formValues.paymentFrequency}
          closureSequence={formValues.closureSequence ?? null}
          onPaymentFrequencyChange={(freq) => form.setValue('paymentFrequency', freq)}
          onClosureSequenceChange={(seq) => form.setValue('closureSequence', seq)}
        />
      ),
    },

    // Step 2: Employee Preview & Validation (with period editor)
    {
      title: 'Vérifiez les employés',
      description: 'Assurez-vous que tous les employés journaliers ont leurs heures saisies',
      content: (
        <div className="space-y-6">
          {/* Existing Run Warning */}
          {existingRun && (
            <Card className="border-blue-500 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Une paie existe déjà pour cette période
                    </h3>
                    <p className="text-sm text-blue-800 mb-4">
                      La paie <span className="font-mono font-semibold">{existingRun.runNumber}</span> couvre
                      la période du {format(new Date(existingRun.periodStart), 'd MMM', { locale: fr })} au{' '}
                      {format(new Date(existingRun.periodEnd), 'd MMM yyyy', { locale: fr })}.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => router.push(`/payroll/runs/${existingRun.id}`)}
                        className="min-h-[44px]"
                      >
                        Voir la paie existante
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowPeriodEdit(true)}
                        className="min-h-[44px]"
                      >
                        Modifier la période
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Display/Editor */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Période de paie</div>
                  <div className="text-2xl font-bold">
                    {format(periodStart, 'd MMM', { locale: fr })} - {format(periodEnd, 'd MMM yyyy', { locale: fr })}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Paiement le {format(paymentDate, 'd MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPeriodEdit(!showPeriodEdit)}
                  className="min-h-[44px]"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {showPeriodEdit ? 'Fermer' : 'Modifier'}
                </Button>
              </div>

              {/* Collapsible Period Editor */}
              {showPeriodEdit && (
                <div className="mt-6 pt-6 border-t space-y-4">
                  {/* Quick Fill Buttons */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Périodes courantes</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fillCurrentMonth}
                        size="sm"
                      >
                        Mois Actuel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fillLastMonth}
                        size="sm"
                      >
                        Mois Dernier
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fillLastWeek}
                        size="sm"
                      >
                        Semaine Dernière
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fillLast2Weeks}
                        size="sm"
                      >
                        2 Dernières Semaines
                      </Button>
                    </div>
                  </div>

                  {/* Manual Date Selection */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="periodStart">Date de début</Label>
                        <Input
                          id="periodStart"
                          type="date"
                          {...form.register('periodStart')}
                          className="min-h-[48px]"
                        />
                        {form.formState.errors.periodStart && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.periodStart.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="periodEnd">Date de fin</Label>
                        <Input
                          id="periodEnd"
                          type="date"
                          {...form.register('periodEnd')}
                          className="min-h-[48px]"
                        />
                        {form.formState.errors.periodEnd && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.periodEnd.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentDate">Date de paiement</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        {...form.register('paymentDate')}
                        className="min-h-[48px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        Date à laquelle les salaires seront versés aux employés
                      </p>
                      {form.formState.errors.paymentDate && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.paymentDate.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee Preview Component */}
          <EmployeePreviewStep
            periodStart={periodStart}
            periodEnd={periodEnd}
          />
        </div>
      ),
    },

    // Step 3: Confirmation
    {
      title: 'Confirmation',
      description: 'Vérifiez les informations avant de créer la paie',
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la paie</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <dt className="text-muted-foreground">Pays</dt>
                  <dd className="font-semibold">
                    {availableCountries?.find(c => c.code === formValues.countryCode)?.name || formValues.countryCode}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <dt className="text-muted-foreground">Fréquence de paiement</dt>
                  <dd className="font-semibold">
                    {formValues.paymentFrequency === 'MONTHLY' && 'Mensuel'}
                    {formValues.paymentFrequency === 'WEEKLY' && `Hebdomadaire - Semaine ${formValues.closureSequence}`}
                    {formValues.paymentFrequency === 'BIWEEKLY' && `Quinzaine ${formValues.closureSequence}`}
                    {formValues.paymentFrequency === 'DAILY' && 'Journalier'}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <dt className="text-muted-foreground">Période</dt>
                  <dd className="font-semibold">
                    {format(periodStart, 'd MMM', { locale: fr })} - {format(periodEnd, 'd MMM yyyy', { locale: fr })}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <dt className="text-muted-foreground">Date de paiement</dt>
                  <dd className="font-semibold">{format(paymentDate, 'd MMMM yyyy', { locale: fr })}</dd>
                </div>
                {formValues.name && (
                  <div className="flex justify-between items-center py-2">
                    <dt className="text-muted-foreground">Nom</dt>
                    <dd className="font-semibold">{formValues.name}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">À savoir</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• La paie sera créée en brouillon</li>
                <li>• Vous pourrez lancer le calcul sur la page suivante</li>
                <li>• Tous les employés actifs seront inclus automatiquement</li>
                <li>• Les employés journaliers seront payés selon leurs heures saisies</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Calendar className="h-8 w-8" />
          Nouvelle Paie
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          Vérifiez vos employés et créez la paie
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">Erreur</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wizard */}
      <Card>
        <CardContent className="pt-6">
          <Wizard
            steps={wizardSteps}
            onComplete={handleComplete}
            isSubmitting={isSubmitting || !!existingRun}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
          />
        </CardContent>
      </Card>
    </div>
  );
}
