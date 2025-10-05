# 🧪 Testing Strategy & Patterns

## Testing Philosophy

**Goal:** Prevent regressions, ensure compliance, enable confident refactoring.

**Approach:** Test pyramid with emphasis on domain logic and integration tests.

---

## 1. Test Pyramid

```
         /\
        /E2E\          10% - Critical user flows
       /------\
      /Integr-\       30% - API + DB integration
     /----------\
    /Unit Tests \    60% - Business logic, calculations
   /--------------\
```

---

## 2. Unit Tests

### 2.1 What to Test

**✅ Always test:**
- Payroll calculations (gross → net)
- Tax bracket calculations (ITS progressive)
- CNPS contribution calculations
- Overtime classification and multipliers
- Salary prorating (mid-month hire/term)
- Leave accrual calculations
- Business rule validation

**❌ Don't unit test:**
- Database queries (use integration tests)
- tRPC routers (use integration tests)
- React components (use integration/E2E)
- Simple getters/setters

### 2.2 Payroll Calculation Tests (Critical)

```typescript
// tests/unit/payroll/gross-calculation.test.ts

import { calculateGrossSalary } from '@/features/payroll/services/gross-calculation';
import { COTE_IVOIRE_RULES } from '@/features/payroll/constants';

describe('Gross Salary Calculation', () => {
  describe('Full Month Salary', () => {
    it('should calculate full month salary with allowances', () => {
      const result = calculateGrossSalary({
        baseSalary: 300000,
        housingAllowance: 50000,
        transportAllowance: 25000,
        mealAllowance: 15000,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      });

      expect(result.basePay).toBe(300000);
      expect(result.allowances).toBe(90000);
      expect(result.grossSalary).toBe(390000);
      expect(result.daysWorked).toBe(31);
    });
  });

  describe('Prorated Salary (Mid-Month Hire)', () => {
    it('should prorate for mid-month hire (from official example)', () => {
      // Hired on Jan 15, worked 17 days out of 31
      const result = calculateGrossSalary({
        baseSalary: 300000,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        hireDate: new Date('2025-01-15'),
      });

      const expectedProrated = 300000 * (17 / 31); // 164,516 FCFA
      expect(result.basePay).toBeCloseTo(164516, 0);
      expect(result.daysWorked).toBe(17);
    });

    it('should prorate for mid-month termination', () => {
      // Terminated on Jan 15, worked 15 days out of 31
      const result = calculateGrossSalary({
        baseSalary: 200000,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        terminationDate: new Date('2025-01-15'),
      });

      const expectedProrated = 200000 * (15 / 31); // 96,774 FCFA
      expect(result.basePay).toBeCloseTo(96774, 0);
      expect(result.daysWorked).toBe(15);
    });

    it('should handle hire and termination in same month', () => {
      // Hired Jan 10, terminated Jan 20 → 11 days
      const result = calculateGrossSalary({
        baseSalary: 100000,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        hireDate: new Date('2025-01-10'),
        terminationDate: new Date('2025-01-20'),
      });

      expect(result.daysWorked).toBe(11);
      expect(result.basePay).toBeCloseTo(35484, 0); // 100k × (11/31)
    });
  });

  describe('Validation', () => {
    it('should reject salary below SMIG', () => {
      expect(() => {
        calculateGrossSalary({
          baseSalary: 50000, // Below SMIG (75,000)
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
        });
      }).toThrow('Le salaire doit être >= SMIG (75000 FCFA)');
    });

    it('should reject negative allowances', () => {
      expect(() => {
        calculateGrossSalary({
          baseSalary: 100000,
          housingAllowance: -10000, // Invalid
        });
      }).toThrow('Les primes ne peuvent pas être négatives');
    });
  });
});
```

### 2.3 ITS Tax Calculation Tests (From Official Examples)

```typescript
// tests/unit/payroll/its-calculation.test.ts

import { calculateITS } from '@/features/payroll/services/its-calculation';

describe('ITS Tax Calculation', () => {
  describe('Official Example 7.1 (payroll-cote-d-ivoire.md:156)', () => {
    it('should match exact calculation for 280,100 FCFA monthly taxable income', () => {
      const annualTaxableIncome = 280100 * 12; // 3,361,200 FCFA

      const result = calculateITS(annualTaxableIncome);

      expect(result.annualTax).toBeCloseTo(729770, -2); // Within 100 FCFA
      expect(result.monthlyTax).toBeCloseTo(60815, -1); // Within 10 FCFA
    });
  });

  describe('All Tax Brackets', () => {
    it('should apply 0% for income below 300k annual', () => {
      const result = calculateITS(200000); // 200k annual
      expect(result.annualTax).toBe(0);
      expect(result.monthlyTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('should calculate progressive tax for 1M annual income', () => {
      // Manual calculation:
      // 0-300k: 0
      // 300k-547k: 247k × 10% = 24,700
      // 547k-979k: 432k × 15% = 64,800
      // 979k-1M: 21k × 20% = 4,200
      // Total: 93,700

      const result = calculateITS(1000000);
      expect(result.annualTax).toBeCloseTo(93700, 0);
    });

    it('should calculate for high earner (10M+)', () => {
      const result = calculateITS(15000000); // 15M annual

      // Should hit 60% bracket
      expect(result.effectiveRate).toBeGreaterThan(40);
      expect(result.annualTax).toBeGreaterThan(5000000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact bracket boundaries', () => {
      const result1 = calculateITS(300000); // Exact boundary
      expect(result1.annualTax).toBe(0);

      const result2 = calculateITS(300001); // Just over
      expect(result2.annualTax).toBeCloseTo(0.10, 2);
    });

    it('should handle zero income', () => {
      const result = calculateITS(0);
      expect(result.annualTax).toBe(0);
      expect(result.monthlyTax).toBe(0);
    });
  });
});
```

### 2.4 CNPS Calculation Tests

```typescript
// tests/unit/payroll/cnps-calculation.test.ts

import { calculateCNPS } from '@/features/payroll/services/cnps-calculation';
import { COTE_IVOIRE_RULES } from '@/features/payroll/constants';

describe('CNPS Contributions', () => {
  describe('Pension (from official example 7.1)', () => {
    it('should calculate for 300k gross salary', () => {
      const result = calculateCNPS.pension(300000);

      expect(result.employee).toBe(18900); // 300k × 6.3%
      expect(result.employer).toBe(23100); // 300k × 7.7%
    });

    it('should apply ceiling for high salary', () => {
      const ceiling = COTE_IVOIRE_RULES.CNPS.PENSION_CEILING; // 3,375,000

      const result = calculateCNPS.pension(5000000); // Above ceiling

      expect(result.employee).toBe(ceiling * 0.063); // 212,625
      expect(result.employer).toBe(ceiling * 0.077); // 259,875
    });
  });

  describe('Other Contributions (Maternity, Family, Work Accident)', () => {
    it('should calculate for salary below ceiling', () => {
      const result = calculateCNPS.other(60000, { sector: 'services' });

      expect(result.maternity).toBe(450); // 60k × 0.75%
      expect(result.family).toBe(3000); // 60k × 5%
      expect(result.workAccident).toBe(1200); // 60k × 2%
    });

    it('should apply 70k ceiling', () => {
      const ceiling = COTE_IVOIRE_RULES.CNPS.OTHER_CEILING; // 70,000

      const result = calculateCNPS.other(300000, { sector: 'services' });

      expect(result.maternity).toBe(ceiling * 0.0075); // 525
      expect(result.family).toBe(ceiling * 0.05); // 3,500
      expect(result.workAccident).toBe(ceiling * 0.02); // 1,400
    });

    it('should use higher rate for construction sector', () => {
      const result = calculateCNPS.other(100000, { sector: 'construction' });

      expect(result.workAccident).toBe(70000 * 0.05); // Max rate, capped at ceiling
    });
  });

  describe('CMU', () => {
    it('should calculate fixed amounts', () => {
      const result = calculateCNPS.cmu({ hasFamily: false });

      expect(result.employee).toBe(1000);
      expect(result.employer).toBe(500);
    });

    it('should include family contribution', () => {
      const result = calculateCNPS.cmu({ hasFamily: true });

      expect(result.employee).toBe(1000);
      expect(result.employer).toBe(5000); // 500 + 4500
    });
  });
});
```

---

## 3. Integration Tests

### 3.1 API Integration Tests

```typescript
// tests/integration/employees/create-employee.test.ts

import { createCaller } from '@/server/api/trpc';
import { createTestContext } from '@/tests/helpers/context';
import { db } from '@/shared/db';

describe('Employees API Integration', () => {
  let caller: ReturnType<typeof createCaller>;
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
    caller = createCaller(ctx);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('create', () => {
    it('should create employee with salary and assignment', async () => {
      const position = await createTestPosition(ctx.tenant.id);

      const result = await caller.employees.create({
        firstName: 'Kouadio',
        lastName: 'Yao',
        email: 'kouadio@example.com',
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 300000,
        housingAllowance: 50000,
      });

      // Check employee created
      expect(result.id).toBeDefined();
      expect(result.employee_number).toBe('EMP-000001');

      // Check salary record created
      const salary = await db.query.employee_salaries.findFirst({
        where: eq(employee_salaries.employee_id, result.id),
      });

      expect(salary).toBeDefined();
      expect(salary!.base_salary).toBe(300000);
      expect(salary!.housing_allowance).toBe(50000);

      // Check assignment created
      const assignment = await db.query.assignments.findFirst({
        where: eq(assignments.employee_id, result.id),
      });

      expect(assignment).toBeDefined();
      expect(assignment!.position_id).toBe(position.id);
    });

    it('should enforce RLS (tenant isolation)', async () => {
      const tenant2 = await createTestTenant();
      const caller2 = createCaller({ ...ctx, tenant: tenant2 });

      const position = await createTestPosition(ctx.tenant.id); // Tenant 1

      // Tenant 2 tries to use Tenant 1's position
      await expect(
        caller2.employees.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          hireDate: new Date('2025-01-15'),
          positionId: position.id, // Cross-tenant violation
          baseSalary: 100000,
        })
      ).rejects.toThrow('Poste non trouvé'); // RLS prevents access
    });

    it('should encrypt PII fields', async () => {
      const position = await createTestPosition(ctx.tenant.id);

      const result = await caller.employees.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 100000,
        nationalId: '1234567890',
        bankAccount: 'CI93 CI 001 01234567890123 45',
      });

      // Check encrypted in DB
      const dbEmployee = await db.query.employees.findFirst({
        where: eq(employees.id, result.id),
      });

      expect(dbEmployee!.national_id).not.toBe('1234567890');
      expect(dbEmployee!.bank_account).not.toBe('CI93 CI 001 01234567890123 45');

      // But decrypted in API response
      expect(result.national_id).toBe('1234567890');
      expect(result.bank_account).toBe('CI93 CI 001 01234567890123 45');
    });

    it('should create audit log', async () => {
      const position = await createTestPosition(ctx.tenant.id);

      const result = await caller.employees.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 100000,
      });

      const auditLog = await db.query.audit_logs.findFirst({
        where: and(
          eq(audit_logs.entity_type, 'employee'),
          eq(audit_logs.entity_id, result.id)
        ),
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe('create');
      expect(auditLog!.user_id).toBe(ctx.user.id);
    });

    it('should emit employee.hired event', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      const position = await createTestPosition(ctx.tenant.id);

      const result = await caller.employees.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 100000,
      });

      expect(eventSpy).toHaveBeenCalledWith('employee.hired', {
        employeeId: result.id,
        tenantId: ctx.tenant.id,
        hireDate: result.hire_date,
        positionId: position.id,
      });
    });
  });
});
```

### 3.2 Payroll Integration Test (End-to-End Flow)

```typescript
// tests/integration/payroll/payroll-run.test.ts

describe('Payroll Run Integration', () => {
  it('should process complete payroll run for 3 employees', async () => {
    const ctx = await createTestContext();
    const caller = createCaller(ctx);

    // Setup: Create 3 employees with different salaries
    const employees = await Promise.all([
      createTestEmployee(ctx, { baseSalary: 200000 }),
      createTestEmployee(ctx, { baseSalary: 300000 }),
      createTestEmployee(ctx, { baseSalary: 500000 }),
    ]);

    // 1. Create payroll run
    const run = await caller.payroll.createRun({
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      paymentDate: new Date('2025-02-05'),
    });

    expect(run.status).toBe('draft');

    // 2. Calculate payroll
    const calculated = await caller.payroll.calculateRun({
      runId: run.id,
    });

    expect(calculated.employeeCount).toBe(3);
    expect(calculated.totalGross).toBe(1000000); // 200k + 300k + 500k

    // 3. Verify line items created
    const lineItems = await db.query.payroll_line_items.findMany({
      where: eq(payroll_line_items.payroll_run_id, run.id),
    });

    expect(lineItems).toHaveLength(3);

    // Verify each employee's calculation
    const emp1LineItem = lineItems.find(item => item.base_salary === 200000);
    expect(emp1LineItem!.cnps_employee).toBe(12600); // 200k × 6.3%
    expect(emp1LineItem!.cmu_employee).toBe(1000);

    // 4. Approve payroll
    const approved = await caller.payroll.approveRun({
      runId: run.id,
    });

    expect(approved.status).toBe('approved');

    // 5. Mark as paid
    const paid = await caller.payroll.markAsPaid({
      runId: run.id,
      paymentReference: 'BANK-REF-12345',
    });

    expect(paid.status).toBe('paid');
    expect(paid.paid_at).toBeDefined();
  });
});
```

---

## 4. E2E Tests (Playwright)

### 4.1 Critical User Flows

```typescript
// tests/e2e/onboarding.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should complete onboarding from signup to first payroll', async ({ page }) => {
    // 1. Signup
    await page.goto('/signup');
    await page.fill('[name="companyName"]', 'Ma Boutique Test');
    await page.fill('[name="email"]', 'patron@boutique-test.ci');
    await page.fill('[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);

    // 2. Select country
    await expect(page.locator('h1')).toContainText('Où est située votre entreprise');
    await page.click('[data-country="CI"]');
    await page.click('button:has-text("Continuer")');

    // 3. Company info
    await expect(page.locator('h1')).toContainText('Informations sur votre entreprise');
    await page.fill('[name="taxId"]', 'CI-123456789');
    await page.click('button:has-text("Continuer")');

    // 4. Add first employee
    await expect(page.locator('h1')).toContainText('Ajoutez votre premier employé');
    await page.fill('[name="firstName"]', 'Kouadio');
    await page.fill('[name="lastName"]', 'Yao');
    await page.fill('[name="email"]', 'kouadio@boutique-test.ci');
    await page.fill('[name="baseSalary"]', '300000');
    await page.click('button:has-text("Continuer")');

    // 5. Create position
    await expect(page.locator('h1')).toContainText('poste');
    await page.fill('[name="title"]', 'Gérant');
    await page.click('button:has-text("Continuer")');

    // 6. Payroll preview
    await expect(page.locator('h1')).toContainText('Aperçu de votre première paie');
    await expect(page.locator('[data-label="Salaire brut"]')).toContainText('300 000');
    await expect(page.locator('[data-label="Salaire net"]')).toContainText('219'); // ~219k
    await page.click('button:has-text("Continuer")');

    // 7. Complete
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await page.click('button:has-text("Accéder au tableau de bord")');

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Payroll Run', () => {
  test('should create and calculate payroll run', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);

    // Navigate to payroll
    await page.goto('/dashboard/payroll');

    // Create new run
    await page.click('button:has-text("Nouvelle paie")');

    // Fill period
    await page.fill('[name="periodStart"]', '2025-01-01');
    await page.fill('[name="periodEnd"]', '2025-01-31');
    await page.fill('[name="paymentDate"]', '2025-02-05');
    await page.click('button:has-text("Créer")');

    // Calculate
    await page.click('button:has-text("Calculer la paie")');

    // Wait for calculation
    await expect(page.locator('[data-status="calculated"]')).toBeVisible();

    // Verify totals
    const totalGross = await page.locator('[data-label="Total brut"]').textContent();
    expect(totalGross).toMatch(/\d+/);

    // Approve
    await page.click('button:has-text("Approuver")');

    // Confirm dialog
    await page.click('button:has-text("Confirmer")');

    // Should show as approved
    await expect(page.locator('[data-status="approved"]')).toBeVisible();
  });
});
```

---

## 5. Test Helpers & Utilities

### 5.1 Test Data Factories

```typescript
// tests/helpers/factories.ts

export async function createTestTenant(overrides = {}) {
  return await db.insert(tenants).values({
    name: 'Test Company',
    slug: `test-company-${Date.now()}`,
    country_code: 'CI',
    currency: 'XOF',
    plan: 'trial',
    trial_ends_at: addDays(new Date(), 30),
    ...overrides,
  }).returning();
}

export async function createTestEmployee(ctx: TestContext, overrides = {}) {
  const position = await createTestPosition(ctx.tenant.id);

  return await caller(ctx).employees.create({
    firstName: 'Test',
    lastName: 'Employee',
    email: `emp-${Date.now()}@test.com`,
    hireDate: new Date('2025-01-01'),
    positionId: position.id,
    baseSalary: 200000,
    ...overrides,
  });
}

export async function createTestPosition(tenantId: string, overrides = {}) {
  return await db.insert(positions).values({
    tenant_id: tenantId,
    title: 'Test Position',
    weekly_hours: 40,
    min_salary: 75000,
    max_salary: 500000,
    ...overrides,
  }).returning();
}
```

---

## 6. Coverage Requirements

| Layer | Minimum | Critical Paths |
|-------|---------|----------------|
| Payroll Calculations | 95% | 100% |
| Domain Services | 90% | 100% |
| API Routes | 80% | 95% |
| Database Queries | 70% | N/A |
| UI Components | 60% | 90% |

**Critical Paths:**
- Payroll calculation (all branches)
- Multi-tenancy isolation (RLS)
- Effective dating queries
- PII encryption/decryption
- Event publishing

---

## 7. Running Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# All tests
pnpm test:all
```

---

## 8. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: npx playwright install
      - run: pnpm test:e2e
```

---

**Next:** Read `12-SUPER-ADMIN.md`
