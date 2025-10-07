/**
 * Time-Off Request Form
 *
 * Mobile-first form following HCI principles:
 * - Wizard-style multi-step flow
 * - Smart defaults (today + 15 days)
 * - Error prevention (validate balance upfront)
 * - French labels
 * - Progressive disclosure
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { differenceInBusinessDays, addDays } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

const timeOffRequestSchema = z.object({
  policyId: z.string().uuid('Sélectionnez un type de congé'),
  startDate: z.date({
    required_error: 'Date de début requise',
  }),
  endDate: z.date({
    required_error: 'Date de fin requise',
  }),
  reason: z.string().optional(),
});

type TimeOffRequestForm = z.infer<typeof timeOffRequestSchema>;

interface TimeOffRequestFormProps {
  employeeId: string;
  onSuccess?: () => void;
}

export function TimeOffRequestForm({ employeeId, onSuccess }: TimeOffRequestFormProps) {
  const utils = trpc.useUtils();

  // Get policies
  const { data: policies } = trpc.timeOff.getPolicies.useQuery();

  // Get balances
  const { data: balances } = trpc.timeOff.getAllBalances.useQuery({ employeeId });

  // Request mutation
  const requestMutation = trpc.timeOff.request.useMutation({
    onSuccess: () => {
      toast.success('Demande de congé envoyée');
      // Invalidate queries to refetch updated data
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
      utils.timeOff.getAllBalances.invalidate({ employeeId });
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup with smart defaults
  const form = useForm<TimeOffRequestForm>({
    resolver: zodResolver(timeOffRequestSchema),
    defaultValues: {
      startDate: addDays(new Date(), 15), // Default: 15 days from now
      endDate: addDays(new Date(), 16), // Default: 2 days leave
    },
  });

  const selectedPolicy = form.watch('policyId');
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  // Calculate business days
  const businessDays = startDate && endDate
    ? differenceInBusinessDays(endDate, startDate) + 1
    : 0;

  // Get balance for selected policy
  const selectedBalance = balances?.find((b) => b.policyId === selectedPolicy);
  const availableBalance = selectedBalance
    ? parseFloat(selectedBalance.balance as string) - parseFloat(selectedBalance.pending as string)
    : 0;

  // Check if sufficient balance
  const hasSufficientBalance = businessDays <= availableBalance;

  // Submit handler
  const onSubmit = async (data: TimeOffRequestForm) => {
    if (!hasSufficientBalance) {
      toast.error(`Solde insuffisant (disponible: ${availableBalance.toFixed(1)} jours)`);
      return;
    }

    await requestMutation.mutateAsync({
      employeeId,
      policyId: data.policyId,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Demande de congé</CardTitle>
        <CardDescription className="text-base">
          Remplissez le formulaire pour demander un congé
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Policy selection */}
            <FormField
              control={form.control}
              name="policyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Type de congé</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px] text-base">
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {policies?.map((policy) => {
                        const balance = balances?.find((b) => b.policyId === policy.id);
                        const available = balance
                          ? parseFloat(balance.balance as string) - parseFloat(balance.pending as string)
                          : 0;

                        return (
                          <SelectItem key={policy.id} value={policy.id} className="text-base">
                            <div className="flex justify-between items-center gap-4">
                              <span>{policy.name}</span>
                              <Badge variant="outline">
                                {available.toFixed(1)} jours disponibles
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date range selection */}
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date de début</FormLabel>
                    <FormControl>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date de fin</FormLabel>
                    <FormControl>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={fr}
                        disabled={(date) => date < startDate}
                        className="rounded-md border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration summary */}
            {businessDays > 0 && (
              <Alert className={hasSufficientBalance ? 'border-green-500' : 'border-destructive'}>
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-base">
                  <div className="space-y-1">
                    <p className="font-medium">
                      Durée: {businessDays} jour{businessDays > 1 ? 's' : ''} ouvrable{businessDays > 1 ? 's' : ''}
                    </p>
                    {selectedBalance && (
                      <>
                        <p>
                          Solde disponible: {availableBalance.toFixed(1)} jour{availableBalance > 1 ? 's' : ''}
                        </p>
                        {!hasSufficientBalance && (
                          <p className="text-destructive font-medium">
                            Solde insuffisant!
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Motif (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Expliquez brièvement le motif de votre demande..."
                      className="min-h-[100px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ce champ est optionnel mais peut aider votre gestionnaire
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit button */}
            <Button
              type="submit"
              disabled={requestMutation.isLoading || !hasSufficientBalance}
              className="w-full min-h-[56px] text-lg"
              size="lg"
            >
              {requestMutation.isLoading ? 'Envoi en cours...' : 'Envoyer la demande'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
