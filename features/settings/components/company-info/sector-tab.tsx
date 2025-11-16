"use client";

/**
 * Sector Tab Component for Company Settings
 *
 * Manages company business activity sector configuration.
 * Matches onboarding Q1 structure with sector, work accident rate, and industry fields.
 *
 * HCI Principles:
 * - Same fields as onboarding for consistency
 * - Auto-fill work accident rate from sector selection
 * - Editable fields with validation
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/server/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getWorkAccidentRate, type CGECISector } from "@/lib/cgeci/sector-mapping";

// Form schema matching onboarding Q1
const sectorSettingsSchema = z.object({
  cgeciSectorCode: z.string().min(1, "Sélectionnez un secteur"),
  workAccidentRate: z.coerce.number().min(0).max(10).optional(),
  industry: z.string().optional(),
});

type SectorSettingsFormData = z.infer<typeof sectorSettingsSchema>;

export function SectorTab() {
  const [isEditing, setIsEditing] = useState(false);
  const utils = api.useUtils();

  // Fetch tenant to get current values
  const { data: tenant, isLoading } = api.tenant.getCurrent.useQuery();

  // Update mutation
  const updateMutation = api.tenant.updateSectorSettings.useMutation({
    onSuccess: () => {
      toast.success("Configuration du secteur mise à jour");
      setIsEditing(false);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  // Form setup
  const form = useForm<SectorSettingsFormData>({
    resolver: zodResolver(sectorSettingsSchema),
    defaultValues: {
      cgeciSectorCode: tenant?.cgeciSectorCode || "",
      workAccidentRate: tenant?.legal?.workAccidentRate ?? 2,
      industry: (tenant?.company as any)?.industry || "",
    },
  });

  // Update form when tenant data loads
  useEffect(() => {
    if (tenant) {
      form.reset({
        cgeciSectorCode: tenant.cgeciSectorCode || "",
        workAccidentRate: tenant.legal?.workAccidentRate ?? 2,
        industry: (tenant.company as any)?.industry || "",
      });
    }
  }, [tenant, form]);

  // Auto-fill work accident rate when sector changes (only if no custom rate set)
  const cgeciSectorCode = form.watch("cgeciSectorCode");
  useEffect(() => {
    if (cgeciSectorCode && isEditing && !tenant?.legal?.workAccidentRate) {
      const rate = getWorkAccidentRate(cgeciSectorCode as CGECISector);
      form.setValue("workAccidentRate", rate * 100, { shouldValidate: false });
    }
  }, [cgeciSectorCode, isEditing, tenant?.legal?.workAccidentRate, form]);

  const onSubmit = (data: SectorSettingsFormData) => {
    updateMutation.mutate({
      cgeciSectorCode: data.cgeciSectorCode,
      workAccidentRate: data.workAccidentRate,
      industry: data.industry,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration du Secteur</CardTitle>
        <CardDescription>
          Secteur d'activité, taux d'accident du travail et type d'activité
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tenant?.legal?.workAccidentRate && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Taux AT/MP personnalisé détecté:</strong> Vous utilisez un taux personnalisé
              ({tenant.legal.workAccidentRate}%). Si vous changez de secteur, vous pouvez soit
              conserver ce taux personnalisé, soit le remplacer par le taux standard du nouveau
              secteur.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* CGECI Sector Selection */}
            <FormField
              control={form.control}
              name="cgeciSectorCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Secteur d'activité (CGECI)
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-md min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Sélectionnez votre secteur --</option>
                      <optgroup label="Services Financiers">
                        <option value="BANQUES">🏦 Banques</option>
                        <option value="ASSURANCES">🛡️ Assurances</option>
                      </optgroup>
                      <optgroup label="Commerce & Hôtellerie">
                        <option value="COMMERCE">🏪 Commerce, Distribution</option>
                        <option value="IND_HOTEL">🏨 Hôtellerie</option>
                        <option value="IND_TOURISME">✈️ Tourisme</option>
                      </optgroup>
                      <optgroup label="Construction">
                        <option value="BTP">🏗️ BTP (Bâtiment, Travaux Publics)</option>
                      </optgroup>
                      <optgroup label="Industrie">
                        <option value="IND_MECANIQUE">
                          ⚙️ Industrie Mécanique, Extractive, Alimentaire, Chimique
                        </option>
                        <option value="IND_TEXTILE">👕 Industrie Textile</option>
                        <option value="IND_BOIS">🌳 Industrie du Bois</option>
                        <option value="IND_SUCRE">🍬 Industrie Sucrière</option>
                        <option value="IND_THON">🐟 Industrie du Thon</option>
                        <option value="IND_IMPRIMERIE">🖨️ Imprimerie</option>
                        <option value="IND_POLYGRAPHIQUE">
                          📚 Industrie Polygraphique (Arts Graphiques)
                        </option>
                      </optgroup>
                      <optgroup label="Transport & Logistique">
                        <option value="AUX_TRANSPORT">🚛 Transport, Logistique</option>
                        <option value="PETROLE_DISTRIB">⛽ Distribution de Pétrole</option>
                      </optgroup>
                      <optgroup label="Services">
                        <option value="NETTOYAGE">✨ Nettoyage</option>
                        <option value="SECURITE">🛡️ Sécurité, Gardiennage</option>
                        <option value="GENS_MAISON">🏠 Gens de Maison</option>
                      </optgroup>
                    </select>
                  </FormControl>
                  <FormDescription>
                    Votre secteur détermine les catégories d'employés et salaires minimums
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Work Accident Rate */}
            <FormField
              control={form.control}
              name="workAccidentRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux d'accident du travail (AT/MP)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="Ex: 2.5"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {cgeciSectorCode && isEditing
                      ? `Taux standard pour ${cgeciSectorCode}: ${(getWorkAccidentRate(cgeciSectorCode as CGECISector) * 100).toFixed(2)}% (modifiable)`
                      : "Taux fourni par la CNPS (0-10%)"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Industry Detail */}
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type d'activité précis</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: Vente de vêtements, Restaurant, Coiffure"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>Description détaillée de votre activité</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-4">
              {!isEditing ? (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="min-h-[44px]"
                >
                  Modifier
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px]"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      form.reset();
                    }}
                    disabled={updateMutation.isPending}
                    className="min-h-[44px]"
                  >
                    Annuler
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
