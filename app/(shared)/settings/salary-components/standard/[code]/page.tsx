/**
 * Edit Standard Component Tenant Overrides
 *
 * This page allows tenant admins to customize standard components for their company.
 *
 * Architecture:
 * - System definition (salary_component_definitions) = Law/Regulation (cannot be changed)
 * - Tenant override (tenant_salary_component_activations.overrides) = Company customization
 *
 * Rules:
 * - Tenant can make rules MORE restrictive (lower exemption caps)
 * - Tenant CANNOT make rules LESS restrictive (law takes precedence)
 * - Changes apply to all employees in this tenant
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Check, Lock, Info, Shield, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ReadOnlyField } from '@/components/salary-components/read-only-field';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

// Form schema for tenant overrides
const tenantOverrideSchema = z.object({
  customName: z.string().optional(),
  exemptionCapValue: z.number().min(0).optional(),
});

type FormData = z.infer<typeof tenantOverrideSchema>;

export default function EditStandardComponentPage() {
  const router = useRouter();
  const params = useParams();
  const componentCode = params.code as string;
  const { toast } = useToast();

  const countryCode = 'CI'; // TODO: Get from tenant context

  // Fetch system definition
  const { data: systemDef, isLoading: loadingSystem } = trpc.salaryComponents.getStandardComponent.useQuery({
    code: componentCode,
    countryCode,
  });

  // Fetch tenant override (if exists)
  const { data: tenantOverride, isLoading: loadingTenant } = trpc.salaryComponents.getTenantOverride.useQuery({
    code: componentCode,
  });

  // Mutation for updating tenant override
  const updateOverride = trpc.salaryComponents.updateTenantOverride.useMutation({
    onSuccess: () => {
      toast({
        title: 'Succès',
        description: 'Personnalisation enregistrée avec succès',
      });
      router.push('/settings/salary-components?tab=standard');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(tenantOverrideSchema),
    defaultValues: {
      customName: '',
      exemptionCapValue: undefined,
    },
  });

  // Load data into form
  useEffect(() => {
    if (tenantOverride) {
      const overrides = tenantOverride.overrides as any;
      form.reset({
        customName: tenantOverride.customName || '',
        exemptionCapValue: overrides?.metadata?.taxTreatment?.exemptionCap?.value,
      });
    } else if (systemDef) {
      // Initialize with system values
      const metadata = systemDef.metadata as any;
      form.reset({
        customName: '',
        exemptionCapValue: metadata?.taxTreatment?.exemptionCap?.value,
      });
    }
  }, [systemDef, tenantOverride, form]);

  const onSubmit = async (data: FormData) => {
    if (!systemDef) return;

    // Build overrides object
    const overrides: any = {};

    // Only include exemption cap if it's different from system
    const metadata = systemDef.metadata as any;
    const systemCap = metadata?.taxTreatment?.exemptionCap;
    if (data.exemptionCapValue !== undefined && systemCap) {
      // Validate: Tenant cap must be <= system cap (more restrictive)
      if (data.exemptionCapValue > systemCap.value) {
        toast({
          title: 'Valeur non autorisée',
          description: `Le plafond d'exonération ne peut pas dépasser ${systemCap.value.toLocaleString('fr-FR')} FCFA (défini par la loi)`,
          variant: 'destructive',
        });
        return;
      }

      if (data.exemptionCapValue !== systemCap.value) {
        overrides.metadata = {
          taxTreatment: {
            exemptionCap: {
              type: systemCap.type,
              value: data.exemptionCapValue,
            },
          },
        };
      }
    }

    await updateOverride.mutateAsync({
      code: componentCode,
      customName: data.customName || undefined,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
  };

  if (loadingSystem || loadingTenant) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!systemDef) {
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

  const metadata = systemDef.metadata as any;
  const systemCap = metadata?.taxTreatment?.exemptionCap;
  const hasExemptionCap = systemCap && systemCap.type === 'fixed';
  const tenantOverrides = tenantOverride?.overrides as any;
  const tenantCapValue = tenantOverrides?.metadata?.taxTreatment?.exemptionCap?.value;

  return (
    <div className="container mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings/salary-components?tab=standard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux composants
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{(systemDef.name as Record<string, string>).fr}</h1>
            <p className="text-muted-foreground mt-2">
              Code: <code className="bg-muted px-2 py-1 rounded">{systemDef.code}</code>
            </p>
          </div>
          <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Composant standard
          </Badge>
        </div>
      </div>

      {/* Info */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Personnalisation d'entreprise</strong> - Vous pouvez ajuster certains paramètres pour votre entreprise.
          Les modifications doivent rester conformes à la réglementation (vous ne pouvez que renforcer les règles, pas les assouplir).
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Custom Name */}
          <Card>
            <CardHeader>
              <CardTitle>Nom d'affichage personnalisé</CardTitle>
              <CardDescription>
                Changez le nom affiché dans votre interface (optionnel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="customName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom personnalisé</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={(systemDef.name as Record<string, string>).fr}
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour utiliser le nom standard
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Exemption Cap Override (if applicable) */}
          {hasExemptionCap && (
            <Card>
              <CardHeader>
                <CardTitle>Plafond d'exonération fiscale</CardTitle>
                <CardDescription>
                  Vous pouvez réduire le plafond d'exonération pour votre entreprise (plus restrictif)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Valeur légale: {systemCap.value.toLocaleString('fr-FR')} FCFA</strong>
                    <br />
                    Vous ne pouvez pas dépasser cette valeur (définie par le Code Général des Impôts).
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="exemptionCapValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plafond pour votre entreprise (FCFA)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={systemCap.value.toLocaleString('fr-FR')}
                          className="min-h-[48px]"
                          max={systemCap.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {tenantCapValue && tenantCapValue < systemCap.value ? (
                          <span className="text-orange-600 font-medium">
                            ⚠️ Plafond réduit actuellement: {tenantCapValue.toLocaleString('fr-FR')} FCFA
                          </span>
                        ) : (
                          <>Valeur par défaut: {systemCap.value.toLocaleString('fr-FR')} FCFA (légal)</>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Read-Only System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Définition système (Lecture seule)
              </CardTitle>
              <CardDescription>
                Ces paramètres sont définis par la loi et ne peuvent pas être modifiés
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReadOnlyField
                label="Catégorie"
                value={systemDef.category}
                description="Type de composant"
              />
              <ReadOnlyField
                label="Imposable (ITS)"
                value={metadata?.taxTreatment?.isTaxable ? 'Oui' : 'Non'}
                description="Soumis à l'impôt sur les traitements et salaires"
                reason="Code Général des Impôts"
              />
              {metadata?.taxTreatment?.isTaxable && (
                <>
                  <ReadOnlyField
                    label="Inclus dans Brut Imposable"
                    value={metadata?.taxTreatment?.includeInBrutImposable ? 'Oui' : 'Non'}
                    reason="Code Général des Impôts"
                  />
                  <ReadOnlyField
                    label="Inclus dans Salaire Catégoriel"
                    value={metadata?.taxTreatment?.includeInSalaireCategoriel ? 'Oui' : 'Non'}
                    reason="Code Général des Impôts"
                  />
                </>
              )}
              <ReadOnlyField
                label="Soumis aux cotisations CNPS"
                value={metadata?.socialSecurityTreatment?.includeInCnpsBase ? 'Oui' : 'Non'}
                reason="Décret CNPS"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/settings/salary-components?tab=standard">
              <Button type="button" variant="outline" className="min-h-[44px]">
                Annuler
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={updateOverride.isPending}
              className="min-h-[56px] px-8"
            >
              {updateOverride.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistrer les personnalisations
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
