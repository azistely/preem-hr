/**
 * Week Selector Component
 *
 * HCI Principles Applied:
 * - Task-oriented: "Cette semaine" not "Go to current week"
 * - Large touch targets (44px min height)
 * - Clear visual hierarchy with week display
 * - Mobile-first: Responsive button layout
 * - Immediate feedback: Current week highlighted
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type WeekSelectorProps = {
  currentWeekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
};

export function WeekSelector({
  currentWeekStart,
  onPreviousWeek,
  onNextWeek,
  onToday,
  isCurrentWeek,
}: WeekSelectorProps) {
  const weekEnd = addDays(currentWeekStart, 6);

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Week Display */}
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-muted-foreground hidden sm:block" />
            <div>
              <div className="text-sm text-muted-foreground">Semaine du</div>
              <div className="text-xl font-bold">
                {format(currentWeekStart, 'd', { locale: fr })} -{' '}
                {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Previous Week */}
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 sm:flex-none"
              onClick={onPreviousWeek}
            >
              <ChevronLeft className="h-5 w-5 sm:mr-2" />
              <span className="hidden sm:inline">Précédente</span>
            </Button>

            {/* Current Week */}
            <Button
              variant={isCurrentWeek ? 'default' : 'outline'}
              className={cn(
                'min-h-[44px] flex-1 sm:flex-none',
                isCurrentWeek && 'bg-primary'
              )}
              onClick={onToday}
              disabled={isCurrentWeek}
            >
              <Calendar className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cette semaine</span>
              <span className="sm:hidden">Actuelle</span>
            </Button>

            {/* Next Week */}
            <Button
              variant="outline"
              className="min-h-[44px] flex-1 sm:flex-none"
              onClick={onNextWeek}
            >
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRight className="h-5 w-5 sm:ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
