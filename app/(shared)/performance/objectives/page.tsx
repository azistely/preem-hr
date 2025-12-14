/**
 * Objectives Management Page
 *
 * Manage individual, team, and company objectives.
 * - View objective hierarchy (company → team → individual)
 * - Create/edit objectives
 * - Track progress
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  Target,
  Building,
  Users,
  User,
  ChevronRight,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// Status badge styling
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  proposed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  proposed: 'Proposé',
  approved: 'Approuvé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const levelLabels: Record<string, string> = {
  company: 'Entreprise',
  team: 'Équipe',
  individual: 'Individuel',
};

const levelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building,
  team: Users,
  individual: User,
};

const typeLabels: Record<string, string> = {
  quantitative: 'Quantitatif',
  qualitative: 'Qualitatif',
  behavioral: 'Comportemental',
  project: 'Projet',
};

// Objective card component
function ObjectiveCard({
  objective,
  onEdit,
  onDelete,
}: {
  objective: {
    id: string;
    title: string;
    description: string | null;
    objectiveLevel: string;
    objectiveType: string;
    status: string;
    weight: string | null;
    targetValue: string | null;
    currentValue: string | null;
    targetUnit: string | null;
    dueDate: string | null;
    employee?: { id: string; firstName: string; lastName: string } | null;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const LevelIcon = levelIcons[objective.objectiveLevel] || Target;

  // Calculate progress percentage
  let progress = 0;
  if (objective.targetValue && objective.currentValue) {
    const target = parseFloat(objective.targetValue);
    const current = parseFloat(objective.currentValue);
    if (target > 0) {
      progress = Math.min(100, Math.round((current / target) * 100));
    }
  }
  if (objective.status === 'completed') {
    progress = 100;
  }

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <LevelIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{objective.title}</h3>
                {objective.weight && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {objective.weight}%
                  </Badge>
                )}
              </div>

              {objective.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {objective.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={statusColors[objective.status]}>
                  {statusLabels[objective.status]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {levelLabels[objective.objectiveLevel]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {typeLabels[objective.objectiveType]}
                </Badge>
              </div>

              {/* Progress bar for quantitative objectives */}
              {objective.targetValue && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progression</span>
                    <span>
                      {objective.currentValue ?? '0'} / {objective.targetValue}
                      {objective.targetUnit && ` ${objective.targetUnit}`}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Employee info for individual objectives */}
              {objective.employee && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>
                    {objective.employee.firstName} {objective.employee.lastName}
                  </span>
                </div>
              )}

              {/* Due date */}
              {objective.dueDate && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Échéance: {format(new Date(objective.dueDate), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ObjectivesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleIdParam = searchParams.get('cycleId');

  const [selectedTab, setSelectedTab] = useState<'all' | 'company' | 'team' | 'individual'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingObjective, setEditingObjective] = useState<string | null>(null);

  // Form state (for edit only)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objectiveLevel: 'individual' as 'company' | 'team' | 'individual',
    objectiveType: 'quantitative' as 'quantitative' | 'qualitative' | 'behavioral' | 'project',
    weight: '',
    targetValue: '',
    targetUnit: '',
    dueDate: '',
  });

  const utils = api.useUtils();

  // Fetch cycles for filter (include planning, objective_setting, and active cycles)
  const { data: cyclesData } = api.performance.cycles.list.useQuery({
    limit: 50,
  });

  // Get guide status to auto-select active cycle
  const { data: guideStatus } = api.performance.getGuideStatus.useQuery();

  // Determine effective cycle ID - use URL param, or auto-select from guide status
  const effectiveCycleId = cycleIdParam || guideStatus?.activeCycle?.id || null;

  // Fetch objectives
  const { data: objectivesData, isLoading } = api.performance.objectives.list.useQuery({
    cycleId: effectiveCycleId || undefined,
    objectiveLevel: selectedTab !== 'all' ? selectedTab : undefined,
    status: statusFilter !== 'all'
      ? statusFilter as 'draft' | 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
      : undefined,
    limit: 100,
  });

  // Update mutation
  const updateObjective = api.performance.objectives.update.useMutation({
    onSuccess: () => {
      toast.success('Objectif mis à jour');
      setEditingObjective(null);
      resetForm();
      utils.performance.objectives.list.invalidate();
      // Invalidate sidebar to update objectives progress
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  // Delete mutation
  const deleteObjective = api.performance.objectives.delete.useMutation({
    onSuccess: () => {
      toast.success('Objectif supprimé');
      utils.performance.objectives.list.invalidate();
      // Invalidate sidebar to update objectives progress
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  // Filter cycles to only show non-closed ones for objective creation
  const cycles = (cyclesData?.data ?? []).filter(
    (c) => c.status !== 'closed' && c.status !== 'calibration'
  );
  const objectives = objectivesData?.data ?? [];

  // Stats
  const totalObjectives = objectives.length;
  const completedCount = objectives.filter((o) => o.status === 'completed').length;
  const inProgressCount = objectives.filter((o) => o.status === 'in_progress').length;

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      objectiveLevel: 'individual',
      objectiveType: 'quantitative',
      weight: '',
      targetValue: '',
      targetUnit: '',
      dueDate: '',
    });
  };

  const handleEdit = (objective: typeof objectives[0]) => {
    setFormData({
      title: objective.title,
      description: objective.description || '',
      objectiveLevel: objective.objectiveLevel as 'company' | 'team' | 'individual',
      objectiveType: objective.objectiveType as 'quantitative' | 'qualitative' | 'behavioral' | 'project',
      weight: objective.weight || '',
      targetValue: objective.targetValue || '',
      targetUnit: objective.targetUnit || '',
      dueDate: objective.dueDate || '',
    });
    setEditingObjective(objective.id);
  };

  const handleUpdate = () => {
    if (!editingObjective) return;

    updateObjective.mutate({
      id: editingObjective,
      title: formData.title,
      description: formData.description || undefined,
      weight: formData.weight || undefined,
      targetValue: formData.targetValue || undefined,
      targetUnit: formData.targetUnit || undefined,
      dueDate: formData.dueDate || undefined,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet objectif?')) {
      deleteObjective.mutate({ id });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Objectifs</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les objectifs de performance
          </p>
        </div>
        <Button asChild className="min-h-[48px]">
          <Link href={effectiveCycleId ? `/performance/objectives/new?cycleId=${effectiveCycleId}` : '/performance/objectives/new'}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel objectif
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total objectifs</p>
                <p className="text-2xl font-bold">{totalObjectives}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terminés</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {cycles.length > 0 && (
              <Select
                value={effectiveCycleId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    router.push('/performance/objectives');
                  } else {
                    router.push(`/performance/objectives?cycleId=${value}`);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[300px] min-h-[48px]">
                  <SelectValue placeholder="Sélectionner un cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous les cycles</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name} {cycle.status === 'active' && '(Actif)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="proposed">Proposé</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="min-h-[44px]">
            <Target className="mr-2 h-4 w-4" />
            Tous
          </TabsTrigger>
          <TabsTrigger value="company" className="min-h-[44px]">
            <Building className="mr-2 h-4 w-4" />
            Entreprise
          </TabsTrigger>
          <TabsTrigger value="team" className="min-h-[44px]">
            <Users className="mr-2 h-4 w-4" />
            Équipe
          </TabsTrigger>
          <TabsTrigger value="individual" className="min-h-[44px]">
            <User className="mr-2 h-4 w-4" />
            Individuel
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun objectif</h3>
                <p className="text-muted-foreground mb-6">
                  {!effectiveCycleId
                    ? 'Aucun cycle actif. Créez un cycle de performance pour commencer.'
                    : 'Créez votre premier objectif pour commencer'}
                </p>
                <Button asChild>
                  <Link href={effectiveCycleId ? `/performance/objectives/new?cycleId=${effectiveCycleId}` : '/performance/objectives/new'}>
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un objectif
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {objectives.map((objective) => (
                <ObjectiveCard
                  key={objective.id}
                  objective={objective}
                  onEdit={() => handleEdit(objective)}
                  onDelete={() => handleDelete(objective.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingObjective}
        onOpenChange={(open) => {
          if (!open) {
            setEditingObjective(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l'objectif</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'objectif
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Ex: Augmenter le chiffre d'affaires"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="min-h-[48px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Décrivez l'objectif en détail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Select
                  value={formData.objectiveLevel}
                  onValueChange={(v) =>
                    setFormData({ ...formData, objectiveLevel: v as typeof formData.objectiveLevel })
                  }
                  disabled={!!editingObjective}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Entreprise</SelectItem>
                    <SelectItem value="team">Équipe</SelectItem>
                    <SelectItem value="individual">Individuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.objectiveType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, objectiveType: v as typeof formData.objectiveType })
                  }
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitative">Quantitatif</SelectItem>
                    <SelectItem value="qualitative">Qualitatif</SelectItem>
                    <SelectItem value="behavioral">Comportemental</SelectItem>
                    <SelectItem value="project">Projet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight">Poids (%)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="25"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetValue">Cible</Label>
                <Input
                  id="targetValue"
                  type="number"
                  placeholder="100"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetUnit">Unité</Label>
                <Input
                  id="targetUnit"
                  placeholder="MFCFA"
                  value={formData.targetUnit}
                  onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Date d'échéance</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="min-h-[48px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingObjective(null);
                resetForm();
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.title || updateObjective.isPending}
              className="min-h-[48px]"
            >
              {updateObjective.isPending ? 'Enregistrement...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
