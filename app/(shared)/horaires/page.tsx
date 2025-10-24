/**
 * Work Schedules Page - Mes Horaires
 *
 * Allows daily/hourly workers to:
 * - View and edit their weekly schedule
 * - Submit weeks for manager approval
 * - View monthly totals
 *
 * HCI Principles Applied:
 * - Task-oriented: "Enregistrer mes heures" not "Create schedule"
 * - Touch-friendly: 56px buttons, large touch targets
 * - Progressive disclosure: Monthly details collapsible
 * - Smart defaults: Full day = 8h auto-filled
 * - Mobile-first: Works on 375px width
 * - Combines new day-card approach with existing grid view in tabs
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, CheckCircle2, Loader2, Grid3x3 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';
import { WeekSelector } from './_components/week-selector';
import { ScheduleDayCard } from './_components/schedule-day-card';
import { MonthlySummary } from './_components/monthly-summary';
import { WeeklyScheduleGrid } from '@/components/work-schedules/weekly-schedule-grid';
import { MonthlyCalendar } from '@/components/work-schedules/monthly-calendar';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isSameWeek,
  startOfMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export default function HorairesPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  const [activeView, setActiveView] = useState<'cards' | 'grid' | 'month'>('cards');
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Get current employee
  const { data: employee, isLoading: isLoadingEmployee } = trpc.employees.getCurrentEmployee.useQuery();

  // Get schedules for current week
  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Extract employee ID (handle nested structure from service)
  const employeeId = (employee as any)?.id || '';

  const { data: schedules, isLoading: isLoadingSchedules } =
    trpc.workSchedules.getSchedules.useQuery(
      {
        employeeId: employeeId,
        startDate: weekStart,
        endDate: weekEnd,
      },
      {
        enabled: !!employeeId,
      }
    );

  // Get monthly totals
  const { data: monthlyTotals } = trpc.workSchedules.getMonthTotals.useQuery(
    {
      employeeId: employeeId,
      month: startOfMonth(currentWeekStart),
    },
    {
      enabled: !!employeeId,
    }
  );

  // Get month schedules for calendar view
  const { data: monthSchedules } = trpc.workSchedules.getMonthSchedule.useQuery(
    {
      employeeId: employeeId,
      month: currentWeekStart,
    },
    {
      enabled: !!employeeId,
    }
  );

  // Submit week for approval
  const submitWeekMutation = trpc.workSchedules.submitForApproval.useMutation({
    onSuccess: () => {
      toast({
        title: 'Semaine soumise',
        description: 'Vos horaires ont été envoyés pour approbation.',
      });
      utils.workSchedules.getSchedules.invalidate();
      utils.workSchedules.getMonthTotals.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Quick action: Fill full week (40h)
  const recordWeekMutation = trpc.workSchedules.recordWeek.useMutation({
    onSuccess: () => {
      toast({
        title: 'Semaine enregistrée',
        description: 'Semaine complète (40h) enregistrée avec succès.',
      });
      utils.workSchedules.getSchedules.invalidate();
      utils.workSchedules.getMonthTotals.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFillFullWeek = () => {
    if (!employeeId) return;

    // Fill Mon-Fri with 8h each (standard work week)
    const weekSchedules = daysInWeek.slice(0, 5).map((day) => ({
      workDate: day,
      isPresent: true,
      hoursWorked: 8,
      scheduleType: 'FULL_DAY' as const,
    }));

    recordWeekMutation.mutate({
      employeeId: employeeId,
      weekSchedules,
    });
  };

  const handleSubmitWeek = () => {
    if (!employeeId) return;

    submitWeekMutation.mutate({
      employeeId: employeeId,
      weekStartDate: weekStart,
    });
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleToday = () => {
    setCurrentWeekStart(new Date());
  };

  // For grid view handlers
  const handleSaveWeek = async (schedules: any[]) => {
    if (!employeeId) return;

    await recordWeekMutation.mutateAsync({
      employeeId: employeeId,
      weekSchedules: schedules.map((s) => ({
        workDate: s.date,
        isPresent: s.isPresent,
        hoursWorked: s.hoursWorked,
        startTime: s.startTime,
        endTime: s.endTime,
        scheduleType: s.scheduleType,
        notes: s.notes,
      })),
    });
  };

  const handleSubmitWeekGrid = async (schedules: any[]) => {
    if (!employeeId) return;

    // First save
    await handleSaveWeek(schedules);

    // Then submit
    await submitWeekMutation.mutateAsync({
      employeeId: employeeId,
      weekStartDate: weekStart,
    });
  };

  // Calculate week totals
  const weekSchedules = schedules || [];
  const weekTotalHours = weekSchedules.reduce(
    (sum, s) => sum + (s.isPresent ? Number(s.hoursWorked || 0) : 0),
    0
  );
  const weekTotalDays = weekSchedules.filter((s) => s.isPresent).length;
  const hasAnySchedule = weekSchedules.length > 0;
  const allDraft = weekSchedules.every((s) => s.status === 'draft');
  const allPending = weekSchedules.every((s) => s.status === 'pending');
  const allApproved = weekSchedules.every((s) => s.status === 'approved');
  const hasMixed = !allDraft && !allPending && !allApproved && hasAnySchedule;

  // Determine week status
  let weekStatus = 'Aucun horaire';
  let weekStatusVariant: 'default' | 'secondary' | 'success' | 'outline' = 'default';

  if (allApproved) {
    weekStatus = 'Approuvé';
    weekStatusVariant = 'success';
  } else if (allPending) {
    weekStatus = 'En attente';
    weekStatusVariant = 'secondary';
  } else if (allDraft) {
    weekStatus = 'Brouillon';
    weekStatusVariant = 'outline';
  } else if (hasMixed) {
    weekStatus = 'Mixte';
    weekStatusVariant = 'secondary';
  }

  const isCurrentWeek = isSameWeek(currentWeekStart, new Date(), { weekStartsOn: 1 });

  if (isLoadingEmployee) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Aucun profil employé trouvé</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Clock className="h-8 w-8" />
          Mes Horaires
        </h1>
        <p className="text-muted-foreground mt-2">
          Enregistrez vos jours et heures travaillés
        </p>
      </div>

      {/* Monthly Summary Card */}
      <MonthlySummary
        monthlyTotals={monthlyTotals}
        currentMonth={currentWeekStart}
      />

      {/* View Selector */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'cards' | 'grid' | 'month')}>
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="cards" className="gap-2">
            <Calendar className="h-4 w-4" />
            Cartes
          </TabsTrigger>
          <TabsTrigger value="grid" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            Grille
          </TabsTrigger>
          <TabsTrigger value="month" className="gap-2">
            <Calendar className="h-4 w-4" />
            Mois
          </TabsTrigger>
        </TabsList>

        {/* Cards View (New HCI-optimized) */}
        <TabsContent value="cards" className="space-y-6">
          {/* Week Selector */}
          <WeekSelector
            currentWeekStart={weekStart}
            onPreviousWeek={handlePreviousWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
            isCurrentWeek={isCurrentWeek}
          />

          {/* Week Summary Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Jours travaillés</div>
                    <div className="text-2xl font-bold">{weekTotalDays}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Heures totales</div>
                    <div className="text-2xl font-bold">{weekTotalHours}h</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Statut</div>
                    <div className="text-lg font-semibold">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                          weekStatusVariant === 'success'
                            ? 'bg-green-100 text-green-800'
                            : weekStatusVariant === 'secondary'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {weekStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="min-h-[56px] w-full"
              onClick={handleFillFullWeek}
              disabled={recordWeekMutation.isPending || !allDraft}
            >
              {recordWeekMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-5 w-5" />
                  Semaine complète (40h)
                </>
              )}
            </Button>

            <Button
              className="min-h-[56px] w-full"
              onClick={handleSubmitWeek}
              disabled={
                !hasAnySchedule ||
                !allDraft ||
                weekTotalDays === 0 ||
                submitWeekMutation.isPending
              }
            >
              {submitWeekMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Soumission...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Soumettre pour approbation
                </>
              )}
            </Button>
          </div>

          {/* Week Calendar (Day Cards) */}
          <div className="space-y-3">
            {isLoadingSchedules ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              daysInWeek.map((day) => {
                const schedule = weekSchedules.find(
                  (s) => format(new Date(s.workDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                );

                return (
                  <ScheduleDayCard
                    key={format(day, 'yyyy-MM-dd')}
                    date={day}
                    schedule={schedule}
                    employeeId={employeeId}
                    onScheduleUpdated={() => {
                      utils.workSchedules.getSchedules.invalidate();
                      utils.workSchedules.getMonthTotals.invalidate();
                    }}
                  />
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Grid View (Original) */}
        <TabsContent value="grid">
          {isLoadingSchedules ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-muted-foreground">Chargement...</div>
              </CardContent>
            </Card>
          ) : (
            <WeeklyScheduleGrid
              weekStartDate={weekStart}
              initialSchedules={weekSchedules}
              onSave={handleSaveWeek}
              onSubmit={handleSubmitWeekGrid}
              disabled={recordWeekMutation.isPending || submitWeekMutation.isPending}
            />
          )}
        </TabsContent>

        {/* Month View */}
        <TabsContent value="month">
          <MonthlyCalendar
            month={currentWeekStart}
            schedules={monthSchedules || []}
            onMonthChange={setCurrentWeekStart}
            readOnly
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
