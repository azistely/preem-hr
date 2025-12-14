/**
 * Calibration Board Page
 *
 * 9-box grid for calibrating employee performance ratings.
 * HR managers drag employees between boxes based on performance/potential.
 *
 * HCI Principles:
 * - Visual grid layout for intuitive placement
 * - Color coding by box position
 * - Employee cards with key info
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  Plus,
  Calendar,
  Users,
  Star,
  TrendingUp,
  AlertCircle,
  User,
  Grid3X3,
  ChevronRight,
  Check,
  Play,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

// 9-box grid configuration
const boxConfig: Record<string, { label: string; color: string; action: string }> = {
  '1-1': { label: 'Risque', color: 'bg-red-100 text-red-700 border-red-300', action: 'Plan d\'amélioration urgent' },
  '1-2': { label: 'À développer', color: 'bg-orange-100 text-orange-700 border-orange-300', action: 'Formation ciblée' },
  '1-3': { label: 'Potentiel inexploité', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', action: 'Identifier les freins' },
  '2-1': { label: 'Contributeur', color: 'bg-blue-100 text-blue-700 border-blue-300', action: 'Maintenir et motiver' },
  '2-2': { label: 'Solide', color: 'bg-blue-100 text-blue-700 border-blue-300', action: 'Développement continu' },
  '2-3': { label: 'Futur leader', color: 'bg-green-100 text-green-700 border-green-300', action: 'Préparer à plus' },
  '3-1': { label: 'Expert', color: 'bg-purple-100 text-purple-700 border-purple-300', action: 'Valoriser l\'expertise' },
  '3-2': { label: 'Performer', color: 'bg-green-100 text-green-700 border-green-300', action: 'Reconnaître' },
  '3-3': { label: 'Star', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', action: 'Retenir et promouvoir' },
};

// Employee card for the grid
function EmployeeCard({
  employee,
  rating,
  onClick,
}: {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
  rating?: {
    performanceAxis: number | null;
    potentialAxis: number | null;
    calibratedRating: string | null;
    justification: string | null;
  };
  onClick?: () => void;
}) {
  if (!employee) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-2 bg-white rounded-lg border hover:border-primary transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {employee.jobTitle ?? 'Poste non défini'}
          </p>
        </div>
        {rating?.calibratedRating && (
          <Badge variant="outline" className="text-xs">
            {rating.calibratedRating}
          </Badge>
        )}
      </div>
    </button>
  );
}

// Rating type from API
type CalibrationRating = {
  id: string;
  evaluation: { id: string } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
  performanceAxis: number | null;
  potentialAxis: number | null;
  calibratedRating: string | null;
  justification: string | null;
};

// 9-box grid cell
function GridCell({
  performanceAxis,
  potentialAxis,
  ratings,
  onEmployeeClick,
}: {
  performanceAxis: number;
  potentialAxis: number;
  ratings: CalibrationRating[];
  onEmployeeClick: (rating: CalibrationRating) => void;
}) {
  const key = `${performanceAxis}-${potentialAxis}`;
  const config = boxConfig[key] || { label: '', color: '', action: '' };

  // Filter ratings for this cell
  const cellRatings = ratings.filter(
    (r) => r.performanceAxis === performanceAxis && r.potentialAxis === potentialAxis
  );

  return (
    <div
      className={`p-3 rounded-lg border-2 min-h-[140px] ${config.color}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">{config.label}</span>
        <Badge variant="secondary" className="text-xs">
          {cellRatings.length}
        </Badge>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {cellRatings.map((rating) => (
          <EmployeeCard
            key={rating.id}
            employee={rating.employee}
            rating={rating}
            onClick={() => onEmployeeClick(rating)}
          />
        ))}
      </div>
      {cellRatings.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {config.action}
        </p>
      )}
    </div>
  );
}

export default function CalibrationPage() {
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Create session form state
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionDate, setSessionDate] = useState('');

  // Rating form state
  const [editingRating, setEditingRating] = useState<{
    id: string;
    evaluationId: string;
    employee: { id: string; firstName: string; lastName: string; jobTitle: string | null } | null;
    performanceAxis: number;
    potentialAxis: number;
    calibratedRating: string;
    justification: string;
  } | null>(null);

  const utils = api.useUtils();

  // Fetch cycles for dropdown
  const { data: cyclesData } = api.performance.cycles.list.useQuery({});
  const cycles = cyclesData?.data ?? [];

  // Fetch calibration sessions
  const { data: sessions, isLoading: loadingSessions } = api.performance.calibration.sessions.list.useQuery({
    cycleId: selectedCycleId || undefined,
  });

  // Fetch ratings for selected session
  const { data: ratings, isLoading: loadingRatings } = api.performance.calibration.ratings.list.useQuery(
    { calibrationSessionId: selectedSessionId },
    { enabled: !!selectedSessionId }
  );

  // Create session mutation
  const createSession = api.performance.calibration.sessions.create.useMutation({
    onSuccess: (data) => {
      toast.success('Session de calibration créée');
      setShowCreateDialog(false);
      setSessionName('');
      setSessionDescription('');
      setSessionDate('');
      setSelectedSessionId(data.id);
      utils.performance.calibration.sessions.list.invalidate();
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  // Update rating mutation
  const updateRating = api.performance.calibration.ratings.update.useMutation({
    onSuccess: () => {
      toast.success('Position mise à jour');
      setShowRatingDialog(false);
      setEditingRating(null);
      utils.performance.calibration.ratings.list.invalidate();
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  // Update session status mutation
  const updateSessionStatus = api.performance.calibration.sessions.updateStatus.useMutation({
    onSuccess: (data) => {
      if (data.status === 'in_progress') {
        toast.success('Session de calibration démarrée');
      } else if (data.status === 'completed') {
        toast.success('Session de calibration terminée');
        setShowCompleteDialog(false);
      }
      utils.performance.calibration.sessions.list.invalidate();
      utils.performance.getGuideStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const handleCreateSession = () => {
    if (!selectedCycleId) {
      toast.error('Sélectionnez un cycle d\'abord');
      return;
    }

    if (!sessionName.trim()) {
      toast.error('Veuillez saisir un nom pour la session');
      return;
    }

    createSession.mutate({
      cycleId: selectedCycleId,
      name: sessionName,
      description: sessionDescription || undefined,
      sessionDate: sessionDate || undefined,
    });
  };

  const handleEmployeeClick = (rating: CalibrationRating) => {
    setEditingRating({
      id: rating.id,
      evaluationId: rating.evaluation?.id ?? '',
      employee: rating.employee,
      performanceAxis: rating.performanceAxis ?? 2,
      potentialAxis: rating.potentialAxis ?? 2,
      calibratedRating: rating.calibratedRating ?? '',
      justification: rating.justification ?? '',
    });
    setShowRatingDialog(true);
  };

  const handleUpdateRating = () => {
    if (!editingRating || !selectedSessionId) return;

    updateRating.mutate({
      calibrationSessionId: selectedSessionId,
      evaluationId: editingRating.evaluationId,
      performanceAxis: editingRating.performanceAxis,
      potentialAxis: editingRating.potentialAxis,
      calibratedRating: editingRating.calibratedRating,
      justification: editingRating.justification || undefined,
    });
  };

  const handleStartSession = () => {
    if (!selectedSessionId) return;
    updateSessionStatus.mutate({
      sessionId: selectedSessionId,
      status: 'in_progress',
    });
  };

  const handleCompleteSession = () => {
    if (!selectedSessionId) return;
    updateSessionStatus.mutate({
      sessionId: selectedSessionId,
      status: 'completed',
    });
  };

  // Selected session
  const selectedSession = sessions?.find((s) => s.id === selectedSessionId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Grid3X3 className="h-8 w-8 text-primary" />
            Calibration
          </h1>
          <p className="text-muted-foreground mt-1">
            Grille 9-box pour calibrer les performances et potentiels
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="min-h-[48px]" disabled={!selectedCycleId}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Créer une session de calibration</DialogTitle>
              <DialogDescription>
                Planifiez une session pour calibrer les évaluations du cycle sélectionné
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Show selected cycle */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Cycle sélectionné</p>
                <p className="font-medium">{cycles.find(c => c.id === selectedCycleId)?.name}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionName">Nom de la session *</Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Ex: Calibration T4 2024"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDate">Date de la session</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDescription">Description</Label>
                <Textarea
                  id="sessionDescription"
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="Objectifs et périmètre de la session..."
                  className="min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                className="min-h-[44px]"
              >
                {createSession.isPending ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cycle de performance</Label>
              <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Sélectionner un cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Session de calibration</Label>
              <Select
                value={selectedSessionId}
                onValueChange={setSelectedSessionId}
                disabled={!selectedCycleId || loadingSessions}
              >
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Sélectionner une session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session info */}
      {selectedSession && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedSession.name}</CardTitle>
                {selectedSession.description && (
                  <CardDescription>{selectedSession.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    selectedSession.status === 'completed'
                      ? 'default'
                      : selectedSession.status === 'in_progress'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {selectedSession.status === 'completed'
                    ? 'Terminée'
                    : selectedSession.status === 'in_progress'
                    ? 'En cours'
                    : 'Planifiée'}
                </Badge>
                {/* Action buttons based on status */}
                {selectedSession.status === 'scheduled' && (
                  <Button
                    size="sm"
                    onClick={handleStartSession}
                    disabled={updateSessionStatus.isPending}
                    className="min-h-[36px]"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Démarrer
                  </Button>
                )}
                {selectedSession.status === 'in_progress' && (
                  <Button
                    size="sm"
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={updateSessionStatus.isPending}
                    className="min-h-[36px]"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Terminer
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {selectedSession.sessionDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedSession.sessionDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {ratings?.length ?? 0} employé(s)
                </div>
              </div>
              {/* Show results summary for completed sessions */}
              {selectedSession.status === 'completed' && selectedSession.resultsSummary && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>
                      {(selectedSession.resultsSummary as { adjustments?: number })?.adjustments ?? 0} ajustement(s)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9-Box Grid */}
      {selectedSessionId ? (
        loadingRatings ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} className="h-[180px]" />
            ))}
          </div>
        ) : !ratings || ratings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune évaluation à calibrer</h3>
              <p className="text-muted-foreground">
                Les évaluations complétées apparaîtront ici pour calibration
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Axis labels */}
            <div className="flex items-center gap-4">
              <div className="w-24 text-right">
                <span className="text-sm font-medium text-muted-foreground">Performance</span>
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Potentiel
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
            </div>

            {/* Grid */}
            <div className="flex gap-4">
              {/* Y-axis labels */}
              <div className="w-24 flex flex-col justify-between py-4">
                <span className="text-xs font-medium text-right flex items-center justify-end gap-1">
                  <Star className="h-3 w-3" /> Élevée
                </span>
                <span className="text-xs font-medium text-right">Moyenne</span>
                <span className="text-xs font-medium text-right">Faible</span>
              </div>

              {/* Grid cells */}
              <div className="flex-1 grid grid-cols-3 gap-4">
                {/* Row 3 (High performance) */}
                <GridCell performanceAxis={3} potentialAxis={1} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={3} potentialAxis={2} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={3} potentialAxis={3} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />

                {/* Row 2 (Medium performance) */}
                <GridCell performanceAxis={2} potentialAxis={1} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={2} potentialAxis={2} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={2} potentialAxis={3} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />

                {/* Row 1 (Low performance) */}
                <GridCell performanceAxis={1} potentialAxis={1} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={1} potentialAxis={2} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
                <GridCell performanceAxis={1} potentialAxis={3} ratings={(ratings ?? []) as CalibrationRating[]} onEmployeeClick={handleEmployeeClick} />
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex gap-4 pl-28">
              <div className="flex-1 grid grid-cols-3 gap-4">
                <span className="text-xs font-medium text-center">Faible</span>
                <span className="text-xs font-medium text-center">Moyen</span>
                <span className="text-xs font-medium text-center flex items-center justify-center gap-1">
                  Élevé <TrendingUp className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sélectionnez une session</h3>
            <p className="text-muted-foreground">
              Choisissez un cycle et une session pour voir la grille de calibration
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rating edit dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Calibrer {editingRating?.employee?.firstName} {editingRating?.employee?.lastName}
            </DialogTitle>
            <DialogDescription>
              Positionnez l&apos;employé sur la grille 9-box
            </DialogDescription>
          </DialogHeader>

          {editingRating && (
            <div className="space-y-6 py-4">
              {/* Performance axis */}
              <div className="space-y-3">
                <Label>Performance (1-3)</Label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setEditingRating({ ...editingRating, performanceAxis: level })}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        editingRating.performanceAxis === level
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold">{level}</div>
                        <div className="text-xs text-muted-foreground">
                          {level === 1 ? 'Faible' : level === 2 ? 'Moyenne' : 'Élevée'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Potential axis */}
              <div className="space-y-3">
                <Label>Potentiel (1-3)</Label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setEditingRating({ ...editingRating, potentialAxis: level })}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        editingRating.potentialAxis === level
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold">{level}</div>
                        <div className="text-xs text-muted-foreground">
                          {level === 1 ? 'Faible' : level === 2 ? 'Moyen' : 'Élevé'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Box preview */}
              {editingRating.performanceAxis && editingRating.potentialAxis && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    Position: {boxConfig[`${editingRating.performanceAxis}-${editingRating.potentialAxis}`]?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {boxConfig[`${editingRating.performanceAxis}-${editingRating.potentialAxis}`]?.action}
                  </p>
                </div>
              )}

              {/* Calibrated rating */}
              <div className="space-y-2">
                <Label htmlFor="calibratedRating">Note calibrée</Label>
                <Input
                  id="calibratedRating"
                  value={editingRating.calibratedRating}
                  onChange={(e) => setEditingRating({ ...editingRating, calibratedRating: e.target.value })}
                  placeholder="Ex: A, B+, 4/5..."
                  className="min-h-[48px]"
                />
              </div>

              {/* Justification */}
              <div className="space-y-2">
                <Label htmlFor="justification">Justification</Label>
                <Textarea
                  id="justification"
                  value={editingRating.justification}
                  onChange={(e) => setEditingRating({ ...editingRating, justification: e.target.value })}
                  placeholder="Expliquez le positionnement..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRatingDialog(false);
                setEditingRating(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateRating}
              disabled={updateRating.isPending}
              className="min-h-[44px]"
            >
              <Check className="mr-2 h-4 w-4" />
              {updateRating.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete session confirmation dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Terminer la session de calibration</DialogTitle>
            <DialogDescription>
              Confirmez-vous la clôture de cette session ? Les notes calibrées seront finalisées.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Session</span>
                <span className="font-medium">{selectedSession?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employés calibrés</span>
                <span className="font-medium">{ratings?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Positions ajustées</span>
                <span className="font-medium">
                  {ratings?.filter(r => r.calibratedRating && r.calibratedRating !== r.originalRating).length ?? 0}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCompleteSession}
              disabled={updateSessionStatus.isPending}
              className="min-h-[44px]"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {updateSessionStatus.isPending ? 'Finalisation...' : 'Terminer la session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
