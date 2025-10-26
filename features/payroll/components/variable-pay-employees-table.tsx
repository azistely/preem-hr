/**
 * Variable Pay Employees Table Component
 *
 * Table showing all employees with their variable pay inputs.
 * Allows adding, editing, and deleting variable components.
 *
 * Features:
 * - Shows all active employees (even if no inputs)
 * - Add button for each employee
 * - Edit/delete buttons for each variable component
 * - Badge display for existing components
 * - Total calculation per employee
 * - Mobile-responsive
 *
 * HCI Principles:
 * - Large touch targets (min-h-[44px])
 * - Clear visual feedback
 * - Task-oriented design
 * - Progressive disclosure (collapse details)
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
import { Loader2, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VariablePayInputDialog } from './variable-pay-input-dialog';
import type { EmployeeWithVariableInputs } from '@/features/payroll/services/variable-pay-inputs.service';

interface VariablePayEmployeesTableProps {
  period: string;
  data: EmployeeWithVariableInputs[];
  isLoading: boolean;
  onDataChange: () => void;
}

interface DialogState {
  open: boolean;
  employeeId: string | null;
  employeeName: string;
  employeeNumber: string;
  inputId?: string | null;
  componentCode?: string;
  amount?: number;
  notes?: string | null;
}

export function VariablePayEmployeesTable({
  period,
  data,
  isLoading,
  onDataChange,
}: VariablePayEmployeesTableProps) {
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    employeeId: null,
    employeeName: '',
    employeeNumber: '',
  });

  // Bulk upsert mutation
  const bulkUpsertMutation = trpc.variablePayInputs.bulkUpsert.useMutation({
    onSuccess: () => {
      toast({
        title: 'Enregistré',
        description: 'Prime variable enregistrée avec succès',
      });
      onDataChange();
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
  const deleteMutation = trpc.variablePayInputs.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Supprimé',
        description: 'Prime variable supprimée avec succès',
      });
      onDataChange();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Open dialog for adding new input
  const handleAddClick = (employee: EmployeeWithVariableInputs) => {
    setDialogState({
      open: true,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      employeeNumber: employee.employeeNumber,
      inputId: null,
      componentCode: undefined,
      amount: undefined,
      notes: undefined,
    });
  };

  // Open dialog for editing existing input
  const handleEditClick = (
    employee: EmployeeWithVariableInputs,
    input: EmployeeWithVariableInputs['inputs'][0]
  ) => {
    setDialogState({
      open: true,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      employeeNumber: employee.employeeNumber,
      inputId: input.id,
      componentCode: input.componentCode,
      amount: input.amount,
      notes: input.notes ?? undefined,
    });
  };

  // Handle dialog submit
  const handleDialogSubmit = async (values: {
    componentCode: string;
    amount: number;
    entryDate?: string;
    notes?: string;
  }) => {
    if (!dialogState.employeeId) return;

    await bulkUpsertMutation.mutateAsync({
      period,
      inputs: [{
        employeeId: dialogState.employeeId,
        componentCode: values.componentCode,
        entryDate: values.entryDate || period, // Default to period start if not provided
        amount: values.amount,
        notes: values.notes,
      }],
    });
  };

  // Handle delete
  const handleDelete = (inputId: string, componentCode: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la prime "${componentCode}" ?`)) {
      deleteMutation.mutate({ id: inputId });
    }
  };

  // Calculate total for an employee
  const calculateTotal = (inputs: EmployeeWithVariableInputs['inputs']) => {
    return inputs.reduce((sum, input) => sum + input.amount, 0);
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Chargement des employés...</p>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucun employé actif</h3>
          <p className="text-muted-foreground">
            Ajoutez des employés pour commencer à saisir les primes variables.
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
                <TableHead className="min-w-[300px]">Primes variables</TableHead>
                <TableHead className="min-w-[150px] text-right">Total (FCFA)</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((employee) => {
                const total = calculateTotal(employee.inputs);
                const hasInputs = employee.inputs.length > 0;

                return (
                  <TableRow key={employee.employeeId}>
                    {/* Employee */}
                    <TableCell className="font-medium">
                      <div>
                        <div>{employee.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          #{employee.employeeNumber}
                        </div>
                      </div>
                    </TableCell>

                    {/* Variable Components */}
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {employee.inputs.map((input) => {
                          // Format date for display (DD/MM/YYYY)
                          const entryDate = new Date(input.entryDate);
                          const formattedDate = entryDate.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          });

                          return (
                            <div
                              key={input.id}
                              className="flex items-center gap-1 bg-muted rounded-md px-2 py-1"
                            >
                              <Badge variant="outline" className="text-xs">
                                {input.componentCode}
                              </Badge>
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">
                                  {input.amount.toLocaleString('fr-FR')} F
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formattedDate}
                                </span>
                              </div>
                              <div className="flex gap-1 ml-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditClick(employee, input)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(input.id, input.componentCode)}
                                  disabled={deleteMutation.isPending}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!hasInputs && (
                          <span className="text-sm text-muted-foreground italic">
                            Aucune prime
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right">
                      {hasInputs ? (
                        <span className="text-lg font-semibold">
                          {total.toLocaleString('fr-FR')}
                        </span>
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
      {dialogState.employeeId && (
        <VariablePayInputDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState({ ...dialogState, open })}
          onSubmit={handleDialogSubmit}
          employeeName={dialogState.employeeName}
          employeeNumber={dialogState.employeeNumber}
          employeeId={dialogState.employeeId}
          period={period}
          initialValues={
            dialogState.inputId
              ? {
                  componentCode: dialogState.componentCode,
                  amount: dialogState.amount,
                  notes: dialogState.notes ?? undefined,
                }
              : undefined
          }
        />
      )}
    </>
  );
}
