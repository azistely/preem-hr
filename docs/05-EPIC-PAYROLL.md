# 💰 EPIC: Payroll Calculation Engine (Côte d'Ivoire)

## Epic Overview

**Goal:** Implement a fully compliant payroll calculation engine for Côte d'Ivoire that handles complex scenarios including overtime, bonuses, deductions, CNPS contributions, CMU, and ITS (tax on salaries).

**Priority:** P0 (Must-have for MVP)

**Source Documents:**
- `payroll-cote-d-ivoire.md` (lines 1-219) - Complete regulatory framework
- `03-DATABASE-SCHEMA.md` - Tables: payroll_runs, payroll_line_items, employee_salaries
- `01-CONSTRAINTS-AND-RULES.md` - Validation rules, SMIG constants

**Dependencies:**
- Employee Management (must have employees to pay)
- Position/Assignment system (for salary determination)
- Country rules configuration (CNPS rates, ITS brackets)

---

## Success Criteria

- [x] Calculate gross → net salary accurately for all ITS brackets
- [x] Apply CNPS contributions with correct ceilings
- [x] Handle overtime calculations (hours 41-46, 46+, night, weekends)
- [x] Support prorated salaries (mid-month hires/term)
- [x] Generate compliant pay slips in French
- [x] Audit trail for all calculations
- [x] 100% test coverage for calculation logic
- [x] Matches examples from payroll-cote-d-ivoire.md:148-175

---

## Features & User Stories

### FEATURE 1: Base Salary Calculation

#### Story 1.1: Calculate Monthly Gross Salary
**As a** payroll manager
**I want** to calculate an employee's monthly gross salary
**So that** I can begin processing payroll

**Acceptance Criteria:**
- [ ] Fetch employee's current salary (effective-dated as of payroll period end)
- [ ] Apply base salary from `employee_salaries` table
- [ ] Add recurring allowances (housing, transport, meal)
- [ ] Validate salary >= SMIG (75,000 FCFA)
- [ ] Handle prorated salaries for partial months (hire/termination mid-month)

**Test Cases:**
```typescript
describe('Base Salary Calculation', () => {
  it('should get current salary for active employee', async () => {
    const salary = await getCurrentSalary(employeeId, new Date('2025-01-31'));
    expect(salary.base_salary).toBeGreaterThanOrEqual(75000); // SMIG
  });

  it('should prorate salary for mid-month hire', async () => {
    // Hired on Jan 15, salary 300,000, month has 31 days
    // Days worked: 17 (Jan 15-31)
    // Prorated: 300,000 × (17/31) = 164,516 FCFA
    const gross = await calculateGrossSalary({
      employeeId,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      hireDate: new Date('2025-01-15'),
      baseSalary: 300000,
    });
    expect(gross.proratedSalary).toBeCloseTo(164516, 0);
  });

  it('should include all allowances in gross', async () => {
    const gross = await calculateGrossSalary({
      baseSalary: 300000,
      housingAllowance: 50000,
      transportAllowance: 25000,
      mealAllowance: 15000,
    });
    expect(gross.totalGross).toBe(390000);
    expect(gross.breakdown).toEqual({
      base: 300000,
      allowances: 90000,
    });
  });
});
```

**Implementation Path:**
```
src/features/payroll/services/
  └── gross-calculation.ts
      ├── getCurrentSalary(employeeId, asOfDate)
      ├── calculateBasePay(salary, periodStart, periodEnd, hireDate?, termDate?)
      ├── calculateAllowances(salary)
      └── calculateGross(employee, period)
```

**API Endpoint:**
```typescript
// tRPC procedure
payroll.calculateGross
  .input(z.object({
    employeeId: z.string().uuid(),
    periodStart: z.date(),
    periodEnd: z.date(),
  }))
  .query(async ({ input, ctx }) => {
    return await calculateGross(input);
  });
```

---

### FEATURE 2: CNPS Contributions Calculation

#### Story 2.1: Calculate Employee CNPS (Pension)
**As a** payroll system
**I want** to calculate CNPS pension contributions
**So that** social security is properly deducted

**Source:** payroll-cote-d-ivoire.md:46-48

**Rules:**
- Employee rate: 6.3%
- Employer rate: 7.7%
- Ceiling: 3,375,000 FCFA (45 × SMIG)

**Acceptance Criteria:**
- [ ] Calculate employee contribution: `min(grossSalary, 3375000) × 0.063`
- [ ] Calculate employer contribution: `min(grossSalary, 3375000) × 0.077`
- [ ] Cap at ceiling for high earners
- [ ] Store in payroll_line_items

**Test Cases (from payroll-cote-d-ivoire.md:152):**
```typescript
describe('CNPS Pension Calculation', () => {
  it('should match official example 7.1', () => {
    // From payroll-cote-d-ivoire.md:152
    const result = calculateCNPSPension(300000);
    expect(result.employee).toBe(18900); // 300k × 6.3%
    expect(result.employer).toBe(23100); // 300k × 7.7%
  });

  it('should apply ceiling for high salaries', () => {
    const result = calculateCNPSPension(5000000); // Above ceiling
    expect(result.employee).toBe(212625); // 3,375,000 × 6.3%
    expect(result.employer).toBe(259875); // 3,375,000 × 7.7%
  });

  it('should calculate correctly for SMIG', () => {
    const result = calculateCNPSPension(75000);
    expect(result.employee).toBe(4725);
    expect(result.employer).toBe(5775);
  });
});
```

#### Story 2.2: Calculate Other CNPS Contributions
**As a** payroll system
**I want** to calculate maternity, family, and work accident contributions
**So that** all mandatory social security is covered

**Rules (payroll-cote-d-ivoire.md:50-57):**
- Maternity: 0.75% employer only, ceiling 70,000
- Family allowance: 5% employer only, ceiling 70,000
- Work accident: 2-5% employer (varies by sector), ceiling 70,000

**Acceptance Criteria:**
- [ ] Calculate maternity: `min(grossSalary, 70000) × 0.0075`
- [ ] Calculate family: `min(grossSalary, 70000) × 0.05`
- [ ] Calculate work accident based on tenant's sector risk (default 2%)
- [ ] All three use 70,000 ceiling

**Test Cases:**
```typescript
describe('CNPS Other Contributions', () => {
  it('should calculate for salary below ceiling', () => {
    const result = calculateCNPSOther(60000, { sector: 'services' });
    expect(result.maternity).toBe(450); // 60k × 0.75%
    expect(result.family).toBe(3000); // 60k × 5%
    expect(result.workAccident).toBe(1200); // 60k × 2%
  });

  it('should apply ceiling correctly', () => {
    const result = calculateCNPSOther(300000, { sector: 'services' });
    expect(result.maternity).toBe(525); // 70k × 0.75%
    expect(result.family).toBe(3500); // 70k × 5%
    expect(result.workAccident).toBe(1400); // 70k × 2%
  });

  it('should use higher rate for BTP sector', () => {
    const result = calculateCNPSOther(100000, { sector: 'construction' });
    expect(result.workAccident).toBe(3500); // 70k × 5% (max rate)
  });
});
```

---

### FEATURE 3: CMU (Universal Health Coverage) Calculation

**Source:** payroll-cote-d-ivoire.md:59-61

**Rules:**
- Employee: Fixed 1,000 FCFA
- Employer for employee: 500 FCFA
- Employer for family: 4,500 FCFA (spouse + up to 6 children)

#### Story 3.1: Calculate CMU Contributions
**As a** payroll system
**I want** to calculate CMU contributions
**So that** health coverage is funded

**Acceptance Criteria:**
- [ ] Deduct 1,000 FCFA from employee
- [ ] Add 500 FCFA employer contribution for employee
- [ ] Add 4,500 FCFA if employee has declared family members
- [ ] Store family status in employee custom_fields

**Test Cases:**
```typescript
describe('CMU Calculation', () => {
  it('should calculate for employee only', () => {
    const result = calculateCMU({ hasFamily: false });
    expect(result.employee).toBe(1000);
    expect(result.employer).toBe(500);
  });

  it('should calculate for employee with family', () => {
    const result = calculateCMU({ hasFamily: true });
    expect(result.employee).toBe(1000);
    expect(result.employer).toBe(5000); // 500 + 4500
  });
});
```

---

### FEATURE 4: ITS (Tax on Salaries) Calculation

**Source:** payroll-cote-d-ivoire.md:74-89 (2024 reform)

**Critical:** This is the most complex calculation due to progressive brackets.

#### Story 4.1: Calculate Taxable Income
**As a** payroll system
**I want** to determine taxable income
**So that** I can apply ITS brackets

**Acceptance Criteria:**
- [ ] Start with gross salary
- [ ] Subtract CNPS employee contribution (6.3%)
- [ ] Subtract CMU employee contribution (1,000 FCFA)
- [ ] Result = taxable income
- [ ] Do NOT subtract employer contributions

**Test Cases (from payroll-cote-d-ivoire.md:154):**
```typescript
describe('Taxable Income Calculation', () => {
  it('should match official example 7.1', () => {
    // From payroll-cote-d-ivoire.md:154
    const taxableIncome = calculateTaxableIncome({
      grossSalary: 300000,
      cnpsEmployee: 18900,
      cmuEmployee: 1000,
    });
    expect(taxableIncome).toBe(280100); // 300k - 19.9k
  });
});
```

#### Story 4.2: Apply Progressive ITS Brackets
**As a** payroll system
**I want** to calculate ITS using progressive brackets
**So that** tax is correctly withheld

**Source:** payroll-cote-d-ivoire.md:80-89

**Brackets (Annual, convert to monthly):**
```
0 - 300,000: 0%
300,000 - 547,000: 10%
547,000 - 979,000: 15%
979,000 - 1,519,000: 20%
1,519,000 - 2,644,000: 25%
2,644,000 - 4,669,000: 35%
4,669,000 - 10,106,000: 45%
10,106,000+: 60%
```

**Acceptance Criteria:**
- [ ] Annualize monthly taxable income (× 12)
- [ ] Apply progressive calculation (tax each bracket)
- [ ] Divide annual tax by 12 for monthly withholding
- [ ] Round to nearest franc

**Test Cases (from payroll-cote-d-ivoire.md:156):**
```typescript
describe('ITS Progressive Calculation', () => {
  it('should match official example 7.1 (300k gross)', () => {
    // From payroll-cote-d-ivoire.md:154-157
    const annualTaxableIncome = 280100 * 12; // 3,361,200
    const its = calculateITS(annualTaxableIncome);

    // Expected annual tax: ~729,770 FCFA
    expect(its.annualTax).toBeCloseTo(729770, -2); // Within 100 FCFA
    expect(its.monthlyTax).toBeCloseTo(60815, -1); // 729770 / 12
  });

  it('should handle first bracket (no tax)', () => {
    const its = calculateITS(200000 * 12); // 2.4M annual
    // All in 0% bracket
    expect(its.annualTax).toBe(0);
  });

  it('should calculate progressive tax correctly', () => {
    // Manual calculation for 1M annual income
    // Bracket 1 (0-300k): 0
    // Bracket 2 (300k-547k): 247k × 10% = 24,700
    // Bracket 3 (547k-979k): 453k × 15% = 67,950
    // Bracket 4 (979k-1M): 21k × 20% = 4,200
    // Total: 96,850

    const its = calculateITS(1000000);
    expect(its.annualTax).toBeCloseTo(96850, 0);
  });
});
```

**Implementation:**
```typescript
// src/features/payroll/services/its-calculation.ts

export function calculateITS(annualTaxableIncome: number): ITSResult {
  const brackets = [
    { min: 0, max: 300000, rate: 0 },
    { min: 300000, max: 547000, rate: 0.10 },
    { min: 547000, max: 979000, rate: 0.15 },
    { min: 979000, max: 1519000, rate: 0.20 },
    { min: 1519000, max: 2644000, rate: 0.25 },
    { min: 2644000, max: 4669000, rate: 0.35 },
    { min: 4669000, max: 10106000, rate: 0.45 },
    { min: 10106000, max: Infinity, rate: 0.60 },
  ];

  let totalTax = 0;
  let remainingIncome = annualTaxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.max - bracket.min;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    const taxForBracket = taxableInBracket * bracket.rate;

    totalTax += taxForBracket;
    remainingIncome -= taxableInBracket;
  }

  return {
    annualTax: Math.round(totalTax),
    monthlyTax: Math.round(totalTax / 12),
    effectiveRate: (totalTax / annualTaxableIncome) * 100,
  };
}
```

---

### FEATURE 5: Overtime Calculation

**Source:** payroll-cote-d-ivoire.md:96-112

#### Story 5.1: Calculate Overtime Pay
**As a** payroll system
**I want** to calculate overtime with correct multipliers
**So that** employees are paid legally compliant rates

**Rules:**
- Hours 41-46: × 1.15
- Hours 46+: × 1.50
- Night work: × 1.75
- Sunday/Holiday: × 1.75
- Night + Sunday/Holiday: × 2.00
- Max: 15 hours/week, 3 hours/day

**Acceptance Criteria:**
- [ ] Calculate hourly rate: `monthlySalary / 173.33` (40h/week × 52 weeks / 12 months)
- [ ] Apply correct multiplier based on time classification
- [ ] Sum all overtime pay
- [ ] Add to gross salary

**Test Cases (from payroll-cote-d-ivoire.md:164-174):**
```typescript
describe('Overtime Calculation', () => {
  it('should match official example 7.2', () => {
    // From payroll-cote-d-ivoire.md:164-174
    const baseSalary = 200000;
    const hourlyRate = baseSalary / 173.33; // ~1,154 FCFA/hour

    const overtime = calculateOvertime({
      hourlyRate,
      hours: [
        { count: 6, type: 'hours_41_to_46' }, // × 1.15
        { count: 4, type: 'hours_above_46' },  // × 1.50
      ],
    });

    expect(overtime.hours_41_to_46).toBeCloseTo(7968, 0); // 6 × 1154 × 1.15
    expect(overtime.hours_above_46).toBeCloseTo(6924, 0); // 4 × 1154 × 1.50
    expect(overtime.total).toBeCloseTo(14892, 0);
  });

  it('should calculate night + sunday multiplier', () => {
    const hourlyRate = 1000;
    const overtime = calculateOvertime({
      hourlyRate,
      hours: [
        { count: 8, type: 'night_sunday' }, // × 2.00
      ],
    });

    expect(overtime.night_sunday).toBe(16000); // 8 × 1000 × 2.0
  });

  it('should enforce maximum overtime limits', () => {
    // Max 15 hours/week
    expect(() => {
      calculateOvertime({
        hourlyRate: 1000,
        hours: [{ count: 16, type: 'hours_41_to_46' }],
      });
    }).toThrow('Dépassement de la limite d\'heures supplémentaires (15h/semaine)');
  });
});
```

---

### FEATURE 6: Net Salary Calculation (Complete Flow)

#### Story 6.1: Calculate Net Pay
**As a** payroll manager
**I want** to see the complete payroll calculation from gross to net
**So that** I can verify accuracy before payment

**Complete Formula:**
```
Gross Salary = Base + Overtime + Bonuses + Allowances
CNPS Employee = Gross × 6.3% (ceiling 3.375M)
CMU Employee = 1,000 FCFA
Taxable Income = Gross - CNPS Employee - CMU Employee
ITS = Progressive tax on annualized taxable income / 12
Total Deductions = CNPS Employee + CMU Employee + ITS + Other
Net Salary = Gross - Total Deductions
```

**Acceptance Criteria:**
- [ ] Calculate in correct order
- [ ] Round all currency to 2 decimals
- [ ] Generate detailed breakdown
- [ ] Validate net >= 0
- [ ] Match example 7.1 from payroll-cote-d-ivoire.md

**Test Cases:**
```typescript
describe('Complete Payroll Calculation', () => {
  it('should match official example 7.1 exactly', () => {
    // From payroll-cote-d-ivoire.md:148-161
    const result = calculatePayroll({
      baseSalary: 300000,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    });

    expect(result.grossSalary).toBe(300000);
    expect(result.cnpsEmployee).toBe(18900);
    expect(result.cmuEmployee).toBe(1000);
    expect(result.taxableIncome).toBe(280100);
    expect(result.its).toBeCloseTo(60815, 0);
    expect(result.netSalary).toBeCloseTo(219285, 0);

    // Employer costs
    expect(result.cnpsEmployer).toBe(23100);
    expect(result.cmuEmployer).toBe(500); // No family
    expect(result.totalEmployerCost).toBeCloseTo(351350, 0);
  });

  it('should handle employee with family and allowances', () => {
    const result = calculatePayroll({
      baseSalary: 500000,
      housingAllowance: 100000,
      transportAllowance: 50000,
      hasFamily: true,
    });

    expect(result.grossSalary).toBe(650000);
    expect(result.cmuEmployer).toBe(5000); // 500 + 4500 family
  });
});
```

---

### FEATURE 7: Payroll Run Orchestration

#### Story 7.1: Create Payroll Run
**As a** payroll manager
**I want** to initiate a payroll run for a period
**So that** all employees are processed together

**Acceptance Criteria:**
- [ ] Select period (start/end dates)
- [ ] Validate period not already processed
- [ ] Create `payroll_runs` record with status 'draft'
- [ ] Fetch all active employees for tenant
- [ ] Validate at least one employee exists

**API:**
```typescript
payroll.createRun
  .input(z.object({
    periodStart: z.date(),
    periodEnd: z.date(),
    paymentDate: z.date(),
    name: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // Validation
    const existing = await db.query.payroll_runs.findFirst({
      where: and(
        eq(payroll_runs.tenant_id, ctx.user.tenantId),
        eq(payroll_runs.period_start, input.periodStart),
      ),
    });

    if (existing) {
      throw new Error('Une paie existe déjà pour cette période');
    }

    // Create run
    const run = await db.insert(payroll_runs).values({
      tenant_id: ctx.user.tenantId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      payment_date: input.paymentDate,
      name: input.name || `Paie ${format(input.periodStart, 'MMMM yyyy', { locale: fr })}`,
      status: 'draft',
      created_by: ctx.user.id,
    }).returning();

    return run[0];
  });
```

#### Story 7.2: Calculate Payroll Run
**As a** payroll manager
**I want** to calculate payroll for all employees
**So that** I can review before approval

**Acceptance Criteria:**
- [ ] Update run status to 'calculating'
- [ ] For each active employee:
  - [ ] Calculate gross salary
  - [ ] Calculate deductions (CNPS, CMU, ITS)
  - [ ] Calculate net salary
  - [ ] Create `payroll_line_items` record
- [ ] Update run with totals (employee_count, total_gross, total_net)
- [ ] Set status to 'calculated'
- [ ] Publish event: `payroll.run.calculated`

**Implementation:**
```typescript
// src/features/payroll/services/run-calculation.ts

export async function calculatePayrollRun(runId: string) {
  const run = await db.query.payroll_runs.findFirst({
    where: eq(payroll_runs.id, runId),
  });

  if (!run) throw new Error('Payroll run not found');
  if (run.status !== 'draft') throw new Error('Run already calculated');

  // Update status
  await db.update(payroll_runs)
    .set({ status: 'calculating' })
    .where(eq(payroll_runs.id, runId));

  // Get active employees
  const employees = await db.query.employees.findMany({
    where: and(
      eq(employees.tenant_id, run.tenant_id),
      eq(employees.status, 'active'),
      or(
        lte(employees.hire_date, run.period_end),
        and(
          gte(employees.termination_date, run.period_start),
          isNotNull(employees.termination_date)
        )
      )
    ),
    with: {
      currentSalary: true,
      currentAssignment: true,
    },
  });

  const lineItems = [];

  for (const employee of employees) {
    try {
      // Calculate for this employee
      const calculation = await calculateEmployeePayroll({
        employee,
        periodStart: run.period_start,
        periodEnd: run.period_end,
      });

      // Create line item
      const lineItem = await db.insert(payroll_line_items).values({
        tenant_id: run.tenant_id,
        payroll_run_id: run.id,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_number: employee.employee_number,
        position_title: employee.currentAssignment?.position.title,

        // Earnings
        base_salary: calculation.baseSalary,
        overtime_pay: calculation.overtimePay,
        bonuses: calculation.bonuses,
        allowances: calculation.allowances,
        gross_salary: calculation.grossSalary,

        // Deductions
        cnps_employee: calculation.cnpsEmployee,
        cmu_employee: calculation.cmuEmployee,
        its: calculation.its,
        total_deductions: calculation.totalDeductions,

        // Employer
        cnps_employer: calculation.cnpsEmployer,
        cmu_employer: calculation.cmuEmployer,

        // Net
        net_salary: calculation.netSalary,
        employer_cost: calculation.employerCost,

        // Details
        earnings_details: calculation.earningsDetails,
        deductions_details: calculation.deductionsDetails,
        days_worked: calculation.daysWorked,
      }).returning();

      lineItems.push(lineItem[0]);
    } catch (error) {
      // Log error but continue with other employees
      logger.error('Payroll calculation failed for employee', {
        employeeId: employee.id,
        error: error.message,
      });
    }
  }

  // Update run with totals
  const totals = lineItems.reduce((acc, item) => ({
    totalGross: acc.totalGross + Number(item.gross_salary),
    totalNet: acc.totalNet + Number(item.net_salary),
    totalEmployerCost: acc.totalEmployerCost + Number(item.employer_cost),
  }), { totalGross: 0, totalNet: 0, totalEmployerCost: 0 });

  await db.update(payroll_runs)
    .set({
      status: 'calculated',
      calculated_at: new Date(),
      employee_count: lineItems.length,
      total_gross: totals.totalGross,
      total_net: totals.totalNet,
      total_employer_cost: totals.totalEmployerCost,
    })
    .where(eq(payroll_runs.id, runId));

  // Publish event
  await eventBus.publish('payroll.run.calculated', {
    runId: run.id,
    tenantId: run.tenant_id,
    periodStart: run.period_start,
    employeeCount: lineItems.length,
  });

  return { runId: run.id, employeeCount: lineItems.length };
}
```

---

## Testing Strategy

### Unit Tests (100% Coverage Required)

```typescript
// All calculation functions
- calculateGrossSalary()
- calculateCNPSPension()
- calculateCNPSOther()
- calculateCMU()
- calculateTaxableIncome()
- calculateITS()
- calculateOvertime()
- calculateNetSalary()
```

### Integration Tests

```typescript
describe('Payroll Run Integration', () => {
  it('should process payroll for 10 employees', async () => {
    // Create tenant + 10 employees with varying salaries
    // Run payroll calculation
    // Verify all line items created
    // Verify totals match sum of line items
  });

  it('should handle edge cases', async () => {
    // Mid-month hire
    // Mid-month termination
    // Salary change during period
    // Overtime hours
  });
});
```

### Validation Tests (Against Official Examples)

```typescript
describe('Regulatory Compliance', () => {
  it('Example 7.1: 300k gross salary', () => { /* ... */ });
  it('Example 7.2: Overtime calculation', () => { /* ... */ });
  it('SMIG minimum wage', () => { /* ... */ });
  it('CNPS ceilings', () => { /* ... */ });
  it('All ITS brackets', () => { /* ... */ });
});
```

---

## Implementation Phases

### Phase 1: Core Calculation (Sprint 1)
- [ ] Story 1.1: Base salary
- [ ] Story 2.1: CNPS pension
- [ ] Story 2.2: Other CNPS
- [ ] Story 3.1: CMU
- [ ] Story 4.1-4.2: ITS calculation
- [ ] Story 6.1: Net salary

**Deliverable:** Calculate payroll for single employee via API

### Phase 2: Payroll Runs (Sprint 2)
- [ ] Story 7.1: Create run
- [ ] Story 7.2: Bulk calculation
- [ ] Error handling
- [ ] Audit logging

**Deliverable:** Process payroll for all employees in tenant

### Phase 3: Advanced Features (Sprint 3)
- [ ] Story 5.1: Overtime
- [ ] Prorated salaries
- [ ] Bonuses
- [ ] Deductions (loans, garnishments)
- [ ] Pay slip generation (PDF)

**Deliverable:** Handle complex payroll scenarios

---

## Acceptance Testing Checklist

Before marking this epic complete:

- [ ] All test cases from payroll-cote-d-ivoire.md pass
- [ ] 100% code coverage for calculation functions
- [ ] Payroll for 100+ employees completes in < 30 seconds
- [ ] Generated pay slips match official format
- [ ] Audit trail captures all calculations
- [ ] Error handling for edge cases (zero salary, missing data)
- [ ] French error messages for validation
- [ ] Super admin can configure CNPS/ITS rates
- [ ] Integration with employee/time tracking modules via events

---

**Next:** Read `06-EPIC-EMPLOYEE-MANAGEMENT.md`
