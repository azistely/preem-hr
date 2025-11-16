"use client";

/**
 * Legal Information Form Component
 *
 * Allows editing legal/regulatory company details with country-specific labels.
 * Shows "CNPS" for CI, "IPRES" for SN, etc.
 *
 * Uses React Hook Form with Zod validation.
 * Design: Card-based layout with large touch targets (≥ 44px).
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

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
import { toast } from "sonner";
import { api } from "@/server/api/client";
import {
  CompanyLegalInfoSchema,
  type CompanyLegalInfo,
} from "@/lib/db/schema/tenant-settings.schema";
import { useCountryFields } from "../../hooks/use-country-fields";

export function LegalInfoForm() {
  const [isEditing, setIsEditing] = useState(false);

  // Get country-specific labels
  const countryFields = useCountryFields();

  // Fetch current tenant data
  const { data: tenant } = api.tenant.getCurrent.useQuery();
  const utils = api.useUtils();

  // Update mutation
  const updateMutation = api.tenant.updateCompanyInfo.useMutation({
    onSuccess: () => {
      toast.success("Informations légales mises à jour");
      setIsEditing(false);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  // Form setup
  const form = useForm<CompanyLegalInfo>({
    resolver: zodResolver(CompanyLegalInfoSchema),
    defaultValues: tenant?.legal || {},
    values: tenant?.legal || {}, // Update form when data loads
  });

  // Handle submit
  const onSubmit = (data: CompanyLegalInfo) => {
    updateMutation.mutate({
      legalInfo: data,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations Légales</CardTitle>
        <CardDescription>
          Identifiants réglementaires et informations fiscales
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Social Security Number (Country-specific label) */}
            <FormField
              control={form.control}
              name="socialSecurityNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {countryFields.socialSecurityLabel}
                    {countryFields.socialSecurityRequired && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder={countryFields.socialSecurityPlaceholder}
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro d'identification auprès de la sécurité sociale
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax ID (Country-specific label) */}
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {countryFields.taxIdLabel}
                    {countryFields.taxIdRequired && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder={countryFields.taxIdPlaceholder}
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro d'identification fiscale
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* RCCM (Business Registration) */}
            <FormField
              control={form.control}
              name="rccm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {countryFields.rccmLabel}
                    {countryFields.rccmRequired && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder={countryFields.rccmPlaceholder}
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro d'immatriculation au Registre du Commerce
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Collective Agreement */}
            <FormField
              control={form.control}
              name="collectiveAgreement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{countryFields.collectiveAgreementLabel}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder={countryFields.collectiveAgreementPlaceholder}
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Convention collective applicable à votre entreprise
                  </FormDescription>
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
