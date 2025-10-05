# 🚫 Constraints, Anti-Patterns & Hard Rules

## ⚠️ SOURCE OF TRUTH - Non-Negotiable Constraints

These rules **MUST NEVER** be violated. If asked to break these rules, explain the constraint and suggest a compliant alternative.

---

## 1. Database Constraints

### 1.1 Multi-Tenancy (CRITICAL)

```sql
-- ✅ CORRECT: Every tenant-scoped table MUST have tenant_id
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- ... other fields
  CONSTRAINT employees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ❌ WRONG: Missing tenant_id
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  name TEXT  -- WILL CAUSE DATA LEAKS!
);
```

**Rule:** Row-Level Security (RLS) policies MUST filter by `tenant_id` for all tenant-scoped tables.

**Verification Checklist:**
- [ ] Does the table contain tenant-specific data?
- [ ] Does it have `tenant_id UUID NOT NULL`?
- [ ] Does it have RLS policy: `tenant_id = auth.jwt() ->> 'tenant_id'`?
- [ ] Does it have CASCADE delete on tenant?

### 1.2 Effective Dating (CRITICAL)

```sql
-- ✅ CORRECT: Salary changes use effective dating
CREATE TABLE employee_salaries (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current/active
  base_salary NUMERIC(15,2) NOT NULL,
  CONSTRAINT no_overlap_check EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);

-- ❌ WRONG: Updating existing row (loses history)
UPDATE employees SET base_salary = 350000 WHERE id = '...';
```

**Rule:** Never UPDATE historical data. INSERT new effective-dated row instead.

**Which tables need effective dating?**
- ✅ Salaries, positions, assignments, tax rates, organization structure
- ❌ Audit logs, events, transactions (these are immutable)

### 1.3 Forbidden Patterns

#### ❌ EAV (Entity-Attribute-Value) Anti-Pattern
```sql
-- ❌ WRONG: Generic key-value store
CREATE TABLE entity_attributes (
  entity_id UUID,
  attribute_name TEXT,
  attribute_value TEXT  -- Everything as text!
);
```

```sql
-- ✅ CORRECT: Typed JSONB with schema validation
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  custom_fields JSONB,  -- Validated by Zod schema
  CONSTRAINT valid_custom_fields CHECK (
    jsonb_typeof(custom_fields) = 'object'
  )
);
```

**Use JSONB only when:**
- Fields are truly dynamic per tenant
- You have Zod validation in application layer
- You don't need to query/index these fields frequently

#### ❌ Soft Deletes (Use with Caution)
```sql
-- ❌ AVOID: Complicates every query
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  deleted_at TIMESTAMP  -- Now every query needs WHERE deleted_at IS NULL
);

-- ✅ PREFER: Move to archive table
CREATE TABLE employees_archived (
  -- Same schema as employees
  archived_at TIMESTAMP NOT NULL DEFAULT now(),
  archived_by UUID NOT NULL,
  archive_reason TEXT
);
```

**Exception:** Soft delete is OK for user-facing "trash" features with auto-purge.

---

## 2. Architecture Constraints

### 2.1 Bounded Contexts (CRITICAL)

```typescript
// ✅ CORRECT: Each module is self-contained
src/features/payroll/
  ├── api/payroll.router.ts       // tRPC router
  ├── services/calculation.ts      // Business logic
  ├── events/payroll.events.ts     // Event definitions
  └── types.ts                     // Domain types

// ❌ WRONG: Directly importing from another feature
import { createEmployee } from '@/features/employees/services/employee.service';
// Instead, emit event: emit('employee.created', { ... })
```

**Module Boundaries:**

| Module | CAN Access | CANNOT Access |
|--------|------------|---------------|
| `payroll` | Own services, `db` module, emit events | Direct employee creation, time-off approval |
| `employees` | Own services, position assignments | Payroll calculation, workflow execution |
| `time-tracking` | Geolocation validation | Employee salary data, payroll runs |

**Communication:** Modules communicate via:
1. **Events** (async, decoupled)
2. **Shared read models** (query only, no writes)
3. **API contracts** (tRPC procedures)

### 2.2 CQRS Pattern (Required for Payroll)

```typescript
// ✅ CORRECT: Separate command and query
// Command (write)
export const runPayrollCommand = async (cmd: RunPayrollCommand) => {
  // Validate, calculate, save
  const result = await db.transaction(async (tx) => {
    // ... complex calculation
    await tx.insert(payrollRuns).values(runData);
    await eventBus.publish('payroll.run.completed', { runId });
  });
  return result.id;
};

// Query (read) - denormalized view
export const getPayrollRunQuery = async (runId: string) => {
  return await db.query.payroll_runs_view.findFirst({
    where: eq(payroll_runs_view.id, runId),
    with: { lineItems: true, employee: true }
  });
};

// ❌ WRONG: Mixing reads and writes
export const runPayroll = async (data: any) => {
  const employees = await getEmployees(); // Query
  const calculated = calculate(employees); // Logic
  await savePayroll(calculated); // Command
  return await getPayroll(calculated.id); // Query
  // This tightly couples reads/writes and complicates testing
};
```

**When to use CQRS:**
- ✅ Payroll (complex calculation, audit requirements)
- ✅ Workflow state machines (many state transitions)
- ❌ Simple CRUD (employees, positions)

---

## 3. Code Quality Constraints

### 3.1 TypeScript Strictness

```json
// tsconfig.json - SOURCE OF TRUTH
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**❌ FORBIDDEN:**
```typescript
// Never use 'any'
const data: any = fetchData();

// Never use type assertion without validation
const employee = data as Employee;

// Never ignore TypeScript errors
// @ts-ignore
const result = dangerousFunction();
```

**✅ REQUIRED:**
```typescript
// Use Zod for runtime validation
const employeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  salary: z.number().min(75000), // SMIG minimum
});

const employee = employeeSchema.parse(data);
```

### 3.2 Error Handling Pattern

```typescript
// ✅ CORRECT: Domain-specific errors
export class PayrollValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PayrollValidationError';
  }
}

throw new PayrollValidationError(
  'Salaire inférieur au SMIG',
  'SALARY_BELOW_SMIG',
  { salary: 60000, smig: 75000 }
);

// ❌ WRONG: Generic errors
throw new Error('Invalid salary');
```

**Error Hierarchy:**
```
AppError (base)
├── ValidationError (user input issues)
├── BusinessRuleError (domain constraint violations)
├── IntegrationError (external system failures)
└── SystemError (infrastructure failures)
```

### 3.3 File Size Limits

**Hard Limits:**
- React components: **≤ 300 lines** (split into sub-components)
- Service files: **≤ 500 lines** (extract domain logic)
- API routers: **≤ 400 lines** (split into sub-routers)

**If file exceeds limit:**
1. ⚠️ Add comment: `// WARN: Large file - refactor before adding more`
2. Get explicit approval for changes
3. Plan refactoring in next sprint

---

## 4. Security Constraints

### 4.1 PII Data Handling

```typescript
// ✅ CORRECT: Encrypted at rest, masked in logs
import { encrypt, decrypt } from '@/lib/crypto';

const employee = await db.insert(employees).values({
  name: data.name, // Not PII in this context
  national_id: encrypt(data.nationalId), // PII - encrypted
  bank_account: encrypt(data.bankAccount), // PII - encrypted
});

logger.info('Employee created', {
  employeeId: employee.id,
  // ❌ NEVER log PII
  // nationalId: data.nationalId,  // FORBIDDEN
});

// ❌ WRONG: PII in plain text
await db.insert(employees).values({
  national_id: data.nationalId, // Violates GDPR
});
```

**PII Fields (MUST encrypt):**
- National ID, passport, driver's license
- Bank account numbers, IBAN
- Personal email, phone (if not business)
- Medical information, biometric data

### 4.2 Row-Level Security (RLS) Policy Pattern

```sql
-- ✅ CORRECT: RLS for multi-tenancy
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON employees
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY super_admin_access ON employees
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- ❌ WRONG: Checking tenant_id in application code
const employees = await db.query.employees.findMany({
  where: eq(employees.tenant_id, currentTenant.id) // Race condition risk
});
```

**Verification:** Every table with `tenant_id` must have RLS enabled.

---

## 5. Data Validation Constraints

### 5.1 Côte d'Ivoire Payroll Rules (SOURCE OF TRUTH)

**From:** `payroll-cote-d-ivoire.md`

```typescript
// ✅ CORRECT: Constants from source document
export const COTE_IVOIRE_RULES = {
  SMIG: 75000, // FCFA - Minimum monthly salary (as of 2023)
  LEGAL_WORK_HOURS_WEEK: 40,
  LEGAL_WORK_HOURS_WEEK_AGRICULTURE: 48,

  // Overtime multipliers (Article from Code du travail)
  OVERTIME: {
    HOURS_41_TO_46: 1.15,
    HOURS_ABOVE_46: 1.50,
    NIGHT_WORK: 1.75,
    SUNDAY_OR_HOLIDAY: 1.75,
    NIGHT_SUNDAY_OR_HOLIDAY: 2.00,
  },

  // CNPS Contributions (2025 rates)
  CNPS: {
    PENSION_EMPLOYEE: 0.063,
    PENSION_EMPLOYER: 0.077,
    MATERNITY_EMPLOYER: 0.0075,
    FAMILY_ALLOWANCE_EMPLOYER: 0.05,
    WORK_ACCIDENT_EMPLOYER_MIN: 0.02,
    WORK_ACCIDENT_EMPLOYER_MAX: 0.05,
    PENSION_CEILING: 3_375_000, // 45 × SMIG
    OTHER_CEILING: 70_000,
  },

  // CMU (Universal Health Coverage)
  CMU: {
    EMPLOYEE: 1000, // Fixed amount
    EMPLOYER_PER_EMPLOYEE: 500,
    EMPLOYER_FAMILY: 4500, // Spouse + up to 6 children
  },

  // ITS (Tax on Salaries) - 2024 reform
  ITS_BRACKETS: [
    { min: 0, max: 300_000, rate: 0 },
    { min: 300_000, max: 547_000, rate: 0.10 },
    { min: 547_000, max: 979_000, rate: 0.15 },
    { min: 979_000, max: 1_519_000, rate: 0.20 },
    { min: 1_519_000, max: 2_644_000, rate: 0.25 },
    { min: 2_644_000, max: 4_669_000, rate: 0.35 },
    { min: 4_669_000, max: 10_106_000, rate: 0.45 },
    { min: 10_106_000, max: Infinity, rate: 0.60 },
  ],
} as const;

// ❌ WRONG: Hardcoded values without source
const MINIMUM_WAGE = 70000; // Where did this come from?
```

**Validation Rule:**
```typescript
// All payroll constants MUST reference payroll-cote-d-ivoire.md
// Include line number for verification
export const SMIG = 75000; // See payroll-cote-d-ivoire.md:24
```

### 5.2 Validation Schemas (Zod)

```typescript
// ✅ CORRECT: Domain-aware validation
import { COTE_IVOIRE_RULES } from './constants';

export const baseSalarySchema = z.object({
  amount: z.number()
    .min(COTE_IVOIRE_RULES.SMIG, {
      message: `Le salaire doit être supérieur ou égal au SMIG (${COTE_IVOIRE_RULES.SMIG} FCFA)`
    })
    .max(100_000_000, { message: 'Montant invalide' }),
  currency: z.literal('XOF'), // West African CFA franc
  effectiveFrom: z.date(),
});

// ❌ WRONG: Generic validation
const salarySchema = z.object({
  amount: z.number().positive(), // Allows below SMIG!
});
```

---

## 6. Testing Constraints

### 6.1 Required Test Coverage

| Layer | Minimum Coverage | Critical Paths Coverage |
|-------|-----------------|------------------------|
| Domain Logic (payroll calculation) | 95% | 100% |
| API Routes | 80% | 100% |
| Database queries | 70% | N/A |
| UI Components | 60% | 90% |

**Critical Paths:**
- Payroll calculation (all tax brackets)
- Multi-tenancy isolation
- Effective dating queries
- Event publishing/handling

### 6.2 Test Data (Real Examples)

```typescript
// ✅ CORRECT: Use examples from payroll-cote-d-ivoire.md
describe('Payroll Calculation - Côte d\'Ivoire', () => {
  it('should calculate net salary for 300,000 FCFA gross (Example 7.1)', () => {
    // From payroll-cote-d-ivoire.md:148-161
    const result = calculatePayroll({
      grossSalary: 300_000,
      country: 'CI',
    });

    expect(result.cnpsEmployee).toBe(18_900); // 300k × 6.3%
    expect(result.cmu).toBe(1_000);
    expect(result.taxableIncome).toBe(280_100); // 300k - 19,900
    expect(result.its).toBeCloseTo(60_815, 0); // From barème progressif
    expect(result.netSalary).toBeCloseTo(219_285, 0);
  });
});

// ❌ WRONG: Random test data
it('should calculate salary', () => {
  const result = calculatePayroll({ grossSalary: 100000 });
  expect(result.netSalary).toBeGreaterThan(0); // Meaningless assertion
});
```

---

## 7. UI/UX Constraints (Low Digital Literacy)

### 7.1 French Language (PRIMARY)

```typescript
// ✅ CORRECT: French as primary, stored in next-intl files
// locales/fr.json
{
  "payroll": {
    "grossSalary": "Salaire brut",
    "netSalary": "Salaire net",
    "cnpsContributions": "Cotisations CNPS",
    "its": "Impôt sur les traitements et salaires (ITS)"
  }
}

// ❌ WRONG: English or mixed
const label = "Gross Salary"; // Users don't understand English
const mixed = "Salaire (Gross)"; // Confusing
```

**Terminology Standards:**
- Use terms from official Ivorian documents
- No tech jargon: "erreur" not "exception", "enregistrer" not "commit"
- Prefer verbs: "Calculer la paie" not "Calcul de paie"

### 7.2 Touch Target Sizes

```tsx
// ✅ CORRECT: Minimum 44x44px for all interactive elements
<button className="min-h-[44px] min-w-[44px] px-4 py-3">
  Enregistrer
</button>

// ❌ WRONG: Too small for touch
<button className="text-sm p-1">Enregistrer</button>
```

### 7.3 Progressive Disclosure

```tsx
// ✅ CORRECT: Show only essential info, expand on demand
<PayrollSummary>
  <p>Salaire net: {formatCurrency(netSalary)}</p>
  <Collapsible trigger="Voir les détails">
    <p>Salaire brut: {formatCurrency(grossSalary)}</p>
    <p>CNPS: {formatCurrency(cnps)}</p>
    <p>ITS: {formatCurrency(its)}</p>
  </Collapsible>
</PayrollSummary>

// ❌ WRONG: Information overload
<div>
  <p>Gross: {gross}</p>
  <p>CNPS Employee: {cnpsEmp}</p>
  <p>CNPS Employer: {cnpsEr}</p>
  <p>Taxable Income: {taxable}</p>
  <p>ITS Bracket 1: {br1}</p>
  {/* 20 more lines... */}
</div>
```

---

## 8. Performance Constraints

### 8.1 Query Optimization

```typescript
// ✅ CORRECT: Indexed queries with limits
const employees = await db.query.employees.findMany({
  where: and(
    eq(employees.tenant_id, tenantId),
    eq(employees.status, 'active')
  ),
  limit: 100,
  orderBy: desc(employees.created_at),
  with: {
    currentPosition: true, // Use joins, not N+1
  }
});

// ❌ WRONG: N+1 query problem
const employees = await getEmployees(tenantId);
for (const emp of employees) {
  emp.position = await getPosition(emp.id); // Separate query per employee!
}
```

**Indexes Required:**
```sql
-- Multi-tenant queries
CREATE INDEX idx_employees_tenant_status
  ON employees(tenant_id, status);

-- Effective dating lookups
CREATE INDEX idx_salaries_effective
  ON employee_salaries(employee_id, effective_from, effective_to);
```

### 8.2 Mobile Data Limits

**Rule:** Mobile screens should load < 100KB initial payload (excluding images).

```typescript
// ✅ CORRECT: Lazy load heavy components
const PayrollCalculator = dynamic(() => import('./PayrollCalculator'), {
  loading: () => <Skeleton />,
});

// ❌ WRONG: Import entire library
import _ from 'lodash'; // 70KB!
// Use: import { debounce } from 'lodash-es';
```

---

## 9. Deployment Constraints

### 9.1 Environment Variables (NEVER COMMIT)

```bash
# .env.example ✅ Commit this
DATABASE_URL=postgresql://localhost:5432/preem_dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# .env.local ❌ NEVER commit (in .gitignore)
DATABASE_URL=postgresql://prod-db-url
SUPABASE_SERVICE_ROLE_KEY=actual-secret-key
ENCRYPTION_KEY=actual-encryption-key
```

### 9.2 Migration Safety

```sql
-- ✅ CORRECT: Reversible migration
-- up.sql
ALTER TABLE employees ADD COLUMN phone TEXT;

-- down.sql
ALTER TABLE employees DROP COLUMN phone;

-- ❌ FORBIDDEN: Irreversible migration
ALTER TABLE employees DROP COLUMN salary; -- DATA LOSS!
```

**Rules:**
- Never drop columns (mark as deprecated instead)
- Never modify existing migration files (create new ones)
- Test migrations on staging before production

---

## 10. Deprecated Patterns (DO NOT USE)

```typescript
// ❌ FORBIDDEN (Even if found in old code)
class EmployeeService { } // Use functions, not classes
moment(date).format();    // Use date-fns
axios.get(url);           // Use native fetch + apiClient wrapper
var x = 5;                // Use const/let
```

**If you see these patterns:**
1. ⚠️ Do NOT replicate them
2. Flag for refactoring: `// TODO: Migrate from moment to date-fns`
3. Ask: *"Should I refactor this while I'm here?"*

---

## 11. AI Assistant Self-Check

Before submitting code, verify:

- [ ] Did I **READ** the actual schema file, or assume table structure?
- [ ] Are payroll constants from `payroll-cote-d-ivoire.md`?
- [ ] Does every tenant-scoped table have `tenant_id` + RLS?
- [ ] Am I using effective dating for historical data?
- [ ] Are errors domain-specific (not generic)?
- [ ] Is PII encrypted before storage?
- [ ] Are all strings in French (locales/fr.json)?
- [ ] Did I add acceptance criteria to tasks?
- [ ] Is this pattern from the codebase or "common practice"?

**When uncertain:** Say *"Let me verify against [source file]..."* and read it.

---

## 12. Getting Approval for Exceptions

If you must violate a constraint:

1. **Explain the constraint** to the user
2. **Propose a compliant alternative**
3. **If they insist,** ask: *"This violates [rule]. Please confirm you want to override."*
4. **Document the exception:**
   ```typescript
   // EXCEPTION APPROVED 2025-01-15: Using soft delete for user-facing trash
   // Discussed with: [Name], Reason: [Reason]
   ```

---

**Next:** Read `02-ARCHITECTURE-OVERVIEW.md` to understand system design.
