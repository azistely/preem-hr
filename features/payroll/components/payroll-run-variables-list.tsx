/**
 * Payroll Run Variables List Component
 *
 * Displays and manages variable pay inputs for an employee within a specific payroll run.
 * Filters variables by the run's date range to prevent duplication in multi-frequency payroll.
 *
 * Features:
 * - Shows only variables where entry_date is in run's date range
 * - Add/edit/delete variable pay
 * - Touch-friendly UI (min-h-[44px])
 * - Empty state with clear CTA
 *
 * HCI Principles:
 * - Progressive disclosure (show only relevant variables)
 * - Clear visual hierarchy
 * - Immediate feedback
 */

'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { VariablePayInputDialog } from './variable-pay-input-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface PayrollRunVariablesListProps {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  runPeriodStart: string; // YYYY-MM-DD
  runPeriodEnd: string;   // YYYY-MM-DD
  onRefresh?: () => void;
}

export function PayrollRunVariablesList({
  employeeId,
  employeeName,
  employeeNumber,
  runPeriodStart,
  runPeriodEnd,
  onRefresh,
}: PayrollRunVariablesListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<string | null>(null);

  // Extract period from start date (YYYY-MM-DD → YYYY-MM-01)
  const period = useMemo(() => {
    const date = parseISO(runPeriodStart);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }, [runPeriodStart]);

  // Fetch all variables for the period
  const { data: allVariables, isLoading, refetch } = trpc.variablePayInputs.getForPeriod.useQuery({
    period,
  });

  // Filter to only show variables in this run's date range
  const filteredVariables = useMemo(() => {
    if (!allVariables?.inputs) return [];

    return allVariables.inputs.filter(
      (v: any) =>
        v.employeeId === employeeId &&
        v.entryDate >= runPeriodStart &&
        v.entryDate <= runPeriodEnd
    );
  }, [allVariables, employeeId, runPeriodStart, runPeriodEnd]);

  // Mutations
  const bulkUpsertMutation = trpc.variablePayInputs.bulkUpsert.useMutation({
    onSuccess: () => {
      toast.success('Variable enregistrée avec succès');
      refetch();
      onRefresh?.();
      setDialogOpen(false);
      setEditingVariable(null);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteMutation = trpc.variablePayInputs.delete.useMutation({
    onSuccess: () => {
      toast.success('Variable supprimée');
      refetch();
      onRefresh?.();
      setDeleteConfirmOpen(false);
      setVariableToDelete(null);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Handlers
  const handleAdd = () => {
    setEditingVariable(null);
    setDialogOpen(true);
  };

  const handleEdit = (variable: any) => {
    setEditingVariable(variable);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setVariableToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (variableToDelete) {
      deleteMutation.mutate({ id: variableToDelete });
    }
  };

  const handleSubmit = async (values: any) => {
    const input: any = {
      employeeId,
      componentCode: values.componentCode,
      amount: values.amount,
      entryDate: values.entryDate,
      notes: values.notes,
    };

    // Only include id when editing (not when creating)
    if (editingVariable?.id) {
      input.id = editingVariable.id;
    }

    await bulkUpsertMutation.mutateAsync({
      period,
      inputs: [input],
    });
  };

  // Format amount with color coding
  const formatAmount = (amount: number) => {
    const isNegative = amount < 0;
    return {
      value: new Intl.NumberFormat('fr-FR').format(Math.abs(amount)),
      color: isNegative ? 'text-destructive' : 'text-success',
      icon: isNegative ? TrendingDown : TrendingUp,
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period info */}
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          Variables avec une date d&apos;entrée entre le{' '}
          <strong>{format(parseISO(runPeriodStart), 'dd MMMM yyyy', { locale: fr })}</strong>
          {' '}et le{' '}
          <strong>{format(parseISO(runPeriodEnd), 'dd MMMM yyyy', { locale: fr })}</strong>
        </AlertDescription>
      </Alert>

      {/* Variables list */}
      {filteredVariables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Aucune variable pour cette période
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Ajoutez une prime, commission ou déduction pour cette paie
            </p>
            <Button onClick={handleAdd} size="lg" className="min-h-[48px]">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter variable
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filteredVariables.map((variable: any) => {
              const amountFormatted = formatAmount(Number(variable.amount));
              const AmountIcon = amountFormatted.icon;

              return (
                <Card key={variable.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Variable info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <AmountIcon className={`h-5 w-5 ${amountFormatted.color}`} />
                          <h4 className="font-semibold">
                            {variable.componentCode}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>Date: {format(parseISO(variable.entryDate), 'dd MMM yyyy', { locale: fr })}</span>
                          {variable.notes && (
                            <>
                              <span>•</span>
                              <span className="italic">{variable.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex flex-col items-end gap-2">
                        <div className={`text-xl font-bold ${amountFormatted.color}`}>
                          {Number(variable.amount) < 0 ? '-' : '+'}
                          {amountFormatted.value} FCFA
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(variable)}
                            className="min-h-[36px] min-w-[36px] p-2"
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(variable.id)}
                            className="min-h-[36px] min-w-[36px] p-2 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Add button */}
          <Button
            onClick={handleAdd}
            variant="outline"
            size="lg"
            className="w-full min-h-[48px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une autre variable
          </Button>
        </>
      )}

      {/* Add/Edit Dialog */}
      <VariablePayInputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        initialValues={editingVariable ? {
          componentCode: editingVariable.componentCode,
          amount: Number(editingVariable.amount),
          entryDate: editingVariable.entryDate,
          notes: editingVariable.notes || '',
        } : {
          entryDate: runPeriodStart, // Default to start of run period
        }}
        employeeName={employeeName}
        employeeNumber={employeeNumber}
        employeeId={employeeId}
        period={period}
        minDate={runPeriodStart} // Enforce run's date range
        maxDate={runPeriodEnd}   // Enforce run's date range
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette variable? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="min-h-[44px] bg-destructive hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
