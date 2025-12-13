/**
 * Position Detail Page
 *
 * Shows position details with tabs for competencies management
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Plus,
  Award,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Building2,
  ExternalLink,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

// Category labels in French
const CATEGORY_LABELS: Record<string, string> = {
  technique: 'Technique',
  comportemental: 'Comportemental',
  leadership: 'Leadership',
  metier: 'Métier',
};

// Level labels for display
function getLevelLabel(level: number, maxLevel: number): string {
  const percentage = ((level - 1) / (maxLevel - 1)) * 100;
  if (percentage <= 20) return 'Débutant';
  if (percentage <= 40) return 'En cours';
  if (percentage <= 60) return 'Acquis';
  if (percentage <= 80) return 'Maîtrisé';
  return 'Expert';
}

export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const positionId = params.id as string;

  // State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCompetency, setSelectedCompetency] = useState<any>(null);
  const [editData, setEditData] = useState<{
    id: string;
    requiredLevel: number;
    isCritical: boolean;
  } | null>(null);

  // Add form state
  const [addCompetencyId, setAddCompetencyId] = useState<string>('');
  const [addRequiredLevel, setAddRequiredLevel] = useState<number>(3);
  const [addIsCritical, setAddIsCritical] = useState<boolean>(false);

  // Create new competency mode
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newCompetency, setNewCompetency] = useState({
    name: '',
    code: '',
    category: 'technique' as string,
    description: '',
  });

  // Queries
  const { data, isLoading, error, refetch } = trpc.performance.positionCompetencies.list.useQuery({
    positionId,
  });

  const { data: availableCompetencies } = trpc.performance.competencies.list.useQuery({
    isActive: true,
  });

  const utils = trpc.useUtils();

  // Mutations
  const addMutation = trpc.performance.positionCompetencies.add.useMutation({
    onSuccess: () => {
      toast.success('Compétence ajoutée');
      setShowAddDialog(false);
      resetAddForm();
      refetch();
      utils.performance.positionCompetencies.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.performance.positionCompetencies.update.useMutation({
    onSuccess: () => {
      toast.success('Compétence mise à jour');
      setShowEditDialog(false);
      setEditData(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = trpc.performance.positionCompetencies.remove.useMutation({
    onSuccess: () => {
      toast.success('Compétence retirée');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Create competency mutation (creates competency AND assigns it to position)
  const createCompetencyMutation = trpc.performance.competencies.create.useMutation({
    onSuccess: (created) => {
      toast.success('Compétence créée');
      // Now assign it to the position
      addMutation.mutate({
        positionId,
        competencyId: created.id,
        requiredLevel: addRequiredLevel,
        isCritical: addIsCritical,
      });
      // Invalidate competencies list to refresh available options
      utils.performance.competencies.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Default proficiency levels for French scale
  const DEFAULT_PROFICIENCY_LEVELS = [
    { level: 1, name: 'Non acquis', description: 'La compétence n\'est pas encore développée' },
    { level: 2, name: 'En cours', description: 'La compétence est en cours de développement' },
    { level: 3, name: 'Acquis', description: 'La compétence est maîtrisée au niveau attendu' },
    { level: 4, name: 'Maîtrisé', description: 'La compétence dépasse le niveau attendu' },
    { level: 5, name: 'Expert', description: 'Niveau d\'expertise reconnu, peut former les autres' },
  ];

  // Handlers
  const resetAddForm = () => {
    setAddCompetencyId('');
    setAddRequiredLevel(3);
    setAddIsCritical(false);
    setIsCreateMode(false);
    setNewCompetency({ name: '', code: '', category: 'technique', description: '' });
  };

  const handleAdd = () => {
    if (!addCompetencyId) {
      toast.error('Veuillez sélectionner une compétence');
      return;
    }

    addMutation.mutate({
      positionId,
      competencyId: addCompetencyId,
      requiredLevel: addRequiredLevel,
      isCritical: addIsCritical,
    });
  };

  const handleCreateAndAdd = () => {
    if (!newCompetency.name.trim()) {
      toast.error('Le nom de la compétence est requis');
      return;
    }
    if (!newCompetency.code.trim()) {
      toast.error('Le code de la compétence est requis');
      return;
    }

    createCompetencyMutation.mutate({
      name: newCompetency.name.trim(),
      code: newCompetency.code.trim().toUpperCase(),
      category: newCompetency.category,
      description: newCompetency.description.trim() || undefined,
      proficiencyLevels: DEFAULT_PROFICIENCY_LEVELS,
      isCore: false,
      displayOrder: 0,
    });
  };

  const handleEdit = (competency: any) => {
    setEditData({
      id: competency.id,
      requiredLevel: competency.requiredLevel,
      isCritical: competency.isCritical,
    });
    setSelectedCompetency(competency);
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editData) return;

    updateMutation.mutate({
      id: editData.id,
      requiredLevel: editData.requiredLevel,
      isCritical: editData.isCritical,
    });
  };

  const handleRemove = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir retirer cette compétence ?')) {
      removeMutation.mutate({ id });
    }
  };

  // Filter out already assigned competencies
  const unassignedCompetencies = availableCompetencies?.filter(
    (c) => !data?.competencies?.some((pc) => pc.competencyId === c.id)
  );

  // Group competencies by category
  const competenciesByCategory = data?.competencies?.reduce(
    (acc, comp) => {
      const category = comp.category || 'autre';
      if (!acc[category]) acc[category] = [];
      acc[category].push(comp);
      return acc;
    },
    {} as Record<string, typeof data.competencies>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Erreur: {error?.message || 'Poste non trouvé'}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/positions')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux postes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { position, competencies: positionCompetencies } = data;

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-start gap-4">
          <Link href="/positions">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Briefcase className="h-8 w-8" />
              {position.title}
            </h1>
            {position.code && (
              <p className="text-muted-foreground mt-1 font-mono">{position.code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="competencies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="h-4 w-4" />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="competencies" className="gap-2">
            <Award className="h-4 w-4" />
            Compétences
            {positionCompetencies.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {positionCompetencies.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du poste</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Titre</Label>
                <p className="font-medium">{position.title}</p>
              </div>
              {position.code && (
                <div>
                  <Label className="text-muted-foreground">Code</Label>
                  <p className="font-mono">{position.code}</p>
                </div>
              )}
              {position.jobLevel && (
                <div>
                  <Label className="text-muted-foreground">Niveau</Label>
                  <p>{position.jobLevel}</p>
                </div>
              )}
              {position.description && (
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{position.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competencies Tab */}
        <TabsContent value="competencies" className="space-y-6">
          {/* Actions Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Compétences requises</h2>
              <p className="text-muted-foreground text-sm">
                Définissez les compétences requises pour ce poste et leur niveau attendu
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="min-h-[44px]">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une compétence
            </Button>
          </div>

          {/* Empty State */}
          {positionCompetencies.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Award className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune compétence définie</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Ajoutez des compétences pour définir les exigences de ce poste.
                  Ces compétences seront utilisées lors des évaluations de performance.
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="min-h-[56px]">
                  <Plus className="mr-2 h-5 w-5" />
                  Ajouter la première compétence
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Competencies by Category */}
          {competenciesByCategory &&
            Object.entries(competenciesByCategory).map(([category, comps]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Badge variant="outline">
                      {CATEGORY_LABELS[category] || category}
                    </Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      ({comps.length} compétence{comps.length > 1 ? 's' : ''})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comps.map((comp) => {
                    const maxLevel = comp.proficiencyLevels?.length || 5;
                    const levelLabel =
                      comp.proficiencyLevels?.find((l: any) => l.level === comp.requiredLevel)
                        ?.name || getLevelLabel(comp.requiredLevel, maxLevel);

                    return (
                      <div
                        key={comp.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{comp.name}</h4>
                            {comp.isCritical && (
                              <Badge variant="destructive" className="text-xs">
                                Critique
                              </Badge>
                            )}
                            {comp.isCore && (
                              <Badge variant="secondary" className="text-xs">
                                Core
                              </Badge>
                            )}
                          </div>
                          {comp.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {comp.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Niveau requis:</span>
                              <Badge variant="outline">
                                {comp.requiredLevel}/{maxLevel} - {levelLabel}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(comp)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemove(comp.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {/* Add Competency Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter une compétence</DialogTitle>
            <DialogDescription>
              Sélectionnez une compétence et définissez le niveau requis pour ce poste
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle - select existing or create new */}
          {!isCreateMode ? (
            // SELECT MODE
            <div className="space-y-6 py-4">
              {/* Competency Select */}
              <div className="space-y-2">
                <Label>Compétence</Label>
                <Select value={addCompetencyId} onValueChange={setAddCompetencyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une compétence" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedCompetencies?.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        <div className="flex items-center gap-2">
                          <span>{comp.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[comp.category] || comp.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!unassignedCompetencies || unassignedCompetencies.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {!availableCompetencies || availableCompetencies.length === 0
                      ? 'Aucune compétence dans le catalogue.'
                      : 'Toutes les compétences sont déjà assignées.'}
                  </p>
                )}
              </div>

              {/* Create new link */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateMode(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Créer une nouvelle compétence
                </Button>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Required Level - only show if there are competencies to select */}
              {unassignedCompetencies && unassignedCompetencies.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Niveau requis: {addRequiredLevel}</Label>
                    <Slider
                      value={[addRequiredLevel]}
                      onValueChange={([val]) => setAddRequiredLevel(val)}
                      min={1}
                      max={5}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Débutant</span>
                      <span>Expert</span>
                    </div>
                  </div>

                  {/* Critical Flag */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isCritical"
                      checked={addIsCritical}
                      onCheckedChange={(checked) => setAddIsCritical(checked === true)}
                    />
                    <Label htmlFor="isCritical" className="text-sm font-normal cursor-pointer">
                      Compétence critique
                      <span className="block text-xs text-muted-foreground">
                        Marquez comme critique si cette compétence est essentielle au poste
                      </span>
                    </Label>
                  </div>
                </>
              )}
            </div>
          ) : (
            // CREATE MODE
            <div className="space-y-6 py-4">
              {/* Back button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateMode(false)}
                className="text-xs text-muted-foreground -mt-2 -ml-2"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Retour à la sélection
              </Button>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="newCompName">Nom de la compétence *</Label>
                <Input
                  id="newCompName"
                  value={newCompetency.name}
                  onChange={(e) => setNewCompetency({ ...newCompetency, name: e.target.value })}
                  placeholder="Ex: Communication écrite"
                />
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="newCompCode">Code *</Label>
                <Input
                  id="newCompCode"
                  value={newCompetency.code}
                  onChange={(e) => setNewCompetency({ ...newCompetency, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: COMP-COM-001"
                  className="font-mono"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={newCompetency.category}
                  onValueChange={(val) => setNewCompetency({ ...newCompetency, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technique">Technique</SelectItem>
                    <SelectItem value="comportemental">Comportemental</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="metier">Métier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="newCompDesc">Description</Label>
                <Textarea
                  id="newCompDesc"
                  value={newCompetency.description}
                  onChange={(e) => setNewCompetency({ ...newCompetency, description: e.target.value })}
                  placeholder="Description de la compétence..."
                  rows={3}
                />
              </div>

              <div className="h-px bg-border" />

              {/* Required Level */}
              <div className="space-y-2">
                <Label>Niveau requis pour ce poste: {addRequiredLevel}</Label>
                <Slider
                  value={[addRequiredLevel]}
                  onValueChange={([val]) => setAddRequiredLevel(val)}
                  min={1}
                  max={5}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Débutant</span>
                  <span>Expert</span>
                </div>
              </div>

              {/* Critical Flag */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isCriticalCreate"
                  checked={addIsCritical}
                  onCheckedChange={(checked) => setAddIsCritical(checked === true)}
                />
                <Label htmlFor="isCriticalCreate" className="text-sm font-normal cursor-pointer">
                  Compétence critique
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetAddForm(); }}>
              Annuler
            </Button>
            {isCreateMode ? (
              // Create mode: show create button
              <Button
                onClick={handleCreateAndAdd}
                disabled={!newCompetency.name.trim() || !newCompetency.code.trim() || createCompetencyMutation.isPending || addMutation.isPending}
              >
                {(createCompetencyMutation.isPending || addMutation.isPending) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Créer et ajouter
              </Button>
            ) : (
              // Select mode: show add button (if competencies available)
              unassignedCompetencies && unassignedCompetencies.length > 0 && (
                <Button
                  onClick={handleAdd}
                  disabled={!addCompetencyId || addMutation.isPending}
                >
                  {addMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Ajouter
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Competency Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la compétence</DialogTitle>
            <DialogDescription>
              {selectedCompetency?.name}
            </DialogDescription>
          </DialogHeader>

          {editData && (
            <div className="space-y-6 py-4">
              {/* Required Level */}
              <div className="space-y-2">
                <Label>Niveau requis: {editData.requiredLevel}</Label>
                <Slider
                  value={[editData.requiredLevel]}
                  onValueChange={([val]) =>
                    setEditData((prev) => (prev ? { ...prev, requiredLevel: val } : null))
                  }
                  min={1}
                  max={selectedCompetency?.proficiencyLevels?.length || 5}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Débutant</span>
                  <span>Expert</span>
                </div>
              </div>

              {/* Critical Flag */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editIsCritical"
                  checked={editData.isCritical}
                  onCheckedChange={(checked) =>
                    setEditData((prev) =>
                      prev ? { ...prev, isCritical: checked === true } : null
                    )
                  }
                />
                <Label htmlFor="editIsCritical" className="text-sm font-normal cursor-pointer">
                  Compétence critique
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
