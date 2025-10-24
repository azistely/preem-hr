/**
 * Monthly Calendar - Visual month view of work schedules
 *
 * Design Pattern: Information Radiator + Progressive Disclosure
 * - Calendar grid showing entire month
 * - Color-coded days (green=worked, gray=absent, yellow=partial)
 * - Click day to view/edit details
 * - Summary totals at bottom
 * - Mobile-friendly (responsive grid)
 */

'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isFuture,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkSchedule } from '@/lib/db/schema/work-schedules';

type MonthlyCalendarProps = {
  month: Date;
  schedules: WorkSchedule[];
  onMonthChange?: (newMonth: Date) => void;
  onDayClick?: (date: Date) => void;
  readOnly?: boolean;
};

export function MonthlyCalendar({
  month,
  schedules,
  onMonthChange,
  onDayClick,
  readOnly = false,
}: MonthlyCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Generate calendar days
  const calendarDays: Date[] = [];
  let currentDay = calendarStart;
  while (currentDay <= calendarEnd) {
    calendarDays.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  // Get schedule for a specific day
  const getScheduleForDay = (date: Date): WorkSchedule | undefined => {
    return schedules.find((s) =>
      isSameDay(new Date(s.workDate), date)
    );
  };

  // Calculate monthly totals
  const monthSchedules = schedules.filter((s) => {
    const scheduleDate = new Date(s.workDate);
    return isSameMonth(scheduleDate, month);
  });

  const totalDays = monthSchedules.filter((s) => s.isPresent).length;
  const totalHours = monthSchedules.reduce(
    (sum, s) => sum + (s.isPresent ? Number(s.hoursWorked || 0) : 0),
    0
  );
  const approvedDays = monthSchedules.filter((s) => s.status === 'approved').length;
  const pendingDays = monthSchedules.filter((s) => s.status === 'pending').length;

  // Handle day click
  const handleDayClick = (date: Date) => {
    if (readOnly || !isSameMonth(date, month)) return;

    setSelectedDay(date);
    onDayClick?.(date);
  };

  // Navigate months
  const previousMonth = () => {
    const newMonth = addDays(monthStart, -1);
    onMonthChange?.(newMonth);
  };

  const nextMonth = () => {
    const newMonth = addDays(monthEnd, 1);
    onMonthChange?.(newMonth);
  };

  // Get day cell style
  const getDayCellClass = (date: Date, schedule?: WorkSchedule) => {
    const isCurrentMonth = isSameMonth(date, month);
    const isTodayDate = isToday(date);
    const isFutureDate = isFuture(date);

    return cn(
      'min-h-[80px] sm:min-h-[100px] p-2 border border-gray-200 cursor-pointer transition-all hover:bg-gray-50',
      !isCurrentMonth && 'bg-gray-100 text-gray-400',
      isTodayDate && 'ring-2 ring-primary ring-inset',
      isFutureDate && isCurrentMonth && 'bg-gray-50',
      // Present day - approved
      schedule?.isPresent && schedule?.status === 'approved' && 'bg-green-100 hover:bg-green-200',
      // Present day - pending
      schedule?.isPresent && schedule?.status === 'pending' && 'bg-yellow-100 hover:bg-yellow-200',
      // Present day - draft
      schedule?.isPresent && schedule?.status === 'draft' && 'bg-blue-50 hover:bg-blue-100',
      // Absent
      schedule?.isPresent === false && 'bg-gray-200',
      readOnly && 'cursor-default hover:bg-transparent'
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl capitalize">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              disabled={!onMonthChange}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              disabled={!onMonthChange}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Week Day Headers */}
          <div className="grid grid-cols-7 bg-gray-50">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-semibold text-gray-700 border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const schedule = getScheduleForDay(date);
              const dayNumber = format(date, 'd');

              return (
                <div
                  key={date.toISOString()}
                  className={getDayCellClass(date, schedule)}
                  onClick={() => handleDayClick(date)}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'text-sm font-medium',
                      isToday(date) && 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs'
                    )}>
                      {dayNumber}
                    </span>

                    {/* Status Icon */}
                    {schedule && (
                      <div>
                        {schedule.status === 'approved' && (
                          <Check className="h-4 w-4 text-green-700" />
                        )}
                        {schedule.status === 'pending' && (
                          <Clock className="h-4 w-4 text-yellow-700" />
                        )}
                        {schedule.isPresent === false && (
                          <X className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hours (if present) */}
                  {schedule?.isPresent && (
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {Number(schedule.hoursWorked || 0).toFixed(1)}h
                      </div>
                      <div className="text-xs text-gray-600">
                        {schedule.scheduleType === 'FULL_DAY' && 'Journée'}
                        {schedule.scheduleType === 'PARTIAL_DAY' && 'Partiel'}
                      </div>
                    </div>
                  )}

                  {/* Absent Label */}
                  {schedule?.isPresent === false && (
                    <div className="text-center text-xs text-gray-500 mt-2">
                      Absent
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl font-bold text-primary">{totalDays}</div>
            <div className="text-sm text-muted-foreground mt-1">Jours travaillés</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl font-bold text-primary">{totalHours.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">Heures totales</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl font-bold text-green-600">{approvedDays}</div>
            <div className="text-sm text-muted-foreground mt-1">Jours approuvés</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{pendingDays}</div>
            <div className="text-sm text-muted-foreground mt-1">En attente</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
            <span>Approuvé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span>En attente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Brouillon</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
            <span>Absent</span>
          </div>
        </div>
      </CardContent>

      {/* Day Details Dialog */}
      {selectedDay && (
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
              </DialogTitle>
              <DialogDescription>
                Détails de la journée
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {(() => {
                const schedule = getScheduleForDay(selectedDay);

                if (!schedule) {
                  return (
                    <div className="text-center text-muted-foreground py-8">
                      Aucun horaire enregistré pour ce jour
                    </div>
                  );
                }

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Statut:</span>
                      <Badge
                        variant={
                          schedule.status === 'approved'
                            ? 'default'
                            : schedule.status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {schedule.status === 'approved' && 'Approuvé'}
                        {schedule.status === 'pending' && 'En attente'}
                        {schedule.status === 'draft' && 'Brouillon'}
                        {schedule.status === 'rejected' && 'Rejeté'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Présence:</span>
                      <span>{schedule.isPresent ? 'Présent' : 'Absent'}</span>
                    </div>

                    {schedule.isPresent && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Heures travaillées:</span>
                          <span className="text-lg font-bold">
                            {Number(schedule.hoursWorked || 0).toFixed(1)} heures
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-medium">Type:</span>
                          <span>
                            {schedule.scheduleType === 'FULL_DAY' && 'Journée complète'}
                            {schedule.scheduleType === 'PARTIAL_DAY' && 'Journée partielle'}
                          </span>
                        </div>

                        {(schedule.startTime || schedule.endTime) && (
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Horaires:</span>
                            <span>
                              {schedule.startTime} - {schedule.endTime}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {schedule.notes && (
                      <div>
                        <div className="font-medium mb-1">Notes:</div>
                        <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                          {schedule.notes}
                        </div>
                      </div>
                    )}

                    {schedule.rejectedReason && (
                      <div>
                        <div className="font-medium mb-1 text-destructive">
                          Raison du rejet:
                        </div>
                        <div className="text-sm bg-destructive/10 p-3 rounded">
                          {schedule.rejectedReason}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
