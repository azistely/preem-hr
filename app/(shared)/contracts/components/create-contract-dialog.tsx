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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Calendar, AlertTriangle, ExternalLink, RefreshCw, CloudOff, Info } from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { useResilientMutation } from '@/hooks/use-resilient-mutation';
import { useFormAutoSave } from '@/hooks/use-form-auto-save';
import { ConnectionStatus } from '@/components/ui/connection-status';
import Link from 'next/link';

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
      // CDD, STAGE, and INTERIM must have end date (CDDTI has no end date - task-based)
      if (['CDD', 'STAGE', 'INTERIM'].includes(data.contractType) && !data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: 'La date de fin est requise pour ce type de contrat',
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

  // Auto-save form data to localStorage
  const { clearSavedData } = useFormAutoSave({
    storageKey: 'contract_dialog_create',
    form,
    debounceMs: 1500,
    enabled: open, // Only save when dialog is open
    onRestore: (data) => {
      if (Object.keys(data).length > 0) {
        toast.info('Brouillon restauré', {
          description: 'Vos données ont été récupérées automatiquement.',
          icon: <CloudOff className="h-4 w-4" />,
        });
        // Restore selected employee ID for active contract check
        if (data.employeeId) {
          setSelectedEmployeeId(data.employeeId);
        }
      }
    },
  });

  const contractType = form.watch('contractType');
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  // Check for contract date overlap when employee + dates are set
  const { data: overlapCheck, isLoading: checkingOverlap } =
    api.contracts.checkContractOverlap.useQuery(
      {
        employeeId: selectedEmployeeId,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      },
      {
        enabled: !!selectedEmployeeId && !!startDate,
      }
    );

  // Determine if form submission should be blocked (only overlapping dates)
  const hasOverlap = overlapCheck?.hasOverlap;
  const overlappingContract = overlapCheck?.overlappingContract;
  const precedingContract = overlapCheck?.precedingContract;

  // Auto-set end date based on contract type
  const handleContractTypeChange = (type: string) => {
    form.setValue('contractType', type as any);

    if (type === 'CDD') {
      // Default 6 months for CDD
      if (startDate) {
        form.setValue('endDate', addMonths(startDate, 6));
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
      // CDI and CDDTI have no end date (CDDTI ends when task completes)
      form.setValue('endDate', undefined);
    }
  };

  // Create contract mutation with resilience
  const createContractMutation = api.contracts.createContract.useMutation();

  const resilientCreate = useResilientMutation({
    mutation: createContractMutation,
    successMessage: 'Contrat créé avec succès',
    errorMessage: 'Erreur lors de la création du contrat',
    onSuccess: () => {
      // Clear auto-saved data on successful creation
      clearSavedData();
      utils.contracts.getAllContracts.invalidate();
      utils.contracts.getContractStats.invalidate();
      onOpenChange(false);
      form.reset();
      setSelectedEmployeeId('');
      setSearchQuery('');
      onSuccess?.();
    },
  });

  const onSubmit = async (data: CreateContractFormValues) => {
    // Block if dates overlap with existing contract
    if (hasOverlap) {
      toast.error('Les dates chevauchent un contrat existant');
      return;
    }

    // Convert dates to ISO strings for API
    await resilientCreate.mutate({
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
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedEmployeeId(value);
                    }}
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
                    L&apos;employé pour lequel créer le contrat
                  </FormDescription>
                  <FormMessage />

                  {/* Contract Overlap Check */}
                  {checkingOverlap && selectedEmployeeId && startDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vérification des contrats existants...
                    </div>
                  )}

                  {/* Date Overlap Warning (blocks submission) */}
                  {hasOverlap && overlappingContract && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Chevauchement de dates</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>
                          Les dates chevauchent un contrat {overlappingContract.contractType} actif
                          du {overlappingContract.startDate}
                          {overlappingContract.endDate ? ` jusqu'au ${overlappingContract.endDate}` : ' (durée indéterminée)'}.
                        </p>
                        <p>
                          Modifiez les dates ou résiliez le contrat existant.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                            className="min-h-[44px]"
                          >
                            <Link href={`/contracts/${overlappingContract.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Voir le contrat
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            asChild
                            className="min-h-[44px]"
                          >
                            <Link href={`/employees/${selectedEmployeeId}/terminate`}>
                              Résilier le contrat
                            </Link>
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Future Contract Info (allowed, just informational) */}
                  {!hasOverlap && precedingContract && (
                    <Alert className="mt-4 border-blue-200 bg-blue-50 text-blue-800">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Contrat futur</AlertTitle>
                      <AlertDescription>
                        Ce contrat commencera après la fin du contrat actuel ({precedingContract.contractType} jusqu&apos;au {precedingContract.endDate}).
                      </AlertDescription>
                    </Alert>
                  )}
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

            {/* End Date (for CDD, STAGE, INTERIM only - CDDTI has no end date) */}
            {['CDD', 'STAGE', 'INTERIM'].includes(contractType) && (
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
                      {contractType === 'CDD' && 'Maximum 24 mois (renouvellements compris)'}
                      {contractType === 'STAGE' && 'Durée maximale selon la convention'}
                      {contractType === 'INTERIM' && 'Durée de la mission'}
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

            {/* Connection Status */}
            <ConnectionStatus
              isOnline={resilientCreate.isOnline}
              isRetrying={resilientCreate.isRetrying}
              retryCount={resilientCreate.retryCount}
              maxRetries={3}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {/* Retry button (shown when can retry) */}
              {resilientCreate.canRetry && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resilientCreate.retry}
                  className="min-h-[44px]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Note: We don't clear auto-saved data on cancel,
                  // so user can recover if they accidentally closed
                  onOpenChange(false);
                  form.reset();
                  setSelectedEmployeeId('');
                }}
                disabled={resilientCreate.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={resilientCreate.isPending || !resilientCreate.isOnline || hasOverlap}
                className="min-h-[56px]"
              >
                {resilientCreate.isPending && !resilientCreate.isRetrying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : resilientCreate.isRetrying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {resilientCreate.isRetrying ? 'Nouvelle tentative...' : 'Créer le contrat'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
