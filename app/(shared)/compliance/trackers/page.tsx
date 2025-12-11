/**
 * Compliance Trackers List Page
 *
 * List all compliance trackers with filtering and search.
 * Features:
 * - Tabs by tracker type (Tous | Accidents | Visites | Certifications | Disciplinaire)
 * - Filters: Status, Priority, Assignee, Date range
 * - Table with: Reference, Title, Type, Status, Assignee, Due date, Actions
 * - Quick actions: View, Edit status, Assign
 *
 * HR Manager + Admin only access
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  FileText,
  AlertTriangle,
  Briefcase,
  Award,
  Gavel,
  ChevronRight,
  Filter,
  X,
  Calendar,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Map tracker type slugs to icons
const trackerTypeIcons: Record<string, React.ReactNode> = {
  accidents: <AlertTriangle className="h-4 w-4" />,
  visites: <Briefcase className="h-4 w-4" />,
  certifications: <Award className="h-4 w-4" />,
  disciplinaire: <Gavel className="h-4 w-4" />,
};

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
  nouveau: 'bg-blue-100 text-blue-800',
  analyse: 'bg-amber-100 text-amber-800',
  plan_action: 'bg-purple-100 text-purple-800',
  cloture: 'bg-green-100 text-green-800',
  planifiee: 'bg-slate-100 text-slate-800',
  en_cours: 'bg-amber-100 text-amber-800',
  recommandations: 'bg-orange-100 text-orange-800',
  traitement_nc: 'bg-purple-100 text-purple-800',
  demande_explication: 'bg-blue-100 text-blue-800',
  attente_reponse: 'bg-amber-100 text-amber-800',
  decision: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
  nouveau: 'Nouveau',
  analyse: 'Analyse',
  plan_action: 'Plan d\'action',
  cloture: 'Clôturé',
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  recommandations: 'Recommandations',
  traitement_nc: 'Traitement NC',
  demande_explication: 'Demande explication',
  attente_reponse: 'Attente réponse',
  decision: 'Décision',
};

export default function ComplianceTrackersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') || 'all';

  // Filters state
  const [activeType, setActiveType] = useState(initialType);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL params with state
  useEffect(() => {
    const type = searchParams.get('type');
    if (type) {
      setActiveType(type);
    }
  }, [searchParams]);

  // Fetch tracker types
  const { data: trackerTypes, isLoading: typesLoading } = api.complianceTrackerTypes.list.useQuery();

  // Fetch trackers
  const { data: trackers, isLoading: trackersLoading, refetch } = api.complianceTrackers.list.useQuery({
    typeSlug: activeType === 'all' ? undefined : activeType,
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : (priorityFilter as 'low' | 'medium' | 'high' | 'critical'),
    search: searchTerm || undefined,
    limit: 50,
  });

  // Handle type change
  const handleTypeChange = (type: string) => {
    setActiveType(type);
    const newUrl = type === 'all'
      ? '/compliance/trackers'
      : `/compliance/trackers?type=${type}`;
    router.push(newUrl);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setActiveType('all');
    router.push('/compliance/trackers');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || activeType !== 'all';

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-bold">Dossiers de conformité</h1>
          </div>

          <Link href="/compliance/trackers/new">
            <Button className="min-h-[56px] w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Button>
          </Link>
        </div>

        <p className="text-muted-foreground">
          Gérez et suivez tous vos dossiers de conformité
        </p>
      </div>

      {/* Type Tabs */}
      <Tabs value={activeType} onValueChange={handleTypeChange} className="mb-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Tous
          </TabsTrigger>
          {typesLoading ? (
            <>
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </>
          ) : (
            trackerTypes?.map((type) => (
              <TabsTrigger
                key={type.slug}
                value={type.slug}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
              >
                {trackerTypeIcons[type.slug]}
                {type.name}
              </TabsTrigger>
            ))
          )}
        </TabsList>
      </Tabs>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[48px]"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-[48px] ${hasActiveFilters ? 'border-primary' : ''}`}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {[statusFilter !== 'all', priorityFilter !== 'all', activeType !== 'all'].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-col md:flex-row gap-4 mt-4 pt-4 border-t">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] min-h-[48px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="nouveau">Nouveau</SelectItem>
                  <SelectItem value="analyse">Analyse</SelectItem>
                  <SelectItem value="plan_action">Plan d'action</SelectItem>
                  <SelectItem value="cloture">Clôturé</SelectItem>
                </SelectContent>
              </Select>

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

      {/* Trackers List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {trackersLoading ? (
                <Skeleton className="h-6 w-32 inline-block" />
              ) : (
                `${trackers?.total ?? 0} dossier${(trackers?.total ?? 0) > 1 ? 's' : ''}`
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trackersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : trackers?.data && trackers.data.length > 0 ? (
            <div className="space-y-3">
              {trackers.data.map((tracker) => (
                <Link
                  key={tracker.id}
                  href={`/compliance/trackers/${tracker.id}`}
                  className="block"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        {trackerTypeIcons[tracker.trackerType?.slug || ''] || (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-muted-foreground">
                            {tracker.referenceNumber}
                          </span>
                          <Badge
                            variant={priorityVariants[tracker.priority] || 'default'}
                            className="text-xs"
                          >
                            {priorityLabels[tracker.priority] || tracker.priority}
                          </Badge>
                        </div>
                        <p className="font-medium truncate">{tracker.title}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{tracker.trackerType?.name}</span>
                          {tracker.assignee && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {tracker.assignee.firstName} {tracker.assignee.lastName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[tracker.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {statusLabels[tracker.status] || tracker.status}
                        </span>
                        {tracker.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tracker.dueDate), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Aucun dossier ne correspond aux filtres'
                  : 'Aucun dossier créé'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Effacer les filtres
                </Button>
              ) : (
                <Link href="/compliance/trackers/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Créer un dossier
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more (if needed) */}
      {trackers?.hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" disabled>
            Afficher plus
          </Button>
        </div>
      )}
    </div>
  );
}
