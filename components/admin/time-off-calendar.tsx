/**
 * Time-Off Calendar View
 *
 * Monthly calendar showing leave requests with:
 * - Visual day cells with leave count indicators
 * - Color-coded by status (pending, approved)
 * - Click on day to see details
 * - Mobile-responsive grid
 * - French locale
 */

'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, FileDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV, preparePDFData } from '@/lib/exports/time-off-export';
import { pdf } from '@react-pdf/renderer';
import { TimeOffPDF } from '@/components/exports/time-off-pdf';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
  };
  startDate: string;
  endDate: string;
  status: string;
  policy: {
    name: string;
    policyType: string;
  };
}

interface TimeOffCalendarProps {
  requests: LeaveRequest[];
  onDayClick?: (date: Date, dayRequests: LeaveRequest[]) => void;
}

export function TimeOffCalendar({ requests, onDayClick }: TimeOffCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get month bounds
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Get calendar grid (including days from prev/next month to fill weeks)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group requests by date
  const requestsByDate = requests.reduce((acc, request) => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);

    // Add request to each day in the range
    const days = eachDayOfInterval({ start, end });
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(request);
    });

    return acc;
  }, {} as Record<string, LeaveRequest[]>);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const getDayRequests = (date: Date): LeaveRequest[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return requestsByDate[dateKey] || [];
  };

  const getDayStats = (date: Date) => {
    const dayRequests = getDayRequests(date);
    const approved = dayRequests.filter(r => r.status === 'approved').length;
    const pending = dayRequests.filter(r => r.status === 'pending').length;
    const planned = dayRequests.filter(r => r.status === 'planned').length;
    return { total: dayRequests.length, approved, pending, planned };
  };

  const handleDayClick = (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return; // Don't handle clicks on adjacent month days

    const dayRequests = getDayRequests(date);
    if (dayRequests.length > 0 && onDayClick) {
      onDayClick(date, dayRequests);
    }
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const today = new Date();

  // Export handlers
  const handleExportCSV = () => {
    exportToCSV(requests, currentMonth);
  };

  const handleExportPDF = async () => {
    const pdfData = preparePDFData(requests, currentMonth);
    const doc = <TimeOffPDF data={pdfData} />;
    const blob = await pdf(doc).toBlob();

    // Download file
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `conges-${format(currentMonth, 'yyyy-MM')}.pdf`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exporter en CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exporter en PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="hidden md:flex"
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}

          {/* Day cells */}
          {calendarDays.map((date) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const stats = getDayStats(date);
            const hasRequests = stats.total > 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                disabled={!isCurrentMonth || !hasRequests}
                className={cn(
                  'aspect-square p-2 rounded-lg border transition-all min-h-[80px] flex flex-col items-center justify-start gap-1',
                  isCurrentMonth ? 'bg-background hover:bg-muted' : 'bg-muted/30 text-muted-foreground',
                  isToday && 'ring-2 ring-primary',
                  hasRequests && isCurrentMonth && 'cursor-pointer hover:shadow-md',
                  !hasRequests && 'cursor-default'
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isToday && 'bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center'
                  )}
                >
                  {format(date, 'd')}
                </span>

                {/* Leave indicators */}
                {hasRequests && isCurrentMonth && (
                  <div className="flex flex-col gap-0.5 w-full">
                    {stats.approved > 0 && (
                      <div className="flex items-center justify-center gap-1">
                        <Badge
                          variant="default"
                          className="text-xs px-1 py-0 h-5 bg-green-500"
                        >
                          <Users className="h-3 w-3 mr-0.5" />
                          {stats.approved}
                        </Badge>
                      </div>
                    )}
                    {stats.planned > 0 && (
                      <div className="flex items-center justify-center gap-1">
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 h-5 border-blue-500 text-blue-700"
                        >
                          <Users className="h-3 w-3 mr-0.5" />
                          {stats.planned}
                        </Badge>
                      </div>
                    )}
                    {stats.pending > 0 && (
                      <div className="flex items-center justify-center gap-1">
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 h-5 border-amber-500 text-amber-700"
                        >
                          <Users className="h-3 w-3 mr-0.5" />
                          {stats.pending}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-muted-foreground">Légende:</span>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-500">
              <Users className="h-3 w-3 mr-1" />
              Approuvé
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-blue-500 text-blue-700">
              <Users className="h-3 w-3 mr-1" />
              Planifié
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              <Users className="h-3 w-3 mr-1" />
              En attente
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
