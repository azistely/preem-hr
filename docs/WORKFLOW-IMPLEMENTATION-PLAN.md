# Workflow Automation Epic - Implementation Plan

**Epic:** 09-EPIC-WORKFLOW-AUTOMATION.md
**Plan Date:** 2025-10-10
**Target:** Complete Phases 1-2 for MVP, Foundation for Phases 3-4
**Timeline:** 4 sprints (8 weeks)

---

## Overview

This plan prioritizes **completing the MVP** (Phases 1-2) while laying groundwork for advanced automation (Phases 3-4).

### Goals
1. ✅ **Phase 1 (Alerts):** Fully functional proactive alert system
2. ✅ **Phase 2 (Batch Ops):** Production-ready bulk operations
3. 🔄 **Phase 3 (Events):** Event-driven payroll automation foundation
4. 🔄 **Phase 4 (Builder):** Workflow builder infrastructure (defer UI to v2)

---

## Sprint 1: Complete Phase 1-2 MVP (2 weeks)

**Goal:** Ship functional alerts + batch operations to production

### Week 1: UI Pages + Deployment

#### Task 1.1: Create Alerts Page
**Priority:** 🔴 P0 (Critical)
**Effort:** 2 days
**Files to create:**
- `/app/(protected)/alerts/page.tsx`
- `/app/(protected)/alerts/loading.tsx`
- `/app/(protected)/alerts/error.tsx`

**Requirements:**
1. Full-page alerts list with filtering
   - Filter by severity (urgent, warning, info)
   - Filter by status (active, dismissed, completed)
   - Search by employee name or message
   - Sort by due date, created date

2. Pagination with server-side cursor
   - 20 alerts per page
   - "Load more" button (mobile-friendly)
   - Infinite scroll (desktop)

3. Bulk actions
   - Select all (current page + all pages)
   - Bulk dismiss
   - Bulk complete (if all same type)

4. HCI Design Requirements:
   - ✅ Touch targets ≥44px
   - ✅ Mobile-first layout (single column on mobile, grid on desktop)
   - ✅ Empty state: "Aucune alerte active" with illustration
   - ✅ Loading state: Skeleton loaders for alert cards
   - ✅ Error state: Retry button + helpful message
   - ✅ French language for all text

**Implementation Pattern:**
```tsx
// Use existing AlertCard component + data table pattern
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { status?: string; severity?: string; page?: string };
}) {
  const alerts = await api.alerts.list.query({
    status: searchParams.status,
    severity: searchParams.severity,
    offset: Number(searchParams.page || 0) * 20,
    limit: 20,
  });

  return (
    <div className="container py-6">
      <PageHeader
        title="Alertes"
        description="Gérez vos notifications et rappels"
        badge={alerts.total > 0 ? `${alerts.total}` : undefined}
      />

      <AlertFilters /> {/* Filters component */}
      <AlertList alerts={alerts} /> {/* List with bulk actions */}
      <Pagination total={alerts.total} perPage={20} />
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] All active alerts visible in list
- [ ] Filters work correctly (severity, status)
- [ ] Bulk dismiss works for multiple alerts
- [ ] Mobile layout works on 375px width
- [ ] Touch targets meet 44×44px minimum
- [ ] Empty state shows when no alerts
- [ ] Loading states prevent flash of empty content
- [ ] URL updates on filter change (shareable links)

---

#### Task 1.2: Create Batch Operations Page
**Priority:** 🔴 P0 (Critical)
**Effort:** 2 days
**Files to create:**
- `/app/(protected)/batch-operations/page.tsx`
- `/app/(protected)/batch-operations/[id]/page.tsx` (detail view)

**Requirements:**
1. Operations list view
   - Filter by status (pending, running, completed, failed)
   - Filter by type (salary_update, document_generation, etc.)
   - Sort by date (newest first)
   - Show progress bar for running operations

2. Operation detail view
   - Progress chart (visual progress indicator)
   - Success/error breakdown
   - List of affected employees
   - Retry failed items button
   - Export results to CSV

3. Real-time updates
   - Polling for running operations (every 2 seconds)
   - Auto-redirect when operation completes
   - Toast notification on completion

4. HCI Design Requirements:
   - ✅ Progress bar with percentage + count (15/135 completed)
   - ✅ Color-coded status (green=success, red=error, blue=running)
   - ✅ Estimated completion time (if available)
   - ✅ Cancel button (only for pending/running)
   - ✅ Mobile-friendly progress cards

**Implementation Pattern:**
```tsx
// Use polling for real-time updates (upgrade to SSE later)
export default function BatchOperationDetail({ params }: { params: { id: string } }) {
  const { data: operation, refetch } = api.batchOperations.getById.useQuery({
    id: params.id,
  });

  // Poll every 2 seconds if running
  useEffect(() => {
    if (operation?.status === 'running') {
      const interval = setInterval(() => refetch(), 2000);
      return () => clearInterval(interval);
    }
  }, [operation?.status, refetch]);

  return (
    <div className="container py-6">
      <OperationHeader operation={operation} />
      <ProgressCard operation={operation} /> {/* Visual progress */}
      <EmployeeResultsTable operation={operation} />
      <OperationActions operation={operation} /> {/* Retry/Cancel */}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] All operations visible in list
- [ ] Running operations update in real-time
- [ ] Detail view shows affected employees
- [ ] Retry button works for failed items
- [ ] Cancel button works for pending/running
- [ ] Mobile layout works on 375px width
- [ ] Toast notification on completion
- [ ] Export to CSV button works

---

#### Task 1.3: Integrate Dashboard Widgets
**Priority:** 🔴 P0 (Critical)
**Effort:** 1 day
**Files to modify:**
- `/app/(protected)/dashboard/page.tsx`
- `/components/layout/navigation.tsx`

**Requirements:**
1. Add AlertsDashboardWidget to main dashboard
   - Place in top row (high visibility)
   - Show top 5 urgent alerts
   - "Voir tout" link to `/alerts`

2. Add alert badge to navigation
   - Show urgent count (red badge)
   - Only show if count > 0
   - Link to `/alerts?severity=urgent`

3. Add batch operations widget (optional)
   - Show recent operations
   - Link to `/batch-operations`

**Implementation Pattern:**
```tsx
// Dashboard page
export default async function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* High priority - top left */}
      <div className="md:col-span-2">
        <AlertsDashboardWidget />
      </div>

      {/* Other widgets */}
      <PayrollSummaryWidget />
      <EmployeeStatsWidget />
      {/* ... */}
    </div>
  );
}

// Navigation
<NavItem href="/alerts" icon={Bell} badge={urgentAlertCount}>
  Alertes
</NavItem>
```

**Acceptance Criteria:**
- [ ] Dashboard shows alerts widget
- [ ] Badge appears on navigation when alerts exist
- [ ] Badge count updates in real-time
- [ ] Clicking badge navigates to alerts page
- [ ] Widget links to full alerts page

---

#### Task 1.4: Deploy Cron Jobs
**Priority:** 🔴 P0 (Critical)
**Effort:** 1 day

**Requirements:**
1. Configure Inngest production deployment
   - Create Inngest account (if not exists)
   - Set environment variables
   - Deploy Inngest functions

2. Schedule daily alerts (6 AM WAT)
   - Verify cron schedule: `0 5 * * *`
   - Test manual trigger
   - Monitor first execution

3. Schedule weekly cleanup (Sunday 2 AM WAT)
   - Add cleanup function to Inngest
   - Schedule: `0 1 * * 0`
   - Test with mock data

4. Add health check monitoring
   - Ping endpoint for cron success
   - Alert on failure (email admin)
   - Log execution history

**Deployment Steps:**
```bash
# 1. Install Inngest CLI
npm install -g inngest-cli

# 2. Login to Inngest
inngest login

# 3. Deploy functions
inngest deploy

# 4. Verify deployment
inngest status
```

**Environment Variables:**
```env
INNGEST_EVENT_KEY=prod_xxx
INNGEST_SIGNING_KEY=signkey_xxx
```

**Acceptance Criteria:**
- [ ] Cron jobs deployed to production
- [ ] Daily alerts run at 6 AM WAT
- [ ] Weekly cleanup runs on Sunday
- [ ] Health checks report status
- [ ] Failed executions alert admin
- [ ] Execution logs visible in Inngest dashboard

---

### Week 2: Tests + Bug Fixes

#### Task 1.5: Add Critical Path Tests
**Priority:** 🔴 P0 (Critical)
**Effort:** 3 days
**Files to create:**
- `/lib/workflow/__tests__/alert-engine.test.ts`
- `/lib/workflow/__tests__/batch-processor.test.ts`
- `/server/routers/__tests__/alerts.test.ts`
- `/server/routers/__tests__/batch-operations.test.ts`

**Requirements:**

1. **Alert Engine Tests** (1 day)
   ```typescript
   describe('createContractExpiryAlerts', () => {
     it('creates urgent alert for contract expiring in 5 days', async () => {
       const contract = await createTestContract({
         effectiveTo: addDays(new Date(), 5),
       });

       const result = await createContractExpiryAlerts();

       const alert = await getAlertForContract(contract.id);
       expect(alert.severity).toBe('urgent');
       expect(alert.dueDate).toEqual(contract.effectiveTo);
     });

     it('creates warning alert for contract expiring in 10 days', async () => {
       // Test warning severity
     });

     it('creates info alert for contract expiring in 25 days', async () => {
       // Test info severity
     });

     it('skips if alert already exists', async () => {
       // Test duplicate prevention
     });

     it('updates severity if changed', async () => {
       // Test severity update logic
     });
   });
   ```

2. **Batch Processor Tests** (1 day)
   ```typescript
   describe('processBulkSalaryUpdate', () => {
     it('updates 100 employees in < 10 seconds', async () => {
       const employees = await createTestEmployees(100);
       const start = Date.now();

       await processBulkSalaryUpdate({
         employeeIds: employees.map(e => e.id),
         updateType: 'percentage',
         value: 10,
         effectiveDate: new Date('2025-01-01'),
       });

       expect(Date.now() - start).toBeLessThan(10000);
     });

     it('handles individual employee errors without failing batch', async () => {
       // Test error isolation
     });

     it('rolls back transaction on critical error', async () => {
       // Test transaction rollback
     });

     it('creates audit log after successful update', async () => {
       // Test audit trail
     });
   });
   ```

3. **tRPC Router Tests** (1 day)
   ```typescript
   describe('alerts.list', () => {
     it('returns only user assigned alerts', async () => {
       // Test tenant isolation
     });

     it('filters by severity', async () => {
       // Test filtering
     });

     it('paginates correctly', async () => {
       // Test pagination
     });
   });

   describe('batchOperations.updateSalaries', () => {
     it('creates batch operation record', async () => {
       // Test operation creation
     });

     it('validates employee IDs belong to tenant', async () => {
       // Test security
     });
   });
   ```

**Test Setup:**
```typescript
// test-utils/setup.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function cleanupTestData() {
  await db.execute(sql`TRUNCATE alerts, batch_operations, payroll_events CASCADE`);
}

export async function createTestTenant() {
  // Create test tenant
}

export async function createTestEmployee(tenantId: string) {
  // Create test employee
}
```

**Acceptance Criteria:**
- [ ] All critical paths have tests
- [ ] Tests run in CI/CD pipeline
- [ ] 80% code coverage for business logic
- [ ] All tests pass locally and in CI
- [ ] Mock data helpers created
- [ ] Test database cleanup works

---

#### Task 1.6: Fix Schema Mismatches
**Priority:** 🔴 P0 (Critical)
**Effort:** 1 day
**File to fix:**
- `/lib/workflow/alert-engine.ts`

**Problem:**
```typescript
// Current (BROKEN)
const expiringContracts = await db.query.assignments.findMany({
  where: and(
    eq(assignments.status, 'active'), // ❌ Field doesn't exist
    eq(assignments.terminationDate, null) // ❌ Field doesn't exist
  ),
  with: {
    employee: true // ❌ Relation not defined
  }
});
```

**Solution:**
Use `employment_status` table instead:
```typescript
// Fixed
const expiringContracts = await db.query.assignments.findMany({
  where: and(
    gte(assignments.effectiveTo, today),
    lte(assignments.effectiveTo, in30Days)
  ),
  with: {
    employee: {
      with: {
        employmentStatus: {
          where: eq(employmentStatus.status, 'active'),
          orderBy: desc(employmentStatus.effectiveFrom),
          limit: 1,
        }
      }
    }
  }
});

// Filter in JavaScript
const activeContracts = expiringContracts.filter(contract =>
  contract.employee?.employmentStatus?.[0]?.status === 'active'
);
```

**Testing:**
```bash
# Run alert generation manually
npm run dev
# Open http://localhost:3000/api/inngest
# Trigger "Generate Daily Alerts" function
# Verify alerts created without errors
```

**Acceptance Criteria:**
- [ ] Alert generation runs without errors
- [ ] Contract expiry alerts created correctly
- [ ] Employee relation works
- [ ] Active status filter works
- [ ] No TypeScript errors (@ts-nocheck removed)

---

#### Task 1.7: Add Error Tracking
**Priority:** 🟡 P1 (High)
**Effort:** 0.5 days

**Requirements:**
1. Integrate Sentry (or similar)
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard --integration nextjs
   ```

2. Add error boundaries to pages
   ```tsx
   // app/(protected)/alerts/error.tsx
   'use client';
   export default function AlertsError({ error, reset }: { error: Error; reset: () => void }) {
     return (
       <ErrorState
         title="Erreur de chargement des alertes"
         description={error.message}
         action={{ label: 'Réessayer', onClick: reset }}
       />
     );
   }
   ```

3. Track critical errors
   - Alert generation failures
   - Batch operation failures
   - tRPC endpoint errors

**Acceptance Criteria:**
- [ ] Sentry configured in production
- [ ] Error boundaries on all pages
- [ ] Critical errors logged to Sentry
- [ ] Error alerts sent to admin

---

## Sprint 2: Event-Driven Automation Foundation (2 weeks)

**Goal:** Implement event-driven payroll calculations

### Week 3: Event Bus + Payroll Events

#### Task 2.1: Create Event Bus Wrapper
**Priority:** 🟡 P1 (High)
**Effort:** 1 day
**File to create:**
- `/lib/events/event-bus.ts`

**Requirements:**
1. Thin wrapper around Inngest
2. Type-safe event definitions
3. Easy to use API

**Implementation:**
```typescript
// lib/events/event-bus.ts
import { inngest } from '@/lib/inngest/client';

// Event type definitions
export type AppEvent =
  | { name: 'employee.hired'; data: { employeeId: string; hireDate: Date; baseSalary: number } }
  | { name: 'employee.terminated'; data: { employeeId: string; terminationDate: Date; reason: string } }
  | { name: 'salary.changed'; data: { employeeId: string; oldSalary: number; newSalary: number; effectiveFrom: Date } }
  | { name: 'leave.approved'; data: { employeeId: string; leaveType: string; startDate: Date; endDate: Date } };

// Event publisher
export async function publishEvent(event: AppEvent) {
  await inngest.send(event);
}

// Event listener wrapper
export function onEvent<T extends AppEvent['name']>(
  eventName: T,
  handler: (data: Extract<AppEvent, { name: T }>['data']) => Promise<void>
) {
  return inngest.createFunction(
    { id: `on-${eventName}` },
    { event: eventName },
    async ({ event }) => {
      await handler(event.data);
    }
  );
}
```

**Usage:**
```typescript
// services/employee.service.ts
import { publishEvent } from '@/lib/events/event-bus';

export async function terminateEmployee(employeeId: string, terminationDate: Date, reason: string) {
  // Update database
  await db.update(employees).set({ /* ... */ });

  // Publish event
  await publishEvent({
    name: 'employee.terminated',
    data: { employeeId, terminationDate, reason },
  });
}
```

**Acceptance Criteria:**
- [ ] Event bus wrapper created
- [ ] Type-safe event definitions
- [ ] Integration with Inngest works
- [ ] Documentation written

---

#### Task 2.2: Implement Employee Termination Event
**Priority:** 🟡 P1 (High)
**Effort:** 2 days
**Files to create:**
- `/lib/inngest/functions/employee-terminated.ts`
- `/lib/payroll/prorated-calculations.ts`

**Requirements:**
1. Event listener for `employee.terminated`
2. Calculate prorated final payroll
3. Create payroll event record
4. Create alert for HR manager

**Implementation:**
```typescript
// lib/inngest/functions/employee-terminated.ts
import { inngest } from '../client';
import { calculateFinalPayroll } from '@/lib/payroll/prorated-calculations';
import { db } from '@/lib/db';
import { payrollEvents, alerts } from '@/lib/db/schema';

export const employeeTerminatedHandler = inngest.createFunction(
  { id: 'employee-terminated', name: 'Handle Employee Termination' },
  { event: 'employee.terminated' },
  async ({ event, step }) => {
    const { employeeId, terminationDate, reason } = event.data;

    // Step 1: Calculate prorated final payroll
    const finalPayroll = await step.run('calculate-final-payroll', async () => {
      return await calculateFinalPayroll({
        employeeId,
        terminationDate,
        includeProration: true,
        includeVacationPayout: true,
        includeExitBenefits: reason !== 'resignation',
      });
    });

    // Step 2: Create payroll event
    await step.run('create-payroll-event', async () => {
      await db.insert(payrollEvents).values({
        tenantId: event.tenantId,
        eventType: 'termination',
        employeeId,
        eventDate: terminationDate,
        amountCalculated: finalPayroll.netPay,
        isProrated: true,
        workingDays: finalPayroll.workingDays,
        daysWorked: finalPayroll.daysWorked,
        metadata: {
          reason,
          vacationPayout: finalPayroll.vacationPayout,
          exitBenefits: finalPayroll.exitBenefits,
        },
        processingStatus: 'completed',
      });
    });

    // Step 3: Create alert for HR manager
    await step.run('create-alert', async () => {
      const hrManager = await getHRManager(event.tenantId);
      await db.insert(alerts).values({
        tenantId: event.tenantId,
        type: 'final_payroll_ready',
        severity: 'info',
        message: `Paie de sortie calculée pour ${event.employeeName}`,
        assigneeId: hrManager.id,
        employeeId,
        actionUrl: `/payroll/review/${finalPayroll.id}`,
        actionLabel: 'Vérifier la paie de sortie',
        status: 'active',
      });
    });

    return { success: true, finalPayroll };
  }
);
```

```typescript
// lib/payroll/prorated-calculations.ts
export async function calculateFinalPayroll(params: {
  employeeId: string;
  terminationDate: Date;
  includeProration: boolean;
  includeVacationPayout: boolean;
  includeExitBenefits: boolean;
}) {
  const employee = await getEmployee(params.employeeId);
  const currentSalary = await getCurrentSalary(params.employeeId);

  // Prorated salary for partial month
  const workingDays = getWorkingDaysInMonth(params.terminationDate, employee.countryCode);
  const daysWorked = getDaysWorkedUntil(
    startOfMonth(params.terminationDate),
    params.terminationDate,
    employee.countryCode
  );

  const proratedSalary = params.includeProration
    ? (Number(currentSalary.baseSalary) / workingDays) * daysWorked
    : Number(currentSalary.baseSalary);

  // Vacation payout
  const vacationPayout = params.includeVacationPayout
    ? await calculateVacationPayout(params.employeeId, params.terminationDate)
    : 0;

  // Exit benefits (indemnité de licenciement)
  const exitBenefits = params.includeExitBenefits
    ? await calculateExitBenefits(params.employeeId, employee.countryCode)
    : 0;

  // Standard deductions (CNPS, taxes on prorated amount)
  const deductions = await calculateDeductions({
    employeeId: params.employeeId,
    baseSalary: proratedSalary,
    countryCode: employee.countryCode,
  });

  return {
    proratedSalary,
    workingDays,
    daysWorked,
    vacationPayout,
    exitBenefits,
    deductions,
    netPay: proratedSalary + vacationPayout + exitBenefits - deductions.total,
  };
}
```

**Acceptance Criteria:**
- [ ] Event listener registered
- [ ] Prorated payroll calculated correctly
- [ ] Payroll event record created
- [ ] Alert created for HR manager
- [ ] Works for all termination reasons
- [ ] Handles mid-month terminations
- [ ] Handles end-of-month terminations

---

#### Task 2.3: Implement Employee Hire Event
**Priority:** 🟡 P1 (High)
**Effort:** 1.5 days
**Files to create:**
- `/lib/inngest/functions/employee-hired.ts`

**Requirements:**
1. Event listener for `employee.hired`
2. Calculate prorated first payroll (if mid-month)
3. Create payroll event record
4. Create alert for HR manager

**Implementation:**
```typescript
// lib/inngest/functions/employee-hired.ts
export const employeeHiredHandler = inngest.createFunction(
  { id: 'employee-hired', name: 'Handle New Employee Hire' },
  { event: 'employee.hired' },
  async ({ event, step }) => {
    const { employeeId, hireDate, baseSalary } = event.data;

    // Only create prorated payroll if hired mid-month
    if (hireDate.getDate() > 1) {
      const firstPayroll = await step.run('calculate-prorated-payroll', async () => {
        return await calculateProratedFirstPayroll({
          employeeId,
          hireDate,
          fullMonthlySalary: baseSalary,
        });
      });

      // Create payroll event
      await step.run('create-payroll-event', async () => {
        await db.insert(payrollEvents).values({
          tenantId: event.tenantId,
          eventType: 'hire',
          employeeId,
          eventDate: hireDate,
          amountCalculated: firstPayroll.proratedSalary,
          isProrated: true,
          workingDays: firstPayroll.workingDays,
          daysWorked: firstPayroll.daysWorked,
          prorationPercentage: firstPayroll.proratedPercentage,
          metadata: { fullMonthlySalary: baseSalary },
          processingStatus: 'completed',
        });
      });

      // Create alert
      await step.run('create-alert', async () => {
        const hrManager = await getHRManager(event.tenantId);
        await db.insert(alerts).values({
          tenantId: event.tenantId,
          type: 'prorated_payroll_created',
          severity: 'info',
          message: `Paie au prorata créée pour ${event.employeeName} (embauche le ${format(hireDate, 'dd MMM')})`,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/review/${firstPayroll.id}`,
          status: 'active',
        });
      });
    }

    return { success: true };
  }
);
```

**Acceptance Criteria:**
- [ ] Mid-month hires get prorated payroll
- [ ] First-of-month hires don't create prorated payroll
- [ ] Payroll event record created
- [ ] Alert created for HR manager
- [ ] Working days calculated correctly per country

---

### Week 4: Salary Change & Leave Events

#### Task 2.4: Implement Salary Change Event
**Priority:** 🟡 P1 (High)
**Effort:** 2 days
**Files to create:**
- `/lib/inngest/functions/salary-changed.ts`

**Requirements:**
1. Event listener for `salary.changed`
2. Recalculate affected payroll runs
3. Create payroll event record
4. Mark payroll for review

**Implementation:**
```typescript
// lib/inngest/functions/salary-changed.ts
export const salaryChangedHandler = inngest.createFunction(
  { id: 'salary-changed', name: 'Handle Salary Change' },
  { event: 'salary.changed' },
  async ({ event, step }) => {
    const { employeeId, oldSalary, newSalary, effectiveFrom } = event.data;

    // Find affected payroll runs (current month if mid-month change)
    const affectedRuns = await step.run('find-affected-runs', async () => {
      return await getPayrollRunsAffectedBy(effectiveFrom);
    });

    for (const run of affectedRuns) {
      // Recalculate payroll with prorated salary
      await step.run(`recalculate-${run.id}`, async () => {
        const recalculated = await recalculatePayrollEntry({
          employeeId,
          payrollRunId: run.id,
          salaryChangeDate: effectiveFrom,
          oldSalary,
          newSalary,
        });

        // Mark for review
        await markPayrollForReview(recalculated.id, 'salary_change');

        // Create payroll event
        await db.insert(payrollEvents).values({
          tenantId: event.tenantId,
          eventType: 'salary_change',
          employeeId,
          payrollRunId: run.id,
          eventDate: effectiveFrom,
          amountCalculated: recalculated.totalSalary,
          isProrated: true,
          workingDays: recalculated.daysAtOldSalary + recalculated.daysAtNewSalary,
          daysWorked: recalculated.daysAtOldSalary + recalculated.daysAtNewSalary,
          metadata: {
            oldSalary,
            newSalary,
            daysAtOldSalary: recalculated.daysAtOldSalary,
            daysAtNewSalary: recalculated.daysAtNewSalary,
          },
          processingStatus: 'completed',
        });
      });
    }

    // Create alert
    await step.run('create-alert', async () => {
      const hrManager = await getHRManager(event.tenantId);
      await db.insert(alerts).values({
        tenantId: event.tenantId,
        type: 'payroll_recalculated',
        severity: 'warning',
        message: `Paie recalculée suite au changement de salaire de ${event.employeeName}`,
        assigneeId: hrManager.id,
        employeeId,
        actionUrl: `/payroll/review?employee=${employeeId}`,
        status: 'active',
      });
    });

    return { success: true, affectedRuns: affectedRuns.length };
  }
);
```

**Acceptance Criteria:**
- [ ] Mid-month salary changes recalculate payroll
- [ ] Prorated calculation correct (days at old rate + days at new rate)
- [ ] Affected payroll runs marked for review
- [ ] Payroll event record created
- [ ] Alert created for HR manager

---

#### Task 2.5: Implement Unpaid Leave Event
**Priority:** 🟢 P2 (Medium)
**Effort:** 1.5 days
**Files to create:**
- `/lib/inngest/functions/leave-approved.ts`

**Requirements:**
1. Event listener for `leave.approved`
2. Calculate unpaid leave deduction
3. Add deduction to payroll entry
4. Create payroll event record

**Implementation:**
```typescript
// lib/inngest/functions/leave-approved.ts
export const leaveApprovedHandler = inngest.createFunction(
  { id: 'leave-approved', name: 'Handle Leave Approval' },
  { event: 'leave.approved' },
  async ({ event, step }) => {
    const { employeeId, leaveType, startDate, endDate } = event.data;

    // Only process unpaid leave
    if (leaveType === 'unpaid') {
      const deduction = await step.run('calculate-deduction', async () => {
        return await calculateUnpaidLeaveDeduction({
          employeeId,
          startDate,
          endDate,
        });
      });

      // Find affected payroll run
      const payrollRun = await getPayrollRunForMonth(startDate);

      // Add deduction to payroll entry
      await step.run('add-deduction', async () => {
        await addPayrollDeduction({
          employeeId,
          payrollRunId: payrollRun.id,
          type: 'unpaid_leave',
          amount: deduction.amount,
          days: deduction.days,
          description: `Congé sans solde: ${deduction.days} jours`,
        });
      });

      // Create payroll event
      await step.run('create-payroll-event', async () => {
        await db.insert(payrollEvents).values({
          tenantId: event.tenantId,
          eventType: 'unpaid_leave',
          employeeId,
          payrollRunId: payrollRun.id,
          eventDate: startDate,
          amountCalculated: -deduction.amount,
          workingDays: deduction.totalWorkingDays,
          daysWorked: deduction.totalWorkingDays - deduction.days,
          metadata: {
            leaveType,
            startDate,
            endDate,
            daysDeducted: deduction.days,
          },
          processingStatus: 'completed',
        });
      });

      // Create alert
      await step.run('create-alert', async () => {
        const hrManager = await getHRManager(event.tenantId);
        await db.insert(alerts).values({
          tenantId: event.tenantId,
          type: 'unpaid_leave_deduction',
          severity: 'info',
          message: `Déduction pour congé sans solde ajoutée (${deduction.days}j - ${formatCurrency(deduction.amount)})`,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/review/${payrollRun.id}`,
          status: 'active',
        });
      });
    }

    return { success: true };
  }
);
```

**Acceptance Criteria:**
- [ ] Unpaid leave deductions calculated correctly
- [ ] Deduction added to payroll entry
- [ ] Payroll event record created
- [ ] Alert created for HR manager
- [ ] Paid leave ignored (no deduction)

---

## Sprint 3: Advanced Automation (2 weeks)

**Goal:** Auto-renewal workflows + onboarding/offboarding

### Week 5: Auto-Renewal Workflows

#### Task 3.1: Contract Auto-Renewal Workflow
**Priority:** 🟢 P2 (Medium)
**Effort:** 2 days
**Files to create:**
- `/lib/workflow/templates/contract-renewal.ts`
- `/lib/inngest/functions/contract-renewal-workflow.ts`

**Requirements:**
1. Pre-built workflow template
2. Triggered 30 days before contract expiry
3. Creates alert for HR manager
4. 7-day timeout → escalates to manager's manager
5. Tracks workflow state

**Implementation:**
```typescript
// lib/workflow/templates/contract-renewal.ts
export const contractRenewalTemplate = {
  name: 'Renouvellement de contrat',
  triggerType: 'contract_expiry',
  triggerConfig: { daysBeforeExpiry: 30 },
  conditions: [
    { field: 'contract.type', operator: 'eq', value: 'CDD' },
  ],
  actions: [
    {
      type: 'create_alert',
      config: {
        severity: 'info',
        title: 'Contrat à renouveler',
        actionUrl: '/employees/{employeeId}/contracts/{contractId}',
        actionLabel: 'Renouveler le contrat',
        dueDate: '{contract.effectiveTo}',
      },
    },
    {
      type: 'wait_for_action',
      config: { timeout: 7 * 24 * 60 * 60 * 1000 }, // 7 days
    },
    {
      type: 'escalate',
      config: {
        condition: 'if_timeout',
        escalateTo: '{manager.managerId}',
        message: 'Renouvellement de contrat en attente',
      },
    },
  ],
};
```

**Acceptance Criteria:**
- [ ] Workflow triggered 30 days before expiry
- [ ] Alert created for HR manager
- [ ] Escalates after 7 days if not actioned
- [ ] Workflow completes when contract renewed
- [ ] Workflow state tracked in database

---

#### Task 3.2: Escalation Engine
**Priority:** 🟢 P2 (Medium)
**Effort:** 2 days
**Files to create:**
- `/lib/workflow/escalation-engine.ts`
- `/lib/inngest/functions/check-escalations.ts`

**Requirements:**
1. Scheduled job (daily at 8 AM)
2. Find overdue tasks (alerts with dueDate < now, status = active)
3. Escalate to manager's manager
4. Create escalation alert

**Implementation:**
```typescript
// lib/workflow/escalation-engine.ts
export async function checkEscalations() {
  const now = new Date();

  // Find overdue alerts
  const overdueAlerts = await db.query.alerts.findMany({
    where: and(
      eq(alerts.status, 'active'),
      lte(alerts.dueDate, now)
    ),
    with: {
      assignee: {
        columns: { id: true, managerId: true },
      },
      employee: true,
    },
  });

  for (const alert of overdueAlerts) {
    // Skip if no manager to escalate to
    if (!alert.assignee.managerId) continue;

    // Create escalation alert
    await db.insert(alerts).values({
      tenantId: alert.tenantId,
      type: 'escalation',
      severity: 'urgent',
      message: `Action requise: ${alert.message}`,
      assigneeId: alert.assignee.managerId,
      employeeId: alert.employeeId,
      actionUrl: alert.actionUrl,
      actionLabel: alert.actionLabel,
      dueDate: addDays(now, 3), // 3 days to resolve
      status: 'active',
      metadata: {
        escalatedFrom: alert.id,
        originalAssignee: alert.assigneeId,
      },
    });

    // Update original alert
    await db.update(alerts)
      .set({
        status: 'escalated',
        updatedAt: now,
        metadata: {
          ...alert.metadata,
          escalatedAt: now,
          escalatedTo: alert.assignee.managerId,
        },
      })
      .where(eq(alerts.id, alert.id));
  }

  return { success: true, escalationsCreated: overdueAlerts.length };
}
```

**Acceptance Criteria:**
- [ ] Daily check for overdue alerts
- [ ] Escalates to manager's manager
- [ ] Original alert marked as escalated
- [ ] Escalation alert created
- [ ] 3-day deadline for escalated alert

---

### Week 6: Onboarding/Offboarding

#### Task 3.3: Onboarding Checklist Workflow
**Priority:** 🟢 P2 (Medium)
**Effort:** 2 days
**Files to create:**
- `/lib/workflow/templates/onboarding.ts`
- `/components/workflow/onboarding-checklist.tsx`

**Requirements:**
1. Auto-created when employee hired
2. Checklist tasks:
   - [ ] Create contract
   - [ ] Setup email account
   - [ ] Order equipment
   - [ ] Schedule orientation
   - [ ] Add to HR system
3. Task assignment (HR, IT, Facilities)
4. Progress tracking (3/10 tasks done)

**Implementation:**
```typescript
// lib/workflow/templates/onboarding.ts
export const onboardingTemplate = {
  name: 'Intégration nouvel employé',
  triggerType: 'employee.hired',
  actions: [
    {
      type: 'create_tasks',
      config: {
        tasks: [
          { title: 'Créer le contrat', assignedTo: 'hr', priority: 'high' },
          { title: 'Configurer l\'email', assignedTo: 'it', priority: 'high' },
          { title: 'Commander l\'équipement', assignedTo: 'it', priority: 'medium' },
          { title: 'Préparer le poste de travail', assignedTo: 'facilities', priority: 'medium' },
          { title: 'Planifier l\'orientation', assignedTo: 'hr', priority: 'high' },
        ],
      },
    },
    {
      type: 'send_notification',
      config: {
        recipient: '{manager.email}',
        subject: 'Nouvel employé: {employee.fullName}',
        template: 'onboarding_started',
      },
    },
  ],
};
```

**Acceptance Criteria:**
- [ ] Workflow triggered on employee hire
- [ ] Checklist tasks created
- [ ] Tasks assigned to correct teams
- [ ] Progress tracked in database
- [ ] Manager notified

---

#### Task 3.4: Offboarding Checklist Workflow
**Priority:** 🟢 P2 (Medium)
**Effort:** 2 days

**Requirements:**
1. Auto-created when employee terminated
2. Checklist tasks:
   - [ ] Conduct exit interview
   - [ ] Collect equipment
   - [ ] Revoke access (email, systems)
   - [ ] Calculate final payroll
   - [ ] Generate exit documents
3. Archive employee data (GDPR)
4. Workflow completes 30 days after termination

**Acceptance Criteria:**
- [ ] Workflow triggered on termination
- [ ] Checklist tasks created
- [ ] Access revocation tracked
- [ ] Final payroll calculated
- [ ] Exit documents generated
- [ ] Data archived after 30 days

---

## Sprint 4: Polish & Phase 4 Foundation (2 weeks)

**Goal:** Production hardening + workflow builder foundation

### Week 7: Performance & Monitoring

#### Task 4.1: Add Real-Time Updates (SSE)
**Priority:** 🟡 P1 (High)
**Effort:** 2 days
**Files to create:**
- `/app/api/batch-operations/[id]/events/route.ts`

**Requirements:**
1. Server-Sent Events for batch operation progress
2. Replace polling with SSE
3. Automatic reconnection on disconnect

**Implementation:**
```typescript
// app/api/batch-operations/[id]/events/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const intervalId = setInterval(async () => {
        const operation = await db.query.batchOperations.findFirst({
          where: eq(batchOperations.id, params.id),
        });

        if (!operation) {
          clearInterval(intervalId);
          controller.close();
          return;
        }

        // Send progress update
        const data = `data: ${JSON.stringify(operation)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Close stream when operation completes
        if (['completed', 'failed', 'cancelled'].includes(operation.status)) {
          clearInterval(intervalId);
          controller.close();
        }
      }, 1000); // Update every second

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Acceptance Criteria:**
- [ ] SSE endpoint returns progress updates
- [ ] Client reconnects automatically
- [ ] Stream closes when operation completes
- [ ] UI updates in real-time
- [ ] Works on slow networks

---

#### Task 4.2: Add Performance Monitoring
**Priority:** 🟡 P1 (High)
**Effort:** 1 day

**Requirements:**
1. Track batch operation performance
   - Time per 100 employees
   - Success/error rates
2. Track alert delivery time
   - Time from trigger to creation
3. Dashboard for metrics

**Acceptance Criteria:**
- [ ] Metrics tracked in database
- [ ] Performance dashboard created
- [ ] Alerts on performance degradation

---

### Week 8: Workflow Builder Foundation

#### Task 4.3: Create Workflow Pages (Basic)
**Priority:** 🔵 P3 (Low)
**Effort:** 3 days
**Files to create:**
- `/app/(protected)/workflows/page.tsx`
- `/app/(protected)/workflows/new/page.tsx`
- `/app/(protected)/workflows/[id]/page.tsx`

**Requirements:**
1. List workflows (active, paused, archived)
2. Create workflow from template
3. View/edit workflow details
4. Activation/pause controls

**Note:** Defer drag-drop canvas to v2.0

**Acceptance Criteria:**
- [ ] Can create workflow from template
- [ ] Can activate/pause workflows
- [ ] Can view execution history
- [ ] Mobile-friendly layout

---

## Dependencies & Prerequisites

### External Services
- ✅ Inngest account (for cron jobs)
- ✅ Sentry account (for error tracking)
- 🔄 Email provider (SendGrid/Resend) - Phase 2
- 🔄 SMS provider (Twilio/Africa's Talking) - Phase 2

### Internal Dependencies
- ✅ Time-off module (for leave notifications) - Defer to future sprint
- ✅ Document module (for document expiry alerts) - Defer to future sprint
- ✅ Payroll calculations (`calculatePayrollV2`) - Already implemented

---

## Risk Mitigation

### Technical Risks
1. **Schema mismatches** - Fixed in Sprint 1 Week 2
2. **Performance at scale** - Load testing in Sprint 4
3. **Real-time updates** - SSE fallback to polling

### User Experience Risks
1. **Complex workflows** - Start with templates, defer custom builder
2. **Alert fatigue** - Implement smart grouping + digest emails
3. **Mobile performance** - Test on real devices, optimize bundle size

---

## Success Metrics

### MVP Launch (End of Sprint 2)
- ✅ Alerts page live in production
- ✅ Batch operations page live
- ✅ Daily alerts cron running
- ✅ 80% code coverage for critical paths
- ✅ < 1 min alert delivery time
- ✅ < 10 sec batch operation per 100 employees

### Full Epic (End of Sprint 4)
- ✅ Event-driven payroll working
- ✅ Auto-renewal workflows active
- ✅ Onboarding/offboarding workflows active
- ✅ Workflow builder foundation in place
- ✅ 90% code coverage
- ✅ User satisfaction > 8/10

---

## Timeline Summary

| Sprint | Weeks | Goal | Deliverables |
|--------|-------|------|-------------|
| 1 | 1-2 | Complete MVP | Alerts page, Batch ops page, Cron jobs, Tests |
| 2 | 3-4 | Event automation | Employee lifecycle events, Prorated payroll |
| 3 | 5-6 | Advanced workflows | Auto-renewal, Escalation, Onboarding/Offboarding |
| 4 | 7-8 | Polish | SSE, Monitoring, Workflow pages |

**Total Duration:** 8 weeks
**Total Effort:** ~90 person-days

---

**Plan created by:** Claude Code (Anthropic)
**Based on:** Epic 09-EPIC-WORKFLOW-AUTOMATION.md + Implementation Status Report
**Next Review:** After Sprint 1 completion
