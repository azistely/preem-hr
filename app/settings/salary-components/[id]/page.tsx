/**
 * Edit Custom Salary Component Page
 *
 * Form to edit an existing tenant-specific custom component
 * with country-aware metadata builder (CI-specific for now)
 */

'use client';

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCustomComponents, useUpdateCustomComponent, useFormulaHistory } from '@/features/employees/hooks/use-salary-components';
import { buildCIMetadata } from '@/lib/salary-components/metadata-builder';
import type { CIComponentMetadata } from '@/features/employees/types/salary-components';
import { FormulaBuilder } from '@/components/salary-components/formula-builder';
import { FormulaPreview } from '@/components/salary-components/formula-preview';
import { FormulaHistory } from '@/components/salary-components/formula-history';

// Form schema
const editComponentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.enum(['allowance', 'bonus', 'deduction', 'benefit']),

  // CI Tax Treatment
  isTaxable: z.boolean(),
  includeInBrutImposable: z.boolean().optional(),
  includeInSalaireCategoriel: z.boolean().optional(),
  exemptionCap: z.number().min(0).optional(),

  // CI Social Security
  includeInCnpsBase: z.boolean().optional(),
});

type FormData = z.infer<typeof editComponentSchema>;

export default function EditSalaryComponentPage() {
  const router = useRouter();
  const params = useParams();
  const componentId = params.id as string;

  const { data: customComponents, isLoading } = useCustomComponents();
  const updateComponent = useUpdateCustomComponent();
  const { data: versionHistory, isLoading: isLoadingHistory } = useFormulaHistory(componentId);

  const component = customComponents?.find((c) => c.id === componentId);

  // Component metadata state (includes formula)
  const [componentMetadata, setComponentMetadata] = useState<CIComponentMetadata>({
    taxTreatment: {
      isTaxable: true,
      includeInBrutImposable: true,
      includeInSalaireCategoriel: false,
    },
    socialSecurityTreatment: {
      includeInCnpsBase: false,
    },
    calculationRule: {
      type: 'fixed',
      baseAmount: 0,
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(editComponentSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'allowance',
      isTaxable: true,
      includeInBrutImposable: true,
      includeInSalaireCategoriel: false,
      includeInCnpsBase: false,
    },
  });

  // Load component data into form and metadata state
  useEffect(() => {
    if (component) {
      const metadata = component.metadata as CIComponentMetadata;

      form.reset({
        name: component.name,
        description: component.description || '',
        category: metadata.category || 'allowance',
        isTaxable: metadata.taxTreatment?.isTaxable ?? true,
        includeInBrutImposable: metadata.taxTreatment?.includeInBrutImposable ?? true,
        includeInSalaireCategoriel: metadata.taxTreatment?.includeInSalaireCategoriel ?? false,
        exemptionCap: metadata.taxTreatment?.exemptionCap,
        includeInCnpsBase: metadata.socialSecurityTreatment?.includeInCnpsBase ?? false,
      });

      // Load formula metadata into state
      setComponentMetadata(metadata);
    }
  }, [component, form]);

  const isTaxable = form.watch('isTaxable');
  const includeInBrutImposable = form.watch('includeInBrutImposable');
  const includeInSalaireCategoriel = form.watch('includeInSalaireCategoriel');

  // Auto-check Brut Imposable when Salaire Catégoriel is checked (CI rule)
  const handleSalaireCategorielChange = (checked: boolean) => {
    if (checked) {
      form.setValue('includeInBrutImposable', true);
    }
    form.setValue('includeInSalaireCategoriel', checked);
  };

  // Handle formula metadata changes
  const handleMetadataChange = (newMetadata: CIComponentMetadata) => {
    setComponentMetadata(newMetadata);
  };

  const onSubmit = async (data: FormData) => {
    // Build CI metadata from form inputs + formula
    const metadata: CIComponentMetadata = {
      ...buildCIMetadata({
        isTaxable: data.isTaxable,
        includeInBrutImposable: data.includeInBrutImposable ?? data.isTaxable,
        includeInSalaireCategoriel: data.includeInSalaireCategoriel ?? false,
        exemptionCap: data.exemptionCap,
        includeInCnpsBase: data.includeInCnpsBase ?? false,
      }),
      // Merge formula from FormulaBuilder
      calculationRule: componentMetadata.calculationRule,
    };

    await updateComponent.mutateAsync({
      componentId,
      name: data.name,
      description: data.description,
      metadata,
    });

    // Redirect to settings page on success
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
        <h1 className="text-3xl font-bold">Modifier le composant</h1>
        <p className="text-muted-foreground mt-2">
          Code: <code className="bg-muted px-2 py-1 rounded">{component.code}</code>
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
              <CardDescription>Nom et description du composant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du composant *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Prime de risque minier"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Décrivez le composant..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="allowance">Indemnité</SelectItem>
                        <SelectItem value="bonus">Prime</SelectItem>
                        <SelectItem value="benefit">Avantage</SelectItem>
                        <SelectItem value="deduction">Déduction</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Formula Builder */}
          <FormulaBuilder metadata={componentMetadata} onChange={handleMetadataChange} />

          {/* Formula Preview */}
          <FormulaPreview metadata={componentMetadata} />

          {/* Formula History */}
          <FormulaHistory
            versions={versionHistory || []}
            currentVersionNumber={versionHistory?.[0]?.versionNumber}
            loading={isLoadingHistory}
          />

          {/* Tax Treatment (CI-Specific) */}
          <Card>
            <CardHeader>
              <CardTitle>Traitement fiscal (Côte d'Ivoire)</CardTitle>
              <CardDescription>
                Comment ce composant est traité dans le calcul de l'ITS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isTaxable"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="font-semibold">Imposable</FormLabel>
                      <FormDescription>
                        Ce composant est soumis à l'impôt sur les traitements et salaires (ITS)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {isTaxable && (
                <>
                  <FormField
                    control={form.control}
                    name="includeInBrutImposable"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0 pl-6">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel>Inclure dans le Brut Imposable</FormLabel>
                          <FormDescription className="text-xs">
                            Base de calcul pour l'ITS après déductions
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includeInSalaireCategoriel"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0 pl-6">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={handleSalaireCategorielChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel>Inclure dans le Salaire Catégoriel</FormLabel>
                          <FormDescription className="text-xs">
                            Base pour les cotisations CNPS
                            {includeInSalaireCategoriel && !includeInBrutImposable && (
                              <span className="text-destructive block mt-1">
                                ⚠ Le Salaire Catégoriel doit être dans le Brut Imposable
                              </span>
                            )}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="exemptionCap"
                    render={({ field }) => (
                      <FormItem className="pl-6">
                        <FormLabel>Plafond d'exonération (optionnel)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            step={1000}
                            placeholder="Ex: 30000 (transport exempt jusqu'à 30k)"
                            className="min-h-[48px]"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Montant maximal exonéré d'impôt (en FCFA)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Social Security Treatment (CI-Specific) */}
          <Card>
            <CardHeader>
              <CardTitle>Cotisations sociales (CNPS)</CardTitle>
              <CardDescription>
                Comment ce composant est traité dans le calcul des cotisations CNPS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="includeInCnpsBase"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel>Inclure dans la base CNPS</FormLabel>
                      <FormDescription>
                        Ce composant est soumis aux cotisations CNPS (employé + employeur)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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
