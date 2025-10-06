/**
 * Terminate Employee Modal
 *
 * Form to terminate an employee with validation
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
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTerminateEmployee } from '@/features/employees/hooks/use-employee-mutations';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const terminateEmployee = useTerminateEmployee();

  const form = useForm<FormData>({
    resolver: zodResolver(terminateSchema),
    defaultValues: {
      terminationDate: new Date(),
    },
  });

  const onSubmit = async (data: FormData) => {
    await terminateEmployee.mutateAsync({
      employeeId: employee.id,
      ...data,
    });
    onClose();
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
                disabled={terminateEmployee.isPending}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={terminateEmployee.isPending}
                className="min-h-[44px]"
              >
                {terminateEmployee.isPending ? (
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
