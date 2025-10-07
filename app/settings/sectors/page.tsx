/**
 * Sector Management Settings Page
 *
 * HCI Principles Applied:
 * - Pattern 4: Cognitive Load Minimization (show essential, hide advanced)
 * - Pattern 5: Immediate Feedback (optimistic UI updates)
 * - Pattern 6: Country-Aware Smart Defaults (auto-load tenant country)
 * - Pattern 9: Sector Rates (show impact, not raw percentages)
 *
 * Allows admin to:
 * - View current tenant sector
 * - Change sector (affects all employees in Phase 1)
 * - See work accident rate impact
 * - View required salary components
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, AlertTriangle, Info, Building2, Shield } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function SectorManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedSectorCode, setSelectedSectorCode] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Get tenant ID from context (simplified - in real app would come from auth)
  const tenantId = 'your-tenant-id'; // TODO: Get from auth context
  const countryCode = 'CI'; // TODO: Get from tenant

  // Fetch current sector
  const { data: currentSector, isLoading: isLoadingSector } =
    trpc.sectors.getTenantSector.useQuery({ tenantId });

  // Fetch available sectors
  const { data: availableSectors, isLoading: isLoadingSectors } =
    trpc.sectors.getSectorsByCountry.useQuery({ countryCode });

  // Update sector mutation
  const updateSector = trpc.sectors.updateTenantSector.useMutation({
    onMutate: () => {
      toast({
        title: 'Mise à jour en cours...',
        description: 'Changement de secteur d\'activité',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Secteur mis à jour!',
        description: 'Le nouveau secteur a été appliqué avec succès.',
        variant: 'default',
      });
      setShowConfirmDialog(false);
      // Refresh data
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSectorChange = () => {
    if (!selectedSectorCode) return;

    updateSector.mutate({
      tenantId,
      sectorCode: selectedSectorCode,
    });
  };

  const selectedSector = availableSectors?.find(
    (s) => s.sectorCode === selectedSectorCode
  );

  if (isLoadingSector || isLoadingSectors) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux paramètres
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Secteur d'activité</h1>
        <p className="text-muted-foreground mt-2">
          Le secteur détermine le taux de cotisation AT/MP et les composants de salaire
          requis.
        </p>
      </div>

      {/* Current Sector Display */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Secteur actuel
          </CardTitle>
          <CardDescription>
            Secteur d'activité de votre entreprise
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentSector ? (
            <div className="space-y-4">
              {/* Level 1: Essential Info */}
              <div>
                <div className="text-lg font-medium mb-2">
                  {currentSector.sectorNameFr}
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {currentSector.sectorCode}
                  </Badge>
                  <Badge variant="outline">
                    <Shield className="mr-1 h-3 w-3" />
                    Taux AT/MP: {currentSector.workAccidentRate}%
                  </Badge>
                </div>
              </div>

              {/* Level 2: Details (Collapsible) */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Voir les détails
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  {/* Work Accident Rate Explanation */}
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium mb-1">
                      Cotisation Accidents du Travail et Maladies Professionnelles
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Taux appliqué sur le brut salarial:{' '}
                      <strong>{currentSector.workAccidentRate}%</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Ce taux varie selon le niveau de risque du secteur d'activité.
                    </p>
                  </div>

                  {/* Required Components */}
                  {currentSector.requiredComponents.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium mb-2">
                        Composants de salaire requis
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {currentSector.requiredComponents.map((component) => (
                          <Badge key={component} variant="outline">
                            {component}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Ces composants doivent être activés dans vos paramètres de paie.
                      </p>
                    </div>
                  )}

                  {/* Legal Reference */}
                  {currentSector.legalReference && (
                    <p className="text-xs text-muted-foreground">
                      📜 Référence: {currentSector.legalReference}
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aucun secteur configuré pour votre entreprise.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Change Sector */}
      <Card>
        <CardHeader>
          <CardTitle>Changer de secteur</CardTitle>
          <CardDescription>
            Sélectionnez le secteur d'activité correspondant à votre entreprise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning: Phase 1 affects all employees */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Le changement de secteur affectera le calcul de
              paie pour tous vos employés.
            </AlertDescription>
          </Alert>

          {/* Sector Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nouveau secteur</label>
            <Select
              value={selectedSectorCode}
              onValueChange={setSelectedSectorCode}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Sélectionnez un secteur" />
              </SelectTrigger>
              <SelectContent>
                {availableSectors?.map((sector) => (
                  <SelectItem
                    key={sector.sectorCode}
                    value={sector.sectorCode}
                    className="min-h-[56px] py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{sector.sectorNameFr}</span>
                      <span className="text-xs text-muted-foreground">
                        Taux AT/MP: {sector.workAccidentRate}%
                        {sector.requiredComponents.length > 0 &&
                          ` • ${sector.requiredComponents.length} composant(s) requis`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show impact of selected sector */}
          {selectedSector && selectedSector.sectorCode !== currentSector?.sectorCode && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-3">Aperçu des changements:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Taux AT/MP actuel:
                  </span>
                  <span>{currentSector?.workAccidentRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nouveau taux AT/MP:</span>
                  <span className="font-medium text-primary">
                    {selectedSector.workAccidentRate}%
                  </span>
                </div>
                {selectedSector.requiredComponents.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">
                      Nouveaux composants requis:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSector.requiredComponents.map((comp) => (
                        <Badge key={comp} variant="outline" className="text-xs">
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={
                !selectedSectorCode ||
                selectedSectorCode === currentSector?.sectorCode ||
                updateSector.isPending
              }
              className="min-h-[48px]"
            >
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le changement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le changement de secteur</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de changer le secteur d'activité de votre entreprise.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ce changement affectera tous les calculs de paie futurs pour l'ensemble de
                vos employés.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Secteur actuel:</span>
                <span className="font-medium">{currentSector?.sectorNameFr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nouveau secteur:</span>
                <span className="font-medium text-primary">
                  {selectedSector?.sectorNameFr}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={updateSector.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSectorChange}
              disabled={updateSector.isPending}
            >
              {updateSector.isPending ? 'Mise à jour...' : 'Confirmer le changement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
