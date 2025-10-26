/**
 * Manual Time Entry Dialog
 *
 * Dialog for creating/editing manual time entries.
 * Calculates total hours automatically based on clock in/out times.
 * Shows overtime classification after entry is created.
 *
 * HCI Principles:
 * - Smart defaults (current date, 8-hour workday)
 * - Automatic calculation (no manual hour entry)
 * - Clear validation messages
 * - Large touch targets (min-h-[44px])
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const manualEntrySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  clockInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide'),
  clockOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide'),
  notes: z.string().optional(),
});

type ManualEntryFormData = z.infer<typeof manualEntrySchema>;

interface ManualTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    workDate: string;
    clockIn: string;
    clockOut: string;
    totalHours: number;
    notes?: string;
  }) => Promise<void>;
  employeeName: string;
  employeeNumber: string;
  initialValues?: {
    workDate?: string;
    clockIn?: string;
    clockOut?: string;
    notes?: string;
  };
  isSubmitting?: boolean;
}

export function ManualTimeEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  employeeName,
  employeeNumber,
  initialValues,
  isSubmitting,
}: ManualTimeEntryDialogProps) {
  const [totalHours, setTotalHours] = useState<number>(0);

  // Memoize default values to avoid recreating on every render
  const defaultFormValues = useMemo(() => {
    console.log('[ManualTimeEntryDialog] Creating default values with initialValues:', initialValues);

    const values = {
      workDate: initialValues?.workDate || new Date().toISOString().split('T')[0],
      clockInTime: initialValues?.clockIn
        ? new Date(initialValues.clockIn).toTimeString().substring(0, 5)
        : '08:00',
      clockOutTime: initialValues?.clockOut
        ? new Date(initialValues.clockOut).toTimeString().substring(0, 5)
        : '17:00',
      notes: initialValues?.notes || '',
    };

    console.log('[ManualTimeEntryDialog] Default values:', values);
    return values;
  }, [initialValues]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ManualEntryFormData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: defaultFormValues,
  });

  const workDate = watch('workDate');
  const clockInTime = watch('clockInTime');
  const clockOutTime = watch('clockOutTime');

  // Reset form when dialog opens with new initialValues
  useEffect(() => {
    if (open) {
      reset(defaultFormValues);
    }
  }, [open, reset, defaultFormValues]);

  // Calculate total hours whenever times change
  useEffect(() => {
    if (workDate && clockInTime && clockOutTime) {
      const clockIn = new Date(`${workDate}T${clockInTime}:00`);
      const clockOut = new Date(`${workDate}T${clockOutTime}:00`);

      // Handle overnight shifts
      if (clockOut <= clockIn) {
        clockOut.setDate(clockOut.getDate() + 1);
      }

      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      setTotalHours(Math.max(0, hours));
    }
  }, [workDate, clockInTime, clockOutTime]);

  const handleFormSubmit = async (data: ManualEntryFormData) => {
    const clockIn = new Date(`${data.workDate}T${data.clockInTime}:00`);
    const clockOut = new Date(`${data.workDate}T${data.clockOutTime}:00`);

    // Handle overnight shifts
    if (clockOut <= clockIn) {
      clockOut.setDate(clockOut.getDate() + 1);
    }

    await onSubmit({
      workDate: data.workDate,
      clockIn: clockIn.toISOString(),
      clockOut: clockOut.toISOString(),
      totalHours,
      notes: data.notes,
    });

    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {initialValues ? 'Modifier' : 'Ajouter'} les heures
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 space-y-1">
              <div className="font-medium text-foreground">{employeeName}</div>
              <div className="text-xs text-muted-foreground">#{employeeNumber}</div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Work Date */}
          <div className="space-y-2">
            <Label htmlFor="workDate">Date de travail</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="workDate"
                type="date"
                {...register('workDate')}
                className="min-h-[48px] pl-10"
              />
            </div>
            {errors.workDate && (
              <p className="text-sm text-destructive">{errors.workDate.message}</p>
            )}
          </div>

          {/* Clock In/Out Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clockInTime">Heure d'arrivée</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="clockInTime"
                  type="time"
                  {...register('clockInTime')}
                  className="min-h-[48px] pl-10"
                />
              </div>
              {errors.clockInTime && (
                <p className="text-sm text-destructive">{errors.clockInTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clockOutTime">Heure de départ</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="clockOutTime"
                  type="time"
                  {...register('clockOutTime')}
                  className="min-h-[48px] pl-10"
                />
              </div>
              {errors.clockOutTime && (
                <p className="text-sm text-destructive">{errors.clockOutTime.message}</p>
              )}
            </div>
          </div>

          {/* Total Hours Display */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total des heures</span>
              <Badge variant="secondary" className="text-lg font-bold px-4 py-2">
                {totalHours.toFixed(2)}h
              </Badge>
            </div>
            {totalHours > 8 && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Heures supplémentaires seront calculées automatiquement
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Ajouter une note..."
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || totalHours === 0}
              className="min-h-[48px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
