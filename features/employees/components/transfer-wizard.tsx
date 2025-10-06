/**
 * Transfer Wizard Component
 *
 * Multi-step wizard for transferring an employee to a new position
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
import { CalendarIcon, Loader2, ArrowRight, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePositions } from '@/features/employees/hooks/use-positions';
import { useTransferEmployee } from '@/features/employees/hooks/use-assignments';
import { Separator } from '@/components/ui/separator';

const transferSchema = z.object({
  newPositionId: z.string().min(1, 'Le nouveau poste est requis'),
  effectiveFrom: z.date(),
  reason: z.string().min(1, 'La raison est requise'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof transferSchema>;

interface TransferWizardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    currentPosition?: {
      id: string;
      title: string;
    };
  };
  open: boolean;
  onClose: () => void;
}

export function TransferWizard({ employee, open, onClose }: TransferWizardProps) {
  const [step, setStep] = useState(1);
  const { data: positions } = usePositions('active');
  const transferEmployee = useTransferEmployee();

  const form = useForm<FormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      effectiveFrom: new Date(),
    },
  });

  const selectedPositionId = form.watch('newPositionId');
  const selectedPosition = positions?.find((p: any) => p.id === selectedPositionId);

  const onSubmit = async (data: FormData) => {
    await transferEmployee.mutateAsync({
      employeeId: employee.id,
      ...data,
    });
    onClose();
    setStep(1);
  };

  const nextStep = async () => {
    let isValid = false;

    switch (step) {
      case 1:
        isValid = await form.trigger(['newPositionId']);
        break;
      case 2:
        isValid = await form.trigger(['effectiveFrom']);
        break;
      case 3:
        isValid = await form.trigger(['reason']);
        break;
    }

    if (isValid && step < 4) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transférer l'employé</DialogTitle>
          <DialogDescription>
            {employee.firstName} {employee.lastName}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2',
                  step > s
                    ? 'border-green-500 bg-green-500 text-white'
                    : step === s
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={cn(
                    'h-0.5 w-12 mx-2',
                    step > s ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Select Position */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Sélectionner le nouveau poste</h3>

                {employee.currentPosition && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Poste actuel: <strong>{employee.currentPosition.title}</strong>
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="newPositionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau poste *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Sélectionner un poste" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {positions
                            ?.filter(
                              (p: any) => p.id !== employee.currentPosition?.id
                            )
                            .map((position: any) => (
                              <SelectItem key={position.id} value={position.id}>
                                {position.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Effective Date */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Date d'effet</h3>

                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date d'effet du transfert *</FormLabel>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Le transfert prendra effet à partir de cette date
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Reason */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Raison du transfert</h3>

                <FormField
                  control={form.control}
                  name="reason"
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
                          <SelectItem value="promotion">Promotion</SelectItem>
                          <SelectItem value="lateral_move">Mutation horizontale</SelectItem>
                          <SelectItem value="demotion">Rétrogradation</SelectItem>
                          <SelectItem value="restructuring">Réorganisation</SelectItem>
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
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Confirmation</h3>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Vérifiez les informations ci-dessous avant de confirmer le transfert.
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employé</span>
                    <span className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </span>
                  </div>

                  {employee.currentPosition && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Poste actuel</span>
                      <span className="font-medium">{employee.currentPosition.title}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nouveau poste</span>
                    <span className="font-medium">{selectedPosition?.title}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date d'effet</span>
                    <span className="font-medium">
                      {format(form.getValues('effectiveFrom'), 'PPP', { locale: fr })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Raison</span>
                    <span className="font-medium">
                      {
                        {
                          promotion: 'Promotion',
                          lateral_move: 'Mutation horizontale',
                          demotion: 'Rétrogradation',
                          restructuring: 'Réorganisation',
                          other: 'Autre',
                        }[form.getValues('reason')]
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={step === 1 ? onClose : prevStep}
                disabled={transferEmployee.isPending}
                className="min-h-[44px]"
              >
                {step === 1 ? 'Annuler' : 'Précédent'}
              </Button>

              {step < 4 ? (
                <Button type="button" onClick={nextStep} className="min-h-[44px]">
                  Suivant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={transferEmployee.isPending}
                  className="min-h-[56px] bg-green-600 hover:bg-green-700"
                >
                  {transferEmployee.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transfert en cours...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Confirmer le transfert
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
