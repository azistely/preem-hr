/**
 * Bulk Salary Update Dialog
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Dialog for batch salary updates with preview
 * Design: Progressive disclosure, error prevention, mobile-friendly
 */

'use client';

import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface BulkSalaryUpdateDialogProps {
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkSalaryUpdateDialog({
  employees,
  open,
  onOpenChange,
  onSuccess,
}: BulkSalaryUpdateDialogProps) {
  const [updateType, setUpdateType] = useState<'absolute' | 'percentage'>('percentage');
  const [value, setValue] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<Date>(addMonths(new Date(), 1));
  const [reason, setReason] = useState<string>('');

  const utils = api.useUtils();

  // Create batch operation mutation
  const createBatchMutation = api.batchOperations.updateSalaries.useMutation({
    onSuccess: () => {
      toast.success('Opération groupée créée avec succès');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
      utils.batchOperations.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'opération groupée');
    },
  });

  const resetForm = () => {
    setUpdateType('percentage');
    setValue('');
    setEffectiveDate(addMonths(new Date(), 1));
    setReason('');
  };

  const handleSubmit = () => {
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue <= 0) {
      toast.error('Veuillez entrer une valeur valide');
      return;
    }

    if (updateType === 'percentage' && numValue > 100) {
      toast.error('Le pourcentage ne peut pas dépasser 100%');
      return;
    }

    createBatchMutation.mutate({
      employeeIds: employees.map((e) => e.id),
      updateType,
      value: numValue,
      effectiveDate,
      reason: reason || undefined,
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Modifier les salaires
          </DialogTitle>
          <DialogDescription>
            {employees.length} employé{employees.length > 1 ? 's' : ''} sélectionné
            {employees.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Update Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Type de modification</Label>
            <RadioGroup value={updateType} onValueChange={(v) => setUpdateType(v as any)}>
              <div className="flex items-center space-x-2 rounded-lg border p-4 min-h-[56px]">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Augmentation en pourcentage</p>
                    <p className="text-sm text-muted-foreground">
                      Ex: 10% d'augmentation pour tous
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-4 min-h-[56px]">
                <RadioGroupItem value="absolute" id="absolute" />
                <Label htmlFor="absolute" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Définir un salaire fixe</p>
                    <p className="text-sm text-muted-foreground">
                      Même salaire pour tous les employés sélectionnés
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label htmlFor="value" className="text-base font-medium">
              {updateType === 'percentage' ? 'Pourcentage d\'augmentation' : 'Nouveau salaire'}
            </Label>
            <div className="relative">
              <Input
                id="value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={updateType === 'percentage' ? 'Ex: 10' : 'Ex: 300000'}
                className="min-h-[48px] text-lg pr-16"
                min="0"
                step={updateType === 'percentage' ? '0.1' : '1000'}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {updateType === 'percentage' ? '%' : 'FCFA'}
              </div>
            </div>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Date d'effet</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal min-h-[48px]',
                    !effectiveDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {effectiveDate ? (
                    format(effectiveDate, 'dd MMMM yyyy', { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={effectiveDate}
                  onSelect={(date) => date && setEffectiveDate(date)}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground">
              Les nouveaux salaires prendront effet à partir de cette date
            </p>
          </div>

          {/* Optional Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-medium">
              Raison (optionnel)
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Augmentation annuelle 2025"
              className="min-h-[48px]"
            />
          </div>

          {/* Preview (Basic - shows employee list) */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Employés concernés</Label>
            <div className="border rounded-lg max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">
                        {emp.firstName} {emp.lastName}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {updateType === 'percentage' ? (
                          <span className="flex items-center justify-end gap-1">
                            <TrendingUp className="h-3 w-3" />
                            +{value}%
                          </span>
                        ) : (
                          <span>
                            → {formatCurrency(parseFloat(value) || 0)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBatchMutation.isPending}
            className="min-h-[44px]"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!value || createBatchMutation.isPending}
            className="min-h-[44px]"
          >
            {createBatchMutation.isPending
              ? 'Création en cours...'
              : 'Appliquer les changements'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
