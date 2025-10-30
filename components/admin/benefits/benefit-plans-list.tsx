/**
 * Benefit Plans List Component
 *
 * Displays all benefit plans with filtering by type and status.
 * Shows plan details including costs, eligibility, and enrollment count.
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Smile,
  Eye,
  Shield,
  PiggyBank,
  AlertCircle,
  Car,
  UtensilsCrossed,
  Package,
  Users,
  DollarSign,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const benefitTypeIcons = {
  health: Heart,
  dental: Smile,
  vision: Eye,
  life_insurance: Shield,
  retirement: PiggyBank,
  disability: AlertCircle,
  transport: Car,
  meal: UtensilsCrossed,
  other: Package,
};

const benefitTypeLabels = {
  health: 'Santé',
  dental: 'Dentaire',
  vision: 'Vision',
  life_insurance: 'Assurance Vie',
  retirement: 'Retraite',
  disability: 'Invalidité',
  transport: 'Transport',
  meal: 'Restauration',
  other: 'Autre',
};

export function BenefitPlansList() {
  const { toast } = useToast();
  const [benefitTypeFilter, setBenefitTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Fetch plans
  const {
    data: plans,
    isLoading,
    refetch,
  } = api.benefits.listPlans.useQuery({
    benefitType: benefitTypeFilter === 'all' ? undefined : benefitTypeFilter as any,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
  });

  // Delete mutation
  const deleteMutation = api.benefits.deletePlan.useMutation({
    onSuccess: () => {
      toast({
        title: 'Plan supprimé',
        description: 'Le plan d\'avantages a été désactivé avec succès',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (planId: string, planName: string) => {
    if (confirm(`Êtes-vous sûr de vouloir désactiver le plan "${planName}" ?`)) {
      deleteMutation.mutate({ id: planId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Type d'Avantage</label>
          <Select value={benefitTypeFilter} onValueChange={setBenefitTypeFilter}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="health">Santé</SelectItem>
              <SelectItem value="dental">Dentaire</SelectItem>
              <SelectItem value="vision">Vision</SelectItem>
              <SelectItem value="life_insurance">Assurance Vie</SelectItem>
              <SelectItem value="retirement">Retraite</SelectItem>
              <SelectItem value="disability">Invalidité</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
              <SelectItem value="meal">Restauration</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Statut</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plans Grid */}
      {!plans || plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Aucun plan trouvé</p>
            <p className="text-sm text-muted-foreground">
              Créez un nouveau plan d'avantages pour commencer
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = benefitTypeIcons[plan.benefitType as keyof typeof benefitTypeIcons] || Package;
            const typeLabel = benefitTypeLabels[plan.benefitType as keyof typeof benefitTypeLabels] || plan.benefitType;

            return (
              <Card key={plan.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plan.planName}</CardTitle>
                        <CardDescription>{plan.planCode}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                      {plan.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Type */}
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{typeLabel}</span>
                  </div>

                  {/* Provider */}
                  {plan.providerName && (
                    <div className="text-sm text-muted-foreground">
                      Fournisseur: {plan.providerName}
                    </div>
                  )}

                  {/* Description */}
                  {plan.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  {/* Costs */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coût Employé:</span>
                      <span className="font-medium">
                        {plan.employeeCost ? formatCurrency(Number(plan.employeeCost), plan.currency || 'XOF') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coût Employeur:</span>
                      <span className="font-medium">
                        {plan.employerCost ? formatCurrency(Number(plan.employerCost), plan.currency || 'XOF') : '-'}
                      </span>
                    </div>
                    {plan.totalCost && (
                      <div className="flex items-center justify-between text-sm font-bold pt-2 border-t">
                        <span>Total:</span>
                        <span>{formatCurrency(Number(plan.totalCost), plan.currency || 'XOF')}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Par {plan.costFrequency === 'monthly' ? 'mois' : plan.costFrequency === 'annual' ? 'an' : 'paie'}
                    </div>
                  </div>

                  {/* Eligibility */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Éligibilité:</div>
                    <div className="flex flex-wrap gap-2">
                      {plan.eligibleEmployeeTypes &&
                       Array.isArray(plan.eligibleEmployeeTypes) &&
                       (plan.eligibleEmployeeTypes as string[]).length > 0 ? (
                        (plan.eligibleEmployeeTypes as string[]).map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Tous les employés
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      disabled
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(plan.id, plan.planName)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
