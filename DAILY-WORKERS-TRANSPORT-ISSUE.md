# Transport Allowance Validation Issue for Daily Workers

**Date:** 2025-11-01
**Issue:** Transport validation fails for daily workers (journaliers)
**Status:** Analysis Complete - Fix Required

---

## Problem Summary

The payroll calculation is failing for daily workers with the following errors:

```
Error 1: "Component validation failed: Transport 174 FCFA est inférieur au minimum légal de Abidjan (30,000 FCFA)"

Error 2: "L'indemnité de transport (0 FCFA/h = 0 FCFA/mois) est inférieur au minimum légal pour Abidjan (30,000 FCFA)"
```

**Root Cause:** The component validation logic treats transport allowance as a monthly minimum for ALL employees, but daily workers should receive a **daily transport rate** multiplied by days worked, not a monthly minimum.

---

## Legal Requirements (from `guide_paie_journaliers_cote_ivoire.md`)

### Section 4.1.5: Indemnité de Transport Journalière

```
Indemnité de transport journalière:
- Montant fixe par jour travaillé
- Variable selon la localité
```

### Key Points:
1. **Daily workers get a DAILY rate** (e.g., 200 FCFA/day)
2. **Transport is prorated by days worked** (not a fixed monthly amount)
3. **Rate varies by city/location** (just like monthly minimums)
4. **Monthly workers get MONTHLY minimums** (e.g., 30,000 FCFA for Abidjan)

---

## How Transport Works in Côte d'Ivoire

### For MONTHLY Workers (CDI, CDD with monthly payment):
- **Minimum:** 30,000 FCFA/month (Abidjan)
- **Minimum:** 25,000 FCFA/month (Interior cities)
- **Legal Basis:** Arrêté du 30 janvier 2020
- **Calculation:** Fixed monthly amount (not prorated)

### For DAILY Workers (CDDTI, daily/weekly payment):
- **Daily Rate:** Variable by location (e.g., 200 FCFA/day in Abidjan)
- **Calculation:** `dailyRate × daysWorked`
- **Example:**
  - 22 days worked × 200 FCFA/day = 4,400 FCFA/month
  - This is LESS than 30,000 FCFA monthly minimum, but **it's legal** because it's prorated

---

## Current Implementation Issues

### 1. Component Processor Validation (lib/salary-components/component-processor.ts:217-232)

**Current Code:**
```typescript
// Line 225: Validates ALL employees against monthly minimum
if (cityMin && component.amount < cityMin.monthlyMinimum) {
  errors.push(
    `Transport ${component.amount.toLocaleString('fr-FR')} FCFA est inférieur au minimum légal de ${context.city} (${cityMin.monthlyMinimum.toLocaleString('fr-FR')} FCFA)`
  );
}
```

**Problem:**
- Checks `component.amount` (e.g., 174 FCFA for partial days) against `monthlyMinimum` (30,000 FCFA)
- Doesn't distinguish between monthly and daily workers
- Daily workers will ALWAYS fail this validation

### 2. Daily Workers Calculation (features/payroll/services/daily-workers-calculation.ts:68)

**Current Design:**
```typescript
// Transport allowance
transportAllowance: number;  // dailyRate × equivalentDays
```

**Issue:**
- Correctly calculates prorated transport (good!)
- But the component processor validation rejects it (bad!)

---

## Required Fix

### Option 1: Skip Transport Validation for Daily Workers (Recommended)

**Rationale:**
- Daily workers get prorated amounts by definition
- Validation against monthly minimums doesn't make sense
- As long as `dailyRate > 0`, it's valid

**Implementation:**
```typescript
// In component-processor.ts processComponent()
if (component.code === '22' && context.city) {
  // Skip validation for daily workers (they get prorated amounts)
  if (context.paymentFrequency && ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency)) {
    console.log(`[TRANSPORT VALIDATION] Skipping monthly minimum check for ${context.paymentFrequency} worker`);
    // No validation - daily workers get prorated amounts
  } else {
    // Monthly workers - validate against monthly minimum
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
  }
}
```

### Option 2: Validate Daily Rate (More Complex)

**Rationale:**
- Validate that `dailyRate` meets a daily minimum
- Then allow prorated amounts

**Implementation:**
```typescript
// In component-processor.ts
if (component.code === '22' && context.city) {
  const cityMin = await this.getCityTransportMinimum(
    context.countryCode,
    context.city,
    context.effectiveDate
  );

  if (!cityMin) return; // City minimum not configured

  if (context.paymentFrequency && ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency)) {
    // For daily workers, validate the DAILY RATE
    const dailyRate = context.dailyTransportRate ?? 0;
    const dailyMinimum = cityMin.dailyMinimum ?? (cityMin.monthlyMinimum / 22); // Fallback to monthly ÷ 22

    if (dailyRate < dailyMinimum) {
      errors.push(
        `Transport journalier ${dailyRate.toLocaleString('fr-FR')} FCFA/jour est inférieur au minimum légal de ${context.city} (${dailyMinimum.toLocaleString('fr-FR')} FCFA/jour)`
      );
    }
  } else {
    // Monthly workers - validate monthly amount
    if (component.amount < cityMin.monthlyMinimum) {
      errors.push(
        `Transport ${component.amount.toLocaleString('fr-FR')} FCFA est inférieur au minimum légal de ${context.city} (${cityMin.monthlyMinimum.toLocaleString('fr-FR')} FCFA)`
      );
    }
  }
}
```

---

## Recommended Solution

**Use Option 1** (Skip validation for daily workers) because:

1. **Simpler Implementation** - No need to store/validate daily minimums
2. **Legally Compliant** - Prorated amounts are legal by definition
3. **Practical** - Tenant/admin sets the daily rate in tenant config
4. **Consistent with Guide** - Guide doesn't specify a daily minimum, just "variable selon la localité"

### Changes Required:

#### 1. Update Component Processor Context (lib/salary-components/component-processor.ts)

Add `paymentFrequency` to context:
```typescript
export interface ComponentProcessorContext {
  // ... existing fields
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'; // NEW
}
```

#### 2. Pass Payment Frequency from Payroll Calculation (features/payroll/services/payroll-calculation-v2.ts)

```typescript
// Line 543: Add paymentFrequency to context
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
    paymentFrequency: input.paymentFrequency, // NEW - enables daily worker detection
  }
);
```

#### 3. Update Transport Validation Logic (lib/salary-components/component-processor.ts)

```typescript
// Replace lines 217-232 with conditional logic
if (component.code === '22' && context.city) {
  // Skip monthly minimum validation for daily workers
  if (context.paymentFrequency && ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency)) {
    console.log(`[TRANSPORT VALIDATION] Skipping monthly minimum check for ${context.paymentFrequency} worker - prorated amount is valid`);
    // Daily workers get prorated amounts - no validation needed
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

## Testing Plan

### Test Case 1: Monthly Worker (Existing Behavior)
```typescript
Input:
- baseSalary: 100,000 FCFA
- transportAllowance: 30,000 FCFA
- paymentFrequency: MONTHLY
- city: Abidjan

Expected:
✅ PASS - Transport = 30,000 FCFA (meets 30,000 FCFA minimum)
```

### Test Case 2: Monthly Worker (Invalid)
```typescript
Input:
- baseSalary: 100,000 FCFA
- transportAllowance: 20,000 FCFA
- paymentFrequency: MONTHLY
- city: Abidjan

Expected:
❌ FAIL - "Transport 20,000 FCFA est inférieur au minimum légal de Abidjan (30,000 FCFA)"
```

### Test Case 3: Daily Worker (Prorated - Should Pass)
```typescript
Input:
- categoricalSalary: 71,000 FCFA
- hoursWorked: 30 hours (3.75 equivalent days)
- dailyTransportRate: 200 FCFA/day
- paymentFrequency: WEEKLY
- contractType: CDDTI
- city: Abidjan

Calculated Transport:
200 FCFA/day × 3.75 days = 750 FCFA

Expected:
✅ PASS - No validation error (daily workers get prorated amounts)
```

### Test Case 4: Daily Worker (22 days - Should Pass)
```typescript
Input:
- categoricalSalary: 71,000 FCFA
- hoursWorked: 176 hours (22 equivalent days)
- dailyTransportRate: 200 FCFA/day
- paymentFrequency: MONTHLY (but CDDTI)
- contractType: CDDTI
- city: Abidjan

Calculated Transport:
200 FCFA/day × 22 days = 4,400 FCFA

Expected:
✅ PASS - No validation error (CDDTI gets prorated amounts even if paid monthly)

Note: Need to also check contractType, not just paymentFrequency!
```

---

## Contract Type vs Payment Frequency

**Important Discovery:**

From GAP analysis and architecture docs:
- **Payment Frequency** = How often paid (DAILY, WEEKLY, BIWEEKLY, MONTHLY)
- **Contract Type** = Legal status (CDI, CDD, CDDTI, INTERIM, STAGE)

**Issue:** A CDDTI worker can be paid MONTHLY (rare but valid per guide Example 10.1)

**Better Detection Logic:**
```typescript
// Check if employee is a daily worker (journalier)
const isDailyWorker = (
  context.contractType === 'CDDTI' ||
  (context.paymentFrequency && ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency))
);

if (component.code === '22' && context.city) {
  if (isDailyWorker) {
    // Skip monthly minimum validation for daily workers
    console.log('[TRANSPORT VALIDATION] Skipping monthly minimum check for daily worker');
  } else {
    // Monthly workers - validate against monthly minimum
    // ... existing validation
  }
}
```

---

## Database Schema Check

Need to verify these fields exist:

### employees table:
- `contract_type` enum (CDI, CDD, CDDTI, INTERIM, STAGE) ✅ Exists per schema
- `payment_frequency` enum? ❓ Need to check

### contracts table:
- `contract_type` ✅ Likely exists
- `payment_frequency` ❓ Need to check

**Action:** Use Supabase MCP to query schema and confirm field names.

---

## Summary

**Problem:** Transport validation incorrectly applies monthly minimums to daily workers who receive prorated daily rates.

**Solution:** Detect daily workers (CDDTI contract OR daily/weekly/biweekly payment) and skip monthly minimum validation for their transport allowance.

**Impact:** This fix is **CRITICAL** for daily workers module - without it, NO daily worker payroll can be calculated.

**Priority:** Must fix before Phase 1 implementation of daily workers.

---

## Next Steps

1. ✅ Update ComponentProcessorContext interface to include `paymentFrequency` and `contractType`
2. ✅ Update payroll-calculation-v2.ts to pass these fields to component processor
3. ✅ Update transport validation logic to detect daily workers
4. ✅ Test with sample daily worker payroll
5. ✅ Update error messages to be more helpful (explain daily vs monthly)
6. ✅ Document in user guide: "Transport for daily workers is prorated"

---

**Document Version:** 1.0
**Author:** Claude Code Analysis
**References:**
- `guide_paie_journaliers_cote_ivoire.md` Section 4.1.5
- `DAILY-WORKERS-GAP-ANALYSIS.md` Section 2 (Transport Allowance)
- `lib/salary-components/component-processor.ts` Lines 217-232
- `features/payroll/services/payroll-calculation-v2.ts` Lines 540-561
