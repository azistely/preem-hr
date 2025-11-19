/**
 * Create Contract Dialog
 *
 * Wizard-style dialog for creating new contracts with smart defaults:
 * - Contract type selection
 * - Date configuration based on type
 * - Required fields only
 * - Validation for compliance
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

// ============================================================================
// Schema
// ============================================================================

const createContractSchema = z
  .object({
    employeeId: z.string().uuid('Veuillez sélectionner un employé'),
    contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM'], {
      required_error: 'Le type de contrat est requis',
    }),
    contractNumber: z.string().optional(),
    startDate: z.date({
      required_error: 'La date de début est requise',
    }),
    endDate: z.date().optional(),
    cddReason: z.string().optional(),
    cddtiTaskDescription: z.string().optional(),
    signedDate: z.date().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      // CDD and CDDTI must have end date
      if ((data.contractType === 'CDD' || data.contractType === 'CDDTI' || data.contractType === 'STAGE') && !data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: 'La date de fin est requise pour les CDD, CDDTI et STAGE',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // End date must be after start date
      if (data.endDate && data.startDate && data.endDate <= data.startDate) {
        return false;
      }
      return true;
    },
    {
      message: 'La date de fin doit être postérieure à la date de début',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // CDD must have reason
      if (data.contractType === 'CDD' && (!data.cddReason || data.cddReason.trim().length < 10)) {
        return false;
      }
      return true;
    },
    {
      message: 'Le motif du CDD est requis (minimum 10 caractères)',
      path: ['cddReason'],
    }
  )
  .refine(
    (data) => {
      // CDDTI must have task description
      if (data.contractType === 'CDDTI' && (!data.cddtiTaskDescription || data.cddtiTaskDescription.trim().length < 10)) {
        return false;
      }
      return true;
    },
    {
      message: 'La description de la mission CDDTI est requise (minimum 10 caractères)',
      path: ['cddtiTaskDescription'],
    }
  );

type CreateContractFormValues = z.infer<typeof createContractSchema>;

// ============================================================================
// Types
// ============================================================================

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateContractDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const utils = api.useUtils();

  // Search employees
  const { data: employees } = api.employees.list.useQuery(
    {
      search: searchQuery,
      status: 'active',
      limit: 20,
    },
    {
      enabled: open, // Only load when dialog is open
    }
  );

  const form = useForm<CreateContractFormValues>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      contractType: 'CDI',
      startDate: new Date(),
      contractNumber: '',
      notes: '',
    },
  });

  const contractType = form.watch('contractType');
  const startDate = form.watch('startDate');

  // Auto-set end date based on contract type
  const handleContractTypeChange = (type: string) => {
    form.setValue('contractType', type as any);

    if (type === 'CDD') {
      // Default 6 months for CDD
      if (startDate) {
        form.setValue('endDate', addMonths(startDate, 6));
      }
    } else if (type === 'CDDTI') {
      // Default 12 months for CDDTI (max allowed)
      if (startDate) {
        form.setValue('endDate', addMonths(startDate, 12));
      }
    } else if (type === 'STAGE') {
      // Default 3 months for internship
      if (startDate) {
        form.setValue('endDate', addMonths(startDate, 3));
      }
    } else if (type === 'INTERIM') {
      // Default 1 month for temporary work
      if (startDate) {
        form.setValue('endDate', addMonths(startDate, 1));
      }
    } else {
      // CDI has no end date
      form.setValue('endDate', undefined);
    }
  };

  // Create contract mutation
  const createContract = api.contracts.createContract.useMutation({
    onSuccess: (data) => {
      toast.success('Contrat créé avec succès');
      utils.contracts.getAllContracts.invalidate();
      utils.contracts.getContractStats.invalidate();
      onOpenChange(false);
      form.reset();
      setSelectedEmployeeId('');
      setSearchQuery('');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: CreateContractFormValues) => {
    // Convert dates to ISO strings for API
    await createContract.mutateAsync({
      ...data,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate?.toISOString(),
      signedDate: data.signedDate?.toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau contrat</DialogTitle>
          <DialogDescription>
            Créer un nouveau contrat de travail pour un employé
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Employee Selection */}
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employé</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionner un employé" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees?.employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} - {emp.employeeNumber || 'Sans N°'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    L'employé pour lequel créer le contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contract Type */}
            <FormField
              control={form.control}
              name="contractType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de contrat</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={handleContractTypeChange}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Type de contrat" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CDI">CDI - Contrat à Durée Indéterminée</SelectItem>
                      <SelectItem value="CDD">CDD - Contrat à Durée Déterminée</SelectItem>
                      <SelectItem value="CDDTI">CDDTI - CDD pour Tâche Identifiée</SelectItem>
                      <SelectItem value="STAGE">Stage</SelectItem>
                      <SelectItem value="INTERIM">Intérim</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contract Number */}
            <FormField
              control={form.control}
              name="contractNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de contrat (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CTR-2025-001"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro unique d'identification du contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de début</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                      }}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Date de prise d'effet du contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date (for CDD, CDDTI, STAGE, INTERIM) */}
            {contractType !== 'CDI' && (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          field.onChange(date);
                        }}
                        className="min-h-[48px]"
                        min={startDate ? format(addMonths(startDate, 1), 'yyyy-MM-dd') : undefined}
                      />
                    </FormControl>
                    <FormDescription>
                      {contractType === 'CDDTI' && 'Maximum 12 mois pour un CDDTI'}
                      {contractType === 'CDD' && 'Maximum 24 mois (renouvellements compris)'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* CDD Reason */}
            {contractType === 'CDD' && (
              <FormField
                control={form.control}
                name="cddReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motif du CDD</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Ex: Remplacement pour congé maternité, Accroissement temporaire d'activité..."
                        className="min-h-[100px]"
                        maxLength={500}
                      />
                    </FormControl>
                    <FormDescription>
                      Justification légale du recours au CDD (obligatoire, minimum 10 caractères)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* CDDTI Task Description */}
            {contractType === 'CDDTI' && (
              <FormField
                control={form.control}
                name="cddtiTaskDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description de la mission</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Ex: Construction du bâtiment principal de l'école, développement du module de paie..."
                        className="min-h-[100px]"
                        maxLength={500}
                      />
                    </FormControl>
                    <FormDescription>
                      Tâche précise et identifiable pour laquelle le CDDTI est conclu (obligatoire)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Signed Date */}
            <FormField
              control={form.control}
              name="signedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de signature (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                      }}
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Date à laquelle le contrat a été signé
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Informations complémentaires..."
                      className="min-h-[80px]"
                      maxLength={1000}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setSelectedEmployeeId('');
                }}
                disabled={createContract.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createContract.isPending}
                className="min-h-[56px]"
              >
                {createContract.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Créer le contrat
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
