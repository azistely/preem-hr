/**
 * Compliance Action Items List Page
 *
 * List all action items across all trackers with filtering and bulk actions.
 * Features:
 * - Filters: Status, Priority, Assignee, Due date, Tracker type
 * - Table with: Title, Tracker, Status, Priority, Assignee, Due date, Actions
 * - Quick actions: View tracker, Mark complete, Change status
 * - Bulk actions: Mark complete, Change status
 * - Overdue highlighting
 *
 * HR Manager + Admin only access
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  X,
  MoreVertical,
  ExternalLink,
  Play,
  Check,
  Ban,
  FileText,
  Users,
  Calendar,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, addDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

// Map priority to badge variant
const priorityVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
  critical: 'destructive',
};

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

// Map status to colors
const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export default function ComplianceActionsPage() {
  // Filters state
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [actionToComplete, setActionToComplete] = useState<string | null>(null);

  // Build query filters based on tab and filters
  const getQueryFilters = () => {
    const filters: {
      status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      priority?: 'low' | 'medium' | 'high' | 'critical';
      overdueOnly?: boolean;
      limit: number;
    } = { limit: 50 };

    if (activeTab === 'pending') {
      filters.status = 'pending';
    } else if (activeTab === 'overdue') {
      filters.overdueOnly = true;
    } else if (activeTab === 'completed') {
      filters.status = 'completed';
    }

    if (statusFilter !== 'all' && activeTab === 'all') {
      filters.status = statusFilter as ActionStatus;
    }

    if (priorityFilter !== 'all') {
      filters.priority = priorityFilter as 'low' | 'medium' | 'high' | 'critical';
    }

    return filters;
  };

  // Fetch action items
  const { data: actions, isLoading, refetch } = api.complianceActionItems.list.useQuery(getQueryFilters());

  // Fetch tracker types for filter
  const { data: trackerTypes } = api.complianceTrackerTypes.list.useQuery();

  // Mutations
  const updateStatusMutation = api.complianceActionItems.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Statut mis à jour');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markCompleteMutation = api.complianceActionItems.markComplete.useMutation({
    onSuccess: () => {
      refetch();
      setCompleteDialogOpen(false);
      setActionToComplete(null);
      toast.success('Action marquée comme terminée');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const bulkUpdateMutation = api.complianceActionItems.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      refetch();
      setSelectedIds([]);
      toast.success(`${data.updated} action(s) mise(s) à jour`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === actions?.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(actions?.data.map((a) => a.id) || []);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setActiveTab('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all';

  // Get due date status
  const getDueDateStatus = (dueDate: string | null | undefined) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    if (isBefore(date, addDays(new Date(), 3))) return 'soon';
    return 'ok';
  };

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/compliance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Conformité
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Actions</h1>
          </div>
        </div>

        <p className="text-muted-foreground">
          Toutes les actions des dossiers de conformité
        </p>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Toutes
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Clock className="h-4 w-4" />
            En attente
          </TabsTrigger>
          <TabsTrigger
            value="overdue"
            className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            En retard
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Check className="h-4 w-4" />
            Terminées
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-[48px] ${hasActiveFilters ? 'border-primary' : ''}`}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {[statusFilter !== 'all', priorityFilter !== 'all'].filter(Boolean).length}
                </Badge>
              )}
            </Button>

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} sélectionné(s)
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Actions groupées
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, status: 'in_progress' })}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Démarrer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, status: 'completed' })}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Terminer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, status: 'cancelled' })}
                      className="text-destructive"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Annuler
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-col md:flex-row gap-4 mt-4 pt-4 border-t">
              {activeTab === 'all' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] min-h-[48px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-[180px] min-h-[48px]">
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="min-h-[48px]">
                  <X className="mr-2 h-4 w-4" />
                  Effacer
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {isLoading ? (
                <Skeleton className="h-6 w-32 inline-block" />
              ) : (
                `${actions?.total ?? 0} action${(actions?.total ?? 0) > 1 ? 's' : ''}`
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : actions?.data && actions.data.length > 0 ? (
            <div className="space-y-3">
              {/* Select all */}
              <div className="flex items-center gap-3 pb-3 border-b">
                <Checkbox
                  checked={selectedIds.length === actions.data.length && actions.data.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Tout sélectionner
                </span>
              </div>

              {actions.data.map((action) => {
                const dueDateStatus = getDueDateStatus(action.dueDate);
                const isOverdue = dueDateStatus === 'overdue' && action.status !== 'completed' && action.status !== 'cancelled';

                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                      isOverdue ? 'border-destructive bg-destructive/5' : 'hover:bg-accent'
                    }`}
                  >
                    {/* Checkbox */}
                    {action.status !== 'completed' && action.status !== 'cancelled' && (
                      <Checkbox
                        checked={selectedIds.includes(action.id)}
                        onCheckedChange={() => toggleSelection(action.id)}
                        className="mt-1"
                      />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                statusColors[action.status] || 'bg-gray-100'
                              }`}
                            >
                              {statusLabels[action.status] || action.status}
                            </span>
                            <Badge variant={priorityVariants[action.priority] || 'default'}>
                              {priorityLabels[action.priority] || action.priority}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                En retard
                              </Badge>
                            )}
                          </div>

                          <p className="font-medium">{action.title}</p>

                          {action.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {action.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                            {action.tracker && (
                              <Link
                                href={`/compliance/trackers/${action.tracker.id}`}
                                className="flex items-center gap-1 hover:text-foreground"
                              >
                                <FileText className="h-3 w-3" />
                                {action.tracker.referenceNumber}
                              </Link>
                            )}
                            {action.assignee && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {action.assignee.firstName} {action.assignee.lastName}
                              </span>
                            )}
                            {action.dueDate && (
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue
                                    ? 'text-destructive font-medium'
                                    : dueDateStatus === 'today'
                                    ? 'text-amber-600 font-medium'
                                    : dueDateStatus === 'soon'
                                    ? 'text-amber-600'
                                    : ''
                                }`}
                              >
                                <Calendar className="h-3 w-3" />
                                {isOverdue
                                  ? `En retard de ${formatDistanceToNow(new Date(action.dueDate), { locale: fr })}`
                                  : dueDateStatus === 'today'
                                  ? "Aujourd'hui"
                                  : format(new Date(action.dueDate), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {action.tracker && (
                              <DropdownMenuItem asChild>
                                <Link href={`/compliance/trackers/${action.tracker.id}`}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Voir le dossier
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {action.status === 'pending' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: action.id, status: 'in_progress' })
                                }
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Démarrer
                              </DropdownMenuItem>
                            )}
                            {(action.status === 'pending' || action.status === 'in_progress') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setActionToComplete(action.id);
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Marquer terminé
                              </DropdownMenuItem>
                            )}
                            {action.status !== 'completed' && action.status !== 'cancelled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatusMutation.mutate({ id: action.id, status: 'cancelled' })
                                  }
                                  className="text-destructive"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Annuler
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                {activeTab === 'overdue'
                  ? 'Aucune action en retard'
                  : activeTab === 'pending'
                  ? 'Aucune action en attente'
                  : activeTab === 'completed'
                  ? 'Aucune action terminée'
                  : 'Aucune action'}
              </p>
              <Link href="/compliance/trackers">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Voir les dossiers
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {actions?.hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" disabled>
            Afficher plus
          </Button>
        </div>
      )}

      {/* Complete Action Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme terminé</DialogTitle>
            <DialogDescription>
              Confirmez que cette action est terminée. Vous pouvez optionnellement joindre un
              document de preuve.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              L'upload de document de preuve sera disponible prochainement.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (actionToComplete) {
                  markCompleteMutation.mutate({ id: actionToComplete });
                }
              }}
              disabled={markCompleteMutation.isPending}
            >
              {markCompleteMutation.isPending ? 'En cours...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
