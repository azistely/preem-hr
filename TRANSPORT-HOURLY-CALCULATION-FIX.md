# Transport Hourly Rate Calculation Fix

**Date:** 2025-11-01
**Employee:** Kouadio Yao (ed2f9574-b272-44d8-b86b-2777116694a5)
**Issue:** Transport validation fails in preview mode
**Status:** Solution Identified

---

## Problem Statement

When entering transport allowance as an **hourly rate** in the salary wizard, the preview calculation and validation are failing.

**Employee Details:**
- Payment Frequency: WEEKLY
- Weekly Hours Regime: 40h (8h/day, 5 days/week)
- Contract Type: Not set (being hired)
- City: Abidjan
- Employee Type: LOCAL

**Errors Received:**
```
Error 1: "Component validation failed: Transport 174 FCFA est inférieur au minimum légal de Abidjan (30,000 FCFA)"
Error 2: "L'indemnité de transport (0 FCFA/h = 0 FCFA/mois) est inférieur au minimum légal pour Abidjan (30,000 FCFA)"
```

---

## Root Cause

### Current Behavior:
User enters transport as **hourly rate** (e.g., 200 FCFA/hour), but:
1. Preview doesn't multiply by hours for the payment period
2. Validation compares the hourly rate (200 FCFA) against monthly minimum (30,000 FCFA)

### Expected Behavior:
1. **Calculate transport for payment period**: `hourlyRate × hoursInPeriod`
2. **Validate based on payment frequency**: Don't compare weekly amounts against monthly minimums

---

## Correct Calculation Logic

### Hours Calculation by Payment Frequency

**Based on Weekly Hours Regime:**
- **40h regime**: 40h/week, 8h/day, 173.33h/month
- **48h regime**: 48h/week, 8h/day, 208h/month
- **56h regime**: 56h/week, 8h/day, 242.67h/month

**Formula:**
```typescript
const weeklyHours = parseInt(weeklyHoursRegime.replace('h', '')); // e.g., '40h' → 40
const hoursPerDay = weeklyHours / 5; // Standard 5-day work week
const monthlyHours = (weeklyHours * 52) / 12; // Annual hours ÷ 12 months
```

### Transport Calculation by Payment Frequency

If user enters transport as **hourly rate** (let's say 200 FCFA/h):

| Payment Frequency | Hours in Period | Transport Calculation | Example (200 FCFA/h) |
|-------------------|----------------|----------------------|---------------------|
| **DAILY** | `hoursPerDay` (8h) | 200 × 8 | 1,600 FCFA/day |
| **WEEKLY** | `weeklyHours` (40h) | 200 × 40 | 8,000 FCFA/week |
| **BIWEEKLY** | `weeklyHours × 2` (80h) | 200 × 80 | 16,000 FCFA/2 weeks |
| **MONTHLY** | `monthlyHours` (173.33h) | 200 × 173.33 | 34,666 FCFA/month |

### Validation Logic by Payment Frequency

**Monthly Workers:**
- Must meet monthly minimum (30,000 FCFA for Abidjan)
- Validation: `transportAmount >= monthlyMinimum`

**Non-Monthly Workers (DAILY/WEEKLY/BIWEEKLY):**
- NO monthly minimum validation
- Prorated amounts are legal
- Validation: `transportHourlyRate > 0` (optional: minimum hourly rate if configured)

---

## Required Code Changes

### 1. Preview Calculation (server/routers/payroll.ts)

**Current Code (Lines 516-545):**
```typescript
// Calculate preview for a full month
const previewDate = hireDate >= new Date() ? hireDate : new Date();
const periodStart = new Date(previewDate.getFullYear(), previewDate.getMonth(), 1);
const periodEnd = new Date(previewDate.getFullYear(), previewDate.getMonth() + 1, 0);

// Get weeklyHoursRegime for CDDTI contracts
const weeklyHoursRegime = existingEmployee?.weeklyHoursRegime || '40h';

// Call calculatePayrollV2
const payrollResult = await calculatePayrollV2({
  employeeId: input.employeeId || 'preview',
  // ...
  weeklyHoursRegime,
  daysWorkedThisMonth: rateType === 'DAILY' ? 30 : undefined,
  hoursWorkedThisMonth: rateType === 'HOURLY' ? 30 * 8 : undefined,
  // ...
});
```

**Issue:**
- Uses `rateType` instead of `paymentFrequency`
- Hardcoded to 30 days / 30×8 hours
- Doesn't account for weekly hours regime

**Fix:**
```typescript
// Get weeklyHoursRegime and paymentFrequency
const weeklyHoursRegime = existingEmployee?.weeklyHoursRegime || '40h';
const paymentFrequency = existingEmployee?.paymentFrequency || 'MONTHLY';

// Calculate hours/days based on payment frequency and weekly hours regime
const weeklyHours = parseInt(weeklyHoursRegime.replace('h', ''));
const hoursPerDay = weeklyHours / 5; // Standard 5-day work week
const monthlyHours = (weeklyHours * 52) / 12;

let previewHours: number;
let previewDays: number;

switch (paymentFrequency) {
  case 'DAILY':
    previewHours = hoursPerDay; // e.g., 8h for 40h regime
    previewDays = 1;
    break;
  case 'WEEKLY':
    previewHours = weeklyHours; // e.g., 40h for 40h regime
    previewDays = 5;
    break;
  case 'BIWEEKLY':
    previewHours = weeklyHours * 2; // e.g., 80h for 40h regime
    previewDays = 10;
    break;
  case 'MONTHLY':
  default:
    previewHours = monthlyHours; // e.g., 173.33h for 40h regime
    previewDays = 22;
    break;
}

// Call calculatePayrollV2
const payrollResult = await calculatePayrollV2({
  employeeId: input.employeeId || 'preview',
  countryCode,
  tenantId: ctx.user.tenantId,
  periodStart,
  periodEnd,
  baseSalary: 0,
  customComponents: allComponentsWithMetadata,
  hireDate: periodStart,
  fiscalParts,
  hasFamily,
  sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',
  isPreview: true,
  rateType,
  weeklyHoursRegime,
  paymentFrequency, // NEW: Pass payment frequency
  contractType, // NEW: Pass contract type
  hoursWorkedThisMonth: previewHours, // Calculated based on regime and frequency
  daysWorkedThisMonth: previewDays, // Calculated based on regime and frequency
  maritalStatus,
  dependentChildren,
  isExpat,
});
```

### 2. Component Processor Context (lib/salary-components/component-processor.ts)

**Add to ComponentProcessorContext interface:**
```typescript
export interface ComponentProcessorContext {
  // ... existing fields
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'; // NEW
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h'; // NEW
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'; // NEW
}
```

### 3. Pass Context from Payroll Calculation (features/payroll/services/payroll-calculation-v2.ts)

**Update Line ~543:**
```typescript
const processedComponents = await componentProcessor.processComponents(
  allComponents,
  {
    totalRemuneration,
    baseSalary: input.baseSalary,
    countryCode: input.countryCode,
    city: employeeCity,
    effectiveDate: input.periodStart,
    tenantId: input.tenantId,
    hireDate: input.hireDate,
    yearsOfService: input.yearsOfService,
    isPreview: input.isPreview,
    paymentFrequency: input.paymentFrequency, // NEW
    weeklyHoursRegime: input.weeklyHoursRegime, // NEW
    contractType: input.contractType, // NEW
  }
);
```

### 4. Update Transport Validation (lib/salary-components/component-processor.ts)

**Current Code (Lines 217-232):**
```typescript
if (component.code === '22' && context.city) {
  try {
    const cityMin = await this.getCityTransportMinimum(
      context.countryCode,
      context.city,
      context.effectiveDate
    );

    if (cityMin && component.amount < cityMin.monthlyMinimum) {
      errors.push(
        `Transport ${component.amount.toLocaleString('fr-FR')} FCFA est inférieur au minimum légal de ${context.city} (${cityMin.monthlyMinimum.toLocaleString('fr-FR')} FCFA)`
      );
    }
  } catch (error) {
    console.warn('[TRANSPORT VALIDATION] Could not fetch city minimum:', error);
  }
}
```

**Fix:**
```typescript
if (component.code === '22' && context.city) {
  const isNonMonthlyWorker =
    context.paymentFrequency &&
    ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency);

  if (isNonMonthlyWorker) {
    // For non-monthly workers, skip monthly minimum validation
    // They receive prorated amounts based on hours worked
    console.log(
      `[TRANSPORT VALIDATION] Skipping monthly minimum check for ${context.paymentFrequency} worker - prorated amount is valid`
    );
  } else {
    // Monthly workers - validate against monthly minimum
    try {
      const cityMin = await this.getCityTransportMinimum(
        context.countryCode,
        context.city,
        context.effectiveDate
      );

      if (cityMin && component.amount < cityMin.monthlyMinimum) {
        errors.push(
          `Transport ${component.amount.toLocaleString('fr-FR')} FCFA est inférieur au minimum légal de ${context.city} (${cityMin.monthlyMinimum.toLocaleString('fr-FR')} FCFA)`
        );
      }
    } catch (error) {
      console.warn('[TRANSPORT VALIDATION] Could not fetch city minimum:', error);
    }
  }
}
```

---

## How Transport Hourly Rate Works

### User Entry:
In the salary wizard, user enters transport as an **hourly rate** in the component form:
```
Code: 22 (Transport)
Amount: 200  (FCFA/hour)
```

### Preview Processing:
1. **Component processor receives**: `{ code: '22', amount: 200 }`
2. **NOT multiplied yet** - this is the hourly rate
3. **Payroll calculation multiplies**: `200 × previewHours`
4. **For WEEKLY (40h regime)**: `200 × 40 = 8,000 FCFA`

### Where Multiplication Happens:
The multiplication should happen in the daily workers calculation logic when processing hourly components.

**Check**: `features/payroll/services/daily-workers-calculation.ts`

---

## Test Cases

### Test 1: WEEKLY Worker with 40h Regime
```typescript
Input:
- paymentFrequency: 'WEEKLY'
- weeklyHoursRegime: '40h'
- transport hourly rate: 200 FCFA/h
- city: 'Abidjan'

Expected Calculation:
- Hours for period: 40h
- Transport amount: 200 × 40 = 8,000 FCFA
- Validation: PASS (skip monthly minimum check for weekly workers)

Expected Result:
✅ Preview shows: "Transport: 8,000 FCFA"
✅ No validation error
```

### Test 2: DAILY Worker with 40h Regime
```typescript
Input:
- paymentFrequency: 'DAILY'
- weeklyHoursRegime: '40h'
- transport hourly rate: 200 FCFA/h
- city: 'Abidjan'

Expected Calculation:
- Hours for period: 8h
- Transport amount: 200 × 8 = 1,600 FCFA
- Validation: PASS (skip monthly minimum check)

Expected Result:
✅ Preview shows: "Transport: 1,600 FCFA"
✅ No validation error
```

### Test 3: MONTHLY Worker with 40h Regime
```typescript
Input:
- paymentFrequency: 'MONTHLY'
- weeklyHoursRegime: '40h'
- transport hourly rate: 200 FCFA/h
- city: 'Abidjan'

Expected Calculation:
- Hours for period: 173.33h
- Transport amount: 200 × 173.33 = 34,666 FCFA
- Validation: PASS (34,666 > 30,000 monthly minimum)

Expected Result:
✅ Preview shows: "Transport: 34,666 FCFA"
✅ No validation error
```

### Test 4: MONTHLY Worker - Below Minimum
```typescript
Input:
- paymentFrequency: 'MONTHLY'
- weeklyHoursRegime: '40h'
- transport hourly rate: 100 FCFA/h
- city: 'Abidjan'

Expected Calculation:
- Hours for period: 173.33h
- Transport amount: 100 × 173.33 = 17,333 FCFA
- Validation: FAIL (17,333 < 30,000 monthly minimum)

Expected Result:
❌ Error: "Transport 17,333 FCFA est inférieur au minimum légal de Abidjan (30,000 FCFA)"
```

---

## Implementation Steps

1. ✅ **Update preview calculation** - Calculate hours based on payment frequency and regime
2. ✅ **Pass new fields to calculatePayrollV2** - paymentFrequency, contractType
3. ✅ **Update ComponentProcessorContext** - Add paymentFrequency, weeklyHoursRegime, contractType
4. ✅ **Update component processor call** - Pass new context fields
5. ✅ **Fix transport validation** - Skip monthly minimum for non-monthly workers
6. ✅ **Test with all payment frequencies** - DAILY, WEEKLY, BIWEEKLY, MONTHLY

---

## Summary

**Key Insight:** Transport is entered as an **hourly rate** that needs to be multiplied by the hours in the payment period based on:
1. **Weekly Hours Regime** (40h, 48h, 56h)
2. **Payment Frequency** (DAILY, WEEKLY, BIWEEKLY, MONTHLY)

**Validation Rule:** Only MONTHLY workers are validated against monthly minimums. Non-monthly workers receive prorated amounts and should skip monthly minimum validation.

---

**Document Version:** 1.0
**Author:** Claude Code Analysis
**Status:** Ready for Implementation
