# Dependent Children & Marital Status Auto-Synchronization

## Summary

The `dependentChildren` and `maritalStatus` fields in the `employees` table are **kept and automatically synchronized** with the `employee_dependents` table for performance and consistency.

Both fields are used by payroll calculations (CMU, fiscal parts, tax) and are maintained as denormalized caches.

## Architecture Decision

**Question**: "We already have a dependentchildren management feature so is the field necessary?"

**Answer**: YES - Keep the field and maintain it automatically.

## Rationale

### 1. Performance Benefits
- Payroll calculations can query `dependentChildren` directly without JOINing to `employee_dependents` table
- Reports and analytics can access dependent count instantly
- Bulk operations (monthly payroll runs) are significantly faster

### 2. Architectural Consistency
- Follows the same pattern as `fiscalParts` which is already auto-maintained
- The dependents router already updates `employees.fiscalParts` when dependents change
- Extending this pattern to `dependentChildren` maintains consistency

### 3. Data Integrity
- Single source of truth: `employee_dependents` table
- Denormalized cache: `employees.dependentChildren`
- Automatic synchronization ensures no drift between the two

## Implementation

### Changes Made

Modified `/server/routers/dependents.ts` to synchronize `dependentChildren` and `maritalStatus` whenever dependents are created, updated, or deleted:

```typescript
// Recalculate fiscal parts, dependent count, and marital status for employee
const fiscalParts = await calculateFiscalPartsFromDependents(
  input.employeeId,
  input.tenantId
);

const dependentCounts = await getDependentCounts(
  input.employeeId,
  input.tenantId
);

const maritalStatus = await calculateMaritalStatusFromDependents(
  input.employeeId,
  input.tenantId
);

// Update employee record with fiscal parts, dependent count, and marital status
await db
  .update(employees)
  .set({
    fiscalParts: fiscalParts.toString(),
    dependentChildren: dependentCounts.totalDependents,
    maritalStatus: maritalStatus, // ← NEW
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.user.id,
  })
  .where(eq(employees.id, input.employeeId));
```

### Affected Endpoints

The following tRPC endpoints now update `dependentChildren` and `maritalStatus`:

1. **`dependents.create`** - Creates a new dependent
2. **`dependents.update`** - Updates an existing dependent
3. **`dependents.delete`** - Soft deletes a dependent (sets status to inactive)

### Data Flow

```
User Action → Dependent Router → Update employee_dependents table
                                ↓
                        Calculate new totals:
                        - fiscalParts (existing)
                        - dependentChildren (NEW)
                        - maritalStatus (NEW)
                                ↓
                        Update employees table
```

## Usage Guidelines

### ✅ DO

- **Read from `employees.dependentChildren`** for:
  - Payroll calculations
  - Reports and dashboards
  - Quick lookups
  - Bulk queries

- **Manage via Dependents Router** for:
  - Adding new dependents
  - Updating dependent info
  - Removing dependents

### ❌ DON'T

- **Don't manually update `dependentChildren`** - Let the dependents router handle it
- **Don't expose it as an editable field in UI** - It's read-only/auto-calculated
- **Don't rely on it being up-to-date** if you bypass the dependents router
- **Don't use it as the source of truth** - Use `employee_dependents` for detailed queries

## UI Implementation

The `dependentChildren` field is **not editable** in the UI. Instead:

### Employee Edit Page
- **No input field** for `dependentChildren` (removed from form schema)
- **Read-only display** showing auto-calculated statistics from `employee_dependents`
- Users see a stats card with:
  - Total dependents
  - Verified dependents
  - Fiscal parts dependents
  - CMU dependents
- Link to dependent management tab

### Code Reference
See `/app/(shared)/employees/[id]/edit/page.tsx:885-918` for implementation:
```tsx
{/* Dependent Children - Read-only, auto-calculated */}
{dependentsStats && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      <div className="space-y-2">
        <p className="font-semibold">Personnes à charge (calculé automatiquement):</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <Badge variant="outline">{dependentsStats.totalDependents}</Badge> Total
          </div>
          {/* ... other badges ... */}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Le nombre de personnes à charge est calculé automatiquement à partir des enregistrements ci-dessous.
        </p>
        <Link href={`/employees/${employeeId}#dependents`}>
          → Gérer les personnes à charge
        </Link>
      </div>
    </AlertDescription>
  </Alert>
)}
```

## Related Systems

### Similar Pattern: Fiscal Parts
The `fiscalParts` field follows the same architecture:
- Stored in `employees.fiscalParts` for performance
- Calculated from `employee_dependents` (children) + `maritalStatus`
- Auto-updated by dependents router

### Marital Status Auto-Detection
The `maritalStatus` field is now auto-synchronized based on dependents:
- **Active spouse dependent exists** → Auto-set to 'married'
- **No spouse dependent** → Keep existing status (allows manual 'divorced'/'widowed')
- **Architecture decision**: Only auto-set 'married' status to avoid incorrectly changing divorced/widowed employees to 'single'
- Implementation: `calculateMaritalStatusFromDependents()` in dependent-verification.service.ts

### Dependent Verification Service
Uses `getDependentCounts()` to calculate:
```typescript
{
  totalDependents: number,      // ← Used to sync employees.dependentChildren
  verifiedDependents: number,
  fiscalPartsDependents: number,
  cmuDependents: number,
  expiringSoon: number
}
```

## Testing

### Test Case 1: Dependent Children Synchronization

1. **Create a dependent**:
   ```typescript
   await trpc.dependents.create.mutate({
     employeeId: 'xxx',
     firstName: 'Test',
     lastName: 'Child',
     relationship: 'child',
     // ...
   });
   ```

2. **Check employee record**:
   ```sql
   SELECT dependent_children FROM employees WHERE id = 'xxx';
   -- Should increment by 1
   ```

3. **Delete the dependent**:
   ```typescript
   await trpc.dependents.delete.mutate({ id: 'dependent-id' });
   ```

4. **Verify decrement**:
   ```sql
   SELECT dependent_children FROM employees WHERE id = 'xxx';
   -- Should decrement by 1
   ```

### Test Case 2: Marital Status Synchronization

1. **Add a spouse dependent**:
   ```typescript
   await trpc.dependents.create.mutate({
     employeeId: 'xxx',
     firstName: 'Marie',
     lastName: 'Kouassi',
     relationship: 'spouse',
     // ...
   });
   ```

2. **Check marital status auto-updated**:
   ```sql
   SELECT marital_status FROM employees WHERE id = 'xxx';
   -- Should be 'married'
   ```

3. **Remove spouse dependent**:
   ```typescript
   await trpc.dependents.delete.mutate({ id: 'spouse-dependent-id' });
   ```

4. **Verify marital status preserved**:
   ```sql
   SELECT marital_status FROM employees WHERE id = 'xxx';
   -- Should remain 'married' (or existing status)
   -- Does NOT auto-change to 'single'
   ```

## Migration Notes

If there are existing employees with incorrect `dependentChildren` or `maritalStatus` values, run these migrations:

### Sync Dependent Children Count
```sql
-- Sync all employees' dependentChildren from employee_dependents
UPDATE employees e
SET dependent_children = (
  SELECT COUNT(*)
  FROM employee_dependents d
  WHERE d.employee_id = e.id
    AND d.status = 'active'
);
```

### Sync Marital Status from Spouse Dependents
```sql
-- Auto-set 'married' status for employees with active spouse dependents
UPDATE employees e
SET marital_status = 'married'
WHERE EXISTS (
  SELECT 1
  FROM employee_dependents d
  WHERE d.employee_id = e.id
    AND d.relationship = 'spouse'
    AND d.status = 'active'
);
```

## Future Considerations

### Option 1: Database Trigger (More Robust)
For ultimate data integrity, consider a Postgres trigger:

```sql
CREATE OR REPLACE FUNCTION sync_dependent_children()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE employees
  SET dependent_children = (
    SELECT COUNT(*)
    FROM employee_dependents
    WHERE employee_id = NEW.employee_id
      AND status = 'active'
  )
  WHERE id = NEW.employee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_dependent_children_trigger
AFTER INSERT OR UPDATE OR DELETE ON employee_dependents
FOR EACH ROW
EXECUTE FUNCTION sync_dependent_children();
```

### Option 2: Background Job (Eventual Consistency)
For extremely high-traffic systems, consider:
- Async updates via job queue
- Periodic reconciliation (daily/hourly)
- Accept brief inconsistency for performance

## Related Files

- `/server/routers/dependents.ts` - Dependent management endpoints (lines 188-214, 264-290, 338-364)
- `/features/employees/services/dependent-verification.service.ts` - Business logic (includes `calculateMaritalStatusFromDependents`, lines 340-387, and relationship-based verification, lines 87-219)
- `/app/(shared)/employees/[id]/edit/page.tsx` - UI implementation (read-only display, lines 885-918)
- `/server/routers/employees.ts` - Employee update schema (removed `dependentChildren` from editable fields, line 167)
- `/features/payroll/services/payroll-calculation-v2.ts` - Uses marital status for CMU calculation
- `/drizzle/schema.ts` - Database schema
- `/SPOUSE-VERIFICATION-FIX.md` - Documentation for spouse vs child verification fix

## Status

✅ **Implemented** (2025-10-28)
- Synchronization logic added to all dependent mutations
- Uses existing `getDependentCounts()` helper
- Added `calculateMaritalStatusFromDependents()` helper
- Marital status auto-set to 'married' when spouse dependent exists
- Both fields consistent with `fiscalParts` denormalized pattern
- `dependentChildren` field removed from UI form (read-only display only)
- **Fixed spouse verification logic** - Now uses marriage certificate requirement instead of age-based rules
- Dev server compiling successfully

## Summary of All Changes

1. **Backend Synchronization**:
   - `dependents.create` → Updates fiscalParts, dependentChildren, maritalStatus
   - `dependents.update` → Updates fiscalParts, dependentChildren, maritalStatus
   - `dependents.delete` → Updates fiscalParts, dependentChildren, maritalStatus

2. **UI Changes**:
   - Removed editable `dependentChildren` input field
   - Added read-only stats display with badges
   - Shows: Total dependents, Verified, Fiscal parts eligible, CMU eligible

3. **Business Logic**:
   - Created `calculateMaritalStatusFromDependents()` function
   - Logic: Active spouse → 'married', else preserve existing status
   - Prevents incorrect 'single' status for divorced/widowed employees
   - **Fixed verification logic**: Spouse requires marriage certificate, children use age-based rules

4. **Verification Rules** (Updated 2025-10-28):
   - **Spouse**: Requires marriage certificate (no age-based auto-verification)
   - **Child < 21**: Auto-verified (no document needed)
   - **Child ≥ 21**: Requires school attendance certificate
   - **Other**: Requires supporting document

5. **Payroll Integration**:
   - Marital status used for CMU calculation (1,000 FCFA per person covered)
   - Marital status used for fiscal parts calculation (tax withholding)
   - Both fields now auto-maintained for accurate payroll runs
   - **Verified spouse now correctly counts** toward fiscal parts calculation
