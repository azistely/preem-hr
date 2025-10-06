# Compliance Unified Roadmap

**Unified Implementation Plan for Legal Compliance**

**Date:** 2025-10-06
**Status:** 🎯 **ACTIVE ROADMAP**

---

## 🎯 Executive Summary

This document unifies two compliance initiatives:
1. **EPIC-COMPLIANCE-IMPACT-ANALYSIS.md** - Convention Collective compliance (termination, leave, overtime)
2. **SECTORS-INDUSTRIES-MANAGEMENT.md** + **COMPLIANCE-IMPLEMENTATION-PLAN.md** - Sector-based mandatory components

**Key Insight:** Sector management is the **foundation** that all other compliance features depend on.

**Timeline:** 11 weeks total (P0 features)

**Critical Path:**
```
Week 1-2: Foundations (Sectors + Coefficients)
  ↓
Week 3-5: Critical Compliance (Termination + Required Components)
  ↓
Week 6-8: Payroll Compliance (Sector Rates + Overtime)
  ↓
Week 9-11: Enhanced Features (Leave Management)
```

---

## 📐 Architecture: Dependencies Graph

```
┌─────────────────────────────────────────────────────────────┐
│                   FOUNDATION LAYER (P0)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EPIC-12: Sector Management                                 │
│  ├─ tenants.sector_code                                     │
│  ├─ sector_configurations table                             │
│  └─ Required components enforcement                         │
│                                                              │
│  EPIC-06 Enhancement: Coefficient System                    │
│  └─ employees.coefficient                                   │
│                                                              │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────────────┬──────────────────────────┐
             ▼                     ▼                          ▼
┌─────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│   EPIC-10           │ │   EPIC-05        │ │   EPIC-07            │
│   Termination       │ │   Payroll        │ │   Time & Attendance  │
│                     │ │                  │ │                      │
│ Depends on:         │ │ Depends on:      │ │ Depends on:          │
│ • sector_code       │ │ • sector_code    │ │ • sector_code        │
│ • coefficient       │ │ • coefficient    │ │ • sector_config      │
│                     │ │ • sector_config  │ │                      │
│ Features:           │ │                  │ │ Features:            │
│ • Notice period     │ │ Features:        │ │ • Overtime rates     │
│ • Severance calc    │ │ • Sector rates   │ │ • Age-based leave    │
│ • Work certificate  │ │ • Accident rates │ │ • Seniority leave    │
│ • Final payslip     │ │ • Smart defaults │ │ • Special leave      │
└─────────────────────┘ └──────────────────┘ └──────────────────────┘
             │                     │                          │
             └─────────────────────┴──────────────────────────┘
                                   ▼
                      ┌────────────────────────────┐
                      │   EPIC-11                  │
                      │   Leave Management         │
                      │                            │
                      │ Depends on:                │
                      │ • sector_code (defaults)   │
                      │ • coefficient (accrual)    │
                      │ • EPIC-07 (leave rules)    │
                      │                            │
                      │ Features:                  │
                      │ • Leave accrual engine     │
                      │ • Maternity leave          │
                      │ • Leave balance tracking   │
                      │ • Approval workflow        │
                      └────────────────────────────┘
```

---

## 🚀 Implementation Sprints

### Sprint 1: Foundations (Weeks 1-2)

**Goal:** Establish sector and coefficient systems as foundation for all compliance features

#### Week 1: Tenant Sector Management

**EPIC-12, FEATURE 1: Mandatory Sector Assignment**

**Database Migration:**
```sql
-- File: supabase/migrations/20251007_add_tenant_sector.sql

-- Add sector_code field
ALTER TABLE tenants
  ADD COLUMN sector_code VARCHAR(50);

-- Add foreign key
ALTER TABLE tenants
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code);

-- Migrate existing tenants (best-effort from industry field)
UPDATE tenants
SET sector_code = CASE
  WHEN industry ILIKE '%construct%' OR industry ILIKE '%btp%' THEN 'CONSTRUCTION'
  WHEN industry ILIKE '%agri%' THEN 'AGRICULTURE'
  WHEN industry ILIKE '%mining%' THEN 'MINING'
  WHEN industry ILIKE '%transport%' THEN 'TRANSPORT'
  WHEN industry ILIKE '%industr%' THEN 'INDUSTRY'
  ELSE 'SERVICES'
END
WHERE country_code = 'CI' AND sector_code IS NULL;

-- Make required
ALTER TABLE tenants ALTER COLUMN sector_code SET NOT NULL;

-- Index
CREATE INDEX idx_tenants_sector ON tenants(country_code, sector_code);
```

**tRPC Endpoints:**
- `sectors.listSectorsForCountry` - Get available sectors
- `sectors.getSectorDetails` - Get config + required components
- `sectors.updateTenantSector` - Change tenant sector (validates + auto-activates)

**UI Components:**
- Sector selection page (onboarding)
- Sector cards (shows rates + required components)
- Tenant settings sector display

**Deliverables:**
- ✅ All tenants have valid sector_code
- ✅ Sector selection in onboarding flow
- ✅ tRPC endpoints functional
- ✅ Tests pass (sector validation, foreign key constraints)

---

#### Week 2: Employee Coefficient System

**EPIC-06 Enhancement: Employee Classification**

**Database Migration:**
```sql
-- File: supabase/migrations/20251008_add_employee_coefficient.sql

-- Add coefficient field
ALTER TABLE employees
  ADD COLUMN coefficient INTEGER DEFAULT 100;

-- Add constraint (minimum 90 per Convention Collective)
ALTER TABLE employees
  ADD CONSTRAINT check_coefficient CHECK (coefficient >= 90);

-- Add index
CREATE INDEX idx_employees_coefficient ON employees(coefficient);

-- Seed coefficient reference data
CREATE TABLE employee_category_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  category VARCHAR(10) NOT NULL, -- A1, A2, B1, B2, C, D, E, F
  min_coefficient INTEGER NOT NULL,
  typical_coefficient INTEGER NOT NULL,
  description TEXT,
  notice_period_days INTEGER NOT NULL, -- For EPIC-10
  UNIQUE(country_code, category)
);

-- CI coefficient system
INSERT INTO employee_category_coefficients (country_code, category, min_coefficient, typical_coefficient, description, notice_period_days) VALUES
('CI', 'A1', 90, 90, 'Manœuvre (laborer)', 8),
('CI', 'A2', 100, 100, 'Ouvrier spécialisé (semi-skilled worker)', 8),
('CI', 'B1', 120, 120, 'Ouvrier qualifié (skilled worker)', 15),
('CI', 'B2', 140, 140, 'Ouvrier hautement qualifié (highly skilled)', 15),
('CI', 'C', 170, 170, 'Agent de maîtrise (supervisor)', 30),
('CI', 'D', 230, 230, 'Cadre niveau 1 (junior manager)', 60),
('CI', 'E', 350, 350, 'Cadre niveau 2 (manager)', 90),
('CI', 'F', 550, 550, 'Cadre supérieur (senior executive)', 90);
```

**Business Logic:**
```typescript
// lib/compliance/coefficient-validation.ts

export async function validateSalaryForCoefficient(
  baseSalary: number,
  coefficient: number,
  countryCode: string
): Promise<{ valid: boolean; minSalary: number; message?: string }> {
  const smig = await getSMIG(countryCode);
  const minSalary = smig * (coefficient / 100);

  if (baseSalary < minSalary) {
    return {
      valid: false,
      minSalary,
      message: `Salaire inférieur au minimum légal (SMIG × coefficient): ${minSalary.toLocaleString('fr-FR')} FCFA`
    };
  }

  return { valid: true, minSalary };
}

export async function getCategoryForCoefficient(
  coefficient: number,
  countryCode: string
): Promise<string> {
  const categories = await db.query.employeeCategoryCoefficients.findMany({
    where: eq(employeeCategoryCoefficients.countryCode, countryCode),
    orderBy: desc(employeeCategoryCoefficients.minCoefficient),
  });

  for (const cat of categories) {
    if (coefficient >= cat.minCoefficient) {
      return cat.category;
    }
  }

  return 'A1'; // Fallback
}
```

**UI Updates:**
- Hire wizard: Add coefficient field with category selector
- Employee profile: Display coefficient + category
- Validation: Show error if salary < SMIG × coefficient

**Deliverables:**
- ✅ `employees.coefficient` field added
- ✅ Category-coefficient reference table seeded
- ✅ Validation logic implemented
- ✅ UI shows coefficient in hire wizard
- ✅ Tests cover validation scenarios

---

### Sprint 2: Critical Compliance (Weeks 3-5)

**Goal:** Implement termination workflows and enforce sector-based required components

#### Week 3: Termination Wizard & Notice Period

**EPIC-10, FEATURE 1-2: Termination Wizard + Notice Period**

**Database Schema:**
```sql
-- File: supabase/migrations/20251009_create_terminations.sql

CREATE TABLE employee_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  termination_date DATE NOT NULL,
  termination_reason TEXT NOT NULL,
  notice_period_days INTEGER NOT NULL,
  notice_start_date DATE NOT NULL,
  notice_end_date DATE NOT NULL,
  notice_payment_in_lieu BOOLEAN DEFAULT FALSE,
  notice_payment_amount DECIMAL(15,2),
  job_search_days_granted INTEGER DEFAULT 0, -- 2 days/week for dismissals
  severance_amount DECIMAL(15,2),
  vacation_payout_amount DECIMAL(15,2),
  average_salary_12m DECIMAL(15,2),
  work_certificate_url TEXT,
  work_certificate_generated_at TIMESTAMPTZ,
  final_payslip_url TEXT,
  final_payslip_generated_at TIMESTAMPTZ,
  cnps_attestation_url TEXT,
  cnps_attestation_generated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_termination_reason CHECK (
    termination_reason IN ('dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end')
  ),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'notice_period', 'completed', 'cancelled'))
);

-- RLS
ALTER TABLE employee_terminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_terminations
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

**Business Logic:**
```typescript
// features/termination/services/notice-period-calculator.ts

export async function calculateNoticePeriod(
  employeeId: string
): Promise<NoticePeriodResult> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { coefficient: true, tenant_id: true },
  });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, employee.tenant_id),
    columns: { country_code: true },
  });

  // Get category from coefficient
  const category = await getCategoryForCoefficient(employee.coefficient, tenant.country_code);

  // Get notice period from category_coefficients table
  const categoryConfig = await db.query.employeeCategoryCoefficients.findFirst({
    where: and(
      eq(employeeCategoryCoefficients.countryCode, tenant.country_code),
      eq(employeeCategoryCoefficients.category, category)
    ),
  });

  return {
    category,
    noticePeriodDays: categoryConfig.notice_period_days,
    jobSearchDaysPerWeek: ['dismissal'].includes(reason) ? 2 : 0, // Article 36
    paymentInLieuAllowed: ['E', 'F'].includes(category), // Only for executives
  };
}
```

**UI: Termination Wizard**
```typescript
// app/employees/[id]/terminate/page.tsx

<WizardStep title="Préavis" icon={Calendar}>
  <NoticePeriodPreview
    category={employee.category}
    noticeDays={calculatedNotice.noticePeriodDays}
    startDate={terminationDate}
    endDate={addDays(terminationDate, calculatedNotice.noticePeriodDays)}
    jobSearchDays={calculatedNotice.jobSearchDaysPerWeek}
  />
  {calculatedNotice.paymentInLieuAllowed && (
    <Checkbox>
      Payer l'indemnité de préavis (dispense de préavis)
    </Checkbox>
  )}
</WizardStep>
```

**Deliverables:**
- ✅ Termination wizard (3 steps: reason, notice, review)
- ✅ Notice period calculated by category
- ✅ Job search time tracked (2 days/week for dismissals)
- ✅ Payment in lieu option (E-F only)

---

#### Week 4: Severance Calculator

**EPIC-10, FEATURE 3: Severance Calculator**

**Business Logic:**
```typescript
// features/termination/services/severance-calculator.ts

export async function calculateSeverance(
  employeeId: string,
  terminationReason: string
): Promise<SeveranceResult> {
  // Exemptions (Article 37)
  if (['misconduct', 'resignation', 'retirement'].includes(terminationReason)) {
    return { amount: 0, taxable: 0, taxFree: 0, reason: 'Exempt per Article 37' };
  }

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { tenant: true },
  });

  // Calculate average monthly salary (last 12 months)
  const payrollHistory = await db.query.payrollRuns.findMany({
    where: and(
      eq(payrollRuns.employeeId, employeeId),
      gte(payrollRuns.period, subtractMonths(new Date(), 12))
    ),
    orderBy: desc(payrollRuns.period),
    limit: 12,
  });

  const avgMonthlySalary = payrollHistory.reduce((sum, pr) => sum + pr.grossSalary, 0) / 12;

  // Calculate seniority (hire date to termination date)
  const seniorityYears = differenceInYears(new Date(), new Date(employee.hireDate));

  // Tiered calculation (Article 37)
  let severance = 0;
  for (let year = 1; year <= seniorityYears; year++) {
    if (year <= 5) {
      severance += avgMonthlySalary * 0.30; // 30% per year (years 1-5)
    } else if (year <= 10) {
      severance += avgMonthlySalary * 0.35; // 35% per year (years 6-10)
    } else {
      severance += avgMonthlySalary * 0.40; // 40% per year (years 11+)
    }
  }

  // Legal minimum (tax-free) vs excess (taxable)
  const legalMinimum = severance;
  const taxFree = legalMinimum;
  const taxable = 0; // Only excess over legal minimum is taxable

  return {
    amount: severance,
    taxFree,
    taxable,
    avgMonthlySalary,
    seniorityYears,
    breakdown: {
      years1to5: Math.min(seniorityYears, 5) * avgMonthlySalary * 0.30,
      years6to10: Math.max(0, Math.min(seniorityYears - 5, 5)) * avgMonthlySalary * 0.35,
      years11plus: Math.max(0, seniorityYears - 10) * avgMonthlySalary * 0.40,
    },
  };
}
```

**UI: Severance Preview**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Indemnité de licenciement</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="flex justify-between">
        <span>Ancienneté:</span>
        <strong>{severance.seniorityYears} ans</strong>
      </div>
      <div className="flex justify-between">
        <span>Salaire moyen (12 derniers mois):</span>
        <strong>{severance.avgMonthlySalary.toLocaleString('fr-FR')} FCFA</strong>
      </div>
      <Separator />
      <div className="text-sm space-y-2">
        <div className="flex justify-between">
          <span>Années 1-5 (30%):</span>
          <span>{severance.breakdown.years1to5.toLocaleString('fr-FR')} FCFA</span>
        </div>
        {severance.breakdown.years6to10 > 0 && (
          <div className="flex justify-between">
            <span>Années 6-10 (35%):</span>
            <span>{severance.breakdown.years6to10.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}
        {severance.breakdown.years11plus > 0 && (
          <div className="flex justify-between">
            <span>Années 11+ (40%):</span>
            <span>{severance.breakdown.years11plus.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}
      </div>
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>Total:</span>
        <span className="text-primary">{severance.amount.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Exonéré d'impôts (minimum légal)
        </AlertDescription>
      </Alert>
    </div>
  </CardContent>
</Card>
```

**Deliverables:**
- ✅ Severance calculator (tiered 30/35/40%)
- ✅ Average salary calculation (last 12 months)
- ✅ Tax treatment (legal minimum = tax-free)
- ✅ Exemptions handled (misconduct, resignation)
- ✅ UI shows breakdown by years

---

#### Week 5: Document Generation + Final Payslip

**EPIC-10, FEATURE 4-5: Documents + Payroll Integration**

**Document Templates:**
```typescript
// features/termination/services/document-generator.ts

export async function generateWorkCertificate(
  terminationId: string
): Promise<DocumentResult> {
  const termination = await db.query.employeeTerminations.findFirst({
    where: eq(employeeTerminations.id, terminationId),
    with: { employee: true, tenant: true },
  });

  const template = `
    CERTIFICAT DE TRAVAIL

    Je soussigné, ${termination.tenant.name}, certifie avoir employé:

    Nom: ${termination.employee.lastName}
    Prénom: ${termination.employee.firstName}
    Date de naissance: ${format(termination.employee.dateOfBirth, 'dd/MM/yyyy')}

    Période d'emploi: Du ${format(termination.employee.hireDate, 'dd/MM/yyyy')}
                      au ${format(termination.terminationDate, 'dd/MM/yyyy')}

    Poste occupé: ${termination.employee.position}
    Catégorie/Coefficient: ${termination.employee.category} / ${termination.employee.coefficient}

    Motif de départ: ${getReasonLabel(termination.terminationReason)}

    Le présent certificat est délivré pour servir et valoir ce que de droit.
    L'employé est libre de tout engagement envers notre entreprise.

    Fait à Abidjan, le ${format(new Date(), 'dd/MM/yyyy')}

    [Signature et cachet de l'entreprise]
  `;

  const pdf = await generatePDF(template);
  const url = await uploadDocument(pdf, `work-certificate-${terminationId}.pdf`);

  await db.update(employeeTerminations)
    .set({
      work_certificate_url: url,
      work_certificate_generated_at: new Date().toISOString()
    })
    .where(eq(employeeTerminations.id, terminationId));

  return { url, generatedAt: new Date() };
}

export async function generateFinalPayslip(
  terminationId: string
): Promise<PayslipResult> {
  const termination = await db.query.employeeTerminations.findFirst({
    where: eq(employeeTerminations.id, terminationId),
    with: { employee: true },
  });

  // Trigger payroll calculation with terminal payments
  const payroll = await calculatePayrollV2({
    employeeId: termination.employee_id,
    period: format(termination.terminationDate, 'yyyy-MM'),
    terminalPayments: {
      noticePay: termination.notice_payment_amount || 0,
      severance: termination.severance_amount || 0,
      vacationPayout: termination.vacation_payout_amount || 0,
    },
  });

  const payslipUrl = await generatePayslipPDF(payroll);

  await db.update(employeeTerminations)
    .set({
      final_payslip_url: payslipUrl,
      final_payslip_generated_at: new Date().toISOString(),
      status: 'completed',
    })
    .where(eq(employeeTerminations.id, terminationId));

  return { url: payslipUrl, payroll };
}
```

**Compliance Tracking:**
```typescript
// features/termination/services/compliance-tracker.ts

export async function checkTerminationCompliance(
  terminationId: string
): Promise<ComplianceStatus> {
  const termination = await db.query.employeeTerminations.findFirst({
    where: eq(employeeTerminations.id, terminationId),
  });

  const now = new Date();
  const terminationDate = new Date(termination.termination_date);

  return {
    workCertificate: {
      required: true,
      deadline: addDays(terminationDate, 2), // 48 hours
      status: termination.work_certificate_generated_at ? 'completed' : 'pending',
      overdue: !termination.work_certificate_generated_at &&
               isAfter(now, addDays(terminationDate, 2)),
    },
    finalPayslip: {
      required: true,
      deadline: addDays(terminationDate, 8), // 8 days
      status: termination.final_payslip_generated_at ? 'completed' : 'pending',
      overdue: !termination.final_payslip_generated_at &&
               isAfter(now, addDays(terminationDate, 8)),
    },
    cnpsAttestation: {
      required: true,
      deadline: addDays(terminationDate, 15), // 15 days
      status: termination.cnps_attestation_generated_at ? 'completed' : 'pending',
      overdue: !termination.cnps_attestation_generated_at &&
               isAfter(now, addDays(terminationDate, 15)),
    },
  };
}
```

**Deliverables:**
- ✅ Work certificate generator (48-hour deadline)
- ✅ Final payslip with terminal payments
- ✅ CNPS attestation generator
- ✅ Compliance tracker (deadline warnings)
- ✅ Employee status update (active → terminated)

---

#### Parallel Week 3-5: Required Components Enforcement

**EPIC-12, FEATURE 2: Sector-Based Required Components**

**Business Logic:**
```typescript
// lib/compliance/sector-enforcement.ts (from COMPLIANCE-IMPLEMENTATION-PLAN.md)

export async function enforceRequiredComponents(
  tenantId: string,
  sectorCode: string
) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  const sectorConfig = await getSectorConfig(tenant.country_code, sectorCode);
  const requiredCodes = sectorConfig.default_components.commonComponents;

  // Get templates for required codes
  const templates = await db.query.salaryComponentTemplates.findMany({
    where: and(
      eq(salaryComponentTemplates.countryCode, tenant.country_code),
      inArray(salaryComponentTemplates.code, requiredCodes)
    ),
  });

  // Check existing activations
  const existingActivations = await db.query.tenantSalaryComponentActivations.findMany({
    where: eq(tenantSalaryComponentActivations.tenantId, tenantId),
  });

  const existingTemplateIds = existingActivations.map(a => a.templateId);

  // Activate missing required components
  const toActivate = templates.filter(t => !existingTemplateIds.includes(t.id));

  for (const template of toActivate) {
    await db.insert(tenantSalaryComponentActivations).values({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      template_id: template.id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { activated: toActivate.length, required: requiredCodes };
}
```

**tRPC Validation:**
```typescript
// server/routers/salary-components.ts

deactivateComponent: protectedProcedure
  .input(z.object({ activationId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const activation = await ctx.db.query.tenantSalaryComponentActivations.findFirst({
      where: eq(tenantSalaryComponentActivations.id, input.activationId),
      with: { template: { columns: { code: true } } },
    });

    // Check if required by sector
    const isRequired = await isComponentRequiredBySector(
      ctx.tenant.id,
      activation.template.code
    );

    if (isRequired) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot deactivate ${activation.template.code}: Required by sector ${ctx.tenant.sector_code}`,
      });
    }

    await ctx.db.update(tenantSalaryComponentActivations)
      .set({ is_active: false })
      .where(eq(tenantSalaryComponentActivations.id, input.activationId));

    return { success: true };
  }),
```

**UI: Compliance Badges**
```typescript
// app/settings/salary-components/page.tsx

{isRequired && (
  <Badge variant="destructive" className="gap-1">
    <Lock className="h-3 w-3" />
    Requis par secteur {tenant.sector_code}
  </Badge>
)}
<Button
  disabled={isRequired}
  onClick={() => handleDeactivate(activation.id)}
>
  {isRequired ? 'Non modifiable' : 'Désactiver'}
</Button>
```

**Deliverables:**
- ✅ Auto-activation of required components on sector change
- ✅ Validation prevents deactivating required components
- ✅ UI shows lock badges
- ✅ Error messages reference sector

---

### Sprint 3: Payroll Compliance (Weeks 6-8)

**Goal:** Implement sector-specific payroll rates and overtime calculations

#### Week 6: Sector-Specific Payroll Rates

**EPIC-12, FEATURE 3: Sector Rates in Payroll**

**Payroll Integration:**
```typescript
// features/payroll/services/payroll-calculation-v2.ts

export async function calculatePayrollV2(params: PayrollCalculationParams) {
  // Get employee's sector
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, employee.tenant_id),
    columns: { country_code: true, sector_code: true },
  });

  if (!tenant.sector_code) {
    throw new Error(`Tenant has no sector assigned`);
  }

  // Load sector configuration
  const sectorConfig = await getSectorConfig(tenant.country_code, tenant.sector_code);

  // Use sector-specific work accident rate
  const workAccidentRate = parseFloat(sectorConfig.work_accident_rate);

  // Check for sector contribution overrides
  const contributionOverrides = await db.query.sectorContributionOverrides.findMany({
    where: eq(sectorContributionOverrides.sectorCode, tenant.sector_code),
  });

  // Apply sector rates
  const contributions = {
    workAccident: {
      employer_rate: workAccidentRate,
      employer_amount: salaireCategoriel * workAccidentRate,
    },
    // ... other contributions with overrides if present
  };

  return { ...payroll, contributions };
}
```

**Tests:**
```typescript
// features/payroll/services/__tests__/sector-payroll.test.ts

test('CONSTRUCTION uses 5% work accident rate', async () => {
  const tenant = await createTenant({ country_code: 'CI', sector_code: 'CONSTRUCTION' });
  const employee = await createEmployee({ tenant_id: tenant.id, base_salary: 200000 });

  const payroll = await calculatePayrollV2({ employee_id: employee.id, period: '2025-01' });

  expect(payroll.contributions.workAccident.employer_rate).toBe(0.05);
  expect(payroll.contributions.workAccident.employer_amount).toBe(10000); // 5% of 200k
});

test('SERVICES uses 2% work accident rate', async () => {
  const tenant = await createTenant({ country_code: 'CI', sector_code: 'SERVICES' });
  const employee = await createEmployee({ tenant_id: tenant.id, base_salary: 200000 });

  const payroll = await calculatePayrollV2({ employee_id: employee.id, period: '2025-01' });

  expect(payroll.contributions.workAccident.employer_rate).toBe(0.02);
  expect(payroll.contributions.workAccident.employer_amount).toBe(4000); // 2% of 200k
});
```

**Deliverables:**
- ✅ Payroll loads sector from tenant
- ✅ Work accident rate uses sector config
- ✅ Contribution overrides applied
- ✅ Tests verify rates per sector

---

#### Weeks 7-8: Overtime Calculation (Convention Collective Compliant)

**EPIC-07 Enhancement: Overtime Rates**

**Database Schema:**
```sql
-- File: supabase/migrations/20251010_create_overtime_rates.sql

CREATE TABLE overtime_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  period_type TEXT NOT NULL, -- 'weekday_41_48', 'weekday_48_plus', 'saturday', 'sunday', 'holiday', 'night'
  rate_multiplier DECIMAL(3,2) NOT NULL, -- 1.15, 1.50, 1.75, 2.00
  effective_from DATE NOT NULL,
  effective_to DATE,
  UNIQUE(country_code, period_type, effective_from)
);

-- CI overtime rates (Article 23)
INSERT INTO overtime_rates (country_code, period_type, rate_multiplier, effective_from) VALUES
('CI', 'weekday_41_48', 1.15, '1977-01-01'),   -- +15%
('CI', 'weekday_48_plus', 1.50, '1977-01-01'), -- +50%
('CI', 'saturday', 1.50, '1977-01-01'),         -- +50%
('CI', 'sunday', 1.75, '1977-01-01'),           -- +75%
('CI', 'holiday', 2.00, '1977-01-01'),          -- +100%
('CI', 'night', 1.75, '1977-01-01');            -- +75% (9pm-5am)

-- Timesheet overtime tracking
CREATE TABLE timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,
  hours_worked DECIMAL(4,2) NOT NULL,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  overtime_type TEXT, -- NULL, 'weekday_41_48', 'weekday_48_plus', 'saturday', 'sunday', 'holiday', 'night'
  rate_multiplier DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Business Logic:**
```typescript
// features/time-tracking/services/overtime-calculator.ts

export async function calculateOvertimeForWeek(
  employeeId: string,
  weekStart: Date
): Promise<OvertimeResult> {
  const entries = await db.query.timesheetEntries.findMany({
    where: and(
      eq(timesheetEntries.employeeId, employeeId),
      gte(timesheetEntries.date, weekStart),
      lt(timesheetEntries.date, addDays(weekStart, 7))
    ),
  });

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { tenant: true },
  });

  const overtimeRates = await db.query.overtimeRates.findMany({
    where: eq(overtimeRates.countryCode, employee.tenant.country_code),
  });

  let totalRegularHours = 0;
  let overtimeByType: Record<string, number> = {};

  for (const entry of entries) {
    const dayOfWeek = getDay(entry.date);
    const isHoliday = await isPublicHoliday(entry.date, employee.tenant.country_code);

    // Saturday overtime
    if (dayOfWeek === 6) {
      overtimeByType['saturday'] = (overtimeByType['saturday'] || 0) + entry.hours_worked;
    }
    // Sunday overtime
    else if (dayOfWeek === 0) {
      overtimeByType['sunday'] = (overtimeByType['sunday'] || 0) + entry.hours_worked;
    }
    // Public holiday overtime
    else if (isHoliday) {
      overtimeByType['holiday'] = (overtimeByType['holiday'] || 0) + entry.hours_worked;
    }
    // Weekday regular/overtime
    else {
      totalRegularHours += entry.hours_worked;
    }
  }

  // Weekday overtime tiers
  if (totalRegularHours > 40) {
    const hours41to48 = Math.min(totalRegularHours - 40, 8);
    const hours48plus = Math.max(totalRegularHours - 48, 0);

    if (hours41to48 > 0) {
      overtimeByType['weekday_41_48'] = hours41to48;
    }
    if (hours48plus > 0) {
      overtimeByType['weekday_48_plus'] = hours48plus;
    }
  }

  // Calculate overtime pay
  const hourlyRate = employee.base_salary / 173.33; // Monthly to hourly (40h/week × 4.33 weeks)
  let overtimePay = 0;

  for (const [type, hours] of Object.entries(overtimeByType)) {
    const rate = overtimeRates.find(r => r.period_type === type);
    overtimePay += hours * hourlyRate * parseFloat(rate.rate_multiplier);
  }

  return {
    regularHours: Math.min(totalRegularHours, 40),
    overtimeBreakdown: overtimeByType,
    overtimePay,
    hourlyRate,
  };
}
```

**UI: Timesheet Entry**
```typescript
// app/time-tracking/timesheet/page.tsx

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Date</TableHead>
      <TableHead>Heures travaillées</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Majoration</TableHead>
      <TableHead>Montant</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {overtimeBreakdown.map(({ type, hours, rate, amount }) => (
      <TableRow key={type}>
        <TableCell>{format(date, 'dd/MM/yyyy')}</TableCell>
        <TableCell>{hours}h</TableCell>
        <TableCell>
          <Badge variant={getBadgeVariant(type)}>
            {getOvertimeLabel(type)}
          </Badge>
        </TableCell>
        <TableCell>+{(rate - 1) * 100}%</TableCell>
        <TableCell className="font-bold">
          {amount.toLocaleString('fr-FR')} FCFA
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Deliverables:**
- ✅ Overtime rates table (database-driven)
- ✅ Weekday overtime (41-48h = +15%, 48h+ = +50%)
- ✅ Weekend overtime (Saturday +50%, Sunday +75%)
- ✅ Holiday overtime (+100%)
- ✅ Night work (+75%, 9pm-5am)
- ✅ Payroll integration
- ✅ Tests cover all scenarios

---

### Sprint 4: Enhanced Features (Weeks 9-11)

**Goal:** Implement comprehensive leave management with age-based and seniority-based accrual

#### Weeks 9-10: Leave Accrual Engine

**EPIC-11, FEATURE 1: Annual Leave Accrual**

**Database Schema:**
```sql
-- File: supabase/migrations/20251011_create_leave_system.sql

CREATE TYPE leave_category AS ENUM (
  'annual', 'maternity', 'marriage_employee', 'marriage_child', 'birth',
  'death_spouse_child', 'death_parent', 'death_sibling', 'moving', 'sick', 'unpaid'
);

CREATE TABLE leave_accrual_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  age_threshold INTEGER, -- NULL = all ages, 21 = under 21
  seniority_years INTEGER, -- NULL = standard, 15/20/25 = seniority thresholds
  days_per_month DECIMAL(3,1) NOT NULL,
  bonus_days INTEGER DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE
);

-- CI leave rules (Article 28)
INSERT INTO leave_accrual_rules (country_code, age_threshold, seniority_years, days_per_month, bonus_days, effective_from) VALUES
('CI', NULL, NULL, 2.0, 0, '1977-01-01'), -- Standard: 24 days/year
('CI', 21, NULL, 2.5, 0, '1977-01-01'),   -- Under 21: 30 days/year
('CI', NULL, 15, 2.0, 2, '1977-01-01'),   -- 15 years: +2 days
('CI', NULL, 20, 2.0, 4, '1977-01-01'),   -- 20 years: +4 days
('CI', NULL, 25, 2.0, 6, '1977-01-01');   -- 25 years: +6 days

CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  accrual_period_start DATE NOT NULL, -- June 1
  accrual_period_end DATE NOT NULL,   -- May 31
  days_accrued DECIMAL(5,2) NOT NULL,
  days_taken DECIMAL(5,2) DEFAULT 0,
  days_carried_over DECIMAL(5,2) DEFAULT 0, -- Max 12 days (6 months)
  days_forfeited DECIMAL(5,2) DEFAULT 0,
  current_balance DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, accrual_period_start)
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_category leave_category NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count DECIMAL(4,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Business Logic:**
```typescript
// features/leave/services/accrual-calculator.ts

export async function calculateAnnualLeaveAccrual(
  employeeId: string,
  accrualPeriod: { start: Date; end: Date }
): Promise<AccrualResult> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { tenant: true },
  });

  const age = differenceInYears(new Date(), new Date(employee.date_of_birth));
  const seniority = differenceInYears(new Date(), new Date(employee.hire_date));

  // Load applicable accrual rules
  const rules = await db.query.leaveAccrualRules.findMany({
    where: eq(leaveAccrualRules.countryCode, employee.tenant.country_code),
  });

  let daysPerMonth = 2.0; // Default
  let bonusDays = 0;

  // Age-based accrual (under 21 = 2.5 days/month)
  if (age < 21) {
    const ageRule = rules.find(r => r.age_threshold === 21);
    if (ageRule) daysPerMonth = parseFloat(ageRule.days_per_month);
  }

  // Seniority bonus (15/20/25 years)
  const seniorityRule = rules
    .filter(r => r.seniority_years !== null && seniority >= r.seniority_years)
    .sort((a, b) => b.seniority_years - a.seniority_years)[0];

  if (seniorityRule) {
    bonusDays = seniorityRule.bonus_days;
  }

  // Calculate accrued days (12 months × days_per_month + bonus)
  const monthsInPeriod = differenceInMonths(accrualPeriod.end, accrualPeriod.start);
  const accruedDays = (monthsInPeriod * daysPerMonth) + bonusDays;

  return {
    daysPerMonth,
    bonusDays,
    totalAccrued: accruedDays,
    age,
    seniority,
  };
}

export async function enforceCarryoverLimit(
  employeeId: string,
  previousPeriodBalance: number
): Promise<CarryoverResult> {
  const MAX_CARRYOVER_MONTHS = 6;
  const MAX_CARRYOVER_DAYS = MAX_CARRYOVER_MONTHS * 2; // 12 days (6 months × 2 days/month)

  const carriedOver = Math.min(previousPeriodBalance, MAX_CARRYOVER_DAYS);
  const forfeited = Math.max(previousPeriodBalance - MAX_CARRYOVER_DAYS, 0);

  return { carriedOver, forfeited };
}
```

**Deliverables:**
- ✅ Leave accrual engine (age + seniority aware)
- ✅ Carryover limit enforcement (max 12 days)
- ✅ Leave balance tracking
- ✅ Accrual period management (June 1 - May 31)

---

#### Week 11: Special Leave Types & Maternity Leave

**EPIC-11, FEATURE 2-3: Special Leave + Maternity**

**Special Leave Configuration:**
```typescript
// lib/leave/special-leave-types.ts

export const SPECIAL_LEAVE_TYPES = {
  marriage_employee: { days: 4, paid: true, label: 'Mariage de l\'employé' },
  marriage_child: { days: 2, paid: true, label: 'Mariage de l\'enfant' },
  birth: { days: 3, paid: true, label: 'Naissance' },
  death_spouse_child: { days: 5, paid: true, label: 'Décès conjoint/enfant' },
  death_parent: { days: 3, paid: true, label: 'Décès parent' },
  death_sibling: { days: 2, paid: true, label: 'Décès frère/sœur' },
  moving: { days: 2, paid: true, label: 'Déménagement' },
};

export async function createSpecialLeaveRequest(
  employeeId: string,
  leaveType: keyof typeof SPECIAL_LEAVE_TYPES,
  startDate: Date,
  reason: string
): Promise<LeaveRequest> {
  const config = SPECIAL_LEAVE_TYPES[leaveType];
  const endDate = addDays(startDate, config.days - 1);

  // Auto-approve special leave (no manager approval needed per Convention Collective)
  const request = await db.insert(leaveRequests).values({
    id: crypto.randomUUID(),
    employee_id: employeeId,
    leave_category: leaveType,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    days_count: config.days,
    reason,
    status: 'approved', // Auto-approved
    approved_at: new Date().toISOString(),
  }).returning();

  return request[0];
}
```

**Maternity Leave:**
```typescript
// features/leave/services/maternity-leave.ts

export async function createMaternityLeave(
  employeeId: string,
  expectedDueDate: Date,
  hasTwins: boolean = false
): Promise<MaternityLeaveResult> {
  const STANDARD_WEEKS = 14; // 8 pre-birth + 6 post-birth
  const EXTENSION_WEEKS = hasTwins ? 2 : 0; // +2 weeks for twins/complications

  const totalWeeks = STANDARD_WEEKS + EXTENSION_WEEKS;
  const startDate = subWeeks(expectedDueDate, 8); // 8 weeks before
  const endDate = addWeeks(expectedDueDate, 6 + EXTENSION_WEEKS);

  // Create maternity leave request
  const request = await db.insert(leaveRequests).values({
    id: crypto.randomUUID(),
    employee_id: employeeId,
    leave_category: 'maternity',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    days_count: totalWeeks * 7,
    reason: hasTwins ? 'Congé de maternité (jumeaux)' : 'Congé de maternité',
    status: 'approved',
  }).returning();

  // Track CNPS reimbursement (100% salary paid by CNPS)
  await db.insert(cnpsReimbursements).values({
    id: crypto.randomUUID(),
    employee_id: employeeId,
    leave_request_id: request[0].id,
    amount_per_month: employee.base_salary,
    total_months: totalWeeks / 4.33,
    status: 'pending',
  });

  return {
    request: request[0],
    startDate,
    endDate,
    totalWeeks,
    reimbursementTracking: true,
  };
}
```

**Deliverables:**
- ✅ Special leave types (marriage, birth, death, moving)
- ✅ Auto-approval for special leave
- ✅ Maternity leave (14-16 weeks)
- ✅ CNPS reimbursement tracking
- ✅ Job protection during maternity

---

### Week 12: Smart Defaults Integration

**EPIC-12, FEATURE 4: Smart Defaults**

**Hire Wizard Integration:**
```typescript
// app/employees/hire/components/SalaryStep.tsx

const { data: sectorConfig } = trpc.sectors.getSectorDetails.useQuery({
  countryCode: tenant?.country_code || 'CI',
  sectorCode: tenant?.sector_code || 'SERVICES',
});

const defaults = sectorConfig?.smart_defaults;

const form = useForm({
  defaultValues: {
    baseSalary: defaults?.baseSalary || 150000,
    housingAllowance: defaults?.housingAllowance || 30000,
    transportAllowance: defaults?.transportAllowance || 25000,
  },
});
```

**Deliverables:**
- ✅ Pre-filled salary fields with sector defaults
- ✅ Description shows "Recommandé pour secteur X"
- ✅ User can override defaults

---

## 📊 Success Metrics & Compliance Tracking

### P0 Compliance Requirements (Must Have)

| Requirement | EPIC | Status | Deadline |
|-------------|------|--------|----------|
| Tenant sector assignment | EPIC-12 | ✅ Week 1 | Critical |
| Employee coefficient system | EPIC-06 | ✅ Week 2 | Critical |
| Notice period calculation | EPIC-10 | ✅ Week 3 | Critical |
| Severance calculation | EPIC-10 | ✅ Week 4 | Critical |
| Work certificate (48h) | EPIC-10 | ✅ Week 5 | Critical |
| Final payslip integration | EPIC-10 | ✅ Week 5 | Critical |
| Required components enforcement | EPIC-12 | ✅ Week 3-5 | Critical |
| Sector-specific payroll rates | EPIC-12 | ✅ Week 6 | Critical |
| Overtime calculation | EPIC-07 | ✅ Week 7-8 | Critical |

### P1 Compliance Requirements (Important)

| Requirement | EPIC | Status | Timeline |
|-------------|------|--------|----------|
| Age-based leave accrual | EPIC-11 | ⏳ Week 9-10 | High |
| Seniority leave bonus | EPIC-11 | ⏳ Week 9-10 | High |
| Special leave types | EPIC-11 | ⏳ Week 11 | High |
| Maternity leave | EPIC-11 | ⏳ Week 11 | High |
| Smart defaults | EPIC-12 | ⏳ Week 12 | Medium |

### Compliance Audit Checklist

```typescript
// lib/compliance/audit.ts

export async function runComplianceAudit(tenantId: string): Promise<AuditReport> {
  return {
    tenant: {
      hasSector: await checkTenantHasSector(tenantId),
      requiredComponentsActivated: await checkRequiredComponents(tenantId),
    },
    employees: {
      allHaveCoefficients: await checkAllEmployeesHaveCoefficients(tenantId),
      salariesMeetMinimums: await checkSalaryMinimums(tenantId),
    },
    payroll: {
      usesSectorRates: await checkSectorRatesUsed(tenantId),
      overtimeCompliant: await checkOvertimeCompliance(tenantId),
    },
    terminations: {
      certificatesOnTime: await checkCertificateDeadlines(tenantId),
      severanceCorrect: await checkSeveranceCalculations(tenantId),
    },
    leave: {
      accrualCorrect: await checkLeaveAccrual(tenantId),
      carryoverEnforced: await checkCarryoverLimits(tenantId),
    },
  };
}
```

---

## 📚 Documentation Updates Required

### New Documents to Create

- ✅ `/docs/SECTORS-INDUSTRIES-MANAGEMENT.md` (Created)
- ✅ `/docs/COMPLIANCE-IMPLEMENTATION-PLAN.md` (Created)
- ✅ `/docs/COMPLIANCE-UNIFIED-ROADMAP.md` (This document)
- ⏳ `/docs/10-EPIC-TERMINATION-OFFBOARDING.md` (Create from Week 3-5 content)
- ⏳ `/docs/11-EPIC-LEAVE-MANAGEMENT.md` (Create from Week 9-11 content)
- ⏳ `/docs/12-EPIC-SECTOR-MANAGEMENT.md` (Create from Week 1-2 + Week 6 + Week 12 content)

### Existing Documents to Update

- ⏳ `/docs/05-EPIC-PAYROLL.md` - Add sector integration, smart defaults
- ⏳ `/docs/06-EPIC-EMPLOYEE-MANAGEMENT.md` - Add coefficient system
- ⏳ `/docs/07-EPIC-TIME-AND-ATTENDANCE.md` - Add overtime + leave enhancements
- ⏳ `/docs/EPIC-COMPLIANCE-IMPACT-ANALYSIS.md` - Mark features as implemented, update timeline

---

## 🎯 Next Steps

1. **Review & Approval** (1 day)
   - Review this unified roadmap with stakeholders
   - Confirm priority order (sectors → coefficients → termination → overtime → leave)
   - Get approval to proceed

2. **Create Detailed EPICs** (2 days)
   - EPIC-12: Sector Management (from weeks 1-2, 6, 12)
   - EPIC-10: Termination & Offboarding (from weeks 3-5)
   - EPIC-11: Leave Management (from weeks 9-11)

3. **Update Existing EPICs** (1 day)
   - EPIC-05: Add sector integration
   - EPIC-06: Add coefficient system
   - EPIC-07: Add overtime + enhanced leave

4. **Sprint Planning** (1 day)
   - Break down each sprint into user stories
   - Assign story points
   - Create GitHub issues/tasks

5. **Begin Implementation** (Week 1)
   - Start with EPIC-12 FEATURE 1 (Tenant Sector Assignment)
   - Parallel track: Database migrations + UI mockups

---

## ✅ Summary

**Total Timeline:** 12 weeks (11 weeks implementation + 1 week buffer)

**Implementation Order (Critical Path):**
```
Foundations (Week 1-2)
  → Critical Compliance (Week 3-5)
    → Payroll Compliance (Week 6-8)
      → Enhanced Features (Week 9-12)
```

**After Completion:**
- ✅ 100% Convention Collective compliance
- ✅ Sector-based mandatory components enforced
- ✅ Termination workflows legally compliant
- ✅ Overtime calculated correctly per sector
- ✅ Leave accrual with age/seniority rules
- ✅ Database-driven (ready for multi-country expansion)
- ✅ Audit trail for all compliance features

**Critical Dependencies:**
- `tenant.sector_code` MUST be implemented first (Week 1)
- `employee.coefficient` needed before termination (Week 2)
- All other features build on these foundations

---

**Status:** 📋 Unified roadmap complete, ready for stakeholder review
**Impact:** 12 weeks effort, 3 new EPICs, 3 EPIC enhancements, full compliance achieved
