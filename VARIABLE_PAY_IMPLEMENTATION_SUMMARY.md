# Variable Pay Inputs System - Implementation Summary

## Overview

Successfully implemented a complete Variable Pay Inputs system for the Preem HR application. This system allows bulk entry of monthly variable component values (commissions, production bonuses, etc.) that change period-to-period for employees.

## Architecture Decision

**Problem:** The codebase has salary components stored in `employee_salaries.components` (JSONB array), but some components have variable values that change monthly (e.g., sales commissions, production bonuses). There was no way to bulk-update 200+ employees' variable component values before running payroll.

**Solution:**
- **Fixed components** (housing, transport) → Stay in `employee_salaries.components`
- **Variable components** (commission, production bonus) → Monthly values in new `variable_pay_inputs` table
- **Payroll calculation** → Merges fixed + variable values for the period

## Files Created

### 1. Database Migration
**File:** `/supabase/migrations/20251024_create_variable_pay_inputs.sql`

**Features:**
- Creates `variable_pay_inputs` table with proper constraints
- Adds `component_type` column to `salary_component_definitions` table
- Implements tenant isolation with RLS policies
- Includes proper indexes for performance
- Auto-update trigger for `updated_at` timestamp

**Table Structure:**
```sql
CREATE TABLE variable_pay_inputs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  component_code VARCHAR(50) NOT NULL,
  period DATE NOT NULL,  -- YYYY-MM-01 format
  amount NUMERIC(15,2) NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT unique_employee_component_period UNIQUE(tenant_id, employee_id, component_code, period)
);
```

### 2. Drizzle Schema
**File:** `/lib/db/schema/variable-pay-inputs.ts`

**Features:**
- Type-safe schema definition using Drizzle ORM
- Proper foreign key relationships
- RLS policy definitions
- Type exports for TypeScript inference

**Type Exports:**
```typescript
export type VariablePayInput = typeof variablePayInputs.$inferSelect;
export type NewVariablePayInput = typeof variablePayInputs.$inferInsert;
```

### 3. Service Layer
**File:** `/features/payroll/services/variable-pay-inputs.service.ts`

**Functions:**
- `getVariablePayInputsForPeriod()` - Fetch all inputs for a period with employee details
- `bulkUpsertVariablePayInputs()` - Bulk insert/update with transaction support
- `copyVariablePayFromPreviousPeriod()` - Copy inputs from previous month
- `getVariablePayInputsForEmployee()` - Get inputs for specific employee (used by payroll)
- `deleteVariablePayInput()` - Delete single input
- `deleteVariablePayInputsForPeriod()` - Delete all inputs for a period

**Key Features:**
- Transaction support for atomicity
- ON CONFLICT DO UPDATE for upsert behavior
- Proper error handling
- Type-safe with TypeScript

### 4. tRPC Router
**File:** `/server/routers/variable-pay-inputs.ts`

**Endpoints:**
- `getForPeriod` - Query inputs for a period
- `bulkUpsert` - Mutation for bulk insert/update
- `copyFromPreviousPeriod` - Copy inputs between periods
- `delete` - Delete single input
- `deleteForPeriod` - Delete all inputs for a period (requires confirmation)

**Features:**
- Zod validation for all inputs
- Period validation (YYYY-MM-01 format)
- Tenant isolation via ctx.user.tenantId
- Proper error messages in French
- Max 500 entries per bulk operation

### 5. Payroll Calculation Integration
**File:** `/lib/salary-components/component-reader.ts`

**New Function:** `getEmployeeSalaryComponentsForPeriod()`

**How it works:**
1. Loads fixed components from `employee_salaries.components`
2. Fetches variable inputs for the period from `variable_pay_inputs` table
3. Merges: If a component has a variable input, uses that amount instead of fixed
4. Adds variable-only components (not in fixed components)
5. Returns merged breakdown for payroll calculation

**Example:**
```typescript
// Fixed: Transport = 25,000 FCFA
// Variable: Transport for January = 30,000 FCFA
// Result: Transport = 30,000 FCFA (variable overrides fixed)

// Fixed: No commission component
// Variable: Commission for January = 150,000 FCFA
// Result: Commission = 150,000 FCFA (added from variable)
```

### 6. UI Components

#### Main Page
**File:** `/app/(shared)/payroll/variable-inputs/page.tsx`

**Features:**
- Period selector (defaults to next month)
- Copy from previous period button
- Export/Import Excel buttons (placeholders)
- Info banner explaining how the system works
- Entry count badge
- Loading states
- Mobile-responsive design

**HCI Compliance:**
- Large touch targets (min-h-[44px])
- Clear visual feedback
- Smart defaults (next month selected by default)
- French language throughout
- Progressive disclosure (info in collapsible banner)

#### Table Component
**File:** `/features/payroll/components/variable-pay-inputs-table.tsx`

**Features:**
- Editable cells (click to edit, blur to save)
- Auto-save on blur
- Validation (non-negative numbers)
- Delete button per row
- Empty state with helpful message
- Loading states
- Mobile-responsive table

**Keyboard Support:**
- Enter: Save and close edit
- Escape: Cancel edit

### 7. Navigation Update
**File:** `/lib/navigation/index.ts`

**Changes:**
- Updated "Primes et variables" link from `/payroll/bonuses` to `/payroll/variable-inputs`
- Applied to both mobile and desktop navigation
- Applied to HR Manager and Admin roles

## How to Use the System

### 1. Access the Page
Navigate to: **Paie → Primes et variables**

### 2. Select Period
Use the period dropdown to select the month you want to enter data for.

### 3. Enter Data
Two options:
1. **Copy from previous month:** Click "Copier du mois précédent" button
2. **Manual entry:** Click on cells to edit amounts and notes

### 4. Save
Data is automatically saved when you:
- Blur the input field (click outside)
- Press Enter

### 5. Payroll Integration
When running payroll for the period:
- The system automatically fetches variable inputs for that period
- Variable amounts override fixed component amounts
- Variable-only components are added to the calculation

## Integration with Existing System

### Component Types in `salary_component_definitions`

The migration adds a `component_type` column:
- `fixed` - Amount never changes (housing allowance)
- `variable` - Amount changes monthly (commission, production bonus)
- `percentage` - Calculated as percentage (future use)
- `formula` - Calculated via formula (future use)

### Migration Path

**Before:**
```
employee_salaries.components = [
  { code: '11', name: 'Salaire de base', amount: 300000 },
  { code: '22', name: 'Transport', amount: 25000 }
]
```

**After (for variable components):**
```
employee_salaries.components = [
  { code: '11', name: 'Salaire de base', amount: 300000 },
  { code: '22', name: 'Transport', amount: 25000 }  // Default amount
]

variable_pay_inputs for 2025-01-01 = [
  { component_code: '22', amount: 30000 }  // Overrides default for January
]
```

**Payroll Calculation for January:**
```typescript
const breakdown = await getEmployeeSalaryComponentsForPeriod(
  salaryData,
  employeeId,
  '2025-01-01',
  tenantId
);
// breakdown.transportAllowance = 30000 (from variable_pay_inputs)
```

## Type Safety

All code is fully type-checked with TypeScript:
- ✅ No `any` types
- ✅ Proper null handling with `??` and `?.`
- ✅ Types derived from schema using `$inferSelect`
- ✅ Zod validation for all inputs
- ✅ Passed `npm run type-check`

## Database Indexes

Optimized for common queries:
- `idx_variable_pay_tenant` - Filter by tenant
- `idx_variable_pay_employee` - Get employee's inputs
- `idx_variable_pay_period` - Get all inputs for a period
- `idx_variable_pay_component` - Group by component
- `idx_variable_pay_lookup` - Fast lookup (tenant + employee + period)

## Security

- ✅ Row-Level Security (RLS) enabled
- ✅ Tenant isolation policy
- ✅ Super admin override policy
- ✅ Foreign key constraints
- ✅ Check constraint (amount >= 0)
- ✅ Unique constraint (tenant + employee + component + period)

## Testing Recommendations

### 1. Database Migration
```sql
-- Run migration
psql -U postgres -d preem_dev -f supabase/migrations/20251024_create_variable_pay_inputs.sql

-- Verify table exists
\d variable_pay_inputs

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'variable_pay_inputs';
```

### 2. Service Layer
```typescript
// Test bulk upsert
const inputs = [
  { employeeId: 'xxx', componentCode: 'COMMISSION', amount: 150000 },
  { employeeId: 'yyy', componentCode: 'COMMISSION', amount: 200000 },
];

await bulkUpsertVariablePayInputs(tenantId, '2025-01-01', inputs, userId);

// Test copy from previous
await copyVariablePayFromPreviousPeriod(tenantId, '2024-12-01', '2025-01-01', userId);

// Test fetch
const results = await getVariablePayInputsForPeriod(tenantId, '2025-01-01');
console.log(results); // Should show inputs with employee names
```

### 3. UI Testing
1. Navigate to /payroll/variable-inputs
2. Select a period
3. Click "Copier du mois précédent" (should show success toast)
4. Edit a cell (should auto-save on blur)
5. Verify on mobile (table should be scrollable)
6. Test keyboard navigation (Enter/Escape)

### 4. Payroll Integration
```typescript
// Test merged components
const breakdown = await getEmployeeSalaryComponentsForPeriod(
  salaryData,
  employeeId,
  '2025-01-01',
  tenantId
);

// Verify variable amounts override fixed amounts
// Verify variable-only components are included
```

## Future Enhancements

### Excel Import/Export
- Export template with employee list + component columns
- Import validation (check employee IDs, component codes)
- Bulk validation before save

### Component Configuration UI
- Mark components as "variable" in settings
- Configure which employees have variable components
- Set default amounts for variable components

### Validation Rules
- Min/max amounts per component
- Required components per employee
- Warning if amount is outside normal range

### Reporting
- History of variable pay changes
- Comparison across periods
- Employee-level trends

### Notifications
- Remind to enter variable pay before payroll run
- Alert if variable pay missing for active employees
- Approval workflow for large amounts

## Known Limitations

1. **No Excel import/export yet** - Buttons are placeholders
2. **No component configuration UI** - Must configure in database
3. **No validation rules** - Only basic non-negative validation
4. **No approval workflow** - All changes are immediate

## Migration Strategy for Existing Data

If you have existing bonus/commission data in the old `bonuses` table:

```sql
-- Migrate approved bonuses to variable_pay_inputs
INSERT INTO variable_pay_inputs (
  tenant_id,
  employee_id,
  component_code,
  period,
  amount,
  notes,
  created_by,
  created_at
)
SELECT
  tenant_id,
  employee_id,
  'BONUS_' || bonus_type,  -- Map bonus types to component codes
  period,
  amount::numeric,
  description,
  created_by,
  created_at
FROM bonuses
WHERE status = 'approved'
ON CONFLICT (tenant_id, employee_id, component_code, period) DO NOTHING;
```

## Conclusion

The Variable Pay Inputs system is fully implemented and ready for use. It provides:
- ✅ Efficient bulk data entry
- ✅ Period-based management
- ✅ Seamless payroll integration
- ✅ Type-safe implementation
- ✅ HCI-compliant UI
- ✅ Proper security and data isolation

All code follows project best practices and passes type-checking. The system is production-ready and can be extended with additional features as needed.
