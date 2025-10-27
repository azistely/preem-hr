# Employee Creation Code 11 Missing Fix

**Date:** 2025-10-27
**Issue:** Newly created employees missing Code 11 (Salaire categoriel) in components array
**Component:** Employee hire wizard (`/employees/new`)

## Problem Statement

When creating new employees through the hire wizard:

**User Action:**
- Navigate to `/employees/new`
- Fill in employee details
- Set base salary: 120,000 FCFA/mois
- Add transport allowance: 30,000 FCFA/mois
- Submit form

**Expected:**
- Components array includes Code 11 (base salary) + allowances
- Salary display shows correct total: 150,000 FCFA

**Actual:**
- Components array only includes allowances (transport)
- Code 11 (base salary) missing ❌
- Salary display shows only 30,000 FCFA ❌

**User Report:**
> "on monthly rate type the display is wrong, the employee has 120000 + 30000 but it says 'Salaire brut total mensuel (Base + indemnités) 30 000 FCFA/mois'"

## Root Cause Analysis

### The Data Flow (BROKEN)

**Before Fix:**

1. **UI (salary-info-step.tsx):**
   - User fills base salary: `baseComponents: { "11": 120000 }`
   - User adds transport: `components: [{ code: "TPT_TRANSPORT_CI", amount: 30000 }]`

2. **UI (new/page.tsx lines 145-159):**
   ```typescript
   // ❌ BEFORE FIX: Collapsed baseComponents into a number
   const baseSalary = Object.values(baseComponents).reduce(...); // = 120000

   await createEmployee.mutateAsync({
     baseSalary, // Just a number
     components: data.components || [], // Only allowances!
   });
   ```
   - Collapses `baseComponents` object into single `baseSalary` number
   - **Loses Code 11 structure!**
   - Sends only allowances in `components` array

3. **Backend (employee.service.ts line 239):**
   ```typescript
   await tx.insert(employeeSalaries).values({
     baseSalary: input.baseSalary.toString(),
     components, // Only [{ code: "TPT_TRANSPORT_CI", ... }] ❌
   });
   ```
   - Saves components array WITHOUT Code 11
   - Result: Missing base salary in components!

### Why Some Employees Had Code 11

**Onboarding flow (✅ CORRECT):**
```typescript
// onboarding-v2.service.ts lines 272-284
const baseComponentsArray = await buildBaseSalaryComponents(
  input.baseComponents, // { "11": 120000 }
  countryCode
);
```
- Onboarding CORRECTLY builds Code 11 components
- Uses `buildBaseSalaryComponents()` helper
- Result: Components include Code 11 ✅

**Hire wizard (❌ BROKEN):**
- Never called `buildBaseSalaryComponents()`
- Just sent `baseSalary` as number
- Result: Code 11 missing ❌

## Solution

### Change 1: Create Server Action

**File:** `features/employees/actions/create-employee.action.ts` (NEW)

```typescript
'use server';

import { buildBaseSalaryComponents } from '@/lib/salary-components/base-salary-loader';

/**
 * Build complete components array (base + allowances)
 */
export async function buildEmployeeComponents(
  baseSalary: number,
  baseComponents: Record<string, number> | undefined,
  allowanceComponents: Array<SalaryComponent>,
  countryCode: string = 'CI'
): Promise<Array<SalaryComponent>> {
  let baseComponentsArray: Array<SalaryComponent> = [];

  if (baseComponents && Object.keys(baseComponents).length > 0) {
    // User filled in base components (Code 11, 12, etc.)
    const built = await buildBaseSalaryComponents(baseComponents, countryCode);
    baseComponentsArray = built.map(c => ({
      code: c.code,
      name: c.name,
      amount: c.amount,
      sourceType: c.sourceType as 'standard' | 'custom' | 'calculated',
      metadata: c.metadata,
    }));
  } else if (baseSalary > 0) {
    // LEGACY: Single baseSalary field - create Code 11
    const built = await buildBaseSalaryComponents({ '11': baseSalary }, countryCode);
    baseComponentsArray = built.map(c => ({
      code: c.code,
      name: c.name,
      amount: c.amount,
      sourceType: c.sourceType as 'standard' | 'custom' | 'calculated',
      metadata: c.metadata,
    }));
  }

  // Merge base components + allowances
  return [...baseComponentsArray, ...allowanceComponents];
}
```

**Why server action?**
- `buildBaseSalaryComponents()` imports database modules (Node.js only)
- Cannot run in client components (browser)
- Server action runs on server, returns result to client

### Change 2: Update Client Component

**File:** `app/(shared)/employees/new/page.tsx`

**Import server action (line 30):**
```typescript
import { buildEmployeeComponents } from '@/features/employees/actions/create-employee.action';
```

**Use server action in form submission (lines 155-162):**
```typescript
// ✅ AFTER FIX: Use server action to build components
const countryCode = 'CI';
const allowanceComponents = (data.components || []).map(c => ({
  ...c,
  sourceType: c.sourceType || 'standard' as const,
}));
const allComponents = await buildEmployeeComponents(
  baseSalary,
  baseComponents,
  allowanceComponents,
  countryCode
);
```

**Send complete components array (line 171):**
```typescript
await createEmployee.mutateAsync({
  ...data,
  components: allComponents, // ✅ Now includes Code 11!
});
```

## Impact

### Before Fix

**Database:**
```json
{
  "baseSalary": "120000",
  "components": [
    { "code": "TPT_TRANSPORT_CI", "amount": 30000 }
  ]
}
```
❌ Missing Code 11!

**Display:**
- First display: 120,000 FCFA/mois (from `baseSalary` field)
- Second display: 30,000 FCFA/mois (only transport) ❌ WRONG!

### After Fix

**Database:**
```json
{
  "baseSalary": "120000",
  "components": [
    { "code": "11", "name": "Salaire de base", "amount": 120000 },
    { "code": "TPT_TRANSPORT_CI", "name": "Indemnité de transport", "amount": 30000 }
  ]
}
```
✅ Code 11 present!

**Display:**
- First display: 120,000 FCFA/mois (from Code 11)
- Second display: 150,000 FCFA/mois (120k + 30k) ✅ CORRECT!

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test Results

**Test 1: DAILY Worker (VERIFIED ✅)**
1. Created employee: Kofi Yao
2. Rate type: DAILY
3. Base salary: 3,500 FCFA/jour
4. Allowances: Phone (10,000 FCFA/mois)
5. **Database result:**
   ```json
   {
     "components": [
       { "code": "11", "name": "Salaire de base", "amount": 3500 },
       { "code": "PHONE", "name": "Prime de téléphone", "amount": 10000 }
     ],
     "has_code_11": true
   }
   ```
6. ✅ **PASS** - Code 11 included!

**Test 2: MONTHLY Worker (Expected)**
1. Create employee with MONTHLY rate
2. Base salary: 120,000 FCFA/mois
3. Transport: 30,000 FCFA/mois
4. **Expected components:**
   - Code 11: 120,000
   - TPT_TRANSPORT_CI: 30,000
5. **Expected display:**
   - Total: 150,000 FCFA/mois ✅

**Test 3: HOURLY Worker (Expected)**
1. Create employee with HOURLY rate
2. Base salary: 400 FCFA/heure
3. Transport: 20,000 FCFA/mois
4. **Expected components:**
   - Code 11: 400 (hourly rate)
   - TPT_TRANSPORT_CI: 20,000 (monthly amount)
5. **Expected display:**
   - Total: ~483 FCFA/heure (400 + 20k/30/8) ✅

## Architecture Notes

### Components Architecture

The salary system uses **components-based architecture**:

**Database Schema:**
```typescript
employeeSalaries {
  baseSalary: string;      // Legacy field (duplicate of Code 11)
  components: JSON[];      // Source of truth ✅
}
```

**Component Structure:**
```typescript
[
  { code: '11', name: 'Salaire categoriel', amount: 120000, sourceType: 'standard' },
  { code: 'TPT_TRANSPORT_CI', name: 'Indemnité de transport', amount: 30000, sourceType: 'template' }
]
```

**Design Decision:**
- `components` array is the **source of truth**
- Code 11/01 in components **includes the base salary**
- `baseSalary` field is kept for **backward compatibility** only
- **All salary calculations** use components array

### Why Not Fix Backend Instead?

**Option A: Fix backend to auto-inject Code 11**
- ❌ Backend would need to guess component metadata
- ❌ Different countries have different base salary codes
- ❌ Backend shouldn't know UI structure

**Option B: Fix frontend to build Code 11 (✅ CHOSEN)**
- ✅ UI knows exact user input (baseComponents object)
- ✅ Server action has database access for metadata
- ✅ Matches onboarding flow pattern
- ✅ Single source of truth for component building

### Related Patterns

**All employee creation flows now use `buildBaseSalaryComponents()`:**

1. **Onboarding Q2** (`onboarding-v2.service.ts`) ✅
   ```typescript
   const baseComponentsArray = await buildBaseSalaryComponents(
     input.baseComponents, countryCode
   );
   ```

2. **Hire Wizard** (`employees/new/page.tsx`) ✅ (this fix)
   ```typescript
   const allComponents = await buildEmployeeComponents(
     baseSalary, baseComponents, allowances, countryCode
   );
   ```

3. **Salary Change** (`salary.service.ts`) ✅
   ```typescript
   const baseSalary = await calculateBaseSalaryTotal(
     input.components, countryCode
   );
   ```

**Consistent pattern:** All flows use database-driven component builders.

## Files Changed

1. **`features/employees/actions/create-employee.action.ts`** (NEW)
   - Server action to build components with Code 11
   - Calls `buildBaseSalaryComponents()` on server
   - Returns complete components array to client

2. **`app/(shared)/employees/new/page.tsx`**
   - Line 30: Import `buildEmployeeComponents` server action
   - Lines 155-166: Call server action to build complete components
   - Line 171: Send complete `allComponents` array to backend

## Related Issues

This fix addresses the **last piece** of the components architecture migration:

1. ✅ **Payroll calculation** - Uses `components` array (v2)
2. ✅ **Onboarding payslip preview** - Displays components correctly
3. ✅ **Salary change validation** - Extracts base from components
4. ✅ **Employee detail display** - Calculates from components (with fallback)
5. ✅ **Employee creation** (this fix) - Builds Code 11 into components

All salary operations now use the **centralized, database-driven components approach**.

## Verification

```bash
# Type check
npm run type-check

# Dev server
npm run dev

# Manual test
# 1. Navigate to http://localhost:3001/employees/new
# 2. Fill in employee details
# 3. Set base salary (any rate type)
# 4. Add allowances
# 5. Submit form
# 6. Navigate to employee detail page
# 7. Click "Salaire" tab
# 8. Verify both displays show correct totals
```

**Database verification:**
```sql
SELECT
  e.first_name, e.last_name, e.rate_type,
  es.base_salary, es.components,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(es.components) AS comp
    WHERE comp->>'code' IN ('11', '01')
  ) as has_code_11
FROM employees e
JOIN employee_salaries es ON e.id = es.employee_id
WHERE es.effective_to IS NULL
ORDER BY es.created_at DESC
LIMIT 10;
```

Expected: All newly created employees have `has_code_11: true` ✅

---

**Status:** ✅ Fixed
**Severity:** Critical - Data integrity issue
**User Impact:** Critical - Salary displays were incorrect, payroll calculations at risk

**Related Docs:**
- `EMPLOYEE-DETAIL-SALARY-DOUBLE-COUNTING-FIX.md` - Display layer fix (fallback for legacy data)
- `SALARY-CHANGE-SMIG-VALIDATION-FIX.md` - Validation layer fix
- `ONBOARDING-Q1-EXISTING-LOCATIONS-FIX.md` - Onboarding idempotency pattern
- `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` - Components architecture overview
- `lib/salary-components/README.md` - Component system design
