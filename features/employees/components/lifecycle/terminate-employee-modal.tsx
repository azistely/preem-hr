/**
 * Terminate Employee Modal
 *
 * Form to terminate an employee with validation
 * Includes notice period and severance pay calculations
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const terminateSchema = z.object({
  terminationDate: z.date(),
  terminationReason: z.string().min(1, 'La raison est requise'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof terminateSchema>;

interface TerminateEmployeeModalProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    hireDate: string;
  };
  open: boolean;
  onClose: () => void;
}

export function TerminateEmployeeModal({
  employee,
  open,
  onClose,
}: TerminateEmployeeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTermination = trpc.terminations.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: 'Cessation enregistrée',
        description: 'Le contrat a été terminé avec succès.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la cessation.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(terminateSchema),
    defaultValues: {
      terminationDate: new Date(),
    },
  });

  // Fetch notice period calculation
  const { data: noticePeriod, isLoading: loadingNoticePeriod } =
    trpc.employeeCategories.calculateNoticePeriod.useQuery(
      { employeeId: employee.id },
      { enabled: open }
    );

  // Fetch severance pay calculation
  const terminationDate = form.watch('terminationDate');
  const { data: severancePay, isLoading: loadingSeverancePay } =
    trpc.employeeCategories.calculateSeverancePay.useQuery(
      {
        employeeId: employee.id,
        hireDate: new Date(employee.hireDate),
        terminationDate: terminationDate || new Date(),
        countryMinimumWage: 75000, // TODO: Get from tenant/country config
      },
      { enabled: open && !!terminationDate }
    );

  const onSubmit = async (data: FormData) => {
    // Ensure we have all required calculations
    if (!noticePeriod || !severancePay) {
      toast({
        title: 'Calculs incomplets',
        description: 'Veuillez attendre que les calculs soient terminés.',
        variant: 'destructive',
      });
      return;
    }

    await createTermination.mutateAsync({
      employeeId: employee.id,
      terminationDate: data.terminationDate,
      terminationReason: data.terminationReason as any,
      notes: data.notes,
      noticePeriodDays: noticePeriod.noticePeriodDays,
      severanceAmount: severancePay.totalAmount,
      vacationPayoutAmount: 0, // TODO: Calculate vacation payout
      averageSalary12m: severancePay.averageSalary,
      yearsOfService: severancePay.yearsOfService,
      severanceRate: severancePay.rate as any,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Terminer le contrat
          </DialogTitle>
          <DialogDescription>
            {employee.firstName} {employee.lastName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Cette action mettra fin au contrat de l'employé et terminera toutes les
                affectations actives. Cette action est irréversible.
              </AlertDescription>
            </Alert>

            {/* Notice Period & Severance Pay Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Notice Period Card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Préavis de licenciement
                      </p>
                      {loadingNoticePeriod ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Calcul...</span>
                        </div>
                      ) : noticePeriod ? (
                        <>
                          <p className="text-2xl font-bold">
                            {noticePeriod.noticePeriodDays} jours
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {noticePeriod.category?.friendlyLabel || ''} •{' '}
                            {noticePeriod.workDays}j travail + {noticePeriod.searchDays}j recherche
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Non calculé</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Severance Pay Card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Indemnité de licenciement
                      </p>
                      {loadingSeverancePay ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Calcul...</span>
                        </div>
                      ) : severancePay ? (
                        <>
                          <p className="text-2xl font-bold">
                            {formatCurrency(severancePay.totalAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {severancePay.yearsOfService} ans • {severancePay.rate}% du salaire de référence
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Non calculé</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <FormField
              control={form.control}
              name="terminationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date de cessation *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'min-h-[48px] pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: fr })
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
                        disabled={(date) =>
                          date < new Date(employee.hireDate) || date > new Date()
                        }
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Doit être entre la date d'embauche et aujourd'hui
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terminationReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionner une raison" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="resignation">Démission</SelectItem>
                      <SelectItem value="termination">Licenciement</SelectItem>
                      <SelectItem value="retirement">Retraite</SelectItem>
                      <SelectItem value="contract_end">Fin de contrat</SelectItem>
                      <SelectItem value="death">Décès</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Détails supplémentaires..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={createTermination.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={createTermination.isPending || !noticePeriod || !severancePay}
                className="min-h-[44px]"
              >
                {createTermination.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Confirmer la cessation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
