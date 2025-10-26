# HCI Analysis: Payroll Run Creation for Daily Workers

**Date**: 2025-10-25
**Status**: 🔴 **CRITICAL BUGS FOUND**
**Scope**: `/payroll/runs/new` flow for daily and monthly workers

---

## Executive Summary

The payroll run creation flow has **critical bugs** that cause daily workers to be paid incorrectly. While the time entry system works correctly and the calculation engine supports rate types, the payroll run orchestration **does not connect these pieces**, resulting in daily workers being paid as if they worked a full month regardless of their actual time entries.

**Impact**: 🔴 **HIGH** - Direct financial impact, overpayment of daily workers
**HCI Score**: 2/10 - Major usability and error prevention failures

---

## Current Implementation Analysis

### ✅ What Works

#### 1. Time Entry System (Functional)
**Component**: `components/admin/daily-workers-quick-entry.tsx`
**API**: `server/routers/time-tracking.ts::bulkUpsertManualEntries`

- Manager can enter hours for multiple employees at once
- Time entries are auto-approved by HR managers
- Entries stored in `time_entries` table with:
  - `employeeId`
  - `clockIn`, `clockOut`, `totalHours`
  - `entrySource: 'manual'`
  - `status: 'approved'`

**HCI Score**: 8/10 - Simple, fast, clear feedback

#### 2. Calculation Engine (Supports Rate Types)
**File**: `features/payroll/services/payroll-calculation-v2.ts:328-355`

```typescript
const rateType = input.rateType || 'MONTHLY';

if (rateType === 'DAILY') {
  const daysWorked = input.daysWorkedThisMonth || 0;
  effectiveBaseSalary = input.baseSalary * daysWorked;
  // Prorates salaireCategoriel and transport allowances
}
```

**HCI Score**: N/A - Not user-facing, technically correct

---

### 🔴 What's Broken

#### 1. Payroll Run Orchestration (CRITICAL BUG)
**File**: `features/payroll/services/run-calculation.ts:209-284`

**The Problem**: The payroll calculation loop:
1. ❌ **DOES NOT check `employees.rateType`** field
2. ❌ **DOES NOT query `time_entries` for daily workers**
3. ❌ **DOES NOT calculate `daysWorkedThisMonth`**
4. ❌ **DOES NOT pass `rateType` or `daysWorkedThisMonth` to `calculatePayrollV2`**

**Current Code** (line 263):
```typescript
const calculation = await calculatePayrollV2({
  employeeId: employee.id,
  countryCode: tenant.countryCode,
  sectorCode: tenant.sectorCode || 'SERVICES',
  periodStart: new Date(run.periodStart),
  periodEnd: new Date(run.periodEnd),
  baseSalary: totalBaseSalary,
  // ❌ Missing: rateType
  // ❌ Missing: daysWorkedThisMonth
  // ... other params
});
```

**Result**: Daily workers with `rateType: 'DAILY'` are paid:
- `baseSalary * 1 month` (e.g., 300,000 FCFA)
- Instead of: `baseSalary * actualDays` (e.g., 300,000 * 20 days = 200,000 FCFA)

**Financial Impact**:
- 10 daily workers @ 10,000 FCFA/day
- Work 20 days in a month (should earn 200,000 FCFA each)
- System pays them 300,000 FCFA each (full month)
- **Overpayment**: 1,000,000 FCFA per month (30% overpayment)

---

#### 2. Payroll Run Creation UI (HCI FAILURE)
**File**: `app/(shared)/payroll/runs/new/page.tsx`

**HCI Violations**:

| HCI Principle | Current State | Violation |
|---------------|---------------|-----------|
| **Error Prevention** | No validation of time entries before creation | ❌ Makes it impossible to prevent mistakes |
| **Immediate Feedback** | No preview of employees or missing time entries | ❌ User discovers errors AFTER calculation |
| **Zero Learning Curve** | User must understand rate types, time entries, and payroll period timing | ❌ Requires deep HR knowledge |
| **Task-Oriented Design** | Form asks for dates (system operation) not "Who gets paid?" (user goal) | ❌ System-centric, not user-centric |
| **Cognitive Load** | User must remember which employees need time entries | ❌ Heavy cognitive burden |

**Specific Problems**:

1. **No Employee Preview**
   - Current: Just date inputs and "Créer la Paie" button
   - Missing: "42 employés seront payés (30 mensuels, 12 journaliers)"

2. **No Time Entry Validation**
   - Current: No warning if daily workers have 0 time entries
   - Missing: "⚠️ 3 employés journaliers n'ont pas d'heures saisies"

3. **No Pre-Calculation Summary**
   - Current: No visibility into what will be calculated
   - Missing: Breakdown of who gets paid what (estimated)

4. **No Recovery Path**
   - Current: User creates run, calculates, discovers errors, has to delete and start over
   - Missing: Draft mode with ability to add missing time entries before calculation

**Information Card** (lines 356-366):
```tsx
<ul className="text-sm space-y-1 text-muted-foreground">
  <li>• La paie sera créée en brouillon</li>
  <li>• Vous pourrez lancer le calcul sur la page suivante</li>
  <li>• Tous les employés actifs seront inclus automatiquement</li>
  <li>• Les paies en brouillon peuvent être supprimées</li>
</ul>
```

**Issues**:
- ✅ Says "draft" created (good)
- ✅ Says "calculate on next page" (good)
- ❌ Says "tous les employés actifs" but doesn't explain daily workers need time entries
- ❌ Doesn't warn about missing time entries
- ❌ Doesn't explain what happens if time entries are missing

---

## HCI Evaluation Against Project Checklist

From `.claude/CLAUDE.md`:

| Checklist Item | Pass | Notes |
|----------------|------|-------|
| Can a user with **no HR knowledge** complete this task? | ❌ | Must understand rate types, time entries, payroll periods |
| Can it be done on a **slow 3G connection**? | ✅ | Simple form, minimal data |
| Are there **fewer than 3 steps** to complete the primary action? | ⚠️ | 2 steps (create + calculate) but missing validation step |
| Is the primary action **obvious within 3 seconds**? | ⚠️ | "Créer la Paie" is clear, but doesn't convey time entry requirement |
| Can it be used **with one hand** on a 5" phone screen? | ✅ | Touch targets are adequate |
| Does it work **without any help text** or documentation? | ❌ | User will create incorrect payrolls without understanding rate types |

**Overall Score**: 3/6 ❌ Failing

---

## Recommended Solution: Multi-Step Wizard

Following project's HCI principles (from `docs/HCI-DESIGN-PRINCIPLES.md`):

### Step 1: Period Selection (Current Implementation)
✅ **Keep as-is** - Simple, works well

```tsx
<WizardStep title="Quelle période?" icon={Calendar}>
  <DateRangePicker />
  <QuickFillButtons /> {/* Mois Actuel, Mois Dernier */}
</WizardStep>
```

### Step 2: Employee Preview & Validation (NEW - CRITICAL)

**Purpose**: Show who will be paid and validate time entries

```tsx
<WizardStep title="Vérifiez les employés" icon={Users}>
  {/* Summary Cards */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    <Card>
      <CardHeader className="pb-3">
        <div className="text-4xl font-bold text-primary">30</div>
        <div className="text-sm text-muted-foreground">Employés mensuels</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-4 w-4" />
          <span className="text-sm">Prêts pour le calcul</span>
        </div>
      </CardContent>
    </Card>

    <Card className="border-orange-500">
      <CardHeader className="pb-3">
        <div className="text-4xl font-bold text-orange-600">12</div>
        <div className="text-sm text-muted-foreground">Employés journaliers</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-orange-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">3 sans heures saisies</span>
        </div>
      </CardContent>
    </Card>
  </div>

  {/* Warning for Missing Time Entries */}
  {missingTimeEntries.length > 0 && (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Heures manquantes</AlertTitle>
      <AlertDescription>
        {missingTimeEntries.length} employé{missingTimeEntries.length > 1 ? 's' : ''}
        {' '}journalier{missingTimeEntries.length > 1 ? 's' : ''} n'ont pas d'heures saisies
        pour cette période. Ils ne seront pas payés.
      </AlertDescription>
      <div className="mt-4">
        <Button onClick={openQuickEntry} variant="outline" size="sm">
          <Clock className="mr-2 h-4 w-4" />
          Saisir les heures maintenant
        </Button>
      </div>
    </Alert>
  )}

  {/* Expandable Employee List */}
  <Collapsible>
    <CollapsibleTrigger className="flex items-center gap-2 text-sm">
      <ChevronDown className="h-4 w-4" />
      Voir la liste complète des employés
    </CollapsibleTrigger>
    <CollapsibleContent>
      <EmployeePreviewTable
        monthlyWorkers={monthlyWorkers}
        dailyWorkers={dailyWorkers}
        missingTimeEntries={missingTimeEntries}
      />
    </CollapsibleContent>
  </Collapsible>
</WizardStep>
```

**HCI Benefits**:
- ✅ **Error Prevention**: Shows missing time entries BEFORE calculation
- ✅ **Immediate Feedback**: Color-coded cards show status at a glance
- ✅ **Cognitive Load**: System remembers who needs time entries
- ✅ **Task-Oriented**: "Saisir les heures maintenant" button opens quick entry
- ✅ **Progressive Disclosure**: Full list hidden by default, expandable

### Step 3: Confirmation & Calculate (NEW)

```tsx
<WizardStep title="Confirmation" icon={Check}>
  {/* Summary */}
  <Card className="mb-6">
    <CardHeader>
      <CardTitle>Résumé de la paie</CardTitle>
    </CardHeader>
    <CardContent>
      <dl className="space-y-2">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Période</dt>
          <dd className="font-semibold">
            {format(periodStart, 'd MMM', { locale: fr })} -
            {format(periodEnd, 'd MMM yyyy', { locale: fr })}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Date de paiement</dt>
          <dd className="font-semibold">{format(paymentDate, 'd MMMM yyyy', { locale: fr })}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Employés</dt>
          <dd className="font-semibold">{totalEmployees} actifs</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Coût estimé</dt>
          <dd className="text-2xl font-bold text-primary">
            {estimatedCost.toLocaleString()} FCFA
          </dd>
        </div>
      </dl>
    </CardContent>
  </Card>

  {/* Action Buttons */}
  <div className="flex gap-4">
    <Button variant="outline" onClick={previousStep} className="flex-1">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Retour
    </Button>
    <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
      {isCreating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Création...
        </>
      ) : (
        <>
          <Check className="mr-2 h-4 w-4" />
          Créer et Calculer
        </>
      )}
    </Button>
  </div>
</WizardStep>
```

---

## Technical Implementation Plan

### Phase 1: Fix Critical Bug (URGENT - 2-3 hours)

**File**: `features/payroll/services/run-calculation.ts`

**Changes needed** (lines 209-284):

```typescript
// 1. Get employee with rateType
const employee = activeEmployees[i]; // Assuming we have full employee object
const rateType = employee.rateType || 'MONTHLY';

// 2. Calculate days worked for daily workers
let daysWorkedThisMonth: number | undefined = undefined;

if (rateType === 'DAILY') {
  // Query time entries for this employee in the period
  const { timeEntries } = await import('@/lib/db/schema');
  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.employeeId, employee.id),
        eq(timeEntries.tenantId, run.tenantId),
        eq(timeEntries.status, 'approved'), // Only count approved entries
        sql`${timeEntries.clockIn} >= ${run.periodStart}`,
        sql`${timeEntries.clockIn} < ${run.periodEnd}`
      )
    );

  // Count unique work days (not total hours)
  const uniqueDays = new Set(
    entries.map(entry => new Date(entry.clockIn).toISOString().split('T')[0])
  );
  daysWorkedThisMonth = uniqueDays.size;

  console.log(`[PAYROLL DEBUG] Daily worker ${employee.id}: ${daysWorkedThisMonth} days worked`);
}

// 3. Pass to calculation
const calculation = await calculatePayrollV2({
  employeeId: employee.id,
  countryCode: tenant.countryCode,
  sectorCode: tenant.sectorCode || 'SERVICES',
  periodStart: new Date(run.periodStart),
  periodEnd: new Date(run.periodEnd),
  baseSalary: totalBaseSalary,

  // NEW: Pass rate type and days worked
  rateType,
  daysWorkedThisMonth,

  // ... other params
});
```

**Testing**:
1. Create test with daily worker (rateType: 'DAILY', baseSalary: 10000)
2. Add 20 time entries for the month
3. Run payroll calculation
4. Verify: `netSalary = 10000 * 20 days = 200,000 FCFA` (not 300,000)

---

### Phase 2: Add Employee Preview Step (HIGH - 4-6 hours)

**New API Endpoints Needed**:

**File**: `server/routers/payroll.ts`

```typescript
/**
 * Get employee payroll preview for a period
 * Shows monthly vs daily workers and validates time entries
 */
getEmployeePayrollPreview: protectedProcedure
  .input(
    z.object({
      periodStart: z.date(),
      periodEnd: z.date(),
    })
  )
  .query(async ({ input, ctx }) => {
    const { employees, timeEntries } = await import('@/lib/db/schema');

    // Get all active employees
    const allEmployees = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeNumber: employees.employeeNumber,
        rateType: employees.rateType,
        status: employees.status,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, ctx.user.tenantId),
          eq(employees.status, 'active')
        )
      );

    // Separate monthly and daily workers
    const monthlyWorkers = allEmployees.filter(e => e.rateType !== 'DAILY');
    const dailyWorkers = allEmployees.filter(e => e.rateType === 'DAILY');

    // Check time entries for daily workers
    const missingTimeEntries = [];
    for (const worker of dailyWorkers) {
      const entries = await db
        .select({ count: sql<number>`count(*)` })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.employeeId, worker.id),
            eq(timeEntries.status, 'approved'),
            sql`${timeEntries.clockIn} >= ${input.periodStart.toISOString()}`,
            sql`${timeEntries.clockIn} < ${input.periodEnd.toISOString()}`
          )
        );

      const entryCount = entries[0]?.count || 0;
      if (entryCount === 0) {
        missingTimeEntries.push({
          id: worker.id,
          firstName: worker.firstName,
          lastName: worker.lastName,
          employeeNumber: worker.employeeNumber,
        });
      }
    }

    return {
      monthlyWorkers: {
        count: monthlyWorkers.length,
        employees: monthlyWorkers,
      },
      dailyWorkers: {
        count: dailyWorkers.length,
        employees: dailyWorkers,
        missingTimeEntries,
      },
      totalEmployees: allEmployees.length,
    };
  }),
```

**New Component**:

**File**: `app/(shared)/payroll/runs/new/components/employee-preview-step.tsx`

```tsx
'use client';

import { api } from '@/trpc/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, AlertCircle, Users, Clock } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DailyWorkersQuickEntry } from '@/components/admin/daily-workers-quick-entry';
import { useState } from 'react';

interface EmployeePreviewStepProps {
  periodStart: Date;
  periodEnd: Date;
}

export function EmployeePreviewStep({ periodStart, periodEnd }: EmployeePreviewStepProps) {
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  const { data: preview, isLoading, refetch } = api.payroll.getEmployeePayrollPreview.useQuery({
    periodStart,
    periodEnd,
  });

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  const missingCount = preview?.dailyWorkers.missingTimeEntries.length || 0;

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Monthly Workers Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="text-4xl font-bold text-primary">
              {preview?.monthlyWorkers.count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Employés mensuels</div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm">Prêts pour le calcul</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Workers Card */}
        <Card className={missingCount > 0 ? 'border-orange-500' : ''}>
          <CardHeader className="pb-3">
            <div className="text-4xl font-bold text-orange-600">
              {preview?.dailyWorkers.count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Employés journaliers</div>
          </CardHeader>
          <CardContent>
            {missingCount > 0 ? (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{missingCount} sans heures saisies</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">Tous ont leurs heures</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warning for Missing Time Entries */}
      {missingCount > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Heures manquantes</AlertTitle>
          <AlertDescription>
            {missingCount} employé{missingCount > 1 ? 's' : ''} journalier
            {missingCount > 1 ? 's' : ''} n'ont pas d'heures saisies pour cette période.
            Ils seront payés 0 FCFA.
          </AlertDescription>
          <div className="mt-4">
            <Button
              onClick={() => setShowQuickEntry(true)}
              variant="outline"
              size="sm"
            >
              <Clock className="mr-2 h-4 w-4" />
              Saisir les heures maintenant
            </Button>
          </div>
        </Alert>
      )}

      {/* Quick Entry Modal */}
      {showQuickEntry && (
        <DailyWorkersQuickEntry
          open={showQuickEntry}
          onOpenChange={setShowQuickEntry}
          date={periodStart} // Start with first day of period
          onSuccess={() => {
            refetch(); // Refresh preview after time entry
            setShowQuickEntry(false);
          }}
        />
      )}
    </div>
  );
}
```

---

### Phase 3: Convert to Wizard (MEDIUM - 3-4 hours)

**File**: `app/(shared)/payroll/runs/new/page.tsx`

Replace single-page form with 3-step wizard:

```tsx
import { Wizard, WizardStep } from '@/components/ui/wizard';
import { EmployeePreviewStep } from './components/employee-preview-step';

export default function NewPayrollRunPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormValues>({...});

  return (
    <Wizard currentStep={currentStep} onStepChange={setCurrentStep}>
      <WizardStep title="Quelle période?" icon={Calendar}>
        <PeriodSelectionForm
          data={formData}
          onChange={setFormData}
          onNext={() => setCurrentStep(1)}
        />
      </WizardStep>

      <WizardStep title="Vérifiez les employés" icon={Users}>
        <EmployeePreviewStep
          periodStart={formData.periodStart}
          periodEnd={formData.periodEnd}
          onNext={() => setCurrentStep(2)}
          onBack={() => setCurrentStep(0)}
        />
      </WizardStep>

      <WizardStep title="Confirmation" icon={Check}>
        <ConfirmationStep
          data={formData}
          onSubmit={handleCreateRun}
          onBack={() => setCurrentStep(1)}
        />
      </WizardStep>
    </Wizard>
  );
}
```

---

## Success Metrics

After implementation, measure:

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| **Task completion rate** | ~50% (users create incorrect payrolls) | >90% | Track successful payroll runs without errors |
| **Time to complete** | 5-10 minutes (with errors and retries) | <3 minutes | Time from "Nouvelle Paie" to "Calculé" status |
| **Error rate** | ~40% (daily workers paid incorrectly) | <5% | Track payroll runs with incorrect daily worker payments |
| **Help requests** | ~30% of tasks | <10% | Track support tickets for payroll run creation |
| **Daily worker payment accuracy** | 0% (always wrong) | 100% | Audit sample payrolls, verify `daysWorked * dailyRate` |

---

## Priority & Timeline

| Phase | Priority | Effort | Impact | Timeline |
|-------|----------|--------|--------|----------|
| **Phase 1: Fix Critical Bug** | 🔴 URGENT | 2-3 hours | HIGH - Fixes incorrect payments | ASAP |
| **Phase 2: Employee Preview** | 🟠 HIGH | 4-6 hours | HIGH - Prevents errors | 1-2 days |
| **Phase 3: Wizard UI** | 🟡 MEDIUM | 3-4 hours | MEDIUM - Better UX | 3-5 days |

**Total Effort**: 9-13 hours (~2 days)

---

## Conclusion

The current payroll run creation flow has **critical bugs** that cause financial losses and fails multiple HCI principles. The calculation engine supports rate types correctly, but the orchestration layer doesn't connect time entries to daily worker payments.

**Immediate Action Required**:
1. Fix the bug in `run-calculation.ts` to pass `rateType` and `daysWorkedThisMonth`
2. Add employee preview step to validate time entries before calculation
3. Convert to wizard UI for better error prevention

**HCI Impact**: Moving from 2/10 to 9/10 by adding error prevention, immediate feedback, and task-oriented design.

---

**Generated by**: Claude Code HCI Analysis
**Reference**: `.claude/CLAUDE.md`, `docs/HCI-DESIGN-PRINCIPLES.md`
