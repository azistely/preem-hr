/**
 * HR Manager Shift Planning Page
 *
 * Allows HR managers to plan and manage shifts across ALL departments.
 *
 * Features:
 * - Access to all departments (unlike regular managers)
 * - Weekly calendar view
 * - Department filter
 * - Create/edit shifts with conflict detection
 * - Template management (create, edit, delete)
 * - Publish schedules
 * - Analytics/coverage summary
 *
 * HCI Principles:
 * - Zero Learning Curve - Visual calendar, obvious actions
 * - Task-Oriented - "Plan shifts for entire company"
 * - Smart Defaults - Current week, all departments
 * - Error Prevention - Conflict detection
 */

'use client';

import { useState, useMemo } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Settings, Plus, Building2, BarChart } from 'lucide-react';
import { ShiftPlanningCalendar } from '@/components/shift-planning/shift-planning-calendar';
import { ShiftTemplateManager } from '@/components/shift-planning/shift-template-manager';
import { ShiftCreateEditDialog } from '@/components/shift-planning/shift-create-edit-dialog';
import { TemplateCreateEditDialog } from '@/components/shift-planning/template-create-edit-dialog';
import type { ShiftWithEmployee } from '@/components/shift-planning/shift-planning-calendar';
import type { ShiftTemplate } from '@/lib/db/schema/shift-planning';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function HRShiftPlanningPage() {
  // Smart default: Current week (Monday), all departments
  const [weekStartDate, setWeekStartDate] = useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [selectedTab, setSelectedTab] = useState<'calendar' | 'templates' | 'analytics'>('calendar');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [createShiftDate, setCreateShiftDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftWithEmployee | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);

  // Calculate week range
  const weekStart = useMemo(() => startOfWeek(weekStartDate, { weekStartsOn: 1 }), [weekStartDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const startDateStr = weekStart.toISOString().split('T')[0];
  const endDateStr = weekEnd.toISOString().split('T')[0];

  // Fetch weekly schedule (with optional department filter)
  const {
    data: scheduleData,
    isLoading: loadingSchedule,
    refetch: refetchSchedule,
  } = trpc.shiftPlanning.getWeeklySchedule.useQuery({
    startDate: startDateStr,
    endDate: endDateStr,
    departmentId: selectedDepartment === 'all' ? undefined : selectedDepartment,
  });

  // Fetch templates
  const {
    data: templatesData,
    isLoading: loadingTemplates,
    refetch: refetchTemplates,
  } = trpc.shiftPlanning.getTemplates.useQuery({
    isActive: true,
  });

  // TODO: Fetch departments (for filter) - departments router not yet implemented
  const departmentsData: any[] = [];

  // Fetch employees
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
    setIsCreateDialogOpen(true);
  };

  const handleEditShift = (shift: ShiftWithEmployee) => {
    setEditingShift(shift);
    setIsEditDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    refetchSchedule();
  };

  const handleCreateDialogClose = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateShiftDate(null);
    }
  };

  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingShift(null);
    }
  };

  const handlePublishWeek = async () => {
    await publishMutation.mutateAsync({
      startDate: startDateStr,
      endDate: endDateStr,
    });
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: ShiftTemplate) => {
    setEditingTemplate(template);
    setIsTemplateDialogOpen(true);
  };

  const handleTemplateDialogClose = (open: boolean) => {
    setIsTemplateDialogOpen(open);
    if (!open) {
      setEditingTemplate(null);
    }
  };

  const handleTemplateSuccess = () => {
    refetchTemplates();
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplateMutation.mutateAsync({ id: templateId });
  };

  const handleDuplicateTemplate = (template: any) => {
    // TODO: Open create dialog with pre-filled values
    console.log('Duplicate template:', template);
    toast.info('Fonctionnalité "Dupliquer un modèle" à venir - dialogs dans la prochaine session');
  };

  const handleCreateDefaultTemplates = async () => {
    await createDefaultTemplatesMutation.mutateAsync();
  };

  // Prepare shifts data
  const shifts: ShiftWithEmployee[] = scheduleData || [];
  const templates = templatesData || [];
  const departments = departmentsData || [];

  // Check if can publish (has draft shifts without conflicts)
  const canPublish = useMemo(() => {
    const draftShifts = shifts.filter((s) => s.status === 'draft');
    const hasConflicts = shifts.some((s) => s.hasConflicts);
    return draftShifts.length > 0 && !hasConflicts;
  }, [shifts]);

  // Calculate coverage summary (for analytics tab)
  const coverageSummary = useMemo(() => {
    const uniqueEmployees = new Set(shifts.map((s) => s.employeeId));
    const totalShifts = shifts.filter((s) => s.status !== 'cancelled').length;
    const confirmedShifts = shifts.filter((s) => s.confirmedAt).length;
    const totalHours = shifts
      .filter((s) => s.status !== 'cancelled')
      .reduce((sum, s) => sum + parseFloat(s.paidHours || '0'), 0);

    return {
      totalEmployees: uniqueEmployees.size,
      totalShifts,
      confirmedShifts,
      totalHours,
    };
  }, [shifts]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Planning des Quarts</h1>
            <Badge variant="default">RH</Badge>
          </div>
          <p className="text-muted-foreground">
            Gérez les quarts de travail de toute l'entreprise
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

      {/* Department Filter (only on calendar tab) */}
      {selectedTab === 'calendar' && departments.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filtrer par département</label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les départements</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart className="h-4 w-4" />
            Analytiques
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Employés Assignés</p>
                  <p className="text-3xl font-bold">{coverageSummary.totalEmployees}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Quarts</p>
                  <p className="text-3xl font-bold">{coverageSummary.totalShifts}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Confirmés</p>
                  <p className="text-3xl font-bold">{coverageSummary.confirmedShifts}</p>
                  <p className="text-xs text-muted-foreground">
                    {coverageSummary.totalShifts > 0
                      ? `${Math.round((coverageSummary.confirmedShifts / coverageSummary.totalShifts) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Heures</p>
                  <p className="text-3xl font-bold">{coverageSummary.totalHours.toFixed(1)}h</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Analytiques avancées à venir (graphiques de couverture, tendances, etc.)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Shift Dialog */}
      <ShiftCreateEditDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogClose}
        onSuccess={handleDialogSuccess}
        defaultDate={createShiftDate || undefined}
        templates={templates}
      />

      {/* Edit Shift Dialog */}
      {editingShift && (
        <ShiftCreateEditDialog
          open={isEditDialogOpen}
          onOpenChange={handleEditDialogClose}
          onSuccess={handleDialogSuccess}
          defaultDate={editingShift.shiftDate}
          shiftId={editingShift.id}
          templates={templates}
        />
      )}

      {/* Template Create/Edit Dialog */}
      <TemplateCreateEditDialog
        open={isTemplateDialogOpen}
        onOpenChange={handleTemplateDialogClose}
        onSuccess={handleTemplateSuccess}
        template={editingTemplate}
      />
    </div>
  );
}
