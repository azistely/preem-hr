/**
 * Terminate Contract Dialog
 *
 * Dialog for terminating a contract with proper documentation:
 * - Termination reason
 * - Effective termination date
 * - Notes for records
 * - Updates employee status
 */

'use client';

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
import { Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

// ============================================================================
// Schema
// ============================================================================

const terminateContractSchema = z.object({
  terminationDate: z.date({
    required_error: 'La date de résiliation est requise',
  }),
  terminationReason: z.enum(
    [
      'resignation',
      'dismissal',
      'mutual_agreement',
      'end_of_term',
      'retirement',
      'other',
    ],
    {
      required_error: 'Le motif de résiliation est requis',
    }
  ),
  notes: z.string().optional(),
});

type TerminateContractFormValues = z.infer<typeof terminateContractSchema>;

// ============================================================================
// Types
// ============================================================================

interface TerminateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  employeeName: string;
  contractType: string;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TerminateContractDialog({
  open,
  onOpenChange,
  contractId,
  employeeName,
  contractType,
  onSuccess,
}: TerminateContractDialogProps) {
  const utils = api.useUtils();

  const form = useForm<TerminateContractFormValues>({
    resolver: zodResolver(terminateContractSchema),
    defaultValues: {
      terminationDate: new Date(),
      terminationReason: 'end_of_term',
      notes: '',
    },
  });

  // Terminate contract mutation
  const terminateContract = api.contracts.terminateContract.useMutation({
    onSuccess: () => {
      toast.success('Contrat résilié avec succès');
      utils.contracts.getAllContracts.invalidate();
      utils.contracts.getContractStats.invalidate();
      utils.compliance.getActiveAlerts.invalidate();
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: TerminateContractFormValues) => {
    await terminateContract.mutateAsync({
      contractId,
      terminationDate: data.terminationDate.toISOString(),
      terminationReason: data.terminationReason,
    });
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      resignation: 'Démission',
      dismissal: 'Licenciement',
      mutual_agreement: 'Rupture conventionnelle',
      end_of_term: 'Fin de contrat (terme échu)',
      retirement: 'Départ à la retraite',
      other: 'Autre motif',
    };
    return labels[reason] || reason;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Résilier le contrat</DialogTitle>
          <DialogDescription>
            Terminer le contrat de travail de manière définitive
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Warning */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Action irréversible</AlertTitle>
              <AlertDescription>
                Cette action va terminer définitivement le contrat. Assurez-vous que tous les
                documents de fin de contrat sont prêts.
              </AlertDescription>
            </Alert>

            {/* Employee Info */}
            <div className="rounded-lg border border-muted p-3 space-y-1">
              <p className="text-sm font-medium">Employé</p>
              <p className="text-lg font-semibold text-primary">{employeeName}</p>
              <p className="text-sm text-muted-foreground">Type: {contractType}</p>
            </div>

            {/* Termination Date */}
            <FormField
              control={form.control}
              name="terminationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de résiliation</FormLabel>
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
                    Date effective de fin du contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Termination Reason */}
            <FormField
              control={form.control}
              name="terminationReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motif de résiliation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionner un motif" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="end_of_term">Fin de contrat (terme échu)</SelectItem>
                      <SelectItem value="resignation">Démission</SelectItem>
                      <SelectItem value="dismissal">Licenciement</SelectItem>
                      <SelectItem value="mutual_agreement">Rupture conventionnelle</SelectItem>
                      <SelectItem value="retirement">Départ à la retraite</SelectItem>
                      <SelectItem value="other">Autre motif</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Raison légale de la fin du contrat
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
                      placeholder="Informations complémentaires sur la résiliation..."
                      className="min-h-[100px]"
                      maxLength={1000}
                    />
                  </FormControl>
                  <FormDescription>
                    Détails additionnels pour les archives
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Impact Summary */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cette action va:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li>Marquer le contrat comme terminé</li>
                  <li>Mettre à jour le statut de l'employé</li>
                  <li>Fermer toutes les alertes liées à ce contrat</li>
                  <li>Archiver les documents du contrat</li>
                </ul>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={terminateContract.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={terminateContract.isPending}
                className="min-h-[44px]"
              >
                {terminateContract.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Résilier le contrat
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
