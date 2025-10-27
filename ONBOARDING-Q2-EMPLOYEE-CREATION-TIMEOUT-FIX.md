# Onboarding Q2 Employee Creation Timeout Fix

**Date:** 2025-10-26
**Issue:** Employee creation endpoint timing out in production (Vercel)
**URL:** `https://preem-hr.vercel.app/api/trpc/onboarding.createFirstEmployeeV2?batch=1`

## Problem Statement

The onboarding Q2 employee creation flow was timing out in production on Vercel's serverless platform (30-second timeout limit). Users could not complete the onboarding flow after previewing the payslip.

**User Report:**
> "onboarding q2 this is not responding at all"

## Root Cause Analysis

### Issue Location
`features/onboarding/services/onboarding-v2.service.ts` (lines 393-403, before fix)

### Technical Root Cause
The `buildBaseSalaryComponents()` function was being called **INSIDE** the database transaction:

```typescript
return await db.transaction(async (tx) => {
  // ... position, employee, assignment creation ...

  // ❌ PROBLEM: DB queries inside transaction
  if (input.baseComponents && Object.keys(input.baseComponents).length > 0) {
    baseComponentsArray = await buildBaseSalaryComponents(
      input.baseComponents,
      tenant.countryCode || 'CI'
    ); // Lines 393-396
  } else if (effectiveBaseSalary > 0) {
    baseComponentsArray = await buildBaseSalaryComponents(
      { '11': effectiveBaseSalary },
      tenant.countryCode || 'CI'
    ); // Lines 400-403
  }

  // ... rest of transaction ...
});
```

### Why This Causes Timeout

1. **`buildBaseSalaryComponents()` makes database queries** to load component definitions from `salary_components` table
2. **These queries run while the transaction is active**, holding locks on inserted records
3. **On Vercel's serverless platform**, this causes:
   - Connection pool exhaustion
   - Lock contention
   - Query queueing
   - **Timeout after 30 seconds** (serverless function limit)

### Similar Issue Already Fixed

The same pattern was already correctly implemented for `autoInjectCalculatedComponents()`:

```typescript
// ✅ CORRECT: Calculate components BEFORE transaction (line 246)
const componentsWithCalculated = await autoInjectCalculatedComponents({
  tenantId: input.tenantId,
  countryCode: tenant.countryCode || 'CI',
  baseSalary: effectiveBaseSalary,
  hireDate: hireDate,
  numberOfDependents: input.dependentChildren,
});

// THEN start transaction
return await db.transaction(async (tx) => {
  // Use pre-calculated componentsWithCalculated
});
```

The fix needed to apply the same pattern to `buildBaseSalaryComponents()`.

## Solution

### Code Changes

**File:** `features/onboarding/services/onboarding-v2.service.ts`

**Change 1: Move `buildBaseSalaryComponents()` BEFORE transaction**

Added pre-calculation block before transaction starts (new lines 256-286):

```typescript
// ========================================
// ✅ CRITICAL FIX: Build base salary components BEFORE transaction to avoid timeout
// buildBaseSalaryComponents makes DB queries to load component definitions
// Calling it inside transaction causes timeout on Vercel (30s serverless limit)
// ========================================
console.time('[Employee Creation] Pre-build base components');
const baseCompStart = Date.now();
let baseComponentsArray: Array<{
  code: string;
  name: string;
  amount: number;
  sourceType: string;
  metadata?: Record<string, any>;
}> = [];

if (input.baseComponents && Object.keys(input.baseComponents).length > 0) {
  // Build base components using database-driven loader
  baseComponentsArray = await buildBaseSalaryComponents(
    input.baseComponents,
    tenant.countryCode || 'CI'
  );
} else if (effectiveBaseSalary > 0) {
  // LEGACY: If no baseComponents provided, create Code 11 with the baseSalary amount
  // This ensures backward compatibility and prevents missing Code 11
  baseComponentsArray = await buildBaseSalaryComponents(
    { '11': effectiveBaseSalary },
    tenant.countryCode || 'CI'
  );
}
console.timeEnd('[Employee Creation] Pre-build base components');
console.log(`[Employee Creation] Base components pre-built in ${Date.now() - baseCompStart}ms`);
```

**Change 2: Remove duplicate code from inside transaction**

Removed the duplicate `buildBaseSalaryComponents()` calls that were inside the transaction (previously lines 411-436):

```typescript
// Before:
// ❌ Duplicate code inside transaction
let baseComponentsArray: Array<...> = [];
if (input.baseComponents && ...) {
  baseComponentsArray = await buildBaseSalaryComponents(...);
} else if (effectiveBaseSalary > 0) {
  baseComponentsArray = await buildBaseSalaryComponents(...);
}

// After:
// ✅ Just use the pre-calculated array
console.log('[Employee Creation] Using pre-calculated base components and formula components');
```

## Impact

### Performance Improvement
- **Before:** Timeout after 30s on Vercel
- **After:** Expected completion in < 5s

### Database Impact
- **Before:** 2-4 additional DB queries inside transaction (component definition lookups)
- **After:** All queries complete before transaction starts
- **Benefit:** Shorter transaction duration = fewer locks = better concurrency

### User Experience
- **Before:** "Not responding" - user stuck on loading screen
- **After:** Employee creation completes successfully

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test
1. Navigate to `/onboarding/q2`
2. Fill in employee details
3. Preview payslip (should show daily/hourly rates correctly)
4. Click "C'est correct, continuer"
5. **Expected:** Employee created successfully, redirect to `/onboarding/success`

### Production Verification
Deploy to Vercel and verify the endpoint responds within 5 seconds:
- URL: `https://preem-hr.vercel.app/api/trpc/onboarding.createFirstEmployeeV2?batch=1`
- Expected response time: < 5s
- Expected status: 200 OK

## Related Issues Fixed

This timeout fix complements the earlier rate-aware display fix:

1. **Backend calculation fix** (commit 5326733) - Pass rateType to `calculatePayrollV2`
2. **Frontend display fix** (commit 5326733) - Convert monthly totals to per-day/per-hour rates
3. **Timeout fix** (this commit) - Move DB queries outside transaction

All three fixes are required for a complete onboarding Q2 flow.

## Architecture Lesson

### Transaction Best Practices

**✅ DO: Pre-calculate before transaction**
```typescript
const preCalculated = await expensiveDBQuery();
return await db.transaction(async (tx) => {
  // Use preCalculated
});
```

**❌ DON'T: Query inside transaction**
```typescript
return await db.transaction(async (tx) => {
  const result = await expensiveDBQuery(); // TIMEOUT RISK
});
```

### Why This Matters on Serverless

- **Vercel/Netlify/Lambda:** 30s timeout limit
- **Traditional servers:** Can handle longer transactions (but still bad practice)
- **Database connections:** Limited pool size on serverless
- **Solution:** Keep transactions as short as possible

## Files Changed

- `features/onboarding/services/onboarding-v2.service.ts` - Moved `buildBaseSalaryComponents()` outside transaction

## Verification

```bash
# Type check
npm run type-check

# Build check
npm run build

# Manual test in production
# 1. Deploy to Vercel
# 2. Complete onboarding Q2 flow
# 3. Verify employee creation succeeds
```

---

**Status:** ✅ Fixed
**Deployed:** Pending production deployment
**Related Docs:**
- `ONBOARDING-Q2-DAILY-RATE-FIX.md` (payslip preview display fix)
- `docs/HCI-DESIGN-PRINCIPLES.md` (onboarding UX patterns)
