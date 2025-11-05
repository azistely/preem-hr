/**
 * Employee Schedule Page
 *
 * Shows employee their upcoming shifts (read-only view).
 *
 * Features:
 * - View published shifts
 * - See total hours
 * - Simple, mobile-optimized interface
 *
 * Note: In West African context, shifts are automatically confirmed when published by management.
 * Employees are expected to show up for assigned shifts - no manual confirmation needed.
 *
 * HCI Principles:
 * - Zero Learning Curve - Clear timeline, simple view
 * - Task-Oriented - "View my shifts" not "Manage schedule"
 * - Mobile-First - Large touch targets, simple layout
 * - Clear Visual Hierarchy - Focus on upcoming shifts
 */

'use client';

import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { EmployeeScheduleView, type EmployeeShift } from '@/components/shift-planning/employee-schedule-view';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function EmployeeSchedulePage() {
  // Get employee ID from auth context
  const { data: authData } = trpc.auth.me.useQuery();
  const employeeId = authData?.employeeId;

  // Smart default: Current month
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());

  // Calculate month range
  const monthStart = useMemo(() => startOfMonth(selectedMonth), [selectedMonth]);
  const monthEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);

  const startDateStr = monthStart.toISOString().split('T')[0];
  const endDateStr = monthEnd.toISOString().split('T')[0];

  // Fetch schedule
  const {
    data: scheduleData,
    isLoading: loadingSchedule,
    refetch: refetchSchedule,
  } = trpc.shiftPlanning.getMySchedule.useQuery(
    {
      employeeId: employeeId!,
      startDate: startDateStr,
      endDate: endDateStr,
    },
    {
      enabled: !!employeeId,
    }
  );

  // Fetch total hours
  const { data: hoursData } = trpc.shiftPlanning.getMyTotalHours.useQuery(
    {
      employeeId: employeeId!,
      startDate: startDateStr,
      endDate: endDateStr,
    },
    {
      enabled: !!employeeId,
    }
  );

  // Handlers
  const handlePreviousMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setSelectedMonth(new Date());
  };

  // Prepare data
  const shifts: EmployeeShift[] = scheduleData || [];
  const totalHours = hoursData?.totalHours || 0;

  const displayPeriod = format(selectedMonth, 'MMMM yyyy', { locale: fr });

  if (!employeeId) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Impossible de charger votre planning. Veuillez vous reconnecter.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Mon Planning</h1>
          <p className="text-muted-foreground">
            Consultez vos quarts à venir
          </p>
        </div>

        {/* Month Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl capitalize">{displayPeriod}</CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousMonth}
                  disabled={loadingSchedule}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  disabled={loadingSchedule}
                >
                  Aujourd'hui
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  disabled={loadingSchedule}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Schedule */}
      {loadingSchedule ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Chargement de votre planning...
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmployeeScheduleView
          shifts={shifts}
          totalHours={totalHours}
          emptyMessage={`Aucun quart planifié pour ${displayPeriod}`}
        />
      )}
    </div>
  );
}
