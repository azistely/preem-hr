"use client";

import * as React from "react";
import { Users, Shield, Settings as SettingsIcon } from "lucide-react";
import { api } from "@/server/api/client";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { OrganizationHeader } from "@/components/dashboard/admin/organization-header";
import { CostAnalysis } from "@/components/dashboard/admin/cost-analysis";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertsDashboardWidget } from "@/components/workflow/alerts-dashboard-widget";

export default function TenantAdminDashboardPage() {
  const { data: dashboardData, isLoading } = api.dashboard.getAdminDashboard.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24" />
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

  const { organization, costs, users, security } = dashboardData;

  return (
    <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold lg:text-3xl">
          Administration
        </h1>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden space-y-4">
        {/* Alerts Widget */}
        <AlertsDashboardWidget />

        {/* Organization Info */}
        <OrganizationHeader
          name={organization.name}
          plan={organization.plan}
          expiryDate={organization.expiryDate}
        />

        {/* Costs */}
        <CostAnalysis
          payroll={costs.payroll}
          charges={costs.charges}
          total={costs.total}
        />

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">2FA activé</span>
              <Badge variant="secondary">✓</Badge>
            </div>
            {security.inactiveAccounts > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Comptes inactifs</span>
                <Badge variant="destructive">{security.inactiveAccounts}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <CollapsibleSection title="Actions Admin">
          <div className="space-y-3">
            <QuickActionCard
              icon={Users}
              title="Utilisateurs"
              description={`${users.total} utilisateurs`}
              onClick={() => {/* TODO */}}
            />
            <QuickActionCard
              icon={Shield}
              title="Rôles & Permissions"
              description="Gérer les accès"
              onClick={() => {/* TODO */}}
            />
            <QuickActionCard
              icon={SettingsIcon}
              title="Paramètres société"
              description="Configuration générale"
              onClick={() => {/* TODO */}}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* Tablet View (768px+) */}
      <div className="hidden md:block lg:hidden">
        <div className="space-y-6">
          {/* Alerts Widget - Full width */}
          <AlertsDashboardWidget />

          {/* Organization Header - Full width */}
          <OrganizationHeader
            name={organization.name}
            plan={organization.plan}
            expiryDate={organization.expiryDate}
          />

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-6">
            <CostAnalysis
              payroll={costs.payroll}
              charges={costs.charges}
              total={costs.total}
            />

            <div className="space-y-4">
              <MetricCard
                title="Utilisateurs"
                value={users.total}
                icon={Users}
              />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sécurité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">2FA</span>
                    <Badge variant="secondary">Activé</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View (1024px+) */}
      <div className="hidden lg:block">
        <div className="space-y-8">
          {/* Alerts Widget - Full width */}
          <AlertsDashboardWidget />

          {/* Organization Header */}
          <OrganizationHeader
            name={organization.name}
            plan={organization.plan}
            expiryDate={organization.expiryDate}
          />

          {/* Admin Command Center */}
          <div className="grid grid-cols-4 gap-6">
            <MetricCard
              title="Utilisateurs"
              value={users.total}
              icon={Users}
            />
            <MetricCard
              title="Coût Mensuel"
              value={`${(costs.total / 1000000).toFixed(1)}M FCFA`}
            />
            <MetricCard
              title="Admins"
              value={users.admins}
            />
            <MetricCard
              title="Sécurité"
              value="2FA Activé"
              icon={Shield}
            />
          </div>

          {/* Management Panels */}
          <div className="grid grid-cols-3 gap-6">
            <CostAnalysis
              payroll={costs.payroll}
              charges={costs.charges}
              total={costs.total}
            />

            <Card>
              <CardHeader>
                <CardTitle>Sécurité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">2FA</span>
                  <Badge variant="secondary">Activé</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Comptes inactifs
                  </span>
                  <Badge variant={security.inactiveAccounts > 0 ? "destructive" : "secondary"}>
                    {security.inactiveAccounts}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <QuickActionCard
                icon={Users}
                title="Utilisateurs"
                description={`Gérer ${users.total} utilisateurs`}
                onClick={() => {/* TODO */}}
              />
              <QuickActionCard
                icon={Shield}
                title="Sécurité"
                description="Paramètres de sécurité"
                onClick={() => {/* TODO */}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
