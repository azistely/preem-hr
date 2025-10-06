# EPIC Compliance Impact Analysis
**Convention Collective Requirements vs Current EPIC Coverage**

**Date:** 2025-10-06
**Status:** 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Executive Summary

The Convention Collective Interprofessionnelle (CI, SN, BF, ML, BJ, TG, GN) establishes **mandatory labor law requirements** that span multiple EPICs and reveal **2 missing EPICs** entirely.

**Findings:**
- ✅ 3 EPICs partially cover requirements (need updates)
- ⚠️ 2 EPICs exist but missing critical stories
- ❌ 2 NEW EPICs needed for compliance
- 🔥 P0 features missing from current roadmap

---

## Convention Collective Requirements Mapped to EPICs

### ✅ Requirements COVERED by Existing EPICs

| Requirement | Article | Current EPIC | Status |
|-------------|---------|--------------|--------|
| Seniority bonus (2-12%) | Article 16 | EPIC-05 (Payroll) | ✅ Implemented |
| SMIG validation | Article 11 | EPIC-05 (Payroll) | ✅ Implemented |
| Family allowances | Article 19 | EPIC-05 (Payroll) | ✅ Implemented |
| Benefits in kind | Article 20 | EPIC-05 (Payroll) | ✅ Implemented |
| Tax/CNPS calculation | Multiple | EPIC-05 (Payroll) | ✅ Implemented |
| Paid annual leave | Article 28 | EPIC-07 (Time & Attendance) | ⚠️ Partial |
| Leave accrual | Article 28 | EPIC-07 (Time & Attendance) | ⚠️ Partial |

### ⚠️ Requirements PARTIALLY COVERED (Need Updates)

| Requirement | Article | Current EPIC | What's Missing |
|-------------|---------|--------------|----------------|
| **Employee classification** | Article 6 | EPIC-06 (Employee Mgmt) | Coefficient tracking & validation |
| **Overtime calculation** | Article 23 | EPIC-07 (Time & Attendance) | Weekday/Saturday/Sunday/holiday rates |
| **Special leave types** | Article 28 | EPIC-07 (Time & Attendance) | Marriage, birth, death leave |
| **Age-based leave** | Article 28 | EPIC-07 (Time & Attendance) | Under-21 gets 30 days vs 24 |
| **Seniority leave bonus** | Article 28 | EPIC-07 (Time & Attendance) | +2/4/6 days at 15/20/25 years |
| **Position allowances** | Article 18 | EPIC-06 (Employee Mgmt) | Pre-configured templates |

### ❌ Requirements NOT COVERED (Critical Gaps)

| Requirement | Article | Audit Risk | Missing EPIC |
|-------------|---------|------------|--------------|
| **Notice period calculation** | Article 35 | 🔴 CRITICAL | NEW: EPIC-10 (Termination & Offboarding) |
| **Severance calculation** | Article 37 | 🔴 CRITICAL | NEW: EPIC-10 (Termination & Offboarding) |
| **Work certificate generation** | Article 40 | 🔴 CRITICAL | NEW: EPIC-10 (Termination & Offboarding) |
| **Final payslip** | Article 40 | 🔴 CRITICAL | NEW: EPIC-10 (Termination & Offboarding) |
| **CNPS attestation** | Article 40 | 🔴 CRITICAL | NEW: EPIC-10 (Termination & Offboarding) |
| **Maternity leave** | Article 30 | 🟡 MEDIUM | NEW: EPIC-11 (Leave Management) |
| **Nursing breaks** | Article 30 | 🟡 LOW | NEW: EPIC-11 (Leave Management) |

---

## Required EPIC Updates

### EPIC-05: Payroll ✅ MOSTLY COMPLIANT

**Current Status:** 65% compliant with Convention Collective

**What's Working:**
- ✅ SMIG validation (Article 11)
- ✅ Seniority bonus (Article 16)
- ✅ Family allowances (Article 19)
- ✅ Benefits in kind (Article 20)
- ✅ Tax/CNPS calculation

**What Needs Adding:**
1. **FEATURE 9: Employee Coefficient Validation**
   - Story 9.1: Validate salary >= (SMIG × coefficient)
   - Story 9.2: Enforce category-based minimums (A1-F)
   - **Effort:** 3 days
   - **Priority:** P1

2. **FEATURE 10: Position-Based Allowance Templates**
   - Story 10.1: Cashier allowance (10-15%)
   - Story 10.2: Hazard pay (15-25%)
   - Story 10.3: Representation allowance (20-40%, partially tax-exempt)
   - **Effort:** 1 week (part of Phase 4-Alternative: Smart Templates)
   - **Priority:** P1

3. **Update Multi-Country Section:**
   - Add Convention Collective references for all 7 countries
   - Document country-specific coefficient systems
   - Add links to `/docs/COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md`

---

### EPIC-06: Employee Management ⚠️ PARTIAL

**Current Status:** Missing coefficient system entirely

**What Needs Adding:**
1. **FEATURE X: Employee Classification System**
   - Story X.1: Add `coefficient` field to employees table
   - Story X.2: Category-coefficient validation (A1=90, A2=100, B1=120, etc.)
   - Story X.3: Minimum salary validation (SMIG × coefficient)
   - Story X.4: Coefficient progression tracking (merit increases)
   - **Effort:** 1 week
   - **Priority:** P1
   - **Database Migration:**
     ```sql
     ALTER TABLE employees ADD COLUMN coefficient INTEGER DEFAULT 100;
     ALTER TABLE employees ADD CONSTRAINT check_coefficient CHECK (coefficient >= 90);
     ```

2. **Update FEATURE 1 (Employee CRUD):**
   - Add coefficient to create/update flows
   - Validate coefficient matches category
   - Add coefficient display in employee profile

---

### EPIC-07: Time & Attendance ⚠️ PARTIAL

**Current Status:** Basic time tracking exists, missing critical compliance features

**What Needs Adding:**
1. **FEATURE X: Overtime Rate Calculation (Convention Collective Compliant)**
   - Story X.1: Weekday overtime 41-48h (+15%)
   - Story X.2: Weekday overtime 48h+ (+50%)
   - Story X.3: Saturday work (+50%)
   - Story X.4: Sunday work (+75%)
   - Story X.5: Public holiday work (+100%)
   - Story X.6: Night work 9pm-5am (+75% additional)
   - **Effort:** 2 weeks
   - **Priority:** P0 (CRITICAL)
   - **Reference:** Article 23 of Convention Collective

2. **FEATURE Y: Enhanced Leave Management**
   - Story Y.1: Age-based accrual (under 21 = 2.5 days/month = 30 days/year)
   - Story Y.2: Seniority leave bonus (15 years = +2 days, 20 years = +4, 25 years = +6)
   - Story Y.3: Special leave types:
     - Marriage (employee): 4 days
     - Marriage (child): 2 days
     - Birth of child: 3 days
     - Death of spouse/child: 5 days
     - Death of parent: 3 days
     - Death of sibling: 2 days
     - Moving house: 2 days
   - Story Y.4: Leave carryover limit (max 6 months)
   - **Effort:** 1 week
   - **Priority:** P1
   - **Reference:** Article 28 of Convention Collective

3. **Update Source Documents:**
   - Add `/docs/COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md`
   - Add multi-country overtime rules (CI, SN, BF, etc. have similar rules)

---

## NEW EPICs Required

### 🆕 EPIC-10: Employee Termination & Offboarding

**Why NEW EPIC?** Termination is a **complete workflow** with legal deadlines, document generation, and financial calculations - too complex to fit in existing EPICs.

**Priority:** 🔥 **P0 (CRITICAL)** - Cannot operate legally without this

**Goal:** Manage employee terminations compliantly with automated notice periods, severance calculations, and mandatory document generation (48-hour deadline).

**Source Documents:**
- `COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md` (Articles 35-40)
- `COMPLIANCE-GAP-ANALYSIS-RCI.md`
- `HCI-DESIGN-PRINCIPLES.md`
- `02-ARCHITECTURE-OVERVIEW.md` (Event-driven patterns)
- `05-EPIC-PAYROLL.md` (Final payslip integration)

**Success Criteria:**
- [ ] Notice period calculated by category (8 days to 3 months)
- [ ] Severance calculated correctly (tiered 30%/35%/40%)
- [ ] Work certificate generated within 48 hours
- [ ] Final payslip with all terminal payments
- [ ] CNPS attestation generated within 15 days
- [ ] Job search time tracked during notice (2 days/week)
- [ ] All documents in French
- [ ] Audit trail for all termination actions

**Features:**

#### FEATURE 1: Termination Wizard
- Story 1.1: Select employee and termination reason
- Story 1.2: Auto-calculate notice period by category
- Story 1.3: Preview all terminal payments
- Story 1.4: Confirm and execute termination
- Story 1.5: Track termination workflow status

#### FEATURE 2: Notice Period Management
- Story 2.1: Calculate notice period (A1-A2: 8 days, B1-B2: 15 days, C: 1 month, D: 2 months, E-F: 3 months)
- Story 2.2: Track job search time (2 days/week for dismissals)
- Story 2.3: Payment in lieu option (categories E-F only)
- Story 2.4: Notice period in payroll

#### FEATURE 3: Severance Calculator
- Story 3.1: Calculate average salary (last 12 months)
- Story 3.2: Tiered calculation:
  - Years 1-5: 30% × monthly avg per year
  - Years 6-10: 35% × monthly avg per year
  - Years 11+: 40% × monthly avg per year
- Story 3.3: Tax treatment (legal minimum = tax-free, excess = taxable)
- Story 3.4: Exemptions (misconduct, resignation, retirement)

#### FEATURE 4: Document Generation
- Story 4.1: Work certificate (Certificat de Travail) - within 48 hours
  - Employee identity
  - Employment period
  - Positions held
  - Categories/coefficients
  - Reason for leaving
  - "Free of all obligations" clause
- Story 4.2: Final payslip - within 8 days
  - Last month's salary
  - Prorated vacation pay
  - Notice period payment
  - Severance pay
  - All outstanding allowances
- Story 4.3: CNPS attestation - within 15 days
  - Total contributions paid
  - Periods covered
  - For benefits claim

#### FEATURE 5: Final Payroll Integration
- Story 5.1: Trigger final payroll calculation
- Story 5.2: Include terminal payments (severance, vacation payout, notice)
- Story 5.3: Generate final payslip
- Story 5.4: Mark employee as terminated (status = 'terminated')

**Database Schema:**
```sql
CREATE TABLE employee_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  termination_date DATE NOT NULL,
  termination_reason TEXT NOT NULL, -- 'dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end'
  notice_period_days INTEGER NOT NULL,
  notice_payment_amount DECIMAL(15,2),
  severance_amount DECIMAL(15,2),
  vacation_payout_amount DECIMAL(15,2),
  average_salary_12m DECIMAL(15,2), -- For severance calculation
  work_certificate_generated_at TIMESTAMPTZ,
  work_certificate_url TEXT,
  final_payslip_generated_at TIMESTAMPTZ,
  final_payslip_url TEXT,
  cnps_attestation_generated_at TIMESTAMPTZ,
  cnps_attestation_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_termination_reason CHECK (termination_reason IN ('dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end'))
);

-- RLS
ALTER TABLE employee_terminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_terminations FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

**Implementation Roadmap:**
- Week 1: Termination wizard + notice period calculator
- Week 2: Severance calculator + validation
- Week 3: Document generation (work certificate, final payslip, CNPS attestation)
- **Total:** 3 weeks

---

### 🆕 EPIC-11: Comprehensive Leave Management

**Why NEW EPIC?** Current EPIC-07 (Time & Attendance) focuses on time tracking (clock in/out). Leave management is a **separate domain** with accrual rules, balance tracking, approval workflows, and compliance.

**Priority:** P1 (Important for compliance, but not blocking MVP)

**Goal:** Comprehensive leave management with Convention Collective compliance (annual leave, maternity leave, special leave types).

**Source Documents:**
- `COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md` (Articles 28, 30)
- `COMPLIANCE-GAP-ANALYSIS-RCI.md`
- `HCI-DESIGN-PRINCIPLES.md`
- `09-EPIC-WORKFLOW-AUTOMATION.md` (Approval workflows)

**Success Criteria:**
- [ ] Annual leave accrual (age-based + seniority-based)
- [ ] Maternity leave (14 weeks, 100% pay, CNPS reimbursement)
- [ ] Special leave types (marriage, birth, death, moving)
- [ ] Leave balance tracking with carryover limits
- [ ] Approval workflow
- [ ] Calendar integration
- [ ] French mobile UI

**Features:**

#### FEATURE 1: Annual Leave Accrual (Convention Collective Compliant)
- Story 1.1: Standard accrual (2 days/month = 24 days/year)
- Story 1.2: Age-based accrual (under 21 = 2.5 days/month = 30 days/year)
- Story 1.3: Seniority bonus:
  - 15 years service: +2 days (26 days total)
  - 20 years service: +4 days (28 days total)
  - 25 years service: +6 days (30 days total)
- Story 1.4: Carryover limit (max 6 months, then forfeit)

#### FEATURE 2: Maternity Leave
- Story 2.1: 14-week duration (8 pre-birth + 6 post-birth)
- Story 2.2: Medical extension (+2 weeks for twins/complications)
- Story 2.3: 100% salary payment
- Story 2.4: CNPS reimbursement tracking
- Story 2.5: Job protection (cannot dismiss during pregnancy/leave)
- Story 2.6: Nursing breaks (1 hour/day for 12 months after return)

#### FEATURE 3: Special Leave Types (Congés Exceptionnels)
- Story 3.1: Marriage (employee): 4 days paid
- Story 3.2: Marriage (child): 2 days paid
- Story 3.3: Birth of child: 3 days paid (paternity leave)
- Story 3.4: Death of spouse/child: 5 days paid
- Story 3.5: Death of parent: 3 days paid
- Story 3.6: Death of sibling: 2 days paid
- Story 3.7: Moving house: 2 days paid

#### FEATURE 4: Leave Balance Management
- Story 4.1: Real-time balance calculation
- Story 4.2: Accrual tracking by period (June 1 - May 31)
- Story 4.3: Carryover enforcement (max 6 months)
- Story 4.4: Leave payout on termination (unused balance)

#### FEATURE 5: Leave Request & Approval Workflow
- Story 5.1: Employee submits leave request
- Story 5.2: Manager approval workflow
- Story 5.3: Calendar integration (block unavailable dates)
- Story 5.4: Email notifications
- Story 5.5: Mobile-friendly request form

**Database Schema:**
```sql
-- Enhance existing leave types
CREATE TYPE leave_category AS ENUM (
  'annual',           -- Congés payés annuels
  'maternity',        -- Congé de maternité (14 weeks)
  'marriage_employee',-- Mariage de l'employé (4 days)
  'marriage_child',   -- Mariage de l'enfant (2 days)
  'birth',            -- Naissance (3 days)
  'death_spouse_child', -- Décès conjoint/enfant (5 days)
  'death_parent',     -- Décès parent (3 days)
  'death_sibling',    -- Décès frère/sœur (2 days)
  'moving',           -- Déménagement (2 days)
  'sick',             -- Congé maladie
  'unpaid'            -- Congé sans solde
);

CREATE TABLE leave_accrual_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country_code TEXT NOT NULL REFERENCES countries(code),
  age_threshold INTEGER, -- NULL = applies to all ages, 21 = under 21
  seniority_years INTEGER, -- NULL = standard, 15/20/25 = seniority thresholds
  days_per_month DECIMAL(3,1) NOT NULL, -- 2.0, 2.5
  bonus_days INTEGER DEFAULT 0, -- 0, 2, 4, 6
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed CI rules
INSERT INTO leave_accrual_rules (tenant_id, country_code, age_threshold, seniority_years, days_per_month, bonus_days, effective_from) VALUES
(NULL, 'CI', NULL, NULL, 2.0, 0, '1977-01-01'), -- Standard: 24 days/year
(NULL, 'CI', 21, NULL, 2.5, 0, '1977-01-01'),   -- Under 21: 30 days/year
(NULL, 'CI', NULL, 15, 2.0, 2, '1977-01-01'),   -- 15 years: +2 days
(NULL, 'CI', NULL, 20, 2.0, 4, '1977-01-01'),   -- 20 years: +4 days
(NULL, 'CI', NULL, 25, 2.0, 6, '1977-01-01');   -- 25 years: +6 days
```

**Implementation Roadmap:**
- Week 1: Annual leave accrual (age + seniority)
- Week 2: Special leave types
- Week 3: Maternity leave
- Week 4: Leave balance management + carryover
- **Total:** 4 weeks

---

## Recommended EPIC Numbering

Since you're currently building EPIC-06 (Payroll), I recommend:

**Current EPICs (Keep as-is):**
- EPIC-05: Payroll ✅
- EPIC-06: Employee Management ✅
- EPIC-07: Time & Attendance ✅
- EPIC-08: Onboarding Workflow ✅
- EPIC-09: Workflow Automation ✅

**NEW EPICs (Add):**
- **EPIC-10: Employee Termination & Offboarding** 🆕 (P0 - CRITICAL)
- **EPIC-11: Comprehensive Leave Management** 🆕 (P1 - Important)

---

## Implementation Priority (Compliance-Driven)

### Phase 1: P0 Features (Must have before production)
**Timeline: 4 weeks**

1. **EPIC-10: Termination & Offboarding** (3 weeks)
   - Severance calculator
   - Work certificate generator
   - Final payslip integration
   - Notice period calculation

2. **EPIC-07 Enhancement: Overtime** (2 weeks, parallel with EPIC-10)
   - Weekday/Saturday/Sunday/holiday rates
   - Integration with payroll

### Phase 2: P1 Features (Next sprint)
**Timeline: 6 weeks**

1. **EPIC-06 Enhancement: Coefficients** (1 week)
   - Add coefficient field
   - Validate category minimums

2. **EPIC-07 Enhancement: Enhanced Leave** (1 week)
   - Age-based accrual
   - Seniority leave bonus
   - Special leave types

3. **EPIC-11: Leave Management** (4 weeks)
   - Annual leave accrual
   - Maternity leave
   - Special leave
   - Leave balance management

### Phase 3: P2 Features (After P0/P1)
**Timeline: 3 weeks**

1. **EPIC-05 Enhancement: Position Allowances** (1 week)
   - Part of Phase 4-Alternative (Smart Templates)
   - Cashier allowance, hazard pay, representation allowance

2. **EPIC-07 Enhancement: Advanced Overtime** (2 weeks)
   - Compensatory time-off
   - Overtime caps and warnings

---

## Multi-Country Implications

**Key Insight:** ALL West African countries (CI, SN, BF, ML, BJ, TG, GN) have similar Convention Collectives with:

- ✅ Employee classification systems (categories/coefficients)
- ✅ Overtime rates (slightly different percentages)
- ✅ Leave entitlements (24-30 days standard)
- ✅ Termination procedures (notice + severance)
- ✅ Special leave types (marriage, birth, death)

**Implementation Strategy:**
1. Build features based on CI Convention Collective (most comprehensive)
2. Make all rules **database-configurable** (overtime rates, leave days, etc.)
3. Add other countries by seeding database with their specific rules
4. **NO code changes** needed for new countries

**Database-Driven Configuration:**
```sql
-- Overtime rates table (multi-country)
CREATE TABLE overtime_rates (
  id UUID PRIMARY KEY,
  country_code TEXT NOT NULL,
  period_type TEXT NOT NULL, -- 'weekday_41_48', 'weekday_48_plus', 'saturday', 'sunday', 'holiday', 'night'
  rate_multiplier DECIMAL(3,2) NOT NULL, -- 1.15, 1.50, 1.75, 2.00
  effective_from DATE NOT NULL,
  effective_to DATE
);

-- CI overtime rates
INSERT INTO overtime_rates VALUES
('CI', 'weekday_41_48', 1.15, '1977-01-01', NULL),
('CI', 'weekday_48_plus', 1.50, '1977-01-01', NULL),
('CI', 'saturday', 1.50, '1977-01-01', NULL),
('CI', 'sunday', 1.75, '1977-01-01', NULL),
('CI', 'holiday', 2.00, '1977-01-01', NULL),
('CI', 'night', 1.75, '1977-01-01', NULL);

-- SN overtime rates (slightly different)
INSERT INTO overtime_rates VALUES
('SN', 'weekday_41_48', 1.12, '1980-01-01', NULL), -- Different rate
('SN', 'weekday_48_plus', 1.50, '1980-01-01', NULL),
('SN', 'saturday', 1.50, '1980-01-01', NULL),
('SN', 'sunday', 1.60, '1980-01-01', NULL), -- Different rate
('SN', 'holiday', 2.00, '1980-01-01', NULL),
('SN', 'night', 1.75, '1980-01-01', NULL);
```

---

## Summary of Changes Required

### Documents to Create:
- ✅ `/docs/COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md` (Created)
- ✅ `/docs/COMPLIANCE-GAP-ANALYSIS-RCI.md` (Created)
- ✅ `/docs/EPIC-COMPLIANCE-IMPACT-ANALYSIS.md` (This document)
- ⏳ `/docs/10-EPIC-TERMINATION-OFFBOARDING.md` (NEW)
- ⏳ `/docs/11-EPIC-LEAVE-MANAGEMENT.md` (NEW)

### Documents to Update:
- ⏳ `/docs/05-EPIC-PAYROLL.md` (Add FEATURE 9-10, Convention Collective references)
- ⏳ `/docs/06-EPIC-EMPLOYEE-MANAGEMENT.md` (Add coefficient system)
- ⏳ `/docs/07-EPIC-TIME-AND-ATTENDANCE.md` (Add overtime + enhanced leave)
- ⏳ `/docs/EPIC-UPDATE-SUMMARY.md` (Add compliance update summary)

---

**Next Steps:**
1. Review this analysis with stakeholders
2. Create EPIC-10 and EPIC-11 documents
3. Update existing EPICs with compliance requirements
4. Prioritize P0 features (termination + overtime)
5. Begin implementation

---

**Status:** 📋 Analysis complete, awaiting approval to create new EPICs
**Impact:** 2 new EPICs, 3 existing EPICs updated, 7 weeks additional effort for P0/P1 compliance
