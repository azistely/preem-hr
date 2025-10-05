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
    FAMILY_ALLOWANCE_EMPLOYER: 0.05, // Includes maternity (5.0% total, not 5.75%)
    WORK_ACCIDENT_EMPLOYER_MIN: 0.02,
    WORK_ACCIDENT_EMPLOYER_MAX: 0.05,
    PENSION_CEILING: 3_375_000, // 45 × SMIG
    OTHER_CEILING: 70_000,
  },

  // CMU (Universal Health Coverage)
  CMU: {
    EMPLOYEE: 1000, // Fixed amount per month
    EMPLOYER_PER_EMPLOYEE: 500,
    EMPLOYER_FAMILY: 4500, // Spouse + up to 6 children
  },

  // ITS (Tax on Salaries) - 2025 reform - MONTHLY progressive calculation
  ITS_BRACKETS: [
    { min: 0, max: 75_000, rate: 0 },
    { min: 75_000, max: 240_000, rate: 0.16 },
    { min: 240_000, max: 800_000, rate: 0.21 },
    { min: 800_000, max: 2_400_000, rate: 0.24 },
    { min: 2_400_000, max: 8_000_000, rate: 0.28 },
    { min: 8_000_000, max: Infinity, rate: 0.32 },
  ],

  // ITS Family Deductions (Parts fiscales)
  FAMILY_DEDUCTIONS: {
    1: 0,
    1.5: 5_500,
    2: 11_000,
    2.5: 16_500,
    3: 22_000,
    3.5: 27_500,
    4: 33_000,
    4.5: 38_500,
    5: 44_000,
  },

  // FDFP Training Taxes (Employer only, based on Brut Imposable)
  FDFP: {
    TAP: 0.004, // Taxe d'Apprentissage (0.4%)
    TFPC: 0.012, // Formation Professionnelle Continue (1.2%)
    TOTAL: 0.016, // Total 1.6%
  },
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

## 7. UI/UX Constraints (HCI-Driven Design for Low Digital Literacy)

> **PHILOSOPHY:** The system must be so intuitive that users with **zero HR/payroll knowledge** and **low digital literacy** can complete **complex tasks effortlessly**. The UI hides all complexity while remaining **simple, modern, and elegant**.

### 7.0 Core HCI Principles (MANDATORY)

**Human-Computer Interaction Best Practices:**

1. **Zero Learning Curve** - Users should understand what to do instantly, no training required
2. **Task-Oriented Design** - Design around user goals ("Pay my employees"), not system operations
3. **Error Prevention Over Error Handling** - Make it impossible to make mistakes
4. **Cognitive Load Minimization** - Show only what's needed for the current step
5. **Immediate Feedback** - Every action gets instant, clear visual confirmation
6. **Graceful Degradation** - Works perfectly on slow networks and old devices

**Design Checklist (EVERY feature MUST pass):**
- [ ] Can a user with no HR knowledge complete this task?
- [ ] Can it be done on a slow 3G connection?
- [ ] Are there fewer than 3 steps to complete the primary action?
- [ ] Is the primary action obvious within 3 seconds?
- [ ] Can it be used with one hand on a 5" phone screen?
- [ ] Does it work without any help text or documentation?

### 7.1 Complexity Abstraction (CRITICAL)

**Rule:** Hide technical complexity, show business outcomes.

```tsx
// ✅ CORRECT: User sees outcomes, not mechanics
<PayrollRunWizard>
  <Step1>
    <h2>Quelle période voulez-vous payer?</h2>
    <MonthPicker /> {/* Simple month selector */}
  </Step1>

  <Step2>
    <h2>Vérifiez les salaires</h2>
    <EmployeeList showOnly={['name', 'netPay']} />
    {/* Complex calculations hidden, just show net amounts */}
  </Step2>

  <Step3>
    <h2>Confirmer le paiement</h2>
    <BigButton>Payer {employeeCount} employés - {totalAmount} FCFA</BigButton>
  </Step3>
</PayrollRunWizard>

// ❌ WRONG: Exposing system complexity
<PayrollForm>
  <label>Tax System ID:</label> {/* User doesn't know what this is */}
  <input name="taxSystemId" />

  <label>Contribution Type Override:</label>
  <select>{/* Technical details exposed */}</select>

  <label>Bracket Calculation Strategy:</label>
  <input name="strategyClass" /> {/* Implementation detail leaked */}
</PayrollForm>
```

**Abstraction Patterns:**
- Replace technical terms with business language ("tax system" → "pays")
- Hide all IDs, codes, technical configuration from UI
- Use smart defaults (auto-detect period, sector, etc.)
- Bundle related fields into single interactions

### 7.2 Guided Task Flows (Wizards > Forms)

```tsx
// ✅ CORRECT: Wizard breaks complex task into simple steps
<CreateEmployeeWizard>
  <WizardStep title="Informations de base" icon={User}>
    {/* Only: name, date of birth */}
  </WizardStep>

  <WizardStep title="Poste et salaire" icon={Briefcase}>
    {/* Only: job title, monthly salary */}
  </WizardStep>

  <WizardStep title="Confirmation" icon={Check}>
    {/* Review + auto-calculated values shown */}
  </WizardStep>
</CreateEmployeeWizard>

// ❌ WRONG: Overwhelming single form
<EmployeeForm>
  {/* 30 fields on one page, user doesn't know where to start */}
  <input name="firstName" />
  <input name="lastName" />
  <input name="ssn" />
  <input name="taxId" />
  <input name="bankAccount" />
  {/* ... 25 more fields */}
</EmployeeForm>
```

**Wizard Best Practices:**
- Max 3-5 steps per task
- Each step has ONE clear goal
- Always show progress (Step 2 of 3)
- Allow going back to edit
- Auto-save on every step

### 7.3 French Language (PRIMARY)

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
- Use everyday language: "famille" not "parts fiscales"

### 7.4 Touch Target Sizes (Mobile-First)

```tsx
// ✅ CORRECT: Minimum 44x44px for all interactive elements
<button className="min-h-[44px] min-w-[44px] px-4 py-3 text-lg">
  Enregistrer
</button>

// ❌ WRONG: Too small for touch
<button className="text-sm p-1">Enregistrer</button>
```

**Spacing Requirements:**
- Buttons: min 44×44px (56×56px preferred for primary actions)
- Input fields: min 48px height
- Spacing between touch targets: min 8px
- Text size: min 16px (no zoom on mobile)

### 7.5 Progressive Disclosure (Show Less, Reveal More)

```tsx
// ✅ CORRECT: Show only essential info, expand on demand
<PayrollSummary>
  <div className="text-3xl font-bold text-primary">
    {formatCurrency(netSalary)} FCFA
  </div>
  <p className="text-sm text-muted-foreground">Salaire net à payer</p>

  <Collapsible>
    <CollapsibleTrigger className="touch-target">
      <ChevronDown /> Voir les détails
    </CollapsibleTrigger>
    <CollapsibleContent>
      <DetailedBreakdown /> {/* Complex calculations */}
    </CollapsibleContent>
  </Collapsible>
</PayrollSummary>

// ❌ WRONG: Information overload
<div>
  <p>Gross: {gross}</p>
  <p>CNPS Employee: {cnpsEmp}</p>
  <p>CNPS Employer: {cnpsEr}</p>
  <p>Taxable Income: {taxable}</p>
  <p>ITS Bracket 1: {br1}</p>
  {/* 20 more lines... User is overwhelmed */}
</div>
```

**Progressive Disclosure Rules:**
- Default view: Show only what user NEEDS (outcome)
- Advanced view: Show what user MIGHT WANT (breakdown)
- Expert view: Show everything (for accountants)
- Never show all three levels at once

### 7.6 Visual Hierarchy & Scannability

```tsx
// ✅ CORRECT: Clear visual hierarchy
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-2xl">Janvier 2025</CardTitle>
        <CardDescription>15 employés</CardDescription>
      </div>
      <Badge variant="success" className="text-lg">
        <Check className="mr-2" /> Payé
      </Badge>
    </div>
  </CardHeader>

  <CardContent>
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Salaires nets"
        value="3,250,000 FCFA"
        icon={DollarSign}
        size="large" // Primary metric
      />
      <StatCard
        label="Cotisations"
        value="850,000 FCFA"
        size="medium" // Secondary metric
      />
      <StatCard
        label="Impôts"
        value="420,000 FCFA"
        size="medium"
      />
    </div>
  </CardContent>
</Card>

// ❌ WRONG: Everything looks the same
<div>
  <p>Period: January 2025</p>
  <p>Employees: 15</p>
  <p>Net Salaries: 3,250,000</p>
  <p>Contributions: 850,000</p>
  <p>Taxes: 420,000</p>
  {/* No hierarchy, hard to scan */}
</div>
```

**Hierarchy Principles:**
- Size indicates importance (text-3xl > text-lg > text-sm)
- Color indicates meaning (primary = action, destructive = warning)
- Icons clarify purpose (Calendar, Users, DollarSign)
- White space separates concepts

### 7.7 Smart Defaults & Auto-Fill

```tsx
// ✅ CORRECT: Intelligent defaults
<CreatePayrollRunForm>
  <MonthPicker
    defaultValue={currentMonth} // Auto-select current month
    minDate={lastPayrollMonth} // Can't duplicate
  />

  <DatePicker
    label="Date de paiement"
    defaultValue={getNextWorkingDay(endOfMonth)} // Auto-calculate
    hint="Habituellement le 5 du mois suivant"
  />

  <EmployeeSelector
    defaultValue={activeEmployees} // Auto-select all active
    hint="{count} employés sélectionnés"
  />
</CreatePayrollRunForm>

// ❌ WRONG: User has to figure everything out
<form>
  <input name="periodStart" type="date" /> {/* Empty, no hint */}
  <input name="periodEnd" type="date" />
  <input name="paymentDate" type="date" />
  <select name="employees" multiple> {/* No defaults */}
    <option>...1000 employees...</option>
  </select>
</form>
```

**Smart Default Rules:**
- Pre-fill fields with 95% probable value
- Use business logic (next working day, current period)
- Show what was auto-filled (don't hide it)
- Make it easy to override

### 7.8 Error Prevention (Better than Error Messages)

```tsx
// ✅ CORRECT: Prevent errors before they happen
<SalaryInput
  label="Salaire de base"
  min={75000} // Enforced at input level
  hint="Minimum légal: 75,000 FCFA (SMIG)"
  validate={(value) => {
    if (value < 75000) {
      return "Le salaire doit être au moins 75,000 FCFA";
    }
  }}
/>

<DateRangePicker
  minDate={new Date('2020-01-01')}
  maxDate={today}
  disabledDates={publicHolidays} // Can't select invalid dates
/>

// ❌ WRONG: Let user make mistake, then complain
<input type="number" name="salary" />
{/* User enters 50000, submits, sees error */}
```

**Prevention Strategies:**
- Disable invalid options (grayed out)
- Use appropriate input types (date picker vs text)
- Validate on blur (immediate feedback)
- Show constraints upfront (min/max in label)

### 7.9 Accessibility & Inclusion (WCAG 2.1 AA)

```tsx
// ✅ CORRECT: Fully accessible
<Button
  aria-label="Créer une nouvelle paie pour janvier 2025"
  className="touch-target"
>
  <Plus className="mr-2" aria-hidden="true" />
  Nouvelle Paie
</Button>

<FormField>
  <Label htmlFor="salary">Salaire de base</Label>
  <Input
    id="salary"
    type="number"
    aria-describedby="salary-hint"
    aria-invalid={errors.salary ? 'true' : 'false'}
  />
  <FormDescription id="salary-hint">
    Minimum 75,000 FCFA (SMIG)
  </FormDescription>
  {errors.salary && (
    <FormMessage role="alert">{errors.salary}</FormMessage>
  )}
</FormField>

// ❌ WRONG: Inaccessible
<button> {/* No label */}
  <PlusIcon /> {/* Icon without text */}
</button>

<input /> {/* No label, no description, no error handling */}
```

**Accessibility Checklist:**
- [ ] All interactive elements have labels
- [ ] Color is not the only indicator (use icons + text)
- [ ] Keyboard navigation works perfectly
- [ ] Screen reader announces everything correctly
- [ ] Error messages are announced (role="alert")
- [ ] Touch targets meet 44×44px minimum

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
