/**
 * Edit Salary Component Page (Option B Architecture)
 *
 * IMPORTANT: This page ONLY allows editing fields in template.customizableFields
 * Tax treatment, CNPS, and category are defined by law (in template) and CANNOT be modified.
 *
 * Architecture:
 * - Template (salary_component_templates) = Law (single source of truth)
 * - Activation (tenant_salary_component_activations) = Tenant customizations
 * - This page edits activation.overrides ONLY
 */

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Check, Lock, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCustomComponents, useUpdateCustomComponent } from '@/features/employees/hooks/use-salary-components';
import { ReadOnlyField } from '@/components/salary-components/read-only-field';

// Dynamic form schema based on customizableFields
const editComponentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').optional(),
  // Dynamic fields will be validated at runtime
  rate: z.number().min(0).max(1).optional(), // For percentage fields (0-100%)
  baseAmount: z.number().min(0).optional(), // For fixed amount fields
});

type FormData = z.infer<typeof editComponentSchema>;

export default function EditSalaryComponentPage() {
  const router = useRouter();
  const params = useParams();
  const componentId = params.id as string;

  const { data: customComponents, isLoading } = useCustomComponents();
  const updateComponent = useUpdateCustomComponent();

  const component = customComponents?.find((c) => c.id === componentId);

  const form = useForm<FormData>({
    resolver: zodResolver(editComponentSchema),
    defaultValues: {
      name: '',
      rate: undefined,
      baseAmount: undefined,
    },
  });

  // Load component data into form
  useEffect(() => {
    if (component) {
      form.reset({
        name: component.name,
        rate: component.metadata?.calculationRule?.rate,
        baseAmount: component.metadata?.calculationRule?.baseAmount,
      });
    }
  }, [component, form]);

  const onSubmit = async (data: FormData) => {
    if (!component) return;

    // Build overrides object with ONLY customizable fields
    const overrides: Record<string, any> = {};

    // Custom name (always allowed)
    const customName = data.name !== component.name ? data.name : undefined;

    // Only include fields that are in customizableFields
    if (component.customizableFields?.includes('calculationRule.rate') && data.rate !== undefined) {
      overrides.calculationRule = { rate: data.rate };
    }

    if (component.customizableFields?.includes('calculationRule.baseAmount') && data.baseAmount !== undefined) {
      overrides.calculationRule = {
        ...(overrides.calculationRule || {}),
        baseAmount: data.baseAmount
      };
    }

    await updateComponent.mutateAsync({
      componentId,
      name: customName,
      metadata: overrides,
    });

    router.push('/settings/salary-components');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!component) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Composant introuvable</h2>
          <Link href="/settings/salary-components">
            <Button>Retour aux composants</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isModifiable = component.customizableFields && component.customizableFields.length > 0;
  const hasRateField = component.customizableFields?.includes('calculationRule.rate');
  const hasAmountField = component.customizableFields?.includes('calculationRule.baseAmount');

  return (
    <div className="container mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings/salary-components">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux composants
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{component.name}</h1>
            <p className="text-muted-foreground mt-2">
              Code: <code className="bg-muted px-2 py-1 rounded">{component.code}</code>
            </p>
            {component.legalReference && (
              <p className="text-sm text-muted-foreground mt-1">
                📜 {component.legalReference}
              </p>
            )}
          </div>
          <Badge variant={component.complianceLevel === 'locked' ? 'destructive' : 'secondary'}>
            {component.complianceLevel === 'locked' && '🔒 Verrouillé'}
            {component.complianceLevel === 'configurable' && '⚙️ Configurable'}
            {component.complianceLevel === 'freeform' && '🎨 Libre'}
          </Badge>
        </div>
      </div>

      {/* Non-modifiable warning */}
      {!isModifiable && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            <strong>Ce composant ne peut pas être modifié.</strong> Tous ses paramètres sont définis par la loi ({component.legalReference || 'Convention Collective'}).
            Vous pouvez uniquement changer son nom d'affichage.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Custom Name */}
          <Card>
            <CardHeader>
              <CardTitle>Nom d'affichage</CardTitle>
              <CardDescription>
                Personnalisez le nom affiché dans votre interface (optionnel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom personnalisé</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={component.name}
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour utiliser le nom par défaut du catalogue
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Customizable Fields (if any) */}
          {isModifiable && (
            <Card>
              <CardHeader>
                <CardTitle>Paramètres modifiables</CardTitle>
                <CardDescription>
                  Ces champs peuvent être personnalisés selon vos besoins
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasRateField && (
                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => {
                      // Legal bounds for housing allowance (CI labor code)
                      const minRate = 0.20; // 20%
                      const maxRate = 0.30; // 30%
                      const recommendedRate = 0.25; // 25%
                      const currentRate = field.value || recommendedRate;

                      return (
                        <FormItem>
                          <FormLabel className="flex items-center justify-between">
                            <span>Taux</span>
                            <span className="text-2xl font-bold text-primary">
                              {Math.round(currentRate * 100)}%
                            </span>
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-4 pt-2">
                              <Slider
                                min={minRate * 100}
                                max={maxRate * 100}
                                step={1}
                                value={[currentRate * 100]}
                                onValueChange={(values) => field.onChange(values[0] / 100)}
                                className="py-4"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Min: {minRate * 100}%</span>
                                <span className="text-primary font-medium">
                                  Recommandé: {recommendedRate * 100}%
                                </span>
                                <span>Max: {maxRate * 100}%</span>
                              </div>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Taux appliqué au salaire de base (Convention Collective Article 20)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}

                {hasAmountField && (
                  <FormField
                    control={form.control}
                    name="baseAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant fixe (FCFA)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            step={1000}
                            placeholder="Ex: 50000"
                            className="min-h-[48px]"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Montant fixe versé à tous les employés
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Read-Only Information: Tax Treatment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Traitement fiscal (Lecture seule)
              </CardTitle>
              <CardDescription>
                Ces paramètres sont définis par le Code Général des Impôts et ne peuvent pas être modifiés
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReadOnlyField
                label="Imposable (ITS)"
                value={component.metadata?.taxTreatment?.isTaxable ? 'Oui' : 'Non'}
                description="Soumis à l'impôt sur les traitements et salaires"
                reason="Code Général des Impôts"
              />
              {component.metadata?.taxTreatment?.isTaxable && (
                <>
                  <ReadOnlyField
                    label="Brut Imposable"
                    value={component.metadata?.taxTreatment?.includeInBrutImposable ? 'Oui' : 'Non'}
                    description="Inclus dans la base de calcul ITS"
                    reason="Code Général des Impôts"
                  />
                  <ReadOnlyField
                    label="Salaire Catégoriel"
                    value={component.metadata?.taxTreatment?.includeInSalaireCategoriel ? 'Oui' : 'Non'}
                    description="Inclus dans la base pour cotisations CNPS"
                    reason="Code Général des Impôts"
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Read-Only Information: CNPS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Cotisations sociales (Lecture seule)
              </CardTitle>
              <CardDescription>
                Ces paramètres sont définis par le Décret CNPS et ne peuvent pas être modifiés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReadOnlyField
                label="Base CNPS"
                value={component.metadata?.socialSecurityTreatment?.includeInCnpsBase ? 'Oui' : 'Non'}
                description="Soumis aux cotisations CNPS (employé + employeur)"
                reason="Décret CNPS"
              />
            </CardContent>
          </Card>

          {/* Compliance Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Conformité légale garantie</strong> – Les paramètres fiscaux et sociaux sont automatiquement mis à jour selon les évolutions législatives de la Côte d'Ivoire.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/settings/salary-components">
              <Button type="button" variant="outline" className="min-h-[44px]">
                Annuler
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={updateComponent.isPending}
              className="min-h-[56px] px-8 bg-green-600 hover:bg-green-700"
            >
              {updateComponent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour en cours...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
