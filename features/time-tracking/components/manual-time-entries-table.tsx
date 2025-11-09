/**
 * Manual Time Entries Table Component
 *
 * Table showing all employees with their manual time entries.
 * Allows adding, editing, and deleting manual time entries.
 *
 * Features:
 * - Shows all active employees (even if no entries)
 * - Add button for each employee
 * - Edit/delete buttons for each entry
 * - Badge display for entry dates and hours
 * - Overtime breakdown display
 * - Total calculation per employee
 * - Mobile-responsive
 *
 * HCI Principles:
 * - Large touch targets (min-h-[44px])
 * - Clear visual feedback
 * - Task-oriented design
 * - Progressive disclosure (overtime details)
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit2, Trash2, Clock, TrendingUp, Lock, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ManualTimeEntryDialog } from './manual-time-entry-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface TimeEntry {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: string | null;
  entryType: string;
  entrySource: 'manual' | 'biometric' | 'app';
  overtimeBreakdown: {
    hours_41_to_46?: number;
    hours_above_46?: number;
    night_work?: number;
    weekend_work?: number;
  } | null;
  notes: string | null;
}

interface ManualTimeEntriesTableProps {
  period: { startDate: Date; endDate: Date };
  employees: Employee[];
  isLoadingEmployees: boolean;
}

interface DialogState {
  open: boolean;
  employeeId: string | null;
  employeeName: string;
  employeeNumber: string;
  entryId?: string | null;
  entry?: TimeEntry | null;
  defaultDate?: string; // YYYY-MM-DD format for pre-filling the date
}

export function ManualTimeEntriesTable({
  period,
  employees,
  isLoadingEmployees,
}: ManualTimeEntriesTableProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    employeeId: null,
    employeeName: '',
    employeeNumber: '',
  });

  // Fetch manual entries for the period
  const { data: entries = [], isLoading: isLoadingEntries } =
    trpc.timeTracking.getManualEntries.useQuery({
      startDate: period.startDate,
      endDate: period.endDate,
    });

  // Debug logging
  console.log('[ManualTimeEntriesTable] Query result:', {
    entriesCount: entries.length,
    entries: entries,
    period: period,
  });

  // Debug overtime calculation
  if (entries.length > 0) {
    console.log('[ManualTimeEntriesTable] Entry details:', entries.map(e => ({
      id: e.id,
      employeeId: e.employeeId,
      clockIn: e.clockIn,
      totalHours: e.totalHours,
      entryType: e.entryType,
      overtimeBreakdown: e.overtimeBreakdown,
    })));
  }

  // Bulk upsert mutation
  const bulkUpsertMutation = trpc.timeTracking.bulkUpsertManualEntries.useMutation({
    onSuccess: (result) => {
      console.log('[ManualTimeEntriesTable] Mutation success:', result);
      console.log('[ManualTimeEntriesTable] Created entries details:', {
        results: result.results,
        firstEntry: result.results[0],
        firstEntryClockIn: result.results[0]?.clockIn,
        firstEntryDate: result.results[0]?.clockIn ? new Date(result.results[0].clockIn).toISOString() : 'N/A',
      });

      // Check if created entries are outside current period
      const createdDates = result.results.map(r => new Date(r.clockIn));
      const isOutsidePeriod = createdDates.some(date =>
        date < period.startDate || date > period.endDate
      );

      if (result.errors > 0) {
        toast({
          title: 'Partiellement enregistré',
          description: `${result.success} entrée(s) enregistrée(s), ${result.errors} erreur(s)`,
          variant: 'destructive',
        });
      } else if (isOutsidePeriod) {
        // Warn user that entry is outside current period
        const entryMonth = createdDates[0].toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        toast({
          title: 'Entrée enregistrée',
          description: `L'entrée pour ${entryMonth} a été créée. Changez le mois pour la voir.`,
          duration: 5000,
        });
      } else {
        toast({
          title: 'Enregistré',
          description: 'Heures enregistrées avec succès',
        });
      }
      // Invalidate and refetch the manual entries query
      console.log('[ManualTimeEntriesTable] Invalidating cache...');
      utils.timeTracking.getManualEntries.invalidate();
      setDialogState({ ...dialogState, open: false });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = trpc.timeTracking.deleteManualEntry.useMutation({
    onSuccess: () => {
      toast({
        title: 'Supprimé',
        description: 'Entrée supprimée avec succès',
      });
      // Invalidate and refetch the manual entries query
      utils.timeTracking.getManualEntries.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Group entries by employee
  const entriesByEmployee = entries.reduce((acc, entry) => {
    if (!acc[entry.employeeId]) {
      acc[entry.employeeId] = [];
    }
    acc[entry.employeeId].push(entry as TimeEntry);
    return acc;
  }, {} as Record<string, TimeEntry[]>);

  // Debug logging
  console.log('[ManualTimeEntriesTable] Grouped entries:', {
    groupedCount: Object.keys(entriesByEmployee).length,
    employeeIds: Object.keys(entriesByEmployee),
    entriesByEmployee: entriesByEmployee,
  });

  // Open dialog for adding new entry
  const handleAddClick = (employee: Employee) => {
    // Default to first day of the selected period
    const defaultDate = period.startDate.toISOString().split('T')[0];

    console.log('[ManualTimeEntriesTable] Opening add dialog:', {
      defaultDate,
      periodStart: period.startDate,
      periodStartISO: period.startDate.toISOString(),
    });

    setDialogState({
      open: true,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeNumber: employee.employeeNumber,
      entryId: null,
      entry: null,
      defaultDate, // Pass the default date from the selected period
    });
  };

  // Open dialog for editing existing entry
  const handleEditClick = (employee: Employee, entry: TimeEntry) => {
    setDialogState({
      open: true,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeNumber: employee.employeeNumber,
      entryId: entry.id,
      entry,
    });
  };

  // Handle dialog submit
  const handleDialogSubmit = async (values: {
    workDate: string;
    clockIn: string;
    clockOut: string;
    totalHours: number;
    notes?: string;
  }) => {
    if (!dialogState.employeeId) return;

    const mutationInput = {
      entries: [{
        entryId: dialogState.entryId || undefined,
        employeeId: dialogState.employeeId,
        workDate: values.workDate,
        clockIn: values.clockIn,
        clockOut: values.clockOut,
        totalHours: values.totalHours,
        notes: values.notes,
      }],
    };

    console.log('[ManualTimeEntriesTable] Submitting mutation with input:', mutationInput);
    console.log('[ManualTimeEntriesTable] Current period for comparison:', {
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      clockInDate: values.clockIn,
      workDate: values.workDate,
    });

    await bulkUpsertMutation.mutateAsync(mutationInput);
  };

  // Handle delete
  const handleDelete = (entryId: string, date: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'entrée du ${new Date(date).toLocaleDateString('fr-FR')} ?`)) {
      deleteMutation.mutate({ entryId });
    }
  };

  // Calculate total hours for an employee
  const calculateTotalHours = (entries: TimeEntry[]) => {
    return entries.reduce((sum, entry) => sum + Number(entry.totalHours || 0), 0);
  };

  // Calculate total overtime for an employee
  const calculateTotalOvertime = (entries: TimeEntry[]) => {
    return entries.reduce((sum, entry) => {
      if (!entry.overtimeBreakdown) return sum;
      const breakdown = entry.overtimeBreakdown;
      return sum +
        (breakdown.hours_41_to_46 || 0) +
        (breakdown.hours_above_46 || 0) +
        (breakdown.night_work || 0) +
        (breakdown.weekend_work || 0);
    }, 0);
  };

  if (isLoadingEmployees || isLoadingEntries) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Chargement des employés...</p>
        </div>
      </Card>
    );
  }

  if (employees.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucun employé actif</h3>
          <p className="text-muted-foreground">
            Ajoutez des employés pour commencer à saisir les heures.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Employé</TableHead>
                <TableHead className="min-w-[400px]">Heures saisies</TableHead>
                <TableHead className="min-w-[120px] text-right">Total</TableHead>
                <TableHead className="min-w-[120px] text-right">Heures sup.</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const employeeEntries = entriesByEmployee[employee.id] || [];
                const totalHours = calculateTotalHours(employeeEntries);
                const totalOvertime = calculateTotalOvertime(employeeEntries);
                const hasEntries = employeeEntries.length > 0;

                return (
                  <TableRow key={employee.id}>
                    {/* Employee */}
                    <TableCell className="font-medium">
                      <div>
                        <div>{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-muted-foreground">
                          #{employee.employeeNumber}
                        </div>
                      </div>
                    </TableCell>

                    {/* Time Entries */}
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {employeeEntries.map((entry) => {
                          const entryDate = new Date(entry.clockIn);
                          const formattedDate = entryDate.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                          });
                          const hasOvertime = entry.entryType === 'overtime';
                          const isManual = entry.entrySource === 'manual';
                          const isBiometric = entry.entrySource === 'biometric';
                          const isApp = entry.entrySource === 'app';

                          // Visual styling based on source
                          const sourceConfig = {
                            manual: {
                              icon: Edit2,
                              bgColor: 'bg-blue-50 border border-blue-200',
                              iconColor: 'text-blue-600',
                              label: 'Saisie manuelle',
                              labelShort: 'Manuelle',
                            },
                            biometric: {
                              icon: Lock,
                              bgColor: 'bg-green-50 border border-green-200',
                              iconColor: 'text-green-600',
                              label: 'Enregistré par appareil biométrique',
                              labelShort: 'Appareil',
                            },
                            app: {
                              icon: Smartphone,
                              bgColor: 'bg-purple-50 border border-purple-200',
                              iconColor: 'text-purple-600',
                              label: 'Pointage via application mobile',
                              labelShort: 'Application',
                            },
                          };

                          const config = sourceConfig[entry.entrySource as keyof typeof sourceConfig] || sourceConfig.manual;
                          const SourceIcon = config.icon;

                          return (
                            <TooltipProvider key={entry.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-1 rounded-md px-2 py-1 hover:opacity-80 cursor-help ${config.bgColor}`}
                                  >
                                    <SourceIcon className={`h-3 w-3 ${config.iconColor}`} />
                                    <div className="flex flex-col items-start">
                                      <span className="text-xs text-muted-foreground">
                                        {formattedDate}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm font-medium">
                                          {Number(entry.totalHours || 0).toFixed(1)}h
                                        </span>
                                        {hasOvertime && (
                                          <TrendingUp className="h-3 w-3 text-orange-500" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Actions: Only show for manual entries */}
                                    {isManual && (
                                      <div className="flex gap-1 ml-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditClick(employee, entry)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDelete(entry.id, entry.clockIn)}
                                          disabled={deleteMutation.isPending}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </div>
                                    )}

                                    {/* Lock icon for non-manual entries */}
                                    {!isManual && (
                                      <Lock className={`h-3 w-3 ml-1 ${config.iconColor}`} />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <div className="font-semibold">{formattedDate}</div>
                                    <div className="text-xs">
                                      {new Date(entry.clockIn).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })} - {entry.clockOut && new Date(entry.clockOut).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                    <div className="text-xs font-medium mt-1">
                                      Source: {config.label}
                                    </div>
                                    {!isManual && (
                                      <div className="text-xs text-muted-foreground">
                                        🔒 Cette entrée ne peut pas être modifiée
                                      </div>
                                    )}
                                    {entry.notes && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {entry.notes}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                        {!hasEntries && (
                          <span className="text-sm text-muted-foreground italic">
                            Aucune heure saisie
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right">
                      {hasEntries ? (
                        <span className="text-lg font-semibold">
                          {totalHours.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Overtime */}
                    <TableCell className="text-right">
                      {totalOvertime > 0 ? (
                        <Badge variant="secondary" className="font-semibold">
                          +{totalOvertime.toFixed(1)}h
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddClick(employee)}
                        className="min-h-[44px]"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Loading indicator */}
        {(bulkUpsertMutation.isPending || deleteMutation.isPending) && (
          <div className="p-4 border-t bg-muted/50 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              {bulkUpsertMutation.isPending ? 'Enregistrement...' : 'Suppression...'}
            </span>
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      {dialogState.employeeId && (() => {
        const initialValues = dialogState.entry
          ? {
              workDate: new Date(dialogState.entry.clockIn).toISOString().split('T')[0],
              clockIn: dialogState.entry.clockIn,
              clockOut: dialogState.entry.clockOut || undefined,
              notes: dialogState.entry.notes || undefined,
            }
          : dialogState.defaultDate
          ? {
              workDate: dialogState.defaultDate, // Use the default date from selected period
            }
          : undefined;

        console.log('[ManualTimeEntriesTable] Rendering dialog with:', {
          hasEntry: !!dialogState.entry,
          defaultDate: dialogState.defaultDate,
          initialValues,
        });

        return (
          <ManualTimeEntryDialog
            open={dialogState.open}
            onOpenChange={(open) => setDialogState({ ...dialogState, open })}
            onSubmit={handleDialogSubmit}
            employeeName={dialogState.employeeName}
            employeeNumber={dialogState.employeeNumber}
            initialValues={initialValues}
            isSubmitting={bulkUpsertMutation.isPending}
          />
        );
      })()}
    </>
  );
}
