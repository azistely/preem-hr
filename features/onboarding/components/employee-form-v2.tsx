'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from './form-field';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { usePopularTemplates } from '@/features/employees/hooks/use-salary-components';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Edit2, CheckCircle } from 'lucide-react';

const employeeSchemaV2 = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().min(1, 'Le téléphone est requis'),
  positionTitle: z.string().min(1, 'La fonction est requise'),
  baseSalary: z.number().min(75000, 'Inférieur au SMIG de Côte d\'Ivoire (75,000 FCFA)'),
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
  })).optional().default([]),
});

type EmployeeFormData = z.infer<typeof employeeSchemaV2>;

interface EmployeeFormV2Props {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  isSubmitting?: boolean;
}

// Helper: Calculate fiscal parts for preview
function calculateFiscalParts(maritalStatus: string, dependents: number): number {
  let parts = 1.0; // Base

  if (maritalStatus === 'married') {
    parts += 1.0; // +1 for spouse
  }

  // +0.5 per child (max 4 children counted)
  const countedChildren = Math.min(dependents, 4);
  parts += countedChildren * 0.5;

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
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchemaV2),
    defaultValues: {
      maritalStatus: 'single',
      dependentChildren: 0,
      components: [],
      ...defaultValues,
    },
  });

  const maritalStatus = watch('maritalStatus');
  const dependentChildren = watch('dependentChildren') || 0;
  const components = watch('components') || [];
  const fiscalParts = calculateFiscalParts(maritalStatus, dependentChildren);

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

        {/* Base Salary (Always Visible) */}
        <FormField
          label="Salaire de base mensuel"
          type="number"
          {...register('baseSalary', {
            setValueAs: (value) => value ? parseFloat(value) : undefined,
          })}
          error={errors.baseSalary?.message}
          suffix="FCFA"
          required
          helperText="Minimum légal: 75,000 FCFA (SMIG Côte d'Ivoire)"
        />

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
