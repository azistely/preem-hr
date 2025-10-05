'use client';

/**
 * Payroll Calculator Page
 *
 * Interactive calculator for Côte d'Ivoire payroll calculations.
 * Designed for low digital literacy users with large touch targets and progressive disclosure.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/trpc/react';
import { fr } from '@/lib/i18n/fr';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const t = fr.payroll.calculator;

// Form validation schema
const formSchema = z.object({
  baseSalary: z.number().min(75000, { message: t.errorMinimumSalary }),
  housingAllowance: z.number().optional(),
  transportAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
  hasFamily: z.boolean(),
  sector: z.enum(['services', 'construction', 'agriculture', 'other']),
});

type FormValues = z.infer<typeof formSchema>;

export default function PayrollCalculatorPage() {
  const [showDetails, setShowDetails] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      baseSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      mealAllowance: 0,
      hasFamily: false,
      sector: 'services',
    },
  });

  // tRPC query for payroll calculation
  const calculate = api.payroll.calculate.useQuery(
    {
      employeeId: '00000000-0000-0000-0000-000000000000', // Dummy ID for calculator
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      baseSalary: form.watch('baseSalary') || 0,
      housingAllowance: form.watch('housingAllowance') || 0,
      transportAllowance: form.watch('transportAllowance') || 0,
      mealAllowance: form.watch('mealAllowance') || 0,
      hasFamily: form.watch('hasFamily') || false,
      sector: form.watch('sector') || 'services',
    },
    {
      enabled: form.watch('baseSalary') >= 75000, // Only run when valid
      retry: false,
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  const onSubmit = (values: FormValues) => {
    // Trigger calculation by enabling the query
    calculate.refetch();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Calculator className="h-8 w-8" />
          {t.title}
        </h1>
        <p className="text-muted-foreground text-lg">{t.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informations Salariales</CardTitle>
            <CardDescription>Saisissez les informations de l&apos;employé</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Base Salary */}
                <FormField
                  control={form.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">{t.baseSalary}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t.baseSalaryPlaceholder}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="touch-target text-lg"
                        />
                      </FormControl>
                      <FormDescription>{t.baseSalaryHelper}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Housing Allowance */}
                <FormField
                  control={form.control}
                  name="housingAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.housingAllowance}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t.housingAllowancePlaceholder}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="touch-target"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Transport Allowance */}
                <FormField
                  control={form.control}
                  name="transportAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.transportAllowance}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t.transportAllowancePlaceholder}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="touch-target"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Meal Allowance */}
                <FormField
                  control={form.control}
                  name="mealAllowance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.mealAllowance}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t.mealAllowancePlaceholder}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="touch-target"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Has Family */}
                <FormField
                  control={form.control}
                  name="hasFamily"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="touch-target" />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base">{t.hasFamily}</FormLabel>
                        <FormDescription>{t.hasFamilyHelper}</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Sector */}
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.sector}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="touch-target">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="services">{t.sectorServices}</SelectItem>
                          <SelectItem value="construction">{t.sectorConstruction}</SelectItem>
                          <SelectItem value="agriculture">{t.sectorAgriculture}</SelectItem>
                          <SelectItem value="other">{t.sectorOther}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full touch-target text-lg" size="lg" disabled={calculate.isLoading}>
                  {calculate.isLoading ? t.calculating : t.calculate}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.results}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {calculate.isError && (
                <div className="rounded-md bg-destructive/15 p-4 text-destructive">{t.errorCalculation}</div>
              )}

              {calculate.data && (
                <>
                  {/* Gross Salary */}
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">{t.grossSalary}</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(calculate.data.grossSalary)} {fr.payroll.fcfa}
                    </div>
                  </div>

                  <Separator />

                  {/* Net Salary */}
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">{t.netSalary}</div>
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(calculate.data.netSalary)} {fr.payroll.fcfa}
                    </div>
                  </div>

                  <Separator />

                  {/* Deductions Summary */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t.deductions}</div>
                    <div className="text-xl font-semibold text-destructive">
                      -{formatCurrency(calculate.data.totalDeductions)} {fr.payroll.fcfa}
                    </div>
                  </div>

                  {/* Progressive Disclosure: Details */}
                  <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full touch-target" size="lg">
                        {showDetails ? (
                          <>
                            <ChevronUp className="mr-2 h-4 w-4" />
                            {t.hideDetails}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-2 h-4 w-4" />
                            {t.showDetails}
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      {/* Deductions Breakdown */}
                      <div className="space-y-2 rounded-md border p-4">
                        <div className="font-medium mb-2">Détails des déductions</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t.cnpsEmployee}</span>
                            <span className="font-mono">
                              -{formatCurrency(calculate.data.cnpsEmployee)} {fr.payroll.fcfa}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t.cmuEmployee}</span>
                            <span className="font-mono">
                              -{formatCurrency(calculate.data.cmuEmployee)} {fr.payroll.fcfa}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t.its}</span>
                            <span className="font-mono">
                              -{formatCurrency(calculate.data.its)} {fr.payroll.fcfa}
                            </span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>{t.totalDeductions}</span>
                            <span className="font-mono">
                              -{formatCurrency(calculate.data.totalDeductions)} {fr.payroll.fcfa}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Employer Costs */}
                      <div className="space-y-2 rounded-md border p-4 bg-muted/50">
                        <div className="font-medium mb-2">{t.employerCost}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t.cnpsEmployer}</span>
                            <span className="font-mono">
                              +{formatCurrency(calculate.data.cnpsEmployer)} {fr.payroll.fcfa}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t.cmuEmployer}</span>
                            <span className="font-mono">
                              +{formatCurrency(calculate.data.cmuEmployer)} {fr.payroll.fcfa}
                            </span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>{t.totalEmployerCost}</span>
                            <span className="font-mono">
                              {formatCurrency(calculate.data.employerCost)} {fr.payroll.fcfa}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {!calculate.data && !calculate.isError && !calculate.isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  Saisissez un salaire de base pour voir les résultats
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
