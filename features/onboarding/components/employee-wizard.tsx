'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc/client';
import { Wizard, WizardStep } from '@/components/wizard/wizard';
import { FormField } from './form-field';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Plus, X, Edit2, CheckCircle, ChevronDown } from 'lucide-react';
import { RateTypeSelector, type RateType } from '@/components/employees/rate-type-selector';
import { usePopularTemplates } from '@/features/employees/hooks/use-salary-components';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Schema from EmployeeFormV2
const employeeSchemaV2 = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().min(1, 'Le téléphone est requis'),
  positionTitle: z.string().min(1, 'La fonction est requise'),
  contractType: z.enum(['CDI', 'CDD', 'STAGE']),
  contractEndDate: z.date().optional(),
  cddReason: z.enum(['REMPLACEMENT', 'SURCROIT_ACTIVITE', 'SAISONNIER', 'PROJET', 'AUTRE']).optional(),
  category: z.string().min(1, 'La catégorie professionnelle est requise'),
  departmentId: z.string().optional(),
  primaryLocationId: z.string().min(1, 'Le site principal est requis'),
  baseComponents: z.record(z.string(), z.number()).optional(),
  baseSalary: z.number().optional(),
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
  hireDate: z.date({ required_error: 'La date d\'embauche est requise', invalid_type_error: 'Date invalide' }),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
  dependentChildren: z.number().min(0).max(10),
  components: z.array(z.object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
    sourceType: z.enum(['standard', 'template']),
  })),
}).refine((data) => {
  if (data.contractType === 'CDD' && !data.contractEndDate) {
    return false;
  }
  return true;
}, {
  message: 'La date de fin de contrat est requise pour un CDD',
  path: ['contractEndDate'],
}).refine((data) => {
  if (data.contractType === 'CDD' && !data.cddReason) {
    return false;
  }
  return true;
}, {
  message: 'Le motif du CDD est requis par la loi',
  path: ['cddReason'],
}).refine((data) => {
  // Validate hire date is before contract end date for CDD
  if (data.contractType === 'CDD' && data.contractEndDate && data.hireDate) {
    return data.hireDate < data.contractEndDate;
  }
  return true;
}, {
  message: 'La date d\'embauche doit être avant la date de fin de contrat',
  path: ['contractEndDate'],
});

type EmployeeFormData = z.infer<typeof employeeSchemaV2>;

interface EmployeeWizardProps {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  isSubmitting?: boolean;
  initialStep?: number; // Starting step (for returning from preview)
  onStepChange?: (step: number) => void; // Callback when step changes
}

// Helper: Calculate fiscal parts
function calculateFiscalParts(maritalStatus: string, dependents: number): number {
  let parts = 1.0;
  if (maritalStatus === 'married') parts += 1.0;
  const countedChildren = Math.min(dependents, 4);
  parts += countedChildren * 0.5;
  return parts;
}

export function EmployeeWizard({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  initialStep = 0,
  onStepChange,
}: EmployeeWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Get minimum wage data
  const { data: minWageData } = trpc.salaries.getMinimumWage.useQuery();
  const minimumWage = minWageData?.minimumWage || 75000;
  const countryCode = minWageData?.countryCode || 'CI';

  // Get tenant data for CGECI sector
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const cgeciSectorCode = tenant?.cgeciSectorCode;

  // Load locations for primary site selection
  const { data: locations, isLoading: loadingLocations } = trpc.locations.list.useQuery();

  // Load CGECI categories
  const { data: cgeciCategories, isLoading: loadingCategories } =
    trpc.cgeci.getCategoriesBySector.useQuery(
      { sectorCode: cgeciSectorCode || '', countryCode },
      { enabled: !!cgeciSectorCode }
    );

  // Load base salary components
  const { data: baseComponents, isLoading: loadingBaseComponents } =
    trpc.salaryComponents.getBaseSalaryComponents.useQuery(
      { countryCode },
      { enabled: !!countryCode }
    );

  // Load popular templates for allowances
  const { data: templates, isLoading: loadingTemplates } = usePopularTemplates(countryCode);

  // Dynamic schema with category-specific minimum wage + required transport minimum
  const employeeSchemaWithCategory = employeeSchemaV2.superRefine((data, ctx) => {
    // Calculate base salary only (not including allowances/indemnités)
    let baseSalaryTotal = 0;
    if (data.baseComponents) {
      baseSalaryTotal = Object.values(data.baseComponents).reduce((sum, amt) => sum + amt, 0);
    } else if (data.baseSalary) {
      baseSalaryTotal = data.baseSalary;
    }

    // Use category-specific minimum wage if category is selected
    const selectedCat = cgeciCategories?.find((cat) => cat.category === data.category);
    const monthlyMinimum = selectedCat?.actualMinimumWage
      ? Number(selectedCat.actualMinimumWage)
      : minimumWage;

    // Convert minimum wage based on rate type
    const rateType = data.rateType || 'MONTHLY';
    let requiredMinimum = monthlyMinimum;
    let rateLabel = 'mensuel';

    if (rateType === 'DAILY') {
      // Daily rate = monthly / 30 days
      requiredMinimum = Math.round(monthlyMinimum / 30);
      rateLabel = 'journalier';
    } else if (rateType === 'HOURLY') {
      // Hourly rate = monthly / (30 days × 8 hours)
      requiredMinimum = Math.round(monthlyMinimum / (30 * 8));
      rateLabel = 'horaire';
    }

    // Validate base salary (salaire catégoriel) only, not gross salary with allowances
    if (baseSalaryTotal < requiredMinimum) {
      const categoryLabel = selectedCat?.labelFr || 'la catégorie sélectionnée';
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseComponents'],
        message: `Le salaire catégoriel ${rateLabel} doit être ≥ ${requiredMinimum.toLocaleString('fr-FR')} FCFA (minimum pour ${categoryLabel})`,
      });
    }

    // Validate transport allowance is REQUIRED and >= city minimum
    const transportComponent = data.components.find((c) =>
      c.code.toLowerCase().includes('transport') || c.code === 'IND_TRANSPORT'
    );

    // Transport is REQUIRED (compulsory component)
    if (!transportComponent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components'],
        message: `L'indemnité de transport est obligatoire. Ajoutez une indemnité de transport.`,
      });
    } else if (cityTransportMinimum) {
      // Validate transport >= city minimum (convert based on rate type)
      const monthlyTransportMinimum = cityTransportMinimum.monthlyMinimum;
      const cityName = cityTransportMinimum.displayName?.fr || cityTransportMinimum.cityName;

      // Convert transport minimum based on rate type
      let requiredTransportMinimum = monthlyTransportMinimum;
      let transportRateLabel = 'mensuel';

      if (rateType === 'DAILY') {
        // Daily transport = monthly / 30 days
        requiredTransportMinimum = Math.round(monthlyTransportMinimum / 30);
        transportRateLabel = 'journalier';
      } else if (rateType === 'HOURLY') {
        // Hourly transport = monthly / (30 days × 8 hours)
        requiredTransportMinimum = Math.round(monthlyTransportMinimum / (30 * 8));
        transportRateLabel = 'horaire';
      }

      if (transportComponent.amount < requiredTransportMinimum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['components'],
          message: `L'indemnité de transport ${transportRateLabel} (${transportComponent.amount.toLocaleString('fr-FR')} FCFA) est inférieure au minimum légal pour ${cityName} (${requiredTransportMinimum.toLocaleString('fr-FR')} FCFA minimum)`,
        });
      }
    }
  });

  const { register, handleSubmit, watch, setValue, formState: { errors }, trigger } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchemaWithCategory),
    defaultValues: {
      maritalStatus: 'single',
      dependentChildren: 0,
      components: [],
      baseComponents: {},
      rateType: 'MONTHLY',
      contractType: 'CDI',
      category: '',
      ...defaultValues,
    },
  });

  // Watched values
  const maritalStatus = watch('maritalStatus');
  const dependentChildren = watch('dependentChildren') || 0;
  const components = watch('components') || [];
  const baseComponentsData = watch('baseComponents') || {};
  const rateType = (watch('rateType') || 'MONTHLY') as RateType;
  const contractType = watch('contractType');
  const selectedCategory = watch('category');
  const primaryLocationId = watch('primaryLocationId');
  const fiscalParts = calculateFiscalParts(maritalStatus, dependentChildren);
  const baseSalaryTotal = Object.values(baseComponentsData).reduce((sum, amt) => sum + (amt || 0), 0);

  // Get selected location details
  const selectedLocation = locations?.find((loc) => loc.id === primaryLocationId);

  // Load city transport minimum based on selected location's city
  // This provides the legal minimum transport allowance for the employee's work location
  const { data: cityTransportMinimum } = trpc.payroll.getCityTransportMinimum.useQuery(
    {
      countryCode: countryCode,
      city: selectedLocation?.city || undefined,
    },
    {
      enabled: !!countryCode && !!selectedLocation,
    }
  );

  // Auto-select location if only one exists
  useEffect(() => {
    if (locations && locations.length === 1 && !primaryLocationId) {
      setValue('primaryLocationId', locations[0].id, { shouldValidate: true });
    }
  }, [locations, primaryLocationId, setValue]);

  // Get category-specific minimum wage
  const selectedCategoryData = cgeciCategories?.find((cat) => cat.category === selectedCategory);
  const monthlyMinimumWage = selectedCategoryData?.actualMinimumWage
    ? Number(selectedCategoryData.actualMinimumWage)
    : minimumWage;

  // Convert minimum wage based on rate type for display and validation
  const categoryMinimumWage = useMemo(() => {
    if (rateType === 'DAILY') {
      return Math.round(monthlyMinimumWage / 30);
    } else if (rateType === 'HOURLY') {
      return Math.round(monthlyMinimumWage / (30 * 8));
    }
    return monthlyMinimumWage;
  }, [monthlyMinimumWage, rateType]);

  // Component handlers for Step 5
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  const handleAddComponent = (template: any, amount: number) => {
    const name = typeof template.name === 'object' ? template.name.fr : template.name;
    const newComponent = {
      code: template.code,
      name,
      amount,
      sourceType: 'template' as const,
    };
    setValue('components', [...components, newComponent], { shouldValidate: true });
  };

  const handleRemoveComponent = (index: number) => {
    setValue('components', components.filter((_, i) => i !== index), { shouldValidate: true });
  };

  const handleEditComponent = (index: number, amount: number) => {
    const updated = components.map((c, i) => (i === index ? { ...c, amount } : c));
    setValue('components', updated, { shouldValidate: true });
  };

  // Define wizard steps
  const wizardSteps: WizardStep[] = [
    // STEP 1: Identité
    {
      title: 'Identité',
      description: 'Informations de base de l\'employé',
      validate: async () => {
        return await trigger(['firstName', 'lastName', 'phone', 'positionTitle', 'primaryLocationId']);
      },
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Prénom"
              {...register('firstName')}
              error={errors.firstName?.message}
              required
              placeholder="Ex: Jean"
            />

            <FormField
              label="Nom"
              {...register('lastName')}
              error={errors.lastName?.message}
              required
              placeholder="Ex: Kouassi"
            />
          </div>

          <FormField
            label="Téléphone"
            type="tel"
            {...register('phone')}
            error={errors.phone?.message}
            placeholder="+225 01 23 45 67 89"
            required
          />

          <FormField
            label="Fonction"
            {...register('positionTitle')}
            error={errors.positionTitle?.message}
            placeholder="Ex: Gérant, Vendeur, Caissier"
            required
          />

          {/* Primary Location Selector */}
          <FormField
            label="Lieu de travail"
            type="select"
            {...register('primaryLocationId')}
            error={errors.primaryLocationId?.message}
            required
            helperText="Où l'employé travaille habituellement"
          >
            <option value="">-- Sélectionnez --</option>
            {loadingLocations ? (
              <option disabled>Chargement...</option>
            ) : locations && locations.length > 0 ? (
              locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName}
                </option>
              ))
            ) : (
              <option disabled>Aucun lieu disponible</option>
            )}
          </FormField>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                Plus d'options
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <FormField
                label="Email (optionnel)"
                type="email"
                {...register('email')}
                error={errors.email?.message}
                placeholder="Ex: jean.kouassi@example.com"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      ),
    },

    // STEP 2: Type de contrat
    {
      title: 'Type de contrat',
      description: 'Informations contractuelles',
      validate: async () => {
        return await trigger(['contractType', 'contractEndDate', 'cddReason', 'hireDate']);
      },
      content: (
        <div className="space-y-4">
          <FormField
            label="Type de contrat"
            type="select"
            {...register('contractType')}
            error={errors.contractType?.message}
            required
            helperText="CDI = permanent, CDD = contrat à durée déterminée"
          >
            <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
            <option value="CDD">CDD (Contrat à Durée Déterminée)</option>
            <option value="STAGE">Stage / Apprentissage</option>
          </FormField>

          <FormField
            label="Date d'embauche"
            type="date"
            {...register('hireDate', {
              setValueAs: (value) => {
                if (!value || value === '') return undefined;
                const date = new Date(value);
                return isNaN(date.getTime()) ? undefined : date;
              },
            })}
            error={errors.hireDate?.message}
            required
          />

          {contractType === 'CDD' && (
            <>
              <FormField
                label="Date de fin de contrat"
                type="date"
                {...register('contractEndDate', {
                  setValueAs: (value) => {
                    if (!value || value === '') return undefined;
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? undefined : date;
                  },
                })}
                error={errors.contractEndDate?.message}
                required
                helperText="Dernière date de travail prévue"
              />

              <FormField
                label="Motif du CDD"
                type="select"
                {...register('cddReason')}
                error={errors.cddReason?.message}
                required
                helperText="Justification légale requise pour un contrat à durée déterminée"
              >
                <option value="">-- Sélectionnez un motif --</option>
                <option value="REMPLACEMENT">Remplacement d'un salarié absent</option>
                <option value="SURCROIT_ACTIVITE">Surcroît temporaire d'activité</option>
                <option value="SAISONNIER">Emploi à caractère saisonnier</option>
                <option value="PROJET">Réalisation d'un projet ou tâche précise</option>
                <option value="AUTRE">Autre motif légal</option>
              </FormField>
            </>
          )}
        </div>
      ),
    },

    // STEP 3: Catégorie professionnelle
    {
      title: 'Catégorie professionnelle',
      description: 'Détermine le salaire minimum selon votre secteur',
      validate: async () => {
        return await trigger(['category']);
      },
      content: (
        <div className="space-y-4">
          <FormField
            label="Catégorie professionnelle"
            type="select"
            {...register('category')}
            error={errors.category?.message}
            required
            helperText="Votre secteur d'activité détermine les catégories disponibles"
          >
            <option value="">-- Sélectionnez une catégorie --</option>
            {loadingCategories ? (
              <option disabled>Chargement des catégories...</option>
            ) : cgeciCategories && cgeciCategories.length > 0 ? (
              cgeciCategories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.labelFr} (Coef. {cat.minCoefficient}
                  {cat.maxCoefficient && cat.maxCoefficient !== cat.minCoefficient
                    ? `-${cat.maxCoefficient}`
                    : ''}
                  {cat.actualMinimumWage
                    ? ` - ${Number(cat.actualMinimumWage).toLocaleString('fr-FR')} FCFA min.`
                    : ''})
                </option>
              ))
            ) : (
              <option disabled>
                {cgeciSectorCode
                  ? 'Aucune catégorie disponible pour ce secteur'
                  : 'Veuillez d\'abord configurer le secteur de votre entreprise'}
              </option>
            )}
          </FormField>
        </div>
      ),
    },

    // STEP 4: Situation familiale
    {
      title: 'Situation familiale',
      description: 'Pour le calcul de l\'impôt sur le revenu (ITS)',
      validate: async () => {
        return await trigger(['maritalStatus', 'dependentChildren']);
      },
      content: (
        <div className="space-y-4">
          <FormField
            label="Statut marital"
            type="select"
            {...register('maritalStatus')}
            error={errors.maritalStatus?.message}
            required
          >
            <option value="single">Célibataire</option>
            <option value="married">Marié(e)</option>
            <option value="divorced">Divorcé(e)</option>
            <option value="widowed">Veuf/Veuve</option>
          </FormField>

          <FormField
            label="Nombre d'enfants à charge"
            type="number"
            {...register('dependentChildren', {
              setValueAs: (value) => value ? parseInt(value, 10) : 0,
            })}
            error={errors.dependentChildren?.message}
            required
            helperText="Réduit l'impôt sur le revenu (ITS)"
          />

          {/* Fiscal parts preview */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="space-y-2">
              <div className="font-semibold">Parts fiscales calculées: {fiscalParts}</div>
              <div className="text-sm text-muted-foreground">
                1.0 (base)
                {maritalStatus === 'married' && ' + 1.0 (marié)'}
                {dependentChildren > 0 && ` + ${Math.min(dependentChildren, 4) * 0.5} (${Math.min(dependentChildren, 4)} enfant${Math.min(dependentChildren, 4) > 1 ? 's' : ''})`}
              </div>
              {dependentChildren > 4 && (
                <div className="text-xs text-orange-600">
                  Note: Maximum 4 enfants pris en compte pour le calcul fiscal
                </div>
              )}
            </div>
          </Card>
        </div>
      ),
    },

    // STEP 5: Rémunération
    {
      title: 'Rémunération',
      description: 'Salaire et indemnités',
      validate: async () => {
        return await trigger(['baseComponents', 'baseSalary', 'rateType']);
      },
      content: (
        <div className="space-y-4">
          {/* Rate Type Selector */}
          <input type="hidden" {...register('rateType')} value={rateType} />
          <RateTypeSelector
            value={rateType}
            onChange={async (newRateType) => {
              setValue('rateType', newRateType as any);
              // Re-trigger validation for baseComponents since minimum wage changes with rate type
              await trigger(['rateType', 'baseComponents']);
            }}
          />

          {/* Base Salary Components */}
          {loadingBaseComponents ? (
            <div className="text-sm text-muted-foreground">Chargement des composantes salariales...</div>
          ) : baseComponents && baseComponents.length > 0 ? (
            <Card className="p-4 space-y-3 bg-blue-50 border-blue-200">
              <div>
                <p className="font-medium">
                  {rateType === 'MONTHLY' && 'Salaire de base mensuel'}
                  {rateType === 'DAILY' && 'Tarif journalier de base'}
                  {rateType === 'HOURLY' && 'Tarif horaire de base'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Composé de {baseComponents.length} élément{baseComponents.length > 1 ? 's' : ''}
                </p>
              </div>

              {baseComponents.map((component) => (
                <FormField
                  key={component.code}
                  label={component.label.fr}
                  type="number"
                  {...register(`baseComponents.${component.code}`, {
                    setValueAs: (value) => value ? parseFloat(value) : (component.defaultValue || 0),
                  })}
                  error={errors.baseComponents?.[component.code]?.message}
                  suffix={rateType === 'MONTHLY' ? 'FCFA/mois' : rateType === 'DAILY' ? 'FCFA/jour' : 'FCFA/heure'}
                  required={!component.isOptional}
                  helperText={component.description.fr}
                />
              ))}

              {baseSalaryTotal > 0 && (
                <div className="p-3 bg-white rounded border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total tarif de base</span>
                    <span className="font-bold text-lg">
                      {baseSalaryTotal.toLocaleString('fr-FR')} {rateType === 'MONTHLY' ? 'FCFA/mois' : rateType === 'DAILY' ? 'FCFA/jour' : 'FCFA/heure'}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {/* Category-Specific Minimum Wage Warning */}
          {baseSalaryTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedCategoryData ? (
                <>
                  Le salaire catégoriel {rateType === 'MONTHLY' ? '(mensuel)' : rateType === 'DAILY' ? '(journalier)' : '(horaire)'} doit atteindre{' '}
                  <strong className="text-foreground">
                    {categoryMinimumWage.toLocaleString('fr-FR')} FCFA{rateType === 'MONTHLY' ? '/mois' : rateType === 'DAILY' ? '/jour' : '/heure'}
                  </strong>{' '}
                  minimum pour la catégorie <strong className="text-foreground">{selectedCategoryData.labelFr}</strong>
                  {baseSalaryTotal < categoryMinimumWage && (
                    <span className="text-destructive block mt-1">
                      ⚠️ Actuel: {baseSalaryTotal.toLocaleString('fr-FR')} FCFA (insuffisant)
                    </span>
                  )}
                </>
              ) : (
                <>
                  Le salaire catégoriel {rateType === 'MONTHLY' ? '(mensuel)' : rateType === 'DAILY' ? '(journalier)' : '(horaire)'} doit atteindre{' '}
                  {categoryMinimumWage.toLocaleString('fr-FR')} FCFA{rateType === 'MONTHLY' ? '/mois' : rateType === 'DAILY' ? '/jour' : '/heure'} minimum
                  {selectedCategory && ' (sélectionnez une catégorie pour voir le minimum spécifique)'}
                </>
              )}
            </p>
          )}

          {components.length > 0 && (
            <p className="text-xs text-muted-foreground italic">
              💡 Les indemnités (transport, logement...) s'ajoutent au salaire catégoriel
            </p>
          )}

          {/* Component Picker Section */}
          <div className="space-y-3">
            {/* Added Components List */}
            {components.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Indemnités ajoutées</p>
                {components.map((component, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{component.name}</p>
                      {editingIndex === index ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                            className="h-8 w-32 px-2 border rounded"
                            min={0}
                            step={1000}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleEditComponent(index, editAmount);
                              setEditingIndex(null);
                            }}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {component.amount.toLocaleString('fr-FR')} FCFA
                        </p>
                      )}
                    </div>
                    {editingIndex !== index && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndex(index);
                            setEditAmount(component.amount);
                          }}
                          className="p-2 hover:bg-muted rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(index)}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* City Transport Minimum Info */}
            {cityTransportMinimum && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">
                  🚗 Transport pour {cityTransportMinimum.displayName?.fr || selectedLocation?.city}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  Minimum légal: <strong>{cityTransportMinimum.monthlyMinimum.toLocaleString('fr-FR')} FCFA/mois</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1 italic">
                  L'indemnité de transport est obligatoire et doit être ≥ ce minimum
                </p>
                {cityTransportMinimum.legalReference?.fr && (
                  <p className="text-xs text-blue-600 mt-1">
                    📜 {cityTransportMinimum.legalReference.fr}
                  </p>
                )}
              </div>
            )}

            {/* Add Component Button */}
            <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter des indemnités (transport, logement...)
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajouter une indemnité</DialogTitle>
                  <DialogDescription>
                    Sélectionnez un modèle d'indemnité courante
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 mt-4">
                  {loadingTemplates && <p className="text-sm text-muted-foreground">Chargement...</p>}

                  {templates && templates.length > 0 ? (
                    templates.map((template) => (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => {
                          handleAddComponent(template, parseFloat(String(template.suggestedAmount || '10000')));
                          setShowTemplates(false);
                        }}
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
                    ))
                  ) : (
                    !loadingTemplates && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun modèle d'indemnité disponible
                      </p>
                    )
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Total Preview */}
            {components.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total indemnités</span>
                  <span className="font-bold">
                    {components.reduce((sum, c) => sum + c.amount, 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    onStepChange?.(step); // Notify parent of step change
  };

  return (
    <Wizard
      steps={wizardSteps}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      onComplete={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    />
  );
}
