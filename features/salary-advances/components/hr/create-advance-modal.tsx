'use client';

/**
 * HR Create Advance Modal
 *
 * Allows HR to create salary advances for employees
 * HCI Principles: Employee search, validation, clear workflow
 */

import { useState, useEffect } from 'react';
import { trpc as api } from '@/lib/trpc/client';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Check,
  Info,
  AlertCircle,
  Search,
  User,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateAdvanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateAdvanceModal({ open, onOpenChange, onSuccess }: CreateAdvanceModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('3');
  const [requestReason, setRequestReason] = useState('');
  const [requestNotes, setRequestNotes] = useState('');

  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Get employees list (only when modal is open)
  // Note: Limited to 100 employees by backend validation
  const { data: employeesData } = api.employees.list.useQuery(
    {
      status: 'active',
      limit: 100,
    },
    {
      enabled: open, // Only fetch when modal is open
    }
  );

  // Get max allowed amount for selected employee
  const { data: maxData, isLoading: isLoadingMaxAmount } = api.salaryAdvances.getMaxAllowedAmount.useQuery(
    { employeeId: selectedEmployeeId! },
    { enabled: !!selectedEmployeeId }
  );

  // Get policy
  const { data: policy } = api.salaryAdvances.getPolicy.useQuery();

  // Quick validation
  const { data: validation } = api.salaryAdvances.quickValidate.useQuery(
    {
      employeeId: selectedEmployeeId!,
      requestedAmount: parseFloat(requestedAmount) || 0,
      repaymentMonths: parseInt(repaymentMonths) || 1,
    },
    {
      enabled: !!selectedEmployeeId && requestedAmount !== '' && parseFloat(requestedAmount) > 0,
    }
  );

  // Create advance mutation
  const createAdvance = api.salaryAdvances.create.useMutation({
    onSuccess: () => {
      // Invalidate all salary advances queries to refetch updated data
      utils.salaryAdvances.list.invalidate();
      utils.salaryAdvances.getPendingApprovals.invalidate();
      utils.salaryAdvances.getStatistics.invalidate();

      // Reset form
      setSelectedEmployeeId('');
      setRequestedAmount('');
      setRepaymentMonths('3');
      setRequestReason('');
      setRequestNotes('');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
  });

  const employees = employeesData?.employees ?? [];
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch) return true;
    const search = employeeSearch.toLowerCase();
    return (
      emp.firstName?.toLowerCase().includes(search) ||
      emp.lastName?.toLowerCase().includes(search) ||
      emp.employeeNumber?.toLowerCase().includes(search)
    );
  });

  const maxAmount = maxData?.maxAmount ?? 0;
  const amount = parseFloat(requestedAmount) || 0;

  const isAmountValid = amount > 0 && amount <= maxAmount && validation?.isValid !== false;
  const isReasonValid = requestReason.trim().length >= 10;
  const canSubmit = selectedEmployeeId && isAmountValid && isReasonValid && !createAdvance.isPending;

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setEmployeeSearch('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedEmployeeId) return;

    try {
      await createAdvance.mutateAsync({
        employeeId: selectedEmployeeId,
        requestedAmount: parseFloat(requestedAmount),
        repaymentMonths: parseInt(repaymentMonths),
        requestReason,
        requestNotes: requestNotes || undefined,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une avance pour un employé</DialogTitle>
          <DialogDescription>
            Sélectionnez un employé et saisissez les détails de l'avance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee-search">Employé *</Label>

            {/* Show selected employee */}
            {selectedEmployee ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-primary/10">
                <User className="h-4 w-4" />
                <span className="font-semibold flex-1">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </span>
                <Badge variant="outline">{selectedEmployee.employeeNumber}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEmployeeId('');
                    setEmployeeSearch('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="employee-search"
                    placeholder="Rechercher par nom ou matricule..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>

                {/* Filtered Results */}
                {employeeSearch && (
                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-[300px]">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          Aucun employé trouvé
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredEmployees.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(employee.id);
                                setEmployeeSearch('');
                              }}
                              className="w-full p-3 hover:bg-muted text-left flex items-center gap-2 transition-colors"
                            >
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium flex-1">
                                {employee.firstName} {employee.lastName}
                              </span>
                              <Badge variant="outline" className="flex-shrink-0">
                                {employee.employeeNumber}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {!employeeSearch && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Commencez à taper pour rechercher un employé...
                    </p>
                    {employees.length >= 100 && (
                      <p className="text-xs text-orange-600">
                        Note: Seuls les 100 premiers employés actifs sont affichés. Utilisez la recherche pour trouver un employé spécifique.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Loading state while checking eligibility */}
          {selectedEmployeeId && isLoadingMaxAmount && (
            <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Vérification de l'éligibilité...
              </span>
            </div>
          )}

          {/* Show max amount when employee selected and loaded */}
          {selectedEmployeeId && !isLoadingMaxAmount && maxAmount > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Montant maximum autorisé pour cet employé: {formatCurrency(maxAmount, 'FCFA')}
              </AlertDescription>
            </Alert>
          )}

          {/* Show not eligible message only after loading completes */}
          {selectedEmployeeId && !isLoadingMaxAmount && maxAmount === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cet employé n'est pas éligible pour une avance sur salaire.
              </AlertDescription>
            </Alert>
          )}

          {/* Amount - only show after loading and if eligible */}
          {selectedEmployeeId && !isLoadingMaxAmount && maxAmount > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Montant demandé (FCFA) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  max={maxAmount}
                  step="1000"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  className="h-12 text-lg"
                  placeholder="0"
                />
              </div>

              {/* Repayment Period */}
              <div className="space-y-2">
                <Label htmlFor="months">Période de remboursement *</Label>
                <Select value={repaymentMonths} onValueChange={setRepaymentMonths}>
                  <SelectTrigger id="months" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {policy?.allowedRepaymentMonths?.map((months) => (
                      <SelectItem key={months} value={months.toString()}>
                        {months} mois
                      </SelectItem>
                    )) ?? (
                      <>
                        <SelectItem value="1">1 mois</SelectItem>
                        <SelectItem value="2">2 mois</SelectItem>
                        <SelectItem value="3">3 mois</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Monthly deduction preview */}
              {amount > 0 && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Déduction mensuelle:</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(Math.ceil(amount / parseInt(repaymentMonths)), 'FCFA')}
                    </span>
                  </div>
                </div>
              )}

              {/* Validation feedback */}
              {amount > 0 && amount > maxAmount && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Le montant dépasse le maximum autorisé de {formatCurrency(maxAmount, 'FCFA')}
                  </AlertDescription>
                </Alert>
              )}

              {validation && !validation.isValid && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validation.message || 'Montant non valide'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Raison de la demande *</Label>
                <Textarea
                  id="reason"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Ex: Urgence médicale, frais scolaires, etc."
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {requestReason.length}/500 caractères (minimum 10)
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes additionnelles (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Informations supplémentaires..."
                  className="min-h-[80px]"
                  maxLength={1000}
                />
              </div>

              {createAdvance.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {createAdvance.error?.message ?? 'Erreur lors de la création de la demande'}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAdvance.isPending}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {createAdvance.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Créer la demande
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
