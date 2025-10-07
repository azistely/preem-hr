/**
 * Policy Detail/Edit Page
 *
 * Shows policy details with:
 * - Read-only for locked policies
 * - Editable for configurable policies
 * - Compliance badge and legal references
 * - Actions: Duplicate, Archive, View History
 */

'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Copy,
  Archive,
  History,
  Calendar,
  Settings,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X as XIcon,
} from 'lucide-react';
import { api } from '@/trpc/react';
import { ComplianceBadge } from '@/features/policies/components/compliance-badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const POLICY_LABELS: Record<string, string> = {
  annual_leave: 'Congés payés annuels',
  sick_leave: 'Congé maladie',
  maternity: 'Congé de maternité',
  paternity: 'Congé de paternité',
  unpaid: 'Congé sans solde',
};

const ACCRUAL_METHOD_LABELS: Record<string, string> = {
  accrued_monthly: 'Acquisition mensuelle',
  fixed: 'Montant fixe annuel',
  accrued_hourly: 'Acquisition horaire',
};

export default function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data: policy, isLoading, refetch } = api.policies.getTimeOffPolicy.useQuery(id);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    accrualRate: '',
    maxBalance: '',
    requiresApproval: true,
    advanceNoticeDays: 0,
  });

  // Update mutation
  const updateMutation = api.policies.updateTimeOffPolicy.useMutation({
    onSuccess: () => {
      toast({
        title: 'Politique modifiée',
        description:
          'Les nouvelles règles sont maintenant en vigueur.',
      });
      setIsEditMode(false);
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

  // Initialize form when entering edit mode
  const handleEditClick = () => {
    if (policy) {
      setFormData({
        name: policy.name || '',
        accrualRate: policy.accrualRate || '',
        maxBalance: policy.maxBalance || '',
        requiresApproval: policy.requiresApproval,
        advanceNoticeDays: policy.advanceNoticeDays || 0,
      });
    }
    setIsEditMode(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id,
      name: formData.name,
      accrualRate: parseFloat(formData.accrualRate),
      maxBalance: formData.maxBalance ? parseFloat(formData.maxBalance) : undefined,
      requiresApproval: formData.requiresApproval,
      advanceNoticeDays: formData.advanceNoticeDays,
      effectiveFrom: new Date(), // Effective immediately
    });
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  if (isLoading) {
    return <PolicyDetailSkeleton />;
  }

  if (!policy) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Politique introuvable</h2>
            <p className="text-muted-foreground mb-6">
              Cette politique n'existe pas ou a été supprimée
            </p>
            <Button asChild>
              <Link href="/admin/policies/time-off">
                Retour aux politiques
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLocked =
    policy.complianceLevel === 'locked' ||
    policy.complianceLevel === 'convention_collective';
  const isArchived = !!policy.effectiveTo;
  const canEdit = !isLocked && !isArchived;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">
                {policy.name || POLICY_LABELS[policy.policyType]}
              </h1>
              <ComplianceBadge
                level={policy.complianceLevel || 'freeform'}
              />
            </div>
            <p className="text-muted-foreground">
              {POLICY_LABELS[policy.policyType]}
            </p>
          </div>

          <div className="flex gap-2">
            {canEdit && !isEditMode && (
              <Button
                onClick={handleEditClick}
                className="min-h-[44px] gap-2"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </Button>
            )}
            {isEditMode && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="min-h-[44px] gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  className="min-h-[44px] gap-2"
                >
                  <XIcon className="h-4 w-4" />
                  Annuler
                </Button>
              </>
            )}
            {!isEditMode && (
              <>
                <Button variant="outline" className="min-h-[44px] gap-2">
                  <Copy className="h-4 w-4" />
                  Dupliquer
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    className="min-h-[44px] gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archiver
                  </Button>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="min-h-[44px] gap-2"
                >
                  <Link href={`/admin/policies/time-off/${id}/history`}>
                    <History className="h-4 w-4" />
                    Historique
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Archived Alert */}
      {isArchived && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium">Politique archivée</p>
                <p className="text-sm text-muted-foreground">
                  Cette politique n'est plus active depuis le{' '}
                  {format(new Date(policy.effectiveTo), 'PPP', { locale: fr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Locked Policy Alert */}
      {isLocked && !isArchived && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Politique verrouillée</p>
                <p className="text-sm text-muted-foreground">
                  Cette politique est conforme à la Convention Collective et ne
                  peut pas être modifiée. Les valeurs sont garanties par la loi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* General Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Informations générales</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Name Field */}
            <div className="md:col-span-2">
              <Label className="text-sm text-muted-foreground mb-1">
                Nom de la politique
              </Label>
              {isEditMode ? (
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="min-h-[48px]"
                  placeholder="Nom de la politique"
                />
              ) : (
                <p className="text-lg font-semibold">
                  {policy.name || POLICY_LABELS[policy.policyType]}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Type</p>
              <p className="text-lg font-semibold">
                {POLICY_LABELS[policy.policyType]}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Méthode d'acquisition
              </p>
              <p className="text-lg font-semibold">
                {ACCRUAL_METHOD_LABELS[policy.accrualMethod] || policy.accrualMethod}
              </p>
            </div>

            {/* Accrual Rate Field */}
            <div>
              <Label className="text-sm text-muted-foreground mb-1">
                Taux d'acquisition
              </Label>
              {isEditMode ? (
                <div className="space-y-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.accrualRate}
                    onChange={(e) =>
                      setFormData({ ...formData, accrualRate: e.target.value })
                    }
                    className="min-h-[48px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    = {(parseFloat(formData.accrualRate || '0') * 12).toFixed(1)} jours/an
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold">
                    {policy.accrualRate} jours/mois
                  </p>
                  <p className="text-sm text-muted-foreground">
                    = {(parseFloat(policy.accrualRate) * 12).toFixed(1)} jours/an
                  </p>
                </div>
              )}
            </div>

            {/* Max Balance Field */}
            <div>
              <Label className="text-sm text-muted-foreground mb-1">
                Solde maximum
              </Label>
              {isEditMode ? (
                <Input
                  type="number"
                  step="0.5"
                  value={formData.maxBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, maxBalance: e.target.value })
                  }
                  className="min-h-[48px]"
                  placeholder="Illimité"
                />
              ) : (
                <p className="text-lg font-semibold">
                  {policy.maxBalance ? `${policy.maxBalance} jours` : 'Illimité'}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Effectif depuis
              </p>
              <p className="text-lg font-semibold">
                {format(new Date(policy.effectiveFrom), 'PPP', { locale: fr })}
              </p>
            </div>

            {policy.effectiveTo && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Effectif jusqu'au
                </p>
                <p className="text-lg font-semibold">
                  {format(new Date(policy.effectiveTo), 'PPP', { locale: fr })}
                </p>
              </div>
            )}
          </div>

          {policy.legalReference && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">
                Référence légale
              </p>
              <p className="font-medium">{policy.legalReference}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Règles d'approbation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Requires Approval Field */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2">
                Approbation requise
              </Label>
              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.requiresApproval}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, requiresApproval: checked })
                    }
                  />
                  <span className="text-sm">
                    {formData.requiresApproval ? 'Oui' : 'Non'}
                  </span>
                </div>
              ) : (
                <Badge
                  variant={policy.requiresApproval ? 'default' : 'secondary'}
                  className="text-base px-3 py-1"
                >
                  {policy.requiresApproval ? 'Oui' : 'Non'}
                </Badge>
              )}
            </div>

            {/* Advance Notice Days Field */}
            <div>
              <Label className="text-sm text-muted-foreground mb-1">
                Préavis (jours)
              </Label>
              {isEditMode ? (
                <Input
                  type="number"
                  min="0"
                  value={formData.advanceNoticeDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      advanceNoticeDays: parseInt(e.target.value) || 0,
                    })
                  }
                  className="min-h-[48px]"
                />
              ) : (
                <p className="text-lg font-semibold">
                  {policy.advanceNoticeDays} jours
                </p>
              )}
            </div>

            {policy.minDaysPerRequest && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Minimum par demande
                </p>
                <p className="text-lg font-semibold">
                  {policy.minDaysPerRequest} jour(s)
                </p>
              </div>
            )}

            {policy.maxDaysPerRequest && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Maximum par demande
                </p>
                <p className="text-lg font-semibold">
                  {policy.maxDaysPerRequest} jours
                </p>
              </div>
            )}
          </div>

          {policy.blackoutPeriods &&
            Array.isArray(policy.blackoutPeriods) &&
            policy.blackoutPeriods.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Périodes interdites
                </p>
                <div className="space-y-2">
                  {(policy.blackoutPeriods as any[]).map((period: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{period.reason}</p>
                        <p className="text-sm text-muted-foreground">
                          {period.start} → {period.end}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métadonnées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Créé le</p>
              <p className="font-medium">
                {format(new Date(policy.createdAt), 'PPP à p', { locale: fr })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Dernière modification</p>
              <p className="font-medium">
                {format(new Date(policy.updatedAt), 'PPP à p', { locale: fr })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
