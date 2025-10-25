/**
 * Daily Workers Quick Entry Modal
 *
 * Fast path for entering hours for multiple employees at once.
 * Designed for HR managers who need to enter hours for daily workers quickly.
 *
 * HCI Principles:
 * - Zero learning curve: Simple form with clear labels
 * - Task-oriented: Focus on entering hours, not system operations
 * - Error prevention: Validate hours before submission
 * - Immediate feedback: Show success/error toasts
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Check } from 'lucide-react';

interface DailyWorkersQuickEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onSuccess?: () => void;
}

interface EmployeeHours {
  [employeeId: string]: string;
}

export function DailyWorkersQuickEntry({
  open,
  onOpenChange,
  date,
  onSuccess,
}: DailyWorkersQuickEntryProps) {
  const { toast } = useToast();
  const [hours, setHours] = useState<EmployeeHours>({});

  // Fetch employees needing hours
  const { data: workers, isLoading: loadingWorkers } =
    api.timeTracking.getEmployeesNeedingHours.useQuery(
      { date },
      { enabled: open }
    );

  // Bulk upsert mutation
  const bulkUpsertMutation = api.timeTracking.bulkUpsertManualEntries.useMutation({
    onSuccess: (result) => {
      if (result.errors > 0) {
        toast({
          title: 'Partiellement enregistré',
          description: `${result.success} entrées créées, ${result.errors} erreurs`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Enregistré',
          description: `${result.success} entrée${result.success > 1 ? 's' : ''} créée${result.success > 1 ? 's' : ''} avec succès`,
        });
      }
      setHours({});
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleHoursChange = (employeeId: string, value: string) => {
    setHours((prev) => ({
      ...prev,
      [employeeId]: value,
    }));
  };

  const handleSaveAll = async () => {
    if (!workers) return;

    // Filter employees with hours entered
    const entriesToCreate = workers
      .filter((worker) => {
        const hourValue = parseFloat(hours[worker.id] || '0');
        return hourValue > 0 && hourValue <= 24;
      })
      .map((worker) => {
        const hourValue = parseFloat(hours[worker.id]);
        const workDate = format(date, 'yyyy-MM-dd');

        // Create time entries from 8:00 AM to calculated end time
        const clockInTime = new Date(date);
        clockInTime.setHours(8, 0, 0, 0);

        const clockOutTime = new Date(clockInTime);
        clockOutTime.setHours(clockInTime.getHours() + Math.floor(hourValue));
        clockOutTime.setMinutes(Math.round((hourValue % 1) * 60));

        return {
          employeeId: worker.id,
          workDate,
          clockIn: clockInTime.toISOString(),
          clockOut: clockOutTime.toISOString(),
          totalHours: hourValue,
          notes: 'Saisie rapide',
        };
      });

    if (entriesToCreate.length === 0) {
      toast({
        title: 'Aucune entrée',
        description: 'Veuillez entrer au moins une heure valide',
        variant: 'destructive',
      });
      return;
    }

    await bulkUpsertMutation.mutateAsync({ entries: entriesToCreate });
  };

  const hasAnyHours = Object.values(hours).some((h) => {
    const value = parseFloat(h || '0');
    return value > 0;
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saisir les heures</DialogTitle>
          <DialogDescription>
            {format(date, 'd MMMM yyyy', { locale: fr })} -{' '}
            {loadingWorkers ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              <>
                {workers?.length || 0}{' '}
                {workers && workers.length > 1 ? 'employés' : 'employé'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingWorkers && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingWorkers && workers && workers.length === 0 && (
          <div className="text-center py-8 rounded-lg border border-dashed">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Tous les employés ont déjà leurs heures
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Aucune saisie nécessaire pour aujourd'hui
            </p>
          </div>
        )}

        {!loadingWorkers && workers && workers.length > 0 && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <Avatar>
                  <AvatarFallback>
                    {getInitials(worker.firstName, worker.lastName)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <p className="font-semibold">
                    {worker.firstName} {worker.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {worker.position}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor={`hours-${worker.id}`} className="sr-only">
                    Heures pour {worker.firstName} {worker.lastName}
                  </Label>
                  <Input
                    id={`hours-${worker.id}`}
                    type="number"
                    placeholder="8.0"
                    value={hours[worker.id] || ''}
                    onChange={(e) => handleHoursChange(worker.id, e.target.value)}
                    className="w-24 text-center min-h-[44px]"
                    min="0"
                    max="24"
                    step="0.5"
                  />
                  <span className="text-muted-foreground">heures</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={!hasAnyHours || bulkUpsertMutation.isPending || !workers || workers.length === 0}
            className="min-h-[44px]"
          >
            {bulkUpsertMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Enregistrer tout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
