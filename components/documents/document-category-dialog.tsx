'use client';

/**
 * Document Category Configuration Dialog
 * Epic: Document Management System
 *
 * Features:
 * - View all document categories and their settings
 * - Toggle permissions (upload, approval required, employee upload)
 * - Reorder categories via drag & drop or input
 * - Edit category labels and icons
 *
 * Design principles:
 * - Zero learning curve: Toggle switches for simple on/off settings
 * - Visual feedback: Icons and labels show category purpose
 * - Progressive disclosure: Advanced settings hidden by default
 * - Mobile-friendly: Touch-friendly targets, responsive layout
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Settings,
  FileText,
  CheckCircle,
  XCircle,
  Upload,
  ShieldAlert,
  Users,
  Eye,
  EyeOff,
  Loader2,
  Save,
  X,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

// =====================================================
// Props Interface
// =====================================================

interface DocumentCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =====================================================
// Main Component
// =====================================================

export function DocumentCategoryDialog({
  open,
  onOpenChange,
}: DocumentCategoryDialogProps) {
  const { toast } = useToast();
  const [editingCategories, setEditingCategories] = useState<Record<string, any>>({});

  // Fetch categories
  const { data: categories, isLoading, refetch } = api.documents.listCategories.useQuery(
    undefined,
    { enabled: open }
  );

  // Update mutation
  const updateMutation = api.documents.updateCategory.useMutation({
    onSuccess: () => {
      toast({
        title: 'Catégorie mise à jour',
        description: 'Les paramètres ont été enregistrés avec succès',
      });
      refetch();
      setEditingCategories({});
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour la catégorie',
      });
    },
  });

  // Handle toggle change
  const handleToggle = (categoryId: string, field: string, value: boolean) => {
    setEditingCategories((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: value,
      },
    }));
  };

  // Save changes for a category
  const handleSave = (categoryId: string) => {
    const updates = editingCategories[categoryId];
    if (!updates || Object.keys(updates).length === 0) return;

    updateMutation.mutate({
      categoryId,
      data: updates,
    });
  };

  // Check if category has unsaved changes
  const hasChanges = (categoryId: string) => {
    return editingCategories[categoryId] && Object.keys(editingCategories[categoryId]).length > 0;
  };

  // Get current value for a field (edited or original)
  const getValue = (category: any, field: string) => {
    return editingCategories[category.id]?.[field] ?? category[field];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration des Catégories de Documents
          </DialogTitle>
          <DialogDescription>
            Gérez les catégories de documents disponibles et leurs permissions
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !categories || categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune catégorie disponible</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">Téléchargement autorisé</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <span className="text-muted-foreground">Approbation RH requise</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Employé peut télécharger</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span className="text-muted-foreground">Génération automatique</span>
              </div>
            </div>

            <Separator />

            {/* Categories Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Catégorie</TableHead>
                    <TableHead className="text-center">Téléchargement</TableHead>
                    <TableHead className="text-center">Approbation RH</TableHead>
                    <TableHead className="text-center">Employé Upload</TableHead>
                    <TableHead className="text-center">Génération Auto</TableHead>
                    <TableHead className="text-center w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} className={cn(
                      hasChanges(category.id) && 'bg-blue-50 dark:bg-blue-950/20'
                    )}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{category.labelFr}</div>
                            <div className="text-xs text-muted-foreground">{category.code}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch
                          checked={getValue(category, 'allowsUpload')}
                          onCheckedChange={(checked) =>
                            handleToggle(category.id, 'allowsUpload', checked)
                          }
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch
                          checked={getValue(category, 'requiresHrApproval')}
                          onCheckedChange={(checked) =>
                            handleToggle(category.id, 'requiresHrApproval', checked)
                          }
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch
                          checked={getValue(category, 'employeeCanUpload')}
                          onCheckedChange={(checked) =>
                            handleToggle(category.id, 'employeeCanUpload', checked)
                          }
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch
                          checked={getValue(category, 'allowsGeneration')}
                          onCheckedChange={(checked) =>
                            handleToggle(category.id, 'allowsGeneration', checked)
                          }
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        {hasChanges(category.id) ? (
                          <Button
                            size="sm"
                            onClick={() => handleSave(category.id)}
                            disabled={updateMutation.isPending}
                            className="min-h-[36px]"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3 w-3 mr-1" />
                                Sauver
                              </>
                            )}
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Help Text */}
            <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
              <p className="font-medium mb-2">💡 Conseils</p>
              <ul className="space-y-1 ml-4">
                <li>• <strong>Téléchargement :</strong> Autorise les utilisateurs à uploader des fichiers pour cette catégorie</li>
                <li>• <strong>Approbation RH :</strong> Les documents nécessitent une validation RH avant d'être visibles</li>
                <li>• <strong>Employé Upload :</strong> Les employés peuvent télécharger leurs propres documents (ex: diplômes)</li>
                <li>• <strong>Génération Auto :</strong> Documents générés automatiquement par le système (ex: bulletins de paie)</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
