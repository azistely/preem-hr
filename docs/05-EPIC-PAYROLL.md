# 💰 EPIC: Multi-Country Payroll Calculation Engine

## Epic Overview

**Goal:** Implement a flexible, database-driven payroll calculation engine that supports multiple West African countries (Côte d'Ivoire, Senegal, Burkina Faso, Mali, Benin, Togo, Guinea).

**Architecture:** Configuration-driven, country-agnostic design with strategy pattern for country-specific logic.

**Priority:** P0 (Must-have for MVP)

**Source Documents:**
- `multi-country-payroll-architecture.md` - Complete architecture design
- `country-config-schema.ts` - TypeScript types and schemas
- `02-ARCHITECTURE-OVERVIEW.md` - System design, tech stack, bounded contexts
- `03-DATABASE-SCHEMA.md` - Multi-country tables (13-21) + payroll tables
- `04-DOMAIN-MODELS.md` - Business entities, validation rules, domain events
- `payroll-research-findings.md` - Regulatory research for Côte d'Ivoire
- `01-CONSTRAINTS-AND-RULES.md` - Validation rules, constants
- `HCI-DESIGN-PRINCIPLES.md` - **UX design principles for low digital literacy**
- `09-EPIC-WORKFLOW-AUTOMATION.md` - Batch operations, alerts integration

**Dependencies:**
- Employee Management (must have employees to pay)
- Position/Assignment system (for salary determination)
- Multi-country configuration (tax_systems, social_security_schemes, other_taxes tables)

**Key Design Principles:**
1. **Configuration Over Code:** Tax brackets, rates, and rules stored in database
2. **Country Abstraction:** Each country is configuration, not separate codebase
3. **Temporal Accuracy:** Effective-dated rules for historical payroll
4. **Strategy Pattern:** Different calculation methods per country
5. **Extensibility:** Add new country = database config (no code changes)

---

## Success Criteria

**Multi-Country Support:**
- [ ] Load country rules from database (tax_systems, social_security_schemes, other_taxes)
- [ ] Calculate payroll using database-driven configuration
- [ ] Support adding new country via database config only
- [ ] Effective-dated rules for historical accuracy

**Calculation Accuracy:**
- [ ] Calculate gross → net salary accurately for all tax brackets
- [ ] Apply social security contributions with correct ceilings
- [ ] Handle sector-specific rates (work accident)
- [ ] Handle overtime calculations (hours 41-46, 46+, night, weekends)
- [ ] Support prorated salaries (mid-month hires/term)

**Compliance & Quality:**
- [ ] Generate compliant pay slips in French
- [ ] Audit trail for all calculations
- [ ] 100% test coverage for calculation logic
- [ ] Matches regulatory examples (Côte d'Ivoire verified)

---

## Implementation Phases

### Phase 1: Database Configuration Infrastructure (Week 1-2)
1. Create migrations for multi-country tables
2. Seed Côte d'Ivoire configuration
3. Implement RuleLoader service
4. Add country configuration endpoints (super admin)

### Phase 2: Refactor Calculations (Week 3-4)
1. Replace hardcoded tax brackets with database queries
2. Replace hardcoded CNPS rates with database queries
3. Implement strategy pattern for tax calculations
4. Refactor PayrollOrchestrator to use RuleLoader

### Phase 3: Testing & Validation (Week 5)
1. Verify Côte d'Ivoire calculations match before/after
2. Add comprehensive test suite
3. Performance testing with database-driven config

### Phase 4: Second Country (Week 6)
1. Add Senegal configuration to database
2. Test end-to-end payroll for Senegal
3. Document process for adding new countries

---

## Features & User Stories

### FEATURE 0: Multi-Country Configuration Infrastructure

**Source:** `multi-country-payroll-architecture.md`, `country-config-schema.ts`

**Critical:** This is the foundation. Must be implemented before payroll calculations.

#### Story 0.1: RuleLoader Service
**As a** payroll calculation engine
**I want** to load country-specific rules from the database
**So that** calculations are based on current, country-specific regulations

**Acceptance Criteria:**
- [ ] Load tax system by country_code and effective_date
- [ ] Load tax brackets for the tax system
- [ ] Load family deduction rules (if supported)
- [ ] Load social security scheme and contribution types
- [ ] Load sector-specific overrides
- [ ] Load other taxes (FDFP, 3FPT, etc.)
- [ ] Return complete CountryConfig object

**Implementation:**
```typescript
// src/features/payroll/services/rule-loader.ts

export class RuleLoader {
  async getTaxSystem(countryCode: string, effectiveDate: Date) {
    return await db.query.tax_systems.findFirst({
      where: and(
        eq(tax_systems.country_code, countryCode),
        lte(tax_systems.effective_from, effectiveDate),
        or(
          isNull(tax_systems.effective_to),
          gte(tax_systems.effective_to, effectiveDate)
        )
      ),
      with: {
        brackets: { orderBy: [asc(tax_brackets.bracket_order)] },
        familyDeductions: true,
      },
    });
  }

  async getSocialScheme(countryCode: string, effectiveDate: Date) {
    return await db.query.social_security_schemes.findFirst({
      where: and(
        eq(social_security_schemes.country_code, countryCode),
        lte(social_security_schemes.effective_from, effectiveDate),
        or(
          isNull(social_security_schemes.effective_to),
          gte(social_security_schemes.effective_to, effectiveDate)
        )
      ),
      with: {
        contributionTypes: {
          with: { sectorOverrides: true },
        },
      },
    });
  }

  async getOtherTaxes(countryCode: string, effectiveDate: Date) {
    return await db.query.other_taxes.findMany({
      where: and(
        eq(other_taxes.country_code, countryCode),
        lte(other_taxes.effective_from, effectiveDate),
        or(
          isNull(other_taxes.effective_to),
          gte(other_taxes.effective_to, effectiveDate)
        )
      ),
    });
  }

  async getCountryConfig(countryCode: string, effectiveDate: Date): Promise<CountryConfig> {
    const [country, taxSystem, socialScheme, otherTaxes] = await Promise.all([
      db.query.countries.findFirst({ where: eq(countries.code, countryCode) }),
      this.getTaxSystem(countryCode, effectiveDate),
      this.getSocialScheme(countryCode, effectiveDate),
      this.getOtherTaxes(countryCode, effectiveDate),
    ]);

    if (!country) throw new Error(`Country ${countryCode} not found`);
    if (!taxSystem) throw new Error(`No tax system for ${countryCode} on ${effectiveDate}`);
    if (!socialScheme) throw new Error(`No social scheme for ${countryCode} on ${effectiveDate}`);

    return { country, taxSystem, socialScheme, otherTaxes };
  }
}
```

#### Story 0.2: Database Migrations
**As a** developer
**I want** to create all multi-country payroll tables
**So that** country rules can be stored in the database

**Acceptance Criteria:**
- [ ] Create countries table with seed data
- [ ] Create tax_systems table
- [ ] Create tax_brackets table
- [ ] Create family_deduction_rules table
- [ ] Create social_security_schemes table
- [ ] Create contribution_types table
- [ ] Create sector_contribution_overrides table
- [ ] Create other_taxes table
- [ ] Create salary_component_definitions table
- [ ] Add indexes for performance

**Migration Files:**
```bash
migrations/
  ├── 0001_create_countries.sql
  ├── 0002_create_tax_systems.sql
  ├── 0003_create_tax_brackets.sql
  ├── 0004_create_family_deductions.sql
  ├── 0005_create_social_schemes.sql
  ├── 0006_create_contribution_types.sql
  ├── 0007_create_sector_overrides.sql
  ├── 0008_create_other_taxes.sql
  └── 0009_create_salary_components.sql
```

#### Story 0.3: Seed Côte d'Ivoire Configuration
**As a** system
**I want** Côte d'Ivoire payroll rules pre-configured
**So that** the system works immediately for CI

**Acceptance Criteria:**
- [ ] Seed ITS tax system with 6 brackets (0%, 16%, 21%, 24%, 28%, 32%)
- [ ] Seed family deductions (1.0 → 5.0 parts = 0 → 44,000 FCFA)
- [ ] Seed CNPS scheme with correct rates (pension 6.3%/7.7%, family 5.0%)
- [ ] Seed sector overrides for work accident (2%, 3%, 5%)
- [ ] Seed CMU contribution (fixed amounts)
- [ ] Seed FDFP taxes (TAP 0.4%, TFPC 1.2%)
- [ ] Seed standard salary components (11, 12, 21, 22)

**Seed Data:**
```sql
-- See 03-DATABASE-SCHEMA.md lines 664-997 for complete seed data
```

---

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

**Rules (Current CNPS regulations):**
- Family allowance: 5.0% employer only (includes 0.75% maternity)
- Work accident: Variable by sector (2% services, 3% industry, 5% construction)
- Base: Salaire Catégoriel (base salary), not full gross
- No ceiling for these contributions

**Acceptance Criteria:**
- [ ] Calculate family allowance: `salaireCategoriel × 0.05` (5.0% total)
- [ ] Calculate work accident based on tenant's sector:
  - Services: 2%
  - Industry: 3%
  - Construction (BTP): 5%
- [ ] Use Salaire Catégoriel as base (base salary without allowances)

**Test Cases:**
```typescript
describe('CNPS Other Contributions', () => {
  it('should calculate for services sector', () => {
    const salaireCategoriel = 75000; // Base salary only
    const result = calculateCNPSOther(salaireCategoriel, { sector: 'services' });

    expect(result.family).toBe(3750); // 75k × 5.0%
    expect(result.workAccident).toBe(1500); // 75k × 2%
    expect(result.total).toBe(5250);
  });

  it('should use correct rate for industry sector', () => {
    const salaireCategoriel = 100000;
    const result = calculateCNPSOther(salaireCategoriel, { sector: 'industry' });

    expect(result.family).toBe(5000); // 100k × 5.0%
    expect(result.workAccident).toBe(3000); // 100k × 3%
    expect(result.total).toBe(8000);
  });

  it('should use higher rate for construction (BTP) sector', () => {
    const salaireCategoriel = 100000;
    const result = calculateCNPSOther(salaireCategoriel, { sector: 'construction' });

    expect(result.family).toBe(5000); // 100k × 5.0%
    expect(result.workAccident).toBe(5000); // 100k × 5% (max rate)
    expect(result.total).toBe(10000);
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

### FEATURE 3B: Other Payroll Taxes (Country-Specific)

**Source:** Country-specific tax regulations (e.g., FDFP in CI, 3FPT in SN)

**Critical:** These taxes vary by country and are loaded from the `other_taxes` database table.

**Multi-Country Design:**
- Taxes are defined per country in database
- Each tax has: code, name, rate, calculation_base, paid_by
- Examples:
  - **Côte d'Ivoire**: FDFP (TAP 0.4% + TFPC 1.2% = 1.6% employer)
  - **Senegal**: 3FPT (~1.5% employer)
  - **Other countries**: As configured in database

#### Story 3B.1: Calculate Other Taxes (Database-Driven)
**As a** payroll system
**I want** to calculate country-specific payroll taxes from database configuration
**So that** the system supports multiple countries without code changes

**Acceptance Criteria:**
- [ ] Load other_taxes from database by country_code and effective_date
- [ ] Calculate each tax based on its configuration (rate × calculation_base)
- [ ] Separate employer vs employee taxes
- [ ] Store in flexible JSONB structure (`other_taxes_details`)
- [ ] Include total in employer cost

**Test Cases:**
```typescript
describe('Other Taxes (Multi-Country)', () => {
  it('should calculate Côte d\'Ivoire FDFP taxes', async () => {
    const taxes = await calculateOtherTaxes('CI', new Date(), 131416, 161416);

    expect(taxes.details).toHaveLength(2);
    expect(taxes.details[0]).toMatchObject({
      code: 'fdfp_tap',
      amount: 526, // 131,416 × 0.4%
      rate: 0.004,
    });
    expect(taxes.details[1]).toMatchObject({
      code: 'fdfp_tfpc',
      amount: 1577, // 131,416 × 1.2%
      rate: 0.012,
    });
    expect(taxes.totalEmployer).toBe(2103);
  });

  it('should calculate Senegal 3FPT tax', async () => {
    const taxes = await calculateOtherTaxes('SN', new Date(), 100000, 120000);

    expect(taxes.details).toHaveLength(1);
    expect(taxes.details[0]).toMatchObject({
      code: '3fpt_training',
      amount: 1500, // 100,000 × 1.5%
      rate: 0.015,
    });
  });
});
```

**Implementation:**
```typescript
// src/features/payroll/services/other-taxes-calculation.ts

export async function calculateOtherTaxes(
  countryCode: string,
  effectiveDate: Date,
  brutImposable: number,
  totalBrut: number
) {
  // Load country-specific taxes from database
  const taxes = await db.query.other_taxes.findMany({
    where: and(
      eq(other_taxes.country_code, countryCode),
      lte(other_taxes.effective_from, effectiveDate),
      or(
        isNull(other_taxes.effective_to),
        gte(other_taxes.effective_to, effectiveDate)
      )
    ),
  });

  const details = [];
  let totalEmployer = 0;
  let totalEmployee = 0;

  for (const tax of taxes) {
    // Determine calculation base
    const base = tax.calculation_base === 'brut_imposable'
      ? brutImposable
      : totalBrut;

    const amount = Math.round(base * tax.tax_rate);

    details.push({
      code: tax.code,
      name: tax.name,
      amount,
      rate: tax.tax_rate,
      base,
      paidBy: tax.paid_by,
    });

    if (tax.paid_by === 'employer') totalEmployer += amount;
    if (tax.paid_by === 'employee') totalEmployee += amount;
  }

  return { details, totalEmployer, totalEmployee };
}

// Database structure in payroll_line_items:
// - total_other_taxes: NUMERIC (sum of all other taxes)
// - other_taxes_details: JSONB array
//   Example for CI: [
//     {"code": "fdfp_tap", "name": "TAP (FDFP)", "amount": 526, "rate": 0.004, "base": 131416},
//     {"code": "fdfp_tfpc", "name": "TFPC (FDFP)", "amount": 1577, "rate": 0.012, "base": 131416}
//   ]
```

---

### FEATURE 4: ITS (Tax on Salaries) Calculation

**Source:** Current Côte d'Ivoire tax law (2025)

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

**Source:** Current Côte d'Ivoire tax law (2025)

**Brackets (Monthly, progressive):**
```
0 - 75,000: 0%
75,001 - 240,000: 16%
240,001 - 800,000: 21%
800,001 - 2,400,000: 24%
2,400,001 - 8,000,000: 28%
8,000,001+: 32%
```

**Acceptance Criteria:**
- [ ] Apply progressive calculation on monthly taxable income (NOT annualized)
- [ ] Calculate tax for each bracket progressively
- [ ] Apply family deductions (parts fiscales) after gross tax calculation
- [ ] Round to nearest 10 FCFA (not 1 FCFA)

**Test Cases (corrected with current tax law):**
```typescript
describe('ITS Progressive Calculation', () => {
  it('should match HR example (131,416 FCFA gross)', () => {
    // From HR documentation (July 2025)
    // Gross: 131,416, CNPS: 8,279, CMU: 500
    // Taxable: 131,416 - 8,279 - 500 = 122,637 FCFA

    const taxableIncome = 122637;
    const its = calculateITS(taxableIncome, 1); // 1 fiscal part

    // Bracket 1 (0-75k): 0
    // Bracket 2 (75k-122,637): 47,637 × 16% = 7,622 FCFA
    // Family deduction (1 part): 0
    // Final tax: 7,622 FCFA (rounded to 7,620)
    expect(its.monthlyTax).toBeCloseTo(7620, -1);
  });

  it('should handle first bracket (no tax)', () => {
    const its = calculateITS(60000, 1); // Below 75k threshold
    expect(its.monthlyTax).toBe(0);
  });

  it('should calculate progressive tax correctly', () => {
    // Manual calculation for 500,000 FCFA monthly
    // Bracket 1 (0-75k): 0
    // Bracket 2 (75k-240k): 165k × 16% = 26,400
    // Bracket 3 (240k-500k): 260k × 21% = 54,600
    // Total before family: 81,000
    // With 1 part (no deduction): 81,000
    // Rounded: 81,000

    const its = calculateITS(500000, 1);
    expect(its.monthlyTax).toBe(81000);
  });

  it('should apply family deductions', () => {
    // Same 500k salary but with family (2 parts)
    const its = calculateITS(500000, 2);

    // Gross tax: 81,000 (same as above)
    // Family deduction (2 parts): 11,000 FCFA
    // Final: 81,000 - 11,000 = 70,000
    expect(its.monthlyTax).toBe(70000);
  });
});
```

**Implementation (Database-Driven):**
```typescript
// src/features/payroll/strategies/tax/progressive-monthly.ts

export class ProgressiveMonthlyTaxStrategy {
  constructor(
    private brackets: TaxBracket[],
    private familyDeductions: FamilyDeductionRule[]
  ) {}

  calculate(input: TaxInput): TaxResult {
    const { taxableIncome, fiscalParts = 1 } = input;

    let grossTax = 0;
    let remainingIncome = taxableIncome;
    const bracketBreakdown: BracketResult[] = [];

    // Calculate progressive tax using database-loaded brackets
    for (const bracket of this.brackets) {
      if (remainingIncome <= 0) break;

      const bracketMin = bracket.min_amount;
      const bracketMax = bracket.max_amount ?? Infinity;
      const bracketSize = bracketMax - bracketMin;

      const taxableInBracket = Math.min(remainingIncome, bracketSize);
      const taxForBracket = taxableInBracket * bracket.rate;

      bracketBreakdown.push({
        bracketOrder: bracket.bracket_order,
        minAmount: bracketMin,
        maxAmount: bracket.max_amount,
        rate: bracket.rate,
        taxableInBracket,
        taxAmount: taxForBracket,
      });

      grossTax += taxForBracket;
      remainingIncome -= taxableInBracket;
    }

    // Apply family deduction (from database-loaded rules)
    const familyDeduction = this.getFamilyDeduction(fiscalParts);
    const netTax = Math.max(0, grossTax - familyDeduction);

    return {
      grossTax: Math.round(grossTax),
      familyDeduction,
      netTax: Math.round(netTax / 10) * 10, // Round to nearest 10
      effectiveRate: taxableIncome > 0 ? (netTax / taxableIncome) : 0,
      bracketBreakdown,
    };
  }

  private getFamilyDeduction(fiscalParts: number): number {
    const rule = this.familyDeductions.find(r => r.fiscal_parts === fiscalParts);
    return rule?.deduction_amount ?? 0;
  }
}

// Usage in PayrollOrchestrator:
// const config = await ruleLoader.getCountryConfig(countryCode, effectiveDate);
// const strategy = new ProgressiveMonthlyTaxStrategy(
//   config.taxSystem.brackets,
//   config.taxSystem.familyDeductions
// );
// const taxResult = strategy.calculate({ taxableIncome, fiscalParts });
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

**Complete Formula (Corrected):**
```
1. Total Brut = Base + Overtime + Bonuses + Allowances
2. Brut Imposable = Total Brut - Non-taxable components (e.g., transport > 30k)
3. Salaire Catégoriel = Base salary only (for some contributions)

4. CNPS Employee = min(Brut Imposable, 3,375,000) × 6.3%
5. CMU Employee = 1,000 FCFA
6. Taxable Income = Brut Imposable - CNPS Employee - CMU Employee
7. ITS Gross = Progressive tax on monthly taxable income (6 brackets)
8. ITS Net = ITS Gross - Family Deduction (based on fiscal parts)
9. Total Employee Deductions = CNPS + CMU + ITS

10. CNPS Employer = min(Brut Imposable, 3,375,000) × 7.7%
11. CNPS Family = Salaire Catégoriel × 5.0%
12. CNPS Work Accident = Salaire Catégoriel × (2-5% by sector)
13. CMU Employer = 500 + (4,500 if family)
14. FDFP (TAP + TFPC) = Brut Imposable × 1.6%

15. Net Salary = Total Brut - Total Employee Deductions
16. Final Net = Round to nearest 10 FCFA
17. Total Employer Cost = Total Brut + All Employer Contributions
```

**Acceptance Criteria:**
- [ ] Distinguish Total Brut, Brut Imposable, and Salaire Catégoriel
- [ ] Calculate ITS using monthly progressive brackets (NOT annualized)
- [ ] Apply family deductions (parts fiscales) to ITS
- [ ] Include FDFP training taxes (1.6% employer)
- [ ] Round final net salary to nearest 10 FCFA
- [ ] Use correct contribution bases for each calculation

**Test Cases (Corrected with HR Documentation July 2025):**
```typescript
describe('Complete Payroll Calculation', () => {
  it('should match HR example (131,416 FCFA gross)', () => {
    // From HR documentation July 2025
    const result = calculatePayroll({
      baseSalary: 75000, // Salaire Catégoriel
      housingAllowance: 25000,
      transportAllowance: 30000,
      mealAllowance: 1416,
      fiscalParts: 1,
      sector: 'services',
    });

    // Total Brut
    expect(result.totalBrut).toBe(131416);

    // Brut Imposable (all components taxable in this case)
    expect(result.brutImposable).toBe(131416);

    // Employee deductions
    expect(result.cnpsEmployee).toBe(8279); // 131,416 × 6.3%
    expect(result.cmuEmployee).toBe(1000);
    expect(result.taxableIncome).toBe(122137); // 131,416 - 8,279 - 1,000
    expect(result.its).toBeCloseTo(7540, -1); // Progressive + no family deduction
    expect(result.netSalary).toBe(114600); // Rounded to nearest 10

    // Employer costs
    expect(result.cnpsEmployer).toBe(10119); // 131,416 × 7.7%
    expect(result.cnpsFamily).toBe(3750); // 75,000 × 5.0%
    expect(result.cnpsWorkAccident).toBe(1500); // 75,000 × 2% (services)
    expect(result.cmuEmployer).toBe(500); // No family
    expect(result.fdfpTap).toBe(526); // 131,416 × 0.4%
    expect(result.fdfpTfpc).toBe(1577); // 131,416 × 1.2%
  });

  it('should handle employee with family and allowances', () => {
    const result = calculatePayroll({
      baseSalary: 500000,
      housingAllowance: 100000,
      transportAllowance: 50000,
      fiscalParts: 2, // Married with children
      hasFamily: true,
      sector: 'services',
    });

    // Gross and imposable
    expect(result.totalBrut).toBe(650000);
    expect(result.brutImposable).toBe(650000); // All taxable

    // Employee deductions
    expect(result.cnpsEmployee).toBe(40950); // 650k × 6.3%
    expect(result.cmuEmployee).toBe(1000);

    // Tax with family deduction
    const taxableIncome = 608050; // 650k - 40,950 - 1,000
    // ITS gross ≈ 108,490, Family deduction (2 parts) = 11,000
    expect(result.its).toBeCloseTo(97490, -1); // Rounded to nearest 10

    // Employer costs
    expect(result.cmuEmployer).toBe(5000); // 500 + 4,500 family
    expect(result.cnpsFamily).toBe(25000); // 500k × 5.0%
    expect(result.fdfpTotal).toBe(10400); // 650k × 1.6%
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

### FEATURE 8: Event-Driven Payroll Calculations

**Source:** `09-EPIC-WORKFLOW-AUTOMATION.md` - Event-driven automation for employee lifecycle events

#### Story 8.1: Automatic Final Payroll on Termination
**As the** system
**I want** to automatically calculate final payroll when an employee is terminated
**So that** exit pay is accurate and compliant

**Acceptance Criteria:**
- [ ] `employee.terminated` event triggers final payroll calculation
- [ ] Calculate prorated salary (worked days / total working days)
- [ ] Include vacation payout (unused days × daily rate)
- [ ] Include exit benefits (indemnité de licenciement) if applicable
- [ ] Create payroll entry with `isPartialMonth: true`
- [ ] Alert HR manager when final payroll is ready

**Implementation:**
```typescript
// Event listener in features/payroll/services/event-listeners.ts
eventBus.on('employee.terminated', async (event: EmployeeTerminatedEvent) => {
  const { employeeId, terminationDate, reason } = event;

  // Calculate final payroll
  const finalPayroll = await calculateFinalPayroll({
    employeeId,
    terminationDate,
    includeProration: true,
    includeVacationPayout: true,
    includeExitBenefits: reason !== 'resignation', // No benefits for resignation
  });

  // Create final payroll entry
  await createPayrollEntry({
    employeeId,
    payrollRunId: await getCurrentOrCreatePayrollRun(terminationDate),
    baseSalary: finalPayroll.proratedSalary,
    deductions: finalPayroll.deductions,
    benefits: finalPayroll.benefits,
    vacationPayout: finalPayroll.vacationPayout,
    exitBenefits: finalPayroll.exitBenefits,
    isPartialMonth: true,
    workingDays: finalPayroll.workingDays,
    daysWorked: finalPayroll.daysWorked,
  });

  // Alert HR manager
  await createAlert({
    type: 'final_payroll_ready',
    severity: 'info',
    employeeId,
    message: `Paie de sortie calculée pour ${event.employeeName}`,
    actionUrl: `/payroll/review/${finalPayroll.id}`,
  });
});
```

**Payroll Calculation:**
```typescript
// features/payroll/services/final-payroll.ts
export async function calculateFinalPayroll(params: {
  employeeId: string;
  terminationDate: Date;
  includeProration: boolean;
  includeVacationPayout: boolean;
  includeExitBenefits: boolean;
}) {
  const employee = await getEmployee(params.employeeId);
  const currentSalary = await getCurrentSalary(params.employeeId);
  const countryCode = employee.countryCode;

  // Calculate working days in termination month
  const workingDays = getWorkingDaysInMonth(params.terminationDate, countryCode);
  const daysWorked = getDaysWorkedUntil(
    startOfMonth(params.terminationDate),
    params.terminationDate,
    countryCode
  );

  // Prorated salary
  const proratedSalary = params.includeProration
    ? (currentSalary.baseSalary / workingDays) * daysWorked
    : currentSalary.baseSalary;

  // Vacation payout
  const vacationPayout = params.includeVacationPayout
    ? await calculateVacationPayout(params.employeeId, params.terminationDate)
    : 0;

  // Exit benefits (indemnité de licenciement - Côte d'Ivoire specific)
  const exitBenefits = params.includeExitBenefits
    ? await calculateExitBenefits(params.employeeId, countryCode)
    : 0;

  // Calculate deductions on prorated amount
  const deductions = await calculateDeductions({
    employeeId: params.employeeId,
    baseSalary: proratedSalary,
    countryCode,
  });

  return {
    proratedSalary,
    workingDays,
    daysWorked,
    vacationPayout,
    exitBenefits,
    deductions,
    netPay: proratedSalary + vacationPayout + exitBenefits - deductions.total,
  };
}
```

#### Story 8.2: Automatic Prorated Payroll on Mid-Month Hire
**As the** system
**I want** to automatically calculate prorated payroll when hiring mid-month
**So that** first payroll is accurate

**Acceptance Criteria:**
- [ ] `employee.hired` event triggers first payroll calculation (if hire date > 1st of month)
- [ ] Calculate prorated salary (worked days / total working days)
- [ ] Create payroll entry with `isPartialMonth: true`
- [ ] Alert HR manager when first payroll is created

**Implementation:**
```typescript
eventBus.on('employee.hired', async (event: EmployeeHiredEvent) => {
  const { employeeId, hireDate, baseSalary } = event;

  // Only create prorated payroll if hired mid-month
  if (hireDate.getDate() > 1) {
    const firstPayroll = await calculateProratedFirstPayroll({
      employeeId,
      hireDate,
      fullMonthlySalary: baseSalary,
    });

    await createPayrollEntry({
      employeeId,
      payrollRunId: await getCurrentOrCreatePayrollRun(hireDate),
      baseSalary: firstPayroll.proratedSalary,
      isPartialMonth: true,
      workingDays: firstPayroll.workingDays,
      daysWorked: firstPayroll.daysWorked,
    });

    await createAlert({
      type: 'prorated_payroll_created',
      severity: 'info',
      employeeId,
      message: `Paie au prorata créée pour ${event.employeeName} (embauche le ${format(hireDate, 'dd MMM')})`,
      actionUrl: `/payroll/review`,
    });
  }
});
```

#### Story 8.3: Automatic Payroll Recalculation on Salary Change
**As the** system
**I want** to recalculate payroll when salary changes mid-month
**So that** payroll reflects the salary change accurately

**Acceptance Criteria:**
- [ ] `salary.changed` event triggers payroll recalculation
- [ ] Find affected payroll runs (current month if mid-month change)
- [ ] Calculate days at old salary vs new salary
- [ ] Update payroll entry with prorated amounts
- [ ] Mark payroll for HR review with flag

**Implementation:**
```typescript
eventBus.on('salary.changed', async (event: SalaryChangedEvent) => {
  const { employeeId, effectiveFrom, oldSalary, newSalary } = event;

  // Find affected payroll runs
  const affectedRuns = await getPayrollRunsAffectedBy(effectiveFrom);

  for (const run of affectedRuns) {
    // Recalculate with prorated salary
    const recalculated = await recalculatePayrollEntry({
      employeeId,
      payrollRunId: run.id,
      salaryChangeDate: effectiveFrom,
      oldSalary,
      newSalary,
    });

    // Mark for review
    await markPayrollForReview(recalculated.id, 'salary_change');
  }

  // Alert HR manager
  await createAlert({
    type: 'payroll_recalculated',
    severity: 'warning',
    employeeId,
    message: `Paie recalculée suite au changement de salaire de ${event.employeeName}`,
    actionUrl: `/payroll/review?employee=${employeeId}`,
  });
});
```

**Recalculation Function:**
```typescript
export async function recalculatePayrollEntry(params: {
  employeeId: string;
  payrollRunId: string;
  salaryChangeDate: Date;
  oldSalary: number;
  newSalary: number;
}) {
  const employee = await getEmployee(params.employeeId);
  const payrollRun = await getPayrollRun(params.payrollRunId);

  // Total working days in month
  const totalWorkingDays = getWorkingDaysInMonth(
    payrollRun.payPeriodStart,
    employee.countryCode
  );

  // Days at old salary
  const daysAtOldSalary = getDaysWorkedBetween(
    payrollRun.payPeriodStart,
    params.salaryChangeDate,
    employee.countryCode
  );

  // Days at new salary
  const daysAtNewSalary = getDaysWorkedBetween(
    addDays(params.salaryChangeDate, 1),
    payrollRun.payPeriodEnd,
    employee.countryCode
  );

  // Prorated calculation
  const salaryFromOldRate = (params.oldSalary / totalWorkingDays) * daysAtOldSalary;
  const salaryFromNewRate = (params.newSalary / totalWorkingDays) * daysAtNewSalary;
  const totalSalary = salaryFromOldRate + salaryFromNewRate;

  // Update payroll entry
  await updatePayrollEntry(params.employeeId, params.payrollRunId, {
    baseSalary: totalSalary,
    metadata: {
      salaryChange: {
        date: params.salaryChangeDate,
        oldSalary: params.oldSalary,
        newSalary: params.newSalary,
        daysAtOldSalary,
        daysAtNewSalary,
      },
    },
  });

  return { totalSalary, daysAtOldSalary, daysAtNewSalary };
}
```

#### Story 8.4: Automatic Deductions for Unpaid Leave
**As the** system
**I want** to deduct from payroll when unpaid leave is approved
**So that** payroll accurately reflects unpaid absence

**Acceptance Criteria:**
- [ ] `leave.approved` event triggers deduction (only for unpaid leave)
- [ ] Calculate deduction based on daily rate × unpaid days
- [ ] Add deduction to affected payroll run
- [ ] Alert HR manager about the deduction

**Implementation:**
```typescript
eventBus.on('leave.approved', async (event: LeaveApprovedEvent) => {
  const { employeeId, leaveType, startDate, endDate } = event;

  // Only process unpaid leave
  if (leaveType === 'unpaid') {
    const deduction = await calculateUnpaidLeaveDeduction({
      employeeId,
      startDate,
      endDate,
    });

    // Find affected payroll run
    const payrollRun = await getPayrollRunForMonth(startDate);

    // Add deduction to payroll entry
    await addPayrollDeduction({
      employeeId,
      payrollRunId: payrollRun.id,
      type: 'unpaid_leave',
      amount: deduction.amount,
      days: deduction.days,
      description: `Congé sans solde: ${deduction.days} jours`,
    });

    // Alert HR manager
    await createAlert({
      type: 'unpaid_leave_deduction',
      severity: 'info',
      employeeId,
      message: `Déduction pour congé sans solde ajoutée (${deduction.days}j - ${formatCurrency(deduction.amount)})`,
      actionUrl: `/payroll/review/${payrollRun.id}`,
    });
  }
});
```

**Database Schema Addition:**
```sql
-- Track payroll events for audit trail
CREATE TABLE payroll_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Event details
  event_type TEXT NOT NULL, -- 'termination', 'hire', 'salary_change', 'unpaid_leave'
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_run_id UUID REFERENCES payroll_runs(id),

  -- Event data
  event_date DATE NOT NULL,
  metadata JSONB, -- Event-specific data

  -- Calculated amounts
  amount_calculated DECIMAL(15, 2),
  is_prorated BOOLEAN DEFAULT false,
  working_days INTEGER,
  days_worked INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT payroll_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_payroll_events_employee ON payroll_events(employee_id, event_date);
CREATE INDEX idx_payroll_events_run ON payroll_events(payroll_run_id);
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

## Multi-Country Architecture Gaps (Identified 2025-10-05)

### 🚨 CRITICAL GAPS

The current implementation has **hardcoded Côte d'Ivoire-specific logic** in UI and export services, violating the multi-country architecture principles. These must be fixed before adding additional countries.

#### **GAP 1: Hardcoded Country Logic in UI**

**Location:** `app/payroll/calculator/page.tsx`, `app/payroll/runs/[id]/page.tsx`

**Problem:**
- Calculator UI hardcodes CI-specific fields (fiscal parts with CI labels)
- No dynamic loading of country-specific configuration
- Country selector is present but non-functional for other countries
- Missing: Dynamic form fields based on country configuration

**Impact:**
- Cannot add Senegal/other countries without code changes
- Violates "Configuration Over Code" principle
- User experience breaks for non-CI countries

**Required Fix:**
```typescript
// BEFORE (Hardcoded CI):
<SelectItem value="1.0">1.0 - Célibataire</SelectItem>
<SelectItem value="1.5">1.5 - Marié(e), 1 enfant</SelectItem>

// AFTER (Dynamic from DB):
{familyDeductionRules.map(rule => (
  <SelectItem value={rule.fiscal_parts}>{rule.label_fr}</SelectItem>
))}
```

#### **GAP 2: Country-Specific Export Services**

**Location:**
- `features/payroll/services/cnps-export.ts` (CI only)
- `features/payroll/services/cmu-export.ts` (CI only)
- `features/payroll/services/etat-301-export.ts` (CI only)

**Problem:**
- All export services are hardcoded for Côte d'Ivoire
- CNPS ceiling: Hardcoded 1,647,315 FCFA (should be from DB)
- CMU rates: Hardcoded 1,000/500/5,000 FCFA (should be from DB)
- Tax column names: French only, CI-specific terminology
- No abstraction layer for country-specific exports

**Impact:**
- Cannot generate exports for Senegal (CSS, not CNPS)
- Cannot generate exports for other countries
- Adding new country = writing new export files (code change)

**Required Fix:**
1. Create abstract `PayrollExportService` interface
2. Implement country-specific export strategies (Factory pattern)
3. Load all rates/ceilings from database configuration
4. Use `other_taxes` table for country-specific tax exports

#### **GAP 3: Hardcoded Rates in Export Services**

**Location:** All export services

**Problems:**
- `CNPS_SALARY_CAP = 1647315` (should be from `social_security_schemes.salary_ceiling`)
- `PENSION_EMPLOYEE: 0.063` (should be from `contribution_types.employee_rate`)
- `PENSION_EMPLOYER: 0.077` (should be from `contribution_types.employer_rate`)
- `CMU_RATES` object (should be from `other_taxes` table or `contribution_types`)

**Impact:**
- Rate changes require code deployment
- Cannot handle historical rate changes
- Multi-country support impossible

**Required Fix:**
```typescript
// Load rates from DB
const scheme = await getSocialScheme(countryCode, effectiveDate);
const pensionContribution = scheme.contributionTypes.find(ct => ct.code === 'pension');
const PENSION_EMPLOYEE = pensionContribution.employee_rate;
const PENSION_EMPLOYER = pensionContribution.employer_rate;
const SALARY_CAP = scheme.salary_ceiling;
```

#### **GAP 4: Missing Export Template System**

**Problem:**
- No abstraction for government portal-specific CSV/Excel templates
- Each country has different portals with unique formats:
  - **CI**: CNPS portal, CMU portal, DGI portal, each with specific column headers
  - **SN**: CSS portal, IPM portal, CFCE portal, each with different formats
  - **BF**: CNSS portal, etc.
- Each bank has its own transfer file format:
  - **CI**: BICICI, SGBCI, Ecobank, BOA - all different CSV formats
  - **SN**: CBAO, SGBS, etc. - different formats
- Hardcoded templates cannot scale

**Critical Insight:**
Government portals and banks frequently change their import formats. The system must:
1. Store templates as configuration (not code)
2. Allow super admins to update templates without deployments
3. Map payroll data to template columns dynamically

**Required Implementation:**

**Database Schema for Export Templates:**
```sql
-- Export template definitions
CREATE TABLE export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  template_type TEXT NOT NULL, -- 'social_security', 'tax', 'health', 'training_tax', 'bank_transfer'
  provider_code TEXT NOT NULL, -- 'cnps', 'css', 'bicici', 'sgbci', 'ecobank', etc.
  provider_name TEXT NOT NULL,
  file_format TEXT NOT NULL, -- 'csv', 'xlsx', 'txt', 'xml'

  -- Template structure
  columns JSONB NOT NULL, -- Array of column definitions
  headers JSONB, -- Optional header rows
  footers JSONB, -- Optional footer rows

  -- Metadata
  version TEXT NOT NULL DEFAULT '1.0',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,

  -- Documentation
  description TEXT,
  portal_url TEXT,
  documentation_url TEXT,
  sample_file_url TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Column mapping (payroll field → template column)
-- Stored in JSONB columns field:
{
  "columns": [
    {
      "position": 1,
      "name": "N°",
      "source_field": "row_number",
      "data_type": "integer",
      "required": true
    },
    {
      "position": 2,
      "name": "Matricule CNPS",
      "source_field": "employee.social_security_number",
      "data_type": "string",
      "required": true,
      "validation": "regex:^[0-9]{10}$"
    },
    {
      "position": 3,
      "name": "Nom et Prénoms",
      "source_field": "employee.full_name",
      "data_type": "string",
      "required": true
    },
    {
      "position": 4,
      "name": "Salaire Brut (FCFA)",
      "source_field": "payroll.gross_salary",
      "data_type": "currency",
      "format": "0",
      "required": true
    }
  ]
}
```

**Export Factory with Template Resolution:**
```typescript
// features/payroll/services/export-factory.ts

export class PayrollExportFactory {
  /**
   * Export with specific template
   * @param templateType - 'social_security', 'tax', 'health', 'bank_transfer'
   * @param providerCode - 'cnps', 'bicici', 'sgbci', etc.
   */
  static async export(
    runId: string,
    countryCode: string,
    templateType: string,
    providerCode: string
  ): Promise<ExportResult> {
    // 1. Load template from database
    const template = await this.loadTemplate(countryCode, templateType, providerCode);

    // 2. Load payroll data
    const payrollData = await this.loadPayrollData(runId);

    // 3. Map data to template columns
    const mappedData = this.mapDataToTemplate(payrollData, template);

    // 4. Generate file (CSV/Excel/XML)
    const file = await this.generateFile(mappedData, template);

    return file;
  }

  /**
   * Get available export templates for a country
   */
  static async getAvailableTemplates(countryCode: string): Promise<ExportTemplate[]> {
    return db.query.exportTemplates.findMany({
      where: and(
        eq(exportTemplates.countryCode, countryCode),
        eq(exportTemplates.isActive, true),
        lte(exportTemplates.effectiveFrom, new Date()),
        or(
          isNull(exportTemplates.effectiveTo),
          gte(exportTemplates.effectiveTo, new Date())
        )
      ),
      orderBy: [asc(exportTemplates.templateType), asc(exportTemplates.providerName)]
    });
  }
}
```

**UI: Dynamic Export Actions**
```typescript
// Load available exports for country
const { data: availableExports } = api.payroll.getAvailableExports.useQuery({
  countryCode: run.countryCode
});

// Render export buttons dynamically
{availableExports?.map(template => (
  <Button
    key={template.id}
    onClick={() => handleExport(template.templateType, template.providerCode)}
    variant="outline"
  >
    <FileIcon className="h-5 w-5 mr-2" />
    {template.providerName}
  </Button>
))}
```

**Benefits:**
1. **No code changes** when government changes portal format
2. **Bank-agnostic** - add any bank template via admin UI
3. **Version control** - keep historical templates for past payroll runs
4. **Self-service** - super admins can add/update templates
5. **Multi-country ready** - each country has its own template library

#### **GAP 5: Payslip Generator - CI Only**

**Location:** `features/payroll/services/payslip-generator.tsx`

**Problem:**
- Hardcoded French labels for CI regulations
- Footer text: "Code du Travail de Côte d'Ivoire"
- Column headers: CNPS (6.3%), CMU, ITS - all CI-specific
- No support for other country deduction types

**Impact:**
- Senegal payslips would show wrong labels (CSS not CNPS)
- Cannot localize for other French-speaking countries
- Legal compliance issues for non-CI countries

**Required Fix:**
1. Load deduction labels from `contribution_types.name_fr`
2. Load tax labels from `tax_systems.name`
3. Country-specific footer from `countries.labor_code_reference`
4. Dynamic sections based on country configuration

#### **GAP 6: Missing Multi-Country UI Features**

**Required Enhancements:**

1. **Country Selector in Payroll Run Creation:**
   - Currently missing country selection when creating payroll run
   - Should default to tenant's country but allow override
   - Should load country-specific validation rules

2. **Dynamic Export Actions:**
   - Export buttons hardcoded to CI exports (CNPS, CMU, État 301)
   - Should show country-specific exports:
     - CI: CNPS, CMU, État 301, FDFP
     - SN: CSS, IPM, CFCE, 3FPT
     - BF: CNSS, IUTS, CNIB

3. **Country-Aware Calculator:**
   - Fiscal parts selector only works for CI
   - Should load family deduction rules from DB
   - Should show country-specific allowances
   - Should display country-specific deduction names

---

### Implementation Plan for Multi-Country Fixes

#### Phase 1: Export Template Infrastructure (Week 1-2)
- [ ] Create `export_templates` database table
- [ ] Create `ExportTemplateMapper` service for dynamic column mapping
- [ ] Create `ExportFileGenerator` service (CSV, Excel, XML)
- [ ] Build super admin UI for template management
- [ ] Migrate existing CI templates (CNPS, CMU, État 301) to database

#### Phase 2: Database-Driven Calculations (Week 3)
- [ ] Create `RuleLoader` service (as per Epic Story 0.1)
- [ ] Refactor calculation services to load rates from DB
- [ ] Remove all hardcoded rates and ceilings
- [ ] Test with CI data to ensure no regression

#### Phase 3: Dynamic UI (Week 4)
- [ ] Load family deduction rules dynamically in calculator
- [ ] Country selector in payroll run creation
- [ ] Dynamic export buttons (load from available templates)
- [ ] Country-aware payslip generator with dynamic labels

#### Phase 4: Bank Transfer Templates (Week 5)
- [ ] Add bank transfer templates for CI banks (BICICI, SGBCI, Ecobank, BOA)
- [ ] Create bank template selector UI
- [ ] Implement standard SEPA/SWIFT export option
- [ ] Test with multiple bank formats

#### Phase 5: Second Country - Senegal (Week 6)
- [ ] Seed Senegal payroll configuration (CSS, IPM, CFCE, 3FPT)
- [ ] Add Senegal export templates (CSS portal, CBAO bank, etc.)
- [ ] Test end-to-end payroll for SN
- [ ] Validate exports match Senegal government/bank requirements

---

### Success Criteria (Multi-Country Ready)

Before adding a new country, verify:
- [ ] No hardcoded rates in any service
- [ ] All calculations use database-loaded rules
- [ ] Export templates stored in database (not code)
- [ ] UI dynamically adapts to country config
- [ ] Export buttons load from available templates
- [ ] Payslips show country-specific labels
- [ ] Bank transfers support multiple banks per country
- [ ] Super admin can add/update export templates without deployment
- [ ] Adding new country = database seed + template upload only (no code changes)

### Real-World Export Template Examples

#### Example 1: CNPS Portal (Côte d'Ivoire)
```json
{
  "template_type": "social_security",
  "provider_code": "cnps_ci",
  "provider_name": "CNPS Côte d'Ivoire",
  "file_format": "xlsx",
  "columns": [
    {"position": 1, "name": "N°", "source_field": "row_number", "data_type": "integer"},
    {"position": 2, "name": "Matricule CNPS", "source_field": "employee.cnps_number", "required": true},
    {"position": 3, "name": "Nom et Prénoms", "source_field": "employee.full_name", "required": true},
    {"position": 4, "name": "Salaire Brut", "source_field": "payroll.gross_salary", "data_type": "currency"},
    {"position": 5, "name": "Cotisation Retraite Salarié", "source_field": "calculated.cnps_pension_employee"},
    {"position": 6, "name": "Cotisation Retraite Patronale", "source_field": "calculated.cnps_pension_employer"}
  ],
  "portal_url": "https://cnps.ci/portail-employeur"
}
```

#### Example 2: BICICI Bank Transfer (Côte d'Ivoire)
```json
{
  "template_type": "bank_transfer",
  "provider_code": "bicici",
  "provider_name": "BICICI",
  "file_format": "csv",
  "delimiter": ";",
  "columns": [
    {"position": 1, "name": "COMPTE DEBITEUR", "source_field": "company.bank_account", "fixed_value": true},
    {"position": 2, "name": "COMPTE CREDITEUR", "source_field": "employee.bank_account", "required": true},
    {"position": 3, "name": "MONTANT", "source_field": "payroll.net_salary", "data_type": "currency", "format": "0.00"},
    {"position": 4, "name": "REFERENCE", "source_field": "payroll.reference"},
    {"position": 5, "name": "MOTIF", "source_field": "constant", "default_value": "SALAIRE"}
  ]
}
```

#### Example 3: CSS Portal (Sénégal)
```json
{
  "template_type": "social_security",
  "provider_code": "css_sn",
  "provider_name": "CSS Sénégal",
  "file_format": "csv",
  "columns": [
    {"position": 1, "name": "Numéro CSS", "source_field": "employee.css_number", "required": true},
    {"position": 2, "name": "Nom Complet", "source_field": "employee.full_name"},
    {"position": 3, "name": "Salaire Brut", "source_field": "payroll.gross_salary"},
    {"position": 4, "name": "Cotisation Salarié", "source_field": "calculated.css_employee"},
    {"position": 5, "name": "Cotisation Patronale", "source_field": "calculated.css_employer"}
  ]
}
```

---

**Next:** Read `06-EPIC-EMPLOYEE-MANAGEMENT.md`
