# Onboarding Q2 Base Salary Double Conversion Fix

**Date:** 2025-10-26
**Issue:** Base salary showing incorrect daily rate (167 FCFA/jour instead of 5,000 FCFA/jour)
**Component:** Payslip preview card detailed breakdown

## Problem Statement

In the onboarding Q2 payslip preview, the detailed breakdown showed **incorrect base salary**:

**User Input:**
- Daily rate: 5,000 FCFA/jour
- Transport allowance: 30,000 FCFA/month

**Display (BEFORE FIX):**
```
Composantes du salaire brut:
Salaire de base: 167 FCFA/jour    ❌ WRONG!
Indemnité de transport: 1,000 FCFA/jour ✅
```

**Expected:**
```
Salaire de base: 5,000 FCFA/jour  ✅
Indemnité de transport: 1,000 FCFA/jour ✅
```

**User Report:**
> "salaire de base is again divided by 30"

## Root Cause Analysis

### The Data Flow

**Backend (calculatePayrollV2):**
```typescript
// Input for daily worker
input.baseSalary = 5000 (daily rate)
input.rateType = 'DAILY'
input.daysWorkedThisMonth = 30

// Calculation
effectiveBaseSalary = 5000 × 30 = 150,000 (monthly total)
grossSalary = 150,000 + allowances

// Return values
return {
  baseSalary: input.baseSalary,  // ⚠️ Returns ORIGINAL input (5,000)
  grossSalary: 180,000,           // ✅ Returns monthly total
  netSalary: 176,893,             // ✅ Returns monthly total
  cnpsEmployee: 11,340,           // ✅ Returns monthly total
  // ...
}
```

**Key Discovery:** `baseSalary` field is returned **unchanged** from input (line 856 in payroll-calculation-v2.ts), while all other fields return **monthly totals**.

**Frontend (PayslipPreviewCard):**
```typescript
// BEFORE FIX: Applied conversion to ALL fields
convertMonthlyToRate(payslip.baseSalary)  // 5,000 ÷ 30 = 167 ❌
convertMonthlyToRate(payslip.grossSalary) // 180,000 ÷ 30 = 6,000 ✅
convertMonthlyToRate(payslip.netSalary)   // 176,893 ÷ 30 = 5,893 ✅
```

### Why This Happens

`calculatePayrollV2` returns fields with **mixed semantics**:

| Field | For MONTHLY | For DAILY | For HOURLY |
|-------|-------------|-----------|------------|
| `baseSalary` | Monthly rate | **Daily rate** | **Hourly rate** |
| `grossSalary` | Monthly total | Monthly total | Monthly total |
| `netSalary` | Monthly total | Monthly total | Monthly total |
| `cnpsEmployee` | Monthly total | Monthly total | Monthly total |
| `cnpsEmployer` | Monthly total | Monthly total | Monthly total |

**Reason:** `baseSalary` is used for **rate display** (what the user entered), while other fields are used for **payroll calculations** (period totals).

## Solution

### Code Changes

**File:** `features/onboarding/components/payslip-preview-card.tsx`

**Change 1: Add new helper for baseSalary (lines 75-78)**

```typescript
// baseSalary is returned as-is from input, so format without conversion
const formatBaseSalary = (amount: number | undefined): string => {
  return formatCurrencyWithRate(amount ?? 0, rateType as RateType);
};
```

**Change 2: Update baseSalary display (line 154)**

```typescript
// BEFORE:
<span>{formatWithRate(convertMonthlyToRate(payslip.baseSalary))}</span>

// AFTER:
<span>{formatBaseSalary(payslip.baseSalary)}</span>
```

**Change 3: Update comment to document the inconsistency (lines 66-73)**

```typescript
// IMPORTANT: calculatePayrollV2 returns MONTHLY totals for SOME fields but NOT ALL
// - grossSalary, netSalary, deductions: MONTHLY totals (need conversion)
// - baseSalary: ORIGINAL input rate (already daily/hourly, NO conversion needed!)
// We need to convert monthly totals back to per-day/per-hour rates for display
```

## Impact

### Display Correctness

**After Fix:**
```
Composantes du salaire brut:
Salaire de base: 5,000 FCFA/jour         ✅ (no conversion)
Indemnité de transport: 1,000 FCFA/jour  ✅ (30,000 ÷ 30)
```

### Rate Type Coverage

| Rate Type | Input | Display |
|-----------|-------|---------|
| MONTHLY | 150,000 | 150,000 FCFA/mois |
| DAILY | 5,000 | 5,000 FCFA/jour |
| HOURLY | 625 | 625 FCFA/heure |

All rate types now display correctly without double conversion.

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test

**Test 1: Daily Worker**
1. Navigate to `/onboarding/q2`
2. Set rate type: DAILY
3. Set daily base: 5,000 FCFA/jour
4. Add transport: 30,000 FCFA (monthly)
5. Preview payslip
6. Expand "Voir les détails"
7. **Expected:**
   - Salaire de base: `5,000 FCFA/jour` (no conversion)
   - Indemnité de transport: `1,000 FCFA/jour` (converted from monthly)

**Test 2: Hourly Worker**
1. Set rate type: HOURLY
2. Set hourly base: 625 FCFA/heure
3. Add transport: 30,000 FCFA (monthly)
4. Preview payslip
5. Expand "Voir les détails"
6. **Expected:**
   - Salaire de base: `625 FCFA/heure` (no conversion)
   - Indemnité de transport: `125 FCFA/heure` (converted from monthly)

**Test 3: Monthly Worker (Regression)**
1. Set rate type: MONTHLY
2. Set monthly base: 150,000 FCFA
3. Add transport: 30,000 FCFA
4. Preview payslip
5. Expand "Voir les détails"
6. **Expected:**
   - Salaire de base: `150,000 FCFA/mois` (no conversion)
   - Indemnité de transport: `30,000 FCFA/mois` (no conversion)

## Architecture Note

### Why Backend Returns Mixed Semantics

This is **intentional design** in `calculatePayrollV2`:

1. **`baseSalary`** = What the user configured (rate display)
   - Used for: Employee records, rate comparisons, reports
   - Semantics: Per-unit rate (daily/hourly) or monthly amount

2. **`grossSalary`, `netSalary`, deductions** = Payroll calculation results (period totals)
   - Used for: Bank transfers, tax filings, financial reports
   - Semantics: Always monthly totals (even for daily/hourly workers)

This separation is correct! Don't change backend.

### Frontend Responsibility

The frontend must **know which fields need conversion**:
- ✅ Convert: `grossSalary`, `netSalary`, `cnpsEmployee`, `its`, `cnpsEmployer`, etc.
- ❌ Don't convert: `baseSalary` (already in correct rate)

## Related Fixes

This is the **fifth fix** in the onboarding Q2 flow:

1. **Preview mode fix** (724e8f0) - Component validation
2. **Backend calculation fix** (5326733) - Rate type support
3. **Timeout fix** (352a641) - Transaction optimization
4. **Deduction display fix** (401c804) - Convert deductions to rates
5. **Base salary double conversion fix** (this) ← **NEW**

All five fixes are now complete!

## Files Changed

- `features/onboarding/components/payslip-preview-card.tsx`
  - Added `formatBaseSalary()` helper (lines 75-78)
  - Updated baseSalary display (line 154)
  - Updated comments (lines 66-73)

## Verification

```bash
# Type check
npm run type-check

# Manual test
# 1. npm run dev
# 2. Navigate to /onboarding/q2
# 3. Test daily worker: 5,000 FCFA/jour
# 4. Verify breakdown shows 5,000 (not 167)
# 5. Test hourly worker: 625 FCFA/heure
# 6. Verify breakdown shows 625 (not 26)
```

---

**Status:** ✅ Fixed
**Severity:** High - Completely breaks trust for daily/hourly workers
**User Impact:** Critical - Users think the system is broken

**Related Docs:**
- `ONBOARDING-Q2-DAILY-RATE-FIX.md` - Original rate type support
- `ONBOARDING-Q2-DEDUCTION-DISPLAY-FIX.md` - Deduction conversion
- `ONBOARDING-Q2-EMPLOYEE-CREATION-TIMEOUT-FIX.md` - Timeout fix
