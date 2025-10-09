"use client";

import * as React from "react";
import { UserPlus, Play, FileText } from "lucide-react";
import { api } from "@/server/api/client";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { CriticalActions } from "@/components/dashboard/hr/critical-actions";
import { KeyMetrics } from "@/components/dashboard/hr/key-metrics";
import { Skeleton } from "@/components/ui/skeleton";

export default function HRDashboardPage() {
  const { data: dashboardData, isLoading } = api.dashboard.getHRDashboard.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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

  const { metrics, criticalActions } = dashboardData;

  return (
    <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold lg:text-3xl">
          Tableau de Bord RH
        </h1>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden space-y-4">
        {/* Critical Actions */}
        <CriticalActions
          payrollDue={criticalActions.payrollDue}
          pendingLeave={criticalActions.pendingLeave}
        />

        {/* Key Metrics */}
        <CollapsibleSection title="Métriques Clés" defaultOpen={true}>
          <KeyMetrics
            employeeCount={metrics.employeeCount}
            payrollCost={metrics.payrollCost}
          />
        </CollapsibleSection>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Actions Rapides</h2>
          <QuickActionCard
            icon={UserPlus}
            label="Nouvel employé"
            onClick={() => {/* TODO: Navigate */}}
          />
          <QuickActionCard
            icon={Play}
            label="Lancer la paie"
            badge={criticalActions.payrollDue ? "Urgent" : undefined}
            onClick={() => {/* TODO: Navigate */}}
          />
          <QuickActionCard
            icon={FileText}
            label="Rapports"
            onClick={() => {/* TODO: Navigate */}}
          />
        </div>
      </div>

      {/* Tablet View (768px+) */}
      <div className="hidden md:block lg:hidden">
        <div className="space-y-6">
          {/* Critical Actions - Full width */}
          <CriticalActions
            payrollDue={criticalActions.payrollDue}
            pendingLeave={criticalActions.pendingLeave}
          />

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-6">
            {/* Key Metrics */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Métriques Clés</h2>
              <KeyMetrics
                employeeCount={metrics.employeeCount}
                payrollCost={metrics.payrollCost}
              />
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Actions Rapides</h2>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionCard
                  icon={UserPlus}
                  label="Nouvel employé"
                  onClick={() => {/* TODO */}}
                />
                <QuickActionCard
                  icon={Play}
                  label="Lancer paie"
                  onClick={() => {/* TODO */}}
                />
                <QuickActionCard
                  icon={FileText}
                  label="Rapports"
                  onClick={() => {/* TODO */}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View (1024px+) */}
      <div className="hidden lg:block">
        <div className="space-y-8">
          {/* Command Center - Key Metrics */}
          <KeyMetrics
            employeeCount={metrics.employeeCount}
            payrollCost={metrics.payrollCost}
          />

          {/* Main Content */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Critical Actions */}
            <div className="col-span-2">
              <CriticalActions
                payrollDue={criticalActions.payrollDue}
                pendingLeave={criticalActions.pendingLeave}
              />
            </div>

            {/* Right: Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Actions Rapides</h2>
              <div className="space-y-3">
                <QuickActionCard
                  icon={UserPlus}
                  label="Nouvel employé"
                  description="Ajouter un membre"
                  onClick={() => {/* TODO */}}
                />
                <QuickActionCard
                  icon={Play}
                  label="Lancer la paie"
                  description="Paie du mois"
                  badge={criticalActions.payrollDue ? "!" : undefined}
                  onClick={() => {/* TODO */}}
                />
                <QuickActionCard
                  icon={FileText}
                  label="Rapports"
                  description="Analytics RH"
                  onClick={() => {/* TODO */}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
