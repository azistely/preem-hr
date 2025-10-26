/**
 * Variable Pay Inputs Table Component
 *
 * Editable table for bulk entry of variable component values.
 * Features:
 * - Editable cells with auto-save on blur
 * - Validation (non-negative numbers)
 * - Loading states
 * - Mobile-responsive
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { VariablePayInputWithEmployee } from '@/features/payroll/services/variable-pay-inputs.service';

interface VariablePayInputsTableProps {
  period: string;
  data: VariablePayInputWithEmployee[];
  isLoading: boolean;
  onDataChange: () => void;
}

interface EditingCell {
  id: string;
  field: 'amount' | 'notes';
  value: string;
}

export function VariablePayInputsTable({
  period,
  data,
  isLoading,
  onDataChange,
}: VariablePayInputsTableProps) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk upsert mutation
  const bulkUpsertMutation = trpc.variablePayInputs.bulkUpsert.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Enregistré',
        description: `${result.count} ${result.count === 1 ? 'entrée enregistrée' : 'entrées enregistrées'}`,
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
        description: 'Entrée supprimée avec succès',
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

  // Handle cell edit start
  const handleCellClick = (id: string, field: 'amount' | 'notes', currentValue: string) => {
    setEditingCell({ id, field, value: currentValue });
  };

  // Handle cell value change
  const handleCellChange = (value: string) => {
    if (editingCell) {
      setEditingCell({ ...editingCell, value });
    }
  };

  // Handle cell blur (save)
  const handleCellBlur = () => {
    if (!editingCell) return;

    const input = data.find((item) => item.id === editingCell.id);
    if (!input) {
      setEditingCell(null);
      return;
    }

    // Validate amount
    if (editingCell.field === 'amount') {
      const amount = parseFloat(editingCell.value);
      if (isNaN(amount) || amount < 0) {
        toast({
          title: 'Valeur invalide',
          description: 'Le montant doit être un nombre positif ou zéro',
          variant: 'destructive',
        });
        setEditingCell(null);
        return;
      }

      // Save if changed
      if (amount !== parseFloat(input.amount)) {
        bulkUpsertMutation.mutate({
          period,
          inputs: [{
            employeeId: input.employeeId,
            componentCode: input.componentCode,
            entryDate: input.entryDate, // Include entry date
            amount,
            notes: input.notes ?? undefined,
          }],
        });
      }
    } else {
      // Save notes if changed
      if (editingCell.value !== (input.notes ?? '')) {
        bulkUpsertMutation.mutate({
          period,
          inputs: [{
            employeeId: input.employeeId,
            componentCode: input.componentCode,
            entryDate: input.entryDate, // Include entry date
            amount: parseFloat(input.amount),
            notes: editingCell.value || undefined,
          }],
        });
      }
    }

    setEditingCell(null);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      deleteMutation.mutate({ id });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Save className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucune donnée pour cette période</h3>
          <p className="text-muted-foreground mb-4">
            Utilisez "Copier du mois précédent" pour commencer, ou configurez les composants variables pour vos employés.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Employé</TableHead>
              <TableHead className="min-w-[150px]">Composant</TableHead>
              <TableHead className="min-w-[120px]">Date</TableHead>
              <TableHead className="min-w-[150px] text-right">Montant (FCFA)</TableHead>
              <TableHead className="min-w-[200px]">Notes</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((input) => (
              <TableRow key={input.id}>
                {/* Employee */}
                <TableCell className="font-medium">
                  <div>
                    <div>{input.employeeName}</div>
                    <div className="text-xs text-muted-foreground">#{input.employeeNumber}</div>
                  </div>
                </TableCell>

                {/* Component */}
                <TableCell>
                  <Badge variant="outline">{input.componentCode}</Badge>
                </TableCell>

                {/* Date */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(input.entryDate).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </span>
                </TableCell>

                {/* Amount (editable) */}
                <TableCell className="text-right">
                  {editingCell?.id === input.id && editingCell?.field === 'amount' ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingCell.value}
                      onChange={(e) => handleCellChange(e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCellBlur();
                        } else if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                      autoFocus
                      className="text-right min-h-[40px]"
                    />
                  ) : (
                    <button
                      onClick={() => handleCellClick(input.id, 'amount', input.amount)}
                      className="w-full text-right hover:bg-muted px-3 py-2 rounded min-h-[40px] transition-colors"
                    >
                      {parseFloat(input.amount).toLocaleString('fr-FR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </button>
                  )}
                </TableCell>

                {/* Notes (editable) */}
                <TableCell>
                  {editingCell?.id === input.id && editingCell?.field === 'notes' ? (
                    <Input
                      type="text"
                      value={editingCell.value}
                      onChange={(e) => handleCellChange(e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCellBlur();
                        } else if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                      autoFocus
                      className="min-h-[40px]"
                    />
                  ) : (
                    <button
                      onClick={() => handleCellClick(input.id, 'notes', input.notes ?? '')}
                      className="w-full text-left hover:bg-muted px-3 py-2 rounded min-h-[40px] transition-colors text-sm text-muted-foreground"
                    >
                      {input.notes || 'Ajouter une note...'}
                    </button>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(input.id)}
                    disabled={deleteMutation.isPending}
                    className="min-h-[40px] min-w-[40px]"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Save indicator */}
      {bulkUpsertMutation.isPending && (
        <div className="p-4 border-t bg-muted/50 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Enregistrement en cours...</span>
        </div>
      )}
    </Card>
  );
}
