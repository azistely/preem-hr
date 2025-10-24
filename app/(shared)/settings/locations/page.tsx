/**
 * Location Management Page - Settings / Locations
 *
 * HCI Principles Applied:
 * - Zero Learning Curve: Show locations as visual cards (not a table)
 * - Task-Oriented: Primary action = "Nouveau Site" button (56px height, top-right)
 * - Immediate Feedback: Show location count, loading state, empty state
 * - Progressive Disclosure: Show name/code/city upfront, hide GPS/notes in edit mode
 * - Touch Targets: All buttons ≥44px, primary CTA = 56px
 * - Mobile-First: Single column cards on mobile, 3 columns on desktop
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md
 */

'use client';

import { useState } from 'react';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { LocationsList } from '@/features/locations/components/locations-list';
import { LocationEditor } from '@/features/locations/components/location-editor';
import { PageHeader } from '@/components/page-header';

export default function LocationsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Fetch locations
  const { data: locations, isLoading } = trpc.locations.list.useQuery({
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
      <div className="container mx-auto py-6 max-w-2xl">
        <LocationEditor locationId={editingLocationId} onClose={handleClose} />
      </div>
    );
  }

  // Show list view
  return (
    <div className="container mx-auto py-6 max-w-7xl space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Sites et Établissements"
        description="Gérez les différents sites, succursales et chantiers de votre entreprise"
      />

      {/* Stats & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {isLoading ? (
              'Chargement...'
            ) : (
              <>
                {locations?.length || 0} site
                {locations && locations.length !== 1 ? 's' : ''}
              </>
            )}
          </span>
        </div>
        <Button onClick={handleNew} className="min-h-[56px] w-full sm:w-auto">
          <Plus className="mr-2 h-5 w-5" />
          Nouveau Site
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Chargement des sites...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && (!locations || locations.length === 0) && (
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-muted rounded-full">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle>Aucun site configuré</CardTitle>
            <CardDescription>
              Créez votre premier site pour commencer à suivre les affectations et gérer les
              indemnités de déplacement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleNew} className="min-h-[56px]">
              <Plus className="mr-2 h-5 w-5" />
              Créer le premier site
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Locations List */}
      {!isLoading && locations && locations.length > 0 && (
        <LocationsList locations={locations as any} onEdit={handleEdit} />
      )}
    </div>
  );
}
