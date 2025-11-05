/**
 * Manager Shift Planning Page
 *
 * Allows managers to plan and manage shifts for their team.
 *
 * Features:
 * - Weekly calendar view with drag-and-drop (future)
 * - Create/edit shifts with conflict detection
 * - Template-based quick assignment
 * - Publish schedules to employees
 * - Template management
 *
 * HCI Principles:
 * - Zero Learning Curve - Visual calendar, obvious actions
 * - Task-Oriented - "Plan shifts for my team" not "Manage shift records"
 * - Smart Defaults - Current week, most-used templates
 * - Error Prevention - Conflict detection before save
 */

'use client';

import { useState, useMemo } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Settings, Plus } from 'lucide-react';
import { ShiftPlanningCalendar } from '@/components/shift-planning/shift-planning-calendar';
import { ShiftTemplateManager } from '@/components/shift-planning/shift-template-manager';
import type { ShiftWithEmployee } from '@/components/shift-planning/shift-planning-calendar';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function ManagerShiftPlanningPage() {
  // Smart default: Current week (Monday)
  const [weekStartDate, setWeekStartDate] = useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [selectedTab, setSelectedTab] = useState<'calendar' | 'templates'>('calendar');
  const [createShiftDate, setCreateShiftDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftWithEmployee | null>(null);

  // Calculate week range
  const weekStart = useMemo(() => startOfWeek(weekStartDate, { weekStartsOn: 1 }), [weekStartDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const startDateStr = weekStart.toISOString().split('T')[0];
  const endDateStr = weekEnd.toISOString().split('T')[0];

  // Fetch weekly schedule
  const {
    data: scheduleData,
    isLoading: loadingSchedule,
    refetch: refetchSchedule,
  } = trpc.shiftPlanning.getWeeklySchedule.useQuery({
    startDate: startDateStr,
    endDate: endDateStr,
  });

  // Fetch templates
  const {
    data: templatesData,
    isLoading: loadingTemplates,
    refetch: refetchTemplates,
  } = trpc.shiftPlanning.getTemplates.useQuery({
    isActive: true,
  });

  // Fetch employees (for quick assignment)
  const { data: employeesData } = trpc.employees.list.useQuery({
    status: 'active',
    limit: 100, // Max limit allowed by API
  });

  // Mutations
  const publishMutation = trpc.shiftPlanning.publishSchedule.useMutation({
    onSuccess: () => {
      toast.success('Planning publié avec succès!');
      refetchSchedule();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteTemplateMutation = trpc.shiftPlanning.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Modèle supprimé');
      refetchTemplates();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const createDefaultTemplatesMutation = trpc.shiftPlanning.createDefaultTemplates.useMutation({
    onSuccess: () => {
      toast.success('Modèles par défaut créés!');
      refetchTemplates();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Handlers
  const handleWeekChange = (newWeekStart: Date) => {
    setWeekStartDate(newWeekStart);
  };

  const handleCreateShift = (date: string) => {
    setCreateShiftDate(date);
    // TODO: Open create shift dialog
    console.log('Create shift for date:', date);
    toast.info('Fonctionnalité "Créer un quart" à venir dans la prochaine session');
  };

  const handleEditShift = (shift: ShiftWithEmployee) => {
    setEditingShift(shift);
    // TODO: Open edit shift dialog
    console.log('Edit shift:', shift);
    toast.info('Fonctionnalité "Modifier un quart" à venir dans la prochaine session');
  };

  const handlePublishWeek = async () => {
    await publishMutation.mutateAsync({
      startDate: startDateStr,
      endDate: endDateStr,
    });
  };

  const handleCreateTemplate = () => {
    // TODO: Open create template dialog
    console.log('Create template');
    toast.info('Fonctionnalité "Créer un modèle" à venir dans la prochaine session');
  };

  const handleEditTemplate = (template: any) => {
    // TODO: Open edit template dialog
    console.log('Edit template:', template);
    toast.info('Fonctionnalité "Modifier un modèle" à venir dans la prochaine session');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplateMutation.mutateAsync({ id: templateId });
  };

  const handleDuplicateTemplate = (template: any) => {
    // TODO: Open create dialog with pre-filled values
    console.log('Duplicate template:', template);
    toast.info('Fonctionnalité "Dupliquer un modèle" à venir dans la prochaine session');
  };

  const handleCreateDefaultTemplates = async () => {
    await createDefaultTemplatesMutation.mutateAsync();
  };

  // Prepare shifts data
  const shifts: ShiftWithEmployee[] = scheduleData || [];
  const templates = templatesData || [];

  // Check if can publish (has draft shifts without conflicts)
  const canPublish = useMemo(() => {
    const draftShifts = shifts.filter((s) => s.status === 'draft');
    const hasConflicts = shifts.some((s) => s.hasConflicts);
    return draftShifts.length > 0 && !hasConflicts;
  }, [shifts]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planning des Quarts</h1>
          <p className="text-muted-foreground">
            Planifiez les quarts de travail de votre équipe
          </p>
        </div>

        {/* Quick Actions */}
        {templates.length === 0 && selectedTab === 'templates' && (
          <Button
            onClick={handleCreateDefaultTemplates}
            disabled={createDefaultTemplatesMutation.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Créer les Modèles par Défaut
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Settings className="h-4 w-4" />
            Modèles
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          {loadingSchedule ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  Chargement du planning...
                </div>
              </CardContent>
            </Card>
          ) : (
            <ShiftPlanningCalendar
              weekStartDate={weekStartDate}
              shifts={shifts}
              templates={templates}
              onCreateShift={handleCreateShift}
              onEditShift={handleEditShift}
              onPublishWeek={canPublish ? handlePublishWeek : undefined}
              onWeekChange={handleWeekChange}
              isLoading={publishMutation.isPending}
              canPublish={canPublish}
            />
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {loadingTemplates ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  Chargement des modèles...
                </div>
              </CardContent>
            </Card>
          ) : (
            <ShiftTemplateManager
              templates={templates}
              onCreateTemplate={handleCreateTemplate}
              onEditTemplate={handleEditTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onDuplicateTemplate={handleDuplicateTemplate}
              isLoading={deleteTemplateMutation.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
