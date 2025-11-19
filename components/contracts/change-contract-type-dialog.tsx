/**
 * Change Contract Type Dialog
 *
 * Allows changing employee contract type to any type (CDI, CDD, CDDTI, STAGE, INTERIM).
 * Creates a new contract and terminates the old one, maintaining contract history.
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
import { Loader2, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types & Schema
// ============================================================================

interface ChangeContractTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  currentContractId: string;
  currentContractType: string;
  onSuccess?: () => void;
}

const changeContractTypeSchema = z.object({
  newContractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM'], {
    required_error: 'Le type de contrat est requis',
  }),
  startDate: z.date({ required_error: 'La date de début est requise' }),
  endDate: z.date().optional(),
  contractNumber: z.string().optional(),
  cddReason: z.string().optional(),
  cddtiTaskDescription: z.string().optional(),
  terminationReason: z.string().min(1, 'La raison de fin de contrat est requise'),
}).refine((data) => {
  // CDD and STAGE must have end date
  if ((data.newContractType === 'CDD' || data.newContractType === 'STAGE') && !data.endDate) {
    return false;
  }
  return true;
}, {
  message: 'Une date de fin est requise pour les contrats CDD et STAGE',
  path: ['endDate'],
}).refine((data) => {
  // End date must be after start date
  if (data.endDate && data.startDate && data.endDate <= data.startDate) {
    return false;
  }
  return true;
}, {
  message: 'La date de fin doit être postérieure à la date de début',
  path: ['endDate'],
}).refine((data) => {
  // CDD must have reason
  if (data.newContractType === 'CDD' && !data.cddReason) {
    return false;
  }
  return true;
}, {
  message: 'Le motif est requis pour les contrats CDD',
  path: ['cddReason'],
}).refine((data) => {
  // CDDTI must have task description
  if (data.newContractType === 'CDDTI' && (!data.cddtiTaskDescription || data.cddtiTaskDescription.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'La description de la tâche est requise pour les contrats CDDTI',
  path: ['cddtiTaskDescription'],
});

type ChangeContractTypeFormValues = z.infer<typeof changeContractTypeSchema>;

// ============================================================================
// Component
// ============================================================================

export function ChangeContractTypeDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  currentContractId,
  currentContractType,
  onSuccess,
}: ChangeContractTypeDialogProps) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const form = useForm<ChangeContractTypeFormValues>({
    resolver: zodResolver(changeContractTypeSchema),
    defaultValues: {
      newContractType: undefined,
      startDate: new Date(),
      endDate: undefined,
      contractNumber: '',
      cddReason: undefined,
      cddtiTaskDescription: '',
      terminationReason: 'Changement de type de contrat',
    },
  });

  const selectedType = form.watch('newContractType');
  const startDate = form.watch('startDate');

  // Auto-set end date for CDD (default 6 months)
  useEffect(() => {
    if (selectedType === 'CDD' && startDate && !form.getValues('endDate')) {
      form.setValue('endDate', addMonths(startDate, 6));
    }
  }, [selectedType, startDate, form]);

  const changeContractTypeMutation = api.contracts.changeContractType.useMutation({
    onSuccess: () => {
      toast({
        title: 'Contrat modifié',
        description: 'Le type de contrat a été changé avec succès.',
      });
      utils.employees.invalidate();
      utils.compliance.invalidate();
      onOpenChange(false);
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de changer le type de contrat.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ChangeContractTypeFormValues) => {
    changeContractTypeMutation.mutate({
      employeeId,
      oldContractId: currentContractId,
      newContractType: data.newContractType,
      startDate: data.startDate.toISOString().split('T')[0],
      endDate: data.endDate ? data.endDate.toISOString().split('T')[0] : null,
      contractNumber: data.contractNumber || null,
      cddReason: data.cddReason || null,
      cddtiTaskDescription: data.cddtiTaskDescription || null,
      terminationReason: data.terminationReason,
    });
  };

  const isCDD = selectedType === 'CDD';
  const isCDDTI = selectedType === 'CDDTI';
  const isStage = selectedType === 'STAGE';
  const requiresEndDate = isCDD || isStage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Changer le type de contrat</DialogTitle>
          <DialogDescription>
            Changez le type de contrat pour {employeeName}. Un nouveau contrat sera créé et l'ancien sera terminé.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Alert */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention:</strong> Cette action créera un nouveau contrat et terminera le contrat actuel ({currentContractType}).
            L'historique sera conservé.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* New Contract Type */}
            <FormField
              control={form.control}
              name="newContractType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau type de contrat *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CDI">CDI - Contrat à Durée Indéterminée</SelectItem>
                      <SelectItem value="CDD">CDD - Contrat à Durée Déterminée</SelectItem>
                      <SelectItem value="CDDTI">CDDTI - Contrat Journalier (Terme Imprécis)</SelectItem>
                      <SelectItem value="STAGE">STAGE - Stage</SelectItem>
                      <SelectItem value="INTERIM">INTERIM - Intérim</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Sélectionnez le nouveau type de contrat
                  </FormDescription>
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
                  <FormLabel>Numéro de contrat</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: CT-2024-001"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro d'identification du nouveau contrat
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
                  <FormLabel>Date de début du nouveau contrat *</FormLabel>
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
                    Date effective de début du nouveau contrat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date - for CDD and STAGE */}
            {requiresEndDate && (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de fin *</FormLabel>
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
                      Date prévue de fin du contrat (requise pour CDD et STAGE)
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
                    <FormLabel>Motif du CDD *</FormLabel>
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
                    <FormLabel>Description de la tâche (CDDTI) *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Décrire les tâches confiées au travailleur journalier..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Description des tâches (requis par la Convention Collective, Article 4)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Termination Reason */}
            <FormField
              control={form.control}
              name="terminationReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison de fin du contrat actuel *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Ex: Changement de type de contrat pour adaptation au poste"
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Raison de la terminaison du contrat {currentContractType} actuel
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={changeContractTypeMutation.isPending}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={changeContractTypeMutation.isPending}
                className="min-h-[48px]"
              >
                {changeContractTypeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Changer le type de contrat
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
