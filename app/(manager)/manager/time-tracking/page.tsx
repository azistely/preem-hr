/**
 * Manager Time Tracking Approval Page
 *
 * Task-oriented design: "Approuver les heures travaillées"
 * Following HCI principles:
 * - Zero learning curve (approve/reject obvious)
 * - Error prevention (can't approve invalid entries)
 * - Immediate feedback (optimistic UI)
 * - Progressive disclosure (details hidden until needed)
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  Loader2
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function ManagerTimeTrackingPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const utils = trpc.useUtils();

  // Fetch pending entries
  const { data: pendingEntries, isLoading } = trpc.timeTracking.getPendingEntries.useQuery({});

  // Fetch pending summary
  const { data: summary } = trpc.timeTracking.getPendingSummary.useQuery();

  // Mutations
  const approveMutation = trpc.timeTracking.approveEntry.useMutation({
    onSuccess: () => {
      utils.timeTracking.getPendingEntries.invalidate();
      utils.timeTracking.getPendingSummary.invalidate();
      toast.success('Heures approuvées !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const bulkApproveMutation = trpc.timeTracking.bulkApprove.useMutation({
    onSuccess: () => {
      utils.timeTracking.getPendingEntries.invalidate();
      utils.timeTracking.getPendingSummary.invalidate();
      setSelectedIds([]);
      toast.success('Heures approuvées en masse !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const rejectMutation = trpc.timeTracking.rejectEntry.useMutation({
    onSuccess: () => {
      utils.timeTracking.getPendingEntries.invalidate();
      utils.timeTracking.getPendingSummary.invalidate();
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectionReason('');
      toast.success('Heures rejetées');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingEntries?.map(e => e.id) || []);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectEntry = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate({ entryId: id });
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    bulkApproveMutation.mutate({ entryIds: selectedIds });
  };

  const handleRejectClick = (id: string) => {
    setRejectingId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    rejectMutation.mutate({
      entryId: rejectingId,
      rejectionReason: rejectionReason.trim(),
    });
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}min`;
  };

  const getOvertimeWarning = (overtimeHours: number) => {
    const weeklyLimit = 15;
    const percentage = (overtimeHours / weeklyLimit) * 100;

    if (percentage >= 100) {
      return { severity: 'urgent', message: '⚠️ Limite hebdomadaire atteinte (15h)' };
    } else if (percentage >= 80) {
      return { severity: 'warning', message: `⚠️ ${percentage.toFixed(0)}% de la limite hebdomadaire` };
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Approuver les heures</h1>
        <p className="text-muted-foreground mt-2">
          Validez les heures travaillées par vos employés
        </p>
      </div>

      {/* Summary Cards - Level 1: Essential */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {summary?.pendingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              pointages à approuver
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Heures supplémentaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {summary?.totalOvertimeHours
                ? formatDuration(summary.totalOvertimeHours)
                : '0h 0min'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              en attente d'approbation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sélectionnés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {selectedIds.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              prêts pour approbation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions - Level 1: Primary Action */}
      {selectedIds.length > 0 && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {selectedIds.length} pointage{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                Approuver tout en un clic
              </p>
            </div>
            <Button
              className="min-h-[56px] min-w-[200px]"
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approbation...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Tout approuver
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Entries List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pointages en attente
              </CardTitle>
              <CardDescription className="mt-2">
                Approuvez ou rejetez les heures travaillées
              </CardDescription>
            </div>

            {pendingEntries && pendingEntries.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.length === pendingEntries.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Tout sélectionner
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!pendingEntries || pendingEntries.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">Tout est à jour !</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun pointage en attente d'approbation
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEntries.map((entry) => {
                const totalHours = entry.totalHours ? Number(entry.totalHours) : 0;
                const overtimeBreakdown = entry.overtimeBreakdown as any;
                const overtimeHours = overtimeBreakdown
                  ? (Number(overtimeBreakdown.hours_41_to_46 || 0) +
                     Number(overtimeBreakdown.hours_above_46 || 0) +
                     Number(overtimeBreakdown.weekend || 0) +
                     Number(overtimeBreakdown.night_work || 0) +
                     Number(overtimeBreakdown.holiday || 0))
                  : 0;

                const warning = overtimeHours > 0 ? getOvertimeWarning(overtimeHours) : null;

                return (
                  <div
                    key={entry.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedIds.includes(entry.id)}
                        onCheckedChange={(checked) =>
                          handleSelectEntry(entry.id, checked as boolean)
                        }
                        className="mt-1"
                      />

                      {/* Employee Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-lg">
                            {(entry.employee as any)?.firstName} {(entry.employee as any)?.lastName}
                          </p>
                          {warning && (
                            <Badge
                              variant={warning.severity === 'urgent' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {warning.message}
                            </Badge>
                          )}
                        </div>

                        {/* Time Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="font-medium">
                              {format(new Date(entry.clockIn), 'EEE d MMM', { locale: fr })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Arrivée</p>
                            <p className="font-medium">
                              {format(new Date(entry.clockIn), 'HH:mm')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Départ</p>
                            <p className="font-medium">
                              {entry.clockOut
                                ? format(new Date(entry.clockOut), 'HH:mm')
                                : 'En cours'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Durée totale</p>
                            <p className="font-semibold text-primary">
                              {totalHours > 0 ? formatDuration(totalHours) : '-'}
                            </p>
                          </div>
                        </div>

                        {/* Overtime Details - Level 2: Progressive Disclosure */}
                        {overtimeHours > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
                              Voir les heures supplémentaires ({formatDuration(overtimeHours)}) ↓
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 p-3 bg-muted/30 rounded-lg">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                {overtimeBreakdown?.hours_41_to_46 > 0 && (
                                  <div className="flex justify-between">
                                    <span>Heures 41-46 (×1.15)</span>
                                    <span className="font-medium">
                                      {formatDuration(overtimeBreakdown.hours_41_to_46)}
                                    </span>
                                  </div>
                                )}
                                {overtimeBreakdown?.hours_above_46 > 0 && (
                                  <div className="flex justify-between">
                                    <span>Heures 46+ (×1.50)</span>
                                    <span className="font-medium">
                                      {formatDuration(overtimeBreakdown.hours_above_46)}
                                    </span>
                                  </div>
                                )}
                                {overtimeBreakdown?.night_work > 0 && (
                                  <div className="flex justify-between">
                                    <span>Nuit (×1.75)</span>
                                    <span className="font-medium">
                                      {formatDuration(overtimeBreakdown.night_work)}
                                    </span>
                                  </div>
                                )}
                                {overtimeBreakdown?.weekend > 0 && (
                                  <div className="flex justify-between">
                                    <span>Weekend (×1.75)</span>
                                    <span className="font-medium">
                                      {formatDuration(overtimeBreakdown.weekend)}
                                    </span>
                                  </div>
                                )}
                                {overtimeBreakdown?.holiday > 0 && (
                                  <div className="flex justify-between">
                                    <span>Jour férié (×2.00)</span>
                                    <span className="font-medium">
                                      {formatDuration(overtimeBreakdown.holiday)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          className="min-h-[44px]"
                          onClick={() => handleApprove(entry.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">Approuver</span>
                        </Button>
                        <Button
                          variant="destructive"
                          className="min-h-[44px]"
                          onClick={() => handleRejectClick(entry.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">Rejeter</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog - Error Prevention */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter les heures</DialogTitle>
            <DialogDescription>
              Expliquez pourquoi vous rejetez ce pointage
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Heure de départ incorrecte, pause non déduite..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejet...
                </>
              ) : (
                'Rejeter'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
