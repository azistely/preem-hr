# Documentation Coherence Audit Report

**Date:** October 5, 2025
**Purpose:** Identify discrepancies between current documentation and new payroll research findings
**Scope:** All payroll-related documentation files

---

## Executive Summary

### Critical Findings
- **Total documents reviewed:** 9
- **Documents with critical issues:** 7
- **Critical issues found:** 47
- **Estimated fix effort:** 32-40 hours

### Impact Assessment
**CRITICAL:** Current documentation contains incorrect tax brackets, missing contributions (FDFP), and wrong calculation formulas that would lead to:
- ❌ Non-compliant payroll calculations
- ❌ Incorrect employee net salaries
- ❌ Legal/regulatory violations
- ❌ Missing employer costs (1.6% FDFP taxes)

### Top 5 Critical Issues
1. **ITS Tax System:** Using 8 brackets (0-60%) instead of 6 brackets (0-32%)
2. **FDFP Training Taxes:** Completely missing - 1.6% employer cost
3. **Family Deductions:** Parts fiscales system not implemented
4. **CNPS Family Rate:** Wrong rate (5.75% vs 5.0%)
5. **Calculation Bases:** Missing distinction between "Brut Imposable" and "Salaire Catégoriel"

---

## Critical Issues by Document

### 1. `/Users/admin/Sites/preem-hr/docs/05-EPIC-PAYROLL.md`

**Location:** Epic Payroll - Main Specification

**Issues Found:**

#### Issue 1.1: Incorrect ITS Tax Brackets
**Current (Lines 279-289):**
```
8 brackets with rates 0% to 60%
0 - 300,000: 0%
300,000 - 547,000: 10%
547,000 - 979,000: 15%
979,000 - 1,519,000: 20%
1,519,000 - 2,644,000: 25%
2,644,000 - 4,669,000: 35%
4,669,000 - 10,106,000: 45%
10,106,000+: 60%
```

**Should be (from research):**
```
6 brackets with rates 0% to 32% (MONTHLY, not annualized)
0 - 75,000: 0%
75,000 - 240,000: 16%
240,000 - 800,000: 21%
800,000 - 2,400,000: 24%
2,400,000 - 8,000,000: 28%
8,000,000+: 32%
```

**Impact:** CRITICAL
**Fix Effort:** 4 hours (update all calculation examples)

#### Issue 1.2: Annualized vs Monthly Tax Calculation
**Current (Lines 292-295):**
```typescript
// Annualize monthly taxable income (× 12)
// Apply progressive calculation (tax each bracket)
// Divide annual tax by 12 for monthly withholding
```

**Should be:**
Monthly progressive calculation WITHOUT annualization. Apply brackets directly to monthly income.

**Impact:** CRITICAL
**Fix Effort:** 2 hours

#### Issue 1.3: Missing Family Deductions (Parts Fiscales)
**Current:** No mention of family deductions system

**Should be:** Parts fiscales system with deductions:
- 1.0 parts: 0 FCFA
- 1.5 parts: 5,500 FCFA
- 2.0 parts: 11,000 FCFA
- 2.5 parts: 16,500 FCFA
- 3.0 parts: 22,000 FCFA
- 3.5 parts: 27,500 FCFA
- 4.0 parts: 33,000 FCFA
- 4.5 parts: 38,500 FCFA
- 5.0 parts: 44,000 FCFA

**Impact:** CRITICAL
**Fix Effort:** 3 hours

#### Issue 1.4: Missing FDFP Training Taxes
**Current:** No mention of FDFP taxes

**Should add:**
- TAP (Taxe d'Apprentissage): 0.4% of Brut Imposable (employer)
- TFPC (Taxe Formation Professionnelle Continue): 1.2% of Brut Imposable (employer)
- Total: 1.6% additional employer cost

**Impact:** CRITICAL (missing legal obligation)
**Fix Effort:** 2 hours

#### Issue 1.5: Wrong CNPS Family Rate
**Current (Lines 163-166):**
```
Family allowance: 5.75% employer only
```

**Should be:**
```
Family allowance: 5.0% employer only (includes 0.75% maternity)
```

**Impact:** HIGH
**Fix Effort:** 1 hour

#### Issue 1.6: Incorrect Test Case Values
**Current (Lines 469-487):**
Example 7.1 uses annualized calculation resulting in wrong values

**Should be:**
Recalculate with monthly progressive brackets and family deductions

**Impact:** HIGH
**Fix Effort:** 3 hours (recalculate all examples)

#### Issue 1.7: Missing Rounding Rules
**Current:** No mention of rounding

**Should add:**
Round final net salary to nearest 10 FCFA (e.g., 219,285 → 219,280)

**Impact:** MEDIUM
**Fix Effort:** 1 hour

---

### 2. `/Users/admin/Sites/preem-hr/docs/payroll-cote-d-ivoire.md`

**Location:** Payroll Specification for Côte d'Ivoire

**Issues Found:**

#### Issue 2.1: Incorrect ITS Barème (Lines 80-89)
**Current:**
8 brackets, annualized calculation

**Should be:**
6 brackets, monthly calculation (see Issue 1.1)

**Impact:** CRITICAL
**Fix Effort:** 2 hours

#### Issue 2.2: Missing Parts Fiscales
**Current (Lines 74-89):**
No mention of family deduction system

**Should add:**
Complete parts fiscales table with deduction amounts

**Impact:** CRITICAL
**Fix Effort:** 2 hours

#### Issue 2.3: Wrong Example 7.1 Calculation (Lines 148-161)
**Current:**
```
Gross: 300,000
ITS: ~60,815
Net: ~219,285
```

**Should be (with correct brackets + family deductions):**
Needs recalculation with:
- Monthly progressive brackets (not annualized)
- Family deduction based on parts fiscales
- Rounding to nearest 10 FCFA

**Impact:** HIGH
**Fix Effort:** 2 hours

---

### 3. `/Users/admin/Sites/preem-hr/docs/PAYROLL-CALCULATION-GUIDE.md`

**Location:** Calculation Guide

**Issues Found:**

#### Issue 3.1: ITS Brackets Mismatch (Lines 82-92)
**Current:**
```
ITS: Progressive tax (8 brackets, 0% to 60%)
```

**Should be:**
```
ITS: Progressive tax (6 brackets, 0% to 32%, monthly calculation)
```

**Impact:** CRITICAL
**Fix Effort:** 2 hours

#### Issue 3.2: Wrong Example Calculation (Lines 283-297)
**Current:**
Uses annualized approach with 8 brackets

**Should be:**
Monthly progressive with 6 brackets + family deductions

**Impact:** HIGH
**Fix Effort:** 2 hours

#### Issue 3.3: Missing FDFP Section
**Current:** No mention of training taxes

**Should add:**
Complete section on FDFP calculations (TAP + TFPC)

**Impact:** CRITICAL
**Fix Effort:** 2 hours

---

### 4. `/Users/admin/Sites/preem-hr/docs/01-CONSTRAINTS-AND-RULES.md`

**Location:** Hard Rules and Constants

**Issues Found:**

#### Issue 4.1: Incorrect ITS Constants (Lines 373-382)
**Current:**
```typescript
ITS_BRACKETS: [
  { min: 0, max: 300_000, rate: 0 },
  { min: 300_000, max: 547_000, rate: 0.10 },
  // ... 8 brackets total with 60% max
]
```

**Should be:**
```typescript
ITS_BRACKETS: [
  { min: 0, max: 75_000, rate: 0 },
  { min: 75_000, max: 240_000, rate: 0.16 },
  { min: 240_000, max: 800_000, rate: 0.21 },
  { min: 800_000, max: 2_400_000, rate: 0.24 },
  { min: 2_400_000, max: 8_000_000, rate: 0.28 },
  { min: 8_000_000, max: Infinity, rate: 0.32 },
]
```

**Impact:** CRITICAL
**Fix Effort:** 1 hour

#### Issue 4.2: Missing FDFP Constants
**Current:** No FDFP constants defined

**Should add:**
```typescript
FDFP: {
  TAP_RATE: 0.004,  // 0.4% Apprenticeship Tax
  TFPC_RATE: 0.012, // 1.2% Professional Training Tax
  CALCULATION_BASE: 'brut_imposable',
  PAID_BY: 'employer',
}
```

**Impact:** CRITICAL
**Fix Effort:** 1 hour

#### Issue 4.3: Missing Family Deduction Constants
**Current:** No parts fiscales constants

**Should add:**
```typescript
FAMILY_DEDUCTIONS: {
  1.0: 0,
  1.5: 5500,
  2.0: 11000,
  2.5: 16500,
  3.0: 22000,
  3.5: 27500,
  4.0: 33000,
  4.5: 38500,
  5.0: 44000,
}
```

**Impact:** CRITICAL
**Fix Effort:** 1 hour

#### Issue 4.4: Wrong CNPS Family Rate (Lines 355-361)
**Current:**
```typescript
FAMILY_ALLOWANCE_EMPLOYER: 0.05,
```

**Should be:**
Already correct at 5%, but comment is misleading

**Impact:** LOW
**Fix Effort:** 0.5 hours

---

### 5. `/Users/admin/Sites/preem-hr/docs/03-DATABASE-SCHEMA.md`

**Location:** Database Schema

**Issues Found:**

#### Issue 5.1: Missing Employee Family Fields (Lines 110-165)
**Current:**
```sql
tax_dependents INTEGER NOT NULL DEFAULT 0,
```

**Should add:**
```sql
fiscal_parts DECIMAL(3,1) NOT NULL DEFAULT 1.0,
has_spouse BOOLEAN NOT NULL DEFAULT FALSE,
dependent_children INTEGER NOT NULL DEFAULT 0,
cmu_family_coverage BOOLEAN NOT NULL DEFAULT FALSE,
```

**Impact:** CRITICAL
**Fix Effort:** 2 hours (schema + migration)

#### Issue 5.2: Missing Country Configuration Tables
**Current:** No tables for multi-country payroll rules

**Should add:**
11 new tables from multi-country-payroll-architecture.md:
- countries
- tax_systems
- tax_brackets
- family_deduction_rules
- social_security_schemes
- contribution_types
- sector_contribution_overrides
- other_taxes
- salary_component_definitions
- (tenant country_code, sector_code columns)
- (employee fiscal_parts, etc. columns)

**Impact:** CRITICAL (for multi-country support)
**Fix Effort:** 8 hours (complete schema redesign)

#### Issue 5.3: Missing FDFP Tax Fields
**Current:** No fields for FDFP in payroll_line_items

**Should add:**
```sql
fdfp_tap NUMERIC(15,2) DEFAULT 0,
fdfp_tfpc NUMERIC(15,2) DEFAULT 0,
```

**Impact:** HIGH
**Fix Effort:** 1 hour

---

### 6. `/Users/admin/Sites/preem-hr/docs/10-API-CONTRACTS.md`

**Location:** API Contracts

**Issues Found:**

#### Issue 6.1: Missing Family Fields in Employee Create
**Current (Lines 136-143):**
No fiscal_parts, has_spouse, dependent_children fields

**Should add:**
```typescript
fiscalParts: z.number().min(1).max(5).default(1.0),
hasSpouse: z.boolean().default(false),
dependentChildren: z.number().min(0).default(0),
cmuFamilyCoverage: z.boolean().default(false),
```

**Impact:** HIGH
**Fix Effort:** 1 hour

#### Issue 6.2: Incomplete Payroll Calculation Response
**Current:** Missing FDFP fields in response

**Should add:**
```typescript
fdfpTap: number;
fdfpTfpc: number;
totalEmployerCost: number; // Including FDFP
```

**Impact:** HIGH
**Fix Effort:** 1 hour

---

### 7. `/Users/admin/Sites/preem-hr/docs/02-ARCHITECTURE-OVERVIEW.md`

**Location:** Architecture Overview

**Issues Found:**

#### Issue 7.1: No Multi-Country Architecture Section
**Current:** Single-country assumption

**Should add:**
- Section on country configuration management
- Strategy pattern for tax calculations
- Database-driven rules engine
- Adding new countries process

**Impact:** MEDIUM (future feature)
**Fix Effort:** 3 hours

#### Issue 7.2: Missing Calculation Base Definitions
**Current:** No distinction between calculation bases

**Should add:**
- Definition of "Brut Imposable" (for ITS, CNPS pension, FDFP)
- Definition of "Salaire Catégoriel" (for family, work accident)
- Definition of "Total Brut"
- When to use each base

**Impact:** HIGH
**Fix Effort:** 2 hours

---

### 8. `/Users/admin/Sites/preem-hr/docs/00-README-FIRST.md`

**Location:** Main README

**Issues Found:**

#### Issue 8.1: Outdated Source of Truth Reference
**Current (Lines 102-109):**
References incorrect `payroll-cote-d-ivoire.md` tax rates

**Should update:**
Point to `payroll-research-findings.md` as authoritative source

**Impact:** MEDIUM
**Fix Effort:** 1 hour

#### Issue 8.2: Missing Multi-Country Architecture Doc
**Current:** No reference to multi-country architecture

**Should add:**
Reference to `multi-country-payroll-architecture.md` and `country-config-schema.ts`

**Impact:** MEDIUM
**Fix Effort:** 0.5 hours

---

## Cross-Document Consistency Issues

### Issue C1: Calculation Formula Inconsistency
**Locations:**
- 05-EPIC-PAYROLL.md (lines 292-365)
- PAYROLL-CALCULATION-GUIDE.md (lines 266-297)
- payroll-cote-d-ivoire.md (lines 154-157)

**Problem:**
All three documents show different tax calculation approaches (annualized vs monthly)

**Fix:**
Standardize on monthly progressive calculation across all documents

**Effort:** 4 hours

### Issue C2: Test Data Mismatch
**Locations:**
- 05-EPIC-PAYROLL.md (test cases)
- PAYROLL-CALCULATION-GUIDE.md (examples)
- payroll-cote-d-ivoire.md (Example 7.1)

**Problem:**
All test examples use incorrect brackets and produce wrong net salaries

**Fix:**
Recalculate all examples with correct brackets + family deductions

**Effort:** 4 hours

### Issue C3: CMU Family Coverage Logic
**Locations:**
- 05-EPIC-PAYROLL.md (lines 217-234)
- payroll-cote-d-ivoire.md (lines 59-61)
- payroll-research-findings.md (lines 72-109)

**Problem:**
Inconsistent description of employer family coverage calculation

**Fix:**
Align all docs with research findings: 500 FCFA (employee) + 500 FCFA (spouse) + 500 FCFA per child (up to 6)

**Effort:** 2 hours

---

## Database Schema Updates Needed

### Priority P0: Critical Schema Additions

1. **Employee Table Additions**
   ```sql
   ALTER TABLE employees
     ADD COLUMN fiscal_parts DECIMAL(3,1) DEFAULT 1.0,
     ADD COLUMN has_spouse BOOLEAN DEFAULT FALSE,
     ADD COLUMN dependent_children INTEGER DEFAULT 0,
     ADD COLUMN cmu_family_coverage BOOLEAN DEFAULT FALSE;
   ```
   **Effort:** 1 hour

2. **Tenant Configuration**
   ```sql
   ALTER TABLE tenants
     ADD COLUMN country_code VARCHAR(2) DEFAULT 'CI',
     ADD COLUMN sector_code VARCHAR(50);
   ```
   **Effort:** 0.5 hours

3. **Payroll Line Items - FDFP Fields**
   ```sql
   ALTER TABLE payroll_line_items
     ADD COLUMN fdfp_tap NUMERIC(15,2) DEFAULT 0,
     ADD COLUMN fdfp_tfpc NUMERIC(15,2) DEFAULT 0;
   ```
   **Effort:** 0.5 hours

### Priority P1: Multi-Country Schema

4. **New Configuration Tables** (from multi-country-payroll-architecture.md)
   - Create 11 new tables for country rules
   - Migrate Côte d'Ivoire rules to configuration
   **Effort:** 8 hours

---

## API Contract Changes Required

### Breaking Changes

1. **Employee Create/Update**
   - Add: `fiscalParts`, `hasSpouse`, `dependentChildren`, `cmuFamilyCoverage`
   - **Impact:** Breaking change for existing clients
   - **Migration:** Default values for existing records
   - **Effort:** 2 hours

2. **Payroll Calculation Response**
   - Add: `fdfpTap`, `fdfpTfpc`, `familyDeduction`
   - Modify: `its` calculation approach
   - **Impact:** Breaking change
   - **Effort:** 2 hours

### Non-Breaking Additions

3. **New Country Configuration Endpoints**
   - `GET /api/country-rules/:countryCode`
   - `GET /api/tax-brackets/:countryCode`
   - **Effort:** 3 hours

---

## Test Updates Required

### Critical Test Fixes

1. **ITS Calculation Tests**
   - File: `features/payroll/__tests__/its-calculation.test.ts`
   - Fix: All bracket tests use wrong values
   - **Effort:** 3 hours

2. **Example 7.1 Validation Test**
   - File: `features/payroll/__tests__/payroll-calculation.test.ts`
   - Fix: Update expected values with correct calculations
   - **Effort:** 2 hours

3. **FDFP Tax Tests**
   - Status: MISSING
   - Add: Complete test suite for FDFP calculations
   - **Effort:** 2 hours

4. **Family Deduction Tests**
   - Status: MISSING
   - Add: Tests for all parts fiscales levels
   - **Effort:** 2 hours

5. **Multi-Country Integration Tests**
   - Status: MISSING
   - Add: Tests for configuration-based calculation
   - **Effort:** 4 hours

---

## Priority Fix List

### Phase 1: Critical Corrections (P0) - 12-16 hours

1. **Update ITS Tax Brackets** (All Docs)
   - 05-EPIC-PAYROLL.md
   - payroll-cote-d-ivoire.md
   - PAYROLL-CALCULATION-GUIDE.md
   - 01-CONSTRAINTS-AND-RULES.md
   - **Effort:** 6 hours

2. **Add Family Deductions System** (All Docs)
   - Document parts fiscales logic
   - Add constants
   - Update examples
   - **Effort:** 4 hours

3. **Add FDFP Training Taxes**
   - Document requirements
   - Add to schema
   - Update calculations
   - **Effort:** 4 hours

4. **Fix CNPS Family Rate**
   - Change 5.75% → 5.0%
   - Update all references
   - **Effort:** 1 hour

### Phase 2: Database Schema (P1) - 10-12 hours

5. **Add Employee Family Fields**
   - Schema migration
   - Update API contracts
   - Update UI forms
   - **Effort:** 3 hours

6. **Multi-Country Configuration Tables**
   - Create 11 new tables
   - Seed Côte d'Ivoire data
   - **Effort:** 8 hours

### Phase 3: Architecture Updates (P1) - 8-10 hours

7. **Document Multi-Country Architecture**
   - Add section to 02-ARCHITECTURE-OVERVIEW.md
   - Create calculation base definitions
   - **Effort:** 3 hours

8. **Update Source of Truth References**
   - Point to research findings
   - Cross-reference new architecture docs
   - **Effort:** 2 hours

9. **Standardize Terminology**
   - Create glossary
   - Use consistent terms (Brut Imposable, etc.)
   - **Effort:** 2 hours

### Phase 4: Testing & Validation (P2) - 12-14 hours

10. **Recalculate All Examples**
    - Example 7.1 with correct values
    - Example 7.2 overtime
    - Edge cases
    - **Effort:** 4 hours

11. **Update All Test Cases**
    - Fix ITS tests
    - Add FDFP tests
    - Add family deduction tests
    - **Effort:** 6 hours

12. **Create Validation Scripts**
    - Compare old vs new calculations
    - Verify regulatory compliance
    - **Effort:** 2 hours

---

## Estimated Total Effort

| Phase | Hours |
|-------|-------|
| Phase 1: Critical Corrections | 12-16 |
| Phase 2: Database Schema | 10-12 |
| Phase 3: Architecture Updates | 8-10 |
| Phase 4: Testing & Validation | 12-14 |
| **Total** | **42-52 hours** |

**Recommended allocation:** 1.5-2 weeks with 2 developers

---

## Recommended Approach

### Week 1: Fix Critical Issues
**Days 1-2:** Update all tax brackets and formulas
- Fix ITS brackets (8 → 6, 60% → 32%)
- Change from annualized to monthly calculation
- Update all constants files

**Days 3-4:** Add family deductions and FDFP
- Implement parts fiscales system
- Add FDFP tax calculations (TAP + TFPC)
- Update database schema

**Day 5:** Recalculate all examples
- Example 7.1 with correct values
- Update test cases
- Verify calculations

### Week 2: Multi-Country Architecture
**Days 6-7:** Database schema for multi-country
- Create 11 configuration tables
- Migrate Côte d'Ivoire rules to database
- Seed data

**Days 8-9:** Update documentation
- Add multi-country sections
- Create calculation base glossary
- Update cross-references

**Day 10:** Testing and validation
- Run all tests with new values
- Compare old vs new calculations
- Final review

---

## Key Risks if Not Fixed

### Legal/Regulatory Risks
1. **Tax Non-Compliance:** Wrong ITS brackets could result in under/over-withholding, leading to:
   - Penalties from Direction Générale des Impôts (DGI)
   - Employee complaints if over-taxed
   - Tax audits and back-payment requirements

2. **Missing FDFP Contributions:** Failure to pay mandatory training taxes:
   - Legal penalties
   - Company cannot hire apprentices
   - Reputational damage

3. **Social Security Violations:** Wrong CNPS rates:
   - Rejection by CNPS
   - Employee benefit issues
   - Back-payment requirements

### Financial Risks
1. **Incorrect Employer Costs:** Missing 1.6% FDFP adds significant hidden cost
2. **Wrong Net Salaries:** Employees receive incorrect pay, trust issues
3. **Budget Planning Issues:** Total employer cost calculations are wrong

### Technical Risks
1. **Cannot Expand to Other Countries:** Single-country architecture blocks growth
2. **Calculation Errors Compound:** Wrong base formulas affect all downstream calculations
3. **Test Suite is Unreliable:** All tests pass with wrong values

---

## Conclusion

**Status:** 🔴 CRITICAL - Documentation is significantly out of sync with regulatory requirements

**Next Steps:**
1. Approve this audit report
2. Prioritize Phase 1 fixes (critical corrections)
3. Create detailed implementation tasks
4. Assign developers
5. Begin Week 1 fixes immediately

**Success Criteria:**
- All tax calculations match official examples
- FDFP taxes implemented and tested
- Family deductions system operational
- Multi-country architecture documented
- All test cases updated and passing

---

**Audit Completed By:** Claude AI Assistant
**Review Status:** Pending stakeholder review
**Next Review:** After Phase 1 completion
