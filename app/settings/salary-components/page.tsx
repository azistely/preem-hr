/**
 * Salary Components Management Page
 *
 * Allows tenant admins to:
 * - View standard components (read-only)
 * - Browse template library
 * - Manage custom components
 * - Add from template (one-click)
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, Settings2, Trash2, Pencil, Lock, Settings as SettingsIcon, Palette } from 'lucide-react';
import Link from 'next/link';
import {
  useStandardComponents,
  useCustomComponents,
  useDeleteCustomComponent,
} from '@/features/employees/hooks/use-salary-components';
import { QuickAddTemplate } from '@/features/salary-components/components/quick-add-template';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SalaryComponentTemplate, CustomSalaryComponent } from '@/features/employees/types/salary-components';

export default function SalaryComponentsPage() {
  const [componentToDelete, setComponentToDelete] = useState<CustomSalaryComponent | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const countryCode = 'CI'; // TODO: Get from tenant context

  const { data: standardComponents, isLoading: loadingStandard } = useStandardComponents(countryCode);
  const { data: customComponents, isLoading: loadingCustom, refetch: refetchCustom } = useCustomComponents();

  const deleteComponent = useDeleteCustomComponent();

  const handleTemplateAdded = () => {
    refetchCustom();
  };

  const handleDelete = async () => {
    if (!componentToDelete) return;
    await deleteComponent.mutateAsync({ componentId: componentToDelete.id });
    setComponentToDelete(null);
  };

  return (
    <div className="container mx-auto max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Composants de salaire</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les composants de salaire pour votre organisation
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-6">
        <Button onClick={() => setShowTemplateDialog(true)} variant="default" className="min-h-[48px]">
          <Sparkles className="mr-2 h-5 w-5" />
          Ajouter depuis le catalogue
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="custom" className="space-y-6">
        <TabsList>
          <TabsTrigger value="custom">
            Mes composants ({customComponents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="standard">
            Composants standards ({standardComponents?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Custom Components */}
        <TabsContent value="custom" className="space-y-4">
          {loadingCustom ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Chargement...</p>
              </CardContent>
            </Card>
          ) : customComponents && customComponents.length > 0 ? (
            customComponents.map((component) => (
              <Card key={component.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {component.name}
                      <Badge variant="outline">{component.code}</Badge>
                      {!component.isActive && <Badge variant="secondary">Inactif</Badge>}
                    </CardTitle>
                    {component.description && (
                      <CardDescription className="mt-2">{component.description}</CardDescription>
                    )}
                    {component.templateCode && (
                      <Badge variant="secondary" className="mt-2">
                        Depuis le catalogue: {component.templateCode}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/settings/salary-components/${component.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setComponentToDelete(component)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Settings2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun composant personnalisé</h3>
                  <p className="text-muted-foreground mb-4">
                    Tous les composants doivent être ajoutés depuis le catalogue pour garantir la conformité légale
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setShowTemplateDialog(true)} className="min-h-[48px]">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Parcourir le catalogue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Standard Components (Read-Only) */}
        <TabsContent value="standard" className="space-y-4">
          {loadingStandard ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Chargement...</p>
              </CardContent>
            </Card>
          ) : standardComponents && standardComponents.length > 0 ? (
            standardComponents.map((component) => (
              <Card key={component.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(component.name as Record<string, string>).fr}
                    <Badge variant="outline">{component.code}</Badge>
                    <Badge variant="secondary">Standard</Badge>
                  </CardTitle>
                  <CardDescription>
                    Catégorie: {component.category}
                    {component.isCommon && ' • Commun à tous les employés'}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Aucun composant standard</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Catalog Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Catalogue de composants</DialogTitle>
            <DialogDescription>
              Sélectionnez un composant pré-configuré conforme à la Convention Collective
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <QuickAddTemplate
              countryCode={countryCode}
              onTemplateAdded={handleTemplateAdded}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!componentToDelete} onOpenChange={() => setComponentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le composant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{componentToDelete?.name}" ? Cette action peut être
              annulée en réactivant le composant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
