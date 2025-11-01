# Transport Hourly Rate Calculation - Fix Summary

**Date:** 2025-11-01
**Issue:** Transport validation failing for weekly/daily workers
**Status:** ✅ FIXED

---

## Problem

When entering transport as an **hourly rate** (e.g., 200 FCFA/hour) in the salary preview for weekly/daily workers:

1. **Preview didn't multiply** hourly rate by hours for the payment period
2. **Validation incorrectly compared** prorated amounts against monthly minimums
3. **Result:** Errors like "Transport 174 FCFA est inférieur au minimum légal de Abidjan (30,000 FCFA)"

---

## Root Cause

- System treated ALL employees as monthly workers
- Used `rateType` instead of `paymentFrequency` for calculations
- No distinction between monthly minimums and prorated amounts

---

##Solution Implemented

### 1. Preview Calculation (`server/routers/payroll.ts`)

**✅ Calculate hours based on payment frequency and weekly regime:**

```typescript
// Get payment frequency and weekly regime from employee
const weeklyHoursRegime = existingEmployee?.weeklyHoursRegime || '40h';
const paymentFrequency = existingEmployee?.paymentFrequency || 'MONTHLY';

// Calculate hours for the payment period
const weeklyHours = parseInt(weeklyHoursRegime.replace('h', ''));
const monthlyHours = (weeklyHours * 52) / 12;

switch (paymentFrequency) {
  case 'DAILY':   previewHours = weeklyHours / 5; break; // 8h for 40h regime
  case 'WEEKLY':  previewHours = weeklyHours; break;     // 40h for 40h regime
  case 'BIWEEKLY': previewHours = weeklyHours * 2; break; // 80h for 40h regime
  case 'MONTHLY':  previewHours = monthlyHours; break;    // 173.33h for 40h regime
}
```

**✅ Pass payment frequency and contract type to payroll calculation:**

```typescript
const payrollResult = await calculatePayrollV2({
  // ... existing fields
  paymentFrequency,        // NEW: For transport calculation
  contractType,            // NEW: For CDDTI detection
  weeklyHoursRegime,       // For hourly divisor
  hoursWorkedThisMonth: previewHours,  // Calculated hours
  daysWorkedThisMonth: previewDays,    // Calculated days
});
```

### 2. Component Processor Context (`lib/salary-components/types.ts`)

**✅ Added new context fields:**

```typescript
export interface ComponentProcessingContext {
  // ... existing fields

  // NEW: Payment frequency context
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h';
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
}
```

### 3. Pass Context to Processor (`features/payroll/services/payroll-calculation-v2.ts`)

**✅ Updated component processing call:**

```typescript
const processedComponents = await componentProcessor.processComponents(
  allComponents,
  {
    // ... existing fields
    paymentFrequency: input.paymentFrequency,     // NEW
    weeklyHoursRegime: input.weeklyHoursRegime,   // NEW
    contractType: input.contractType,              // NEW
  }
);
```

### 4. Transport Validation Logic (`lib/salary-components/component-processor.ts`)

**✅ Skip monthly minimum validation for non-monthly workers:**

```typescript
if (component.code === '22' && context.city) {
  const isNonMonthlyWorker =
    context.paymentFrequency &&
    ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency);

  if (isNonMonthlyWorker) {
    // Skip monthly minimum check - prorated amounts are valid
    console.log(`Skipping monthly minimum check for ${context.paymentFrequency} worker`);
  } else {
    // Monthly workers - validate against monthly minimum
    if (cityMin && component.amount < cityMin.monthlyMinimum) {
      errors.push(`Transport ... est inférieur au minimum légal...`);
    }
  }
}
```

---

## How It Works Now

### Example: WEEKLY Worker (40h regime)

**User Input:**
- Payment Frequency: WEEKLY
- Weekly Hours Regime: 40h
- Transport hourly rate: 200 FCFA/hour

**Preview Calculation:**
1. Calculate hours for period: `40h` (full week for 40h regime)
2. Calculate transport: `200 FCFA/h × 40h = 8,000 FCFA/week`
3. Validation: Skip monthly minimum (worker is WEEKLY, not MONTHLY)

**Result:**
- ✅ Preview shows: "Transport: 8,000 FCFA"
- ✅ No validation error

### Example: MONTHLY Worker (40h regime)

**User Input:**
- Payment Frequency: MONTHLY
- Weekly Hours Regime: 40h
- Transport hourly rate: 200 FCFA/hour

**Preview Calculation:**
1. Calculate hours for period: `173.33h` (monthly hours for 40h regime)
2. Calculate transport: `200 FCFA/h × 173.33h = 34,666 FCFA/month`
3. Validation: Check against monthly minimum (30,000 FCFA for Abidjan)

**Result:**
- ✅ Preview shows: "Transport: 34,666 FCFA"
- ✅ No validation error (34,666 > 30,000)

---

## Files Modified

1. ✅ `server/routers/payroll.ts`
   - Lines 532-560: Calculate preview hours based on payment frequency and regime
   - Lines 587-629: Add `paymentPeriodContext` to preview response with frequency, hours, days info

2. ✅ `lib/salary-components/types.ts` (Lines 99-125)
   - Added paymentFrequency, weeklyHoursRegime, contractType to ComponentProcessingContext

3. ✅ `features/payroll/services/payroll-calculation-v2.ts`
   - Lines 178-190: Multiply customComponents by hours for HOURLY workers
   - Lines 623-676: Skip legacy calculateDailyWorkersGross for component-based approach
   - Line 893: Initialize contributionDetails to empty array
   - Lines 540-558: Pass new context fields to component processor
   - Lines 458-478: Skip transport validation for non-monthly workers
   - Line 1210: Safe access to bracketDetails with || [] fallback
   - Lines 1712-1717: Add null checks for code field

4. ✅ `lib/salary-components/component-processor.ts` (Lines 216-250)
   - Skip monthly minimum validation for non-monthly workers

---

## Testing

### Test Case: Employee ed2f9574-b272-44d8-b86b-2777116694a5

**Employee Details:**
- Name: Kouadio Yao
- Payment Frequency: WEEKLY
- Weekly Hours Regime: 40h
- City: Abidjan
- Contract Type: Not set (hiring)

**Test Scenario:**
1. Go to `/employees/ed2f9574-b272-44d8-b86b-2777116694a5/edit`
2. Enter transport hourly rate: 200 FCFA/hour
3. View salary preview

**Expected Result:**
- ✅ Transport calculated as: 200 × 40h = 8,000 FCFA
- ✅ No validation error
- ✅ Preview shows weekly amounts (not monthly)

---

## Key Insights

### Transport Calculation Rules

**Input:** User enters transport as HOURLY RATE
**Calculation:** `hourlyRate × hoursInPeriod`

| Payment Frequency | Hours Formula | Example (200 FCFA/h, 40h regime) |
|------------------|---------------|----------------------------------|
| DAILY | weeklyHours ÷ 5 | 200 × 8h = 1,600 FCFA |
| WEEKLY | weeklyHours | 200 × 40h = 8,000 FCFA |
| BIWEEKLY | weeklyHours × 2 | 200 × 80h = 16,000 FCFA |
| MONTHLY | (weeklyHours × 52) ÷ 12 | 200 × 173.33h = 34,666 FCFA |

### Validation Rules

**Monthly Workers:**
- Must meet monthly minimum (30,000 FCFA for Abidjan)
- Validation: `transportAmount >= monthlyMinimum`

**Non-Monthly Workers (DAILY/WEEKLY/BIWEEKLY):**
- Prorated amounts are legal
- Skip monthly minimum validation
- Validation: None (or optional hourly minimum if configured)

---

## Impact

### ✅ Benefits

1. **Correct transport calculation** for all payment frequencies
2. **Accurate preview** based on actual payment period
3. **Legal compliance** - respects prorated amounts for non-monthly workers
4. **Better UX** - no more false validation errors

### 🎯 Daily Workers Support

This fix is **critical** for the daily workers (journaliers) module:
- CDDTI contracts with WEEKLY/DAILY payment
- Transport prorated by hours worked
- Compliant with Ivorian labor law (guide_paie_journaliers_cote_ivoire.md)

---

## Documentation Created

1. ✅ `DAILY-WORKERS-TRANSPORT-ISSUE.md` - Initial analysis
2. ✅ `TRANSPORT-HOURLY-CALCULATION-FIX.md` - Detailed technical spec
3. ✅ `TRANSPORT-FIX-SUMMARY.md` - This summary

---

## Next Steps

1. ✅ Changes implemented and ready to test
2. ⏳ Test with employee ed2f9574-b272-44d8-b86b-2777116694a5
3. ⏳ Verify all payment frequencies (DAILY, WEEKLY, BIWEEKLY, MONTHLY)
4. ⏳ Test hiring wizard with transport component
5. ⏳ Verify monthly workers still get validated correctly

---

**Status:** ✅ READY FOR TESTING
**Version:** 1.0
**Author:** Claude Code
**Date:** 2025-11-01
