/**
 * Time-Off Policies List Page
 *
 * Shows all time-off policies with filtering
 * Displays compliance badges and quick actions
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar, Stethoscope, Baby, Heart, Copy } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { ComplianceBadge } from '@/features/policies/components/compliance-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const POLICY_ICONS: Record<string, typeof Calendar> = {
  annual_leave: Calendar,
  sick_leave: Stethoscope,
  maternity: Baby,
  paternity: Heart,
  unpaid: Calendar,
};

const POLICY_LABELS: Record<string, string> = {
  annual_leave: 'Congés payés annuels',
  sick_leave: 'Congé maladie',
  maternity: 'Congé de maternité',
  paternity: 'Congé de paternité',
  unpaid: 'Congé sans solde',
};

export default function TimeOffPoliciesPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');

  const { data: policies, isLoading } = trpc.policies.listTimeOffPolicies.useQuery();

  // Filter policies based on active status
  const filteredPolicies = policies?.filter((policy) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !policy.effectiveTo;
    if (filter === 'archived') return policy.effectiveTo;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="min-h-[44px]"
          >
            Toutes
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
            className="min-h-[44px]"
          >
            Actives
          </Button>
          <Button
            variant={filter === 'archived' ? 'default' : 'outline'}
            onClick={() => setFilter('archived')}
            className="min-h-[44px]"
          >
            Archivées
          </Button>
        </div>

        <Button
          asChild
          size="lg"
          className="min-h-[56px] gap-2"
        >
          <Link href="/admin/policies/time-off/new">
            <Plus className="h-5 w-5" />
            Nouvelle politique
          </Link>
        </Button>
      </div>

      {/* Policies Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PolicyCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredPolicies && filteredPolicies.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Aucune politique trouvée
            </p>
            <p className="text-muted-foreground mb-6">
              {filter === 'archived'
                ? 'Aucune politique archivée'
                : 'Commencez par créer votre première politique de congés'}
            </p>
            {filter === 'active' && (
              <Button asChild size="lg" className="min-h-[56px]">
                <Link href="/admin/policies/time-off/new">
                  <Plus className="h-5 w-5 mr-2" />
                  Créer une politique
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PolicyCard({ policy }: { policy: any }) {
  const Icon = POLICY_ICONS[policy.policyType] || Calendar;
  const isLocked = policy.complianceLevel === 'locked' || policy.complianceLevel === 'convention_collective';
  const isArchived = !!policy.effectiveTo;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-lg',
        isArchived && 'opacity-60'
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center',
              isArchived
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary/10 text-primary'
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <ComplianceBadge
            level={policy.complianceLevel || 'freeform'}
            size="sm"
          />
        </div>

        <CardTitle className="text-xl">
          {policy.name || POLICY_LABELS[policy.policyType]}
        </CardTitle>
        <CardDescription>
          {POLICY_LABELS[policy.policyType]}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Acquisition</p>
            <p className="font-semibold">
              {policy.accrualRate} jours/mois
            </p>
            {policy.accrualMethod === 'accrued_monthly' && (
              <p className="text-xs text-muted-foreground">
                = {parseFloat(policy.accrualRate) * 12} jours/an
              </p>
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-1">Solde max</p>
            <p className="font-semibold">
              {policy.maxBalance ? `${policy.maxBalance} jours` : 'Illimité'}
            </p>
          </div>

          <div className="col-span-2">
            <p className="text-muted-foreground mb-1">Approbation</p>
            <div className="flex items-center gap-2">
              <Badge variant={policy.requiresApproval ? 'default' : 'secondary'}>
                {policy.requiresApproval ? 'Requise' : 'Non requise'}
              </Badge>
              {policy.advanceNoticeDays > 0 && (
                <span className="text-xs text-muted-foreground">
                  Préavis: {policy.advanceNoticeDays}j
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px]"
          >
            <Link href={`/admin/policies/time-off/${policy.id}`}>
              Voir détails
            </Link>
          </Button>

          {!isLocked && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-[44px]"
            >
              <Link href={`/admin/policies/time-off/${policy.id}`}>
                Modifier
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            title="Dupliquer"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {/* Archived Badge */}
        {isArchived && (
          <div className="pt-2 border-t">
            <Badge variant="secondary" className="w-full justify-center">
              Archivée
            </Badge>
          </div>
        )}

        {/* Legal Reference */}
        {policy.legalReference && (
          <p className="text-xs text-muted-foreground italic pt-2 border-t">
            {policy.legalReference}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
