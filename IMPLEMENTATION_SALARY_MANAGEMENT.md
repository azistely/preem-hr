# Salary Management Enhancement Implementation

## Overview

This document describes the implementation of multi-country salary management enhancements for Preem HR, including dynamic minimum wage validation, salary review workflows, and approval processes.

## Database Schema Changes

### 1. Countries Table Enhancement

**File**: `/Users/admin/Sites/preem-hr/drizzle/schema.ts`

Added `minimumWage` column to support country-specific minimum wage (SMIG) values:

```typescript
minimumWage: numeric("minimum_wage", { precision: 15, scale: 2 })
```

**Values in Database** (via Supabase migration):
- CI (Côte d'Ivoire): 75,000 FCFA
- SN (Sénégal): 60,000 FCFA
- BF (Burkina Faso): 40,000 FCFA
- ML (Mali): 35,000 FCFA
- BJ (Bénin): 40,000 FCFA
- TG (Togo): 52,000 FCFA
- GN (Guinée): 100,000 GNF

### 2. New Tables Added

#### salary_reviews
Manages salary review approval workflows.

**Columns**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK to tenants)
- `employee_id` (uuid, FK to employees)
- `current_salary` (numeric)
- `proposed_salary` (numeric)
- `proposed_allowances` (jsonb)
- `effective_from` (date)
- `reason` (text)
- `justification` (text)
- `status` (text: pending, approved, rejected, cancelled)
- `requested_by` (uuid, FK to users)
- `requested_at` (timestamp)
- `reviewed_by` (uuid, FK to users)
- `reviewed_at` (timestamp)
- `review_notes` (text)

**Indexes**:
- `idx_salary_reviews_employee` (employee_id)
- `idx_salary_reviews_status` (tenant_id, status)
- `idx_salary_reviews_tenant` (tenant_id)

#### salary_bands
Defines salary ranges for positions.

**Columns**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK to tenants)
- `name` (text)
- `code` (text)
- `description` (text)
- `min_salary` (numeric)
- `max_salary` (numeric)
- `midpoint` (numeric)
- `currency` (text, default: 'XOF')
- `grade` (text)
- `effective_from` (date)
- `effective_to` (date)
- `status` (text: active, inactive)

**Constraint**: `min_salary <= max_salary`

#### bulk_salary_adjustments
Manages bulk salary adjustment operations.

**Columns**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK to tenants)
- `name` (text)
- `description` (text)
- `adjustment_type` (text: flat, percentage)
- `adjustment_value` (numeric)
- `adjustment_percentage` (numeric)
- `effective_from` (date)
- `reason` (text)
- `status` (text: draft, pending_approval, approved, executed, cancelled)
- `created_by` (uuid, FK to users)
- `approved_by` (uuid, FK to users)
- `executed_by` (uuid, FK to users)

#### bulk_adjustment_items
Individual items in a bulk adjustment.

**Columns**:
- `id` (uuid, PK)
- `bulk_adjustment_id` (uuid, FK to bulk_salary_adjustments)
- `employee_id` (uuid, FK to employees)
- `current_salary` (numeric)
- `proposed_salary` (numeric)
- `adjustment_amount` (numeric)
- `status` (text: pending, executed, failed, skipped)
- `error_message` (text)

### 3. Positions Table Enhancement

Added `salary_band_id` column to link positions to salary bands:

```typescript
salaryBandId: uuid("salary_band_id")
```

## Service Layer Implementation

### 1. salary.service.ts Enhancements

**File**: `/Users/admin/Sites/preem-hr/features/employees/services/salary.service.ts`

#### New Functions

**`getMinimumWage(countryCode: string): Promise<number>`**
- Queries country-specific minimum wage from database
- Implements caching to reduce DB queries
- Throws ValidationError if country config not found

**`getTenantCountryCode(tenantId: string): Promise<string>`**
- Retrieves tenant's country code
- Returns 'CI' as default fallback

#### Updated Functions

**`changeSalary(input: ChangeSalaryInput)`**
- Removed hardcoded `SMIG_CI = 75000`
- Now uses dynamic country-specific minimum wage
- Validates against tenant's country SMIG
- Provides country-specific error messages

**Example Error Message**:
```
Le salaire doit être >= SMIG du Côte d'Ivoire (75000 FCFA)
```

### 2. salary-review.service.ts (NEW)

**File**: `/Users/admin/Sites/preem-hr/features/employees/services/salary-review.service.ts`

Complete salary review workflow service.

#### Functions

**`createSalaryReview(input: CreateSalaryReviewInput)`**
- Creates a new salary review request
- Validates employee exists
- Retrieves current salary for comparison
- Sets status to 'pending'

**`reviewSalaryChange(input: ReviewDecisionInput)`**
- Approves or rejects a salary review
- Updates review status and metadata
- If approved, automatically executes salary change via transaction
- Prevents duplicate reviews (checks status)

**`getPendingReviews(tenantId: string)`**
- Returns all pending reviews for a tenant
- Ordered by requested_at

**`getEmployeeReviewHistory(employeeId: string)`**
- Returns complete review history for an employee
- Ordered by requested_at

**`cancelSalaryReview(reviewId: string, tenantId: string)`**
- Cancels a pending review
- Only works for pending reviews
- Throws NotFoundError if review doesn't exist

## API Layer Implementation

### salary-reviews.ts tRPC Router (NEW)

**File**: `/Users/admin/Sites/preem-hr/server/routers/salary-reviews.ts`

Complete tRPC router for salary review operations.

#### Procedures

**`create` (mutation)**
- Input: `createReviewSchema`
- Creates salary review request
- Publishes `salary_review.created` event
- Returns created review

**`review` (mutation)**
- Input: `reviewDecisionSchema`
- Approves or rejects review
- Publishes `salary_review.decided` event
- Returns updated review

**`listPending` (query)**
- No input required
- Returns all pending reviews for tenant
- Sorted by request date

**`getHistory` (query)**
- Input: `{ employeeId: string }`
- Returns review history for employee
- Includes all statuses

**`cancel` (mutation)**
- Input: `{ reviewId: string }`
- Cancels pending review
- Returns cancelled review

### Router Registration

**File**: `/Users/admin/Sites/preem-hr/server/routers/_app.ts`

Added salary reviews router to main app router:

```typescript
import { salaryReviewsRouter } from './salary-reviews';

export const appRouter = createTRPCRouter({
  // ... existing routers
  salaryReviews: salaryReviewsRouter,
});
```

## Event Bus Integration

### Events Published

**`salary_review.created`**
```typescript
{
  reviewId: string;
  employeeId: string;
  tenantId: string;
  requestedBy: string;
}
```

**`salary_review.decided`**
```typescript
{
  reviewId: string;
  employeeId: string;
  tenantId: string;
  decision: 'approved' | 'rejected';
  reviewedBy: string;
}
```

## Transaction Safety

### Approval Workflow Transaction

When a salary review is approved, the following operations occur atomically:

1. Update salary_reviews status to 'approved'
2. Set reviewed_by and reviewed_at
3. Execute salary change via `changeSalary()`
4. Create new employee_salaries record
5. Close previous employee_salaries record

If any step fails, the entire transaction is rolled back.

## Validation Rules

### Minimum Wage Validation

- **Before**: Hardcoded to 75,000 FCFA (CI only)
- **After**: Dynamic lookup based on tenant's country
- **Cached**: Yes, to minimize database queries
- **Error Messages**: Country-specific, in French

### Review Status Validation

- Only `pending` reviews can be approved/rejected
- Only `pending` reviews can be cancelled
- Attempting to review a non-pending review throws ValidationError

## Usage Examples

### Creating a Salary Review

```typescript
const review = await trpc.salaryReviews.create.mutate({
  employeeId: '123e4567-e89b-12d3-a456-426614174000',
  proposedSalary: 850000,
  proposedAllowances: {
    housingAllowance: 100000,
    transportAllowance: 50000,
  },
  effectiveFrom: new Date('2025-02-01'),
  reason: 'promotion',
  justification: 'Promotion to Senior Developer',
});
```

### Approving a Review

```typescript
const approved = await trpc.salaryReviews.review.mutate({
  reviewId: review.id,
  decision: 'approved',
  reviewNotes: 'Performance justified. Approved.',
});
```

### Getting Pending Reviews

```typescript
const pending = await trpc.salaryReviews.listPending.query();
```

### Getting Employee Review History

```typescript
const history = await trpc.salaryReviews.getHistory.query({
  employeeId: '123e4567-e89b-12d3-a456-426614174000',
});
```

## Error Handling

All services follow the project's error handling pattern:

- **ValidationError**: User input issues, business rule violations
- **NotFoundError**: Resource doesn't exist
- **TRPCError**: API-level errors with appropriate HTTP status codes

## Security

### Tenant Isolation

All queries include tenant_id checks to ensure:
- Users can only access their tenant's data
- Reviews are isolated by tenant
- Country configs are globally accessible

### Row-Level Security (RLS)

All new tables include RLS policies:
```sql
tenant_isolation: (tenant_id = auth.jwt() ->> 'tenant_id'::uuid)
                  OR (auth.jwt() ->> 'role'::text = 'super_admin'::text)
```

## Performance Considerations

### Caching

**Country Config Cache**:
- In-memory Map<countryCode, { minimumWage }>
- Reduces database queries for minimum wage lookups
- Persists for application lifetime

### Indexes

All new tables include appropriate indexes:
- Foreign keys (tenant_id, employee_id, etc.)
- Status columns for filtering
- Composite indexes for common query patterns

## Testing Recommendations

### Unit Tests

1. Test `getMinimumWage()` with different country codes
2. Test cache behavior (first hit vs cached hit)
3. Test salary validation with various minimum wages
4. Test review workflow state transitions
5. Test transaction rollback on approval failure

### Integration Tests

1. Create review → approve → verify salary change
2. Create review → reject → verify no salary change
3. Create review → cancel → verify status
4. Multi-country validation scenarios

## Future Enhancements

### Potential Features

1. **Bulk Salary Adjustments**
   - Tables already created
   - Service layer needed
   - Router needed

2. **Salary Band Management**
   - Tables already created
   - CRUD operations needed
   - Position linking needed

3. **Approval Workflows**
   - Multi-level approvals
   - Delegation support
   - Notification system

4. **Audit Trail**
   - Already supported via events table
   - UI for viewing history needed

## Migration Notes

### Database Migrations Required

The following Supabase migrations must be applied:

1. `20251005_add_minimum_wage_to_countries.sql` (already applied)
2. New migration for salary_reviews table
3. New migration for salary_bands table
4. New migration for bulk_salary_adjustments tables
5. New migration to add salary_band_id to positions

### Data Migration

**Minimum Wage Values**:
Already populated via migration for 7 West African countries.

## Compliance

### Labor Law Compliance

- ✅ Validates against country-specific SMIG
- ✅ Maintains complete salary history
- ✅ Audit trail for all salary changes
- ✅ Approval workflow for transparency

### Data Protection

- ✅ Tenant isolation enforced
- ✅ RLS policies on all tables
- ✅ Sensitive data properly protected

## Documentation

All code includes comprehensive JSDoc comments:
- Function purposes
- Parameter descriptions
- Return types
- Error conditions

## Conclusion

The salary management enhancement provides:

1. **Multi-Country Support**: Dynamic minimum wage validation
2. **Approval Workflows**: Complete review and approval process
3. **Transaction Safety**: Atomic operations prevent partial updates
4. **Event-Driven**: Publishes events for workflow automation
5. **Type-Safe**: Full TypeScript support with tRPC
6. **Scalable**: Caching and proper indexing for performance
7. **Compliant**: Meets West African labor law requirements

All components follow Preem HR's coding standards and architectural patterns.
