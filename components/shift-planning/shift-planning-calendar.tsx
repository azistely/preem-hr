/**
 * Shift Planning Calendar - Weekly shift scheduling interface
 *
 * Design Pattern: Progressive Disclosure + Task-Oriented (HCI Principles)
 * - Show 7-day week grid (Monday-Sunday)
 * - Drag-and-drop shift assignment (future: Phase 4)
 * - Large touch targets (min 56px height)
 * - Color-coded shifts by template
 * - Instant conflict detection
 * - Mobile-first design
 */

'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isFuture, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Check,
  Clock,
  Users,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannedShift, ShiftTemplate } from '@/lib/db/schema/shift-planning';

// ============================================
// Types
// ============================================

export type ShiftWithEmployee = PlannedShift & {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  template?: ShiftTemplate;
};

export type DayShifts = {
  date: Date;
  dateString: string; // YYYY-MM-DD
  shifts: ShiftWithEmployee[];
  totalEmployees: number;
  hasConflicts: boolean;
};

export type WeekSchedule = DayShifts[];

type ShiftPlanningCalendarProps = {
  weekStartDate: Date;
  shifts: ShiftWithEmployee[];
  templates: ShiftTemplate[];
  onCreateShift: (date: string) => void;
  onEditShift: (shift: ShiftWithEmployee) => void;
  onPublishWeek?: () => Promise<void>;
  onWeekChange: (newWeekStart: Date) => void;
  isLoading?: boolean;
  canPublish?: boolean;
};

// ============================================
// Component
// ============================================

export function ShiftPlanningCalendar({
  weekStartDate,
  shifts,
  templates,
  onCreateShift,
  onEditShift,
  onPublishWeek,
  onWeekChange,
  isLoading = false,
  canPublish = false,
}: ShiftPlanningCalendarProps) {
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 }); // Monday
  const [isPublishing, setIsPublishing] = useState(false);

  // Build week schedule
  const weekSchedule: WeekSchedule = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateString = format(date, 'yyyy-MM-dd');

    const dayShifts = shifts.filter(
      (s) => s.shiftDate === dateString && s.status !== 'cancelled'
    );

    const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId));
    const hasConflicts = dayShifts.some((s) => s.hasConflicts);

    return {
      date,
      dateString,
      shifts: dayShifts,
      totalEmployees: uniqueEmployees.size,
      hasConflicts,
    };
  });

  // Calculate week summary
  const totalShifts = shifts.filter(s => s.status !== 'cancelled').length;
  const draftShifts = shifts.filter(s => s.status === 'draft').length;
  const publishedShifts = shifts.filter(s => s.status === 'published').length;
  const totalConflicts = shifts.filter(s => s.hasConflicts).length;

  // Navigation
  const goToPreviousWeek = () => {
    onWeekChange(addDays(weekStart, -7));
  };

  const goToNextWeek = () => {
    onWeekChange(addDays(weekStart, 7));
  };

  const goToToday = () => {
    onWeekChange(new Date());
  };

  // Publish week
  const handlePublish = async () => {
    if (!onPublishWeek || !canPublish) return;

    setIsPublishing(true);
    try {
      await onPublishWeek();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Planning des Quarts</CardTitle>
              <CardDescription>
                Semaine du {format(weekStart, 'dd MMMM yyyy', { locale: fr })}
              </CardDescription>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                disabled={isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                disabled={isLoading}
              >
                Aujourd'hui
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week Summary */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{totalShifts}</span> quarts
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {draftShifts} brouillon{draftShifts !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="default">
                {publishedShifts} publié{publishedShifts !== 1 ? 's' : ''}
              </Badge>
            </div>

            {totalConflicts > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {totalConflicts} conflit{totalConflicts !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}

            {/* Publish Button */}
            {canPublish && draftShifts > 0 && (
              <div className="ml-auto">
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || totalConflicts > 0}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Publier la Semaine
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <div className="grid gap-3 md:grid-cols-7">
        {weekSchedule.map((day, index) => (
          <DayColumn
            key={day.dateString}
            day={day}
            onCreateShift={onCreateShift}
            onEditShift={onEditShift}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="font-semibold text-muted-foreground">Statuts:</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary" />
              <span>Brouillon</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Publié</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Confirmé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>Conflit</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Day Column Component
// ============================================

type DayColumnProps = {
  day: DayShifts;
  onCreateShift: (date: string) => void;
  onEditShift: (shift: ShiftWithEmployee) => void;
  isLoading: boolean;
};

function DayColumn({ day, onCreateShift, onEditShift, isLoading }: DayColumnProps) {
  const isCurrentDay = isToday(day.date);
  const isPast = !isFuture(day.date) && !isCurrentDay;

  return (
    <Card
      className={cn(
        'min-h-[300px] transition-all',
        isCurrentDay && 'ring-2 ring-primary',
        isPast && 'opacity-60'
      )}
    >
      <CardHeader className="pb-3">
        <div className="space-y-1">
          {/* Day Name */}
          <div className={cn(
            'text-xs font-medium uppercase tracking-wider',
            isCurrentDay ? 'text-primary' : 'text-muted-foreground'
          )}>
            {format(day.date, 'EEEE', { locale: fr })}
          </div>

          {/* Date */}
          <div className={cn(
            'text-2xl font-bold',
            isCurrentDay && 'text-primary'
          )}>
            {format(day.date, 'd')}
          </div>

          {/* Employee Count */}
          {day.totalEmployees > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{day.totalEmployees} employé{day.totalEmployees !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Shifts */}
        {day.shifts.length > 0 ? (
          <div className="space-y-2">
            {day.shifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                onClick={() => onEditShift(shift)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun quart planifié
          </div>
        )}

        {/* Add Shift Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 min-h-[44px]"
          onClick={() => onCreateShift(day.dateString)}
          disabled={isLoading || isPast}
        >
          <Plus className="h-4 w-4" />
          Ajouter un Quart
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// Shift Card Component
// ============================================

type ShiftCardProps = {
  shift: ShiftWithEmployee;
  onClick: () => void;
};

function ShiftCard({ shift, onClick }: ShiftCardProps) {
  const statusColors = {
    draft: 'bg-secondary text-secondary-foreground',
    published: 'bg-primary text-primary-foreground',
    confirmed: 'bg-green-500 text-white',
    no_show: 'bg-gray-400 text-white',
    cancelled: 'bg-gray-300 text-gray-600',
  };

  const statusColor = statusColors[shift.status as keyof typeof statusColors] || statusColors.draft;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg p-3 space-y-2 transition-all hover:shadow-md min-h-[56px]',
        statusColor,
        shift.hasConflicts && 'ring-2 ring-destructive'
      )}
    >
      {/* Employee Name */}
      <div className="font-medium text-sm truncate">
        {shift.employee ? (
          <>
            {shift.employee.firstName} {shift.employee.lastName}
          </>
        ) : (
          'Employé inconnu'
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-xs opacity-90">
        <Clock className="h-3 w-3" />
        <span>
          {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
        </span>
        <span className="font-semibold">
          ({shift.paidHours}h)
        </span>
      </div>

      {/* Template Color Indicator */}
      {shift.template && (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: shift.template.color || '#666' }}
          />
          <span className="text-xs opacity-90">{shift.template.name}</span>
        </div>
      )}

      {/* Conflict Indicator */}
      {shift.hasConflicts && (
        <div className="flex items-center gap-1 text-xs text-destructive bg-white/90 dark:bg-black/90 px-2 py-1 rounded">
          <AlertCircle className="h-3 w-3" />
          <span className="font-medium">Conflit détecté</span>
        </div>
      )}
    </button>
  );
}
