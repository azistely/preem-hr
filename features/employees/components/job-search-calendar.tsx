/**
 * Job Search Calendar Component
 *
 * Allows employees/HR to track job search days during notice period
 * Convention Collective: 2 days/week for job search
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface JobSearchCalendarProps {
  terminationId: string;
  employeeId: string;
  noticeStartDate: string;
  terminationDate: string;
  isHR?: boolean; // HR can approve/reject
}

export function JobSearchCalendar({
  terminationId,
  employeeId,
  noticeStartDate,
  terminationDate,
  isHR = false,
}: JobSearchCalendarProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dayType, setDayType] = useState<'full_day' | 'half_day'>('full_day');
  const [notes, setNotes] = useState('');

  // Fetch job search days
  const { data: jobSearchDays, refetch } = trpc.jobSearchDays.list.useQuery({
    terminationId,
  });

  // Fetch statistics
  const { data: stats } = trpc.jobSearchDays.getStats.useQuery({
    terminationId,
  });

  // Mutations
  const createDay = trpc.jobSearchDays.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Jour enregistré',
        description: 'Jour de recherche d\'emploi enregistré avec succès',
      });
      refetch();
      setShowAddDialog(false);
      setSelectedDate(null);
      setNotes('');
      setDayType('full_day');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateDay = trpc.jobSearchDays.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Statut mis à jour',
        description: 'Le statut du jour a été mis à jour',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteDay = trpc.jobSearchDays.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Jour supprimé',
        description: 'Jour de recherche d\'emploi supprimé',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddDay = () => {
    if (!selectedDate) return;

    createDay.mutate({
      terminationId,
      employeeId,
      searchDate: selectedDate,
      dayType,
      notes: notes.trim() || undefined,
    });
  };

  const handleApprove = (dayId: string) => {
    updateDay.mutate({
      id: dayId,
      status: 'approved',
    });
  };

  const handleReject = (dayId: string) => {
    updateDay.mutate({
      id: dayId,
      status: 'rejected',
      rejectionReason: 'Refusé par RH',
    });
  };

  const handleDelete = (dayId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce jour ?')) {
      deleteDay.mutate({ id: dayId });
    }
  };

  const getDayStatus = (date: string) => {
    return jobSearchDays?.find((d) => d.searchDate === date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      default:
        return null;
    }
  };

  // Generate calendar days for current month
  const start = parseISO(noticeStartDate);
  const end = parseISO(terminationDate);
  const monthStart = startOfMonth(start);
  const monthEnd = endOfMonth(end);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-4">
      {/* Statistics Card */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Jours de recherche d'emploi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Droit total</p>
                <p className="text-2xl font-bold">{stats.entitledDays} jours</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approuvés</p>
                <p className="text-2xl font-bold text-green-600">{stats.approvedDays}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingDays}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Restants</p>
                <p className="text-2xl font-bold">{stats.remainingDays}</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                ℹ️ <strong>Convention Collective:</strong> 2 jours par semaine pendant le préavis
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Search Days List */}
      <Card>
        <CardHeader>
          <CardTitle>Jours enregistrés</CardTitle>
        </CardHeader>
        <CardContent>
          {!jobSearchDays || jobSearchDays.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun jour enregistré</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un jour
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobSearchDays.map((day) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(parseISO(day.searchDate), 'dd MMMM yyyy', { locale: fr })}
                      </span>
                      {getStatusBadge(day.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {day.dayType === 'full_day' ? 'Journée complète' : 'Demi-journée'} ({day.hoursTaken}h)
                    </p>
                    {day.notes && (
                      <p className="text-sm mt-2 text-muted-foreground italic">{day.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isHR && day.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(day.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(day.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </>
                    )}
                    {day.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(day.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                className="w-full mt-4"
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un jour
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Day Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un jour de recherche d'emploi</DialogTitle>
            <DialogDescription>
              Enregistrez les jours où vous avez cherché un emploi pendant votre préavis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="searchDate">Date *</Label>
              <input
                id="searchDate"
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={noticeStartDate}
                max={terminationDate}
                className="mt-2 w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <Label>Type de jour *</Label>
              <RadioGroup value={dayType} onValueChange={(v) => setDayType(v as any)} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full_day" id="full_day" />
                  <Label htmlFor="full_day">Journée complète (8h)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="half_day" id="half_day" />
                  <Label htmlFor="half_day">Demi-journée (4h)</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Entretien chez ABC Corporation, recherche sur LinkedIn, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddDay}
              disabled={!selectedDate || createDay.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
