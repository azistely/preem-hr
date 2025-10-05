# Documentation Update Checklist

**Based on:** DOCUMENTATION-COHERENCE-AUDIT.md
**Priority Order:** P0 (Critical) → P1 (High) → P2 (Medium)
**Total Estimated Effort:** 42-52 hours (1.5-2 weeks, 2 developers)

---

## Phase 1: Critical Corrections (Priority: P0)

**Estimated Effort:** 12-16 hours
**Must Complete Before:** Any payroll implementation work

### Task 1.1: Update ITS Tax Brackets Across All Documents

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Fix ITS bracket table (lines 279-289)
    - Current: 8 brackets (0-60%)
    - New: 6 brackets (0-32%)
    ```
    0 - 75,000: 0%
    75,000 - 240,000: 16%
    240,000 - 800,000: 21%
    800,000 - 2,400,000: 24%
    2,400,000 - 8,000,000: 28%
    8,000,000+: 32%
    ```
  - [ ] Remove annualization step (lines 292-295)
  - [ ] Update `calculateITS()` implementation code (lines 334-365)
  - [ ] Fix test cases (lines 299-327) with monthly calculation
  - Estimated effort: **2 hours**

- [ ] **payroll-cote-d-ivoire.md**
  - [ ] Replace barème table (lines 80-89)
  - [ ] Update Section 4.2 with monthly calculation approach
  - [ ] Fix Example 7.1 calculation (lines 154-157)
  - Estimated effort: **2 hours**

- [ ] **PAYROLL-CALCULATION-GUIDE.md**
  - [ ] Update ITS section (lines 82-92)
  - [ ] Fix calculation example (lines 283-297)
  - [ ] Update formula documentation
  - Estimated effort: **1.5 hours**

- [ ] **01-CONSTRAINTS-AND-RULES.md**
  - [ ] Replace `ITS_BRACKETS` constant (lines 373-382)
  - [ ] Update validation rules
  - [ ] Fix comments and references
  - Estimated effort: **0.5 hours**

**Subtotal: 6 hours**

---

### Task 1.2: Add Family Deductions (Parts Fiscales) System

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Add new Feature 4.5: Family Deductions
  - [ ] Document parts fiscales table:
    ```
    1.0 parts (célibataire): 0 FCFA
    1.5 parts (marié sans enfant): 5,500 FCFA
    2.0 parts (marié + 1 enfant): 11,000 FCFA
    2.5 parts (marié + 2 enfants): 16,500 FCFA
    3.0 parts (marié + 3 enfants): 22,000 FCFA
    3.5 parts (marié + 4 enfants): 27,500 FCFA
    4.0 parts (marié + 5 enfants): 33,000 FCFA
    4.5 parts (marié + 6 enfants): 38,500 FCFA
    5.0 parts (marié + 7+ enfants): 44,000 FCFA
    ```
  - [ ] Add calculation logic before ITS
  - [ ] Update Story 4.1 to include family deduction step
  - [ ] Add test cases for all parts levels
  - Estimated effort: **2 hours**

- [ ] **01-CONSTRAINTS-AND-RULES.md**
  - [ ] Add `FAMILY_DEDUCTIONS` constant object (after line 382)
  - [ ] Document eligibility rules
  - Estimated effort: **1 hour**

- [ ] **payroll-cote-d-ivoire.md**
  - [ ] Add Section 4.4: "Déductions pour charges de famille"
  - [ ] Insert before ITS calculation in workflow
  - Estimated effort: **1 hour**

**Subtotal: 4 hours**

---

### Task 1.3: Add FDFP Training Taxes

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Add new Feature 2.3: FDFP Employer Contributions
  - [ ] Document TAP (0.4% apprenticeship tax)
  - [ ] Document TFPC (1.2% professional training tax)
  - [ ] Add calculation on "Brut Imposable" base
  - [ ] Create test cases
  - Estimated effort: **1.5 hours**

- [ ] **01-CONSTRAINTS-AND-RULES.md**
  - [ ] Add FDFP constants section (after CNPS):
    ```typescript
    FDFP: {
      TAP_RATE: 0.004,
      TFPC_RATE: 0.012,
      TOTAL_RATE: 0.016,
      CALCULATION_BASE: 'brut_imposable',
    }
    ```
  - Estimated effort: **0.5 hours**

- [ ] **PAYROLL-CALCULATION-GUIDE.md**
  - [ ] Add Section 2.5: FDFP Contributions
  - [ ] Document calculation with examples
  - Estimated effort: **1 hour**

- [ ] **payroll-cote-d-ivoire.md**
  - [ ] Add FDFP to Section 3 (after CNPS)
  - [ ] Update Example 7.1 to include FDFP
  - Estimated effort: **1 hour**

**Subtotal: 4 hours**

---

### Task 1.4: Fix CNPS Family Allowance Rate

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Change line 163: `5.75%` → `5.0%`
  - [ ] Update comment to clarify: "5.0% (includes 0.75% maternity)"
  - [ ] Update test cases (line 180-181)
  - Estimated effort: **0.5 hours**

- [ ] **payroll-cote-d-ivoire.md**
  - [ ] Verify line 54 shows 5.0% (already correct)
  - [ ] Add clarification note
  - Estimated effort: **0.25 hours**

- [ ] **01-CONSTRAINTS-AND-RULES.md**
  - [ ] Verify line 358 (should already be 0.05)
  - [ ] Add comment about maternity inclusion
  - Estimated effort: **0.25 hours**

**Subtotal: 1 hour**

---

### Task 1.5: Add Rounding Rules

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Add to Story 6.1 acceptance criteria:
    "Round net salary to nearest 10 FCFA"
  - [ ] Update implementation examples
  - Estimated effort: **0.5 hours**

- [ ] **PAYROLL-CALCULATION-GUIDE.md**
  - [ ] Add rounding section in calculation flow
  - [ ] Show example: 219,285 → 219,280
  - Estimated effort: **0.5 hours**

**Subtotal: 1 hour**

---

## Phase 2: Database Schema (Priority: P1)

**Estimated Effort:** 10-12 hours
**Dependencies:** Phase 1 documentation updates

### Task 2.1: Add Employee Family Fields

- [ ] **03-DATABASE-SCHEMA.md**
  - [ ] Add to `employees` table (after line 149):
    ```sql
    fiscal_parts DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    has_spouse BOOLEAN NOT NULL DEFAULT FALSE,
    dependent_children INTEGER NOT NULL DEFAULT 0,
    cmu_family_coverage BOOLEAN NOT NULL DEFAULT FALSE,
    ```
  - [ ] Add validation constraint: `fiscal_parts BETWEEN 1.0 AND 5.0`
  - [ ] Add index: `CREATE INDEX idx_employees_fiscal ON employees(fiscal_parts);`
  - [ ] Document field meanings
  - Estimated effort: **1 hour**

- [ ] Create migration file
  - [ ] `migrations/YYYY_MM_DD_add_employee_family_fields.sql`
  - [ ] Write UP migration
  - [ ] Write DOWN migration
  - [ ] Test on dev database
  - Estimated effort: **1 hour**

- [ ] **10-API-CONTRACTS.md**
  - [ ] Add fields to employee create input (line 136)
  - [ ] Add fields to employee update input (line 155)
  - [ ] Document validation rules
  - Estimated effort: **1 hour**

**Subtotal: 3 hours**

---

### Task 2.2: Add Tenant Country/Sector Configuration

- [ ] **03-DATABASE-SCHEMA.md**
  - [ ] Add to `tenants` table (after line 38):
    ```sql
    country_code VARCHAR(2) NOT NULL DEFAULT 'CI',
    sector_code VARCHAR(50),
    ```
  - [ ] Add foreign key to `countries` table (when created)
  - Estimated effort: **0.5 hours**

- [ ] Create migration
  - [ ] `migrations/YYYY_MM_DD_add_tenant_country_sector.sql`
  - Estimated effort: **0.5 hours**

**Subtotal: 1 hour**

---

### Task 2.3: Add FDFP Fields to Payroll Line Items

- [ ] **03-DATABASE-SCHEMA.md**
  - [ ] Add to `payroll_line_items` table (after line 421):
    ```sql
    fdfp_tap NUMERIC(15,2) DEFAULT 0,
    fdfp_tfpc NUMERIC(15,2) DEFAULT 0,
    ```
  - Estimated effort: **0.5 hours**

- [ ] Create migration
  - [ ] `migrations/YYYY_MM_DD_add_fdfp_fields.sql`
  - Estimated effort: **0.5 hours**

**Subtotal: 1 hour**

---

### Task 2.4: Multi-Country Configuration Tables

**Reference:** `multi-country-payroll-architecture.md` Section 2

- [ ] **03-DATABASE-SCHEMA.md**
  - [ ] Add Section: "Multi-Country Configuration Tables"
  - [ ] Add table: `countries`
    ```sql
    id UUID PRIMARY KEY,
    code VARCHAR(2) UNIQUE,
    name TEXT,
    currency_code VARCHAR(3),
    is_active BOOLEAN DEFAULT TRUE
    ```
  - [ ] Add table: `tax_systems`
  - [ ] Add table: `tax_brackets`
  - [ ] Add table: `family_deduction_rules`
  - [ ] Add table: `social_security_schemes`
  - [ ] Add table: `contribution_types`
  - [ ] Add table: `sector_contribution_overrides`
  - [ ] Add table: `other_taxes`
  - [ ] Add table: `salary_component_definitions`
  - [ ] Document all relationships
  - Estimated effort: **4 hours**

- [ ] Create migration files
  - [ ] Split into manageable chunks (2-3 migrations)
  - [ ] Write seeding data for Côte d'Ivoire
  - Estimated effort: **3 hours**

- [ ] Seed Côte d'Ivoire configuration
  - [ ] Migrate current hardcoded rules to database
  - [ ] Validate against research findings
  - Estimated effort: **1 hour**

**Subtotal: 8 hours**

---

## Phase 3: Architecture & Documentation (Priority: P1)

**Estimated Effort:** 8-10 hours

### Task 3.1: Add Multi-Country Architecture Documentation

- [ ] **02-ARCHITECTURE-OVERVIEW.md**
  - [ ] Add Section 2.5: "Multi-Country Payroll Architecture"
  - [ ] Document strategy pattern for calculations
  - [ ] Show configuration-driven vs hardcoded approach
  - [ ] Add diagram of calculation flow
  - [ ] Document adding new countries process
  - Estimated effort: **3 hours**

- [ ] **Copy and integrate** `multi-country-payroll-architecture.md`
  - [ ] Review and ensure consistency
  - [ ] Cross-reference with other docs
  - Estimated effort: **1 hour**

**Subtotal: 4 hours**

---

### Task 3.2: Add Calculation Base Glossary

- [ ] **02-ARCHITECTURE-OVERVIEW.md** or new **GLOSSARY.md**
  - [ ] Define "Brut Imposable" (Taxable Gross)
    - Used for: ITS, CNPS pension, FDFP
    - Calculation: Base salary + taxable allowances + overtime + bonuses
  - [ ] Define "Salaire Catégoriel" (Categorical Salary)
    - Used for: CNPS family, work accident, maternity
    - Ceiling: 70,000 FCFA
  - [ ] Define "Total Brut" (Total Gross)
    - Calculation: All components including non-taxable
  - [ ] Add examples for each
  - Estimated effort: **2 hours**

- [ ] **PAYROLL-CALCULATION-GUIDE.md**
  - [ ] Add Section 1.5: "Salary Calculation Bases"
  - [ ] Reference glossary
  - [ ] Update all calculations to use correct base
  - Estimated effort: **1 hour**

**Subtotal: 3 hours**

---

### Task 3.3: Update Source of Truth References

- [ ] **00-README-FIRST.md**
  - [ ] Update table (lines 102-109)
  - [ ] Add row: `Payroll Research | payroll-research-findings.md | Tax rates, regulations`
  - [ ] Add row: `Multi-Country | multi-country-payroll-architecture.md | Expansion strategy`
  - Estimated effort: **0.5 hours**

- [ ] **05-EPIC-PAYROLL.md**
  - [ ] Update "Source Documents" section (lines 9-17)
  - [ ] Add `payroll-research-findings.md` as primary source
  - [ ] Mark `payroll-cote-d-ivoire.md` as "to be deprecated"
  - Estimated effort: **0.5 hours**

**Subtotal: 1 hour**

---

## Phase 4: Testing & Validation (Priority: P2)

**Estimated Effort:** 12-14 hours

### Task 4.1: Recalculate All Official Examples

- [ ] **Example 7.1: 300,000 FCFA Gross Salary**
  - [ ] Recalculate with:
    - Monthly ITS brackets (6 brackets)
    - Family deduction (assume 2.0 parts = 11,000 FCFA)
    - FDFP taxes (TAP + TFPC)
    - Rounding to nearest 10 FCFA
  - [ ] Update in:
    - [ ] `payroll-cote-d-ivoire.md` (lines 148-161)
    - [ ] `05-EPIC-PAYROLL.md` (lines 469-487)
    - [ ] `PAYROLL-CALCULATION-GUIDE.md` (lines 361-378)
  - Estimated effort: **2 hours**

- [ ] **Example 7.2: Overtime Calculation**
  - [ ] Verify hourly rate formula
  - [ ] Recalculate with correct gross
  - [ ] Update in all docs
  - Estimated effort: **1 hour**

- [ ] **Create new examples**
  - [ ] Example: High earner (> 8M FCFA annual)
  - [ ] Example: SMIG salary (75,000 FCFA)
  - [ ] Example: Different parts fiscales levels
  - Estimated effort: **1 hour**

**Subtotal: 4 hours**

---

### Task 4.2: Update Test Suite

- [ ] **ITS Calculation Tests**
  - [ ] File: Create `features/payroll/__tests__/its-calculation.test.ts`
  - [ ] Test each of 6 brackets
  - [ ] Test boundary values
  - [ ] Test with family deductions
  - [ ] Remove annualization tests
  - Estimated effort: **2 hours**

- [ ] **FDFP Tax Tests**
  - [ ] File: Create `features/payroll/__tests__/fdfp-calculation.test.ts`
  - [ ] Test TAP calculation (0.4%)
  - [ ] Test TFPC calculation (1.2%)
  - [ ] Test on different salary bases
  - Estimated effort: **1.5 hours**

- [ ] **Family Deduction Tests**
  - [ ] File: Create `features/payroll/__tests__/family-deductions.test.ts`
  - [ ] Test all 9 parts fiscales levels
  - [ ] Test edge cases (no family, max family)
  - Estimated effort: **1.5 hours**

- [ ] **Integration Tests**
  - [ ] Update `payroll-calculation.test.ts`
  - [ ] Fix Example 7.1 test with new values
  - [ ] Add comprehensive end-to-end scenarios
  - Estimated effort: **2 hours**

**Subtotal: 7 hours**

---

### Task 4.3: Create Validation Scripts

- [ ] **Comparison Script**
  - [ ] File: `scripts/compare-calculations.ts`
  - [ ] Input: Same salary data
  - [ ] Output: Old calculation vs New calculation
  - [ ] Highlight differences
  - Estimated effort: **1.5 hours**

- [ ] **Compliance Check Script**
  - [ ] File: `scripts/verify-compliance.ts`
  - [ ] Validate all constants against official sources
  - [ ] Check bracket boundaries
  - [ ] Verify rates and percentages
  - Estimated effort: **1.5 hours**

**Subtotal: 3 hours**

---

## Summary by Phase

| Phase | Tasks | Estimated Hours | Priority |
|-------|-------|-----------------|----------|
| Phase 1: Critical Corrections | 5 tasks | 12-16 hours | P0 |
| Phase 2: Database Schema | 4 tasks | 10-12 hours | P1 |
| Phase 3: Architecture & Docs | 3 tasks | 8-10 hours | P1 |
| Phase 4: Testing & Validation | 3 tasks | 12-14 hours | P2 |
| **TOTAL** | **15 tasks** | **42-52 hours** | - |

---

## Execution Timeline (2 Weeks, 2 Developers)

### Week 1: Critical Fixes

**Developer 1:**
- Days 1-2: Task 1.1 (ITS brackets) + Task 1.2 (Family deductions)
- Days 3-4: Task 1.3 (FDFP) + Task 1.4 (CNPS fix) + Task 1.5 (Rounding)
- Day 5: Task 4.1 (Recalculate examples)

**Developer 2:**
- Days 1-2: Task 2.1 (Employee fields schema) + Task 2.2 (Tenant config)
- Days 3-4: Task 2.3 (FDFP fields) + Start Task 2.4 (Multi-country tables)
- Day 5: Continue Task 2.4

### Week 2: Architecture & Testing

**Developer 1:**
- Days 6-7: Task 3.1 (Multi-country architecture doc) + Task 3.2 (Glossary)
- Days 8-10: Task 4.2 (Test suite updates)

**Developer 2:**
- Days 6-7: Finish Task 2.4 (Multi-country tables + migrations)
- Days 8-9: Task 4.3 (Validation scripts)
- Day 10: Final review, regression testing

---

## Review Checkpoints

### End of Week 1 (After Phase 1)
- [ ] All critical documentation updated
- [ ] Peer review of calculation changes
- [ ] Stakeholder approval of new formulas
- [ ] Database migrations tested on staging

### End of Week 2 (After All Phases)
- [ ] All tests passing
- [ ] Validation scripts show no errors
- [ ] Multi-country architecture documented
- [ ] Final documentation review

---

## Success Criteria

- [ ] All 47 critical issues resolved
- [ ] ITS calculation uses 6 monthly brackets (0-32%)
- [ ] Family deductions implemented (9 parts levels)
- [ ] FDFP taxes documented and calculated (1.6%)
- [ ] CNPS family rate corrected (5.0%)
- [ ] Rounding to nearest 10 FCFA applied
- [ ] Database schema supports multi-country
- [ ] All official examples recalculated correctly
- [ ] Test suite updated and passing
- [ ] Validation scripts confirm compliance

---

## Risk Mitigation

### If Behind Schedule
**Priority drops:**
1. Keep: Phase 1 (critical corrections) - MUST complete
2. Keep: Task 2.1 (employee family fields) - Blocks implementation
3. Defer: Task 2.4 (multi-country tables) - Can be done later
4. Defer: Phase 4 (some testing) - Critical tests only

### If Discovering More Issues
- Document in `DOCUMENTATION-COHERENCE-AUDIT.md`
- Assess criticality (P0/P1/P2)
- Adjust timeline or defer to Phase 2

---

**Checklist Status:** 🔴 Not Started
**Last Updated:** October 5, 2025
**Next Update:** After Week 1 completion
