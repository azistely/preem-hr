'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileSpreadsheet,
  Download,
  Upload,
  FileDown,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Table as TableIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeavePlanningInlineTable } from './leave-planning-inline-table';

type PlanningMode = 'inline' | 'excel';

export function LeavePlanningPanel() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [mode, setMode] = useState<PlanningMode>('inline');

  // Fetch periods
  const { data: periods, refetch: refetchPeriods } = api.leavePlanning.listPeriods.useQuery();

  // Fetch stats for selected period
  const { data: periodStats } = api.leavePlanning.getPeriodStats.useQuery(
    { periodId: selectedPeriodId },
    { enabled: !!selectedPeriodId }
  );

  // Mutations
  const createPeriodMutation = api.leavePlanning.createPeriod.useMutation({
    onSuccess: () => {
      toast.success('Période créée');
      setShowCreateDialog(false);
      refetchPeriods();
    },
  });

  const downloadTemplateMutation = api.leavePlanning.downloadTemplate.useMutation({
    onSuccess: (data: { base64: string; filename: string }) => {
      // Trigger download
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.filename;
      link.click();
      toast.success('Template téléchargé');
    },
  });

  const importMutation = api.leavePlanning.importPlan.useMutation({
    onSuccess: (result) => {
      // Main success message
      if (result.success > 0) {
        toast.success(`✅ ${result.success} demande(s) importée(s) avec succès`);
      } else {
        toast.error('❌ Aucune demande importée');
      }

      // Show errors if any
      if (result.errors.length > 0) {
        toast.error(`🚨 ${result.errors.length} erreur(s) détectée(s)`, {
          description: result.errors.slice(0, 3).map(e =>
            `Ligne ${e.row}: ${e.employeeNumber} - ${e.error}`
          ).join('\n'),
          duration: 10000,
        });
      }

      // Show conflicts if any
      if (result.conflicts.length > 0) {
        toast.warning(`⚠️ ${result.conflicts.length} conflit(s) détecté(s)`, {
          description: result.conflicts.slice(0, 3).map(c =>
            `Ligne ${c.row}: ${c.employeeNumber} - ${c.message}`
          ).join('\n'),
          duration: 10000,
        });
      }

      // Summary
      toast.info(`📊 Traité: ${result.totalProcessed} ligne(s) | Succès: ${result.success} | Erreurs: ${result.errors.length} | Conflits: ${result.conflicts.length}`);
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'import', {
        description: error.message,
      });
    },
  });

  const exportMutation = api.leavePlanning.exportPlan.useMutation({
    onSuccess: (data: { base64: string; filename: string }) => {
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.filename;
      link.click();
      toast.success('Export téléchargé');
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show immediate feedback
    toast.info('📤 Import en cours...', {
      description: `Lecture du fichier ${file.name}`,
    });

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        await importMutation.mutateAsync({
          fileData: base64.split(',')[1], // Remove data:... prefix
          periodId: selectedPeriodId,
        });
      } catch (error) {
        // Error already handled by onError callback
        console.error('Import error:', error);
      }
    };
    reader.readAsDataURL(file);

    // Reset file input to allow re-uploading the same file
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header avec sélection période */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Planification des Congés Annuels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Période selector */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label>Période de planification</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods?.map((period: { id: string; name: string; year: number }) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name} ({period.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bouton créer période */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-6 min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle période
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer une période de planification</DialogTitle>
                </DialogHeader>
                <CreatePeriodForm
                  onSubmit={(data: { name: string; year: number; quarter: number | null }) => createPeriodMutation.mutate(data)}
                  isLoading={createPeriodMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      {selectedPeriodId && periodStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{periodStats.totalRequests}</p>
                  <p className="text-sm text-muted-foreground">Congés planifiés</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{periodStats.pendingRequests}</p>
                  <p className="text-sm text-muted-foreground">En attente d'approbation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{periodStats.approvedRequests}</p>
                  <p className="text-sm text-muted-foreground">Approuvés</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{periodStats.conflictsCount}</p>
                  <p className="text-sm text-muted-foreground">Conflits détectés</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mode Selector avec Tabs */}
      {selectedPeriodId && (
        <Tabs value={mode} onValueChange={(value) => setMode(value as PlanningMode)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 min-h-[44px]">
            <TabsTrigger value="inline" className="min-h-[40px]">
              <TableIcon className="mr-2 h-4 w-4" />
              Édition en ligne
            </TabsTrigger>
            <TabsTrigger value="excel" className="min-h-[40px]">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import/Export Excel
            </TabsTrigger>
          </TabsList>

          {/* Inline editing mode */}
          <TabsContent value="inline" className="mt-6">
            <LeavePlanningInlineTable periodId={selectedPeriodId} />
          </TabsContent>

          {/* Excel mode */}
          <TabsContent value="excel" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Import et Export Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Utilisez cette option pour travailler hors ligne ou pour effectuer des modifications en masse dans Excel.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadTemplateMutation.mutate({ periodId: selectedPeriodId })}
                    disabled={downloadTemplateMutation.isPending}
                    className="min-h-[44px]"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger le template Excel
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={importMutation.isPending}
                    className="min-h-[44px]"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Importer le plan
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate({ periodId: selectedPeriodId })}
                    disabled={exportMutation.isPending}
                    className="min-h-[44px]"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Exporter vers Excel
                  </Button>
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">Comment ça marche ?</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Téléchargez le template Excel pré-rempli avec vos employés</li>
                    <li>Remplissez les dates de congé et les notes dans Excel</li>
                    <li>Importez le fichier pour créer toutes les demandes en une seule fois</li>
                    <li>Exportez à tout moment pour avoir une copie de sauvegarde</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Formulaire création période
function CreatePeriodForm({
  onSubmit,
  isLoading
}: {
  onSubmit: (data: { name: string; year: number; quarter: number | null }) => void;
  isLoading: boolean
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [quarter, setQuarter] = useState<number | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, year, quarter });
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nom</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Q1 2026"
          required
        />
      </div>
      <div>
        <Label>Année</Label>
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          min={new Date().getFullYear()}
          required
        />
      </div>
      <div>
        <Label>Trimestre (optionnel)</Label>
        <Select
          value={quarter?.toString() || 'null'}
          onValueChange={(v) => setQuarter(v === 'null' ? null : parseInt(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">Année complète</SelectItem>
            <SelectItem value="1">Q1</SelectItem>
            <SelectItem value="2">Q2</SelectItem>
            <SelectItem value="3">Q3</SelectItem>
            <SelectItem value="4">Q4</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        Créer
      </Button>
    </form>
  );
}
