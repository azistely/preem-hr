'use client';

/**
 * New Payroll Run Creation Page
 *
 * Allows payroll managers to create a new payroll run by:
 * - Selecting period start and end dates
 * - Selecting payment date
 * - Optionally providing a custom name
 * - Validating that no run exists for the selected period
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/trpc/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Form validation schema
const formSchema = z.object({
  countryCode: z.string().length(2, { message: 'Sélectionnez un pays' }),
  periodStart: z.string().min(1, { message: 'Date de début requise' }),
  periodEnd: z.string().min(1, { message: 'Date de fin requise' }),
  paymentDate: z.string().min(1, { message: 'Date de paiement requise' }),
  name: z.string().optional(),
}).refine(
  (data) => {
    const start = new Date(data.periodStart);
    const end = new Date(data.periodEnd);
    return start < end;
  },
  {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['periodEnd'],
  }
);

type FormValues = z.infer<typeof formSchema>;

export default function NewPayrollRunPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get authenticated user from auth context
  const { data: user } = api.auth.me.useQuery();
  const tenantId = user?.tenantId;
  const userId = user?.id;

  // Load available countries and tenant info
  const { data: availableCountries, isLoading: countriesLoading } = api.payroll.getAvailableCountries.useQuery();
  const { data: tenant } = api.tenant.getCurrent.useQuery();

  // Initialize form with current month defaults
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const nextMonthStart = addMonths(currentMonthStart, 1);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countryCode: tenant?.countryCode || 'CI',
      periodStart: format(currentMonthStart, 'yyyy-MM-dd'),
      periodEnd: format(currentMonthEnd, 'yyyy-MM-dd'),
      paymentDate: format(addMonths(nextMonthStart, 0).setDate(5), 'yyyy-MM-dd'),
      name: '',
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

  const onSubmit = async (values: FormValues) => {
    if (!tenantId || !userId) {
      setError('Utilisateur non authentifié');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await createRun.mutateAsync({
        tenantId,
        countryCode: values.countryCode,
        periodStart: new Date(values.periodStart),
        periodEnd: new Date(values.periodEnd),
        paymentDate: new Date(values.paymentDate),
        name: values.name || undefined,
        createdBy: userId,
      });
    } catch (err) {
      // Error handled by onError callback
      console.error('Failed to create payroll run:', err);
    }
  };

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Calendar className="h-8 w-8" />
          Nouvelle Paie
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          Créez un nouveau cycle de paie mensuel
        </p>
      </div>

      {/* Quick Fill Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={fillCurrentMonth}
          className="flex-1"
        >
          Mois Actuel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={fillLastMonth}
          className="flex-1"
        >
          Mois Dernier
        </Button>
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

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de la Paie</CardTitle>
          <CardDescription>
            Définissez la période de paie et la date de paiement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Country Selector */}
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Pays</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={countriesLoading}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px] text-lg">
                          <SelectValue placeholder="Sélectionnez le pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCountries?.map((country) => (
                          <SelectItem key={country.code} value={country.code} className="text-base py-3">
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Pays pour le calcul de la paie (détermine les règles fiscales et sociales)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Period Start */}
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Date de début</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Premier jour de la période de paie
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Period End */}
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Date de fin</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Dernier jour de la période de paie
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Date */}
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Date de paiement</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Date prévue pour le versement des salaires
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Nom (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Ex: Paie Janvier 2025"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Nom personnalisé pour identifier cette paie
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer la Paie'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="mt-6 bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">À savoir</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• La paie sera créée en brouillon</li>
            <li>• Vous pourrez lancer le calcul sur la page suivante</li>
            <li>• Tous les employés actifs seront inclus automatiquement</li>
            <li>• Les paies en brouillon peuvent être supprimées</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
