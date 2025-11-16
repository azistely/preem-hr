"use client";

/**
 * General Information Form Component
 *
 * Allows editing basic company details like name, address, contact info.
 * Uses React Hook Form with Zod validation.
 *
 * Design: Card-based layout with large touch targets (≥ 44px).
 * All text in French, mobile-responsive.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  CompanyGeneralInfoSchema,
  type CompanyGeneralInfo,
} from "@/lib/db/schema/tenant-settings.schema";

export function GeneralInfoForm() {
  const [isEditing, setIsEditing] = useState(false);

  // Fetch current tenant data
  const { data: tenant } = api.tenant.getCurrent.useQuery();
  const utils = api.useUtils();

  // Update mutation
  const updateMutation = api.tenant.updateCompanyInfo.useMutation({
    onSuccess: () => {
      toast.success("Informations générales mises à jour");
      setIsEditing(false);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  // Form setup
  const form = useForm<CompanyGeneralInfo>({
    resolver: zodResolver(CompanyGeneralInfoSchema),
    defaultValues: tenant?.company || {},
    values: tenant?.company || {}, // Update form when data loads
  });

  // Handle submit
  const onSubmit = (data: CompanyGeneralInfo) => {
    updateMutation.mutate({
      generalInfo: data,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations Générales</CardTitle>
        <CardDescription>
          Informations de base sur votre entreprise
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Legal Name */}
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison Sociale</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: Preem Technologies SARL"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Nom légal de l'entreprise tel qu'enregistré
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trade Name */}
            <FormField
              control={form.control}
              name="tradeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom Commercial</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: Preem"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Nom utilisé pour la communication
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Legal Representative */}
            <FormField
              control={form.control}
              name="legalRepresentative"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Représentant Légal</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: Jean Dupont"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Dirigeant ou gérant de l'entreprise
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Founded Date */}
            <FormField
              control={form.control}
              name="foundedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de Création</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="date"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Date de création de l'entreprise
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: 01 BP 1234 Abidjan 01"
                      disabled={!isEditing}
                      className="min-h-[96px] resize-none"
                    />
                  </FormControl>
                  <FormDescription>
                    Adresse complète du siège social
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="tel"
                      placeholder="Ex: +225 27 20 12 34 56"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro de téléphone principal
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="email"
                      placeholder="Ex: contact@preem.com"
                      disabled={!isEditing}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Email de contact de l'entreprise
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
