# Gaps and Implementation Plan
**Preem HR - Production Readiness Roadmap**

---

## Executive Summary

**Current Status:** 65% Production-Ready for Tenant Payroll Operations

**Priority:** Enable tenants to fully run payroll with employee self-service and manager oversight.

**Timeline to Production:**
- **Phase 1 (P0 - Critical):** 8-10 days → 80% ready
- **Phase 2 (P1 - Important):** 12-15 days → 90% ready
- **Phase 3 (P2 - Enhancement):** 10-12 days → 95% ready

**Super Admin Features:** Deprioritized (multi-country expansion can be done via database seeding for now)

---

## Priority Framework

### P0 - Critical (Blocks Payroll Operations)
Features required for tenants to run monthly payroll and provide employee self-service.

### P1 - Important (Degrades UX)
Features that significantly improve user experience but have workarounds.

### P2 - Enhancement (Nice-to-Have)
Features that add value but are not essential for core payroll operations.

### P3 - Future (Super Admin)
Multi-tenant SaaS features for platform expansion (deprioritized).

---

# Module-by-Module Gap Analysis

*Following Architecture Definition from `docs/02-ARCHITECTURE-OVERVIEW.md`*

---

## Module 1: `auth/` - Authentication & Authorization

### Current Status: ❌ 0% Complete

**Critical Issue:** All endpoints use `publicProcedure` - any authenticated user can access any data across tenants.

### Gaps

#### P0-1: Role-Based Access Control (RBAC) 🚨 SECURITY CRITICAL
**Priority:** P0
**Effort:** 3-5 days
**Blocking:** All other features (security prerequisite)

**Current State:**
```typescript
// server/api/context.ts - Mock context with no enforcement
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  return {
    user: {
      id: 'mock-user-id',
      tenantId: 'mock-tenant-id',
      role: 'tenant_admin', // NOT ENFORCED
    },
  };
};

// All routers use publicProcedure
export const employeesRouter = router({
  list: publicProcedure.query(...), // NO AUTHORIZATION CHECK
});
```

**Required Implementation:**

**Step 1: Create Protected Procedures (1 day)**
```typescript
// server/api/trpc.ts
import { TRPCError } from '@trpc/server';

/**
 * Employee-level access
 * Can only access own data
 */
export const employeeProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['employee', 'manager', 'hr_admin', 'tenant_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});

/**
 * Manager-level access
 * Can access team data
 */
export const managerProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['manager', 'hr_admin', 'tenant_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

/**
 * HR Admin access
 * Can access all tenant data
 */
export const hrAdminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['hr_admin', 'tenant_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

/**
 * Admin-level access
 * Can configure policies
 */
export const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['admin', 'tenant_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

**Step 2: Extract Real User from Supabase JWT (1 day)**
```typescript
// server/api/context.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null };
  }

  // Fetch user metadata from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, employee_id')
    .eq('id', user.id)
    .single();

  return {
    user: {
      id: user.id,
      email: user.email!,
      tenantId: profile?.tenant_id,
      role: profile?.role || 'employee',
      employeeId: profile?.employee_id,
    },
  };
};
```

**Step 3: Apply to All Routers (2-3 days)**

Apply role-based procedures to all 16 routers:
- `employees.ts` - Use `hrAdminProcedure` for list/create, `employeeProcedure` for getMyProfile
- `payroll.ts` - Use `hrAdminProcedure` for runPayroll, `employeeProcedure` for listMyPayslips
- `time-tracking.ts` - Use `employeeProcedure` for clockIn/clockOut (verify employee ID), `managerProcedure` for approvals
- `time-off.ts` - Use `employeeProcedure` for requests, `managerProcedure` for approvals
- `salaries.ts` - Use `hrAdminProcedure` for create/update, `employeeProcedure` for getMySalary
- All others follow same pattern based on access requirements

**Files to Modify:**
1. `server/api/trpc.ts` - Add protected procedures
2. `server/api/context.ts` - Extract real user from Supabase
3. `server/routers/*.ts` - Replace `publicProcedure` with role-specific procedures (16 router files)

**Module Communication:** This is a cross-cutting concern that affects all modules but doesn't violate module boundaries (it's authorization middleware).

**Testing:**
- [ ] Test employee cannot access HR endpoints
- [ ] Test manager can only approve team entries
- [ ] Test HR admin can access all tenant data
- [ ] Test cross-tenant access is blocked
- [ ] Test JWT extraction works with Supabase

---

## Module 2: `employees/` - Employee Management

### Current Status: ⚠️ 60% Complete
- ✅ Backend services (95% - CRUD, hire, terminate, search)
- ✅ HR admin UI (85% - hire wizard, employee list, profile edit)
- ❌ Employee self-service UI (0%)
- ❌ Manager team view (0%)

### Gaps

#### P0-2: Employee Payslip Access
**Priority:** P0
**Effort:** 1 day
**Impact:** Employees cannot view payslips (defeats self-service purpose)

**Current State:**
- Backend: ✅ `payrollRouter.generatePayslip` exists
- UI: ❌ No `/app/employee/payslips/` route

**Implementation Plan:**

```typescript
// app/employee/payslips/page.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeePayslipsPage() {
  const { data: payslips, isLoading } = trpc.payroll.listMyPayslips.useQuery();
  const downloadPayslip = trpc.payroll.downloadMyPayslip.useMutation();

  const handleDownload = async (payslipId: string) => {
    const blob = await downloadPayslip.mutateAsync({ payslipId });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulletin-paie-${payslipId}.pdf`;
    link.click();
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mes bulletins de paie</h1>
        <p className="text-muted-foreground mt-2">
          Consultez et téléchargez vos bulletins de paie
        </p>
      </div>

      {isLoading ? (
        <div>Chargement...</div>
      ) : payslips?.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold">Aucun bulletin de paie</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vos bulletins de paie apparaîtront ici après le premier versement
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payslips?.map((payslip) => (
            <Card key={payslip.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {format(new Date(payslip.period), 'MMMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Salaire net: {payslip.netSalary.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => handleDownload(payslip.id)} className="min-h-[44px]">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Backend Endpoints (Add to `payroll.ts` router):**
```typescript
// server/routers/payroll.ts
listMyPayslips: employeeProcedure.query(async ({ ctx }) => {
  const { db } = await import('@/db');
  const { payslips } = await import('@/drizzle/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  return await db.query.payslips.findMany({
    where: and(
      eq(payslips.employeeId, ctx.user.employeeId),
      eq(payslips.tenantId, ctx.user.tenantId)
    ),
    orderBy: [desc(payslips.period)],
    limit: 24, // Last 2 years
  });
}),

downloadMyPayslip: employeeProcedure
  .input(z.object({ payslipId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    // Verify ownership before generating PDF
    const payslip = await db.query.payslips.findFirst({
      where: and(
        eq(payslips.id, input.payslipId),
        eq(payslips.employeeId, ctx.user.employeeId),
        eq(payslips.tenantId, ctx.user.tenantId)
      ),
    });

    if (!payslip) throw new TRPCError({ code: 'NOT_FOUND' });

    return await generatePayslipPDF({ payslipId: input.payslipId, tenantId: ctx.user.tenantId });
  }),
```

**Module Communication:** Reads from `payroll/` module via tRPC endpoint (no direct imports).

**Acceptance Criteria:**
- [ ] Employee can see list of all their payslips (last 24 months)
- [ ] Employee can download any payslip as PDF
- [ ] Employee cannot access other employees' payslips
- [ ] Mobile-responsive design (touch targets ≥ 44px)

---

#### P0-3: Employee Profile View
**Priority:** P0
**Effort:** 1 day
**Impact:** Employees cannot verify their own information

**Implementation:** Create `/app/employee/profile/page.tsx` with read-only view of:
- Personal information (name, email, phone, address)
- Employment information (position, hire date, status)
- Bank account (masked, read-only)

**Backend Endpoint:**
```typescript
// server/routers/employees.ts
getMyProfile: employeeProcedure.query(async ({ ctx }) => {
  return await getEmployeeById(ctx.user.employeeId, ctx.user.tenantId);
}),
```

**Module Communication:** Self-contained within `employees/` module.

---

#### P0-4: Manager Team Roster
**Priority:** P0
**Effort:** 1 day
**Impact:** Managers don't know who they manage

**Implementation:** Create `/app/manager/team/page.tsx` showing all direct reports with:
- Team member cards (photo, name, position, contact info)
- Employee status badges
- Empty state for managers with no reports

**Backend Endpoint:**
```typescript
// server/routers/employees.ts
getMyTeam: managerProcedure.query(async ({ ctx }) => {
  const { db } = await import('@/db');
  const { employees } = await import('@/drizzle/schema');
  const { eq, and } = await import('drizzle-orm');

  return await db.query.employees.findMany({
    where: and(
      eq(employees.tenantId, ctx.user.tenantId),
      eq(employees.reportingManagerId, ctx.user.employeeId),
      eq(employees.status, 'active')
    ),
    with: {
      position: true,
      currentAssignment: true,
    },
  });
}),
```

**Module Communication:** Self-contained within `employees/` module.

---

#### P1-1: Employee Profile Edit
**Priority:** P1
**Effort:** 1 day
**Impact:** Employees must contact HR for address/phone changes

**Implementation:** Add edit mode to profile page with restricted fields:
- ✅ Editable: address, phone number, emergency contact
- ❌ Read-only: name, email, bank account, salary, position (HR-only)

**Module Communication:** Self-contained within `employees/` module.

---

#### P1-8: Employee Import/Export
**Priority:** P1
**Effort:** 2 days
**Impact:** Manual data entry for bulk hiring

**Implementation:**
- Export: Add button to `/app/employees/page.tsx` to export to Excel
- Import: Create `/app/employees/import/page.tsx` with template download, file upload, preview, and bulk insert

**Backend Endpoint:**
```typescript
// server/routers/employees.ts
bulkImport: hrAdminProcedure
  .input(z.object({ employees: z.array(employeeImportSchema) }))
  .mutation(async ({ input, ctx }) => {
    // Validate and create employees in bulk
    // Return { results: [], errors: [] }
  }),
```

**Module Communication:** Self-contained within `employees/` module.

---

## Module 3: `positions/` - Position Management

### Current Status: ✅ 90% Complete
- ✅ Backend services (100% - CRUD, position hierarchy)
- ✅ HR admin UI (80% - position list, create/edit)
- ❌ Org chart visualization (0%)

### Gaps

#### P2-1: Organization Chart Visualization
**Priority:** P2
**Effort:** 2 days
**Impact:** Cannot visualize reporting structure

**Implementation:** Create `/app/positions/org-chart/page.tsx` using a library like `react-organizational-chart` to show:
- Hierarchical org structure
- Position titles with incumbent names
- Vacant positions highlighted
- Interactive drill-down by department

**Module Communication:** Reads from `employees/` module for incumbent data (via tRPC, no direct imports).

---

## Module 4: `time-tracking/` - Time Tracking & Overtime

### Current Status: ✅ 75% Complete
- ✅ Backend services (100% - clock in/out, overtime calculation, geofencing)
- ✅ Employee UI (100% - clock in/out)
- ✅ Manager UI (90% - approval page, overtime reports)
- ❌ Admin configuration UI (0% - public holidays, geofencing)

### Gaps

#### P1-5: Public Holidays Management UI
**Priority:** P1
**Effort:** 1 day
**Impact:** Must use database to manage holidays

**Current State:**
- Backend: ✅ `public_holidays` table seeded with CI 2025 (10 holidays)
- Service: ✅ `holiday.service.ts` (189 lines)
- UI: ❌ No CRUD interface

**Implementation:** Create `/app/admin/public-holidays/page.tsx` with:
- Year selector
- List of holidays (name, date, recurring flag)
- Create/delete dialogs
- Empty state for years without holidays

**Backend Endpoints:**
```typescript
// server/routers/time-tracking.ts (or create dedicated holidays.ts)
list: adminProcedure
  .input(z.object({ year: z.number().int() }))
  .query(async ({ input, ctx }) => {
    return await holidayService.getPublicHolidays(ctx.user.tenantId, input.year);
  }),

create: adminProcedure
  .input(z.object({ name: z.string(), date: z.date(), recurring: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    return await holidayService.createPublicHoliday({ ...input, tenantId: ctx.user.tenantId });
  }),

delete: adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return await holidayService.deletePublicHoliday(input.id, ctx.user.tenantId);
  }),
```

**Module Communication:** Self-contained within `time-tracking/` module.

---

#### P1-6: Geofencing Configuration UI
**Priority:** P1
**Effort:** 2 days
**Impact:** Cannot restrict clock-ins to office location

**Implementation:** Create `/app/admin/geofencing/page.tsx` with:
- Enable/disable toggle
- Office location (latitude/longitude inputs)
- Radius slider (50m - 5000m)
- Map preview (integrate Google Maps or Mapbox)
- Save button

**Backend Endpoint:**
```typescript
// server/routers/time-tracking.ts
updateGeofenceConfig: adminProcedure
  .input(z.object({
    enabled: z.boolean(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().min(50).max(5000),
  }))
  .mutation(async ({ input, ctx }) => {
    return await geofenceService.updateGeofenceConfig({ ...input, tenantId: ctx.user.tenantId });
  }),
```

**Module Communication:** Self-contained within `time-tracking/` module.

---

#### P1-3: Manager Overtime Reports Enhancement
**Priority:** P1
**Effort:** 2 days
**Impact:** Limited reporting capabilities

**Current State:**
- UI: ✅ `/app/manager/reports/overtime/page.tsx` created (422 lines)
- Backend: ✅ `getMonthlyOvertimeReport` endpoint exists
- Status: ⚠️ Page renders (shows empty state for October 2025)

**Enhancements Needed:**
1. Add Excel export (multi-sheet: summary, employee details, raw data)
2. Add team filtering (manager sees only direct reports, not all employees)
3. Verify data flow with real overtime entries

**Backend Enhancement:**
```typescript
// server/routers/time-tracking.ts
getTeamOvertimeReport: managerProcedure
  .input(z.object({ periodStart: z.date(), periodEnd: z.date() }))
  .query(async ({ input, ctx }) => {
    const team = await getTeamMembers(ctx.user.employeeId, ctx.user.tenantId);
    // Fetch overtime for team members only (not all employees)
  }),
```

**Module Communication:** Reads from `employees/` module for team roster (via tRPC).

---

## Module 5: `time-off/` - Time-Off Management

### Current Status: ✅ 85% Complete
- ✅ Backend services (100% - request, approve, balance tracking, accrual)
- ✅ Employee UI (90% - request page, balance view)
- ✅ Manager UI (80% - approval via admin route)
- ✅ Admin UI (90% - policy management, accrual rules)
- ✅ Supabase Edge Function (100% - monthly accrual cron)

### Gaps

#### P1-9: Dedicated Manager Time-Off Approval Page
**Priority:** P1
**Effort:** 1 day
**Impact:** Manager must use admin route for approvals

**Current State:**
- Managers currently use `/app/admin/time-off/page.tsx` (generic admin page)
- Need manager-specific view at `/app/manager/time-off/page.tsx`

**Implementation:** Create manager-specific approval page showing:
- Only team member requests (not all employees)
- Balance context for each request
- Approve/reject with reason
- Request history

**Backend Endpoint:**
```typescript
// server/routers/time-off.ts
getTeamRequests: managerProcedure
  .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }))
  .query(async ({ input, ctx }) => {
    const team = await getTeamMembers(ctx.user.employeeId, ctx.user.tenantId);
    const teamIds = team.map(e => e.id);

    return await db.query.timeOffRequests.findMany({
      where: and(
        eq(timeOffRequests.tenantId, ctx.user.tenantId),
        inArray(timeOffRequests.employeeId, teamIds),
        input.status ? eq(timeOffRequests.status, input.status) : undefined
      ),
      with: { employee: true, policy: true },
    });
  }),
```

**Module Communication:** Reads from `employees/` module for team roster (via tRPC).

---

## Module 6: `payroll/` - Payroll Calculation Engine

### Current Status: ✅ 95% Complete
- ✅ Backend services (100% - multi-country calculation, document generation)
- ✅ HR admin UI (90% - run payroll wizard, payslip generation)
- ❌ Payroll dashboard (0%)
- ❌ Employee payslip access (covered in Module 2)

### Gaps

#### P1-7: Payroll Reports Dashboard ✅ COMPLETED
**Priority:** P1
**Effort:** 3 days
**Impact:** Cannot analyze payroll trends
**Status:** ✅ **COMPLETED** (2025-10-07)

**Implementation:** ✅ Created `/app/payroll/dashboard/page.tsx` with:
- Summary cards (employee count, total gross/net, employer contributions, avg cost per employee, total cost)
- Smart defaults (current month pre-selected)
- French currency formatting (FCFA)
- Mobile-responsive grid (touch targets >= 44px)
- Detailed summary breakdown

**Backend Endpoints:**
```typescript
// server/routers/payroll.ts
getDashboardSummary: hrManagerProcedure
  .input(z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Aggregates payslips within date range
    // Returns { employeeCount, totalGross, totalNet, totalEmployerContributions, avgCostPerEmployee }
  }),
```

**Features Implemented:**
- 6 metric cards with large, readable numbers
- Summary table with cost breakdown
- Default to current month (smart defaults)
- Mobile-first responsive design
- French language for all UI text

**Module Communication:** Reads from `employees/` module for employee count (via tRPC).

---

#### P2-3: Payroll Approval Workflow
**Priority:** P2
**Effort:** 3 days
**Impact:** No review step before finalizing payroll

**Implementation:** Create `/app/payroll/approvals/page.tsx` with:
- List of payroll runs pending approval
- Approval chain (preparer → reviewer → approver)
- Diff view showing changes from previous month
- Approve/reject with comments

**Module Communication:** Self-contained within `payroll/` module (uses `workflows/` module for approval chain via events).

---

## Module 7: `payroll-config/` - Multi-Country Payroll Configuration

### Current Status: ✅ 95% Complete
- ✅ Backend architecture (100% - database-driven calculations)
- ✅ Côte d'Ivoire fully seeded (100% - ITS, CNPS, CMU, FDFP, other taxes)
- ✅ Rule loader service (100% - loads country-specific rules from DB)
- ❌ Super admin UI for adding countries (0% - deprioritized)

### Gaps

#### P3-1: Super Admin Country Configuration UI (DEPRIORITIZED)
**Priority:** P3 (Future)
**Effort:** 5 days (when needed)
**Impact:** Must use database seeding for multi-country expansion

**Why Deprioritized:**
- Current tenants are Côte d'Ivoire only
- New countries can be added via database seeding scripts (`npm run seed:senegal`)
- Backend architecture is complete (calculations work for any country in DB)
- Super admin UI is a SaaS platform concern, not tenant payroll concern

**Implementation When Needed:**
- Create `/app/super-admin/countries/` routes
- CRUD for tax systems, social security schemes, contribution types
- CRUD for other taxes, salary components
- Country comparison dashboards

**Module Communication:** Self-contained within `payroll-config/` module (super admin has cross-tenant access).

---

## Module 8: `workflows/` - Workflow Automation Engine

### Current Status: ⚠️ 50% Complete
- ✅ Event bus architecture (80% - publish/subscribe pattern defined)
- ❌ Workflow engine implementation (0%)
- ❌ Approval chain configuration (0%)

### Gaps

#### P2-6: Salary Review Workflow
**Priority:** P2
**Effort:** 3 days
**Impact:** No structured salary review process

**Current State:**
- Backend: ✅ `salary_reviews` table exists
- Service: ⚠️ Basic CRUD only (no workflow state machine)
- UI: ❌ No workflow UI

**Implementation:** Create `/app/salaries/reviews/page.tsx` with:
- Review cycles (annual, mid-year)
- Workflow states (draft → submitted → manager_approved → hr_approved → rejected)
- Bulk review approval
- Budget tracking

**Backend Service:**
```typescript
// features/workflows/services/salary-review-workflow.service.ts
export async function submitReview(reviewId: string) {
  // State transition: draft → submitted
  // Emit event: salary_review.submitted
  await eventBus.publish('salary_review.submitted', { reviewId });
}

export async function approveReview(reviewId: string, approverId: string, level: 'manager' | 'hr') {
  // State transition: submitted → manager_approved → hr_approved
  // Emit event: salary_review.approved
  await eventBus.publish('salary_review.approved', { reviewId, level });
}
```

**Module Communication:**
- Reads from `employees/` and `salaries/` modules (via tRPC)
- Publishes events consumed by other modules (event-driven, no direct imports)

---

#### P2-4: Generic Approval Workflow Engine
**Priority:** P2
**Effort:** 5 days
**Impact:** Every approval process is custom-coded

**Implementation:** Create reusable approval workflow engine:
- Workflow definition (steps, roles, conditions)
- State machine (pending → approved → rejected)
- Email notifications
- Audit trail

**Use Cases:**
- Time-off approvals
- Salary review approvals
- Payroll approvals
- Termination approvals

**Module Communication:** Event-driven (publishes events, no direct imports from other modules).

---

## Module 9: `super-admin/` - Super Admin Features

### Current Status: ❌ 0% Complete (DEPRIORITIZED)
- ❌ Tenant management UI (0%)
- ❌ Billing & subscription management (0%)
- ❌ Multi-country configuration (covered in Module 7)
- ❌ System-wide analytics (0%)

### Gaps

**All gaps deprioritized as per user request.** Super admin features are for multi-tenant SaaS platform expansion, not core tenant payroll operations.

**Workarounds:**
- Tenant management: Database seeding scripts
- Multi-country setup: Database seeding scripts (`npm run seed:senegal`)
- System analytics: Not needed for single-tenant deployments

---

## Module 10: `shared/` - Shared Utilities

### Current Status: ✅ 85% Complete
- ✅ Database client (100%)
- ✅ tRPC setup (100%)
- ✅ UI components (shadcn/ui) (95%)
- ✅ Date utilities (100%)
- ✅ Currency formatting (100%)
- ❌ Event bus implementation (20% - structure defined, not implemented)

### Gaps

#### P2-5: Event Bus Implementation
**Priority:** P2
**Effort:** 2 days
**Impact:** No cross-module communication via events (relies on direct tRPC calls)

**Current State:**
- Architecture: ✅ Defined in `docs/02-ARCHITECTURE-OVERVIEW.md`
- Implementation: ❌ Not implemented

**Implementation:**
```typescript
// features/shared/services/event-bus.service.ts
export const eventBus = {
  async publish(eventType: string, payload: any) {
    // Insert into events table
    // Trigger subscribers (in-process or background worker)
  },

  subscribe(eventType: string, handler: (payload: any) => Promise<void>) {
    // Register handler for event type
  },
};
```

**Module Communication:** Cross-cutting concern that enables all module-to-module communication.

---

# Implementation Priorities

## Phase 1: P0 - Critical Security & Self-Service (8-10 days)

**Goal:** Enable tenants to run payroll with employee self-service

| Task | Days | Module | Files | Dependencies |
|------|------|--------|-------|--------------|
| P0-1: RBAC Implementation | 3-5 | `auth/` | `server/api/trpc.ts`, `server/api/context.ts`, all routers | None |
| P0-2: Employee Payslip Access | 1 | `employees/` | `app/employee/payslips/page.tsx`, `server/routers/payroll.ts` | P0-1 |
| P0-3: Employee Profile View | 1 | `employees/` | `app/employee/profile/page.tsx`, `server/routers/employees.ts` | P0-1 |
| P0-4: Manager Team Roster | 1 | `employees/` | `app/manager/team/page.tsx`, `server/routers/employees.ts` | P0-1 |

**Phase 1 Deliverables:**
- ✅ Secure role-based access control
- ✅ Employees can view payslips
- ✅ Employees can view profile
- ✅ Managers can see team roster

**Production Readiness After Phase 1:** 80%

---

## Phase 2: P1 - UX Improvements (12-15 days)

**Goal:** Enhance user experience with full feature set

| Task | Days | Module | Files | Dependencies |
|------|------|--------|-------|--------------|
| P1-1: Employee Profile Edit | 1 | `employees/` | `app/employee/profile/page.tsx` | P0-3 |
| P1-3: Manager Overtime Reports | 2 | `time-tracking/` | `app/manager/reports/overtime/page.tsx` | P0-4 |
| P1-5: Public Holidays UI | 1 | `time-tracking/` | `app/admin/public-holidays/page.tsx` | P0-1 |
| P1-6: Geofencing UI | 2 | `time-tracking/` | `app/admin/geofencing/page.tsx` | P0-1 |
| P1-7: Payroll Dashboard | 3 | `payroll/` | `app/payroll/dashboard/page.tsx` | None |
| P1-8: Employee Import/Export | 2 | `employees/` | `app/employees/import/page.tsx` | P0-1 |
| P1-9: Manager Time-Off Approval | 1 | `time-off/` | `app/manager/time-off/page.tsx` | P0-4 |

**Phase 2 Deliverables:**
- ✅ Full employee self-service
- ✅ Full manager workflows
- ✅ Complete admin configuration
- ✅ Payroll analytics dashboard
- ✅ Bulk employee operations

**Production Readiness After Phase 2:** 90%

---

## Phase 3: P2 - Enhancements (10-12 days)

**Goal:** Add advanced features for power users

| Task | Days | Module | Files | Dependencies |
|------|------|--------|-------|--------------|
| P2-1: Org Chart Visualization | 2 | `positions/` | `app/positions/org-chart/page.tsx` | None |
| P2-3: Payroll Approval Workflow | 3 | `payroll/` | `app/payroll/approvals/page.tsx` | P2-5 |
| P2-4: Generic Approval Engine | 5 | `workflows/` | `features/workflows/services/workflow-engine.service.ts` | P2-5 |
| P2-5: Event Bus Implementation | 2 | `shared/` | `features/shared/services/event-bus.service.ts` | None |
| P2-6: Salary Review Workflow | 3 | `workflows/` | `app/salaries/reviews/page.tsx` | P2-4 |

**Phase 3 Deliverables:**
- ✅ Visual org chart
- ✅ Payroll approval chain
- ✅ Event-driven architecture
- ✅ Generic workflow engine
- ✅ Structured salary review cycles

**Production Readiness After Phase 3:** 95%

---

# Testing Plan

## Module Boundaries Testing

**Critical:** Ensure no direct cross-module imports (only via tRPC or events)

```bash
# Check for violations
grep -r "from '@/features/payroll" features/employees/
grep -r "from '@/features/employees" features/payroll/
# Should return empty (no direct imports)
```

**Expected Communication Patterns:**
- ✅ `employees/` → `payroll/` via tRPC (`trpc.payroll.listMyPayslips.useQuery()`)
- ✅ `payroll/` → `employees/` via events (`eventBus.publish('payroll.completed', ...)`)
- ❌ `employees/` → `payroll/` via direct import (`import { runPayroll } from '@/features/payroll'`)

---

## Phase 1 Testing

**Security Testing:**
- [ ] Employee cannot access HR endpoints
- [ ] Employee cannot view other employees' payslips
- [ ] Manager can only approve team entries
- [ ] Manager cannot access HR admin endpoints
- [ ] Cross-tenant access is blocked
- [ ] JWT extraction works correctly

**Functional Testing:**
- [ ] Employee can view all payslips (last 24 months)
- [ ] Employee can download payslip PDF
- [ ] Employee can view full profile
- [ ] Manager can see team roster

---

## Phase 2 Testing

**Employee Self-Service:**
- [ ] Employee can edit address, phone
- [ ] Employee cannot edit salary, position

**Manager Workflows:**
- [ ] Manager overtime report shows correct data
- [ ] Manager can export overtime to Excel
- [ ] Manager sees only team time-off requests

**Admin Configuration:**
- [ ] Admin can create/edit/delete public holidays
- [ ] Admin can enable/disable geofencing
- [ ] Geofencing validates clock-ins correctly

**Payroll Analytics:**
- [ ] Dashboard shows correct trends (6/12/24 months)
- [ ] Charts render correctly
- [ ] Department breakdown is accurate

**Bulk Operations:**
- [ ] Employee export includes all fields
- [ ] Employee import validates data
- [ ] Import creates employees with correct data

---

## Phase 3 Testing

**Workflows:**
- [ ] Event bus delivers events to subscribers
- [ ] Approval workflow tracks state transitions
- [ ] Salary review workflow enforces approval chain
- [ ] Payroll approval workflow prevents unauthorized finalization

**Module Boundaries:**
- [ ] No direct cross-module imports detected
- [ ] All cross-module communication via tRPC or events
- [ ] Modules can be deployed independently (theoretical)

---

# Success Metrics

## Phase 1 Success Criteria

**Security:**
- ✅ All endpoints have role-based authorization
- ✅ No security vulnerabilities in penetration test
- ✅ Audit trail captures all payroll operations

**Self-Service Adoption:**
- ✅ 80% of employees view payslips within first month
- ✅ Profile view page has <10% support requests
- ✅ Managers use team roster for approvals

---

## Phase 2 Success Criteria

**User Experience:**
- ✅ Task completion rate >90% (without help)
- ✅ Time to complete payroll run <15 minutes
- ✅ Error rate <5% on all workflows

**Operational Efficiency:**
- ✅ HR admin uses dashboard for monthly reviews
- ✅ Bulk import reduces onboarding time by 80%
- ✅ Manager reports reduce overtime disputes by 50%

---

## Phase 3 Success Criteria

**Advanced Usage:**
- ✅ Payroll approval workflow reduces errors by 30%
- ✅ Salary review workflow standardizes raise process
- ✅ Event-driven architecture enables new feature development

---

# Conclusion

**Current State:** 65% production-ready for tenant payroll operations

**After Phase 1 (P0):** 80% ready - Secure and usable for core payroll

**After Phase 2 (P1):** 90% ready - Full feature set with excellent UX

**After Phase 3 (P2):** 95% ready - Enterprise-grade with advanced workflows

**Super Admin (P3):** Deprioritized - Database seeding sufficient for now

**Recommendation:** Execute Phase 1 (8-10 days) immediately for production launch with security and employee self-service. Phase 2 can be rolled out incrementally over 3 weeks.

---

# Implementation Updates

## 2025-10-07: P1 Features Completed

### P1-7: Payroll Reports Dashboard ✅
- **File Created:** `/app/payroll/dashboard/page.tsx`
- **Backend:** `payroll.getDashboardSummary` endpoint with `hrManagerProcedure`
- **Features:**
  - Monthly payroll summary cards (employee count, total gross/net, employer contributions, avg cost)
  - Smart defaults (current month pre-selected)
  - French currency formatting (FCFA)
  - Mobile-first design (touch targets >= 44px)
  - Reads from `payslips` table with status filtering ('finalized', 'paid')

### RBAC Applied to Remaining Routers ✅
**Updated Files:**
- `/server/routers/employees.ts` - Applied `hrManagerProcedure` to:
  - `create` (hire employee)
  - `update` (edit employee)
  - `terminate` (terminate employee)
  - `suspend` (suspend employee)
  - `reactivate` (reactivate employee)
  - Fixed context references: `ctx.tenantId` → `ctx.user.tenantId`

- `/server/routers/payroll.ts` - Applied `hrManagerProcedure` to:
  - `createRun` (create payroll run)
  - `calculateRun` (calculate payroll)
  - `approveRun` (approve payroll)
  - `deleteRun` (delete draft run)

- `/server/routers/sectors.ts` - Applied `hrManagerProcedure` to:
  - `updateTenantSector` (change business sector)

- `/server/routers/positions.ts` - Applied `hrManagerProcedure` to:
  - `create` (create position)
  - Fixed context references: `ctx.tenantId` → `ctx.user.tenantId`

**Status:** P0 (all features) and P1-5, P1-6, P1-7 are now complete. Remaining P1 features (P1-1, P1-3, P1-8, P1-9) are pending.
