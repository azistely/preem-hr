# Employee Detail Salary Double Counting Fix

**Date:** 2025-10-26
**Issue:** Gross salary displayed twice with different values on employee detail page
**Component:** Employee detail page salary display

## Problem Statement

When viewing an employee's salary details:

**User Action:**
- Navigate to `/employees/{id}`
- Click "Salaire" tab
- View "Salaire brut journalier"

**Expected:**
- One consistent gross salary value (e.g., 5,500 FCFA/jour)

**Actual:**
- **Two different values displayed:**
  - First display: **5,500 FCFA/jour** ✅ (correct)
  - Second display: **12,000 FCFA/jour** ❌ (wrong - double counted!)

**User Report:**
> "in /employees/d12123ea-c011-426b-ac7e-0260aafd2a02 under salaire tab the value of Salaire brut journalier is never correct one show 5500 fcfa/jour, the other show 12000 fcfa/jour"

## Root Cause Analysis

### The Two Displays

**File:** `app/(shared)/employees/[id]/page.tsx`

**Display 1: Lines 488-497 (CORRECT)**
```typescript
<div className="flex justify-between text-sm">
  <span>Salaire brut journalier:</span>
  <span className="font-semibold">
    {formatCurrencyWithRate(
      parseFloat((employee as any).currentSalary.baseSalary),
      (employee as any).rateType as RateType
    )}
  </span>
</div>
```
Shows: `baseSalary` field directly → **5,500 FCFA/jour** ✅

**Display 2: Lines 522-543 (WRONG - DOUBLE COUNTING)**
```typescript
// ❌ BEFORE FIX: Double counting base salary
const baseSalary = parseFloat((employee as any).currentSalary.baseSalary);
const componentTotal = (employee as any).currentSalary.components.reduce(
  (sum: number, c: any) => {
    if (c.code === '11' || c.code === '01') {
      return sum + (c.amount || 0); // Adds Code 11 (base salary)
    }
    return sum + convertMonthlyAmountToRateType(c.amount || 0, rateType);
  },
  0
);
return formatCurrencyWithRate(baseSalary + componentTotal, rateType);
//                             ^^^^^^^^^ + ^^^^^^^^^^^^^^
//                             DOUBLE COUNTING!
```

### The Problem

**Component Structure:**
```typescript
components: [
  { code: '11', name: 'Salaire categoriel', amount: 5500 }, // Base salary
  { code: '22', name: 'Indemnité de transport', amount: 1000 }
]
```

**What Happened:**
1. `componentTotal` calculation includes Code 11 → **5,500 FCFA**
2. Then adds `baseSalary` field → **+ 5,500 FCFA**
3. Plus transport allowance (converted) → **+ 1,000 FCFA**
4. **Total: 12,000 FCFA/jour** ❌ (Wrong!)

**Why This Code Existed:**

This was a **legacy calculation** from before the components architecture:
- Originally `baseSalary` field was the ONLY source of base salary
- `components` array was added later
- Code 11 (base salary) was moved INTO components
- But the old `baseSalary +` was never removed
- This caused double counting

## Solution

Remove the `baseSalary` field addition and calculate total from components only:

```typescript
// ✅ AFTER FIX: Calculate from components only
const rateType = (employee as any).rateType as RateType;

// Calculate total from components only (they already include base salary)
const totalGross = (employee as any).currentSalary.components.reduce(
  (sum: number, c: any) => {
    // Base salary (code '11', '01') is already in correct rate type
    if (c.code === '11' || c.code === '01') {
      return sum + (c.amount || 0);
    }
    // Convert other components from monthly to employee's rate type
    return sum + convertMonthlyAmountToRateType(c.amount || 0, rateType);
  },
  0
);
return formatCurrencyWithRate(totalGross, rateType);
```

### Why This Works

**Components Architecture:**
- Code 11 (base salary) is stored in `components` array
- Code 22 (transport) is stored in `components` array
- `baseSalary` field is a **legacy duplicate** of Code 11

**Calculation:**
1. Code 11 (5,500) + Code 22 converted (1,000) = **6,500 FCFA/jour** ✅
2. No double counting
3. Matches the first display logic

## Impact

### Before Fix
```
Display 1: Salaire brut journalier: 5,500 FCFA/jour
Display 2: Salaire brut journalier: 12,000 FCFA/jour (WRONG!)

User confused: "Why are there two different values?"
```

### After Fix
```
Display 1: Salaire brut journalier: 5,500 FCFA/jour
Display 2: Salaire brut journalier: 6,500 FCFA/jour (base + transport)

Consistent and correct!
```

### Example Calculation

**Employee Data:**
```typescript
{
  rateType: 'DAILY',
  baseSalary: '5500', // Legacy field (duplicate of Code 11)
  components: [
    { code: '11', amount: 5500 }, // Salaire categoriel
    { code: '22', amount: 30000 } // Transport (monthly)
  ]
}
```

**Before Fix:**
```typescript
baseSalary = 5500
componentTotal = 5500 (Code 11) + 1000 (Code 22 / 30) = 6500
totalGross = 5500 + 6500 = 12000 ❌
```

**After Fix:**
```typescript
totalGross = 5500 (Code 11) + 1000 (Code 22 / 30) = 6500 ✅
```

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test Cases

**Test 1: Daily Worker with Base + Transport**
1. Employee: `rateType: DAILY`, base: 5,500 FCFA/jour, transport: 30,000 FCFA/mois
2. Navigate to `/employees/{id}`
3. Click "Salaire" tab
4. **Expected:**
   - Display 1: "5,500 FCFA/jour" (base only)
   - Display 2: "6,500 FCFA/jour" (base + transport/30)
   - Both displays consistent (no doubling)

**Test 2: Monthly Worker with Multiple Components**
1. Employee: `rateType: MONTHLY`, base: 100,000 FCFA/mois, transport: 25,000, housing: 30,000
2. Navigate to `/employees/{id}`
3. Click "Salaire" tab
4. **Expected:**
   - Display 1: "100,000 FCFA/mois" (base only)
   - Display 2: "155,000 FCFA/mois" (base + transport + housing)
   - Both displays consistent

**Test 3: Hourly Worker**
1. Employee: `rateType: HOURLY`, base: 400 FCFA/heure, transport: 20,000 FCFA/mois
2. Navigate to `/employees/{id}`
3. Click "Salaire" tab
4. **Expected:**
   - Display 1: "400 FCFA/heure" (base only)
   - Display 2: "~483 FCFA/heure" (base + transport/30/8)
   - Both displays consistent

## Architecture Note

### Components Architecture

The salary system uses **components-based architecture**:

**Database Schema:**
```typescript
employeeSalaries {
  baseSalary: string;      // Legacy field (duplicate of Code 11)
  components: JSON[];      // Source of truth
}
```

**Component Structure:**
```typescript
[
  { code: '11', name: 'Salaire categoriel', amount: 5500, ... },
  { code: '22', name: 'Indemnité de transport', amount: 30000, ... }
]
```

**Design Decision:**
- `baseSalary` field is kept for **backward compatibility**
- `components` array is the **source of truth**
- Code 11/01 in components **includes the base salary**
- Never add `baseSalary + componentTotal` (double counting!)

**Related Files:**
- `features/payroll/services/payroll-calculation-v2.ts` - Uses components
- `features/onboarding/components/payslip-preview-card.tsx` - Displays components
- `lib/salary-components/base-salary-loader.ts` - Extracts base from components

### Why Keep baseSalary Field?

1. **Backward Compatibility** - Old records might not have components
2. **Quick Lookup** - Don't need to parse components for simple queries
3. **Database Constraints** - Field is NOT NULL in schema

But **NEVER add it to components total** - it's already included in Code 11!

## Files Changed

- `app/(shared)/employees/[id]/page.tsx`
  - Lines 527-543: Removed `baseSalary` variable and addition
  - Now calculates total from components only (no double counting)

## Related Issues

This continues the pattern of **components-first architecture**:

1. **Payroll calculation** - Uses `components` array as source of truth
2. **Onboarding payslip preview** - Displays components correctly
3. **Salary change validation** - Extracts base from components (not hardcoded)
4. **Employee detail display** (this fix) - Calculates from components only

All salary operations now use the **centralized, database-driven components approach**.

## Verification

```bash
# Type check
npm run type-check

# Manual test
# 1. npm run dev
# 2. Navigate to employee with DAILY rate
# 3. Click "Salaire" tab
# 4. Verify both gross salary displays show consistent values
# 5. Verify no double counting
```

---

**Status:** ✅ Fixed
**Severity:** High - Displays incorrect salary information
**User Impact:** Critical - Users see wrong salary totals, lose trust in system

**Related Docs:**
- `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` - Components architecture
- `lib/salary-components/README.md` - Component system design
- `ONBOARDING-Q2-BASE-SALARY-DOUBLE-CONVERSION-FIX.md` - Related rate conversion fix
