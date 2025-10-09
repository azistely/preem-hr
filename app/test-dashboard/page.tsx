"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { ResponsiveDataDisplay } from "@/components/dashboard/responsive-data-display";
import {
  Wallet,
  Calendar,
  Clock,
  FileText,
  Users,
  CheckSquare,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/navigation/bottom-nav";

// Mock data for testing
const mockEmployeeData = {
  salary: 850000,
  leaveBalance: { used: 5, total: 30, remaining: 25 },
  nextPayment: "2024-01-05",
  recentPayslips: [
    { id: 1, month: "Décembre 2023", net: 850000, status: "Payé" },
    { id: 2, month: "Novembre 2023", net: 850000, status: "Payé" },
    { id: 3, month: "Octobre 2023", net: 850000, status: "Payé" },
  ]
};

const mockManagerData = {
  team: { total: 12, present: 10, absent: 2 },
  pendingApprovals: 3,
  monthlyCosts: 8500000,
};

const mockHRData = {
  employeeCount: 145,
  payrollCost: 95000000,
  pendingActions: 7,
  nextPayrollDate: "2024-01-25"
};

export default function TestDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile View (375px) */}
      <div className="lg:hidden p-4 pb-20 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground">Test des composants mobiles</p>
        </div>

        {/* Employee Dashboard Components */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Employé</h2>

          <MetricCard
            title="Salaire Net"
            value={`${mockEmployeeData.salary.toLocaleString()} FCFA`}
            icon={Wallet}
            trend={{ value: 0, label: "Stable" }}
          />

          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard
              icon={FileText}
              label="Bulletins"
              description="Voir mes fiches"
              onClick={() => console.log("View payslips")}
            />
            <QuickActionCard
              icon={Calendar}
              label="Congés"
              description="Faire une demande"
              onClick={() => console.log("Request leave")}
              badge={`${mockEmployeeData.leaveBalance.remaining}j`}
            />
          </div>

          <CollapsibleSection title="Bulletins Récents" defaultOpen={false}>
            <div className="space-y-2">
              {mockEmployeeData.recentPayslips.map((slip) => (
                <Card key={slip.id} className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{slip.month}</p>
                      <p className="text-sm text-muted-foreground">{slip.net.toLocaleString()} FCFA</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      {slip.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>
        </section>

        {/* Manager Dashboard Components */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Manager</h2>

          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              title="Équipe"
              value={mockManagerData.team.total}
              icon={Users}
              compact
            />
            <MetricCard
              title="Présents"
              value={mockManagerData.team.present}
              icon={CheckSquare}
              compact
            />
            <MetricCard
              title="Approbations"
              value={mockManagerData.pendingApprovals}
              icon={AlertCircle}
              compact
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline">
                <CheckSquare className="mr-2 h-4 w-4" />
                Approuver les demandes ({mockManagerData.pendingApprovals})
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Voir les présences
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* HR Dashboard Components */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">RH</h2>

          <MetricCard
            title="Masse Salariale"
            value={`${(mockHRData.payrollCost / 1000000).toFixed(1)}M FCFA`}
            icon={DollarSign}
            trend={{ value: 2.5, label: "+2.5% vs mois dernier" }}
          />

          <ResponsiveDataDisplay
            data={[
              { label: "Employés Actifs", value: mockHRData.employeeCount },
              { label: "Actions en Attente", value: mockHRData.pendingActions },
              { label: "Prochaine Paie", value: mockHRData.nextPayrollDate }
            ]}
            mobileView={(item) => (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            )}
          />
        </section>
      </div>

      {/* Desktop View (1024px+) */}
      <div className="hidden lg:block p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Tableau de Bord - Vue Desktop</h1>
            <p className="text-muted-foreground">Test des composants en version desktop</p>
          </div>

          {/* Desktop Grid Layout */}
          <div className="grid grid-cols-3 gap-6">
            {/* Employee Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Employé</h2>
              <MetricCard
                title="Salaire Net"
                value={`${mockEmployeeData.salary.toLocaleString()} FCFA`}
                icon={Wallet}
                trend={{ value: 0, label: "Stable" }}
              />
              <QuickActionCard
                icon={FileText}
                label="Bulletins de Paie"
                description="Consulter l'historique"
                onClick={() => console.log("View payslips")}
              />
              <QuickActionCard
                icon={Calendar}
                label="Demande de Congés"
                description={`${mockEmployeeData.leaveBalance.remaining} jours disponibles`}
                onClick={() => console.log("Request leave")}
              />
            </div>

            {/* Manager Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Manager</h2>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  title="Équipe"
                  value={mockManagerData.team.total}
                  icon={Users}
                />
                <MetricCard
                  title="Présents"
                  value={mockManagerData.team.present}
                  icon={CheckSquare}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Approbations en Attente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{mockManagerData.pendingApprovals}</div>
                  <Button className="mt-4 w-full">Voir les Demandes</Button>
                </CardContent>
              </Card>
            </div>

            {/* HR Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Ressources Humaines</h2>
              <MetricCard
                title="Effectif Total"
                value={mockHRData.employeeCount}
                icon={Building}
                trend={{ value: 3, label: "+3 ce mois" }}
              />
              <MetricCard
                title="Masse Salariale"
                value={`${(mockHRData.payrollCost / 1000000).toFixed(1)}M`}
                icon={DollarSign}
                trend={{ value: 2.5, label: "+2.5%" }}
              />
              <Card>
                <CardHeader>
                  <CardTitle>Prochaine Paie</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockHRData.nextPayrollDate}</div>
                  <Button className="mt-4 w-full" variant="default">
                    Lancer la Paie
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation (Mobile Only) */}
      <BottomNav
        items={[
          { icon: Building, label: "Accueil", href: "/test-dashboard" },
          { icon: FileText, label: "Paies", href: "/test-dashboard" },
          { icon: Clock, label: "Temps", href: "/test-dashboard" },
          { icon: Calendar, label: "Congés", href: "/test-dashboard" },
          { icon: Users, label: "Équipe", href: "/test-dashboard" },
        ]}
        currentPath="/test-dashboard"
      />
    </div>
  );
}