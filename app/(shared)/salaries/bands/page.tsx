/**
 * Salary Bands Management Page
 *
 * Manage salary bands for different positions/levels
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { CreateSalaryBandModal } from '@/features/employees/components/salary-bands/create-salary-band-modal';
import { EditSalaryBandModal } from '@/features/employees/components/salary-bands/edit-salary-band-modal';
import { useToast } from '@/hooks/use-toast';

export default function SalaryBandsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBand, setEditingBand] = useState<any>(null);
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: bands, isLoading } = trpc.salaryBands.list.useQuery();
  const deleteBand = trpc.salaryBands.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Bande supprimée',
        description: 'La bande salariale a été supprimée avec succès',
      });
      // Invalidate cache to refresh the list
      utils.salaryBands.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette bande salariale ?')) {
      await deleteBand.mutateAsync({ id });
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8" />
            Bandes salariales
          </h1>
          <p className="text-muted-foreground mt-2">
            Définissez des fourchettes salariales par niveau et catégorie
          </p>
        </div>

        <Button
          className="min-h-[56px]"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="mr-2 h-5 w-5" />
          Créer une bande
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Salary Bands Table */}
      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Toutes les bandes</CardTitle>
          </CardHeader>
          <CardContent>
            {!bands || bands.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune bande créée</h3>
                <p className="text-muted-foreground mb-6">
                  Créez votre première bande salariale pour structurer vos rémunérations
                </p>
                <Button
                  className="min-h-[56px]"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Créer une bande
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Fourchette salariale</TableHead>
                      <TableHead>Milieu de bande</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bands.map((band: any) => {
                      const midpoint = (band.minSalary + band.maxSalary) / 2;
                      const spread = ((band.maxSalary - band.minSalary) / midpoint) * 100;

                      return (
                        <TableRow key={band.id}>
                          <TableCell className="font-medium">{band.name}</TableCell>
                          <TableCell>{band.jobLevel || '-'}</TableCell>
                          <TableCell>{band.category || '-'}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm font-mono">
                                {formatCurrency(band.minSalary)} - {formatCurrency(band.maxSalary)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Écart: {spread.toFixed(0)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(midpoint)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingBand(band)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(band.id)}
                                disabled={deleteBand.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateSalaryBandModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingBand && (
        <EditSalaryBandModal
          band={editingBand}
          open={!!editingBand}
          onClose={() => setEditingBand(null)}
        />
      )}
    </div>
  );
}
