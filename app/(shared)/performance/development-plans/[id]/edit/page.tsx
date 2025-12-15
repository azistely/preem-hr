/**
 * Edit Development Plan Page
 *
 * Allows editing development plan details, goals, and training recommendations.
 * Only available for plans in 'draft' status.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/server/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { useToast } from '@/hooks/use-toast';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  Save,
  Target,
  Plus,
  Trash2,
  AlertCircle,
  User,
  FileText,
} from 'lucide-react';
import type { DevelopmentGoal } from '@/lib/db/schema/performance';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_CONFIG = {
  high: { label: 'Haute', color: 'bg-red-100 text-red-800' },
  medium: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Basse', color: 'bg-green-100 text-green-800' },
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface NewGoalForm {
  description: string;
  targetDate: Date | null;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function EditDevelopmentPlanPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const planId = params.id as string;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: null as Date | null,
    targetEndDate: null as Date | null,
    managerNotes: '',
  });

  // Dialog states
  const [addGoalDialogOpen, setAddGoalDialogOpen] = useState(false);
  const [deleteGoalDialogOpen, setDeleteGoalDialogOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState<NewGoalForm>({
    description: '',
    targetDate: addMonths(new Date(), 3),
    priority: 'medium',
  });

  // Data fetching
  const { data: plan, isLoading, error, refetch } = api.developmentPlans.getById.useQuery(
    { planId },
    { enabled: !!planId }
  );

  // Populate form when data loads
  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title,
        description: plan.description ?? '',
        startDate: plan.startDate ? new Date(plan.startDate) : null,
        targetEndDate: plan.targetEndDate ? new Date(plan.targetEndDate) : null,
        managerNotes: plan.managerNotes ?? '',
      });
    }
  }, [plan]);

  // Mutations
  const utils = api.useUtils();

  const updateMutation = api.developmentPlans.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Plan mis à jour',
        description: 'Les modifications ont été enregistrées.',
      });
      utils.developmentPlans.getById.invalidate({ planId });
      utils.developmentPlans.list.invalidate();
      router.push(`/performance/development-plans/${planId}`);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addGoalMutation = api.developmentPlans.addGoal.useMutation({
    onSuccess: () => {
      toast({
        title: 'Objectif ajouté',
        description: 'L\'objectif a été ajouté au plan.',
      });
      refetch();
      setAddGoalDialogOpen(false);
      setNewGoal({
        description: '',
        targetDate: addMonths(new Date(), 3),
        priority: 'medium',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteGoalMutation = api.developmentPlans.deleteGoal.useMutation({
    onSuccess: () => {
      toast({
        title: 'Objectif supprimé',
        description: 'L\'objectif a été retiré du plan.',
      });
      refetch();
      setDeleteGoalDialogOpen(false);
      setGoalToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMutation.mutate({
      planId,
      title: formData.title,
      description: formData.description || undefined,
      startDate: formData.startDate ?? undefined,
      targetEndDate: formData.targetEndDate ?? undefined,
      managerNotes: formData.managerNotes || undefined,
    });
  };

  const handleAddGoal = () => {
    if (!newGoal.description.trim() || !newGoal.targetDate) return;

    addGoalMutation.mutate({
      planId,
      goal: {
        description: newGoal.description.trim(),
        targetDate: format(newGoal.targetDate, 'yyyy-MM-dd'),
        status: 'pending',
        progress: 0,
      },
    });
  };

  const confirmDeleteGoal = (goalId: string) => {
    setGoalToDelete(goalId);
    setDeleteGoalDialogOpen(true);
  };

  const handleDeleteGoal = () => {
    if (!goalToDelete) return;
    deleteGoalMutation.mutate({ planId, goalId: goalToDelete });
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !plan) {
    return (
      <div className="container max-w-3xl mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message ?? 'Plan de développement introuvable'}
          </AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4 min-h-[44px]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  // Cannot edit non-draft plans
  const isLocked = plan.status !== 'draft';
  const goals = (plan.goals ?? []) as DevelopmentGoal[];

  if (isLocked) {
    return (
      <div className="container max-w-3xl mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Modifier le plan</h1>
            <p className="text-muted-foreground">{plan.title}</p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ce plan est <strong>{plan.status === 'active' ? 'en cours' : plan.status}</strong> et ne peut plus être modifié.
            Seuls les plans en brouillon peuvent être édités.
          </AlertDescription>
        </Alert>

        <Button
          variant="outline"
          onClick={() => router.push(`/performance/development-plans/${planId}`)}
          className="min-h-[44px]"
        >
          Voir les détails du plan
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Modifier le plan</h1>
          <p className="text-muted-foreground">
            {plan.employee?.lastName} {plan.employee?.firstName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informations générales
            </CardTitle>
            <CardDescription>Titre et description du plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Employee Info (read-only) */}
            <div className="p-4 bg-muted rounded-lg flex items-center gap-4">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {plan.employee?.lastName} {plan.employee?.firstName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.employee?.employeeNumber}
                  {plan.employee?.jobTitle && ` • ${plan.employee.jobTitle}`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titre du plan *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                placeholder="Ex: Plan de développement 2025"
                className="min-h-[48px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Description des objectifs généraux du plan..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Période
            </CardTitle>
            <CardDescription>Dates de début et de fin cible</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate
                        ? format(formData.startDate, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate ?? undefined}
                      onSelect={(date) => updateFormData({ startDate: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Target End Date */}
              <div className="space-y-2">
                <Label>Date de fin cible</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.targetEndDate
                        ? format(formData.targetEndDate, 'dd MMM yyyy', { locale: fr })
                        : 'Non définie'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.targetEndDate ?? undefined}
                      onSelect={(date) => updateFormData({ targetEndDate: date ?? null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Objectifs de développement
                </CardTitle>
                <CardDescription>
                  Actions et objectifs à atteindre ({goals.length} objectif{goals.length !== 1 ? 's' : ''})
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => setAddGoalDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                <Target className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">Aucun objectif défini</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddGoalDialogOpen(true)}
                  className="min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un premier objectif
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <div
                    key={goal.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-muted-foreground">
                          Objectif {index + 1}
                        </span>
                      </div>
                      <p className="text-sm">{goal.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          Échéance: {format(new Date(goal.targetDate), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirmDeleteGoal(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manager Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes du manager</CardTitle>
            <CardDescription>
              Commentaires et recommandations pour l'employé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.managerNotes}
              onChange={(e) => updateFormData({ managerNotes: e.target.value })}
              placeholder="Notes privées ou recommandations..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending || !formData.title.trim()}
            className="min-h-[56px] px-8"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Add Goal Dialog */}
      <Dialog open={addGoalDialogOpen} onOpenChange={setAddGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un objectif</DialogTitle>
            <DialogDescription>
              Définissez un nouvel objectif de développement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal-description">Description *</Label>
              <Textarea
                id="goal-description"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Décrivez l'objectif à atteindre..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Date cible</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full min-h-[48px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newGoal.targetDate
                      ? format(newGoal.targetDate, 'dd MMM yyyy', { locale: fr })
                      : 'Choisir une date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newGoal.targetDate ?? undefined}
                    onSelect={(date) => setNewGoal({ ...newGoal, targetDate: date ?? null })}
                    locale={fr}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddGoalDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddGoal}
              disabled={addGoalMutation.isPending || !newGoal.description.trim() || !newGoal.targetDate}
              className="min-h-[44px]"
            >
              {addGoalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Goal Confirmation */}
      <Dialog open={deleteGoalDialogOpen} onOpenChange={setDeleteGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'objectif</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cet objectif ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteGoalDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGoal}
              disabled={deleteGoalMutation.isPending}
              className="min-h-[44px]"
            >
              {deleteGoalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
