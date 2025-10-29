/**
 * Salary Info Step - Hire Wizard
 *
 * Components-based architecture: Build salary from component instances
 * Single source of truth: components array (no individual allowance fields)
 */

import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { formatCurrencyWithRate, convertMonthlyAmountToRateType } from '@/features/employees/utils/rate-type-labels';
import type { RateType } from '@/features/employees/utils/rate-type-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Plus, Sparkles, Info, Settings2, X, Edit2 } from 'lucide-react';
import { usePopularTemplates, useCustomComponents } from '@/features/employees/hooks/use-salary-components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SalaryComponentTemplate, CustomSalaryComponent, SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { MinimumWageAlert } from '@/components/employees/minimum-wage-alert';
import { getSmartDefaults } from '@/lib/salary-components/metadata-builder';
import { trpc } from '@/lib/trpc/client';

interface SalaryInfoStepProps {
  form: UseFormReturn<any>;
}

export function SalaryInfoStep({ form }: SalaryInfoStepProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  const baseSalary = form.watch('baseSalary') || 0;
  const baseComponents = form.watch('baseComponents') || {};
  const components = form.watch('components') || [];
  const coefficient = form.watch('coefficient') || 100;
  const rateType = form.watch('rateType') || 'MONTHLY';

  const countryCode = 'CI'; // TODO: Get from tenant context
  const monthlyMinimumWage = 75000; // TODO: Get from countries table

  // Convert minimum wage based on rate type
  let countryMinimumWage = monthlyMinimumWage;
  let rateLabel = 'mensuel';

  if (rateType === 'DAILY') {
    countryMinimumWage = Math.round(monthlyMinimumWage / 30);
    rateLabel = 'journalier';
  } else if (rateType === 'HOURLY') {
    countryMinimumWage = Math.round(monthlyMinimumWage / (30 * 8));
    rateLabel = 'horaire';
  }

  const { data: templates, isLoading: loadingTemplates } = usePopularTemplates(countryCode);
  const { data: customComponents, isLoading: loadingCustom } = useCustomComponents();

  // Load base salary components for this country
  const { data: baseSalaryDefinitions, isLoading: loadingBaseSalary } =
    trpc.salaryComponents.getBaseSalaryComponents.useQuery(
      { countryCode },
      { enabled: !!countryCode }
    );

  // Calculate total gross salary (base + components with rate conversion)
  const componentTotal = components.reduce(
    (sum: number, component: SalaryComponentInstance) => {
      // Convert monthly components to employee's rate type
      return sum + convertMonthlyAmountToRateType(component.amount, rateType as RateType);
    },
    0
  );

  // Calculate base salary total from base components or fall back to baseSalary field
  const baseSalaryTotal = baseSalaryDefinitions && baseSalaryDefinitions.length > 0
    ? (Object.values(baseComponents) as number[]).reduce((sum, amt) => sum + (amt || 0), 0)
    : baseSalary;

  const totalGross = baseSalaryTotal + componentTotal;

  /**
   * Add a component from template/custom
   */
  const handleAddComponent = (
    component: SalaryComponentTemplate | CustomSalaryComponent,
    suggestedAmount: number
  ) => {
    // Build component instance
    const name =
      'name' in component && typeof component.name === 'object'
        ? (component.name as Record<string, string>).fr
        : typeof component.name === 'string'
        ? component.name
        : 'Indemnité';

    const code = 'code' in component ? component.code : `CUSTOM_${Date.now()}`;

    const newComponent: SalaryComponentInstance = {
      code,
      name,
      amount: suggestedAmount,
      sourceType: 'standard',
      metadata: getSmartDefaults(countryCode, code === '22' ? 'transport' : code === '23' ? 'housing' : code === '24' ? 'meal' : 'housing'),
    };

    const currentComponents = form.getValues('components') || [];
    form.setValue('components', [...currentComponents, newComponent], { shouldValidate: true });
    setShowTemplates(false);
  };

  /**
   * Update base salary amount
   */
  const handleUpdateBaseSalary = (newAmount: number) => {
    form.setValue('baseSalary', newAmount, { shouldValidate: true });
  };

  /**
   * Remove a component
   */
  const handleRemoveComponent = (index: number) => {
    const currentComponents = form.getValues('components') || [];
    form.setValue(
      'components',
      currentComponents.filter((_: any, i: number) => i !== index),
      { shouldValidate: true }
    );
  };

  /**
   * Edit component amount
   */
  const handleEditComponent = (index: number) => {
    const component = components[index];
    if (component) {
      setEditingIndex(index);
      setEditAmount(component.amount);
    }
  };

  /**
   * Save edited amount
   */
  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const currentComponents = form.getValues('components') || [];
      const updatedComponents = currentComponents.map((c: SalaryComponentInstance, i: number) =>
        i === editingIndex ? { ...c, amount: editAmount } : c
      );
      form.setValue('components', updatedComponents, { shouldValidate: true });
      setEditingIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Rate Type Information */}
      {rateType !== 'MONTHLY' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Travailleur {rateType === 'DAILY' ? 'journalier' : 'horaire'}:</strong> Le salaire de base est le taux {rateLabel}.
            Les indemnités (transport, logement, etc.) sont des montants mensuels qui seront automatiquement proratés selon les jours/heures travaillés lors du calcul de la paie.
          </AlertDescription>
        </Alert>
      )}

      {/* Base Salary Components (Dynamic based on country) */}
      {loadingBaseSalary ? (
        <div className="text-sm text-muted-foreground">Chargement des composantes salariales...</div>
      ) : baseSalaryDefinitions && baseSalaryDefinitions.length > 0 ? (
        <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
          <div>
            <FormLabel>Salaire de base *</FormLabel>
            <FormDescription>
              Composé de {baseSalaryDefinitions.length} élément{baseSalaryDefinitions.length > 1 ? 's' : ''}
            </FormDescription>
          </div>

          {baseSalaryDefinitions.map((component) => (
            <div key={component.code}>
              <FormLabel>{component.label.fr}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder={component.defaultValue?.toString() || '0'}
                  value={baseComponents[component.code] || component.defaultValue || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    form.setValue(`baseComponents.${component.code}`, value, { shouldValidate: true });
                  }}
                  className="min-h-[48px]"
                  required={!component.isOptional}
                />
              </FormControl>
              <FormDescription>{component.description.fr}</FormDescription>
            </div>
          ))}

          {/* Total Base Salary Display */}
          {baseSalaryTotal > 0 && (
            <div className="p-3 bg-white rounded border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total salaire de base</span>
                <span className="font-bold text-lg">
                  {formatCurrency(baseSalaryTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Fallback to single baseSalary field if no base components configured
        <div>
          <FormLabel>Salaire de base ({rateType === 'MONTHLY' ? 'mensuel' : rateType === 'DAILY' ? 'journalier' : 'horaire'}) *</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={countryMinimumWage}
              step={rateType === 'HOURLY' ? 100 : 1000}
              placeholder={countryMinimumWage.toString()}
              value={baseSalary}
              onChange={(e) => handleUpdateBaseSalary(parseFloat(e.target.value) || 0)}
              className="min-h-[48px]"
            />
          </FormControl>
          <FormDescription>
            Minimum {rateLabel}: {formatCurrency(countryMinimumWage)} (SMIG {rateType === 'DAILY' ? '÷ 30' : rateType === 'HOURLY' ? '÷ 240' : ''})
          </FormDescription>
          {form.formState.errors.baseSalary && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.baseSalary.message?.toString()}
            </p>
          )}
          {form.formState.errors.components && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.components.message?.toString()}
            </p>
          )}
        </div>
      )}

      {/* Components List (excluding base salary) */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Indemnités et primes</h3>
          <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un composant salarial</DialogTitle>
                <DialogDescription>
                  Sélectionnez parmi les modèles populaires ou vos composants personnalisés
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Popular Templates */}
                {templates && templates.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Modèles populaires
                    </h4>
                    <div className="grid gap-2">
                      {templates.map((template) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() =>
                            handleAddComponent(
                              template,
                              parseFloat(String(template.suggestedAmount || '10000'))
                            )
                          }
                        >
                          <CardHeader className="py-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-sm">
                                  {(template.name as Record<string, string>).fr}
                                </CardTitle>
                                {template.description && (
                                  <CardDescription className="text-xs mt-1">
                                    {template.description}
                                  </CardDescription>
                                )}
                              </div>
                              {template.suggestedAmount && (
                                <Badge variant="outline">
                                  {parseFloat(String(template.suggestedAmount)).toLocaleString('fr-FR')} FCFA
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Components */}
                {customComponents && customComponents.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Vos composants personnalisés
                    </h4>
                    <div className="grid gap-2">
                      {customComponents
                        .filter((c) => c.isActive)
                        .map((component) => (
                          <Card
                            key={component.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleAddComponent(component, 10000)}
                          >
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm">{component.name}</CardTitle>
                              {component.description && (
                                <CardDescription className="text-xs mt-1">
                                  {component.description}
                                </CardDescription>
                              )}
                            </CardHeader>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}

                {(!templates || templates.length === 0) &&
                  (!customComponents || customComponents.length === 0) && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Aucun modèle disponible. Vous pouvez créer des composants personnalisés dans
                        les paramètres.
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Display added components */}
        {components.length > 0 && (
          <div className="space-y-2">
            {components.map((component: SalaryComponentInstance, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{component.name}</p>
                    {editingIndex === index ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                          className="h-8 w-32"
                          min={0}
                          step={1000}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEdit}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrencyWithRate(
                          convertMonthlyAmountToRateType(component.amount, rateType as RateType),
                          rateType as RateType
                        )}
                      </p>
                    )}
                  </div>
                  {editingIndex !== index && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditComponent(index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveComponent(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {components.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Aucune indemnité ajoutée. Vous pouvez ajouter des primes et indemnités en cliquant sur le bouton "Ajouter" ci-dessus.
            </AlertDescription>
          </Alert>
        )}

        {/* Display validation errors for components */}
        {form.formState.errors.components && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {form.formState.errors.components.message?.toString()}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Total Gross Salary */}
      {totalGross > 0 && (
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="font-medium">Salaire brut total</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrencyWithRate(totalGross, rateType as RateType)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Salaire de base: {formatCurrencyWithRate(baseSalaryTotal, rateType as RateType)}
            {components.length > 0 && ` + ${components.length} indemnité${components.length > 1 ? 's' : ''}: ${formatCurrencyWithRate(componentTotal, rateType as RateType)}`}
          </div>
        </div>
      )}

      {/* SMIG Validation - Check gross salary against coefficient minimum */}
      <MinimumWageAlert
        coefficient={coefficient}
        currentSalary={totalGross}
        countryMinimumWage={countryMinimumWage}
        countryCode={countryCode}
      />
    </div>
  );
}
