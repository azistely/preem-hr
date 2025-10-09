# 👥 User Roles & Dashboard Design - Preem HR

**Date:** 2025-10-08
**Status:** Comprehensive Design Document with Mobile-First Responsive Design
**Purpose:** Define user personas, dashboards, navigation, and feature mapping for all roles

> ⚠️ **IMPORTANT:** All designs follow mobile-first principles. Every dashboard starts at 375px width and progressively enhances for tablet (768px) and desktop (1024px+).

---

## Table of Contents
1. [User Role Personas & Jobs-to-be-Done](#user-role-personas--jobs-to-be-done)
2. [Mobile-First Dashboard Designs](#mobile-first-dashboard-designs)
3. [Responsive Navigation Structure](#responsive-navigation-structure)
4. [Feature Access Matrix](#feature-access-matrix)
5. [Implementation Priorities](#implementation-priorities)
6. [Responsive Design System](#responsive-design-system)

---

# User Role Personas & Jobs-to-be-Done

## Role 1: Employee (Employé)

### Persona
**Name:** Marie Koné
**Background:** Marketing assistant at a tech company in Abidjan. 28 years old, uses smartphone for everything. Limited HR knowledge.
**Digital Literacy:** Medium - comfortable with WhatsApp, social media, mobile banking
**Device:** iPhone 12 (primary), occasionally desktop at work
**Pain Points:**
- Doesn't understand payslip deductions
- Always forgets to clock in/out
- Time-off requests get lost in email
- Needs to check balance before planning vacation

### Jobs-to-be-Done

| Job | Outcome | Pain Point | Frequency |
|-----|---------|------------|-----------|
| **View my payslip** | Know exactly how much I'm getting paid and why | Payslips are PDFs with cryptic codes | Monthly |
| **Request time off** | Get vacation approved quickly without chasing manager | Email back-and-forth, no visibility | 4-6x/year |
| **Check leave balance** | Plan vacation knowing I have enough days | Have to email HR to ask | 2-3x/year |
| **Clock in/out** | Record work hours without forgetting | Forget to clock in, get docked pay | Daily |
| **Update personal info** | Keep my phone/address current | Have to email HR for changes | 1-2x/year |
| **View work schedule** | Know my shifts for the week | Schedule changes via WhatsApp | Weekly |
| **See overtime hours** | Know if I'm earning extra pay | No visibility into overtime | Weekly |

---

## Role 2: Manager (Chef d'Équipe)

### Persona
**Name:** Kouadio Ané
**Background:** Sales manager, 15-person team. 38 years old. No HR training.
**Digital Literacy:** Medium - uses email, Excel, video calls
**Device:** Android phone (field work), laptop (office)
**Pain Points:**
- Approving on the go is difficult
- Can't see team status from mobile
- Overtime surprises at month-end
- No mobile access to approve requests

### Jobs-to-be-Done

| Job | Outcome | Pain Point | Frequency |
|-----|---------|------------|-----------|
| **Approve requests (mobile)** | Handle approvals anywhere | Can't approve from phone | Daily |
| **See team status** | Know who's in/out today | WhatsApp chaos | Daily |
| **Review overtime** | Control costs before payroll | See it too late | Weekly |
| **Track performance** | Monitor team productivity | No mobile dashboards | Weekly |
| **Approve timesheets** | Verify hours quickly | Excel on phone is painful | Weekly |

---

## Role 3: HR Manager (Responsable RH)

### Persona
**Name:** Aminata Diallo
**Background:** HR generalist, 150-person company. 32 years old.
**Digital Literacy:** High - uses HRIS, Excel, Google Workspace
**Device:** Desktop (primary), iPad (meetings), iPhone (emergencies)
**Pain Points:**
- Needs full power on desktop
- But also check urgent items on mobile
- Payroll takes 3 days monthly
- Compliance anxiety

### Jobs-to-be-Done

| Job | Outcome | Pain Point | Frequency |
|-----|---------|------------|-----------|
| **Run payroll** | Complete in <1 hour | Takes 3 days currently | Monthly |
| **Handle urgent HR** | Respond from anywhere | Desktop-only access | Daily |
| **Monitor compliance** | Stay compliant always | Manual tracking | Daily |
| **Analyze metrics** | Spot trends early | No mobile analytics | Weekly |
| **Manage employees** | Quick updates anywhere | Need desktop for everything | Daily |

---

## Role 4: Tenant Admin (Administrateur)

### Persona
**Name:** Jean-Paul Kouassi
**Background:** Finance Director/CEO, MBA holder. 45 years old.
**Digital Literacy:** High - strategic user, not operational
**Device:** iPhone 14 Pro (always), MacBook Pro (office)
**Pain Points:**
- Needs high-level view on mobile
- Detailed analysis on desktop
- Security concerns
- Cost control

### Jobs-to-be-Done

| Job | Outcome | Pain Point | Frequency |
|-----|---------|------------|-----------|
| **Monitor costs** | Control payroll spend | No mobile visibility | Daily |
| **Approve budgets** | Quick decisions | Need laptop to approve | Weekly |
| **Review security** | Ensure compliance | Can't check from phone | Weekly |
| **Configure system** | Update settings | Desktop-only admin | Monthly |

---

## Role 5: Super Admin (Platform Admin)

### Persona
**Name:** Fatou Sow
**Background:** Platform operations, manages 50+ tenants
**Digital Literacy:** Expert - technical background
**Device:** Multiple monitors (primary), laptop (remote), phone (alerts)
**Pain Points:**
- Platform monitoring 24/7
- Incident response from anywhere
- Multi-country complexity

### Jobs-to-be-Done

| Job | Outcome | Pain Point | Frequency |
|-----|---------|------------|-----------|
| **Monitor platform** | 99.9% uptime | Need mobile alerts | Continuous |
| **Respond to incidents** | Fix from anywhere | Desktop-only tools | As needed |
| **Provision tenants** | Quick setup | Complex process | Weekly |
| **Configure countries** | Add new markets | Manual SQL updates | Monthly |

---

# Mobile-First Dashboard Designs

## Design Principles
1. **Mobile Base (375px)**: Essential information only
2. **Tablet Enhancement (768px)**: Add secondary info
3. **Desktop Power (1024px+)**: Full analytics suite
4. **Progressive Disclosure**: Collapse by default on mobile
5. **Touch-Friendly**: All targets ≥44×44px

---

## 1. Employee Dashboard

### Mobile View (375×667px) - PRIMARY DESIGN

```
┌─────────────────────────────────┐
│ 🏠 Mon Tableau de Bord          │
│ ································ │
│                                  │
│ Bonjour Marie 👋                │
│ Marketing Assistant              │
│                                  │
│ ┌──────────────────────────────┐│
│ │ 📅 Octobre 2025              ││
│ │ ┌────────────────────────┐   ││
│ │ │ Salaire Net            │   ││
│ │ │ 850,000 FCFA           │   ││
│ │ │ → Voir bulletin        │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ ACTIONS RAPIDES              ││
│ │ ┌────────────────────────┐   ││
│ │ │ 🕐 Pointer             │   ││
│ │ │ [Entrée 08:15]         │   ││
│ │ └────────────────────────┘   ││
│ │ ┌────────────────────────┐   ││
│ │ │ 🌴 Demander Congé     │   ││
│ │ │ Solde: 18.5 jours      │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ > Mes Bulletins (12)     ↓  ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ > Mes Congés             ↓  ││
│ └──────────────────────────────┘│
│                                  │
├──────────────────────────────────┤
│ 🏠    📄    ⏰    🌴    👤     │
│ Accueil Paies Temps Congés Profil│
└──────────────────────────────────┘
```

### Tablet View (768px) - ENHANCED

```tsx
<div className="grid grid-cols-2 gap-4 p-6">
  {/* Salary Card - Expanded with chart */}
  <Card className="col-span-2">
    <SalaryOverview showTrend={true} showBreakdown={false} />
  </Card>

  {/* Quick Actions - Side by side */}
  <QuickActionCard icon="Clock" title="Pointer" />
  <QuickActionCard icon="Calendar" title="Congés" />

  {/* Recent Items - Visible */}
  <RecentPayslips limit={3} />
  <LeaveBalance detailed={true} />
</div>
```

### Desktop View (1024px+) - FULL EXPERIENCE

```tsx
<div className="flex">
  {/* Sidebar Navigation - Now visible */}
  <Sidebar className="w-64" />

  <main className="flex-1 grid grid-cols-3 gap-6 p-8">
    {/* Full salary breakdown with chart */}
    <Card className="col-span-2">
      <SalaryOverview
        showTrend={true}
        showBreakdown={true}
        showComparison={true}
      />
    </Card>

    {/* Quick Stats */}
    <StatsColumn>
      <AttendanceStats />
      <LeaveBalance />
      <NextPayday />
    </StatsColumn>

    {/* Data Table for payslips */}
    <PayslipsTable className="col-span-3" />
  </main>
</div>
```

---

## 2. Manager Dashboard

### Mobile View (375×667px) - PRIMARY DESIGN

```
┌─────────────────────────────────┐
│ 👥 Tableau de Bord Manager      │
│ ································ │
│                                  │
│ ┌──────────────────────────────┐│
│ │ ⚡ URGENT (3)                ││
│ │ ┌────────────────────────┐   ││
│ │ │ Congés à approuver (2) │   ││
│ │ │ Marie K. - 3 jours    │   ││
│ │ │ [Approuver] [Rejeter]  │   ││
│ │ └────────────────────────┘   ││
│ │ ┌────────────────────────┐   ││
│ │ │ Heures sup à valider  │   ││
│ │ │ Paul A. - 8 heures    │   ││
│ │ │ [Voir détails]         │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ MON ÉQUIPE                   ││
│ │ ┌────────────────────────┐   ││
│ │ │ 15 personnes           │   ││
│ │ │ 👥 13 présents        │   ││
│ │ │ 🌴 2 absents          │   ││
│ │ │ → Voir détails        │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ > Coûts du mois         ↓   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ > Heures supplémentaires ↓   ││
│ └──────────────────────────────┘│
│                                  │
├──────────────────────────────────┤
│ 🏠    👥    ✅    📊    ⚙️     │
│ Accueil Équipe Approuver Stats  │
└──────────────────────────────────┘
```

### Tablet View (768px) - ENHANCED

```tsx
<div className="p-6">
  {/* Urgent items - Full width */}
  <UrgentApprovals className="mb-6" expanded={true} />

  <div className="grid grid-cols-2 gap-4">
    {/* Team Overview - With photos */}
    <TeamCard showPhotos={true} />

    {/* Quick Stats */}
    <QuickStats>
      <Stat label="Présents" value="13/15" />
      <Stat label="Heures sup" value="45h" />
      <Stat label="Coût mensuel" value="12.5M" />
    </QuickStats>

    {/* Recent activity - Now visible */}
    <RecentActivity className="col-span-2" />
  </div>
</div>
```

### Desktop View (1024px+) - FULL EXPERIENCE

```tsx
<div className="flex">
  <Sidebar className="w-64" />

  <main className="flex-1 p-8">
    {/* Priority Queue - Kanban style */}
    <div className="grid grid-cols-3 gap-6 mb-8">
      <ApprovalQueue type="urgent" />
      <ApprovalQueue type="pending" />
      <ApprovalQueue type="completed" />
    </div>

    {/* Team Analytics */}
    <div className="grid grid-cols-4 gap-6">
      <TeamRoster className="col-span-2" interactive={true} />
      <OvertimeChart />
      <CostBreakdown />

      {/* Full data table */}
      <TeamPerformanceTable className="col-span-4" />
    </div>
  </main>
</div>
```

---

## 3. HR Manager Dashboard

### Mobile View (375×667px) - PRIMARY DESIGN

```
┌─────────────────────────────────┐
│ 📊 RH Dashboard                 │
│ ································ │
│                                  │
│ ┌──────────────────────────────┐│
│ │ 🚨 ACTIONS CRITIQUES         ││
│ │ ┌────────────────────────┐   ││
│ │ │ Paie Octobre           │   ││
│ │ │ À lancer avant le 25   │   ││
│ │ │ [Commencer]            │   ││
│ │ └────────────────────────┘   ││
│ │ ┌────────────────────────┐   ││
│ │ │ 3 Contrats expirent    │   ││
│ │ │ Cette semaine          │   ││
│ │ │ [Voir]                 │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ MÉTRIQUES CLÉS               ││
│ │ ┌────────────────────────┐   ││
│ │ │ Effectif: 150           │   ││
│ │ │ Masse salariale: 127M   │   ││
│ │ │ Turnover: 8%            │   ││
│ │ │ [Voir détails]          │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ ACTIONS RAPIDES              ││
│ │ [+ Nouvel employé]           ││
│ │ [🚀 Lancer la paie]          ││
│ │ [📋 Rapports]                ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ > Employés (150)         ↓   ││
│ └──────────────────────────────┘│
│                                  │
├──────────────────────────────────┤
│ 🏠    👥    💰    📊    ⚙️     │
│ Accueil Employés Paie Stats     │
└──────────────────────────────────┘
```

### Tablet View (768px) - ENHANCED

```tsx
<div className="p-6">
  {/* Critical Actions - More detail */}
  <CriticalActions showDeadlines={true} />

  <div className="grid grid-cols-2 gap-6 mt-6">
    {/* Key Metrics - With sparklines */}
    <MetricsCard>
      <Metric label="Effectif" value="150" trend="+2" />
      <Metric label="Masse salariale" value="127M" trend="+5%" />
    </MetricsCard>

    {/* Quick Actions - Grid layout */}
    <QuickActions columns={2}>
      <ActionButton icon="UserPlus" label="Nouvel employé" />
      <ActionButton icon="Play" label="Lancer paie" />
      <ActionButton icon="FileText" label="Rapports" />
      <ActionButton icon="Settings" label="Config" />
    </QuickActions>

    {/* Compliance Status - Now visible */}
    <ComplianceCard className="col-span-2" />
  </div>
</div>
```

### Desktop View (1024px+) - FULL ANALYTICS SUITE

```tsx
<div className="flex">
  <Sidebar className="w-64" sections={hrSections} />

  <main className="flex-1 p-8">
    {/* Command Center */}
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatCard title="Effectif" value="150" change="+2" />
      <StatCard title="Masse salariale" value="127M FCFA" change="+5%" />
      <StatCard title="Turnover" value="8%" change="-2%" />
      <StatCard title="Absence" value="4.2%" change="0%" />
    </div>

    {/* Interactive Dashboards */}
    <div className="grid grid-cols-3 gap-6">
      {/* Payroll Timeline */}
      <Card className="col-span-2">
        <PayrollTimeline interactive={true} />
      </Card>

      {/* Compliance Matrix */}
      <ComplianceMatrix>
        <ComplianceItem name="CNPS" status="ok" />
        <ComplianceItem name="ITS" status="warning" />
        <ComplianceItem name="CMU" status="ok" />
      </ComplianceMatrix>

      {/* Department breakdown */}
      <DepartmentBreakdown className="col-span-3" />

      {/* Full Employee DataTable */}
      <EmployeeDataTable
        className="col-span-3"
        features={['search', 'filter', 'export', 'bulk-actions']}
      />
    </div>
  </main>
</div>
```

---

## 4. Tenant Admin Dashboard

### Mobile View (375×667px) - PRIMARY DESIGN

```
┌─────────────────────────────────┐
│ ⚙️ Administration               │
│ ································ │
│                                  │
│ ┌──────────────────────────────┐│
│ │ SOCIÉTÉ: TechCo Abidjan      ││
│ │ Plan: Professional            ││
│ │ Expire: 15 Jan 2026          ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ 💰 COÛTS MENSUELS            ││
│ │ ┌────────────────────────┐   ││
│ │ │ Masse salariale: 127M   │   ││
│ │ │ Charges: 45M            │   ││
│ │ │ Total: 172M FCFA        │   ││
│ │ │ [Voir détails]          │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ SÉCURITÉ                     ││
│ │ ✅ 2FA activé               ││
│ │ ⚠️ 3 comptes inactifs       ││
│ │ [Gérer sécurité]             ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ ACTIONS ADMIN                ││
│ │ [Utilisateurs (25)]          ││
│ │ [Rôles & Permissions]        ││
│ │ [Paramètres société]         ││
│ │ [Intégrations]               ││
│ └──────────────────────────────┘│
│                                  │
├──────────────────────────────────┤
│ 🏠    💰    👥    🔒    ⚙️     │
│ Accueil Coûts Users Sécurité    │
└──────────────────────────────────┘
```

### Tablet View (768px) - ENHANCED

```tsx
<div className="p-6">
  {/* Company Overview - Full width */}
  <CompanyHeader expanded={true} showLogo={true} />

  <div className="grid grid-cols-2 gap-6 mt-6">
    {/* Cost Analysis - With chart */}
    <CostCard showChart={true} period="6months" />

    {/* Security Status - Detailed */}
    <SecurityCard>
      <SecurityMetric label="2FA Users" value="22/25" />
      <SecurityMetric label="Last Audit" value="5 days ago" />
      <AlertsList limit={3} />
    </SecurityCard>

    {/* User Management - Preview */}
    <UsersList className="col-span-2" preview={true} limit={5} />

    {/* System Health */}
    <SystemHealth className="col-span-2" />
  </div>
</div>
```

### Desktop View (1024px+) - FULL CONTROL PANEL

```tsx
<div className="flex">
  <Sidebar className="w-64" sections={adminSections} />

  <main className="flex-1 p-8">
    {/* Organization Overview */}
    <OrganizationHeader className="mb-8" />

    {/* Admin Command Center */}
    <div className="grid grid-cols-4 gap-6 mb-8">
      <MetricCard title="Users" value="25" sublabel="3 admins" />
      <MetricCard title="Monthly Cost" value="172M FCFA" trend="+3%" />
      <MetricCard title="Data Usage" value="2.3 GB" max="10 GB" />
      <MetricCard title="API Calls" value="45K" max="100K" />
    </div>

    {/* Management Panels */}
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Users & Roles</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <UserManagementTable
          features={['invite', 'roles', 'permissions', 'bulk-actions']}
        />
      </TabsContent>

      <TabsContent value="security">
        <SecurityDashboard>
          <ActiveSessions />
          <FailedLogins />
          <PermissionMatrix />
        </SecurityDashboard>
      </TabsContent>

      <TabsContent value="audit">
        <AuditLogTable searchable={true} exportable={true} />
      </TabsContent>
    </Tabs>
  </main>
</div>
```

---

## 5. Super Admin Dashboard

### Mobile View (375×667px) - EMERGENCY ACCESS

```
┌─────────────────────────────────┐
│ 🌐 Platform Admin               │
│ ································ │
│                                  │
│ ┌──────────────────────────────┐│
│ │ 🟢 SYSTEM STATUS             ││
│ │ All systems operational      ││
│ │ Uptime: 99.98%              ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ ⚠️ ALERTS (2)               ││
│ │ ┌────────────────────────┐   ││
│ │ │ High CPU - Tenant #45   │   ││
│ │ │ 5 min ago               │   ││
│ │ │ [Investigate]           │   ││
│ │ └────────────────────────┘   ││
│ │ ┌────────────────────────┐   ││
│ │ │ Payment failed - #12    │   ││
│ │ │ [Contact]               │   ││
│ │ └────────────────────────┘   ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ PLATFORM METRICS             ││
│ │ Tenants: 52                  ││
│ │ Users: 1,247                 ││
│ │ Countries: 4                 ││
│ │ [View Dashboard]             ││
│ └──────────────────────────────┘│
│                                  │
│ ┌──────────────────────────────┐│
│ │ QUICK ACTIONS                ││
│ │ [🔍 Search Tenant]           ││
│ │ [🚨 Incident Response]       ││
│ │ [📊 Platform Stats]          ││
│ └──────────────────────────────┘│
├──────────────────────────────────┤
│ 🏠    🌐    🚨    📊    🔧     │
│ Home Tenants Alerts Stats Tools │
└──────────────────────────────────┘
```

### Desktop View (1440px+) - MISSION CONTROL

```tsx
<div className="min-h-screen bg-black text-green-400"> {/* Matrix theme */}
  <div className="flex">
    <Sidebar className="w-64 bg-gray-900" sections={superAdminSections} />

    <main className="flex-1 p-8">
      {/* System Health Matrix */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        <SystemStatus service="API" status="operational" latency="45ms" />
        <SystemStatus service="Database" status="operational" latency="12ms" />
        <SystemStatus service="Storage" status="operational" usage="34%" />
        <SystemStatus service="Queue" status="operational" jobs="234" />
        <SystemStatus service="Cache" status="operational" hitRate="94%" />
        <SystemStatus service="CDN" status="operational" hitRate="98%" />
      </div>

      {/* Multi-Tenant Overview */}
      <div className="grid grid-cols-4 gap-6">
        {/* Real-time Metrics */}
        <Card className="col-span-2 bg-gray-900">
          <RealTimeMetrics>
            <LiveChart metric="requests" />
            <LiveChart metric="cpu" />
            <LiveChart metric="memory" />
          </RealTimeMetrics>
        </Card>

        {/* Tenant Health Map */}
        <TenantHealthMap className="col-span-2" />

        {/* Alert Center */}
        <AlertCenter className="col-span-4">
          <AlertQueue priority="critical" />
          <AlertQueue priority="warning" />
          <AlertQueue priority="info" />
        </AlertCenter>

        {/* Country Configuration */}
        <CountryManager className="col-span-2">
          {countries.map(country => (
            <CountryCard
              key={country.code}
              country={country}
              tenantCount={getTenantCount(country.code)}
              features={['edit-tax', 'edit-social', 'preview']}
            />
          ))}
        </CountryManager>

        {/* Tenant Management DataTable */}
        <TenantDataTable
          className="col-span-4"
          features={['search', 'filter', 'suspend', 'impersonate', 'billing']}
        />
      </div>
    </main>
  </div>
</div>
```

---

# Responsive Navigation Structure

## Navigation Principles

1. **Mobile (< 768px)**: Bottom navigation with 4-5 items max
2. **Tablet (768px-1023px)**: Collapsible sidebar or top nav
3. **Desktop (1024px+)**: Full sidebar with sections and search
4. **Consistency**: Same items, different layouts

## Implementation Pattern

```tsx
// Responsive Navigation Component
const Navigation = ({ role }: { role: UserRole }) => {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isMobile) {
    return (
      <MobileBottomNav
        items={getMainNavItems(role).slice(0, 5)}
        activeRoute={pathname}
      />
    )
  }

  if (isTablet) {
    return (
      <TabletNav
        collapsible={true}
        items={getNavItems(role)}
        showLabels={!isCollapsed}
      />
    )
  }

  // Desktop
  return (
    <DesktopSidebar
      sections={getNavSections(role)}
      showSearch={true}
      showUserProfile={true}
      collapsible={true}
    />
  )
}
```

## Employee Navigation

### Mobile (Bottom Nav)
```tsx
const employeeMobileNav = [
  { icon: Home, label: 'Accueil', href: '/employee/dashboard' },
  { icon: FileText, label: 'Paies', href: '/employee/payslips' },
  { icon: Clock, label: 'Temps', href: '/employee/time' },
  { icon: Calendar, label: 'Congés', href: '/employee/leave' },
  { icon: User, label: 'Profil', href: '/employee/profile' },
]
```

### Desktop (Sidebar)
```tsx
const employeeDesktopNav = {
  main: [
    { icon: Home, label: 'Tableau de bord', href: '/employee/dashboard' },
  ],
  payroll: [
    { icon: FileText, label: 'Mes bulletins', href: '/employee/payslips' },
    { icon: TrendingUp, label: 'Historique salaire', href: '/employee/salary-history' },
  ],
  time: [
    { icon: Clock, label: 'Pointage', href: '/employee/clock' },
    { icon: Calendar, label: 'Planning', href: '/employee/schedule' },
    { icon: Timer, label: 'Heures sup', href: '/employee/overtime' },
  ],
  leave: [
    { icon: Beach, label: 'Demander congé', href: '/employee/leave/request' },
    { icon: BarChart, label: 'Mon solde', href: '/employee/leave/balance' },
    { icon: History, label: 'Historique', href: '/employee/leave/history' },
  ],
  profile: [
    { icon: User, label: 'Mes informations', href: '/employee/profile' },
    { icon: Settings, label: 'Préférences', href: '/employee/settings' },
  ],
}
```

## Manager Navigation

### Mobile (Bottom Nav)
```tsx
const managerMobileNav = [
  { icon: Home, label: 'Accueil', href: '/manager/dashboard' },
  { icon: Users, label: 'Équipe', href: '/manager/team' },
  { icon: CheckSquare, label: 'Approuver', href: '/manager/approvals', badge: '3' },
  { icon: BarChart, label: 'Rapports', href: '/manager/reports' },
  { icon: Settings, label: 'Plus', href: '/manager/more' },
]
```

### Desktop (Sidebar with Sections)
```tsx
const managerDesktopNav = {
  overview: [
    { icon: Home, label: 'Tableau de bord', href: '/manager/dashboard' },
    { icon: Bell, label: 'Notifications', href: '/manager/notifications', badge: '5' },
  ],
  team: [
    { icon: Users, label: 'Mon équipe', href: '/manager/team' },
    { icon: UserCheck, label: 'Présences', href: '/manager/attendance' },
    { icon: Timer, label: 'Heures sup', href: '/manager/overtime' },
    { icon: DollarSign, label: 'Coûts équipe', href: '/manager/costs' },
  ],
  approvals: [
    { icon: CheckSquare, label: 'File d\'attente', href: '/manager/approvals', badge: '3' },
    { icon: Calendar, label: 'Congés', href: '/manager/approvals/leave' },
    { icon: Clock, label: 'Pointages', href: '/manager/approvals/time' },
    { icon: FileText, label: 'Documents', href: '/manager/approvals/documents' },
  ],
  reports: [
    { icon: BarChart, label: 'Performance', href: '/manager/reports/performance' },
    { icon: TrendingUp, label: 'Productivité', href: '/manager/reports/productivity' },
    { icon: PieChart, label: 'Analytics', href: '/manager/reports/analytics' },
  ],
}
```

## HR Manager Navigation

### Mobile (Hamburger Menu due to complexity)
```tsx
// Too many items for bottom nav - use hamburger menu
const HRMobileNav = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" className="fixed top-4 left-4">
        <Menu />
      </Button>
    </SheetTrigger>
    <SheetContent side="left" className="w-[80%]">
      <nav className="space-y-4">
        {/* Grouped sections */}
        <NavSection title="Essentiel" items={essentialItems} />
        <NavSection title="Paie" items={payrollItems} />
        <NavSection title="Employés" items={employeeItems} />
        <NavSection title="Rapports" items={reportItems} />
      </nav>
    </SheetContent>
  </Sheet>
)
```

### Desktop (Full Sidebar)
```tsx
const hrDesktopNav = {
  dashboard: [
    { icon: Home, label: 'Tableau de bord', href: '/admin/dashboard' },
    { icon: Bell, label: 'Actions urgentes', href: '/admin/urgent', badge: 'NEW' },
  ],
  payroll: [
    { icon: Play, label: 'Lancer la paie', href: '/payroll/new' },
    { icon: History, label: 'Historique paies', href: '/payroll/history' },
    { icon: Calculator, label: 'Simulateur', href: '/payroll/simulator' },
    { icon: FileText, label: 'Bulletins', href: '/payroll/payslips' },
    { icon: Receipt, label: 'Déclarations', href: '/payroll/declarations' },
  ],
  employees: [
    { icon: Users, label: 'Liste employés', href: '/employees' },
    { icon: UserPlus, label: 'Nouvel employé', href: '/employees/new' },
    { icon: Upload, label: 'Import/Export', href: '/employees/import-export' },
    { icon: Building, label: 'Départements', href: '/departments' },
    { icon: Briefcase, label: 'Postes', href: '/positions' },
  ],
  time: [
    { icon: Clock, label: 'Pointages', href: '/time-tracking' },
    { icon: Calendar, label: 'Planning', href: '/schedules' },
    { icon: Timer, label: 'Heures sup', href: '/overtime' },
    { icon: MapPin, label: 'Géolocalisation', href: '/geofencing' },
  ],
  leave: [
    { icon: Beach, label: 'Demandes congés', href: '/time-off/requests' },
    { icon: Settings, label: 'Politiques', href: '/time-off/policies' },
    { icon: BarChart, label: 'Soldes', href: '/time-off/balances' },
    { icon: Calendar, label: 'Jours fériés', href: '/holidays' },
  ],
  reports: [
    { icon: FileText, label: 'Rapports RH', href: '/reports/hr' },
    { icon: TrendingUp, label: 'Analytics', href: '/reports/analytics' },
    { icon: Download, label: 'Exports', href: '/reports/exports' },
  ],
  settings: [
    { icon: Settings, label: 'Configuration', href: '/settings' },
    { icon: Shield, label: 'Conformité', href: '/compliance' },
  ],
}
```

---

# Feature Access Matrix

## Access Levels
- ✅ **Full Access**: Can view and modify
- 👁️ **View Only**: Can view but not modify
- 🔒 **Limited**: Own data only
- ❌ **No Access**: Feature not available for role

| Feature | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|---------|----------|---------|------------|--------------|-------------|
| **PAYROLL** |
| View own payslips | ✅ | ✅ | ✅ | ✅ | ❌ |
| View team payslips | ❌ | 👁️ | ✅ | ✅ | ❌ |
| Run payroll | ❌ | ❌ | ✅ | ✅ | ❌ |
| Approve payroll | ❌ | ❌ | ✅ | ✅ | ❌ |
| Configure pay rules | ❌ | ❌ | ✅ | ✅ | ❌ |
| **EMPLOYEES** |
| View own profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit own profile | 🔒 | 🔒 | ✅ | ✅ | ❌ |
| View team | ❌ | ✅ | ✅ | ✅ | ❌ |
| View all employees | ❌ | ❌ | ✅ | ✅ | 👁️ |
| Add employee | ❌ | ❌ | ✅ | ✅ | ❌ |
| Terminate employee | ❌ | ❌ | ✅ | ✅ | ❌ |
| **TIME TRACKING** |
| Clock in/out | ✅ | ✅ | ✅ | ❌ | ❌ |
| View own time | ✅ | ✅ | ✅ | ❌ | ❌ |
| View team time | ❌ | ✅ | ✅ | ✅ | ❌ |
| Approve time | ❌ | 🔒 | ✅ | ✅ | ❌ |
| Configure geofencing | ❌ | ❌ | ✅ | ✅ | ❌ |
| **TIME OFF** |
| Request leave | ✅ | ✅ | ✅ | ❌ | ❌ |
| View own balance | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve team leave | ❌ | 🔒 | ✅ | ✅ | ❌ |
| Configure policies | ❌ | ❌ | ✅ | ✅ | ❌ |
| **REPORTS** |
| Own reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Team reports | ❌ | ✅ | ✅ | ✅ | ❌ |
| Company reports | ❌ | ❌ | ✅ | ✅ | ❌ |
| Financial reports | ❌ | ❌ | ✅ | ✅ | ❌ |
| **SETTINGS** |
| Personal settings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team settings | ❌ | 🔒 | ✅ | ✅ | ❌ |
| Company settings | ❌ | ❌ | ✅ | ✅ | ❌ |
| User management | ❌ | ❌ | ✅ | ✅ | ❌ |
| Billing | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SUPER ADMIN** |
| Tenant management | ❌ | ❌ | ❌ | ❌ | ✅ |
| Country config | ❌ | ❌ | ❌ | ❌ | ✅ |
| Platform monitoring | ❌ | ❌ | ❌ | ❌ | ✅ |
| Impersonate user | ❌ | ❌ | ❌ | ❌ | ✅ |

---

# Implementation Priorities

## Phase 1: P0 - Critical (✅ DONE - 5 days)
- [x] RBAC Implementation
- [x] Employee payslip access
- [x] Employee profile view
- [x] Manager team roster

## Phase 2: P1 - Dashboards & Navigation (NEXT - 8 days)

### Sprint Plan
| Day | Task | Components | Effort |
|-----|------|------------|--------|
| 1-2 | Core Components | `MetricCard`, `SummaryTable`, `QuickAction`, `CollapsibleSection` | 2 days |
| 3 | Employee Dashboard | Mobile-first, `/employee/dashboard` | 1 day |
| 4 | Manager Dashboard | Mobile + Desktop, `/manager/dashboard` | 1 day |
| 5-6 | HR Dashboard | Full responsive, `/admin/dashboard` | 2 days |
| 7 | Admin Dashboard | Desktop-focused, `/admin/settings/dashboard` | 1 day |
| 8 | Navigation | `BottomNav`, `Sidebar`, responsive behavior | 1 day |

## Phase 3: P2 - Enhancements (12 days)
- Org chart visualization (2 days)
- Advanced analytics dashboards (3 days)
- Workflow builder UI (3 days)
- Manager reports suite (2 days)
- Audit trail viewer (2 days)

## Phase 4: P3 - Super Admin (Deprioritized)
- Multi-tenant management UI
- Country configuration UI
- Platform monitoring dashboard
- Billing management

---

# Responsive Design System

## Breakpoint Strategy

```tsx
// Mobile-first breakpoints
const breakpoints = {
  sm: '640px',   // Large phones
  md: '768px',   // Tablets
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Wide screens
}

// Usage with Tailwind
className={cn(
  // Mobile first (default)
  "grid grid-cols-1 gap-4 p-4",
  // Tablet
  "md:grid-cols-2 md:gap-6 md:p-6",
  // Desktop
  "lg:grid-cols-3 lg:gap-8 lg:p-8",
  // Large desktop
  "xl:grid-cols-4"
)}
```

## Component Patterns

### 1. Responsive Card
```tsx
const ResponsiveCard = ({ children, className }) => (
  <Card className={cn(
    // Mobile: Compact
    "p-3 space-y-2",
    // Tablet: Medium
    "md:p-4 md:space-y-3",
    // Desktop: Spacious
    "lg:p-6 lg:space-y-4",
    className
  )}>
    {children}
  </Card>
)
```

### 2. Adaptive Data Display
```tsx
const DataDisplay = ({ data }) => {
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (isMobile) {
    // Mobile: Card list
    return <CardList items={data} />
  }

  // Desktop: Data table
  return <DataTable columns={columns} data={data} />
}
```

### 3. Progressive Disclosure
```tsx
const ProgressiveContent = ({ level1, level2, level3 }) => (
  <>
    {/* Level 1: Always visible */}
    <div className="block">
      {level1}
    </div>

    {/* Level 2: Hidden on mobile, visible on tablet+ */}
    <div className="hidden md:block">
      {level2}
    </div>

    {/* Level 3: Desktop only */}
    <div className="hidden lg:block">
      {level3}
    </div>
  </>
)
```

### 4. Touch-Friendly Targets
```tsx
const TouchButton = ({ children, ...props }) => (
  <Button
    className={cn(
      // Minimum touch target
      "min-h-[44px] min-w-[44px]",
      // Mobile: Full width
      "w-full",
      // Desktop: Auto width
      "lg:w-auto"
    )}
    {...props}
  >
    {children}
  </Button>
)
```

---

# Complete Route Map

## Employee Routes
| Route | Status | Priority | Component |
|-------|--------|----------|-----------|
| `/employee/dashboard` | 🔴 TODO | P1 | `EmployeeDashboard` |
| `/employee/payslips` | ✅ DONE | P0 | `EmployeePayslips` |
| `/employee/profile` | ✅ DONE | P0 | `EmployeeProfile` |
| `/employee/profile/edit` | ✅ DONE | P1 | `EmployeeProfileEdit` |
| `/employee/time/clock` | ✅ DONE | P0 | `ClockInOut` |
| `/employee/leave/request` | ✅ DONE | P0 | `LeaveRequest` |
| `/employee/leave/balance` | ✅ DONE | P1 | `LeaveBalance` |
| `/employee/schedule` | 🔴 TODO | P2 | `WorkSchedule` |

## Manager Routes
| Route | Status | Priority | Component |
|-------|--------|----------|-----------|
| `/manager/dashboard` | 🔴 TODO | P1 | `ManagerDashboard` |
| `/manager/team` | ✅ DONE | P0 | `TeamRoster` |
| `/manager/approvals` | 🔴 TODO | P1 | `ApprovalQueue` |
| `/manager/approvals/leave` | ✅ DONE | P1 | `LeaveApprovals` |
| `/manager/approvals/time` | 🔴 TODO | P1 | `TimeApprovals` |
| `/manager/reports/overtime` | ✅ DONE | P1 | `OvertimeReport` |
| `/manager/reports/costs` | 🔴 TODO | P2 | `CostReport` |
| `/manager/reports/performance` | 🔴 TODO | P2 | `PerformanceReport` |

## HR Manager Routes
| Route | Status | Priority | Component |
|-------|--------|----------|-----------|
| `/admin/dashboard` | 🔴 TODO | P1 | `HRDashboard` |
| `/employees` | ✅ DONE | P0 | `EmployeeList` |
| `/employees/new` | ✅ DONE | P0 | `HireWizard` |
| `/employees/[id]` | ✅ DONE | P0 | `EmployeeDetail` |
| `/employees/import-export` | ✅ DONE | P1 | `ImportExport` |
| `/payroll/runs` | ✅ DONE | P0 | `PayrollHistory` |
| `/payroll/runs/new` | ✅ DONE | P0 | `PayrollWizard` |
| `/payroll/dashboard` | ✅ DONE | P1 | `PayrollDashboard` |
| `/time-tracking` | ✅ DONE | P0 | `TimeTracking` |
| `/time-off/policies` | ✅ DONE | P1 | `LeavePolicy` |
| `/admin/public-holidays` | ✅ DONE | P1 | `PublicHolidays` |
| `/admin/geofencing` | ✅ DONE | P1 | `GeofenceConfig` |
| `/positions` | ✅ DONE | P0 | `PositionList` |
| `/positions/org-chart` | 🔴 TODO | P2 | `OrgChart` |

## Tenant Admin Routes
| Route | Status | Priority | Component |
|-------|--------|----------|-----------|
| `/admin/settings/dashboard` | 🔴 TODO | P1 | `AdminDashboard` |
| `/admin/settings/users` | 🔴 TODO | P1 | `UserManagement` |
| `/admin/settings/roles` | 🔴 TODO | P1 | `RoleManagement` |
| `/admin/settings/company` | 🔴 TODO | P1 | `CompanySettings` |
| `/admin/settings/billing` | 🔴 TODO | P1 | `BillingSettings` |
| `/admin/settings/integrations` | 🔴 TODO | P2 | `Integrations` |
| `/admin/settings/security` | 🔴 TODO | P1 | `SecuritySettings` |
| `/admin/audit-log` | 🔴 TODO | P2 | `AuditLog` |

## Super Admin Routes (P3 - Deprioritized)
| Route | Status | Priority | Component |
|-------|--------|----------|-----------|
| `/super-admin/dashboard` | 🔴 TODO | P3 | `PlatformDashboard` |
| `/super-admin/tenants` | 🔴 TODO | P3 | `TenantManager` |
| `/super-admin/countries` | 🔴 TODO | P3 | `CountryConfig` |
| `/super-admin/monitoring` | 🔴 TODO | P3 | `SystemMonitoring` |

---

# Success Metrics by Role

## Employee
- **Task Completion Rate**: 95% without help
- **Time to Find Payslip**: < 30 seconds
- **Leave Request Time**: < 2 minutes
- **Clock In Success**: 99% first try
- **NPS Score**: > 60

## Manager
- **Approval Time**: < 1 minute per request
- **Dashboard Adoption**: 80% daily active
- **Report Generation**: < 30 seconds
- **Team Visibility**: 100% real-time
- **Error Rate**: < 2%

## HR Manager
- **Payroll Run Time**: < 1 hour (vs 3 days manual)
- **Employee Onboarding**: < 15 minutes
- **Report Accuracy**: 99.5%
- **Compliance Score**: 100%
- **User Satisfaction**: > 85%

## Tenant Admin
- **Configuration Time**: < 10 minutes for changes
- **Audit Trail Coverage**: 100%
- **Security Score**: A+ rating
- **Cost Visibility**: Real-time
- **System Uptime**: 99.9%

## Super Admin
- **Tenant Provisioning**: < 10 minutes
- **Incident Response**: < 5 minutes
- **Platform Uptime**: 99.9%
- **Country Setup**: < 30 minutes
- **Support Ticket Resolution**: < 1 hour

---

## Next Steps for Implementation

### Immediate (Week 1)
1. Build core responsive components
2. Implement Employee Dashboard (mobile-first)
3. Implement Manager Dashboard (responsive)
4. Create navigation components

### Week 2
1. HR Manager Dashboard (full responsive)
2. Tenant Admin Dashboard
3. Unified approval system
4. Complete navigation system

### Week 3
1. Testing on real devices (iPhone, Android)
2. Performance optimization
3. Progressive Web App setup
4. User testing with actual employees

### Success Criteria
- ✅ All dashboards load in < 3s on 3G
- ✅ Touch targets ≥ 44×44px everywhere
- ✅ Works offline for critical features
- ✅ Zero documentation needed
- ✅ 90%+ task completion rate

---

**Document Version:** 2.0
**Last Updated:** 2025-10-08
**Status:** Ready for Implementation with True Mobile-First Design