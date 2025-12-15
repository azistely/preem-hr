"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Play, FileText, CheckCircle, BookOpen } from "lucide-react";
import { api } from "@/server/api/client";
import { QuickActionCard, QuickActionsGrid } from "@/components/dashboard/quick-action-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { CriticalActions } from "@/components/dashboard/hr/critical-actions";
import { KeyMetrics } from "@/components/dashboard/hr/key-metrics";
import { ProbationWidget } from "@/components/dashboard/hr/probation-widget";
import { Skeleton } from "@/components/ui/skeleton";

export default function HRDashboardPage() {
  const router = useRouter();
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

  const { metrics, criticalActions, probation } = dashboardData;

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

        {/* Probation Widget */}
        {probation && probation.total > 0 && (
          <ProbationWidget
            urgent={probation.urgent}
            upcoming={probation.upcoming}
            total={probation.total}
            employees={probation.employees}
          />
        )}

        {/* Key Metrics */}
        <CollapsibleSection title="Métriques Clés" defaultOpen={true}>
          <KeyMetrics
            employeeCount={metrics.employeeCount}
            payrollCost={metrics.payrollCost}
          />
        </CollapsibleSection>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Actions Rapides</h2>
          <QuickActionsGrid columns={2}>
            <QuickActionCard
              icon={Play}
              title="Lancer la Paie"
              description="Octobre 2025"
              href="/payroll/runs/new"
              action="Démarrer"
              variant={criticalActions.payrollDue ? "warning" : "primary"}
              badge={criticalActions.payrollDue ? 1 : undefined}
              size="large"
            />
            <QuickActionCard
              icon={CheckCircle}
              title="Validations"
              description={`${criticalActions.pendingLeave || 0} en attente`}
              href="/admin/time-off"
              action="Voir tout"
              variant={criticalActions.pendingLeave > 0 ? "warning" : "default"}
              badge={criticalActions.pendingLeave}
            />
            <QuickActionCard
              icon={UserPlus}
              title="Ajouter Employé"
              description="Nouveau recrutement"
              href="/employees/new"
              action="Commencer"
            />
            <QuickActionCard
              icon={BookOpen}
              title="Registre du Personnel"
              description="Conformité légale"
              href="/compliance/registre"
              action="Ouvrir"
            />
          </QuickActionsGrid>
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

          {/* Probation Widget - Full width */}
          {probation && probation.total > 0 && (
            <ProbationWidget
              urgent={probation.urgent}
              upcoming={probation.upcoming}
              total={probation.total}
              employees={probation.employees}
            />
          )}

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
                  title="Nouvel employé"
                  description="Ajouter"
                  href="/employees/new"
                />
                <QuickActionCard
                  icon={Play}
                  title="Lancer paie"
                  description="Octobre 2025"
                  href="/payroll/runs/new"
                />
                <QuickActionCard
                  icon={FileText}
                  title="Rapports"
                  description="Analytics"
                  href="/reports"
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
            {/* Left: Critical Actions + Probation */}
            <div className="col-span-2 space-y-6">
              <CriticalActions
                payrollDue={criticalActions.payrollDue}
                pendingLeave={criticalActions.pendingLeave}
              />
              {probation && probation.total > 0 && (
                <ProbationWidget
                  urgent={probation.urgent}
                  upcoming={probation.upcoming}
                  total={probation.total}
                  employees={probation.employees}
                />
              )}
            </div>

            {/* Right: Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Actions Rapides</h2>
              <div className="space-y-3">
                <QuickActionCard
                  icon={UserPlus}
                  title="Nouvel employé"
                  description="Ajouter un membre"
                  href="/employees/new"
                />
                <QuickActionCard
                  icon={Play}
                  title="Lancer la paie"
                  description="Paie du mois"
                  badge={criticalActions.payrollDue ? 1 : undefined}
                  href="/payroll/runs/new"
                />
                <QuickActionCard
                  icon={FileText}
                  title="Rapports"
                  description="Analytics RH"
                  href="/reports"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
