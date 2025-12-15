'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/server/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  Target,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: FileText },
  active: { label: 'En cours', color: 'bg-blue-100 text-blue-800', icon: Target },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-500', icon: Archive },
} as const;

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function DevelopmentPlansPage() {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Dialog states
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [planToArchive, setPlanToArchive] = useState<string | null>(null);

  // Data fetching
  const { data: plansData, isLoading, refetch } = api.developmentPlans.list.useQuery({
    status: statusFilter !== 'all' ? statusFilter as 'draft' | 'active' | 'completed' | 'cancelled' | 'archived' : undefined,
    search: search || undefined,
    limit,
    offset: page * limit,
    orderBy: 'updatedAt',
    orderDir: 'desc',
  });

  const { data: summary } = api.developmentPlans.getSummary.useQuery();

  // Mutations
  const archiveMutation = api.developmentPlans.archive.useMutation({
    onSuccess: () => {
      refetch();
      setArchiveDialogOpen(false);
      setPlanToArchive(null);
    },
  });

  // Computed
  type PlanItem = NonNullable<typeof plansData>['items'][number];
  const plans: PlanItem[] = plansData?.items ?? [];
  const total = plansData?.total ?? 0;
  const hasMore = plansData?.hasMore ?? false;

  // Handlers
  const handleViewPlan = (planId: string) => {
    router.push(`/performance/development-plans/${planId}`);
  };

  const handleEditPlan = (planId: string) => {
    router.push(`/performance/development-plans/${planId}/edit`);
  };

  const handleArchive = async () => {
    if (!planToArchive) return;
    await archiveMutation.mutateAsync({ planId: planToArchive });
  };

  const confirmArchive = (planId: string) => {
    setPlanToArchive(planId);
    setArchiveDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plans de Développement Individuel</h1>
          <p className="text-muted-foreground">
            Gérez les plans de développement de vos collaborateurs
          </p>
        </div>
        <Button
          onClick={() => router.push('/performance/development-plans/new')}
          className="min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Plan
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-muted-foreground">Brouillons</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.draft}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">En cours</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Terminés</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Progression moy.</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.averageProgress}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Total actif</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par employé ou titre..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10 min-h-[44px]"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="active">En cours</SelectItem>
                <SelectItem value="completed">Terminés</SelectItem>
                <SelectItem value="cancelled">Annulés</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Chargement...</span>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Aucun plan trouvé</p>
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== 'all'
                  ? 'Essayez de modifier vos filtres'
                  : 'Créez votre premier plan de développement'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead>Objectifs</TableHead>
                  <TableHead>Date cible</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const config = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG];
                  const Icon = config?.icon ?? FileText;

                  return (
                    <TableRow
                      key={plan.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewPlan(plan.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {plan.employeeLastName} {plan.employeeFirstName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {plan.employeeNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium line-clamp-1">{plan.title}</p>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {plan.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={config?.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config?.label ?? plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {plan.progressPercentage ?? 0}%
                            </span>
                          </div>
                          <Progress value={plan.progressPercentage ?? 0} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{plan.completedGoals ?? 0}</span>
                          <span className="text-muted-foreground">
                            /{plan.totalGoals ?? 0} terminés
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {plan.targetEndDate ? (
                          <span className="text-sm">
                            {format(new Date(plan.targetEndDate), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Non définie</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleViewPlan(plan.id);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir les détails
                            </DropdownMenuItem>
                            {plan.status === 'draft' && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEditPlan(plan.id);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                            )}
                            {plan.status !== 'archived' && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmArchive(plan.id);
                                }}
                                className="text-destructive"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archiver
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage de {page * limit + 1} à {Math.min((page + 1) * limit, total)} sur {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="min-h-[44px]"
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="min-h-[44px]"
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archiver le plan</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir archiver ce plan de développement ?
              Cette action peut être annulée par un administrateur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="min-h-[44px]"
            >
              {archiveMutation.isPending ? 'Archivage...' : 'Archiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
