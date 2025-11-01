'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from './form-field';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { usePopularTemplates } from '@/features/employees/hooks/use-salary-components';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Edit2, CheckCircle } from 'lucide-react';
import { RateTypeSelector, type RateType } from '@/components/employees/rate-type-selector';
import { SalaryInput } from '@/components/employees/salary-input';

// Base schema without country-specific validation
// Country-specific SMIG validation will be added dynamically in the component
const employeeSchemaV2 = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().min(1, 'Le téléphone est requis'),
  positionTitle: z.string().min(1, 'La fonction est requise'),

  // NEW: Employment configuration
  contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE']),
  contractEndDate: z.date().optional(),
  category: z.string().min(1, 'La catégorie professionnelle est requise'), // Dynamic CGECI category
  departmentId: z.string().optional(),

  // Daily workers fields (Phase 2)
  weeklyHoursRegime: z.enum(['40h', '44h', '48h', '52h', '56h']).optional(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),

  // NEW: Base salary components (Code 11, Code 12 for CI)
  baseComponents: z.record(z.string(), z.number()).optional(),

  // DEPRECATED: Keep for backward compatibility
  baseSalary: z.number().optional(),

  // GAP-JOUR-003: Rate type support
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),

  hireDate: z.date({ required_error: 'La date d\'embauche est requise', invalid_type_error: 'Date invalide' }),

  // CRITICAL: Family status
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
  dependentChildren: z.number().min(0).max(10),

  // NEW: Components array (replaces individual allowance fields)
  components: z.array(z.object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
    sourceType: z.enum(['standard', 'template']),
  })),
}).refine((data) => {
  // If CDD or CDDTI selected, contractEndDate is required
  if ((data.contractType === 'CDD' || data.contractType === 'CDDTI') && !data.contractEndDate) {
    return false;
  }
  return true;
}, {
  message: 'La date de fin de contrat est requise pour un CDD/CDDTI',
  path: ['contractEndDate'],
}).refine((data) => {
  // Validate hire date is before contract end date for CDD/CDDTI
  if ((data.contractType === 'CDD' || data.contractType === 'CDDTI') && data.contractEndDate && data.hireDate) {
    return data.hireDate < data.contractEndDate;
  }
  return true;
}, {
  message: 'La date d\'embauche doit être avant la date de fin de contrat',
  path: ['contractEndDate'],
});

type EmployeeFormData = z.infer<typeof employeeSchemaV2>;

interface EmployeeFormV2Props {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Calculate fiscal parts (CORRECTED FORMULA)
 *
 * Côte d'Ivoire Rules:
 * - Single without children: 1.0
 * - Single with children: 1.5 (base for single parent) + 0.5 × children
 * - Married: 2.0 (includes spouse) + 0.5 × children
 * - Maximum 4 children counted
 */
function calculateFiscalParts(maritalStatus: string, dependents: number): number {
  let parts: number;

  // Determine base parts
  if (maritalStatus === 'married') {
    // Married base (includes spouse)
    parts = 2.0;
  } else if (dependents > 0) {
    // Single parent with at least 1 child gets 1.5 base
    parts = 1.5;
  } else {
    // Single without children
    parts = 1.0;
  }

  // Add 0.5 per dependent (max 4 counted)
  const countedDependents = Math.min(dependents, 4);
  parts += countedDependents * 0.5;

  return parts;
}

// ============================================================================
// Component Picker Section
// ============================================================================

interface ComponentPickerSectionProps {
  components: Array<{code: string; name: string; amount: number; sourceType: string}>;
  onAddComponent: (component: any, amount: number) => void;
  onRemoveComponent: (index: number) => void;
  onEditComponent: (index: number, amount: number) => void;
}

function ComponentPickerSection({
  components,
  onAddComponent,
  onRemoveComponent,
  onEditComponent
}: ComponentPickerSectionProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  // Get minimum wage for country code
  const { data: minWageData } = trpc.salaries.getMinimumWage.useQuery();
  const countryCode = minWageData?.countryCode || 'CI';

  // Load popular templates for this country
  const { data: templates, isLoading: loadingTemplates } = usePopularTemplates(countryCode);

  return (
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
                        onEditComponent(index, editAmount);
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
                    onClick={() => onRemoveComponent(index)}
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

      {/* Add Component Button with Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter des indemnités (transport, logement...)
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une indemnité</DialogTitle>
            <DialogDescription>
              Sélectionnez un modèle d'indemnité courante (transport, logement, téléphone...)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {loadingTemplates && (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            )}

            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    onAddComponent(
                      template,
                      parseFloat(String(template.suggestedAmount || '10000'))
                    );
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
  );
}

export function EmployeeFormV2({ defaultValues, onSubmit, isSubmitting = false }: EmployeeFormV2Props) {
  // Get minimum wage data (includes country code and minimum wage)
  const { data: minWageData } = trpc.salaries.getMinimumWage.useQuery();
  const minimumWage = minWageData?.minimumWage || 75000;
  const countryCode = minWageData?.countryCode || 'CI';

  // Get tenant data to fetch CGECI sector
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const cgeciSectorCode = tenant?.cgeciSectorCode;

  // Load CGECI categories for company's sector
  const { data: cgeciCategories, isLoading: loadingCategories } =
    trpc.cgeci.getCategoriesBySector.useQuery(
      {
        sectorCode: cgeciSectorCode || '',
        countryCode,
      },
      { enabled: !!cgeciSectorCode }
    );

  // Load base salary components for this country
  const { data: baseComponents, isLoading: loadingBaseComponents } =
    trpc.salaryComponents.getBaseSalaryComponents.useQuery(
      { countryCode },
      { enabled: !!countryCode }
    );

  // Create dynamic schema with country-specific minimum wage
  const employeeSchemaWithCountry = employeeSchemaV2.refine((data) => {
      // SMIG validation: Check GROSS salary (base + all components) not just base
      const componentsTotal = data.components.reduce((sum, c) => sum + c.amount, 0);

      // Calculate base salary from baseComponents or fall back to baseSalary
      let baseSalaryTotal = 0;
      if (data.baseComponents) {
        baseSalaryTotal = Object.values(data.baseComponents).reduce((sum, amt) => sum + amt, 0);
      } else if (data.baseSalary) {
        baseSalaryTotal = data.baseSalary;
      }

      const grossSalary = baseSalaryTotal + componentsTotal;

      return grossSalary >= minimumWage;
  }, {
    message: `Le salaire brut total (salaire de base + indemnités) doit être supérieur ou égal au SMIG de ${minWageData?.countryName || 'votre pays'} (${minimumWage.toLocaleString('fr-FR')} FCFA)`,
    path: ['baseComponents'],
  });

  // Fetch departments for selector (skip for now - will be implemented separately)
  // TODO: Add departments list endpoint
  const departments: Array<{ id: string; name: string }> = [];

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchemaWithCountry),
    defaultValues: {
      maritalStatus: 'single',
      dependentChildren: 0,
      components: [],
      baseComponents: {},
      rateType: 'MONTHLY',
      contractType: 'CDI',
      category: '', // Will be selected from dynamic CGECI categories
      ...defaultValues,
    },
  });

  const maritalStatus = watch('maritalStatus');
  const dependentChildren = watch('dependentChildren') || 0;
  const components = watch('components') || [];
  const baseComponentsData = watch('baseComponents') || {};
  const rateType = (watch('rateType') || 'MONTHLY') as RateType;
  const contractType = watch('contractType');
  const category = watch('category');
  const fiscalParts = calculateFiscalParts(maritalStatus, dependentChildren);

  // Calculate total base salary from base components
  const baseSalaryTotal = Object.values(baseComponentsData).reduce((sum, amt) => sum + (amt || 0), 0);

  // Component handlers
  const handleAddComponent = (template: any, amount: number) => {
    const name =
      typeof template.name === 'object'
        ? (template.name as Record<string, string>).fr
        : template.name;

    const newComponent = {
      code: template.code,
      name,
      amount,
      sourceType: 'template' as const,
    };

    setValue('components', [...components, newComponent], { shouldValidate: true });
  };

  const handleRemoveComponent = (index: number) => {
    setValue(
      'components',
      components.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const handleEditComponent = (index: number, amount: number) => {
    const updated = components.map((c, i) =>
      i === index ? { ...c, amount } : c
    );
    setValue('components', updated, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Informations de base</h3>

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
          label="Email (optionnel)"
          type="email"
          {...register('email')}
          error={errors.email?.message}
          placeholder="Ex: jean.kouassi@example.com"
        />

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
      </div>

      {/* NEW: Employment Configuration */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
        <h3 className="text-lg font-semibold">Détails du contrat</h3>

        <FormField
          label="Type de contrat"
          type="select"
          {...register('contractType')}
          error={errors.contractType?.message}
          required
          helperText="CDI = permanent, CDD/CDDTI = durée déterminée"
        >
          <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
          <option value="CDD">CDD (Contrat à Durée Déterminée)</option>
          <option value="CDDTI">CDDTI (Travailleur Occasionnel)</option>
          <option value="STAGE">Stage / Apprentissage</option>
        </FormField>

        <FormField
          label="Date d'embauche"
          type="date"
          {...register('hireDate', {
            setValueAs: (value) => {
              // Handle empty string or undefined
              if (!value || value === '') return undefined;
              const date = new Date(value);
              return isNaN(date.getTime()) ? undefined : date;
            },
          })}
          error={errors.hireDate?.message}
          required
        />

        {(contractType === 'CDD' || contractType === 'CDDTI') && (
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
            helperText={contractType === 'CDDTI' ? "Date de fin de la tâche/mission" : "Dernière date de travail prévue"}
          />
        )}

        {/* Daily Workers Fields - Show only for CDDTI */}
        {contractType === 'CDDTI' && (
          <>
            <FormField
              label="Régime horaire hebdomadaire"
              type="select"
              {...register('weeklyHoursRegime')}
              error={errors.weeklyHoursRegime?.message}
              helperText="Détermine le seuil d'heures supplémentaires"
            >
              <option value="40h">40h (Standard - Services)</option>
              <option value="44h">44h (Commerce / Retail)</option>
              <option value="48h">48h (Agriculture / Élevage)</option>
              <option value="52h">52h (Saisonnier)</option>
              <option value="56h">56h (Sécurité / Domestique)</option>
            </FormField>

            <FormField
              label="Fréquence de paiement"
              type="select"
              {...register('paymentFrequency')}
              error={errors.paymentFrequency?.message}
              helperText="Détermine le nombre de clôtures par mois"
            >
              <option value="MONTHLY">Mensuel (1 clôture/mois)</option>
              <option value="BIWEEKLY">Quinzaine (2 clôtures/mois)</option>
              <option value="WEEKLY">Hebdomadaire (4 clôtures/mois)</option>
              <option value="DAILY">Journalier (rare)</option>
            </FormField>
          </>
        )}

        <FormField
          label="Catégorie professionnelle"
          type="select"
          {...register('category')}
          error={errors.category?.message}
          required
          helperText="Détermine le salaire minimum légal selon votre secteur d'activité"
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

        {/* Department selector - only show if departments exist */}
        {departments && departments.length > 0 && (
          <FormField
            label="Département (optionnel)"
            type="select"
            {...register('departmentId')}
            error={errors.departmentId?.message}
            helperText="Vous pourrez l'ajouter plus tard"
          >
            <option value="">-- Aucun département --</option>
            {departments.map((dept: { id: string; name: string }) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </FormField>
        )}
      </div>

      {/* CRITICAL: Family Status (for tax calculation) */}
      <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
        <div>
          <h3 className="text-lg font-semibold">
            Situation familiale
          </h3>
          <p className="text-sm text-muted-foreground">
            Pour le calcul de l'impôt sur le revenu (ITS)
          </p>
        </div>

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

        {/* Show fiscal parts preview */}
        <div className="text-sm p-3 bg-white rounded border">
          <strong>Parts fiscales calculées: {fiscalParts}</strong>
          <p className="text-muted-foreground mt-1">
            1.0 (base)
            {maritalStatus === 'married' && ' + 1.0 (marié)'}
            {dependentChildren > 0 && ` + ${Math.min(dependentChildren, 4) * 0.5} (${Math.min(dependentChildren, 4)} enfant${Math.min(dependentChildren, 4) > 1 ? 's' : ''})`}
          </p>
          {dependentChildren > 4 && (
            <p className="text-xs text-orange-600 mt-1">
              Note: Maximum 4 enfants pris en compte pour le calcul fiscal
            </p>
          )}
        </div>
      </div>

      {/* Salary with Component Picker */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Rémunération</h3>

        {/* GAP-JOUR-003: Rate Type Selector */}
        <input type="hidden" {...register('rateType')} value={rateType} />
        <RateTypeSelector
          value={rateType}
          onChange={(newRateType) => setValue('rateType', newRateType as any, { shouldValidate: true })}
        />

        {/* Base Salary Components (Dynamic based on country) */}
        {loadingBaseComponents ? (
          <div className="text-sm text-muted-foreground">Chargement des composantes salariales...</div>
        ) : baseComponents && baseComponents.length > 0 ? (
          <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
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

            {/* Total Base Salary Display */}
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
          </div>
        ) : (
          // Fallback to single baseSalary field if no base components configured
          <SalaryInput
            rateType={rateType}
            value={watch('baseSalary')}
            onChange={(val) => setValue('baseSalary', val, { shouldValidate: true })}
            error={errors.baseSalary?.message}
            minimumWage={minimumWage}
          />
        )}

        {/* Minimum Wage Warning */}
        {(baseSalaryTotal > 0 || components.length > 0) && (
          <p className="text-sm text-muted-foreground">
            Le salaire brut total (base + indemnités) doit atteindre {minimumWage.toLocaleString('fr-FR')} FCFA minimum
          </p>
        )}

        {/* Component Picker Section */}
        <ComponentPickerSection
          components={components}
          onAddComponent={handleAddComponent}
          onRemoveComponent={handleRemoveComponent}
          onEditComponent={handleEditComponent}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full min-h-[56px]"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Ajout en cours...' : 'Ajouter cet employé →'}
      </Button>
    </form>
  );
}
