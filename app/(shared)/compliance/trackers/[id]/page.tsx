/**
 * Tracker Detail Page
 *
 * View and manage a single compliance tracker.
 * Features:
 * - Header with reference, title, status, priority badges
 * - Tabs: Détails | Actions | Historique
 * - Details tab: Form data display (read-only or edit mode)
 * - Actions tab: Action items list + add action
 * - History tab: Comments + status changes timeline
 *
 * HR Manager + Admin only access
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  Briefcase,
  Award,
  Gavel,
  Calendar as CalendarIcon,
  User,
  Plus,
  CheckCircle2,
  Clock,
  MessageSquare,
  Edit,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDeadlineStatus } from '@/lib/utils/date';

// Map tracker type slugs to icons
const trackerTypeIcons: Record<string, React.ReactNode> = {
  accidents: <AlertTriangle className="h-5 w-5" />,
  visites: <Briefcase className="h-5 w-5" />,
  certifications: <Award className="h-5 w-5" />,
  disciplinaire: <Gavel className="h-5 w-5" />,
};

// Map priority to badge variant
const priorityVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
  critical: 'destructive',
};

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

// Map status to colors
const statusColors: Record<string, string> = {
  nouveau: 'bg-blue-100 text-blue-800',
  analyse: 'bg-amber-100 text-amber-800',
  plan_action: 'bg-purple-100 text-purple-800',
  cloture: 'bg-green-100 text-green-800',
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
};

interface TrackerFieldDefinition {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  section?: string;
}

interface TrackerTypeDefinition {
  fields: TrackerFieldDefinition[];
  sections?: Array<{ id: string; title: string; description?: string }>;
}

interface WorkflowStatus {
  id: string;
  label: string;
  color: string;
  isFinal?: boolean;
}

export default function TrackerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackerId = params.id as string;
  const utils = api.useUtils();

  const [activeTab, setActiveTab] = useState('details');
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: null as Date | null,
    assigneeId: '',
  });

  // Fetch tracker details
  const { data: tracker, isLoading: trackerLoading } = api.complianceTrackers.getById.useQuery(
    { id: trackerId },
    { enabled: !!trackerId }
  );

  // Fetch action items
  const { data: actions, isLoading: actionsLoading } = api.complianceActionItems.list.useQuery(
    { trackerId, limit: 100 },
    { enabled: !!trackerId }
  );

  // Fetch employees for assignee picker
  const { data: employees } = api.employees.list.useQuery({ status: 'active', limit: 100 });

  // Fetch locations for location display
  const { data: locationsList } = api.locations.list.useQuery();

  // Update status mutation
  const updateStatus = api.complianceTrackers.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      utils.complianceTrackers.getById.invalidate({ id: trackerId });
      utils.complianceTrackers.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  // Close tracker mutation
  const closeTracker = api.complianceTrackers.close.useMutation({
    onSuccess: () => {
      toast.success('Dossier clôturé');
      utils.complianceTrackers.getById.invalidate({ id: trackerId });
      utils.complianceTrackers.list.invalidate();
      utils.complianceTrackers.getDashboardStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la clôture');
    },
  });

  // Create action mutation
  const createAction = api.complianceActionItems.create.useMutation({
    onSuccess: () => {
      toast.success('Action créée');
      setIsAddActionOpen(false);
      setNewAction({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: null,
        assigneeId: '',
      });
      utils.complianceActionItems.list.invalidate({ trackerId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  // Mark action complete mutation
  const markComplete = api.complianceActionItems.markComplete.useMutation({
    onSuccess: () => {
      toast.success('Action complétée');
      utils.complianceActionItems.list.invalidate({ trackerId });
      utils.complianceTrackers.getDashboardStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur');
    },
  });

  if (trackerLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-6 px-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="container mx-auto max-w-4xl py-6 px-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Dossier non trouvé</h2>
        <p className="text-muted-foreground mb-4">
          Le dossier demandé n'existe pas ou a été supprimé.
        </p>
        <Link href="/compliance/trackers">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux dossiers
          </Button>
        </Link>
      </div>
    );
  }

  const definition = tracker.trackerType?.definition as TrackerTypeDefinition | undefined;
  const workflowStatuses = tracker.trackerType?.workflowStatuses as WorkflowStatus[] | undefined;
  const data = tracker.data as Record<string, unknown>;

  // Render field value
  const renderFieldValue = (field: TrackerFieldDefinition, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">-</span>;
    }

    switch (field.type) {
      case 'date':
        return format(new Date(value as string), 'dd/MM/yyyy', { locale: fr });
      case 'datetime':
        return format(new Date(value as string), 'dd/MM/yyyy HH:mm', { locale: fr });
      case 'checkbox':
        return value ? 'Oui' : 'Non';
      case 'select':
        const option = field.options?.find((o) => o.value === value);
        return option?.label || String(value);
      case 'multiselect':
        const values = value as string[];
        return values
          .map((v) => field.options?.find((o) => o.value === v)?.label || v)
          .join(', ');
      case 'employee':
        const emp = employees?.employees?.find((e: { id: string; firstName: string; lastName: string }) => e.id === value);
        return emp ? `${emp.firstName} ${emp.lastName}` : String(value);
      case 'multiemployee':
        const empIds = value as string[];
        const empNames = empIds.map((empId) => {
          const employee = employees?.employees?.find((e: { id: string; firstName: string; lastName: string }) => e.id === empId);
          return employee ? `${employee.firstName} ${employee.lastName}` : empId;
        });
        return empNames.length > 0 ? empNames.join(', ') : '-';
      case 'file':
        const files = value as Array<{ id: string; name: string; url: string; size: number; type: string }>;
        if (!files || files.length === 0) return '-';
        return (
          <div className="space-y-1">
            {files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                {file.name}
              </a>
            ))}
          </div>
        );
      case 'location':
        const location = locationsList?.find((loc: { id: string; locationName: string; locationCode: string; city?: string | null }) => loc.id === value);
        return location ? `${location.locationName}${location.city ? ` (${location.city})` : ''}` : String(value);
      default:
        return String(value);
    }
  };

  // Group fields by section
  const fieldsBySection: Record<string, TrackerFieldDefinition[]> = { _default: [] };
  definition?.sections?.forEach((s) => {
    fieldsBySection[s.id] = [];
  });
  definition?.fields?.forEach((field) => {
    const sectionId = field.section || '_default';
    if (!fieldsBySection[sectionId]) {
      fieldsBySection[sectionId] = [];
    }
    fieldsBySection[sectionId].push(field);
  });

  return (
    <div className="container mx-auto max-w-4xl py-6 px-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/compliance/trackers">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux dossiers
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              {trackerTypeIcons[tracker.trackerType?.slug || ''] || <FileText className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-muted-foreground">
                  {tracker.referenceNumber}
                </span>
                <Badge variant={priorityVariants[tracker.priority] || 'default'}>
                  {priorityLabels[tracker.priority] || tracker.priority}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">{tracker.title}</h1>
              <p className="text-muted-foreground">{tracker.trackerType?.name}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* Status selector */}
            {workflowStatuses && workflowStatuses.length > 0 && (
              <Select
                value={tracker.status}
                onValueChange={(value) => updateStatus.mutate({ id: trackerId, status: value })}
                disabled={updateStatus.isPending || tracker.closedAt !== null}
              >
                <SelectTrigger className="min-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workflowStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Close button */}
            {!tracker.closedAt && (
              <Button
                variant="outline"
                onClick={() => closeTracker.mutate({ id: trackerId })}
                disabled={closeTracker.isPending}
              >
                {closeTracker.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Clôturer le dossier
              </Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          {tracker.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {tracker.assignee.firstName} {tracker.assignee.lastName}
            </span>
          )}
          {tracker.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Échéance: {format(new Date(tracker.dueDate), 'dd/MM/yyyy', { locale: fr })}
            </span>
          )}
          {tracker.closedAt && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Clôturé le {format(new Date(tracker.closedAt), 'dd/MM/yyyy', { locale: fr })}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="details">
            <FileText className="mr-2 h-4 w-4" />
            Détails
          </TabsTrigger>
          <TabsTrigger value="actions">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Actions ({actions?.data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="history">
            <MessageSquare className="mr-2 h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6">
              {definition?.fields && definition.fields.length > 0 ? (
                <div className="space-y-6">
                  {/* Default section */}
                  {fieldsBySection._default.length > 0 && (
                    <div className="space-y-4">
                      {fieldsBySection._default.map((field) => (
                        <div key={field.id} className="grid grid-cols-3 gap-4">
                          <span className="text-muted-foreground">{field.label}</span>
                          <span className="col-span-2 font-medium">
                            {renderFieldValue(field, data[field.id])}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Named sections */}
                  {definition.sections?.map((section) => {
                    const sectionFields = fieldsBySection[section.id] || [];
                    if (sectionFields.length === 0) return null;

                    return (
                      <div key={section.id} className="space-y-4">
                        <div className="border-b pb-2">
                          <h3 className="font-semibold">{section.title}</h3>
                          {section.description && (
                            <p className="text-sm text-muted-foreground">{section.description}</p>
                          )}
                        </div>
                        {sectionFields.map((field) => (
                          <div key={field.id} className="grid grid-cols-3 gap-4">
                            <span className="text-muted-foreground">{field.label}</span>
                            <span className="col-span-2 font-medium">
                              {renderFieldValue(field, data[field.id])}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Aucune donnée disponible
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Plan d'actions</CardTitle>
                <CardDescription>Actions à réaliser pour ce dossier</CardDescription>
              </div>
              <Dialog open={isAddActionOpen} onOpenChange={setIsAddActionOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter une action
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle action</DialogTitle>
                    <DialogDescription>
                      Créer une nouvelle action pour ce dossier
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="action-title">Titre *</Label>
                      <Input
                        id="action-title"
                        value={newAction.title}
                        onChange={(e) =>
                          setNewAction({ ...newAction, title: e.target.value })
                        }
                        placeholder="Ex: Analyser les causes"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="action-desc">Description</Label>
                      <Textarea
                        id="action-desc"
                        value={newAction.description}
                        onChange={(e) =>
                          setNewAction({ ...newAction, description: e.target.value })
                        }
                        placeholder="Détails de l'action..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Priorité</Label>
                        <Select
                          value={newAction.priority}
                          onValueChange={(v) =>
                            setNewAction({ ...newAction, priority: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Basse</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="high">Haute</SelectItem>
                            <SelectItem value="critical">Critique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Responsable</Label>
                        <Select
                          value={newAction.assigneeId}
                          onValueChange={(v) =>
                            setNewAction({ ...newAction, assigneeId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees?.employees?.map((emp: { id: string; firstName: string; lastName: string }) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.firstName} {emp.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Date d'échéance</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !newAction.dueDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newAction.dueDate
                              ? format(newAction.dueDate, 'dd MMMM yyyy', { locale: fr })
                              : 'Sélectionner...'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newAction.dueDate || undefined}
                            onSelect={(date) =>
                              setNewAction({ ...newAction, dueDate: date || null })
                            }
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddActionOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={() => {
                        createAction.mutate({
                          trackerId,
                          title: newAction.title,
                          description: newAction.description || undefined,
                          priority: newAction.priority as 'low' | 'medium' | 'high' | 'critical',
                          assigneeId: newAction.assigneeId || undefined,
                          dueDate: newAction.dueDate?.toISOString() || undefined,
                        });
                      }}
                      disabled={!newAction.title || createAction.isPending}
                    >
                      {createAction.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Créer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : actions?.data && actions.data.length > 0 ? (
                <div className="space-y-3">
                  {actions.data.map((action) => {
                    const deadlineStatus = action.dueDate
                      ? getDeadlineStatus(action.dueDate)
                      : null;

                    return (
                      <div
                        key={action.id}
                        className={cn(
                          'flex items-start justify-between p-4 border rounded-lg',
                          action.status === 'completed' && 'bg-green-50 border-green-200'
                        )}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                              action.status === 'completed'
                                ? 'bg-green-600 text-white'
                                : 'border-2 border-muted'
                            )}
                          >
                            {action.status === 'completed' && <Check className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'font-medium',
                                action.status === 'completed' && 'line-through text-muted-foreground'
                              )}
                            >
                              {action.title}
                            </p>
                            {action.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {action.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {action.assignee && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  {action.assignee.firstName} {action.assignee.lastName}
                                </span>
                              )}
                              {action.dueDate && (
                                <span
                                  className={cn(
                                    'flex items-center gap-1',
                                    deadlineStatus?.status === 'overdue' && 'text-destructive',
                                    deadlineStatus?.status === 'critical' && 'text-orange-600',
                                    deadlineStatus?.status === 'warning' && 'text-amber-600'
                                  )}
                                >
                                  <Clock className="h-3 w-3" />
                                  {deadlineStatus?.label ||
                                    format(new Date(action.dueDate), 'dd/MM/yyyy', { locale: fr })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={priorityVariants[action.priority] || 'default'}>
                            {priorityLabels[action.priority] || action.priority}
                          </Badge>
                          {action.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markComplete.mutate({ id: action.id })}
                              disabled={markComplete.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Aucune action définie</p>
                  <Button variant="outline" onClick={() => setIsAddActionOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter une action
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
              <CardDescription>Suivi des modifications et commentaires</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Creation event */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Dossier créé</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(tracker.createdAt), {
                        locale: fr,
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                {/* Status changes and comments would go here */}
                {tracker.comments && (tracker.comments as unknown[]).length > 0 ? (
                  (tracker.comments as unknown as Array<{
                    id: string;
                    content: string;
                    isStatusChange: boolean;
                    oldStatus?: string;
                    newStatus?: string;
                    createdAt: Date | string;
                  }>).map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          comment.isStatusChange ? 'bg-amber-100' : 'bg-slate-100'
                        )}
                      >
                        {comment.isStatusChange ? (
                          <Edit className="h-4 w-4 text-amber-600" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        {comment.isStatusChange ? (
                          <p className="font-medium">
                            Statut changé de <Badge variant="outline">{comment.oldStatus}</Badge> à{' '}
                            <Badge variant="outline">{comment.newStatus}</Badge>
                          </p>
                        ) : (
                          <p>{comment.content}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            locale: fr,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Aucun autre événement
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
