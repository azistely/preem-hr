# Auto-Verification Fix for Dependents

## Summary

Fixed issue where `isVerified` field was not being automatically calculated when creating/updating dependents, causing all dependents to remain unverified (`false`) even when proper documentation was provided.

## The Problem

**User Report**:
"I dont see the document number after update, also why is it false when documents data are provided"

**Root Cause Analysis**:
1. **Document number WAS being saved** correctly in the database
2. **`isVerified` was always `false`** even when spouse had marriage certificate with document number
3. **The backend never calculated `isVerified`** - it was missing from both create and update mutations

The tRPC input schemas didn't include `isVerified`, and the mutations just spread the input data without computing verification status:

```typescript
// ❌ Before: Just spread input, isVerified stays false
const [dependent] = await db
  .insert(employeeDependents)
  .values({
    ...input, // isVerified not included, defaults to false
    createdBy: ctx.user.id,
  })
  .returning();
```

## The Solution

### 1. Created `calculateIsVerified()` Helper Function

Added a function that implements the same verification logic as the service layer:

```typescript
function calculateIsVerified(
  relationship: 'child' | 'spouse' | 'other',
  dateOfBirth: string,
  documentType: string | null | undefined,
  documentNumber: string | null | undefined,
  documentExpiryDate: string | null | undefined
): boolean {
  // Calculate age
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // CHILD UNDER 21: Auto-verified
  if (relationship === 'child' && age < 21) {
    return true;
  }

  // SPOUSE, CHILD 21+, OTHER: Requires document
  const hasDocumentType = !!documentType && documentType.trim() !== '';
  const hasDocumentNumber = !!documentNumber && documentNumber.trim() !== '';

  return hasDocumentType && hasDocumentNumber;
}
```

**Verification Rules**:
- **Child under 21**: `true` (always verified, no document needed)
- **Spouse**: `true` if has documentType AND documentNumber
- **Child 21+**: `true` if has documentType AND documentNumber
- **Other**: `true` if has documentType AND documentNumber

**Note**: Document expiry date is optional (some documents like marriage certificates don't expire).

### 2. Updated `create` Mutation

```typescript
// Auto-calculate isVerified based on relationship and document data
const isVerified = calculateIsVerified(
  input.relationship,
  input.dateOfBirth,
  input.documentType,
  input.documentNumber,
  input.documentExpiryDate
);

// Create dependent
const [dependent] = await db
  .insert(employeeDependents)
  .values({
    employeeId: input.employeeId,
    tenantId: input.tenantId,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    relationship: input.relationship,
    isVerified, // ✅ Now calculated
    documentType: input.documentType || null,
    documentNumber: input.documentNumber || null,
    // ... other fields
  })
  .returning();
```

### 3. Updated `update` Mutation

```typescript
// Merge updated data with existing data
const mergedData = {
  relationship: input.relationship || existing.relationship,
  dateOfBirth: input.dateOfBirth || existing.dateOfBirth,
  documentType: input.documentType !== undefined ? input.documentType : existing.documentType,
  documentNumber: input.documentNumber !== undefined ? input.documentNumber : existing.documentNumber,
  documentExpiryDate: input.documentExpiryDate !== undefined ? input.documentExpiryDate : existing.documentExpiryDate,
};

// Auto-calculate isVerified based on relationship and document data
const isVerified = calculateIsVerified(
  mergedData.relationship,
  mergedData.dateOfBirth,
  mergedData.documentType,
  mergedData.documentNumber,
  mergedData.documentExpiryDate
);

// Update dependent
const { id, ...updateData } = input;
const [updated] = await db
  .update(employeeDependents)
  .set({
    ...updateData,
    isVerified, // ✅ Now calculated
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.user.id,
  })
  .where(eq(employeeDependents.id, input.id))
  .returning();
```

## Impact on Payroll Calculations

Now that `isVerified` is correctly set:

### 1. **Fiscal Parts Calculation** ✅ Fixed
The `getVerifiedDependents()` function checks `dep.isVerified` before counting dependents:

```typescript
if (dep.relationship === 'spouse') {
  const hasValidDocument = dep.isVerified &&  // ← Now correctly true
                           dep.documentType &&
                           isDocumentValid(dep.documentExpiryDate);
  return {
    isVerified: hasValidDocument,
    eligibleForFiscalParts: hasValidDocument && dep.eligibleForFiscalParts,
    eligibleForCmu: hasValidDocument && dep.eligibleForCmu,
  };
}
```

**Before**: Spouse with marriage certificate → `isVerified: false` → Not counted in fiscal parts
**After**: Spouse with marriage certificate → `isVerified: true` → ✅ Counted in fiscal parts

### 2. **Marital Status** ✅ Already Working
Marital status auto-sync only checks for spouse dependent existence, not verification status.

### 3. **CMU Calculation** ✅ Already Working
CMU uses `maritalStatus` field, not verified dependent count.

## Testing the Fix

### Test Case 1: Create Spouse with Marriage Certificate

**Input**:
```typescript
await trpc.dependents.create.mutate({
  employeeId: 'employee-123',
  firstName: 'Zea',
  lastName: 'NOY',
  dateOfBirth: '1995-01-31',
  relationship: 'spouse',
  documentType: 'acte_mariage',
  documentNumber: '1234te6567',
  documentExpiryDate: '2025-12-31',
});
```

**Expected Result**:
```json
{
  "isVerified": true,  // ✅ Auto-calculated
  "documentType": "acte_mariage",
  "documentNumber": "1234te6567",
  "documentExpiryDate": "2025-12-31"
}
```

### Test Case 2: Create Child Under 21 (No Document)

**Input**:
```typescript
await trpc.dependents.create.mutate({
  employeeId: 'employee-123',
  firstName: 'Jean',
  lastName: 'NOY',
  dateOfBirth: '2015-03-10',  // Age 10
  relationship: 'child',
  // No document provided
});
```

**Expected Result**:
```json
{
  "isVerified": true,  // ✅ Auto-verified (child under 21)
  "documentType": null,
  "documentNumber": null
}
```

### Test Case 3: Create Spouse Without Document

**Input**:
```typescript
await trpc.dependents.create.mutate({
  employeeId: 'employee-123',
  firstName: 'Marie',
  lastName: 'Kouassi',
  dateOfBirth: '1990-05-15',
  relationship: 'spouse',
  // No document provided
});
```

**Expected Result**:
```json
{
  "isVerified": false,  // ✅ Not verified (missing document)
  "documentType": null,
  "documentNumber": null
}
```

### Test Case 4: Update Spouse to Add Document

**Input**:
```typescript
await trpc.dependents.update.mutate({
  id: 'spouse-id',
  documentType: 'acte_mariage',
  documentNumber: 'MC-2025-12345',
  documentExpiryDate: '2030-12-31',
});
```

**Expected Result**:
```json
{
  "isVerified": true,  // ✅ Now verified after adding document
  "documentType": "acte_mariage",
  "documentNumber": "MC-2025-12345"
}
```

## Migration for Existing Data

If you have existing dependents with `isVerified: false` that should be verified, run this migration:

```sql
-- Auto-verify children under 21
UPDATE employee_dependents
SET is_verified = true
WHERE relationship = 'child'
  AND EXTRACT(YEAR FROM AGE(date_of_birth::date)) < 21
  AND status = 'active';

-- Auto-verify dependents with documents
UPDATE employee_dependents
SET is_verified = true
WHERE relationship IN ('spouse', 'child', 'other')
  AND document_type IS NOT NULL
  AND document_type != ''
  AND document_number IS NOT NULL
  AND document_number != ''
  AND status = 'active';
```

## Related Files

- `/server/routers/dependents.ts:21-63` - Added `calculateIsVerified()` helper function
- `/server/routers/dependents.ts:142-228` - Updated `create` mutation to auto-calculate `isVerified`
- `/server/routers/dependents.ts:236-300` - Updated `update` mutation to auto-calculate `isVerified`
- `/features/employees/services/dependent-verification.service.ts:103-219` - Service layer verification logic
- `/SPOUSE-VERIFICATION-FIX.md` - Related spouse verification bug fix
- `/DEPENDENT-CHILDREN-FIELD-SYNC.md` - Overall dependent synchronization architecture

## Status

✅ **Fixed** (2025-10-28)
- Created `calculateIsVerified()` helper function
- Updated `create` mutation to auto-set `isVerified`
- Updated `update` mutation to auto-set `isVerified`
- Spouse with marriage certificate now verified ✅
- Child under 21 auto-verified ✅
- Fiscal parts calculations now include verified spouses ✅
- Dev server compiling successfully

## Summary

The fix ensures that `isVerified` is automatically calculated based on:
1. **Relationship type** (spouse, child, other)
2. **Age** (for children under 21)
3. **Document presence** (documentType AND documentNumber)

This aligns the backend behavior with the service layer verification logic, ensuring dependents are properly verified when they meet the criteria.
