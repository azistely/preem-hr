/**
 * Training Plan Detail Page
 *
 * View and manage a specific training plan.
 * - View plan details and budget tracking
 * - Add/remove training items
 * - Submit for approval
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClipboardList,
  Plus,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  ArrowLeft,
  BookOpen,
  Users,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// Status config
const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Brouillon', color: 'bg-muted text-muted-foreground', icon: FileText },
  submitted: { label: 'Soumis', color: 'bg-blue-100 text-blue-700', icon: Send },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  in_progress: { label: 'En cours', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  completed: { label: 'Terminé', color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Moyenne', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Haute', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critique', color: 'bg-red-100 text-red-700' },
};

// Format currency
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num) + ' FCFA';
}

// Quarter label
function getQuarterLabel(quarter: number | null): string {
  if (!quarter) return '-';
  return `T${quarter}`;
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [showAddItemDialog, setShowAddItemDialog] = useState(false);

  // Form state for new item
  const [itemCourseId, setItemCourseId] = useState<string>('');
  const [itemCustomName, setItemCustomName] = useState('');
  const [itemParticipants, setItemParticipants] = useState('');
  const [itemQuarter, setItemQuarter] = useState<string>('');
  const [itemBudget, setItemBudget] = useState('');
  const [itemPriority, setItemPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [itemNotes, setItemNotes] = useState('');

  const utils = api.useUtils();

  // Fetch plan details
  const { data: plan, isLoading } = api.training.plans.getById.useQuery({ id: planId });

  // Fetch courses for dropdown
  const { data: coursesData } = api.training.courses.list.useQuery({});
  const courses = coursesData?.data ?? [];

  // Add item mutation
  const addItem = api.training.plans.addItem.useMutation({
    onSuccess: () => {
      toast.success('Formation ajoutée au plan');
      setShowAddItemDialog(false);
      resetItemForm();
      utils.training.plans.getById.invalidate({ id: planId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    },
  });

  // Update status mutation
  const updateStatus = api.training.plans.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      utils.training.plans.getById.invalidate({ id: planId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });

  const resetItemForm = () => {
    setItemCourseId('');
    setItemCustomName('');
    setItemParticipants('');
    setItemQuarter('');
    setItemBudget('');
    setItemPriority('medium');
    setItemNotes('');
  };

  const handleAddItem = () => {
    if (!itemCourseId && !itemCustomName.trim()) {
      toast.error('Sélectionnez une formation ou saisissez un nom');
      return;
    }

    if (!itemParticipants || parseInt(itemParticipants) < 1) {
      toast.error('Nombre de participants invalide');
      return;
    }

    if (!itemBudget || parseFloat(itemBudget) <= 0) {
      toast.error('Budget invalide');
      return;
    }

    addItem.mutate({
      planId,
      courseId: itemCourseId || undefined,
      customCourseName: !itemCourseId ? itemCustomName : undefined,
      targetParticipantCount: parseInt(itemParticipants),
      plannedQuarter: itemQuarter ? parseInt(itemQuarter) : undefined,
      budgetAllocated: itemBudget,
      priority: itemPriority,
      notes: itemNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Plan non trouvé</h3>
            <Button variant="outline" onClick={() => router.push('/training/plans')}>
              Retour aux plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[plan.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const totalBudget = parseFloat(plan.totalBudget || '0') || 0;
  const allocatedBudget = plan.items?.reduce(
    (sum, item) => sum + parseFloat(item.budgetAllocated || '0'),
    0
  ) ?? 0;
  const remainingBudget = totalBudget - allocatedBudget;
  const budgetPercent = totalBudget > 0 ? Math.min((allocatedBudget / totalBudget) * 100, 100) : 0;
  const isEditable = plan.status === 'draft';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/training/plans">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{plan.name}</h1>
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Année {plan.year}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isEditable && (
            <Button
              variant="outline"
              onClick={() => updateStatus.mutate({ id: planId, status: 'submitted' })}
              disabled={updateStatus.isPending || (plan.items?.length ?? 0) === 0}
              className="min-h-[44px]"
            >
              <Send className="mr-2 h-4 w-4" />
              Soumettre
            </Button>
          )}

          {plan.status === 'submitted' && (
            <Button
              onClick={() => updateStatus.mutate({ id: planId, status: 'approved' })}
              disabled={updateStatus.isPending}
              className="min-h-[44px]"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approuver
            </Button>
          )}

          {plan.status === 'approved' && (
            <Button
              onClick={() => updateStatus.mutate({ id: planId, status: 'in_progress' })}
              disabled={updateStatus.isPending}
              className="min-h-[44px]"
            >
              <Clock className="mr-2 h-4 w-4" />
              Démarrer
            </Button>
          )}
        </div>
      </div>

      {/* Budget overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Budget total</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Budget alloué</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(allocatedBudget)}</p>
            </div>
            <div className={`p-4 rounded-lg ${remainingBudget < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <p className="text-sm text-muted-foreground mb-1">Budget restant</p>
              <p className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatCurrency(remainingBudget)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilisation du budget</span>
              <span className="font-medium">{Math.round(budgetPercent)}%</span>
            </div>
            <Progress
              value={budgetPercent}
              className={`h-3 ${budgetPercent > 100 ? '[&>div]:bg-red-500' : ''}`}
            />
          </div>

          {remainingBudget < 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-100 text-red-700 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Budget dépassé de {formatCurrency(Math.abs(remainingBudget))}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {plan.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{plan.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Formations planifiées</CardTitle>
              <CardDescription>
                {plan.items?.length ?? 0} formation{(plan.items?.length ?? 0) !== 1 ? 's' : ''} dans ce plan
              </CardDescription>
            </div>

            {isEditable && (
              <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
                <DialogTrigger asChild>
                  <Button className="min-h-[44px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Ajouter une formation</DialogTitle>
                    <DialogDescription>
                      Ajoutez une formation au plan annuel
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Formation du catalogue</Label>
                      <Select value={itemCourseId} onValueChange={setItemCourseId}>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner une formation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune (formation personnalisée)</SelectItem>
                          {courses.map((course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(!itemCourseId || itemCourseId === 'none') && (
                      <div className="space-y-2">
                        <Label htmlFor="customName">Nom de la formation *</Label>
                        <Input
                          id="customName"
                          value={itemCustomName}
                          onChange={(e) => setItemCustomName(e.target.value)}
                          placeholder="Ex: Formation Leadership"
                          className="min-h-[48px]"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="participants">Participants *</Label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="participants"
                            type="number"
                            min="1"
                            value={itemParticipants}
                            onChange={(e) => setItemParticipants(e.target.value)}
                            placeholder="10"
                            className="min-h-[48px] pl-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Trimestre</Label>
                        <Select value={itemQuarter} onValueChange={setItemQuarter}>
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue placeholder="Trimestre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non défini</SelectItem>
                            <SelectItem value="1">T1</SelectItem>
                            <SelectItem value="2">T2</SelectItem>
                            <SelectItem value="3">T3</SelectItem>
                            <SelectItem value="4">T4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="budget">Budget (FCFA) *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="budget"
                            type="number"
                            value={itemBudget}
                            onChange={(e) => setItemBudget(e.target.value)}
                            placeholder="500000"
                            className="min-h-[48px] pl-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Priorité</Label>
                        <Select value={itemPriority} onValueChange={(v) => setItemPriority(v as 'low' | 'medium' | 'high' | 'critical')}>
                          <SelectTrigger className="min-h-[48px]">
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        placeholder="Justification, objectifs..."
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddItemDialog(false);
                        resetItemForm();
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleAddItem}
                      disabled={addItem.isPending}
                      className="min-h-[44px]"
                    >
                      {addItem.isPending ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!plan.items || plan.items.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune formation planifiée</h3>
              <p className="text-muted-foreground mb-4">
                Ajoutez des formations à ce plan
              </p>
              {isEditable && (
                <Button onClick={() => setShowAddItemDialog(true)} className="min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une formation
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formation</TableHead>
                    <TableHead className="text-center">Trimestre</TableHead>
                    <TableHead className="text-center">Participants</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-center">Priorité</TableHead>
                    {isEditable && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => {
                    const priority = priorityConfig[item.priority || 'medium'];
                    const courseName = item.course?.name || item.customCourseName || 'Formation sans nom';

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{courseName}</p>
                            {item.course?.code && (
                              <p className="text-xs text-muted-foreground">{item.course.code}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getQuarterLabel(item.plannedQuarter)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {item.targetParticipantCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.budgetAllocated || '0')}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={priority.color}>{priority.label}</Badge>
                        </TableCell>
                        {isEditable && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
