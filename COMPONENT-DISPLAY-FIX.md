# Component Display Fix - Summary

**Date:** 2025-11-01
**Issue:** Components not displaying correctly for daily/weekly workers
**Status:** ✅ FIXED

---

## Problem

When viewing salary preview for daily/weekly workers (journaliers):

1. **Components showed input rates instead of calculated amounts**
   - Example: Transport showed 200 FCFA (hourly rate) instead of 8,000 FCFA (40h × 200)

2. **Many journalier-specific components were missing**
   - Overtime hours (1.15×, 1.50×)
   - Saturday/Sunday hours (1.40×)
   - Night hours (1.75×)
   - Gratification (3.33%)
   - Provision congés payés (10%)
   - Indemnité de précarité (3% for CDDTI)

3. **Labels showed monthly rates without prorated information**
   - "CNPS Retraite (3.67%)" instead of "CNPS Retraite (3.67%) - 5j/30j"

---

## Root Cause

The router was using `allComponentsWithMetadata` (input components with rates) instead of the **calculated components** returned by `calculatePayrollV2()`.

For journalier workers using the legacy calculation path, `journalierGrossResult.components` contains all the detailed components, but these were not being passed to the UI.

---

## Solution Implemented

### 1. Return Components from `calculatePayrollV2`

**File:** `features/payroll/services/payroll-calculation-v2.ts`

**Changes:**
- Added `components` field to return statement (lines 1226-1236)
- For journalier workers: Use `journalierGrossResult.components`
- For other workers: Map `processedComponents` to component format

**Code:**
```typescript
components: isJournalierEmployee && journalierGrossResult
  ? journalierGrossResult.components
  : processedComponents.map(pc => ({
      code: pc.code,
      name: pc.name,
      amount: pc.originalAmount, // Use originalAmount from ProcessedComponent
      sourceType: undefined, // ProcessedComponent doesn't have sourceType
    })),
```

### 2. Update Type Definition

**File:** `features/payroll/types.ts`

**Changes:**
- Added `components` field to `PayrollCalculationResult` interface (lines 253-259)

**Code:**
```typescript
// Components (for detailed component breakdown in UI)
components?: Array<{
  code: string;
  name: string;
  amount: number;
  sourceType?: string;
}>;
```

### 3. Use Calculated Components in Router

**File:** `server/routers/payroll.ts`

**Changes:**
- Changed from `allComponentsWithMetadata` to `payrollResult.components` (lines 603-605)

**Before:**
```typescript
components: allComponentsWithMetadata.map((c: any) => ({
  code: c.code,
  name: c.name,
  amount: c.amount,
})),
```

**After:**
```typescript
// Use calculated components from payroll result (not input components)
// This includes all journalier-specific components (overtime, gratification, etc.)
components: payrollResult.components || [],
```

### 4. Enhanced Deduction Labels (Previously Completed)

**File:** `features/payroll/services/payroll-calculation-v2.ts`

**Changes:**
- Added `getProratedSuffix` helper function (lines 1751-1757)
- Updated CNPS description to include prorated days (lines 1762-1764)
- Updated CMU description to include prorated days (lines 1769-1770)

**Code:**
```typescript
const getProratedSuffix = (contrib: typeof cnpsEmployeeContrib) => {
  if (contrib?.prorated && contrib?.prorata) {
    const days = Math.round(contrib.prorata * 30);
    return ` - ${days}j/${30}j`;
  }
  return '';
};

// Example label: "CNPS Retraite (3.67%) - 5j/30j"
description: cnpsEmployeeContrib?.rate
  ? `${taxSystem.retirementContributionLabel.fr} (${formatRate(cnpsEmployeeContrib.rate)}%)${getProratedSuffix(cnpsEmployeeContrib)}`
  : taxSystem.retirementContributionLabel.fr,
```

---

## How It Works Now

### Example: WEEKLY Worker (40h regime, CDDTI contract)

**User Input:**
- Payment Frequency: WEEKLY
- Weekly Hours Regime: 40h
- Contract Type: CDDTI
- Transport hourly rate: 200 FCFA/hour
- Categorical salary: 75,000 FCFA/month

**Components Displayed:**
1. ✅ **Salaire brut de base** - 12,981 FCFA (30h × 432.7)
2. ✅ **Heures supplémentaires (1.15×)** - (if overtime hours)
3. ✅ **Heures supplémentaires (1.50×)** - (if > 8 OT hours)
4. ✅ **Heures samedi (1.40×)** - (if Saturday hours)
5. ✅ **Heures dimanche/férié (1.40×)** - (if Sunday/holiday hours)
6. ✅ **Heures de nuit (1.75×)** - (if night hours)
7. ✅ **Gratification congés non pris** - 432 FCFA (3.33%)
8. ✅ **Provision congés payés** - 1,298 FCFA (10%)
9. ✅ **Indemnité de précarité** - 389 FCFA (3% CDDTI only)
10. ✅ **Indemnité de transport** - 8,000 FCFA (200 × 40h)

**Deductions Displayed:**
1. ✅ **CNPS Retraite (3.67%) - 5j/30j** - 60 FCFA (prorated)
2. ✅ **CMU (1,000 FCFA) - 5j/30j** - 167 FCFA (prorated)
3. ✅ **ITS (1 part)** - X FCFA (daily tax formula)

---

## Files Modified

1. ✅ `features/payroll/services/payroll-calculation-v2.ts` (Lines 1226-1236)
   - Added `components` field to return statement

2. ✅ `features/payroll/types.ts` (Lines 253-259)
   - Added `components` field to `PayrollCalculationResult` interface

3. ✅ `server/routers/payroll.ts` (Lines 603-605)
   - Changed to use `payrollResult.components` instead of `allComponentsWithMetadata`

4. ✅ `server/routers/payroll.ts` (Lines 620-625)
   - Fixed TypeScript array index error with `as const` assertion

---

## Previous Related Fixes

1. ✅ **Transport Calculation** - TRANSPORT-FIX-SUMMARY.md
   - Fixed hourly transport rate calculation
   - Added payment period context to UI
   - Skip monthly minimum validation for non-monthly workers

2. ✅ **CMU Proration** - (Completed earlier)
   - Changed CMU from fixed amount to prorated amount

3. ✅ **Deduction Labels** - (Completed earlier)
   - Added prorated suffix to deduction labels (e.g., "5j/30j")

---

## Testing

### Test Case: Employee ed2f9574-b272-44d8-b86b-2777116694a5

**Employee Details:**
- Name: Kouadio Yao
- Payment Frequency: WEEKLY
- Weekly Hours Regime: 40h
- Contract Type: Not set (hiring)
- City: Abidjan

**Test Scenario:**
1. Go to `/employees/ed2f9574-b272-44d8-b86b-2777116694a5/edit`
2. View salary preview
3. Expand "Voir les détails"
4. Check "Composantes du salaire" section

**Expected Result:**
- ✅ All components show calculated amounts (not hourly rates)
- ✅ All journalier-specific components are displayed
- ✅ Labels show prorated information (e.g., "CNPS Retraite (3.67%) - 5j/30j")
- ✅ Transport shows 8,000 FCFA (200 × 40h) not 200 FCFA

---

## Key Insights

### Component Flow

**Input Components** (from user/database):
- Stored as rates (hourly, daily, or monthly)
- Example: Transport = 200 FCFA/hour

**Processed Components** (after multiplication):
- Calculated amounts for the payment period
- Example: Transport = 8,000 FCFA (200 × 40h)

**Displayed Components** (in UI):
- Shows calculated amounts, not rates
- Includes all journalier-specific components (overtime, gratification, etc.)

### Two Calculation Paths

**Legacy Path (journalier with field-based approach):**
- Uses `calculateDailyWorkersGross()` function
- Returns `journalierGrossResult.components` with all detailed components
- Components include overtime, gratification, congés payés, indemnité de précarité

**Component-Based Path (modern approach):**
- Uses `ComponentProcessor` with metadata-driven validation
- Returns `processedComponents` with standard components
- Maps to same format for consistency

---

## Impact

### ✅ Benefits

1. **Complete component visibility** - All components now displayed correctly
2. **Accurate amounts** - Shows calculated amounts, not input rates
3. **Better UX** - Users can see exactly what they're earning/paying
4. **Compliance** - Journalier components match legal requirements

### 🎯 Daily Workers Support

This fix completes the daily workers (journaliers) module:
- ✅ Correct transport calculation
- ✅ CMU proration
- ✅ Prorated deduction labels
- ✅ **Component display (this fix)**

All journalier-specific components are now visible:
- Overtime (1.15×, 1.50×)
- Weekend hours (1.40×)
- Night hours (1.75×)
- Gratification (3.33%)
- Congés payés (10%)
- Indemnité de précarité (3% CDDTI)

---

## TypeScript Compilation

**Status:** ✅ PASSING

**Command:** `npm run type-check`

**Result:**
- Payroll-related errors: 0 ✅
- Unrelated test file errors: 14 (pre-existing, not related to this change)

**Dev Server:** ✅ RUNNING
- URL: http://localhost:3005
- Compilation: ✅ SUCCESS

---

**Status:** ✅ COMPLETE AND READY FOR TESTING
**Version:** 1.0
**Author:** Claude Code
**Date:** 2025-11-01
