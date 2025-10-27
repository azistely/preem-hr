# Onboarding Q1 Existing Locations Fix

**Date:** 2025-10-26
**Issue:** Duplicate location error when returning to onboarding
**Component:** Onboarding Q1 (company setup + locations)

## Problem Statement

When a user:
1. Started onboarding and created a site (e.g., "HQ_ABIDJAN")
2. Logged out or navigated away
3. Returned to onboarding Q1

**Expected:**
- See existing sites displayed in the form
- Be able to continue without errors

**Actual:**
- Form shows empty (no existing sites)
- Trying to submit causes duplicate error:
  ```
  TRPCError: Un site avec le code "HQ_ABIDJAN" existe déjà
  ```

**User Report:**
> "When I started onboarding and added a site then logged out and came back again at the site step I dont see the existing site and I cannot add it again"

## Root Cause Analysis

### The Flow

**Before Fix:**
1. User creates location → saved to database ✅
2. User logs out and returns
3. Onboarding Q1 page loads with **empty form** ❌
4. User sees no locations, tries to add "HQ_ABIDJAN" again
5. Backend rejects: "Un site avec le code 'HQ_ABIDJAN' existe déjà" ❌

### Code Issue

**File:** `app/onboarding/q1/page.tsx`

**Problem:** Page never loaded existing locations from database

```typescript
// BEFORE FIX: No query for existing locations
const { data: user } = api.auth.me.useQuery();

// Form always started empty
const { register, handleSubmit, watch, setValue } = useForm({
  defaultValues: {
    locations: [], // ❌ Always empty!
  },
});
```

**Result:** Form had no knowledge of existing locations, so it tried to create duplicates.

## Solution

### Changes Made

**Change 1: Load existing locations (line 77)**

```typescript
// Load existing locations from database
const { data: existingLocations } = api.locations.list.useQuery();
```

**Change 2: Populate form with existing locations (lines 94-104)**

```typescript
// Populate form with existing locations when they load
useEffect(() => {
  if (existingLocations && existingLocations.length > 0) {
    const formattedLocations = existingLocations
      .filter(loc => loc.city) // Filter out null cities
      .map(loc => ({
        locationType: loc.locationType as LocationFormData['locationType'],
        city: loc.city as string, // Safe cast after filter
      }));
    setValue('locations', formattedLocations, { shouldValidate: false });
  }
}, [existingLocations, setValue]);
```

**Change 3: Skip creating duplicate locations (lines 117-154)**

```typescript
// Build set of existing location codes for quick lookup
const existingLocationCodes = new Set(
  (existingLocations || []).map(loc => loc.locationCode)
);

let createdCount = 0;
let skippedCount = 0;

for (let i = 0; i < data.locations.length; i++) {
  const location = data.locations[i];
  // ... generate autoCode ...

  // Skip if location already exists
  if (existingLocationCodes.has(autoCode)) {
    skippedCount++;
    continue;
  }

  // Create new location
  await createLocationMutation.mutateAsync(...);
  createdCount++;
}

// Show appropriate message
if (createdCount > 0 && skippedCount > 0) {
  toast.success(`${createdCount} nouveau(x) site(s) créé(s), ${skippedCount} existant(s)`);
} else if (createdCount > 0) {
  toast.success(`${createdCount} site(s) créé(s)`);
} else {
  toast.success('Configuration enregistrée (sites déjà existants)');
}
```

## Impact

### User Experience

**After Fix:**

1. User returns to onboarding Q1
2. **Existing sites are displayed** ✅
3. User can:
   - See what sites they already created
   - Add new sites if needed
   - Submit without duplicate errors
   - Continue to Q2 seamlessly

### Scenarios

**Scenario 1: User returns with existing site**
- Form shows: "Siège social - Abidjan"
- User clicks "Continuer"
- Toast: "Configuration enregistrée (sites déjà existants)"
- Navigates to Q2 ✅

**Scenario 2: User adds a new site**
- Form shows: "Siège social - Abidjan" (existing)
- User adds: "Succursale - Bouaké" (new)
- User clicks "Continuer"
- Toast: "1 nouveau site créé, 1 existant"
- Navigates to Q2 ✅

**Scenario 3: User removes existing site**
- Form shows: "Siège social - Abidjan"
- User clicks X to remove
- **Note:** This only removes from form, doesn't delete from database
- Existing site is skipped on submit (no changes)

## Edge Cases Handled

### 1. Null Cities
Some locations in database might have `null` city (legacy data):
```typescript
.filter(loc => loc.city) // Skip locations without city
```

### 2. Modified Locations
If user changes city of existing location:
- Old location code: `HQ_ABIDJAN` (exists)
- New location code: `HQ_BOUAKE` (new)
- Result: Old location unchanged, new location created

### 3. Empty Existing Locations
If `existingLocations` is empty array or null:
- Form remains empty (first-time onboarding)
- All locations are created as new

## Testing

### Type Check
```bash
npm run type-check
```
✅ Passed

### Manual Test Cases

**Test 1: First-Time Onboarding (No Existing Locations)**
1. Fresh tenant (no locations)
2. Navigate to `/onboarding/q1`
3. Add "Siège social - Abidjan"
4. Submit
5. **Expected:**
   - Toast: "Configuration enregistrée: 1 site(s) créé(s)"
   - Navigate to Q2
   - Location created in database

**Test 2: Return to Onboarding (Existing Location)**
1. Tenant has location "HQ_ABIDJAN"
2. Navigate to `/onboarding/q1`
3. **Expected:**
   - Form shows "Siège social - Abidjan"
4. Submit without changes
5. **Expected:**
   - Toast: "Configuration enregistrée (sites déjà existants)"
   - Navigate to Q2
   - No duplicate error

**Test 3: Add New Location (Existing + New)**
1. Tenant has location "HQ_ABIDJAN"
2. Navigate to `/onboarding/q1`
3. Form shows "Siège social - Abidjan"
4. Click "Ajouter un site"
5. Add "Succursale - Bouaké"
6. Submit
7. **Expected:**
   - Toast: "1 nouveau site créé, 1 existant"
   - Navigate to Q2
   - "BR_BOUAKE" created in database

**Test 4: Logout and Return (Idempotent)**
1. Complete onboarding Q1
2. Logout
3. Login again
4. Navigate to `/onboarding/q1`
5. **Expected:**
   - Form shows existing sites
   - Can submit without errors
   - Idempotent (no duplicates created)

## Architecture Notes

### Why Not Skip Q1 Entirely?

Could we just skip Q1 if locations exist?

**Answer:** No, because:
1. User might want to add MORE locations
2. Company info (name, sector) might need updates
3. Onboarding should be **resumable**, not **skippable**

### Why Not DELETE Old Locations?

When user removes a location from form, should we delete from database?

**Answer:** No, because:
1. Location might have employees assigned
2. Location might have payroll history
3. Deletion is a **destructive operation** - should require explicit confirmation
4. This is **onboarding**, not **settings** - focus is on continuation, not modification

### Idempotency

The fix makes Q1 submission **idempotent**:
- First submit: Creates locations
- Second submit: Skips existing locations
- Result: Same outcome regardless of how many times submitted

This is **critical** for onboarding flows that can be interrupted.

## Files Changed

- `app/onboarding/q1/page.tsx`
  - Added `useEffect` import (line 23)
  - Added `api.locations.list.useQuery()` (line 77)
  - Added `useEffect` to populate form (lines 94-104)
  - Modified `onSubmit` to skip duplicates (lines 117-163)

## Related Issues

This fix addresses a **fundamental onboarding UX principle**:

> "Onboarding should be resumable. Users should never be blocked or penalized for leaving and returning."

Other onboarding steps should follow the same pattern:
- ✅ Q1 (this fix) - Load existing locations
- ⏳ Q2 - Load existing employees (already works - creates NEW employee each time)
- ⏳ Q0 (signup) - Check if user already exists

## Verification

```bash
# Type check
npm run type-check

# Manual test
# 1. npm run dev
# 2. Complete onboarding Q1 (add site)
# 3. Logout
# 4. Login
# 5. Navigate to /onboarding/q1
# 6. Verify site is shown
# 7. Submit again
# 8. Verify no duplicate error
```

---

**Status:** ✅ Fixed
**Severity:** High - Blocks onboarding completion
**User Impact:** Critical - Users cannot complete onboarding if interrupted

**Related Docs:**
- `docs/HCI-DESIGN-PRINCIPLES.md` - Onboarding UX patterns
- `docs/05-EPIC-ONBOARDING.md` - Onboarding flow architecture
