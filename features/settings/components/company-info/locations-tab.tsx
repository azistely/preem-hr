"use client";

/**
 * Locations Tab Component for Company Settings
 *
 * Manages company locations (headquarters, branches, sites, construction sites).
 * Extracted from the standalone locations page for use within tabbed settings.
 *
 * HCI Principles:
 * - Task-Oriented: Primary action = "Nouveau Site" button
 * - Visual Cards: Show locations as cards (not table)
 * - Progressive Disclosure: Basic info upfront, details in editor
 * - Touch Targets: All buttons ≥44px, primary CTA = 56px
 */

import { useState } from "react";
import { Plus, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/server/api/client";
import { LocationsList } from "@/features/locations/components/locations-list";
import { LocationEditor } from "@/features/locations/components/location-editor";

export function LocationsTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Fetch locations
  const { data: locations, isLoading } = api.locations.list.useQuery({
    includeInactive: false,
  });

  const handleEdit = (locationId: string) => {
    setEditingLocationId(locationId);
    setIsEditing(true);
  };

  const handleNew = () => {
    setEditingLocationId(null);
    setIsEditing(true);
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditingLocationId(null);
  };

  // Show editor view
  if (isEditing) {
    return (
      <div className="max-w-2xl">
        <LocationEditor locationId={editingLocationId} onClose={handleClose} />
      </div>
    );
  }

  // Show list view
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Sites et Établissements</CardTitle>
            <CardDescription>
              Gérez les différents sites, succursales et chantiers de votre entreprise
            </CardDescription>
          </div>
          <Button onClick={handleNew} className="min-h-[56px] w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            Nouveau Site
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats Bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <MapPin className="h-4 w-4" />
          <span>
            {isLoading ? (
              "Chargement..."
            ) : (
              <>
                {locations?.length || 0} site
                {locations && locations.length !== 1 ? "s" : ""}
              </>
            )}
          </span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Chargement des sites...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!locations || locations.length === 0) && (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-muted rounded-full">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun site configuré</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Créez votre premier site pour commencer à suivre les affectations et gérer les
              indemnités de déplacement.
            </p>
            <Button onClick={handleNew} className="min-h-[56px]">
              <Plus className="mr-2 h-5 w-5" />
              Créer le premier site
            </Button>
          </div>
        )}

        {/* Locations List */}
        {!isLoading && locations && locations.length > 0 && (
          <LocationsList locations={locations as any} onEdit={handleEdit} />
        )}
      </CardContent>
    </Card>
  );
}
