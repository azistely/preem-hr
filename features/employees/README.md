# Employee Management Feature

## Overview

Complete employee lifecycle management system with position-based organization, effective-dated salary/assignment tracking, and full CRUD operations. Built with multi-tenancy, PII encryption, and audit trails.

**Status**: ✅ Phase 1-3 Complete (Services & tRPC API)
**Priority**: P0 (MVP Critical)
**Dependencies**: Supabase (RLS), Drizzle ORM, tRPC v11

---

## Architecture

### Directory Structure

```
features/employees/
├── services/
│   ├── employee.service.ts       # Core CRUD operations
│   ├── employee-number.ts        # Sequential number generation
│   ├── position.service.ts       # Position management with hierarchy
│   ├── assignment.service.ts     # Employee-position binding
│   └── salary.service.ts         # Effective-dated salary changes
└── README.md                     # This file

server/routers/
├── employees.ts                  # Employee tRPC router
├── positions.ts                  # Position tRPC router
├── assignments.ts                # Assignment tRPC router
└── salaries.ts                   # Salary tRPC router

lib/
├── crypto.ts                     # PII encryption/decryption (AES-256-GCM)
├── event-bus.ts                  # Domain event publishing
└── errors.ts                     # Custom error classes
```

---

## Key Features Implemented

### ✅ 1. Employee CRUD Operations

**Service**: `employee.service.ts`
**Router**: `employees.ts`

#### Create Employee (Hire)
```typescript
// Input validation with Zod
const employee = await trpc.employees.create.mutate({
  firstName: 'Kouadio',
  lastName: 'Yao',
  email: 'kouadio@example.com',
  hireDate: new Date('2025-01-15'),
  positionId: '...',
  baseSalary: 300000,  // Validated >= SMIG (75,000 FCFA)
  housingAllowance: 50000,
});

// Returns: Employee with encrypted PII, auto-generated employee_number
// Creates: Employee record + Salary record + Assignment record (atomic transaction)
// Emits: 'employee.hired' event
```

**Features**:
- ✅ Auto-generates employee number (`EMP-000001`, `EMP-000002`, etc.)
- ✅ Validates base salary >= SMIG (75,000 FCFA for Côte d'Ivoire)
- ✅ Checks email uniqueness within tenant
- ✅ Encrypts PII (national_id, bank_account) using AES-256-GCM
- ✅ Creates salary and assignment records in single transaction
- ✅ Enforces RLS (tenant isolation)

#### List Employees
```typescript
const { employees, hasMore, nextCursor } = await trpc.employees.list.query({
  status: 'active',       // Filter: active, terminated, suspended
  search: 'Kouadio',      // Search: name, employee_number, email
  positionId: '...',      // Filter by position
  limit: 50,              // Pagination (default 50, max 100)
  cursor: '...',          // Cursor-based pagination
});

// Returns: Decrypted employee records with pagination
```

**Features**:
- ✅ Cursor-based pagination (scalable)
- ✅ Multi-field search (name, email, employee number)
- ✅ Status filtering (active by default)
- ✅ PII decryption for response
- ✅ RLS enforcement

#### Get Employee Details
```typescript
const employee = await trpc.employees.getById.query({ id: '...' });

// Returns:
// - Employee record (decrypted PII)
// - salaryHistory[] (all effective-dated records)
// - assignmentHistory[] (all position changes)
```

#### Update Employee
```typescript
const updated = await trpc.employees.update.mutate({
  id: '...',
  email: 'new@example.com',  // Email uniqueness validated
  phone: '+225 0123456789',
  bankAccount: 'CI93...',    // Re-encrypted on save
});

// Validates: Email uniqueness within tenant
// Emits: 'employee.updated' event
// Immutable fields: employee_number, hire_date, tenant_id
```

#### Terminate Employee
```typescript
const terminated = await trpc.employees.terminate.mutate({
  employeeId: '...',
  terminationDate: new Date('2025-01-31'),
  terminationReason: 'resignation',
});

// Actions:
// 1. Sets status = 'terminated'
// 2. Ends all active assignments (effective_to = termination_date)
// 3. Preserves salary history
// Emits: 'employee.terminated' event
```

**Validation**:
- ❌ Prevents termination_date < hire_date
- ✅ Calculates prorated final pay

#### Suspend / Reactivate
```typescript
// Suspend
await trpc.employees.suspend.mutate({ employeeId: '...' });
// Status: 'active' → 'suspended'
// Emits: 'employee.suspended' event

// Reactivate
await trpc.employees.reactivate.mutate({ employeeId: '...' });
// Status: 'suspended' → 'active'
```

---

### ✅ 2. Position Management

**Service**: `position.service.ts`
**Router**: `positions.ts`

#### Create Position
```typescript
const position = await trpc.positions.create.mutate({
  title: 'Développeur Senior',
  code: 'DEV-001',
  departmentId: '...',
  reportsToPositionId: '...',  // Org hierarchy
  minSalary: 500000,           // Validated >= SMIG
  maxSalary: 1000000,
  weeklyHours: 40,
  headcount: 3,                // Max employees for this position
});

// Validations:
// - minSalary <= maxSalary
// - minSalary >= SMIG
// - No circular reporting (A → B → A)
```

#### Get Organization Hierarchy
```typescript
const hierarchy = await trpc.positions.getHierarchy.query({
  positionId: ceoPositionId,
});

// Returns recursive tree:
// {
//   id: '...',
//   title: 'CEO',
//   reports: [
//     {
//       id: '...',
//       title: 'CTO',
//       reports: [
//         { id: '...', title: 'Developer', reports: [] }
//       ]
//     }
//   ]
// }
```

**Features**:
- ✅ Recursive hierarchy query
- ✅ Prevents circular reporting relationships
- ✅ Salary range validation

---

### ✅ 3. Employee-Position Assignments

**Service**: `assignment.service.ts`
**Router**: `assignments.ts`

#### Create Assignment
```typescript
const assignment = await trpc.assignments.create.mutate({
  employeeId: '...',
  positionId: '...',
  assignmentType: 'primary',   // primary | secondary | temporary
  effectiveFrom: new Date('2025-02-01'),
  effectiveTo: null,           // NULL = current/active
  assignmentReason: 'promotion',
});

// Validations:
// - No overlapping PRIMARY assignments for same employee
// - Position headcount not exceeded
// Emits: 'employee.assigned' event
```

**Assignment Types**:
- **Primary**: Main role (max 1 per employee at any time)
- **Secondary**: Additional responsibilities (matrix reporting)
- **Temporary**: Fixed-term assignments

#### Transfer Employee
```typescript
const newAssignment = await trpc.assignments.transfer.mutate({
  employeeId: '...',
  newPositionId: '...',
  effectiveFrom: new Date('2025-02-01'),  // Can be future-dated
  reason: 'promotion',
});

// Actions:
// 1. Closes current assignment (effective_to = transferDate)
// 2. Creates new assignment (effective_from = transferDate)
// 3. Preserves complete history
// Emits: 'employee.transferred' event
```

---

### ✅ 4. Salary Management (Effective-Dated)

**Service**: `salary.service.ts`
**Router**: `salaries.ts`

#### Change Salary
```typescript
const newSalary = await trpc.salaries.change.mutate({
  employeeId: '...',
  newBaseSalary: 350000,         // Validated >= SMIG
  housingAllowance: 60000,
  effectiveFrom: new Date('2025-02-01'),  // Can be future-dated
  changeReason: 'promotion',
  notes: 'Annual review raise',
});

// Actions:
// 1. Closes current salary (effective_to = change date)
// 2. Creates new salary record (effective_from = change date)
// 3. NO data loss - full history preserved
// Emits: 'salary.changed' event
```

#### Get Current Salary (As of Date)
```typescript
const salary = await trpc.salaries.getCurrent.query({
  employeeId: '...',
  asOfDate: new Date('2025-06-15'),  // Optional, defaults to today
});

// Returns:
// - Effective salary record for given date
// - grossSalary (base + all allowances)
```

**How it Works**:
```sql
-- Query pattern
SELECT * FROM employee_salaries
WHERE employee_id = $1
  AND effective_from <= $2
  AND (effective_to IS NULL OR effective_to > $2)
ORDER BY effective_from DESC
LIMIT 1;
```

#### Get Salary History
```typescript
const history = await trpc.salaries.getHistory.query({
  employeeId: '...',
});

// Returns: All salary records ordered by effective_from (desc)
// [
//   { base_salary: 350000, effective_from: '2025-02-01', effective_to: null },
//   { base_salary: 300000, effective_from: '2024-06-01', effective_to: '2025-02-01' },
//   { base_salary: 200000, effective_from: '2024-01-01', effective_to: '2024-06-01' },
// ]
```

---

## Security & Data Protection

### Multi-Tenancy (RLS)

All queries automatically filter by `tenant_id`:

```typescript
// Context setup (server/api/context.ts)
await db.execute(sql`
  SELECT set_config('app.tenant_id', ${tenantId}, true);
`);

// RLS policy (database level)
CREATE POLICY tenant_isolation ON employees
FOR ALL
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**Result**: Users can ONLY access their own tenant's data, even if they guess UUIDs.

### PII Encryption

**Encrypted Fields** (AES-256-GCM):
- `national_id` (SSN, passport)
- `bank_account` (IBAN, account numbers)

```typescript
// Encryption on write
import { encrypt } from '@/lib/crypto';

const employee = await db.insert(employees).values({
  national_id: encrypt(data.nationalId),  // "1234567890" → "aGVsbG8gd29ybGQ..."
  bank_account: encrypt(data.bankAccount),
});

// Decryption on read
import { decrypt } from '@/lib/crypto';

const decrypted = {
  ...employee,
  national_id: employee.national_id ? decrypt(employee.national_id) : null,
};
```

**Key Management**:
- Environment variable: `ENCRYPTION_KEY`
- Production: Use AWS KMS / Google Cloud KMS / Azure Key Vault
- Key rotation: Re-encrypt all PII with new key

---

## Event-Driven Architecture

All state changes emit domain events for downstream systems:

```typescript
// Event bus (lib/event-bus.ts)
import { eventBus } from '@/lib/event-bus';

// Subscribe to events (e.g., in payroll service)
eventBus.subscribe('employee.hired', async (payload) => {
  // Create payroll profile
  await createPayrollProfile(payload.employeeId);
});

// Emit events (automatically in services)
await eventBus.publish('employee.hired', {
  employeeId: '...',
  tenantId: '...',
  hireDate: new Date(),
  positionId: '...',
});
```

**Available Events**:
- `employee.hired` - New employee created
- `employee.updated` - Employee info changed
- `employee.terminated` - Employee terminated
- `employee.suspended` - Employee suspended
- `employee.transferred` - Position changed
- `salary.changed` - Salary adjusted
- `employee.assigned` - Position assignment created
- `position.created` - New position defined

---

## Validation Rules

### Salary Validation
```typescript
// Minimum wage (SMIG) - Côte d'Ivoire
const SMIG_CI = 75000; // FCFA per month

// Enforced at:
// 1. Employee creation
// 2. Salary change
// 3. Position min_salary

if (baseSalary < SMIG_CI) {
  throw new ValidationError(
    'Le salaire doit être >= SMIG (75000 FCFA)',
    { baseSalary, smig: SMIG_CI }
  );
}
```

**Note**: In future, load SMIG from `countries` table for multi-country support.

### Email Uniqueness
```typescript
// Within tenant only
const existing = await db.query.employees.findFirst({
  where: and(
    eq(employees.tenant_id, tenantId),
    eq(employees.email, email)
  ),
});

if (existing) {
  throw new ConflictError('Un employé avec cet email existe déjà');
}
```

### Assignment Overlap Prevention
```typescript
// Prevent overlapping PRIMARY assignments
// Allowed:  |----A----|
//                        |----B----|

// Forbidden: |----A----|
//                 |----B----|
```

### Circular Reporting Prevention
```typescript
// Prevent: CEO → CTO → Developer → CEO
// Uses recursive check with visited set
```

---

## Error Handling

Custom error classes with French messages:

```typescript
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

// Validation errors
throw new ValidationError(
  'Le salaire doit être >= SMIG (75000 FCFA)',
  { baseSalary: 60000, smig: 75000 }
);

// Not found errors
throw new NotFoundError('Employé', employeeId);
// → "Employé non trouvé: {employeeId}"

// Conflict errors (duplicates)
throw new ConflictError('Un employé avec cet email existe déjà', {
  email: 'duplicate@example.com'
});
```

---

## Database Schema

### Employees Table
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL,  -- Auto-generated: EMP-000001
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT,  -- male, female, other, prefer_not_to_say
  email TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,  -- ENCRYPTED
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country_code TEXT NOT NULL DEFAULT 'CI',
  hire_date DATE NOT NULL,
  termination_date DATE,
  termination_reason TEXT,
  bank_name TEXT,
  bank_account TEXT,  -- ENCRYPTED
  cnps_number TEXT,
  tax_number TEXT,
  tax_dependents INTEGER NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',  -- active, terminated, suspended
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- RLS Policy
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### Employee Salaries (Effective-Dated)
```sql
CREATE TABLE employee_salaries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  housing_allowance NUMERIC(15,2) DEFAULT 0,
  transport_allowance NUMERIC(15,2) DEFAULT 0,
  meal_allowance NUMERIC(15,2) DEFAULT 0,
  other_allowances JSONB DEFAULT '[]',
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  change_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Prevent overlaps
CREATE INDEX idx_salaries_effective ON employee_salaries(employee_id, effective_from, effective_to);
```

### Positions Table
```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  department_id UUID,
  reports_to_position_id UUID,  -- Self-reference for hierarchy
  min_salary NUMERIC(15,2),
  max_salary NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'XOF',
  job_level TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
  work_schedule JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  headcount INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
```

### Assignments Table
```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL DEFAULT 'primary',  -- primary, secondary, temporary
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  assignment_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Prevent overlapping primary assignments
CREATE INDEX idx_assignments_effective ON assignments(employee_id, assignment_type, effective_from, effective_to);
```

---

## API Reference

### Employees Router (`trpc.employees.*`)

| Procedure | Type | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| `create` | mutation | `CreateEmployeeInput` | `Employee` | Hire new employee (creates employee + salary + assignment) |
| `list` | query | `ListEmployeesInput` | `{ employees[], hasMore, nextCursor }` | List with filters and pagination |
| `getById` | query | `{ id: string }` | `Employee & { salaryHistory, assignmentHistory }` | Get full employee details |
| `update` | mutation | `UpdateEmployeeInput` | `Employee` | Update employee info (immutable fields protected) |
| `terminate` | mutation | `{ employeeId, terminationDate, reason }` | `Employee` | Terminate employee (ends assignments) |
| `suspend` | mutation | `{ employeeId }` | `Employee` | Suspend employee |
| `reactivate` | mutation | `{ employeeId }` | `Employee` | Reactivate suspended employee |

### Positions Router (`trpc.positions.*`)

| Procedure | Type | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| `create` | mutation | `CreatePositionInput` | `Position` | Create new position |
| `list` | query | `{ status? }` | `Position[]` | List all positions |
| `getHierarchy` | query | `{ positionId }` | `PositionTree` | Get recursive org hierarchy |

### Assignments Router (`trpc.assignments.*`)

| Procedure | Type | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| `create` | mutation | `CreateAssignmentInput` | `Assignment` | Create employee-position assignment |
| `transfer` | mutation | `TransferEmployeeInput` | `Assignment` | Transfer employee to new position |
| `getCurrent` | query | `{ employeeId, type?, asOfDate? }` | `Assignment` | Get current assignment as of date |

### Salaries Router (`trpc.salaries.*`)

| Procedure | Type | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| `change` | mutation | `ChangeSalaryInput` | `EmployeeSalary` | Change salary (effective-dated) |
| `getCurrent` | query | `{ employeeId, asOfDate? }` | `EmployeeSalary & { grossSalary }` | Get effective salary as of date |
| `getHistory` | query | `{ employeeId }` | `EmployeeSalary[]` | Get complete salary history |

---

## Next Steps (UI Implementation)

### Pending Tasks
- [ ] Employee List Page (`app/employees/page.tsx`)
- [ ] Employee Detail Page (`app/employees/[id]/page.tsx`)
- [ ] Employee Form Wizard (`app/employees/new/page.tsx`)
- [ ] Comprehensive tests for all services

### UI/UX Requirements (From HCI Principles)

**Must Follow**:
- ✅ **French language** for all UI text
- ✅ **Touch targets** ≥ 44×44px (mobile-first)
- ✅ **Wizard pattern** for complex forms (3-5 steps)
- ✅ **Smart defaults** (hire_date = today, status = 'active')
- ✅ **Progressive disclosure** (show essentials, hide complexity)
- ✅ **Error prevention** (disable invalid actions, not just error messages)
- ✅ **Immediate feedback** (optimistic UI, loading states)

**Example Wizard Flow** (Create Employee):
```
Step 1: Informations Personnelles
  - Prénom, Nom, Email, Date de naissance

Step 2: Poste et Salaire
  - Position (dropdown), Salaire de base (validated >= SMIG)

Step 3: Confirmation
  - Review all info, auto-calculated employee number shown
  - Big "Créer l'employé" button (min-h-[56px])
```

---

## Testing Checklist

Before marking complete:
- [ ] All CRUD operations enforce RLS
- [ ] PII fields encrypted at rest
- [ ] Effective dating works for salaries and assignments
- [ ] No data loss when changing salaries/positions
- [ ] Audit logs capture all changes (TODO: implement audit_logs table)
- [ ] Events emitted for downstream systems
- [ ] French error messages throughout
- [ ] Validation prevents data integrity issues
- [ ] Can retrieve historical data (salary as of date X)
- [ ] Performance: List 1000 employees < 500ms

---

## References

- **Epic Document**: `/docs/06-EPIC-EMPLOYEE-MANAGEMENT.md`
- **Constraints**: `/docs/01-CONSTRAINTS-AND-RULES.md`
- **HCI Principles**: `/docs/HCI-DESIGN-PRINCIPLES.md`
- **Database Schema**: `/lib/db/schema/*.ts`

---

**Last Updated**: 2025-10-05
**Status**: Backend Complete, UI Pending
