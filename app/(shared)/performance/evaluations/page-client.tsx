/**
 * Evaluations List Page
 *
 * Shows evaluations assigned to the current user or all evaluations for HR.
 * Employees see evaluations they need to complete or evaluations about them.
 * HR can see all evaluations and filter by cycle, status, type, contract type, ad-hoc.
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CardListSkeleton } from '@/components/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  Users,
  UserCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Plus,
  FileText,
  Briefcase,
} from 'lucide-react';
import { EmployeePicker } from '@/components/hr-modules/forms/fields/employee-picker';

// Status badge styling
const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  validated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  shared: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  shared: 'Partagé',
};

const typeLabels: Record<string, string> = {
  self: 'Auto-évaluation',
  manager: 'Évaluation manager',
  peer: 'Évaluation pair',
  '360_report': 'Rapport 360°',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  self: UserCheck,
  manager: Users,
  peer: Users,
  '360_report': ClipboardCheck,
};

// Contract type labels
const contractTypeLabels: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  CDDTI: 'CDDTI',
  INTERIM: 'Intérim',
  STAGE: 'Stage',
};

// Ad-hoc type labels
const adHocTypeLabels: Record<string, string> = {
  probation: 'Fin de période d\'essai',
  cdd_renewal: 'Renouvellement CDD',
  cddti_check: 'Évaluation CDDTI',
  other: 'Autre',
};

export default function EvaluationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleIdParam = searchParams.get('cycleId');
  const typeParam = searchParams.get('type'); // Support ?type=self or ?type=manager from guide

  // Map URL type param to tab
  const getInitialTab = () => {
    if (typeParam === 'self') return 'self';
    if (typeParam === 'manager') return 'manager';
    return 'my';
  };

  const [selectedTab, setSelectedTab] = useState(getInitialTab);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all', 'cycle', 'adhoc'
  const [adHocTypeFilter, setAdHocTypeFilter] = useState<string>('all');

  // Ad-hoc evaluation dialog state
  const [adHocDialogOpen, setAdHocDialogOpen] = useState(false);
  const [adHocEmployeeId, setAdHocEmployeeId] = useState<string>('');
  const [adHocType, setAdHocType] = useState<'probation' | 'cdd_renewal' | 'cddti_check' | 'other'>('probation');
  const [adHocNotes, setAdHocNotes] = useState('');

  // Fetch evaluations to complete (my pending tasks)
  const { data: myEvaluationsData, isLoading: myEvaluationsLoading } =
    api.performance.evaluations.list.useQuery({
      myEvaluations: true,
      cycleId: cycleIdParam || undefined,
      limit: 50,
    });

  // Fetch self-evaluations (for type-filtered tab)
  const { data: selfEvaluationsData, isLoading: selfEvaluationsLoading } =
    api.performance.evaluations.list.useQuery({
      cycleId: cycleIdParam || undefined,
      evaluationType: 'self',
      limit: 50,
    });

  // Fetch manager evaluations (for type-filtered tab)
  const { data: managerEvaluationsData, isLoading: managerEvaluationsLoading } =
    api.performance.evaluations.list.useQuery({
      cycleId: cycleIdParam || undefined,
      evaluationType: 'manager',
      limit: 50,
    });

  // Fetch all evaluations (for HR view) with new filters
  const { data: allEvaluationsData, isLoading: allEvaluationsLoading, refetch: refetchAll } =
    api.performance.evaluations.list.useQuery({
      cycleId: cycleIdParam || undefined,
      status: statusFilter !== 'all' ? (statusFilter as 'pending' | 'in_progress' | 'submitted' | 'validated' | 'shared') : undefined,
      evaluationType: typeFilter !== 'all' ? (typeFilter as 'self' | 'manager' | 'peer' | '360_report') : undefined,
      contractType: contractTypeFilter !== 'all' ? (contractTypeFilter as 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE') : undefined,
      isAdHoc: sourceFilter === 'adhoc' ? true : sourceFilter === 'cycle' ? false : undefined,
      adHocType: adHocTypeFilter !== 'all' ? (adHocTypeFilter as 'probation' | 'cdd_renewal' | 'cddti_check' | 'other') : undefined,
      limit: 50,
    });

  // Fetch cycles for filter
  const { data: cyclesData } = api.performance.cycles.list.useQuery({
    limit: 20,
  });

  // Create ad-hoc evaluation mutation
  const createAdHocMutation = api.performance.evaluations.createAdHoc.useMutation({
    onSuccess: (data) => {
      toast.success('Évaluation créée avec succès');
      setAdHocDialogOpen(false);
      setAdHocEmployeeId('');
      setAdHocNotes('');
      refetchAll();
      // Navigate to the new evaluation
      router.push(`/performance/evaluations/${data.evaluation.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const handleCreateAdHoc = () => {
    if (!adHocEmployeeId) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }
    createAdHocMutation.mutate({
      employeeId: adHocEmployeeId,
      adHocType: adHocType,
      notes: adHocNotes || undefined,
    });
  };

  // Prefetch evaluation detail on hover for instant navigation
  const utils = api.useUtils();
  const prefetchEvaluation = useCallback(
    (id: string) => {
      void utils.performance.evaluations.getById.prefetch({ id });
    },
    [utils]
  );

  const myEvaluations = myEvaluationsData?.data ?? [];
  const selfEvaluations = selfEvaluationsData?.data ?? [];
  const managerEvaluations = managerEvaluationsData?.data ?? [];
  const allEvaluations = allEvaluationsData?.data ?? [];
  const cycles = cyclesData?.data ?? [];

  // Count evaluations
  const pendingCount = myEvaluations.length;
  const selfCompleted = selfEvaluations.filter(e => ['submitted', 'validated', 'shared'].includes(e.status)).length;
  const selfTotal = selfEvaluations.length;
  const managerCompleted = managerEvaluations.filter(e => ['submitted', 'validated', 'shared'].includes(e.status)).length;
  const managerTotal = managerEvaluations.length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Évaluations</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos évaluations de performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="h-8 px-4 text-sm">
              {pendingCount} à compléter
            </Badge>
          )}
          {/* Create Ad-Hoc Evaluation Button */}
          <Dialog open={adHocDialogOpen} onOpenChange={setAdHocDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px]">
                <Plus className="mr-2 h-4 w-4" />
                Évaluation individuelle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Créer une évaluation individuelle</DialogTitle>
                <DialogDescription>
                  Créez une évaluation ponctuelle (hors cycle) pour un employé.
                  Utile pour les fins de période d'essai, renouvellements CDD, etc.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Employee Selection */}
                <EmployeePicker
                  id="employee"
                  label="Employé"
                  placeholder="Rechercher un employé..."
                  value={adHocEmployeeId}
                  onChange={(value) => setAdHocEmployeeId(value as string ?? '')}
                  required
                />

                {/* Ad-Hoc Type */}
                <div className="space-y-2">
                  <Label htmlFor="adHocType">Type d'évaluation *</Label>
                  <Select value={adHocType} onValueChange={(v) => setAdHocType(v as typeof adHocType)}>
                    <SelectTrigger id="adHocType" className="min-h-[48px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="probation">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Fin de période d'essai
                        </div>
                      </SelectItem>
                      <SelectItem value="cdd_renewal">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Renouvellement CDD
                        </div>
                      </SelectItem>
                      <SelectItem value="cddti_check">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Évaluation CDDTI
                        </div>
                      </SelectItem>
                      <SelectItem value="other">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4" />
                          Autre
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Input
                    id="notes"
                    placeholder="Raison de l'évaluation..."
                    value={adHocNotes}
                    onChange={(e) => setAdHocNotes(e.target.value)}
                    className="min-h-[48px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdHocDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateAdHoc}
                  disabled={!adHocEmployeeId || createAdHocMutation.isPending}
                  className="min-h-[44px]"
                >
                  {createAdHocMutation.isPending ? 'Création...' : 'Créer l\'évaluation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:flex-wrap gap-1">
          <TabsTrigger value="my" className="min-h-[44px]">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            A completer
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="self" className="min-h-[44px]">
            <UserCheck className="mr-2 h-4 w-4" />
            Auto-evaluations
            {selfTotal > 0 && (
              <Badge variant={selfCompleted === selfTotal ? 'default' : 'secondary'} className="ml-2">
                {selfCompleted}/{selfTotal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="manager" className="min-h-[44px]">
            <Users className="mr-2 h-4 w-4" />
            Evaluations RH
            {managerTotal > 0 && (
              <Badge variant={managerCompleted === managerTotal ? 'default' : 'secondary'} className="ml-2">
                {managerCompleted}/{managerTotal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="min-h-[44px]">
            <Inbox className="mr-2 h-4 w-4" />
            Tout voir
          </TabsTrigger>
        </TabsList>

        {/* My Evaluations Tab */}
        <TabsContent value="my" className="space-y-4 mt-4">
          {myEvaluationsLoading ? (
            <CardListSkeleton count={3} />
          ) : myEvaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Vous êtes à jour!</h3>
                <p className="text-muted-foreground">
                  Aucune évaluation en attente à compléter.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myEvaluations.map((evaluation) => {
                const TypeIcon = typeIcons[evaluation.evaluationType] || ClipboardCheck;
                return (
                  <Link
                    key={evaluation.id}
                    href={`/performance/evaluations/${evaluation.id}`}
                    onMouseEnter={() => prefetchEvaluation(evaluation.id)}
                  >
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <TypeIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {typeLabels[evaluation.evaluationType]}
                                {evaluation.cycle?.name && ` • ${evaluation.cycle.name}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[evaluation.status]}>
                              {statusLabels[evaluation.status]}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Self Evaluations Tab */}
        <TabsContent value="self" className="space-y-4 mt-4">
          {/* Progress header */}
          {selfTotal > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Progression des auto-evaluations</p>
                    <p className="text-sm text-muted-foreground">
                      {selfCompleted === selfTotal
                        ? 'Tous les employes ont complete leur auto-evaluation'
                        : `${selfTotal - selfCompleted} employe(s) n'ont pas encore repondu`}
                    </p>
                  </div>
                  <Badge variant={selfCompleted === selfTotal ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                    {selfCompleted}/{selfTotal}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {selfEvaluationsLoading ? (
            <CardListSkeleton count={3} />
          ) : selfEvaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune auto-evaluation</h3>
                <p className="text-muted-foreground">
                  Les auto-evaluations apparaitront ici une fois le cycle lance.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selfEvaluations.map((evaluation) => (
                <Link
                  key={evaluation.id}
                  href={`/performance/evaluations/${evaluation.id}`}
                  onMouseEnter={() => prefetchEvaluation(evaluation.id)}
                >
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            ['submitted', 'validated', 'shared'].includes(evaluation.status)
                              ? 'bg-green-100'
                              : 'bg-amber-100'
                          }`}>
                            {['submitted', 'validated', 'shared'].includes(evaluation.status)
                              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                              : <Clock className="h-5 w-5 text-amber-600" />
                            }
                          </div>
                          <div>
                            <p className="font-medium">
                              {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {evaluation.cycle?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[evaluation.status]}>
                            {statusLabels[evaluation.status]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Manager Evaluations Tab */}
        <TabsContent value="manager" className="space-y-4 mt-4">
          {/* Progress header */}
          {managerTotal > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Progression de vos evaluations</p>
                    <p className="text-sm text-muted-foreground">
                      {managerCompleted === managerTotal
                        ? 'Vous avez complete toutes vos evaluations'
                        : `Il vous reste ${managerTotal - managerCompleted} evaluation(s) a completer`}
                    </p>
                  </div>
                  <Badge variant={managerCompleted === managerTotal ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                    {managerCompleted}/{managerTotal}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {managerEvaluationsLoading ? (
            <CardListSkeleton count={3} />
          ) : managerEvaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune evaluation manager</h3>
                <p className="text-muted-foreground">
                  Les evaluations apparaitront ici une fois le cycle lance.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {managerEvaluations.map((evaluation) => (
                <Link
                  key={evaluation.id}
                  href={`/performance/evaluations/${evaluation.id}`}
                  onMouseEnter={() => prefetchEvaluation(evaluation.id)}
                >
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            ['submitted', 'validated', 'shared'].includes(evaluation.status)
                              ? 'bg-green-100'
                              : 'bg-primary/10'
                          }`}>
                            {['submitted', 'validated', 'shared'].includes(evaluation.status)
                              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                              : <Users className="h-5 w-5 text-primary" />
                            }
                          </div>
                          <div>
                            <p className="font-medium">
                              {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {evaluation.cycle?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[evaluation.status]}>
                            {statusLabels[evaluation.status]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Evaluations Tab */}
        <TabsContent value="all" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Row 1: Basic Filters */}
                <div className="flex flex-wrap gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] min-h-[48px]">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="submitted">Soumis</SelectItem>
                      <SelectItem value="validated">Validé</SelectItem>
                      <SelectItem value="shared">Partagé</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] min-h-[48px]">
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="self">Auto-évaluation</SelectItem>
                      <SelectItem value="manager">Évaluation manager</SelectItem>
                      <SelectItem value="peer">Évaluation pair</SelectItem>
                    </SelectContent>
                  </Select>

                  {cycles.length > 0 && (
                    <Select
                      value={cycleIdParam || 'all'}
                      onValueChange={(value) => {
                        if (value === 'all') {
                          router.push('/performance/evaluations');
                        } else {
                          router.push(`/performance/evaluations?cycleId=${value}`);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                        <SelectValue placeholder="Tous les cycles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les cycles</SelectItem>
                        {cycles.map((cycle) => (
                          <SelectItem key={cycle.id} value={cycle.id}>
                            {cycle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Row 2: Advanced Filters (Contract, Source, Ad-hoc type) */}
                <div className="flex flex-wrap gap-3 pt-2 border-t">
                  {/* Contract Type Filter */}
                  <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] min-h-[48px]">
                      <SelectValue placeholder="Type contrat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les contrats</SelectItem>
                      <SelectItem value="CDI">CDI</SelectItem>
                      <SelectItem value="CDD">CDD</SelectItem>
                      <SelectItem value="CDDTI">CDDTI</SelectItem>
                      <SelectItem value="INTERIM">Intérim</SelectItem>
                      <SelectItem value="STAGE">Stage</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Source Filter (Cycle vs Ad-hoc) */}
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] min-h-[48px]">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les sources</SelectItem>
                      <SelectItem value="cycle">Cycle de performance</SelectItem>
                      <SelectItem value="adhoc">Évaluation individuelle</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Ad-hoc Type Filter (only show when source is ad-hoc) */}
                  {sourceFilter === 'adhoc' && (
                    <Select value={adHocTypeFilter} onValueChange={setAdHocTypeFilter}>
                      <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                        <SelectValue placeholder="Type ad-hoc" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        <SelectItem value="probation">Fin période d'essai</SelectItem>
                        <SelectItem value="cdd_renewal">Renouvellement CDD</SelectItem>
                        <SelectItem value="cddti_check">Évaluation CDDTI</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evaluations List */}
          {allEvaluationsLoading ? (
            <CardListSkeleton count={3} />
          ) : allEvaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune évaluation</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Essayez de modifier vos filtres'
                    : 'Lancez un cycle pour créer des évaluations'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allEvaluations.map((evaluation) => {
                const TypeIcon = typeIcons[evaluation.evaluationType] || ClipboardCheck;
                return (
                  <Link
                    key={evaluation.id}
                    href={`/performance/evaluations/${evaluation.id}`}
                    onMouseEnter={() => prefetchEvaluation(evaluation.id)}
                  >
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-muted rounded-lg">
                              <TypeIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{typeLabels[evaluation.evaluationType]}</span>
                                {evaluation.cycle?.name && (
                                  <>
                                    <span>•</span>
                                    <span>{evaluation.cycle.name}</span>
                                  </>
                                )}
                                {evaluation.submittedAt && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {format(new Date(evaluation.submittedAt), 'dd MMM yyyy', { locale: fr })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[evaluation.status]}>
                              {statusLabels[evaluation.status]}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination info */}
          {allEvaluationsData && allEvaluationsData.total > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {allEvaluations.length} sur {allEvaluationsData.total} évaluations
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
