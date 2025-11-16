"use client";

/**
 * Fund Form Dialog Component
 *
 * Dialog for adding or editing a fund/caisse account.
 * Supports tax offices, social security, insurance, mutual funds.
 *
 * Uses React Hook Form with Zod validation.
 * Design: Modal dialog with large touch targets (≥ 44px).
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/server/api/client";
import {
  AddFundInputSchema,
  type AddFundInput,
  type FundAccount,
} from "@/lib/db/schema/tenant-settings.schema";
import { useCountryFields } from "../../hooks/use-country-fields";

interface FundFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund?: FundAccount; // If provided, we're editing
  mode: "add" | "edit";
}

export function FundFormDialog({ open, onOpenChange, fund, mode }: FundFormDialogProps) {
  const countryFields = useCountryFields();
  const utils = api.useUtils();

  // Mutations
  const addMutation = api.tenant.addFund.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      onOpenChange(false);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'ajout de la caisse");
    },
  });

  const updateMutation = api.tenant.updateFund.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      onOpenChange(false);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour de la caisse");
    },
  });

  // Form setup
  const form = useForm<AddFundInput>({
    resolver: zodResolver(AddFundInputSchema),
    defaultValues: {
      name: "",
      accountNumber: "",
      contact: "",
      type: "tax",
      notes: "",
    },
  });

  // Reset form when fund changes (for edit mode)
  useEffect(() => {
    if (fund && mode === "edit") {
      form.reset({
        name: fund.name,
        accountNumber: fund.accountNumber || "",
        contact: fund.contact || "",
        type: fund.type || "tax",
        notes: fund.notes || "",
      });
    } else {
      form.reset({
        name: "",
        accountNumber: "",
        contact: "",
        type: "tax",
        notes: "",
      });
    }
  }, [fund, mode, form]);

  // Handle submit
  const onSubmit = (data: AddFundInput) => {
    if (mode === "edit" && fund) {
      updateMutation.mutate({
        id: fund.id,
        ...data,
      });
    } else {
      addMutation.mutate(data);
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Modifier la caisse" : "Ajouter une caisse"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Modifiez les informations de la caisse"
              : "Ajoutez une nouvelle caisse (impôts, CNPS, assurance, etc.)"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Fund Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de Caisse</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="tax">Impôts (DGI, DGID)</SelectItem>
                      <SelectItem value="social">Sécurité Sociale (CNPS, IPRES)</SelectItem>
                      <SelectItem value="insurance">Assurance Maladie</SelectItem>
                      <SelectItem value="mutual">Mutuelle d'Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Type d'organisme (fiscal, social, assurance)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fund Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la Caisse *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: DGI (Direction Générale des Impôts)"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Nom complet de l'organisme
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Account Number */}
            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de Compte</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: DGI-2020-12345"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro de compte ou référence auprès de la caisse
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact */}
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Ex: dgi@gouv.ci ou +225 27 20 12 34 56"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Email ou téléphone de contact de la caisse
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Notes additionnelles (optionnel)"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Informations complémentaires
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dialog Footer */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="min-h-[44px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : mode === "edit" ? (
                  "Mettre à jour"
                ) : (
                  "Ajouter"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
