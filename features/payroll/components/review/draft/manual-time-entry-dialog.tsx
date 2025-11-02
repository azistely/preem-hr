'use client';

/**
 * Manual Time Entry Dialog
 *
 * Allows HR/managers to manually add time entries for employees
 * when clock data is missing or needs correction
 *
 * Features:
 * - Simple date/time picker for clock in/out
 * - Break duration input
 * - Automatic hours calculation
 * - Validation (max 24h per day, within period)
 * - Large touch targets
 *
 * Design: Mobile-first, wizard-like flow, clear feedback
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

const manualEntrySchema = z
  .object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    clockIn: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
    clockOut: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
    breakMinutes: z.coerce.number().min(0).max(240),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate clock out is after clock in
      const clockIn = parse(data.clockIn, 'HH:mm', new Date());
      const clockOut = parse(data.clockOut, 'HH:mm', new Date());
      return clockOut > clockIn;
    },
    {
      message: "L'heure de sortie doit être après l'heure d'entrée",
      path: ['clockOut'],
    }
  )
  .refine(
    (data) => {
      // Validate total hours is reasonable (max 24h)
      const clockIn = parse(data.clockIn, 'HH:mm', new Date());
      const clockOut = parse(data.clockOut, 'HH:mm', new Date());
      const totalMinutes = differenceInMinutes(clockOut, clockIn) - data.breakMinutes;
      const totalHours = totalMinutes / 60;
      return totalHours <= 24 && totalHours > 0;
    },
    {
      message: 'Durée totale invalide (max 24h)',
      path: ['clockOut'],
    }
  );

type ManualEntryFormData = z.infer<typeof manualEntrySchema>;

interface ManualTimeEntryDialogProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  onSubmit: (data: ManualEntryFormData) => Promise<void>;
  defaultDate?: string; // YYYY-MM-DD format
  periodStart?: Date;
  periodEnd?: Date;
}

export function ManualTimeEntryDialog({
  open,
  onClose,
  employeeName,
  onSubmit,
  defaultDate,
  periodStart,
  periodEnd,
}: ManualTimeEntryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ManualEntryFormData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      workDate: defaultDate || format(new Date(), 'yyyy-MM-dd'),
      clockIn: '08:00',
      clockOut: '17:00',
      breakMinutes: 60,
      notes: '',
    },
  });

  // Calculate total hours in real-time
  const watchedValues = form.watch(['clockIn', 'clockOut', 'breakMinutes']);
  const [clockIn, clockOut, breakMinutes] = watchedValues;

  let totalHours = 0;
  let isValidTime = false;

  try {
    const clockInTime = parse(clockIn, 'HH:mm', new Date());
    const clockOutTime = parse(clockOut, 'HH:mm', new Date());
    if (clockOutTime > clockInTime) {
      const totalMinutes = differenceInMinutes(clockOutTime, clockInTime) - breakMinutes;
      totalHours = totalMinutes / 60;
      isValidTime = totalHours > 0 && totalHours <= 24;
    }
  } catch {
    // Invalid time format
  }

  const handleSubmit = async (data: ManualEntryFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onClose();
    } catch (error) {
      console.error('Failed to create manual entry:', error);
      // Error will be handled by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des Heures Manuellement</DialogTitle>
          <DialogDescription>
            Saisir les heures pour <strong>{employeeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Work Date */}
            <FormField
              control={form.control}
              name="workDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de Travail</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        {...field}
                        className="pl-10 min-h-[48px]"
                        min={periodStart ? format(periodStart, 'yyyy-MM-dd') : undefined}
                        max={periodEnd ? format(periodEnd, 'yyyy-MM-dd') : undefined}
                      />
                    </div>
                  </FormControl>
                  {periodStart && periodEnd && (
                    <FormDescription className="text-xs">
                      Entre le {format(periodStart, 'dd/MM/yyyy', { locale: fr })} et le{' '}
                      {format(periodEnd, 'dd/MM/yyyy', { locale: fr })}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Clock In Time */}
            <FormField
              control={form.control}
              name="clockIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure d&apos;Entrée</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        {...field}
                        className="pl-10 min-h-[48px]"
                        step="900" // 15 minute intervals
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Clock Out Time */}
            <FormField
              control={form.control}
              name="clockOut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure de Sortie</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        {...field}
                        className="pl-10 min-h-[48px]"
                        step="900" // 15 minute intervals
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Break Duration */}
            <FormField
              control={form.control}
              name="breakMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pause (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="min-h-[48px]"
                      min="0"
                      max="240"
                      step="15"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Habituellement 60 minutes (1h)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Hours Preview */}
            {isValidTime && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Total: {totalHours.toFixed(2)} heures</strong>
                  {totalHours > 8 && (
                    <span className="ml-2 text-xs">
                      ({(totalHours - 8).toFixed(2)}h supplémentaires)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Raison de la saisie manuelle..."
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="min-h-[48px]"
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="min-h-[48px]"
                disabled={isSubmitting || !isValidTime}
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
