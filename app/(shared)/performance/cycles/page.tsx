/**
 * Performance Cycles List Page
 *
 * Displays all performance evaluation cycles.
 * HR can create new cycles, all users can view cycles.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  Search,
  Calendar,
  Users,
  ClipboardCheck,
  ChevronRight,
  Activity,
} from 'lucide-react';

// Status badge colors (matching performance schema)
const statusColors: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  objective_setting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  calibration: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  closed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const statusLabels: Record<string, string> = {
  planning: 'Planification',
  objective_setting: 'Définition objectifs',
  active: 'En cours',
  calibration: 'Calibration',
  closed: 'Clôturé',
};

export default function PerformanceCyclesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch cycles (filter locally by search since API doesn't support search param)
  const { data: cyclesData, isLoading } = api.performance.cycles.list.useQuery({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 50,
  });

  // Filter cycles by search term locally
  const allCycles = cyclesData?.data ?? [];
  const cycles = search
    ? allCycles.filter((cycle) =>
        cycle.name.toLowerCase().includes(search.toLowerCase()) ||
        (cycle.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : allCycles;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cycles d'évaluation</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos cycles d'évaluation de performance
          </p>
        </div>
        <Button
          onClick={() => router.push('/performance/cycles/new')}
          className="min-h-[48px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouveau cycle
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un cycle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 min-h-[48px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="planning">Planification</SelectItem>
                <SelectItem value="objective_setting">Définition objectifs</SelectItem>
                <SelectItem value="active">En cours</SelectItem>
                <SelectItem value="calibration">Calibration</SelectItem>
                <SelectItem value="closed">Clôturé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cycles List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun cycle trouvé</h3>
            <p className="text-muted-foreground mb-6">
              {search || statusFilter !== 'all'
                ? 'Essayez de modifier vos filtres de recherche'
                : 'Créez votre premier cycle d\'évaluation pour commencer'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button onClick={() => router.push('/performance/cycles/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Créer un cycle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cycles.map((cycle) => (
            <Link key={cycle.id} href={`/performance/cycles/${cycle.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold truncate">
                          {cycle.name}
                        </h3>
                        <Badge className={statusColors[cycle.status]}>
                          {statusLabels[cycle.status]}
                        </Badge>
                      </div>

                      {cycle.description && (
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {cycle.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(new Date(cycle.periodStart), 'dd MMM yyyy', { locale: fr })}
                            {' - '}
                            {format(new Date(cycle.periodEnd), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>
                            {cycle.cycleType === 'annual' && 'Évaluation annuelle'}
                            {cycle.cycleType === 'semi_annual' && 'Évaluation semestrielle'}
                            {cycle.cycleType === 'quarterly' && 'Évaluation trimestrielle'}
                            {cycle.cycleType === 'monthly' && 'Évaluation mensuelle'}
                            {cycle.cycleType === 'probation' && 'Période d\'essai'}
                            {cycle.cycleType === 'project' && 'Projet'}
                            {cycle.cycleType === 'custom' && 'Personnalisé'}
                          </span>
                        </div>

                        {cycle.includeSelfEvaluation && (
                          <div className="flex items-center gap-1">
                            <ClipboardCheck className="h-4 w-4" />
                            <span>Auto-évaluation</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination info */}
      {cyclesData && cyclesData.total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {cycles.length} sur {cyclesData.total} cycles
        </p>
      )}
    </div>
  );
}
