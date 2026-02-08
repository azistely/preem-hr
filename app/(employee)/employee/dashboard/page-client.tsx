"use client";

import * as React from "react";
import { Clock, Calendar, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/server/api/client";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { SalaryOverview } from "@/components/dashboard/employee/salary-overview";
import { LeaveBalance } from "@/components/dashboard/employee/leave-balance";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const { data: dashboardData, isLoading } = api.dashboard.getEmployeeDashboard.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
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

  const { employee, salary, leaveBalance, recentPayslips } = dashboardData;

  return (
    <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold lg:text-3xl">
          Bonjour {employee.firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          {employee.position}
        </p>
      </div>

      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        {/* Salary Card */}
        <SalaryOverview
          netSalary={typeof salary.netSalary === 'string' ? parseFloat(salary.netSalary) : salary.netSalary}
          month={new Date(salary.month)}
          onViewPayslip={() => router.push('/employee/payslips')}
        />

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Actions Rapides</h2>
          <QuickActionCard
            icon={Clock}
            title="Pointer"
            description="Entrée 08:15"
            onClick={() => router.push('/time-tracking')}
          />
          <QuickActionCard
            icon={Calendar}
            title="Demander Congé"
            description={`Solde: ${leaveBalance.remaining} jours`}
            onClick={() => router.push('/time-off')}
          />
          <QuickActionCard
            icon={FileText}
            title="Demander un Document"
            description="Attestation, certificat..."
            onClick={() => router.push('/employee/document-requests')}
          />
        </div>

        {/* Collapsible Sections */}
        <CollapsibleSection title="Mes Bulletins" count={recentPayslips.length} defaultOpen={true}>
          <div className="space-y-2">
            {recentPayslips.map((payslip: any) => (
              <div
                key={payslip.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/employee/payslips');
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push('/employee/payslips');
                  }
                }}
              >
                <div>
                  <p className="font-medium">
                    {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(payslip.payrollRun.periodEnd))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat('fr-FR').format(payslip.netSalary)} FCFA
                  </p>
                </div>
              </div>
            ))}
            {recentPayslips.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun bulletin disponible</p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push('/employee/payslips');
              }}
              className="w-full text-sm text-primary hover:underline py-2"
            >
              Voir tous mes bulletins →
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Mes Congés">
          <LeaveBalance
            used={leaveBalance.used}
            total={leaveBalance.total}
            remaining={leaveBalance.remaining}
          />
        </CollapsibleSection>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Main Content - 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Salary Overview with trend */}
          <SalaryOverview
            netSalary={typeof salary.netSalary === 'string' ? parseFloat(salary.netSalary) : salary.netSalary}
            month={new Date(salary.month)}
            showTrend={true}
            onViewPayslip={() => router.push('/employee/payslips')}
          />

          {/* Quick Actions - Side by side */}
          <div className="grid grid-cols-3 gap-4">
            <QuickActionCard
              icon={Clock}
              title="Pointer"
              description="Enregistrer votre présence"
              onClick={() => router.push('/time-tracking')}
            />
            <QuickActionCard
              icon={Calendar}
              title="Demander Congé"
              description={`${leaveBalance.remaining} jours disponibles`}
              onClick={() => router.push('/time-off')}
            />
            <QuickActionCard
              icon={FileText}
              title="Demander un Document"
              description="Attestation, certificat..."
              onClick={() => router.push('/employee/document-requests')}
            />
          </div>

          {/* Recent Payslips */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Mes Bulletins de Paie</h2>
            <div className="space-y-3">
              {recentPayslips.map((payslip: any) => (
                <div
                  key={payslip.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/employee/payslips');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push('/employee/payslips');
                    }
                  }}
                >
                  <div>
                    <p className="font-medium">
                      {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(payslip.payrollRun.periodEnd))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Salaire net
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {new Intl.NumberFormat('fr-FR').format(payslip.netSalary)} FCFA
                    </p>
                  </div>
                </div>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/employee/payslips');
                }}
                className="w-full text-sm text-primary hover:underline py-2"
              >
                Voir tous mes bulletins →
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          <LeaveBalance
            used={leaveBalance.used}
            total={leaveBalance.total}
            remaining={leaveBalance.remaining}
          />

          {/* Additional stats can go here */}
        </div>
      </div>
    </div>
  );
}
