/**
 * Edit Contract Dialog Component
 *
 * Allows editing key contract fields inline from employee edit form.
 * Follows HCI principles: simple form with only editable fields shown.
 */

'use client';

import { useState, useEffect } from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calendar as CalendarIcon, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types & Schema
// ============================================================================

interface EditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: {
    id: string;
    contractType: string;
    contractNumber?: string | null;
    startDate: string | Date;
    endDate?: string | Date | null;
    cddReason?: string | null;
    cddtiTaskDescription?: string | null;
    signedDate?: string | Date | null;
    notes?: string | null;
  };
  onSuccess?: () => void;
}

const editContractSchema = z.object({
  contractNumber: z.string().optional(),
  startDate: z.date({ required_error: 'La date de début est requise' }),
  endDate: z.date().optional(),
  cddReason: z.string().optional(),
  cddtiTaskDescription: z.string().optional(),
  signedDate: z.date().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // CDD must have end date
  if (data.endDate && data.startDate && data.endDate <= data.startDate) {
    return false;
  }
  return true;
}, {
  message: 'La date de fin doit être postérieure à la date de début',
  path: ['endDate'],
});

type EditContractFormValues = z.infer<typeof editContractSchema>;

// ============================================================================
// Component
// ============================================================================

export function EditContractDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
}: EditContractDialogProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const form = useForm<EditContractFormValues>({
    resolver: zodResolver(editContractSchema),
    defaultValues: {
      contractNumber: contract.contractNumber || '',
      startDate: typeof contract.startDate === 'string'
        ? parseISO(contract.startDate)
        : contract.startDate,
      endDate: contract.endDate
        ? typeof contract.endDate === 'string'
          ? parseISO(contract.endDate)
          : contract.endDate
        : undefined,
      cddReason: contract.cddReason || undefined,
      cddtiTaskDescription: contract.cddtiTaskDescription || undefined,
      signedDate: contract.signedDate
        ? typeof contract.signedDate === 'string'
          ? parseISO(contract.signedDate)
          : contract.signedDate
        : undefined,
      notes: contract.notes || '',
    },
  });

  // Update form when contract changes
  useEffect(() => {
    if (open && contract) {
      form.reset({
        contractNumber: contract.contractNumber || '',
        startDate: typeof contract.startDate === 'string'
          ? parseISO(contract.startDate)
          : contract.startDate,
        endDate: contract.endDate
          ? typeof contract.endDate === 'string'
            ? parseISO(contract.endDate)
            : contract.endDate
          : undefined,
        cddReason: contract.cddReason || undefined,
        cddtiTaskDescription: contract.cddtiTaskDescription || undefined,
        signedDate: contract.signedDate
          ? typeof contract.signedDate === 'string'
            ? parseISO(contract.signedDate)
            : contract.signedDate
          : undefined,
        notes: contract.notes || '',
      });
    }
  }, [open, contract, form]);

  const updateContractMutation = trpc.contracts.updateContract.useMutation({
    onSuccess: () => {
      toast({
        title: 'Contrat modifié',
        description: 'Les modifications ont été enregistrées avec succès.',
      });
      utils.employees.invalidate();
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier le contrat.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditContractFormValues) => {
    updateContractMutation.mutate({
      id: contract.id,
      contractNumber: data.contractNumber || null,
      startDate: data.startDate.toISOString().split('T')[0],
      endDate: data.endDate ? data.endDate.toISOString().split('T')[0] : null,
      cddReason: data.cddReason || null,
      cddtiTaskDescription: data.cddtiTaskDescription || null,
      signedDate: data.signedDate ? data.signedDate.toISOString().split('T')[0] : null,
      notes: data.notes || null,
    });
  };

  const isCDD = contract.contractType === 'CDD';
  const isCDDTI = contract.contractType === 'CDDTI';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le contrat</DialogTitle>
          <DialogDescription>
            Modifiez les informations du contrat {contract.contractType}
            {contract.contractNumber && ` n° ${contract.contractNumber}`}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contract Number */}
            <FormField
              control={form.control}
              name="contractNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de contrat</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CT-2024-001"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro d'identification unique du contrat
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
                <FormItem className="flex flex-col">
                  <FormLabel>Date de début *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'min-h-[48px] w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'dd MMMM yyyy', { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Date effective de début du contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date - shown for CDD */}
            {isCDD && (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de fin</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'min-h-[48px] w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'dd MMMM yyyy', { locale: fr })
                            ) : (
                              <span>Sélectionner une date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={fr}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Date prévue de fin du contrat (requise pour CDD)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* CDD Reason */}
            {isCDD && (
              <FormField
                control={form.control}
                name="cddReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motif du CDD</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner un motif" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="REMPLACEMENT">Remplacement</SelectItem>
                        <SelectItem value="SURCROIT_ACTIVITE">Surcroît d'activité</SelectItem>
                        <SelectItem value="SAISONNIER">Travail saisonnier</SelectItem>
                        <SelectItem value="PROJET">Projet spécifique</SelectItem>
                        <SelectItem value="AUTRE">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Motif légal du contrat à durée déterminée
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* CDDTI Task Description */}
            {isCDDTI && (
              <FormField
                control={form.control}
                name="cddtiTaskDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description de la tâche (CDDTI)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Décrire les tâches confiées au travailleur journalier..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Description des tâches confiées (requis par la Convention Collective, Article 4)
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
                <FormItem className="flex flex-col">
                  <FormLabel>Date de signature</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'min-h-[48px] w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'dd MMMM yyyy', { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notes additionnelles sur ce contrat..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Notes internes pour référence
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note :</strong> Le type de contrat ne peut pas être modifié.
                Pour changer le type, créez un nouveau contrat via la page de gestion des contrats.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateContractMutation.isPending}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateContractMutation.isPending}
                className="min-h-[48px]"
              >
                {updateContractMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
