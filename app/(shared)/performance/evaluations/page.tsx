/**
 * Evaluations List Page
 *
 * Shows evaluations assigned to the current user or all evaluations for HR.
 * Employees see evaluations they need to complete or evaluations about them.
 * HR can see all evaluations and filter by cycle, status, type.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ClipboardCheck,
  Users,
  UserCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

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

export default function EvaluationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleIdParam = searchParams.get('cycleId');

  const [selectedTab, setSelectedTab] = useState('my');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Fetch evaluations to complete (my pending tasks)
  const { data: myEvaluationsData, isLoading: myEvaluationsLoading } =
    api.performance.evaluations.list.useQuery({
      myEvaluations: true,
      cycleId: cycleIdParam || undefined,
      limit: 50,
    });

  // Fetch all evaluations (for HR view)
  const { data: allEvaluationsData, isLoading: allEvaluationsLoading } =
    api.performance.evaluations.list.useQuery({
      cycleId: cycleIdParam || undefined,
      status: statusFilter !== 'all' ? (statusFilter as 'pending' | 'in_progress' | 'submitted' | 'validated' | 'shared') : undefined,
      evaluationType: typeFilter !== 'all' ? (typeFilter as 'self' | 'manager' | 'peer' | '360_report') : undefined,
      limit: 50,
    });

  // Fetch cycles for filter
  const { data: cyclesData } = api.performance.cycles.list.useQuery({
    limit: 20,
  });

  const myEvaluations = myEvaluationsData?.data ?? [];
  const allEvaluations = allEvaluationsData?.data ?? [];
  const cycles = cyclesData?.data ?? [];

  // Count pending evaluations
  const pendingCount = myEvaluations.length;

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
        {pendingCount > 0 && (
          <Badge variant="destructive" className="h-8 px-4 text-sm">
            {pendingCount} à compléter
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="my" className="min-h-[44px]">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Mes évaluations
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="min-h-[44px]">
            <Users className="mr-2 h-4 w-4" />
            Toutes les évaluations
          </TabsTrigger>
        </TabsList>

        {/* My Evaluations Tab */}
        <TabsContent value="my" className="space-y-4 mt-4">
          {myEvaluationsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
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

        {/* All Evaluations Tab */}
        <TabsContent value="all" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
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
                  <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
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
                    <SelectTrigger className="w-full sm:w-[250px] min-h-[48px]">
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
            </CardContent>
          </Card>

          {/* Evaluations List */}
          {allEvaluationsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
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
