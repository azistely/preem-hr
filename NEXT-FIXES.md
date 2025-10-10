# Next TypeScript Fixes - Quick Reference

> **Current Status:** 163 errors (down from 470+ originally)
> **Target:** Under 80 errors
> **Estimated Time:** 6-8 hours total

## 🚀 Quick Wins (1-2 hours, 40+ errors fixed)

### 1. Add Missing Drizzle Relations (30 errors, 30 min)

**File:** `/Users/admin/Sites/preem-hr/drizzle/schema.ts`

Add these relation exports:

```typescript
// Time Off Relations
export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
  policy: one(timeOffPolicies, {
    fields: [timeOffRequests.policyId],
    references: [timeOffPolicies.id],
  }),
  employee: one(employees, {
    fields: [timeOffRequests.employeeId],
    references: [employees.id],
  }),
}));

// Time Entries Relations
export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  employee: one(employees, {
    fields: [timeEntries.employeeId],
    references: [employees.id],
  }),
}));

// Time Off Balances Relations
export const timeOffBalancesRelations = relations(timeOffBalances, ({ one }) => ({
  policy: one(timeOffPolicies, {
    fields: [timeOffBalances.policyId],
    references: [timeOffPolicies.id],
  }),
  employee: one(employees, {
    fields: [timeOffBalances.employeeId],
    references: [employees.id],
  }),
}));

// Geofence Assignment Relations
export const geofenceEmployeeAssignmentsRelations = relations(geofenceEmployeeAssignments, ({ one }) => ({
  employee: one(employees, {
    fields: [geofenceEmployeeAssignments.employeeId],
    references: [employees.id],
  }),
  geofence: one(geofenceConfigurations, {
    fields: [geofenceEmployeeAssignments.geofenceId],
    references: [geofenceConfigurations.id],
  }),
}));
```

### 2. Fix Severance Calculation Return Type (8 errors, 20 min)

**File:** `/Users/admin/Sites/preem-hr/lib/trpc/routers/employee-categories.ts`

Find the `calculateSeverancePay` endpoint and update return:

```typescript
// Before (incomplete)
return {
  severancePay: amount,
  yearsOfService: years,
};

// After (complete)
return {
  severancePay: amount,
  totalAmount: amount,
  averageSalary: avgSalary,
  rate: ratePercentage,
  yearsOfService: years,
};
```

### 3. Fix Notice Period Return Type (3 errors, 10 min)

Same file, update `calculateNoticePeriod`:

```typescript
return {
  noticePeriodDays: totalDays,
  category: {
    friendlyLabel: category.friendlyLabel,
    // ... other fields
  },
  workDays: workDays,
  searchDays: searchDays,
};
```

### 4. Fix Overtime Breakdown Type (5 errors, 15 min)

**File:** `/Users/admin/Sites/preem-hr/features/time-tracking/services/payroll-integration.service.ts`

Update the OvertimeBreakdown interface:

```typescript
interface OvertimeBreakdown {
  totalOvertimeHours: number;
  overtimePay: number;
  weekday: number;
  weekend: number; // Add this
  holiday: number;
}
```

## 📋 Medium Priority (4-6 hours, 30+ errors fixed)

### 5. Fix Inngest Date Inserts (15 errors, 2 hours)

**Files:** `/Users/admin/Sites/preem-hr/lib/inngest/functions/*.ts`

Pattern to fix:

```typescript
// Before
await db.insert(alerts).values({
  dueDate: new Date(), // ❌ Type error
});

// After
await db.insert(alerts).values({
  dueDate: new Date().toISOString(), // ✅ Convert to string
});
```

Files to update:
- `alert-escalation.ts`
- `employee-hired.ts`
- `employee-terminated.ts`
- `leave-approved.ts`
- `salary-changed.ts`

### 6. Fix Salary Band Creation (2 errors, 30 min)

**File:** `/Users/admin/Sites/preem-hr/features/employees/components/salary-bands/create-salary-band-modal.tsx`

Update mutation to include required fields:

```typescript
createMutation.mutate({
  name: data.name,
  code: generateCode(data.name), // Add auto-generated code
  minSalary: data.minSalary,
  maxSalary: data.maxSalary,
  midSalary: (data.minSalary + data.maxSalary) / 2, // Add calculated midpoint
  jobLevel: data.jobLevel || 'ENTRY',
  currency: 'XOF',
  effectiveFrom: new Date(),
});
```

### 7. Fix Salary Band Update (1 error, 15 min)

**File:** `/Users/admin/Sites/preem-hr/features/employees/components/salary-bands/edit-salary-band-modal.tsx`

Change mutation input:

```typescript
updateMutation.mutate({
  bandId: data.id, // Change 'id' to 'bandId'
  name: data.name,
  minSalary: data.minSalary,
  maxSalary: data.maxSalary,
  // ... other fields
});
```

### 8. Add Missing SQL Import (2 errors, 5 min)

**File:** `/Users/admin/Sites/preem-hr/server/routers/time-off.ts`

Add to imports:

```typescript
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm'; // Add 'sql'
```

### 9. Fix Generic Type Constraints (6 errors, 1 hour)

**File:** `/Users/admin/Sites/preem-hr/lib/salary-components/template-merger.ts`

Lines 165, 168 - Change from assignment to return:

```typescript
// Before
result[key] = mergedValue; // ❌ Can't assign to generic type

// After
return {
  ...result,
  [key]: mergedValue,
} as T; // ✅ Return new object
```

### 10. Fix Type Conversions (6 errors, 1 hour)

**File:** `/Users/admin/Sites/preem-hr/lib/salary-components/metadata-builder.ts`

Add proper type guards:

```typescript
// Before
return rawMetadata as CIMetadataFormInputs; // ❌ Unsafe cast

// After
const validated: CIMetadataFormInputs = {
  isTaxable: Boolean(rawMetadata.isTaxable),
  includeInGross: Boolean(rawMetadata.includeInGross),
  // ... ensure all required fields
};
return validated; // ✅ Type-safe
```

## 🔍 Low Priority (defer or document)

### Supabase Functions (40 errors)
- These use Deno runtime, separate from main app
- Can be excluded from main type check
- Add to `tsconfig.json`: `"exclude": ["supabase/functions"]`

### Workflow System (23 errors)
- Feature not yet in production
- Document in tech debt tracker
- Fix when activating workflow feature

## 🎯 Success Metrics

After completing Quick Wins:
- [ ] Error count < 120 (from 163)
- [ ] All tRPC endpoints return complete types
- [ ] All Drizzle relations work with `.with()`
- [ ] No `@ts-ignore` comments added

After completing Medium Priority:
- [ ] Error count < 80 (50% reduction from original 155)
- [ ] All Inngest functions type-safe
- [ ] Salary band CRUD fully typed
- [ ] Generic utilities properly typed

## 📝 Verification Commands

```bash
# Check specific file
npx tsc --noEmit path/to/file.ts

# Check error count
npm run type-check 2>&1 | grep "error TS" | wc -l

# Category breakdown
npm run type-check 2>&1 | grep "error TS" | sed 's/.*error TS/TS/' | cut -d':' -f1 | sort | uniq -c | sort -rn

# Filter by error type
npm run type-check 2>&1 | grep "TS2353"  # Relations errors
npm run type-check 2>&1 | grep "TS2339"  # Missing properties
```

## 🚨 Don't Do This

❌ Adding `@ts-ignore` or `@ts-expect-error`
❌ Using `any` type
❌ Disabling strict mode
❌ Skipping return type annotations
❌ Casting without validation

## ✅ Do This Instead

✅ Define proper interfaces/types
✅ Use `InferSelectModel` for Drizzle
✅ Add relations for foreign keys
✅ Type all function returns
✅ Use type guards for validation

---

**Last Updated:** 2025-10-09
**Next Review:** After implementing Quick Wins
