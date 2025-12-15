/**
 * Performance Export Hub
 *
 * Central page to export performance data:
 * - Evaluations
 * - Objectives
 * - Training History
 * - KPI Observations
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  FileSpreadsheet,
  FileText,
  ClipboardCheck,
  Target,
  GraduationCap,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfYear, endOfYear } from 'date-fns';

// Helper to download file from base64
function downloadFile(content: string, filename: string, mimeType: string) {
  const byteCharacters = atob(content);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportHubPage() {
  // Get cycles for filtering
  const { data: cyclesData } = api.performance.cycles.list.useQuery({
    limit: 50,
  });

  const cycles = cyclesData?.data ?? [];

  // ============================================================================
  // EVALUATIONS EXPORT
  // ============================================================================

  const [evalCycleId, setEvalCycleId] = useState<string>('all');
  const [evalStatus, setEvalStatus] = useState<string>('all');
  const [evalFormat, setEvalFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [evalIncludeStrengths, setEvalIncludeStrengths] = useState(true);
  const [evalIncludeAreas, setEvalIncludeAreas] = useState(true);
  const [evalIncludeDev, setEvalIncludeDev] = useState(false);

  const exportEvaluations = api.performance.exports.evaluations.useMutation({
    onSuccess: (data) => {
      downloadFile(data.content, data.filename, data.mimeType);
      toast.success('Export des evaluations termine');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'export');
    },
  });

  const handleExportEvaluations = () => {
    exportEvaluations.mutate({
      cycleId: evalCycleId !== 'all' ? evalCycleId : undefined,
      status: evalStatus !== 'all' ? evalStatus : undefined,
      format: evalFormat,
      includeStrengths: evalIncludeStrengths,
      includeAreas: evalIncludeAreas,
      includeDevelopmentPlan: evalIncludeDev,
    });
  };

  // ============================================================================
  // OBJECTIVES EXPORT
  // ============================================================================

  const [objCycleId, setObjCycleId] = useState<string>('all');
  const [objStatus, setObjStatus] = useState<string>('all');
  const [objLevel, setObjLevel] = useState<string>('all');
  const [objFormat, setObjFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [objIncludeDesc, setObjIncludeDesc] = useState(true);
  const [objIncludeAssess, setObjIncludeAssess] = useState(true);

  const exportObjectives = api.performance.exports.objectives.useMutation({
    onSuccess: (data) => {
      downloadFile(data.content, data.filename, data.mimeType);
      toast.success('Export des objectifs termine');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'export');
    },
  });

  const handleExportObjectives = () => {
    exportObjectives.mutate({
      cycleId: objCycleId !== 'all' ? objCycleId : undefined,
      status: objStatus !== 'all' ? objStatus : undefined,
      level: objLevel !== 'all' ? objLevel as 'company' | 'team' | 'individual' : undefined,
      format: objFormat,
      includeDescriptions: objIncludeDesc,
      includeAssessments: objIncludeAssess,
    });
  };

  // ============================================================================
  // TRAINING HISTORY EXPORT
  // ============================================================================

  const [trainingDateFrom, setTrainingDateFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [trainingDateTo, setTrainingDateTo] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [trainingStatus, setTrainingStatus] = useState<string>('all');
  const [trainingFormat, setTrainingFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const exportTraining = api.training.exports.history.useMutation({
    onSuccess: (data) => {
      downloadFile(data.content, data.filename, data.mimeType);
      toast.success('Export des formations termine');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'export');
    },
  });

  const handleExportTraining = () => {
    exportTraining.mutate({
      dateFrom: trainingDateFrom,
      dateTo: trainingDateTo,
      status: trainingStatus !== 'all' ? trainingStatus : undefined,
      format: trainingFormat,
    });
  };

  // ============================================================================
  // OBSERVATIONS EXPORT (uses list endpoint with large limit)
  // ============================================================================

  const [obsDateFrom, setObsDateFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [obsDateTo, setObsDateTo] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [obsStatus, setObsStatus] = useState<string>('all');
  const [obsExporting, setObsExporting] = useState(false);

  const utils = api.useUtils();

  const handleExportObservations = async () => {
    setObsExporting(true);
    try {
      const data = await utils.observations.list.fetch({
        dateFrom: obsDateFrom,
        dateTo: obsDateTo,
        status: obsStatus !== 'all' ? obsStatus as 'draft' | 'submitted' | 'validated' : undefined,
        limit: 10000,
      });

      if (!data?.data?.length) {
        toast.error('Aucune observation a exporter');
        setObsExporting(false);
        return;
      }

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

      type ObsItem = (typeof data.data)[number];
      const rows = data.data.map((obs: ObsItem) => [
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
      link.download = `Observations_${obsDateFrom}_${obsDateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Export des observations termine');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
    setObsExporting(false);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Centre d'Export Performance</h1>
        <p className="text-muted-foreground">
          Exportez vos donnees de performance au format Excel ou CSV
        </p>
      </div>

      <Tabs defaultValue="evaluations" className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto">
          <TabsTrigger value="evaluations" className="min-h-[44px] gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="objectives" className="min-h-[44px] gap-2">
            <Target className="h-4 w-4" />
            Objectifs
          </TabsTrigger>
          <TabsTrigger value="training" className="min-h-[44px] gap-2">
            <GraduationCap className="h-4 w-4" />
            Formations
          </TabsTrigger>
          <TabsTrigger value="observations" className="min-h-[44px] gap-2">
            <BarChart3 className="h-4 w-4" />
            Observations
          </TabsTrigger>
        </TabsList>

        {/* Evaluations Export */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Export des Evaluations
              </CardTitle>
              <CardDescription>
                Exportez les evaluations de performance avec les scores et commentaires
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cycle</Label>
                  <Select value={evalCycleId} onValueChange={setEvalCycleId}>
                    <SelectTrigger className="min-h-[44px]">
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
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={evalStatus} onValueChange={setEvalStatus}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="submitted">Soumis</SelectItem>
                      <SelectItem value="validated">Valide</SelectItem>
                      <SelectItem value="shared">Partage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={evalFormat} onValueChange={(v) => setEvalFormat(v as 'xlsx' | 'csv')}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel (.xlsx)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV (.csv)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="eval-strengths">Inclure points forts</Label>
                  <Switch
                    id="eval-strengths"
                    checked={evalIncludeStrengths}
                    onCheckedChange={setEvalIncludeStrengths}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="eval-areas">Inclure axes d'amelioration</Label>
                  <Switch
                    id="eval-areas"
                    checked={evalIncludeAreas}
                    onCheckedChange={setEvalIncludeAreas}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="eval-dev">Inclure plan de developpement</Label>
                  <Switch
                    id="eval-dev"
                    checked={evalIncludeDev}
                    onCheckedChange={setEvalIncludeDev}
                  />
                </div>
              </div>

              <Button
                onClick={handleExportEvaluations}
                disabled={exportEvaluations.isPending}
                className="min-h-[44px]"
              >
                {exportEvaluations.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exporter les evaluations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Objectives Export */}
        <TabsContent value="objectives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Export des Objectifs
              </CardTitle>
              <CardDescription>
                Exportez les objectifs avec les cibles, valeurs actuelles et scores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Cycle</Label>
                  <Select value={objCycleId} onValueChange={setObjCycleId}>
                    <SelectTrigger className="min-h-[44px]">
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
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={objStatus} onValueChange={setObjStatus}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="completed">Termine</SelectItem>
                      <SelectItem value="cancelled">Annule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau</Label>
                  <Select value={objLevel} onValueChange={setObjLevel}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tous les niveaux" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="company">Entreprise</SelectItem>
                      <SelectItem value="team">Equipe</SelectItem>
                      <SelectItem value="individual">Individuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={objFormat} onValueChange={(v) => setObjFormat(v as 'xlsx' | 'csv')}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel (.xlsx)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV (.csv)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="obj-desc">Inclure descriptions</Label>
                  <Switch
                    id="obj-desc"
                    checked={objIncludeDesc}
                    onCheckedChange={setObjIncludeDesc}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="obj-assess">Inclure evaluations</Label>
                  <Switch
                    id="obj-assess"
                    checked={objIncludeAssess}
                    onCheckedChange={setObjIncludeAssess}
                  />
                </div>
              </div>

              <Button
                onClick={handleExportObjectives}
                disabled={exportObjectives.isPending}
                className="min-h-[44px]"
              >
                {exportObjectives.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exporter les objectifs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Export */}
        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Export de l'Historique de Formation
              </CardTitle>
              <CardDescription>
                Exportez l'historique de participation aux formations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date debut</Label>
                  <Input
                    type="date"
                    value={trainingDateFrom}
                    onChange={(e) => setTrainingDateFrom(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date fin</Label>
                  <Input
                    type="date"
                    value={trainingDateTo}
                    onChange={(e) => setTrainingDateTo(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={trainingStatus} onValueChange={setTrainingStatus}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="enrolled">Inscrit</SelectItem>
                      <SelectItem value="attended">Participe</SelectItem>
                      <SelectItem value="completed">Termine</SelectItem>
                      <SelectItem value="cancelled">Annule</SelectItem>
                      <SelectItem value="no_show">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={trainingFormat} onValueChange={(v) => setTrainingFormat(v as 'xlsx' | 'csv')}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel (.xlsx)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV (.csv)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleExportTraining}
                disabled={exportTraining.isPending}
                className="min-h-[44px]"
              >
                {exportTraining.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exporter l'historique
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Observations Export */}
        <TabsContent value="observations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Export des Observations KPI
              </CardTitle>
              <CardDescription>
                Exportez les observations de performance usine (KPIs quotidiens)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date debut</Label>
                  <Input
                    type="date"
                    value={obsDateFrom}
                    onChange={(e) => setObsDateFrom(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date fin</Label>
                  <Input
                    type="date"
                    value={obsDateTo}
                    onChange={(e) => setObsDateTo(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={obsStatus} onValueChange={setObsStatus}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="submitted">Soumis</SelectItem>
                      <SelectItem value="validated">Valide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleExportObservations}
                disabled={obsExporting}
                className="min-h-[44px]"
              >
                {obsExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exporter les observations (CSV)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
