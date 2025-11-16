"use client";

/**
 * Funds Manager Component
 *
 * Displays and manages all fund/caisse accounts (tax offices, social security, etc.).
 * Supports adding, editing, and deleting funds.
 *
 * Design: Card-based grid layout with large touch targets (≥ 44px).
 * Mobile-responsive with vertical stacking on small screens.
 */

import { useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/server/api/client";
import type { FundAccount } from "@/lib/db/schema/tenant-settings.schema";
import { FundFormDialog } from "./fund-form-dialog";

export function FundsManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<FundAccount | null>(null);
  const [deletingFund, setDeletingFund] = useState<FundAccount | null>(null);

  // Fetch current tenant data
  const { data: tenant } = api.tenant.getCurrent.useQuery();
  const utils = api.useUtils();

  // Delete mutation
  const deleteMutation = api.tenant.removeFund.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setDeletingFund(null);
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la suppression de la caisse");
    },
  });

  const funds = tenant?.funds || [];

  // Get badge variant based on fund type
  const getFundTypeBadge = (type?: "tax" | "social" | "insurance" | "mutual") => {
    switch (type) {
      case "tax":
        return { label: "Impôts", variant: "default" as const };
      case "social":
        return { label: "Social", variant: "secondary" as const };
      case "insurance":
        return { label: "Assurance", variant: "outline" as const };
      case "mutual":
        return { label: "Mutuelle", variant: "outline" as const };
      default:
        return { label: "Autre", variant: "outline" as const };
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Caisses et Comptes</CardTitle>
              <CardDescription>
                Organismes fiscaux, sociaux et d'assurance
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="min-h-[44px]"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une caisse
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {funds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune caisse configurée</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Ajoutez vos caisses (DGI, CNPS, CMU, etc.) pour faciliter la gestion des déclarations
              </p>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une caisse
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {funds.map((fund: FundAccount) => {
                const badge = getFundTypeBadge(fund.type);
                return (
                  <Card key={fund.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base">{fund.name}</CardTitle>
                          <Badge variant={badge.variant} className="mt-2">
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingFund(fund)}
                            className="h-9 w-9"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingFund(fund)}
                            className="h-9 w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {fund.accountNumber && (
                        <div>
                          <span className="text-muted-foreground">Numéro de compte: </span>
                          <span className="font-medium">{fund.accountNumber}</span>
                        </div>
                      )}
                      {fund.contact && (
                        <div>
                          <span className="text-muted-foreground">Contact: </span>
                          <span className="font-medium">{fund.contact}</span>
                        </div>
                      )}
                      {fund.notes && (
                        <div>
                          <span className="text-muted-foreground">Notes: </span>
                          <span>{fund.notes}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <FundFormDialog
        open={isAddDialogOpen || editingFund !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingFund(null);
          }
        }}
        fund={editingFund || undefined}
        mode={editingFund ? "edit" : "add"}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingFund !== null} onOpenChange={(open) => !open && setDeletingFund(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la caisse{" "}
              <strong>{deletingFund?.name}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFund) {
                  deleteMutation.mutate({ fundId: deletingFund.id });
                }
              }}
              disabled={deleteMutation.isPending}
              className="min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
