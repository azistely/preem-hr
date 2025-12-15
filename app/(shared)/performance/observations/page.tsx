/**
 * Observations List Page
 *
 * Displays factory KPI observations with:
 * - Filter by date range, department, employee, status
 * - Quick entry form for single observation
 * - Bulk import from Excel button
 * - Export to Excel
 * - Aggregate view for evaluation period
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  Upload,
  Download,
  Search,
  Calendar,
  User,
  ClipboardCheck,
  Star,
  Filter,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Status badge colors
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  validated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  validated: 'Valide',
};

const periodLabels: Record<string, string> = {
  daily: 'Journalier',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
};

// Rating display component
function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

export default function ObservationsPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Filters state
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [employeeId, setEmployeeId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Quick entry dialog state
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickEntryData, setQuickEntryData] = useState({
    employeeId: '',
    observationDate: format(new Date(), 'yyyy-MM-dd'),
    period: 'daily',
    overallRating: 0,
    comment: '',
    kpiData: {
      unitsProduced: undefined as number | undefined,
      defects: undefined as number | undefined,
      hoursWorked: undefined as number | undefined,
      qualityScore: undefined as number | undefined,
      safetyScore: undefined as number | undefined,
      teamworkScore: undefined as number | undefined,
    },
  });

  // Fetch observations
  const { data: observationsData, isLoading } = api.observations.list.useQuery({
    dateFrom,
    dateTo,
    employeeId: employeeId !== 'all' ? employeeId : undefined,
    status: status !== 'all' ? status as 'draft' | 'submitted' | 'validated' : undefined,
    search: search || undefined,
    limit: 50,
  });

  // Fetch employees for filter
  const { data: employees } = api.employees.list.useQuery({
    status: 'active',
    limit: 100, // API max is 100
  });

  // Create observation mutation
  const createObservation = api.observations.create.useMutation({
    onSuccess: () => {
      toast.success('Observation creee');
      setShowQuickEntry(false);
      resetQuickEntryData();
      utils.observations.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la creation');
    },
  });

  // Delete observation mutation
  const deleteObservation = api.observations.delete.useMutation({
    onSuccess: () => {
      toast.success('Observation supprimee');
      utils.observations.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  // Validate observation mutation
  const validateObservation = api.observations.validate.useMutation({
    onSuccess: () => {
      toast.success('Observation validee');
      utils.observations.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la validation');
    },
  });

  const resetQuickEntryData = () => {
    setQuickEntryData({
      employeeId: '',
      observationDate: format(new Date(), 'yyyy-MM-dd'),
      period: 'daily',
      overallRating: 0,
      comment: '',
      kpiData: {
        unitsProduced: undefined,
        defects: undefined,
        hoursWorked: undefined,
        qualityScore: undefined,
        safetyScore: undefined,
        teamworkScore: undefined,
      },
    });
  };

  const handleQuickEntrySubmit = () => {
    if (!quickEntryData.employeeId) {
      toast.error('Veuillez selectionner un employe');
      return;
    }

    createObservation.mutate({
      employeeId: quickEntryData.employeeId,
      observationDate: quickEntryData.observationDate,
      period: quickEntryData.period as 'daily' | 'weekly' | 'monthly',
      overallRating: quickEntryData.overallRating > 0 ? quickEntryData.overallRating : undefined,
      comment: quickEntryData.comment || undefined,
      kpiData: Object.fromEntries(
        Object.entries(quickEntryData.kpiData).filter(([, v]) => v !== undefined)
      ),
    });
  };

  const handleExport = async () => {
    try {
      // Get export data
      const data = await utils.observations.list.fetch({
        dateFrom,
        dateTo,
        employeeId: employeeId !== 'all' ? employeeId : undefined,
        status: status !== 'all' ? status as 'draft' | 'submitted' | 'validated' : undefined,
        limit: 10000,
      });

      if (!data?.data?.length) {
        toast.error('Aucune observation a exporter');
        return;
      }

      // Type for observation data
      type ObservationItem = typeof data.data[number];

      // Convert to CSV
      const headers = [
        'Date',
        'Matricule',
        'Nom',
        'Prenom',
        'Periode',
        'Unites produites',
        'Defauts',
        'Heures travaillees',
        'Qualite',
        'Securite',
        'Travail equipe',
        'Note globale',
        'Statut',
        'Commentaire',
      ];

      const rows = data.data.map((obs: ObservationItem) => [
        obs.observationDate,
        obs.employee?.employeeNumber || '',
        obs.employee?.lastName || '',
        obs.employee?.firstName || '',
        periodLabels[obs.period] || obs.period,
        obs.kpiData?.unitsProduced ?? '',
        obs.kpiData?.defects ?? '',
        obs.kpiData?.hoursWorked ?? '',
        obs.kpiData?.qualityScore ?? '',
        obs.kpiData?.safetyScore ?? '',
        obs.kpiData?.teamworkScore ?? '',
        obs.overallRating ?? '',
        statusLabels[obs.status] || obs.status,
        obs.comment || '',
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
      ].join('\n');

      // Download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Observations_${dateFrom}_${dateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Export termine');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const observations = observationsData?.data ?? [];
  const total = observationsData?.total ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Observations KPI</h1>
          <p className="text-muted-foreground">
            Suivi quotidien des performances en usine
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button variant="outline" onClick={() => router.push('/performance/observations/import')}>
            <Upload className="mr-2 h-4 w-4" />
            Importer Excel
          </Button>
          <Dialog open={showQuickEntry} onOpenChange={setShowQuickEntry}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px]">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle observation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouvelle observation</DialogTitle>
                <DialogDescription>
                  Saisissez les KPIs pour un employe
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employe *</Label>
                    <Select
                      value={quickEntryData.employeeId}
                      onValueChange={(v) => setQuickEntryData({ ...quickEntryData, employeeId: v })}
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.employeeNumber} - {emp.firstName} {emp.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={quickEntryData.observationDate}
                      onChange={(e) => setQuickEntryData({ ...quickEntryData, observationDate: e.target.value })}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Periode</Label>
                    <Select
                      value={quickEntryData.period}
                      onValueChange={(v) => setQuickEntryData({ ...quickEntryData, period: v })}
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Journalier</SelectItem>
                        <SelectItem value="weekly">Hebdomadaire</SelectItem>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unites produites</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quickEntryData.kpiData.unitsProduced ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, unitsProduced: e.target.value ? parseInt(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Defauts</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quickEntryData.kpiData.defects ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, defects: e.target.value ? parseInt(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Heures travaillees</Label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="8"
                      value={quickEntryData.kpiData.hoursWorked ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, hoursWorked: e.target.value ? parseFloat(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Qualite (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      placeholder="1-5"
                      value={quickEntryData.kpiData.qualityScore ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, qualityScore: e.target.value ? parseInt(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Securite (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      placeholder="1-5"
                      value={quickEntryData.kpiData.safetyScore ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, safetyScore: e.target.value ? parseInt(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Travail d&apos;equipe (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      placeholder="1-5"
                      value={quickEntryData.kpiData.teamworkScore ?? ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        kpiData: { ...quickEntryData.kpiData, teamworkScore: e.target.value ? parseInt(e.target.value) : undefined },
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Note globale (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      placeholder="1-5"
                      value={quickEntryData.overallRating || ''}
                      onChange={(e) => setQuickEntryData({
                        ...quickEntryData,
                        overallRating: e.target.value ? parseInt(e.target.value) : 0,
                      })}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Commentaire</Label>
                  <Textarea
                    placeholder="Observations, remarques..."
                    value={quickEntryData.comment}
                    onChange={(e) => setQuickEntryData({ ...quickEntryData, comment: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQuickEntry(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleQuickEntrySubmit}
                  disabled={createObservation.isPending}
                  className="min-h-[44px]"
                >
                  {createObservation.isPending ? 'Creation...' : 'Creer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Date debut</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Date fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Employe</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les employes</SelectItem>
                  {employees?.employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="submitted">Soumis</SelectItem>
                  <SelectItem value="validated">Valide</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom, matricule..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 min-h-[44px]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-sm text-muted-foreground">Observations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {observations.filter((o) => o.status === 'draft').length}
            </div>
            <p className="text-sm text-muted-foreground">Brouillons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {observations.filter((o) => o.status === 'submitted').length}
            </div>
            <p className="text-sm text-muted-foreground">A valider</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {observations.filter((o) => o.status === 'validated').length}
            </div>
            <p className="text-sm text-muted-foreground">Valides</p>
          </CardContent>
        </Card>
      </div>

      {/* Observations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des observations</CardTitle>
          <CardDescription>
            {total} observation{total > 1 ? 's' : ''} pour la periode selectionnee
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : observations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune observation</h3>
              <p className="text-muted-foreground mb-4">
                Aucune observation trouvee pour les criteres selectionnes.
              </p>
              <Button onClick={() => setShowQuickEntry(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Creer une observation
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employe</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-center">Unites</TableHead>
                  <TableHead className="text-center">Defauts</TableHead>
                  <TableHead className="text-center">Qualite</TableHead>
                  <TableHead className="text-center">Note</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.map((obs) => (
                  <TableRow key={obs.id}>
                    <TableCell>
                      {format(new Date(obs.observationDate), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {obs.employee?.firstName} {obs.employee?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {obs.employee?.employeeNumber}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{periodLabels[obs.period] || obs.period}</TableCell>
                    <TableCell className="text-center">
                      {obs.kpiData?.unitsProduced ?? '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {obs.kpiData?.defects ?? '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {obs.kpiData?.qualityScore ?? '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <RatingStars value={obs.overallRating} />
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[obs.status]}>
                        {statusLabels[obs.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir details
                          </DropdownMenuItem>
                          {obs.status === 'draft' && (
                            <DropdownMenuItem>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {obs.status === 'submitted' && (
                            <DropdownMenuItem
                              onClick={() => validateObservation.mutate({ ids: [obs.id], action: 'validate' })}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Valider
                            </DropdownMenuItem>
                          )}
                          {obs.status === 'draft' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm('Supprimer cette observation ?')) {
                                  deleteObservation.mutate({ id: obs.id });
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
