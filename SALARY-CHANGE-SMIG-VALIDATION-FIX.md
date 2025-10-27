# Salary Change SMIG Validation Fix

**Date:** 2025-10-26
**Issue:** Salary change validation incorrectly failing for valid salaries
**Component:** Employee salary change service

## Problem Statement

When changing an employee's salary:

**User Action:**
- Employee has `rateType: DAILY`
- User enters new salary: **4,500 FCFA/jour**
- User clicks "Sauvegarder"

**Expected:**
- Salary change succeeds (4,500 > 2,500 SMIG daily) ✅

**Actual:**
- Error: "Le salaire doit être >= SMIG du Côte d'Ivoire (2500 FCFA/jour)" ❌
- **But 4,500 IS greater than 2,500!** 🤔

**User Report:**
> "on employee salary change I see new salary 4500 but when I try to save I have this error"

## Root Cause Analysis

### The Validation Logic

**File:** `features/employees/services/salary.service.ts` (line 106-109)

```typescript
// ❌ BEFORE FIX: Hardcoded component lookup
const baseComponent = input.components.find(c =>
  c.code === '01' ||
  c.name.toLowerCase().includes('base') ||
  c.name.toLowerCase().includes('salaire de base')
);
const baseSalary = baseComponent?.amount || 0;
```

### The Problem

For **Côte d'Ivoire**, the base salary component code is **'11'**, not '01'!

**Component Structure:**
- **Code 11:** Salaire categoriel (base salary)
- **Code 12:** Sursalaire (additional salary)
- **Code 22:** Indemnité de transport (transport allowance)

**What Happened:**
1. User changes salary → sends `components: [{ code: '11', amount: 4500 }]`
2. Validation looks for `code === '01'` → **NOT FOUND** ❌
3. Falls back to `baseSalary = 0`
4. Checks: `0 < 2500` → **FAILS** ❌
5. Throws error: "Le salaire doit être >= SMIG (2500 FCFA/jour)"

Even though the actual salary is 4,500 FCFA!

### Why This Code Existed

This was a **legacy fallback** from before the multi-country architecture:
- Originally only supported one country (maybe a generic '01' code)
- Hardcoded assumptions about component codes
- Not using the database-driven component system

## Solution

Replace hardcoded component lookup with **database-driven approach**:

```typescript
// ✅ AFTER FIX: Use database-driven base salary calculation
const { calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
const baseSalary = await calculateBaseSalaryTotal(input.components, countryCode);
```

### Why This Works

`calculateBaseSalaryTotal()` is **country-aware**:
- For **CI:** Looks for Code 11 + Code 12
- For **SN:** Looks for country-specific codes
- For **BF:** Looks for country-specific codes
- Uses **database metadata** (salary_components table with `is_base_component` flag)

**Result:**
1. User sends `components: [{ code: '11', amount: 4500 }]`
2. `calculateBaseSalaryTotal([...], 'CI')` → **4500** ✅
3. Checks: `4500 >= 2500` → **PASSES** ✅
4. Salary change succeeds!

## Impact

### Before Fix
```
User enters: 4,500 FCFA/jour
Validation extracts: 0 FCFA (component not found)
Check: 0 < 2,500 → FAIL ❌
Error: "Le salaire doit être >= SMIG"
User confused: "But 4,500 IS greater than 2,500!"
```

### After Fix
```
User enters: 4,500 FCFA/jour
Validation extracts: 4,500 FCFA (database-driven)
Check: 4,500 >= 2,500 → PASS ✅
Salary change succeeds!
```

### Multi-Country Support

This fix ensures SMIG validation works for **all countries**:

| Country | Base Components | Previous Behavior | After Fix |
|---------|----------------|-------------------|-----------|
| CI | Code 11, 12 | ❌ Extracted 0 | ✅ Extracted correctly |
| SN | Country-specific | ❌ Extracted 0 | ✅ Extracted correctly |
| BF | Country-specific | ❌ Extracted 0 | ✅ Extracted correctly |

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test Cases

**Test 1: Daily Worker Salary Change (CI)**
1. Employee: `rateType: DAILY`, current salary: 3,000 FCFA/jour
2. Navigate to employee details
3. Click "Modifier le salaire"
4. Enter new salary: 4,500 FCFA/jour (with Code 11)
5. Click "Sauvegarder"
6. **Expected:**
   - Validation passes (4,500 >= 2,500)
   - Salary change succeeds
   - Toast: "Salaire modifié avec succès"

**Test 2: Invalid Daily Salary (Below SMIG)**
1. Employee: `rateType: DAILY`
2. Try to set salary: 2,000 FCFA/jour
3. Click "Sauvegarder"
4. **Expected:**
   - Validation fails (2,000 < 2,500)
   - Error: "Le salaire doit être >= SMIG du Côte d'Ivoire (2500 FCFA/jour)"

**Test 3: Hourly Worker Salary Change (CI)**
1. Employee: `rateType: HOURLY`, current salary: 300 FCFA/heure
2. Change salary to: 400 FCFA/heure
3. **Expected:**
   - Validation passes (400 >= 312 hourly SMIG)
   - Salary change succeeds

**Test 4: Monthly Worker Salary Change (CI)**
1. Employee: `rateType: MONTHLY`, current salary: 80,000 FCFA/mois
2. Change salary to: 100,000 FCFA/mois
3. **Expected:**
   - Validation passes (100,000 >= 75,000 monthly SMIG)
   - Salary change succeeds

## Architecture Note

### Database-Driven Component System

The fix leverages our multi-country architecture:

**Component Metadata (salary_components table):**
```sql
| code | country_code | is_base_component | component_type |
|------|--------------|-------------------|----------------|
| 11   | CI           | true              | base_salary    |
| 12   | CI           | true              | sursalaire     |
| 22   | CI           | false             | transport      |
```

**Base Salary Loader:**
- `getBaseSalaryComponents(countryCode)` → Returns base component codes
- `calculateBaseSalaryTotal(components, countryCode)` → Sums base component amounts
- `getSalaireCategoriel(components, countryCode)` → Returns primary base component

**Benefits:**
- ✅ No hardcoded component codes
- ✅ Works for all countries
- ✅ Centralized component logic
- ✅ Easy to add new countries
- ✅ Database-driven (no code changes for new components)

## Files Changed

- `features/employees/services/salary.service.ts`
  - Lines 105-107: Replaced hardcoded lookup with database-driven approach
  - Now uses `calculateBaseSalaryTotal()` from base-salary-loader

## Related Fixes

This continues the pattern of database-driven salary components:

1. **Onboarding Q2 calculation** - Uses `buildBaseSalaryComponents()`
2. **Payroll calculation** - Uses `extractBaseSalaryAmounts()`
3. **Salary change validation** (this fix) - Uses `calculateBaseSalaryTotal()`

All salary component operations now use the **centralized, database-driven approach**.

## Verification

```bash
# Type check
npm run type-check

# Manual test
# 1. npm run dev
# 2. Navigate to employee with DAILY rate
# 3. Change salary to 4,500 FCFA/jour
# 4. Verify validation passes
# 5. Verify salary change succeeds
```

---

**Status:** ✅ Fixed
**Severity:** High - Blocks valid salary changes
**User Impact:** Critical - Users cannot update salaries even with valid amounts

**Related Docs:**
- `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` - Multi-country architecture
- `lib/salary-components/README.md` - Component system design
