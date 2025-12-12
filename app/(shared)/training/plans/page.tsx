/**
 * Training Plans List Page
 *
 * HR managers can view and manage annual training plans.
 * - List plans by year with budget tracking
 * - Create new annual plans
 * - View plan status and progress
 */

'use client';

import { useState } from 'react';
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
  ClipboardList,
  Plus,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  ChevronRight,
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

// Format currency
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num) + ' FCFA';
}

// Plan card component
function PlanCard({
  plan,
}: {
  plan: {
    id: string;
    year: number;
    name: string;
    description: string | null;
    totalBudget: string | null;
    status: string;
    itemCount: number;
    itemsAllocatedBudget: number;
    createdAt: Date | null;
  };
}) {
  const status = statusConfig[plan.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const totalBudget = parseFloat(plan.totalBudget || '0') || 0;
  const budgetUsed = plan.itemsAllocatedBudget || 0;
  const budgetPercent = totalBudget > 0 ? Math.min((budgetUsed / totalBudget) * 100, 100) : 0;

  return (
    <Link href={`/training/plans/${plan.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3 w-3" />
                  Année {plan.year}
                </CardDescription>
              </div>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {plan.description}
            </p>
          )}

          {/* Budget progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget utilisé</span>
              <span className="font-medium">{Math.round(budgetPercent)}%</span>
            </div>
            <Progress value={budgetPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(budgetUsed)}</span>
              <span>{formatCurrency(totalBudget)}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm">
              <span className="font-medium">{plan.itemCount}</span>
              <span className="text-muted-foreground ml-1">
                formation{plan.itemCount !== 1 ? 's' : ''}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TrainingPlansPage() {
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formYear, setFormYear] = useState(new Date().getFullYear() + 1);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBudget, setFormBudget] = useState('');

  const utils = api.useUtils();

  // Fetch plans
  const { data: plans, isLoading } = api.training.plans.list.useQuery({
    year: yearFilter !== 'all' ? parseInt(yearFilter) : undefined,
    status: statusFilter !== 'all' ? statusFilter as 'draft' | 'submitted' | 'approved' | 'in_progress' | 'completed' : undefined,
  });

  // Create plan mutation
  const createPlan = api.training.plans.create.useMutation({
    onSuccess: () => {
      toast.success('Plan de formation créé');
      setShowCreateDialog(false);
      resetForm();
      utils.training.plans.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const resetForm = () => {
    setFormYear(new Date().getFullYear() + 1);
    setFormName('');
    setFormDescription('');
    setFormBudget('');
  };

  const handleCreate = () => {
    if (!formName.trim()) {
      toast.error('Veuillez saisir un nom pour le plan');
      return;
    }

    if (!formBudget || parseFloat(formBudget) <= 0) {
      toast.error('Veuillez saisir un budget valide');
      return;
    }

    createPlan.mutate({
      year: formYear,
      name: formName,
      description: formDescription || undefined,
      totalBudget: formBudget,
      currency: 'XOF',
    });
  };

  // Get available years for filter
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  // Calculate stats
  const totalPlans = plans?.length ?? 0;
  const activePlans = plans?.filter((p) => p.status === 'in_progress' || p.status === 'approved').length ?? 0;
  const draftPlans = plans?.filter((p) => p.status === 'draft').length ?? 0;
  const totalBudget = plans?.reduce((sum, p) => sum + parseFloat(p.totalBudget || '0'), 0) ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Plans de formation</h1>
          <p className="text-muted-foreground mt-1">
            Planifiez et gérez vos budgets de formation annuels
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="min-h-[48px]">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Créer un plan de formation</DialogTitle>
              <DialogDescription>
                Définissez le budget annuel pour les formations
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="year">Année</Label>
                <Select
                  value={formYear.toString()}
                  onValueChange={(v) => setFormYear(parseInt(v))}
                >
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom du plan *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Plan de formation 2025"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Objectifs et priorités du plan..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget total (FCFA) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="budget"
                    type="number"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    placeholder="5000000"
                    className="min-h-[48px] pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enveloppe budgétaire pour l&apos;année
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createPlan.isPending}
                className="min-h-[44px]"
              >
                {createPlan.isPending ? 'Création...' : 'Créer le plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPlans}</p>
                <p className="text-sm text-muted-foreground">Plans total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activePlans}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FileText className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{draftPlans}</p>
                <p className="text-sm text-muted-foreground">Brouillons</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                <p className="text-sm text-muted-foreground">Budget total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="min-h-[48px]">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les années</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="submitted">Soumis</SelectItem>
                  <SelectItem value="approved">Approuvé</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun plan de formation</h3>
            <p className="text-muted-foreground mb-4">
              Créez votre premier plan pour organiser vos formations
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="min-h-[48px]">
              <Plus className="mr-2 h-4 w-4" />
              Créer un plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
