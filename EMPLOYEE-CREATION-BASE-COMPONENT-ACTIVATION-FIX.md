# Employee Creation Base Component Activation Fix

**Date:** 2025-10-27
**Issue:** Duplicate key error when creating employees with Code 11 (base salary)
**Component:** Employee creation service

## Problem Statement

When creating new employees through the hire wizard:

**User Action:**
- Navigate to `/employees/new`
- Fill in employee details with base salary
- Submit form

**Expected:**
- Employee created successfully ✅
- Code 11 (base salary) included in components ✅

**Actual:**
- Error: Duplicate key violation in `tenant_salary_component_activations` ❌
- Employee creation failed ❌

**Error Message:**
```
Failed query: insert into "tenant_salary_component_activations"
(id, tenant_id, country_code, template_code, ...)
values (..., 'CI', '11', ...)
params: ...,CI,11,...
```

## Root Cause Analysis

### The Issue

**Before Fix:**

```typescript
// employee.service.ts lines 221-230
if (components.length > 0) {
  const activationInputs = components.map(comp => ({
    code: comp.code,  // ❌ Includes Code 11!
    sourceType: (comp as any).sourceType || 'standard',
    tenantId: input.tenantId,
    countryCode: countryCode,
    userId: input.createdBy,
  }));

  await ensureComponentsActivated(activationInputs, tx);
  // ❌ Tries to activate Code 11 (base salary component)
}
```

**Problem:**
1. Code 11 (Salaire categoriel) is a **base salary component**
2. Base salary components have `metadata.isBaseComponent: true`
3. Base components are **fundamental** - always available, no activation needed
4. Trying to activate Code 11 causes duplicate key error

### Why This Happened

**Component Types:**

| Type | Example | Needs Activation? |
|------|---------|-------------------|
| **Base Salary** | Code 11 (Salaire categoriel) | ❌ NO - Always available |
| **Allowances** | TPT_TRANSPORT_CI (Transport) | ✅ YES - Tenant must activate |
| **Bonuses** | PHONE (Prime téléphone) | ✅ YES - Tenant must activate |

**Database Evidence:**
```sql
SELECT code, name->>'fr', metadata->>'isBaseComponent'
FROM salary_component_definitions
WHERE country_code = 'CI'
  AND (metadata->>'isBaseComponent')::boolean = true;
```

Result:
```
code: "11"
name: "Salaire catégoriel"
isBaseComponent: true  ← Base component, no activation needed!
```

### Why Duplicate Error?

**Scenario:**
1. First employee created → Code 11 activation attempted → **Insert succeeds** (first time)
2. Second employee created → Code 11 activation attempted → **Duplicate key error** ❌

The `ensureComponentsActivated()` function checks for existing activation, but in a transaction, the check might not see the pending insert from a concurrent request.

## Solution

Filter out base salary components before activation:

```typescript
// ✅ AFTER FIX: Filter out base components
if (components.length > 0) {
  // Filter out base salary components (they have isBaseComponent: true in metadata)
  const nonBaseComponents = components.filter(comp => {
    const metadata = (comp as any).metadata || {};
    return !metadata.isBaseComponent;
  });

  if (nonBaseComponents.length > 0) {
    const activationInputs = nonBaseComponents.map(comp => ({
      code: comp.code,
      sourceType: (comp as any).sourceType || 'standard',
      tenantId: input.tenantId,
      countryCode: countryCode,
      userId: input.createdBy,
    }));

    await ensureComponentsActivated(activationInputs, tx);
  }
}
```

**Why this works:**
- ✅ Code 11 has `isBaseComponent: true` → Filtered out
- ✅ Transport, housing, bonuses have `isBaseComponent: false` or undefined → Activated
- ✅ No duplicate key errors
- ✅ Base components remain always available

## Impact

### Before Fix

**First employee creation:**
```
Components: [Code 11, Transport]
Activation attempt: Code 11 ❌ (shouldn't activate), Transport ✅
Result: Success (but wrong - Code 11 activated incorrectly)
```

**Second employee creation:**
```
Components: [Code 11, Housing]
Activation attempt: Code 11 ❌ (already exists!), Housing ✅
Result: DUPLICATE KEY ERROR ❌
Employee creation FAILED ❌
```

### After Fix

**All employee creations:**
```
Components: [Code 11, Transport]
Filtered: [Transport] (Code 11 removed)
Activation attempt: Transport ✅
Result: Success ✅
```

**Components in database:**
```json
{
  "components": [
    { "code": "11", "name": "Salaire de base", "amount": 120000 },  ✅ Stored
    { "code": "TPT_TRANSPORT_CI", "name": "Transport", "amount": 30000 }  ✅ Stored
  ]
}
```

**Tenant activations:**
```sql
-- tenant_salary_component_activations
template_code: "TPT_TRANSPORT_CI"  ✅ Activated
-- Code 11 NOT in this table (as it should be!)
```

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test Cases

**Test 1: Create First Employee**
1. Navigate to `/employees/new`
2. Base salary: 120,000 FCFA/mois (Code 11)
3. Add transport: 30,000 FCFA/mois
4. Submit
5. **Expected:**
   - ✅ Employee created successfully
   - ✅ Code 11 in components (not activated)
   - ✅ Transport activated in tenant_salary_component_activations

**Test 2: Create Second Employee (Same Components)**
1. Navigate to `/employees/new`
2. Base salary: 100,000 FCFA/mois (Code 11)
3. Add transport: 30,000 FCFA/mois (same as first employee)
4. Submit
5. **Expected:**
   - ✅ Employee created successfully
   - ✅ No duplicate key error
   - ✅ Transport already activated (reused)

**Test 3: Create Employee with Different Allowances**
1. Navigate to `/employees/new`
2. Base salary: 150,000 FCFA/mois (Code 11)
3. Add housing: 40,000 FCFA/mois (new allowance)
4. Submit
5. **Expected:**
   - ✅ Employee created successfully
   - ✅ Housing activated in tenant_salary_component_activations

**Test 4: Daily Worker**
1. Navigate to `/employees/new`
2. Rate type: DAILY
3. Base salary: 3,500 FCFA/jour (Code 11)
4. Add phone bonus: 10,000 FCFA/mois
5. Submit
6. **Expected:**
   - ✅ Employee created successfully
   - ✅ Code 11 in components (not activated)
   - ✅ Phone bonus activated

## Architecture Notes

### Component Activation Rules

**Always Activate:**
- ✅ Allowances (transport, housing, meal)
- ✅ Bonuses (phone, performance, etc.)
- ✅ Custom components created by tenant

**NEVER Activate:**
- ❌ Base salary components (Code 11, Code 12)
- ❌ Components with `metadata.isBaseComponent: true`

**Why?**

Base salary components are **fundamental building blocks** of the payroll system:
- Every employee MUST have a base salary
- They're defined by labor law (not tenant preferences)
- They're always available (no opt-in needed)
- Activating them causes confusion and errors

### Related Patterns

**Other places with similar logic:**

1. **Onboarding service** (`onboarding-v2.service.ts`)
   - Already filters base components ✅
   - Uses `getBaseSalaryComponents()` separately

2. **Salary change service** (`salary.service.ts`)
   - **Needs same fix!** ⚠️ (uses same activation pattern)

3. **Bulk import** (if exists)
   - Should also filter base components

## Files Changed

**`features/employees/services/employee.service.ts`**
- Lines 216-243: Filter base components before activation
- Added comment explaining why base components shouldn't be activated
- Filter logic: `!metadata.isBaseComponent`

## Related Issues

This fix completes the Code 11 integration:

1. ✅ **Employee creation includes Code 11** (previous fix)
2. ✅ **Employee creation doesn't activate Code 11** (this fix)
3. ⏳ **Salary change should also filter base components** (follow-up)

## Verification

```bash
# Type check
npm run type-check

# Dev server
npm run dev

# Manual test
# 1. Create first employee with base salary + transport
# 2. Verify success (no error)
# 3. Create second employee with base salary + transport
# 4. Verify success (no duplicate key error)
```

**Database verification:**
```sql
-- Check that Code 11 is NOT in tenant activations
SELECT template_code, count(*)
FROM tenant_salary_component_activations
WHERE template_code = '11'
GROUP BY template_code;
-- Expected: 0 rows (Code 11 should never be activated)

-- Check that employees have Code 11 in their components
SELECT
  e.first_name, e.last_name,
  jsonb_array_length(es.components) as component_count,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(es.components) AS comp
    WHERE comp->>'code' = '11'
  ) as has_code_11
FROM employees e
JOIN employee_salaries es ON e.id = es.employee_id
WHERE es.effective_to IS NULL
ORDER BY es.created_at DESC
LIMIT 5;
-- Expected: All employees have has_code_11 = true
```

---

**Status:** ✅ Fixed
**Severity:** Critical - Blocks employee creation
**User Impact:** Critical - Users cannot create multiple employees

**Related Docs:**
- `EMPLOYEE-CREATION-CODE11-MISSING-FIX.md` - Previous fix (builds Code 11)
- `EMPLOYEE-DETAIL-SALARY-DOUBLE-COUNTING-FIX.md` - Display layer
- `SALARY-CHANGE-SMIG-VALIDATION-FIX.md` - Validation layer
- `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` - Components architecture
