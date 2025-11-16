"use client";

import * as React from "react";
import { Users, BarChart, DollarSign } from "lucide-react";
import { api } from "@/server/api/client";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { TeamOverview } from "@/components/dashboard/manager/team-overview";
import { ApprovalQueue } from "@/components/dashboard/manager/approval-queue";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = 'force-dynamic';

export default function ManagerDashboardPage() {
  const { data: dashboardData, isLoading } = api.dashboard.getManagerDashboard.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Impossible de charger les données</p>
        </div>
      </div>
    );
  }

  const { team, pendingApprovals, costs } = dashboardData;

  // Transform pending items for ApprovalQueue
  const approvalItems = pendingApprovals.items.map((item: any) => ({
    id: item.id,
    type: 'leave' as const,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    description: `${item.numberOfDays} jours`,
    date: new Date(item.startDate),
  }));

  return (
    <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold lg:text-3xl">
          Tableau de Bord Manager
        </h1>
      </div>

      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        {/* Urgent Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
              {pendingApprovals.total}
            </span>
            URGENT
          </h2>

          <ApprovalQueue
            items={approvalItems}
            count={pendingApprovals.total}
          />
        </div>

        {/* Team Overview */}
        <TeamOverview
          total={team.total}
          present={team.present}
          absent={team.absent}
        />

        {/* Collapsible Sections */}
        <CollapsibleSection title="Coûts du mois">
          <MetricCard
            title="Masse salariale"
            value={`${new Intl.NumberFormat('fr-FR').format(costs.monthly)} FCFA`}
            icon={DollarSign}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Heures supplémentaires">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </CollapsibleSection>
      </div>

      {/* Tablet View (768px+) */}
      <div className="hidden md:block lg:hidden">
        <div className="space-y-6">
          {/* Urgent items - Full width */}
          <ApprovalQueue
            items={approvalItems}
            count={pendingApprovals.total}
          />

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <TeamOverview
              total={team.total}
              present={team.present}
              absent={team.absent}
            />

            <div className="space-y-4">
              <MetricCard
                title="Présents"
                value={`${team.present}/${team.total}`}
                icon={Users}
              />
              <MetricCard
                title="Coût mensuel"
                value={`${(costs.monthly / 1000000).toFixed(1)}M`}
                icon={DollarSign}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View (1024px+) */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          {/* Priority Queue - Full width */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <ApprovalQueue
                items={approvalItems}
                count={pendingApprovals.total}
              />
            </div>

            <div>
              <MetricCard
                title="En attente"
                value={pendingApprovals.total}
                icon={BarChart}
                trend={{
                  value: `${pendingApprovals.total}`,
                  label: "à traiter",
                  direction: "neutral",
                }}
              />
            </div>
          </div>

          {/* Team Analytics */}
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-2">
              <TeamOverview
                total={team.total}
                present={team.present}
                absent={team.absent}
              />
            </div>

            <MetricCard
              title="Coût mensuel"
              value={`${(costs.monthly / 1000000).toFixed(1)}M FCFA`}
              icon={DollarSign}
            />

            <MetricCard
              title="Taux de présence"
              value={`${((team.present / team.total) * 100).toFixed(0)}%`}
              icon={Users}
              trend={{
                value: "+5%",
                label: "vs mois dernier",
                direction: "up",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
