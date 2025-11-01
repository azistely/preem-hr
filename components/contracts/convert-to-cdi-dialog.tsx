/**
 * Convert to CDI Dialog
 *
 * Dialog for converting a CDD contract to CDI:
 * - Confirms conversion date
 * - Shows impact summary
 * - Creates new CDI contract and closes CDD
 */

'use client';

import React from 'react';
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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Schema
// ============================================================================

const convertToCDISchema = z.object({
  conversionDate: z.date({
    required_error: 'La date de conversion est requise',
  }),
});

type ConvertToCDIFormValues = z.infer<typeof convertToCDISchema>;

// ============================================================================
// Types
// ============================================================================

interface ConvertToCDIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  employeeName: string;
  currentEndDate?: Date;
  onSuccess?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConvertToCDIDialog({
  open,
  onOpenChange,
  contractId,
  employeeName,
  currentEndDate,
  onSuccess,
}: ConvertToCDIDialogProps) {
  const { toast } = useToast();

  const utils = trpc.useUtils();

  const form = useForm<ConvertToCDIFormValues>({
    resolver: zodResolver(convertToCDISchema),
    defaultValues: {
      conversionDate: new Date(), // Default to today
    },
  });

  // Convert to CDI mutation
  const convertToCDI = trpc.compliance.convertToCDI.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Conversion réussie',
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

  const onSubmit = async (data: ConvertToCDIFormValues) => {
    await convertToCDI.mutateAsync({
      contractId,
      conversionDate: data.conversionDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Convertir en CDI</DialogTitle>
          <DialogDescription>
            Conversion du contrat CDD en Contrat à Durée Indéterminée
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Impact Summary */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Cette action va:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li>Clôturer le contrat CDD actuel</li>
                  <li>Créer un nouveau contrat CDI</li>
                  <li>Conserver l'ancienneté de l'employé</li>
                  <li>Fermer toutes les alertes de conformité CDD</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Employee Name */}
            <div className="rounded-lg border border-muted p-3">
              <p className="text-sm font-medium">Employé</p>
              <p className="text-lg font-semibold text-primary">{employeeName}</p>
            </div>

            {/* Current End Date */}
            {currentEndDate && (
              <div className="rounded-lg border border-muted p-3">
                <p className="text-sm font-medium">Date de fin CDD actuelle</p>
                <p className="text-sm text-muted-foreground">
                  {format(currentEndDate, 'dd MMMM yyyy', { locale: require('date-fns/locale').fr })}
                </p>
              </div>
            )}

            {/* Conversion Date */}
            <FormField
              control={form.control}
              name="conversionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de conversion</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        field.onChange(date);
                      }}
                      className="min-h-[48px]"
                      max={format(new Date(), 'yyyy-MM-dd')} // Can't be in the future
                    />
                  </FormControl>
                  <FormDescription>
                    Date effective de la conversion en CDI (généralement aujourd'hui ou la date de fin du CDD)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning */}
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cette action est irréversible. Assurez-vous que tous les documents sont prêts avant de continuer.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={convertToCDI.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={convertToCDI.isPending}
                className="min-h-[44px]"
              >
                {convertToCDI.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Convertir en CDI
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
