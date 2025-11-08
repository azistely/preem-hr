/**
 * Salary Info Step - Hire Wizard
 *
 * Components-based architecture: Build salary from component instances
 * Single source of truth: components array (no individual allowance fields)
 */

import { useState, useEffect } from 'react';
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
import { AlertCircle, CheckCircle, Plus, Sparkles, Info, Settings2, X, Edit2, Search } from 'lucide-react';
import { useComponentTemplates, useCustomComponents } from '@/features/employees/hooks/use-salary-components';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SalaryComponentTemplate, CustomSalaryComponent, SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { MinimumWageAlert } from '@/components/employees/minimum-wage-alert';
import { TransportAllowanceAlert } from '@/components/employees/transport-allowance-alert';
import { getSmartDefaults } from '@/lib/salary-components/metadata-builder';
import { trpc } from '@/lib/trpc/client';
import { CustomComponentWizard } from '@/features/employees/components/salary-components/CustomComponentWizard';

interface SalaryInfoStepProps {
  form: UseFormReturn<any>;
}

export function SalaryInfoStep({ form }: SalaryInfoStepProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');

  const baseSalary = form.watch('baseSalary') || 0;
  const baseComponents = form.watch('baseComponents') || {};
  const components = form.watch('components') || [];
  const coefficient = form.watch('coefficient') || 100;
  const sector = form.watch('sector');
  const category = form.watch('category');
  const rateType = 'MONTHLY'; // Hard-coded to MONTHLY - all inputs are monthly by default
  const contractType = form.watch('contractType') || 'CDI';
  const primaryLocationId = form.watch('primaryLocationId');
  const weeklyHoursRegime = form.watch('weeklyHoursRegime') || '40h';

  const countryCode = 'CI'; // TODO: Get from tenant context
  const monthlyMinimumWage = 75000; // TODO: Get from countries table

  // All inputs are monthly - no conversion needed
  const countryMinimumWage = monthlyMinimumWage;
  const rateLabel = 'mensuel';

  // Always load ALL components (popularOnly = false)
  const { data: templates, isLoading: loadingTemplates } = useComponentTemplates(countryCode, false);
  const { data: customComponents, isLoading: loadingCustom } = useCustomComponents();

  // Load base salary components for this country
  const { data: baseSalaryDefinitions, isLoading: loadingBaseSalary } =
    trpc.salaryComponents.getBaseSalaryComponents.useQuery(
      { countryCode },
      { enabled: !!countryCode }
    );

  // Query actual minimum wage from database (sector-specific)
  const { data: categoryData } = trpc.cgeci.getCategoryMinimumWage.useQuery(
    {
      countryCode,
      sectorCode: sector || '',
      categoryCode: category || '',
    },
    { enabled: !!countryCode && !!sector && !!category }
  );

  // Use database minimum if available (sector-specific), otherwise calculate from SMIG
  const categoryMinimumWage = categoryData?.actualMinimumWage
    ? parseFloat(categoryData.actualMinimumWage)
    : Math.round(monthlyMinimumWage * (coefficient / 100));

  // Query city transport minimum for pre-filling
  const { data: cityTransportMinimum } = trpc.locations.getTransportMinimum.useQuery(
    { locationId: primaryLocationId },
    { enabled: !!primaryLocationId }
  );

  // Pre-fill salaire catégoriel (Code 11) with calculated minimum
  useEffect(() => {
    // Only pre-fill if base salary components are loaded
    if (!baseSalaryDefinitions || baseSalaryDefinitions.length === 0) {
      return;
    }

    const hasCode11 = baseSalaryDefinitions.some((def) => def.code === '11');
    if (!hasCode11) {
      return;
    }

    // Check if Code 11 is empty
    const currentValue = baseComponents['11'];
    if (!currentValue || currentValue === 0) {
      // Pre-fill with calculated minimum based on coefficient
      form.setValue('baseComponents.11', categoryMinimumWage, { shouldValidate: false });
    }
  }, [categoryMinimumWage, baseComponents, baseSalaryDefinitions, form]);

  // Pre-fill transport component (Code 22) with city minimum
  useEffect(() => {
    if (cityTransportMinimum && cityTransportMinimum.monthlyMinimum) {
      const hasTransport = components.some(
        (c: SalaryComponentInstance) =>
          c.code === '22' ||
          c.code === 'TPT_TRANSPORT_CI' ||
          c.code.toLowerCase().includes('transport')
      );

      if (!hasTransport) {
        const transportAmount = typeof cityTransportMinimum.monthlyMinimum === 'number'
          ? cityTransportMinimum.monthlyMinimum
          : parseFloat(String(cityTransportMinimum.monthlyMinimum));

        const transportComponent: SalaryComponentInstance = {
          code: '22',
          name: 'Indemnité de Transport',
          amount: transportAmount,
          sourceType: 'standard',
        };
        form.setValue('components', [...components, transportComponent], { shouldValidate: false });
      }
    }
  }, [cityTransportMinimum, components, form]);

  // Auto-inject Prime d'ancienneté (Code 21) for employees with 2+ years of service
  useEffect(() => {
    const hireDate = form.watch('hireDate');
    if (!hireDate) return;

    // Check if already has seniority component
    const hasSeniority = components.some(
      (c: SalaryComponentInstance) => c.code === '21'
    );
    if (hasSeniority) return;

    // Need salaire catégoriel (Code 11) to calculate seniority
    const salaireCategoriel = baseComponents['11'];
    if (!salaireCategoriel || salaireCategoriel === 0) return;

    // Calculate years of service
    const hireDateObj = hireDate instanceof Date ? hireDate : new Date(hireDate);
    const currentDate = new Date();
    const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365.25;
    const yearsOfService = Math.floor(
      (currentDate.getTime() - hireDateObj.getTime()) / millisecondsPerYear
    );

    // Only auto-add if eligible (>= 2 years)
    if (yearsOfService >= 2) {
      // Calculate Prime d'ancienneté: 2% base + 1% per year after year 2, max 25%
      const baseRate = 0.02; // 2% starting at year 2
      const incrementPerYear = 0.01; // +1% per year
      const maxRate = 0.25; // 25% cap
      const calculatedRate = Math.min(baseRate + (yearsOfService - 2) * incrementPerYear, maxRate);
      const seniorityAmount = Math.round(salaireCategoriel * calculatedRate);

      const seniorityComponent: SalaryComponentInstance = {
        code: '21',
        name: "Prime d'ancienneté",
        amount: seniorityAmount,
        sourceType: 'template',
      };
      form.setValue('components', [...components, seniorityComponent], { shouldValidate: false });
    }
  }, [form.watch('hireDate'), baseComponents, components, form]);

  // Calculate total gross salary (base + components)
  // ALL components are now stored as MONTHLY amounts
  const componentTotal = components.reduce(
    (sum: number, component: SalaryComponentInstance) => sum + component.amount,
    0
  );

  // Calculate base salary total from base components or fall back to baseSalary field
  const baseSalaryTotal = baseSalaryDefinitions && baseSalaryDefinitions.length > 0
    ? (Object.values(baseComponents) as number[]).reduce((sum, amt) => sum + (amt || 0), 0)
    : baseSalary;

  const totalGross = baseSalaryTotal + componentTotal;

  // Calculate salaire catégoriel (Code 11 only) for coefficient minimum validation
  // This is the base that must meet the coefficient minimum wage requirement
  const salaireCategoriel = baseComponents['11'] || baseSalary || 0;

  // Find transport component (Code 22) for validation
  const transportComponent = components.find((c: SalaryComponentInstance) => c.code === '22');
  const currentTransport = transportComponent?.amount || 0;

  /**
   * Get display unit for component based on contract type
   * All components are now stored as MONTHLY and displayed as MONTHLY
   */
  const getComponentDisplayUnit = (componentCode: string): RateType => {
    // All components are stored and displayed as monthly
    return 'MONTHLY';
  };

  /**
   * Calculate auto-calculated component amounts
   * Handles various calculation types: seniority, percentage, overtime, etc.
   */
  const calculateComponentAmount = (
    component: SalaryComponentTemplate | CustomSalaryComponent,
    suggestedAmount: number
  ): number => {
    const code = 'code' in component ? component.code : '';
    const metadata = 'metadata' in component ? component.metadata : null;
    const calculationMethod = 'calculationMethod' in component ? component.calculationMethod : null;

    if (!metadata || typeof metadata !== 'object') {
      return suggestedAmount;
    }

    const calculationRule = (metadata as any).calculationRule;

    // Auto-calculated components (from metadata)
    if (calculationRule?.type === 'auto-calculated') {
      // Prime d'ancienneté (Code 21): 2% per year, max 25%
      if (code === '21') {
        const hireDate = form.watch('hireDate');
        if (hireDate && salaireCategoriel > 0) {
          const today = new Date();
          const hire = hireDate instanceof Date ? hireDate : new Date(hireDate);
          const yearsOfService = (today.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

          const rate = calculationRule.rate || 0.02;
          const cap = calculationRule.cap || 0.25;
          const percentage = Math.min(yearsOfService * rate, cap);

          return Math.round(salaireCategoriel * percentage);
        }
      }

      // Overtime (TPT_OVERTIME): Not applicable in hire wizard (needs actual hours)
      // Return 0 since we don't have overtime hours at hiring stage
      if (code === 'TPT_OVERTIME') {
        return 0;
      }
    }

    // Percentage-based components (e.g., responsibility allowance)
    if (calculationMethod === 'percentage' && calculationRule?.rate && salaireCategoriel > 0) {
      const percentage = calculationRule.rate;
      return Math.round(salaireCategoriel * percentage);
    }

    // Formula-based components (e.g., family allowances Code 41)
    // These typically depend on family status which should be handled server-side
    if (calculationMethod === 'formula' && code === '41') {
      // Family allowances are auto-calculated server-side based on maritalStatus and dependents
      // Return 0 here as it will be properly calculated in payroll preview
      return 0;
    }

    // Default: use suggested amount
    return suggestedAmount;
  };

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

    // Calculate final amount (auto-calculated for Code 21, or use suggested amount)
    let finalAmount = calculateComponentAmount(component, suggestedAmount);

    // ALL contract types now store monthly amounts
    // For CDDTI, conversion to hourly/daily happens in payroll-calculation-v2.ts
    // This ensures HR enters and sees monthly values (e.g., 75,000 salary, 30,000 transport)

    const newComponent: SalaryComponentInstance = {
      code,
      name,
      amount: finalAmount,
      sourceType: 'standard',
      // Don't include metadata - backend will load correct metadata from database
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

  /**
   * Filter templates and custom components based on search query
   */
  const filterComponents = <T extends SalaryComponentTemplate | CustomSalaryComponent>(
    items: T[] | undefined,
    query: string
  ): T[] => {
    if (!items) return [];
    if (!query.trim()) return items;

    const lowerQuery = query.toLowerCase();
    return items.filter((item) => {
      const name = typeof item.name === 'object' ? item.name.fr : item.name;
      const description = item.description || '';
      return (
        name.toLowerCase().includes(lowerQuery) ||
        description.toLowerCase().includes(lowerQuery) ||
        item.code.toLowerCase().includes(lowerQuery)
      );
    });
  };

  /**
   * Group templates by category
   */
  const groupByCategory = (items: SalaryComponentTemplate[]) => {
    const groups: Record<string, SalaryComponentTemplate[]> = {};
    items.forEach((item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    });
    return groups;
  };

  /**
   * Get category display info
   */
  const getCategoryInfo = (category: string) => {
    const categoryMap: Record<string, { label: string; icon: typeof Sparkles }> = {
      allowance: { label: 'Indemnités', icon: Sparkles },
      bonus: { label: 'Primes', icon: Sparkles },
      deduction: { label: 'Retenues', icon: AlertCircle },
      benefit: { label: 'Avantages', icon: CheckCircle },
      other: { label: 'Autres', icon: Info },
    };
    return categoryMap[category] || categoryMap.other;
  };

  // Filter and group templates
  const filteredTemplates = filterComponents(templates, searchQuery);
  const filteredCustom = filterComponents(customComponents, searchQuery);
  const groupedTemplates = groupByCategory(filteredTemplates);

  return (
    <div className="space-y-6">
      {/* Monthly-Only Information */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm font-medium text-blue-900">
          💡 Tous les montants sont mensuels
        </span>
      </div>

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
          <FormLabel>Salaire de base (FCFA/mois) *</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={countryMinimumWage}
              step={1000}
              placeholder={countryMinimumWage.toString()}
              value={baseSalary}
              onChange={(e) => handleUpdateBaseSalary(parseFloat(e.target.value) || 0)}
              className="min-h-[48px]"
            />
          </FormControl>
          <FormDescription>
            Minimum mensuel: {formatCurrency(countryMinimumWage)} (SMIG)
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
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un composant salarial</DialogTitle>
                <DialogDescription>
                  Parcourez les composants disponibles ou créez un composant sur mesure
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="browse" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="browse">Composants disponibles</TabsTrigger>
                  <TabsTrigger value="create">Créer sur mesure</TabsTrigger>
                </TabsList>

                {/* Tab 1: Browse existing components */}
                <TabsContent value="browse" className="space-y-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un composant..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 min-h-[44px]"
                    />
                  </div>

                  {/* Component count */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>
                      {filteredTemplates.length + filteredCustom.length} composant(s) trouvé(s)
                    </span>
                  </div>

                  {/* Templates grouped by category */}
                  {Object.entries(groupedTemplates).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
                        const categoryInfo = getCategoryInfo(category);
                        const CategoryIcon = categoryInfo.icon;

                        return (
                          <div key={category}>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <CategoryIcon className="h-4 w-4" />
                              {categoryInfo.label}
                            </h4>
                            <div className="grid gap-2">
                              {categoryTemplates.map((template) => {
                                const suggestedAmount = parseFloat(String(template.suggestedAmount || '10000'));
                                const calculatedAmount = calculateComponentAmount(template, suggestedAmount);

                                // Determine if auto-calculated and get hint text
                                const metadata = template.metadata as any;
                                const calculationRule = metadata?.calculationRule;
                                const calcMethod = metadata?.calculationMethod || (template as any).calculationMethod;
                                const isAutoCalculated = calculationRule?.type === 'auto-calculated' || calcMethod === 'percentage' || calcMethod === 'formula';

                                let autoCalcHint = '';
                                if (template.code === '21') {
                                  autoCalcHint = 'Calculé automatiquement selon l\'ancienneté';
                                } else if (calcMethod === 'percentage') {
                                  autoCalcHint = 'Pourcentage du salaire catégoriel';
                                } else if (calcMethod === 'formula') {
                                  autoCalcHint = 'Montant calculé selon la situation familiale';
                                } else if (template.code === 'TPT_OVERTIME') {
                                  autoCalcHint = 'Calculé selon les heures travaillées';
                                }

                                return (
                                  <Card
                                    key={template.id}
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => handleAddComponent(template, suggestedAmount)}
                                  >
                                    <CardHeader className="py-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <CardTitle className="text-sm">
                                            {(template.name as Record<string, string>).fr}
                                          </CardTitle>
                                          {template.description && (
                                            <CardDescription className="text-xs mt-1">
                                              {template.description}
                                            </CardDescription>
                                          )}
                                          {isAutoCalculated && autoCalcHint && (
                                            <CardDescription className="text-xs mt-1 text-primary font-medium">
                                              {autoCalcHint}
                                            </CardDescription>
                                          )}
                                        </div>
                                        <Badge variant={isAutoCalculated && calculatedAmount > 0 ? "default" : "outline"}>
                                          {calculatedAmount.toLocaleString('fr-FR')} FCFA/mois
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Custom Components */}
                  {filteredCustom.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Vos composants personnalisés
                      </h4>
                      <div className="grid gap-2">
                        {filteredCustom
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

                  {/* No results */}
                  {filteredTemplates.length === 0 && filteredCustom.length === 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {searchQuery
                          ? `Aucun composant trouvé pour "${searchQuery}". Essayez un autre terme ou créez un composant sur mesure.`
                          : 'Aucun composant disponible. Vous pouvez créer un composant sur mesure.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                {/* Tab 2: Create custom component */}
                <TabsContent value="create" className="mt-4">
                  <CustomComponentWizard
                    open={true}
                    onClose={() => setShowTemplates(false)}
                    onSuccess={(newComponent) => {
                      // Add the newly created component to the form
                      const componentInstance: SalaryComponentInstance = {
                        code: newComponent.code,
                        name: newComponent.name,
                        amount: parseFloat(newComponent.defaultValue || '0'),
                        sourceType: 'template', // Custom components are treated as templates
                      };
                      const currentComponents = form.getValues('components') || [];
                      form.setValue('components', [...currentComponents, componentInstance], { shouldValidate: true });
                      setShowTemplates(false);
                    }}
                    countryCode={countryCode}
                    embeddedMode={true}
                  />
                </TabsContent>
              </Tabs>
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
                        {formatCurrencyWithRate(component.amount, getComponentDisplayUnit(component.code))}
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
              {formatCurrencyWithRate(totalGross, 'MONTHLY')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Salaire de base: {formatCurrencyWithRate(baseSalaryTotal, 'MONTHLY')}
            {components.length > 0 && ` + ${components.length} indemnité${components.length > 1 ? 's' : ''}: ${formatCurrencyWithRate(componentTotal, 'MONTHLY')}`}
          </div>
          {contractType === 'CDDTI' && (
            <p className="text-xs text-muted-foreground mt-2">
              Pour les CDDTI, le montant réel dépendra des heures et jours travaillés lors du calcul de la paie.
            </p>
          )}
        </div>
      )}

      {/* SMIG Validation - Check salaire catégoriel against coefficient minimum */}
      <MinimumWageAlert
        coefficient={coefficient}
        currentSalary={salaireCategoriel}
        countryMinimumWage={countryMinimumWage}
        countryCode={countryCode}
      />

      {/* Transport Validation - Check transport against location minimum */}
      {primaryLocationId && (
        <TransportAllowanceAlert
          locationId={primaryLocationId}
          currentTransport={currentTransport}
          contractType={contractType}
        />
      )}
    </div>
  );
}
