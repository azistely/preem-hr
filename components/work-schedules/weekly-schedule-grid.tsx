/**
 * Weekly Schedule Grid - Interactive weekly schedule entry
 *
 * Design Pattern: Progressive Disclosure + Task-Oriented
 * - Show 7-day week grid (Monday-Sunday)
 * - Large touch targets (min 56px height)
 * - Color-coded status (green=present, gray=absent, yellow=partial)
 * - Instant visual feedback
 * - Mobile-first design
 */

'use client';

import { useState } from 'react';
import { format, startOfWeek, addDays, isFuture, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, Calendar, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkSchedule } from '@/lib/db/schema/work-schedules';

type DaySchedule = {
  date: Date;
  isPresent: boolean;
  hoursWorked?: number;
  startTime?: string;
  endTime?: string;
  scheduleType: 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT';
  status?: 'draft' | 'pending' | 'approved';
};

type WeeklyScheduleGridProps = {
  weekStartDate: Date;
  initialSchedules?: WorkSchedule[];
  onSave: (schedules: DaySchedule[]) => Promise<void>;
  onSubmit?: (schedules: DaySchedule[]) => Promise<void>;
  disabled?: boolean;
  standardHours?: number; // Default: 8
};

export function WeeklyScheduleGrid({
  weekStartDate,
  initialSchedules = [],
  onSave,
  onSubmit,
  disabled = false,
  standardHours = 8,
}: WeeklyScheduleGridProps) {
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 }); // Monday

  // Initialize week schedules
  const [weekSchedules, setWeekSchedules] = useState<DaySchedule[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const existing = initialSchedules.find(
        (s) => format(new Date(s.workDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );

      if (existing) {
        return {
          date,
          isPresent: existing.isPresent,
          hoursWorked: existing.hoursWorked ? Number(existing.hoursWorked) : undefined,
          startTime: existing.startTime || undefined,
          endTime: existing.endTime || undefined,
          scheduleType: existing.scheduleType as 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT',
          status: existing.status as 'draft' | 'pending' | 'approved',
        };
      }

      return {
        date,
        isPresent: false,
        scheduleType: 'ABSENT' as const,
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate totals
  const totalDays = weekSchedules.filter((d) => d.isPresent).length;
  const totalHours = weekSchedules.reduce((sum, d) => sum + (d.hoursWorked || 0), 0);

  // Toggle day presence
  const toggleDay = (index: number) => {
    if (disabled || weekSchedules[index].status === 'approved') return;

    setWeekSchedules((prev) => {
      const updated = [...prev];
      const isPresent = !updated[index].isPresent;

      updated[index] = {
        ...updated[index],
        isPresent,
        scheduleType: isPresent ? 'FULL_DAY' : 'ABSENT',
        hoursWorked: isPresent ? standardHours : undefined,
      };

      return updated;
    });
  };

  // Update hours for a day
  const updateHours = (index: number, hours: number) => {
    if (disabled || weekSchedules[index].status === 'approved') return;

    setWeekSchedules((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        hoursWorked: hours,
        scheduleType: hours === standardHours ? 'FULL_DAY' : 'PARTIAL_DAY',
      };
      return updated;
    });
  };

  // Save as draft
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(weekSchedules);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for approval
  const handleSubmit = async () => {
    if (!onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(weekSchedules);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if week can be submitted
  const canSubmit = weekSchedules.every((d) => !isFuture(d.date)) &&
    weekSchedules.some((d) => d.isPresent) &&
    !weekSchedules.some((d) => d.status === 'approved');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">
              Semaine du {format(weekStart, 'd', { locale: fr })} - {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}
            </CardTitle>
            <CardDescription className="mt-1">
              Marquez les jours travaillés et entrez les heures
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Week Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekSchedules.map((daySchedule, index) => {
            const dayName = format(daySchedule.date, 'EEE', { locale: fr });
            const dayNumber = format(daySchedule.date, 'd');
            const isTodayDate = isToday(daySchedule.date);
            const isFutureDate = isFuture(daySchedule.date);
            const isApproved = daySchedule.status === 'approved';
            const isPending = daySchedule.status === 'pending';

            return (
              <div
                key={index}
                className={cn(
                  'border rounded-lg p-4 space-y-3 transition-all',
                  daySchedule.isPresent && !isApproved && 'bg-green-50 border-green-200',
                  daySchedule.isPresent && isApproved && 'bg-green-100 border-green-300',
                  !daySchedule.isPresent && 'bg-gray-50 border-gray-200',
                  isTodayDate && 'ring-2 ring-primary',
                  isFutureDate && 'opacity-50',
                  disabled && 'cursor-not-allowed'
                )}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg capitalize">{dayName}</div>
                    <div className="text-sm text-muted-foreground">{dayNumber}</div>
                  </div>
                  {isApproved && (
                    <Badge variant="default" className="bg-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Approuvé
                    </Badge>
                  )}
                  {isPending && (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente
                    </Badge>
                  )}
                </div>

                {/* Present/Absent Toggle */}
                <Button
                  type="button"
                  variant={daySchedule.isPresent ? 'default' : 'outline'}
                  className={cn(
                    'w-full min-h-[56px] text-lg font-semibold',
                    daySchedule.isPresent && 'bg-green-600 hover:bg-green-700'
                  )}
                  onClick={() => toggleDay(index)}
                  disabled={disabled || isFutureDate || isApproved}
                >
                  {daySchedule.isPresent ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Présent
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 mr-2" />
                      Absent
                    </>
                  )}
                </Button>

                {/* Hours Input (if present) */}
                {daySchedule.isPresent && (
                  <div className="space-y-2">
                    <Label htmlFor={`hours-${index}`} className="text-sm font-medium">
                      Heures travaillées
                    </Label>
                    <Input
                      id={`hours-${index}`}
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={daySchedule.hoursWorked || ''}
                      onChange={(e) => updateHours(index, parseFloat(e.target.value) || 0)}
                      disabled={disabled || isApproved}
                      className="min-h-[48px] text-lg text-center font-semibold"
                      placeholder="8.0"
                    />
                    <div className="text-xs text-center text-muted-foreground">
                      {daySchedule.scheduleType === 'FULL_DAY' && 'Journée complète'}
                      {daySchedule.scheduleType === 'PARTIAL_DAY' && 'Journée partielle'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border-t pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{totalDays}</div>
              <div className="text-sm text-muted-foreground mt-1">Jours travaillés</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{totalHours.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground mt-1">Heures totales</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleSave}
            disabled={disabled || isSaving}
            className="flex-1 min-h-[56px]"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer le brouillon'}
          </Button>

          {onSubmit && (
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleSubmit}
              disabled={disabled || !canSubmit || isSubmitting}
              className="flex-1 min-h-[56px] bg-primary hover:bg-primary/90"
            >
              <Send className="h-5 w-5 mr-2" />
              {isSubmitting ? 'Envoi...' : 'Soumettre pour approbation'}
            </Button>
          )}
        </div>

        {!canSubmit && weekSchedules.some((d) => d.status === 'approved') && (
          <div className="text-sm text-center text-muted-foreground">
            Cette semaine contient des horaires déjà approuvés
          </div>
        )}

        {!canSubmit && weekSchedules.every((d) => isFuture(d.date)) && (
          <div className="text-sm text-center text-amber-600">
            Vous ne pouvez pas soumettre une semaine future
          </div>
        )}
      </CardContent>
    </Card>
  );
}
