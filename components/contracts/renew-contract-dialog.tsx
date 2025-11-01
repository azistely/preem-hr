/**
 * Renew Contract Dialog
 *
 * Dialog for renewing a CDD contract with validation:
 * - Checks renewal limits (max 2 renewals)
 * - Validates total duration (max 24 months)
 * - Requires renewal reason
 */

'use client';

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Schema
// ============================================================================

const renewContractSchema = z.object({
  newEndDate: z.date({
    required_error: 'La nouvelle date de fin est requise',
  }),
  renewalReason: z
    .string()
    .min(10, 'Le motif doit contenir au moins 10 caractères')
    .max(500, 'Le motif ne peut pas dépasser 500 caractères'),
});

type RenewContractFormValues = z.infer<typeof renewContractSchema>;

// ============================================================================
// Types
// ============================================================================

interface RenewContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  currentEndDate: Date;
  renewalCount: number;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function RenewContractDialog({
  open,
  onOpenChange,
  contractId,
  currentEndDate,
  renewalCount,
  onSuccess,
}: RenewContractDialogProps) {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const form = useForm<RenewContractFormValues>({
    resolver: zodResolver(renewContractSchema),
    defaultValues: {
      newEndDate: addMonths(currentEndDate, 6), // Default to 6 months extension
      renewalReason: '',
    },
  });

  // Validate renewal
  const validateRenewal = trpc.compliance.validateRenewal.useQuery(
    {
      contractId,
      newEndDate: form.watch('newEndDate'),
    },
    {
      enabled: false, // Manual trigger
    }
  );

  // Renew contract mutation
  const renewContract = trpc.compliance.renewContract.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Contrat renouvelé',
        description: data.message,
      });
      utils.employees.getById.invalidate();
      utils.compliance.checkCDDCompliance.invalidate();
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

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await validateRenewal.refetch();
      if (result.data && !result.data.allowed) {
        setValidationError(result.data.reason || 'Renouvellement non autorisé');
      } else {
        setValidationError(null);
      }
    } catch (error) {
      setValidationError('Erreur lors de la validation');
    } finally {
      setIsValidating(false);
    }
  };

  const onSubmit = async (data: RenewContractFormValues) => {
    // Validate first
    await handleValidate();

    if (validationError) {
      return;
    }

    // Submit renewal
    await renewContract.mutateAsync({
      contractId,
      newEndDate: data.newEndDate,
      renewalReason: data.renewalReason,
    });
  };

  const newEndDate = form.watch('newEndDate');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Renouveler le contrat CDD</DialogTitle>
          <DialogDescription>
            Renouvellement {renewalCount + 1} sur 2 maximum autorisé par la loi
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current Status */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Date de fin actuelle:</strong>{' '}
                {format(currentEndDate, 'dd MMMM yyyy', { locale: require('date-fns/locale').fr })}
              </AlertDescription>
            </Alert>

            {/* New End Date */}
            <FormField
              control={form.control}
              name="newEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouvelle date de fin</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                        setValidationError(null); // Reset validation on change
                      }}
                      className="min-h-[48px]"
                      min={format(addMonths(currentEndDate, 1), 'yyyy-MM-dd')} // At least 1 month extension
                    />
                  </FormControl>
                  <FormDescription>
                    La durée totale du CDD ne peut pas dépasser 24 mois (renouvellements compris)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Renewal Reason */}
            <FormField
              control={form.control}
              name="renewalReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motif du renouvellement</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Ex: Prolongation nécessaire pour achever le projet en cours..."
                      className="min-h-[100px]"
                      maxLength={500}
                    />
                  </FormControl>
                  <FormDescription>
                    Justification du renouvellement (obligatoire, minimum 10 caractères)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Validation Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={handleValidate}
              disabled={isValidating || !newEndDate}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Vérifier la conformité
            </Button>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={renewContract.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={renewContract.isPending || !!validationError}
                className="min-h-[44px]"
              >
                {renewContract.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Renouveler
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
