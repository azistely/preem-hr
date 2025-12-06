/**
 * Salary Change Wizard (Enhanced with Dynamic Components)
 *
 * Multi-step wizard for changing employee salary with:
 * - Dynamic component management (load from templates)
 * - Payroll preview with calculatePayrollV2()
 * - Progressive disclosure (preview only when requested)
 *
 * HCI principles:
 * - Task-oriented design ("Changer un salaire")
 * - Progressive disclosure (3-5 simple steps)
 * - Error prevention (real-time SMIG validation)
 * - Smart defaults (effective date, reason)
 * - Immediate feedback (visual confirmation + payroll preview)
 */

'use client';

import { useState, useEffect } from 'react';
import * as React from 'react';
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
  Plus,
  X,
  Edit2,
  CheckCircle,
  Info,
  Calculator,
  Sparkles,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc/client';
import { useSalaryValidation, formatCurrency } from '../../hooks/use-salary-validation';
import { useComponentTemplates, useCustomComponents } from '../../hooks/use-salary-components';
import { SalaryComparisonCard } from './salary-comparison-card';
import { PayrollPreviewCard } from './payroll-preview-card';
import { toast } from 'sonner';
import type { SalaryComponentInstance, SalaryComponentTemplate, CustomSalaryComponent } from '../../types/salary-components';
import { getSmartDefaults } from '@/lib/salary-components/metadata-builder';
import { getPaymentFrequencyLabel, formatCurrency as formatCurrencyUtil, getWeeklyHours } from '../../utils/payment-frequency-labels';
import type { PaymentFrequency } from '../../utils/payment-frequency-labels';

// Validation schema (simplified for components array)
const salaryChangeSchema = z.object({
  components: z.array(z.object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
    sourceType: z.enum(['standard', 'custom', 'template', 'import']),
    metadata: z.any().optional(),
    sourceId: z.string().optional(),
  })).min(1, 'Au moins un composant de salaire est requis'),
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
    components?: SalaryComponentInstance[];
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  const [baseSalaryTouched, setBaseSalaryTouched] = useState(false);
  const [baseSalaryInput, setBaseSalaryInput] = useState(currentSalary.baseSalary.toString());
  const [categoryValidationError, setCategoryValidationError] = useState<string | null>(null);
  const [transportValidationError, setTransportValidationError] = useState<string | null>(null);

  // Smart default: First day of next month
  const defaultEffectiveDate = startOfMonth(addMonths(new Date(), 1));

  // Get country code from minimum wage query
  const { data: minWageData } = trpc.salaries.getMinimumWage.useQuery();
  const countryCode = minWageData?.countryCode || 'CI';

  // Get trpc utils for cache invalidation
  const utils = trpc.useUtils();

  // Fetch employee data for validations
  const { data: employeeData } = trpc.employees.getById.useQuery({ id: employeeId });

  // Fetch transport minimum when employee location is available
  const { data: transportMinData } = trpc.locations.getTransportMinimum.useQuery(
    { locationId: (employeeData as any)?.primaryLocationId! },
    { enabled: !!( employeeData as any)?.primaryLocationId }
  );

  // Load available templates
  const { data: templates, isLoading: loadingTemplates } = useComponentTemplates(countryCode, !showAllTemplates);
  const { data: customComponents, isLoading: loadingCustom } = useCustomComponents();

  // Load base salary components for this country
  const { data: baseSalaryDefinitions, isLoading: loadingBaseSalary } =
    trpc.salaryComponents.getBaseSalaryComponents.useQuery(
      { countryCode },
      { enabled: !!countryCode }
    );

  // Initialize components with current salary
  // IMPORTANT: Base salary components (Code 11, Code 12) are managed by baseSalaryDefinitions inputs
  // We only pre-populate them here if components array is empty (legacy data)
  const baseComponents: SalaryComponentInstance[] = currentSalary.components || [];

  // Get codes of base salary components that will be rendered by baseSalaryDefinitions
  const baseSalaryCodes = baseSalaryDefinitions?.map(def => def.code) || [];

  // Filter out base salary components - they will be managed by baseSalaryDefinitions inputs
  const nonBaseSalaryComponents = baseComponents.filter(
    c => !baseSalaryCodes.includes(c.code)
  );

  // If components array is empty and we have a baseSalary value, create base components from definitions
  const needsBaseSalaryInit = baseComponents.length === 0 && currentSalary.baseSalary > 0;

  const initialComponents: SalaryComponentInstance[] = [
    // Pre-populate base salary components if needed (for baseSalaryDefinitions inputs)
    ...(needsBaseSalaryInit && baseSalaryCodes.length > 0
      ? baseSalaryCodes.map(code => {
          // For legacy data, put baseSalary value into Code 11, rest get default values
          const amount = code === '11'
            ? Number(currentSalary.baseSalary)
            : (baseSalaryDefinitions?.find(def => def.code === code)?.defaultValue || 0);

          return {
            code,
            name: baseSalaryDefinitions?.find(def => def.code === code)?.name.fr || '',
            amount,
            sourceType: 'standard' as const,
          };
        })
      : baseSalaryCodes.map(code => {
          const existing = baseComponents.find(c => c.code === code);
          return existing ? {
            ...existing,
            amount: Number(existing.amount),
          } : {
            code,
            name: baseSalaryDefinitions?.find(def => def.code === code)?.name.fr || '',
            amount: baseSalaryDefinitions?.find(def => def.code === code)?.defaultValue || 0,
            sourceType: 'standard' as const,
          };
        })
    ),
    // Include non-base salary components (allowances, etc.)
    ...nonBaseSalaryComponents.map(c => ({
      ...c,
      amount: Number(c.amount),
    })),
    // Add legacy allowances if they exist but aren't in components
    ...(currentSalary.housingAllowance && !baseComponents.some(c =>
        c.code === 'TPT_HOUSING_CI' || c.code === '21' || c.name?.toLowerCase().includes('logement')
      ) ? [{
        code: 'TPT_HOUSING_CI',
        name: 'Indemnité de logement',
        amount: currentSalary.housingAllowance,
        sourceType: 'standard' as const,
      }] : []),
    ...(currentSalary.transportAllowance && !baseComponents.some(c =>
        c.code === 'TPT_TRANSPORT_CI' || c.code === '22' || c.name?.toLowerCase().includes('transport')
      ) ? [{
        code: 'TPT_TRANSPORT_CI',
        name: 'Indemnité de transport',
        amount: currentSalary.transportAllowance,
        sourceType: 'standard' as const,
      }] : []),
    ...(currentSalary.mealAllowance && !baseComponents.some(c =>
        c.code === 'TPT_MEAL_ALLOWANCE' || c.code === '23' ||
        c.name?.toLowerCase().includes('repas') || c.name?.toLowerCase().includes('panier')
      ) ? [{
        code: 'TPT_MEAL_ALLOWANCE',
        name: 'Indemnité de panier',
        amount: currentSalary.mealAllowance,
        sourceType: 'standard' as const,
      }] : []),
  ];

  const form = useForm<SalaryChangeFormData>({
    resolver: zodResolver(salaryChangeSchema),
    defaultValues: {
      components: initialComponents,
      effectiveFrom: format(defaultEffectiveDate, 'yyyy-MM-dd'),
      changeReason: '',
      notes: '',
    },
  });

  const components = form.watch('components') || [];

  // Get classification fields from employee data
  const contractType = (employeeData as any)?.contract?.contractType || 'CDI';
  const paymentFrequency = ((employeeData as any)?.paymentFrequency || 'MONTHLY') as PaymentFrequency;
  const weeklyHoursRegime = (employeeData as any)?.weeklyHoursRegime || '40h';

  /**
   * Get unit label for component - always monthly since all salaries are stored as monthly
   */
  const getComponentUnitLabel = (componentCode: string): string => {
    return 'FCFA/mois';
  };

  // Calculate base salary total from all base components
  const baseSalary = components
    .filter(c => baseSalaryCodes.includes(c.code))
    .reduce((sum, c) => sum + c.amount, 0);

  // Calculate total gross salary
  // All amounts stored as monthly - no conversion needed
  const componentTotal = components.reduce((sum, c) => sum + c.amount, 0);

  // Calculate current salary total (components-first with legacy fallback)
  const totalCurrentSalary = currentSalary.components && currentSalary.components.length > 0
    ? currentSalary.components.reduce((sum, c) => sum + c.amount, 0)
    : currentSalary.baseSalary +
      (currentSalary.housingAllowance || 0) +
      (currentSalary.transportAllowance || 0) +
      (currentSalary.mealAllowance || 0);

  // Real-time SMIG validation on TOTAL gross salary (not just base)
  // For CDDTI: validate hourly total, for others: validate monthly total
  const { validationResult, isLoading: validatingSmig } = useSalaryValidation(
    componentTotal,
    contractType === 'CDDTI' ? 'HOURLY' : 'MONTHLY'
  );

  // Additional validation: Category minimum wage and transport minimum
  // Run validation whenever components change
  React.useEffect(() => {
    // Skip validation if employee data not loaded yet
    if (!employeeData || components.length === 0) {
      setCategoryValidationError(null);
      setTransportValidationError(null);
      return;
    }

    // Validation 1: Category minimum wage
    // IMPORTANT: Validate salaire catégoriel (Code 11) NOT total gross salary
    const salaireCategoriel = components.find(c => c.code === '11')?.amount || 0;
    const coefficient = (employeeData as any).coefficient || 100;
    const countryMinimumWage = minWageData?.minimumWage || 75000;

    // For CDDTI: validate hourly rate against hourly minimum
    // For others: validate monthly amount against monthly minimum
    let requiredMinimum: number;
    let errorMessage: string;

    if (contractType === 'CDDTI') {
      // Calculate hourly minimum from monthly SMIG
      // Assuming 40h/week = 173.33h/month standard
      const weeklyHours = getWeeklyHours(weeklyHoursRegime);
      const monthlyHours = (weeklyHours * 52) / 12;
      const hourlyMinimumWage = countryMinimumWage / monthlyHours;
      requiredMinimum = Math.round(hourlyMinimumWage * (coefficient / 100));

      if (Math.round(salaireCategoriel) < requiredMinimum) {
        setCategoryValidationError(
          `Le taux horaire catégoriel (${Math.round(salaireCategoriel).toLocaleString('fr-FR')} FCFA/h) est inférieur au minimum requis (${requiredMinimum.toLocaleString('fr-FR')} FCFA/h) pour un coefficient de ${coefficient}.`
        );
      } else {
        setCategoryValidationError(null);
      }
    } else {
      // Monthly validation for CDI, CDD, etc.
      requiredMinimum = countryMinimumWage * (coefficient / 100);

      if (salaireCategoriel < requiredMinimum) {
        setCategoryValidationError(
          `Le salaire catégoriel (${salaireCategoriel.toLocaleString('fr-FR')} FCFA) est inférieur au minimum requis (${requiredMinimum.toLocaleString('fr-FR')} FCFA) pour un coefficient de ${coefficient}.`
        );
      } else {
        setCategoryValidationError(null);
      }
    }

    // Validation 2: Transport minimum (Code 22)
    const transportComponent = components.find((c: any) => c.code === '22');
    const cityTransportMinimum = transportMinData?.monthlyMinimum ? Number(transportMinData.monthlyMinimum) : null;
    const cityTransportDailyRate = transportMinData?.dailyRate ? Number(transportMinData.dailyRate) : null;
    const cityName = transportMinData?.city;

    if (transportComponent) {
      const transportAmount = transportComponent.amount;

      // Only validate if employee has a location assigned AND we have data
      if ((employeeData as any)?.primaryLocationId && cityTransportMinimum !== null && cityName) {
        if (contractType === 'CDDTI') {
          // ✅ IMPORTANT: For CDDTI, transport is DAILY (not hourly)
          // Use correct daily rate from database (÷26 working days, not ÷30)
          const dailyTransportMinimum = cityTransportDailyRate ? Math.round(cityTransportDailyRate) : Math.round(cityTransportMinimum / 26);

          if (Math.round(transportAmount) < dailyTransportMinimum) {
            setTransportValidationError(
              `La prime de transport (${Math.round(transportAmount).toLocaleString('fr-FR')} FCFA/jour) est inférieure au minimum pour ${cityName} (${dailyTransportMinimum.toLocaleString('fr-FR')} FCFA/jour).`
            );
          } else {
            setTransportValidationError(null);
          }
        } else {
          // For other contracts: validate monthly amount
          if (transportAmount < cityTransportMinimum) {
            setTransportValidationError(
              `La prime de transport (${transportAmount.toLocaleString('fr-FR')} FCFA) est inférieure au minimum pour ${cityName} (${cityTransportMinimum.toLocaleString('fr-FR')} FCFA).`
            );
          } else {
            setTransportValidationError(null);
          }
        }
      } else {
        // No location or no data yet → Skip validation (don't block)
        setTransportValidationError(null);
      }
    } else {
      // No transport component → Clear any errors
      setTransportValidationError(null);
    }
  }, [components, componentTotal, employeeData, minWageData, transportMinData, contractType, weeklyHoursRegime]);

  // Mutation - will be updated to accept components
  const changeSalaryMutation = trpc.salaries.change.useMutation({
    onSuccess: async () => {
      // Invalidate all relevant caches to trigger UI refresh
      await utils.salaries.getHistory.invalidate({ employeeId });
      await utils.salaries.getCurrent.invalidate({ employeeId });
      await utils.employees.getById.invalidate({ id: employeeId });

      toast.success('Salaire modifié avec succès');
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/employees/${employeeId}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: SalaryChangeFormData) => {
    changeSalaryMutation.mutate({
      employeeId,
      components: data.components,
      effectiveFrom: new Date(data.effectiveFrom),
      changeReason: data.changeReason,
      notes: data.notes,
    });
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
    const calculationMethod = (metadata as any)?.calculationMethod || (component as any).calculationMethod;

    if (!metadata || typeof metadata !== 'object') {
      return suggestedAmount;
    }

    const calculationRule = (metadata as any).calculationRule;

    // Get salaire catégoriel from current components
    const currentComponents = form.getValues('components') || [];
    const salaireCategorielComponent = currentComponents.find(c => c.code === '11');
    const salaireCategoriel = salaireCategorielComponent?.amount || 0;

    // Auto-calculated components (from metadata)
    if (calculationRule?.type === 'auto-calculated') {
      // Prime d'ancienneté (Code 21): 2% per year, max 25%
      if (code === '21') {
        const hireDate = (employeeData as any)?.hireDate;
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

      // Overtime (TPT_OVERTIME): Not applicable in salary change (needs actual hours)
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
    if (calculationMethod === 'formula' && code === '41') {
      // Family allowances are auto-calculated server-side
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
    const calculatedAmount = calculateComponentAmount(component, suggestedAmount);

    const newComponent: SalaryComponentInstance = {
      code,
      name,
      amount: calculatedAmount,
      sourceType: 'template',
      metadata: 'metadata' in component ? component.metadata as any : undefined,
    };

    const currentComponents = form.getValues('components') || [];
    form.setValue('components', [...currentComponents, newComponent], { shouldValidate: true });
    setShowTemplates(false);
  };

  /**
   * Update base salary amount
   */
  const handleUpdateBaseSalary = (value: string) => {
    setBaseSalaryTouched(true);
    setBaseSalaryInput(value); // Update local state immediately for UI responsiveness

    // Allow empty string during typing
    if (value === '') {
      const currentComponents = form.getValues('components') || [];
      const updatedComponents = currentComponents.map(c =>
        c.code === '11' ? { ...c, amount: 0 } : c
      );
      form.setValue('components', updatedComponents, { shouldValidate: true });
      return;
    }

    // Parse the number
    const newAmount = parseFloat(value);
    if (isNaN(newAmount)) return; // Ignore invalid input

    const currentComponents = form.getValues('components') || [];
    const updatedComponents = currentComponents.map(c =>
      c.code === '11' ? { ...c, amount: newAmount } : c
    );
    form.setValue('components', updatedComponents, { shouldValidate: true });
  };

  /**
   * Remove a component
   */
  const handleRemoveComponent = (index: number) => {
    const component = components[index];

    // Prevent removing base salary components
    if (component && baseSalaryCodes.includes(component.code)) {
      toast.error('Les composantes du salaire de base ne peuvent pas être supprimées');
      return;
    }

    const currentComponents = form.getValues('components') || [];
    form.setValue(
      'components',
      currentComponents.filter((_, i) => i !== index),
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
      const updatedComponents = currentComponents.map((c, i) =>
        i === editingIndex ? { ...c, amount: editAmount } : c
      );
      form.setValue('components', updatedComponents, { shouldValidate: true });
      setEditingIndex(null);
    }
  };

  const canProceedToStep2 =
    !!baseSalary &&
    validationResult?.isValid &&
    !validatingSmig &&
    components.length > 0 &&
    !categoryValidationError &&
    !transportValidationError;
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
          {/* Step 1: Components & Payroll Preview */}
          {step === 1 && (
            <div className="space-y-6">
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
                  {/* CDDTI Alert */}
                  {contractType === 'CDDTI' && (
                    <Alert className="border-blue-500 bg-blue-50">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        <strong>CDDTI - Calcul automatique:</strong>
                        <ul className="mt-2 space-y-1 text-sm">
                          <li>✓ Gratification (6.25%) - prime annuelle de 75% répartie sur l'année</li>
                          <li>✓ Congés payés (10.15%) - provision de 2.2 jours/mois</li>
                          <li>✓ Indemnité de précarité (3%) - calculée sur base + gratification + congés</li>
                        </ul>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Ces montants varient chaque paie selon les heures travaillées.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Base Salary Components (Dynamic based on country) */}
                  {loadingBaseSalary ? (
                    <div className="text-sm text-muted-foreground">Chargement des composantes salariales...</div>
                  ) : baseSalaryDefinitions && baseSalaryDefinitions.length > 0 ? (
                    <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                      <div>
                        <FormLabel className="text-lg">
                          Salaire de base mensuel *
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Composé de {baseSalaryDefinitions.length} élément{baseSalaryDefinitions.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      {baseSalaryDefinitions.map((componentDef) => {
                        const component = components.find(c => c.code === componentDef.code);
                        const value = component?.amount || componentDef.defaultValue || 0;

                        return (
                          <div key={componentDef.code}>
                            <FormLabel>{componentDef.label.fr}</FormLabel>
                            <div className="relative mt-2">
                              <Input
                                type="number"
                                min="0"
                                step="1000"
                                placeholder={componentDef.defaultValue?.toString() || '75000'}
                                value={value}
                                onChange={(e) => {
                                  const newAmount = parseFloat(e.target.value) || 0;
                                  const currentComponents = form.getValues('components') || [];
                                  const componentIndex = currentComponents.findIndex(c => c.code === componentDef.code);

                                  if (componentIndex >= 0) {
                                    // Update existing component
                                    const updated = currentComponents.map((c, i) =>
                                      i === componentIndex ? { ...c, amount: newAmount } : c
                                    );
                                    form.setValue('components', updated, { shouldValidate: true });
                                  } else {
                                    // Add new component
                                    form.setValue('components', [
                                      ...currentComponents,
                                      {
                                        code: componentDef.code,
                                        name: componentDef.name.fr,
                                        amount: newAmount,
                                        sourceType: 'standard' as const,
                                      }
                                    ], { shouldValidate: true });
                                  }
                                }}
                                className="min-h-[48px] text-lg font-semibold pr-24"
                                required={!componentDef.isOptional}
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                {getComponentUnitLabel(componentDef.code)}
                              </span>
                            </div>
                            <FormDescription className="mt-1">{componentDef.description.fr}</FormDescription>
                          </div>
                        );
                      })}

                      {/* Total Base Salary Display */}
                      {baseSalary > 0 && (
                        <div className="p-3 bg-white rounded border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Total salaire de base mensuel
                            </span>
                            <span className="font-bold text-xl">
                              {formatCurrencyUtil(baseSalary)} FCFA/mois
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback to single baseSalary field if no base components configured
                    <div>
                      <FormLabel className="text-lg">
                        Salaire de base mensuel *
                      </FormLabel>
                      <div className="relative mt-2">
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="75000"
                          value={baseSalaryInput}
                          onChange={(e) => handleUpdateBaseSalary(e.target.value)}
                          onBlur={() => setBaseSalaryTouched(true)}
                          className="min-h-[56px] text-2xl font-bold pr-28"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                          {getComponentUnitLabel('11')}
                        </span>
                      </div>
                      <FormDescription className="mt-1">
                        {paymentFrequency !== 'MONTHLY'
                          ? `Sera proraté selon les heures travaillées (paie ${getPaymentFrequencyLabel(paymentFrequency)})`
                          : 'Montant fixe versé chaque mois'}
                      </FormDescription>
                    </div>
                  )}

                  <Separator />

                  {/* Components List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Indemnités et primes</h3>
                      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter un composant
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Ajouter un composant salarial</DialogTitle>
                            <DialogDescription>
                              Sélectionnez parmi les modèles {showAllTemplates ? '' : 'populaires ou '}ou vos composants personnalisés
                            </DialogDescription>
                          </DialogHeader>

                          {/* Toggle to show all templates */}
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {showAllTemplates
                                  ? `${templates?.length || 0} composants disponibles`
                                  : `${templates?.length || 0} composants populaires`}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAllTemplates(!showAllTemplates)}
                            >
                              {showAllTemplates ? 'Populaires uniquement' : 'Voir tous les composants'}
                            </Button>
                          </div>

                          <div className="space-y-4 mt-4">
                            {/* Templates */}
                            {templates && templates.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4" />
                                  {showAllTemplates ? 'Tous les composants' : 'Modèles populaires'}
                                </h4>
                                <div className="grid gap-2">
                                  {templates
                                    .filter(template => {
                                      if (paymentFrequency !== 'MONTHLY') {
                                        // Only show allowances for non-monthly workers
                                        const allowedCodes = ['TPT_TRANSPORT_CI', 'TPT_HOUSING_CI', 'TPT_MEAL_ALLOWANCE', '22', '23', '24'];
                                        return allowedCodes.includes(template.code);
                                      }
                                      return true; // Show all for monthly workers
                                    })
                                    .map((template) => {
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
                                              {calculatedAmount.toLocaleString('fr-FR')} FCFA
                                            </Badge>
                                          </div>
                                        </CardHeader>
                                      </Card>
                                    );
                                  })}
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

                    {/* Display added components (excluding base salary) */}
                    {components.filter(c => !baseSalaryCodes.includes(c.code)).length > 0 && (
                      <div className="space-y-2">
                        {components
                          .filter(c => !baseSalaryCodes.includes(c.code))
                          .map((component, index) => {
                            const actualIndex = components.findIndex(c => c === component);
                            return (
                              <div
                                key={actualIndex}
                                className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{component.name}</p>
                                  {editingIndex === actualIndex ? (
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
                                      {formatCurrencyUtil(component.amount)} {getComponentUnitLabel(component.code)}
                                    </p>
                                  )}
                                </div>
                                {editingIndex !== actualIndex && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditComponent(actualIndex)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveComponent(actualIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {components.filter(c => c.code !== '11').length === 0 && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Aucune indemnité ajoutée. Vous pouvez ajouter des primes et indemnités en cliquant sur "Ajouter un composant".
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Validation Messages */}
                  <div className="space-y-3">
                    {/* SMIG validation - only show after user has interacted */}
                    {baseSalaryTouched && validationResult && !validationResult.isValid && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive font-medium">
                          {validationResult.errorMessage}
                        </p>
                      </div>
                    )}

                    {/* Category minimum wage validation */}
                    {categoryValidationError && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive font-medium">
                          {categoryValidationError}
                        </p>
                      </div>
                    )}

                    {/* Transport minimum validation */}
                    {transportValidationError && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive font-medium">
                          {transportValidationError}
                        </p>
                      </div>
                    )}

                    {/* Payment Frequency Equivalents */}
                    {paymentFrequency !== 'MONTHLY' && componentTotal > 0 && (() => {
                      // All amounts are stored as monthly - calculate equivalents by simple division
                      const weeklyAmount = componentTotal / 4.33;
                      const biweeklyAmount = componentTotal / 2;
                      const dailyAmount = componentTotal / 30;

                      return (
                        <Alert>
                          <Calculator className="h-4 w-4" />
                          <AlertDescription>
                            <strong>💡 Équivalences pour paie {getPaymentFrequencyLabel(paymentFrequency)}:</strong>
                            <div className="mt-2 space-y-1 text-sm">
                              {paymentFrequency === 'WEEKLY' && (
                                <>
                                  <div>Semaine: ~{formatCurrencyUtil(weeklyAmount)} FCFA</div>
                                  <div>Mois (4.33 semaines): ~{formatCurrencyUtil(componentTotal)} FCFA</div>
                                </>
                              )}
                              {paymentFrequency === 'BIWEEKLY' && (
                                <>
                                  <div>Quinzaine: ~{formatCurrencyUtil(biweeklyAmount)} FCFA</div>
                                  <div>Mois (2 quinzaines): ~{formatCurrencyUtil(componentTotal)} FCFA</div>
                                </>
                              )}
                              {paymentFrequency === 'DAILY' && (
                                <>
                                  <div>Jour: ~{formatCurrencyUtil(dailyAmount)} FCFA</div>
                                  <div>Mois (30 jours): ~{formatCurrencyUtil(componentTotal)} FCFA</div>
                                </>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Basé sur le salaire mensuel. Le montant réel dépendra des jours travaillés.
                            </p>
                          </AlertDescription>
                        </Alert>
                      );
                    })()}

                    {/* Weekly Hours Regime Context */}
                    {paymentFrequency !== 'MONTHLY' && weeklyHoursRegime && (
                      <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-sm">
                        <strong>Régime horaire:</strong> {weeklyHoursRegime}
                        <p className="text-xs text-muted-foreground mt-1">
                          Les heures au-delà de {getWeeklyHours(weeklyHoursRegime)}h/semaine
                          seront majorées (heures supplémentaires).
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payroll Preview Button */}
                  {!showPreview && canProceedToStep2 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPreview(true)}
                      className="w-full min-h-[48px]"
                    >
                      <Calculator className="mr-2 h-5 w-5" />
                      Calculer l'aperçu paie
                    </Button>
                  )}

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

              {/* Payroll Preview Card (Progressive Disclosure) */}
              {showPreview && canProceedToStep2 && (
                <PayrollPreviewCard
                  employeeId={employeeId}
                  countryCode={countryCode}
                  newComponents={components}
                  currentComponents={currentSalary.components}
                  paymentFrequency={paymentFrequency}
                  contractType={contractType}
                  // Map employeeType to isExpat boolean for ITS tax calculation (EXPAT = 10.4%, others = 1.2%)
                  isExpat={(employeeData as any)?.employeeType === 'EXPAT' || (employeeData as any)?.isExpat === true}
                />
              )}
            </div>
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
                    newSalary={componentTotal}
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
