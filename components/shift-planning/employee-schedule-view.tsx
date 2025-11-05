/**
 * Employee Schedule View - Mobile-optimized schedule for employees
 *
 * Design Pattern: Mobile-First + Zero Learning Curve (HCI Principles)
 * - Large, clear cards (min 56px touch targets)
 * - Timeline view (chronological)
 * - Read-only view (shifts auto-confirmed when published)
 * - Total hours display
 * - Simple, task-oriented interface
 *
 * Note: In West African context, shifts are automatically confirmed when published.
 * No manual confirmation needed from employees.
 */

'use client';

import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Calendar,
  Check,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannedShift, ShiftTemplate } from '@/lib/db/schema/shift-planning';

// ============================================
// Types
// ============================================

export type EmployeeShift = PlannedShift & {
  template?: ShiftTemplate;
};

type EmployeeScheduleViewProps = {
  shifts: EmployeeShift[];
  totalHours: number;
  emptyMessage?: string;
};

// ============================================
// Component
// ============================================

export function EmployeeScheduleView({
  shifts,
  totalHours,
  emptyMessage = 'Aucun quart planifié pour cette période',
}: EmployeeScheduleViewProps) {
  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const date = shift.shiftDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, EmployeeShift[]>);

  // Sort dates
  const sortedDates = Object.keys(shiftsByDate).sort();

  // Calculate stats
  const upcomingShifts = shifts.filter(s => isFuture(parseISO(s.shiftDate)));

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Total Hours */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Heures Totales</span>
              </div>
              <div className="text-3xl font-bold">{totalHours.toFixed(1)}h</div>
            </div>

            {/* Upcoming Shifts */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Quarts à Venir</span>
              </div>
              <div className="text-3xl font-bold">{upcomingShifts.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shifts Timeline */}
      {sortedDates.length > 0 ? (
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <DayShiftsCard
              key={date}
              date={date}
              shifts={shiftsByDate[date]}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-muted p-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Aucun Quart</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {emptyMessage}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Day Shifts Card
// ============================================

type DayShiftsCardProps = {
  date: string;
  shifts: EmployeeShift[];
};

function DayShiftsCard({ date, shifts }: DayShiftsCardProps) {
  const dateObj = parseISO(date);
  const isCurrentDay = isToday(dateObj);
  const isPastDay = isPast(dateObj) && !isCurrentDay;
  const dayName = format(dateObj, 'EEEE', { locale: fr });
  const dayDate = format(dateObj, 'd MMMM yyyy', { locale: fr });

  // Calculate total hours for the day
  const totalDayHours = shifts.reduce((sum, s) => sum + parseFloat(s.paidHours || '0'), 0);

  return (
    <Card className={cn(
      isCurrentDay && 'ring-2 ring-primary',
      isPastDay && 'opacity-70'
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className={cn(
              'text-sm font-medium uppercase tracking-wider',
              isCurrentDay ? 'text-primary' : 'text-muted-foreground'
            )}>
              {dayName}
            </div>
            <CardTitle className="text-xl">{dayDate}</CardTitle>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold">{totalDayHours.toFixed(1)}h</div>
            <div className="text-xs text-muted-foreground">
              {shifts.length} quart{shifts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            isPast={isPastDay}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// Shift Card
// ============================================

type ShiftCardProps = {
  shift: EmployeeShift;
  isPast: boolean;
};

function ShiftCard({ shift, isPast }: ShiftCardProps) {
  const isConfirmed = !!shift.confirmedAt;

  const statusConfig = {
    draft: { label: 'Brouillon', color: 'bg-secondary' },
    published: { label: 'Publié', color: 'bg-primary' },
    confirmed: { label: 'Confirmé', color: 'bg-green-500' },
    no_show: { label: 'Absent', color: 'bg-gray-400' },
    cancelled: { label: 'Annulé', color: 'bg-gray-300' },
  };

  const status = isConfirmed ? 'confirmed' : shift.status;
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.published;

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3 transition-all',
      isConfirmed && 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
      shift.status === 'cancelled' && 'opacity-60'
    )}>
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {shift.template && (
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: shift.template.color || '#666' }}
            />
          )}
          <span className="font-semibold">
            {shift.template?.name || 'Quart'}
          </span>
        </div>

        <Badge className={config.color}>
          {config.label}
        </Badge>
      </div>

      {/* Time Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">
              {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
            </div>
            <div className="text-sm text-muted-foreground">
              {shift.paidHours}h payées
              {shift.breakMinutes && shift.breakMinutes > 0 && (
                <span className="ml-2">
                  (pause {shift.breakMinutes} min)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {shift.notes && (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
          {shift.notes}
        </div>
      )}

      {/* Published/Confirmed Status */}
      {isConfirmed && shift.publishedAt && (
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
          <Check className="h-4 w-4" />
          <span>Publié le {format(new Date(shift.publishedAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
        </div>
      )}
    </div>
  );
}
