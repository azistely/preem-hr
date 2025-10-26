# Payroll Formula Comparison

**Document:** `docs/formule-calcul-salaire.md`
**Implementation:** Current payroll calculation system
**Date:** 2025-10-25

## Overview

This table compares the salary calculation formulas from the specification document with our actual implementation to identify alignment and discrepancies.

---

## Legend

- ✅ **MATCH** - Formula matches implementation
- ⚠️ **PARTIAL** - Similar approach but different details
- ❌ **DIFFERENT** - Significant difference in approach
- 📝 **NOTE** - Additional context or explanation

---

## 1. Brut Fiscal (Taxable Gross Salary)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Formula** | `SalaireCategoriel + Sursalaire + PrimeAnciennete + AutresGainsTaxables` | `calculateGrossSalary()` → returns `totalGross` | ⚠️ PARTIAL |
| **Components** | Explicitly lists: salaire catégoriel (code 11), sursalaire (code 12), prime d'ancienneté, other taxable gains | Includes: base salary, allowances (housing, transport, meal), seniority, family, bonuses, overtime | ⚠️ PARTIAL |
| **Tax Treatment** | Excludes non-taxable items (prime de transport if marked "Non") | Uses `taxable` flag from component metadata (`isComponentTaxable()`) | ✅ MATCH |
| **Implementation** | Single variable: `BrutFiscal` | Multiple variables: `grossSalary`, `proratedSalary`, component breakdown | ⚠️ PARTIAL |

**📝 Notes:**
- Document uses **Brut Fiscal** as a single concept
- Our code uses **grossSalary** which includes ALL earnings (taxable + non-taxable)
- For tax calculation, we filter to taxable components using `taxCalculationBase` from database
- **KEY DIFFERENCE**: Document's "Brut Fiscal" ≈ Our "taxable gross" (subset of total gross)

**Code References:**
- `features/payroll/services/gross-calculation.ts` - Gross calculation
- `lib/salary-components/component-reader.ts:163-172` - `getBrutImposableComponents()`
- `features/payroll/services/payroll-calculation-v2.ts:476` - Uses total gross for calculation

---

## 2. ITS (Impôt sur les Traitements et Salaires) - Income Tax

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | Brut Fiscal (taxable earnings only) | `grossSalary - employeeContributions` (depends on `taxCalculationBase`) | ⚠️ PARTIAL |
| **Brackets** | Hardcoded: 0%, 16%, 21%, 24%, 28%, 32% at specific thresholds | Database-driven: loaded from `tax_brackets` table | ✅ MATCH |
| **RICF Deduction** | Fixed table based on Parts RICF (1=0, 1.5=5,500, 2=11,000, etc.) | Database-driven: loaded from `family_deduction_rules` table | ✅ MATCH |
| **Formula** | `MAX(GrossTaxITS - RICF, 0)` | `taxStrategy.calculate()` with family deductions | ✅ MATCH |
| **Progressive Calculation** | Manual bracket calculation with LET formula | `ProgressiveMonthlyTaxStrategy` class | ✅ MATCH |

**📝 Notes:**
- **MATCH**: Both use progressive brackets and RICF deductions
- **DIFFERENCE**: Document uses "Brut Fiscal" directly; we use configurable `taxCalculationBase`:
  - `'gross_before_ss'` (CI): Tax on gross BEFORE employee SS deductions
  - `'gross_after_ss'`: Tax on gross AFTER employee SS deductions
- Document hardcodes brackets; we load from database (more flexible for multi-country)

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:497-590` - Tax calculation
- `features/payroll-config/strategies/progressive-monthly-tax.strategy.ts` - Tax strategy
- `features/payroll/services/payroll-calculation-v2.ts:505-508` - Tax base determination

---

## 3. CNPS Retraite (Pension Contribution)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | Brut Fiscal | `grossSalary` (with optional ceiling) | ⚠️ PARTIAL |
| **Employee Rate** | 6.3% | Database-driven from `contribution_types` table | ✅ MATCH |
| **Employer Rate** | 7.7% | Database-driven from `contribution_types` table | ✅ MATCH |
| **Ceiling** | Not mentioned (implies no ceiling or uses Brut Fiscal cap) | Database-configurable via `ceilingAmount` field | ⚠️ PARTIAL |
| **Formula** | `BrutFiscal × 6.3%` (employee), `BrutFiscal × 7.7%` (employer) | `calculationBase × employeeRate`, `calculationBase × employerRate` | ✅ MATCH |

**📝 Notes:**
- **MATCH**: Rates are the same (6.3% / 7.7%)
- **DIFFERENCE**: Document uses "Brut Fiscal"; we use `grossSalary` with optional ceiling
- Our implementation supports multiple calculation bases:
  - `'brut_imposable'` - Taxable gross
  - `'salaire_categoriel'` - Code 11 only
  - `'gross_salary'` - Total gross (default)
- Database config allows per-country customization

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:736-874` - `calculateSocialSecurityContributions()`
- `features/payroll/services/payroll-calculation-v2.ts:770-794` - Calculation base logic
- `features/payroll/services/payroll-calculation-v2.ts:848-850` - Pension/retirement categorization

---

## 4. CNPS Accident du Travail (Work Accident Insurance)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | **Fixed 75,000 FCFA** | `salaireCategoriel` OR `ceilingAmount` from database | ❌ DIFFERENT |
| **Rate** | 3.0% (employer only) | Variable by sector (database-driven with `isVariableBySector` flag) | ❌ DIFFERENT |
| **Who Pays** | Employer only | Employer only | ✅ MATCH |
| **Formula** | `75,000 × 3.0% = 2,250 FCFA` | `MIN(salaireCategoriel, ceiling) × sectorRate` | ❌ DIFFERENT |

**📝 Notes:**
- **CRITICAL DIFFERENCE**: Document uses **fixed base of 75,000 FCFA**
- Our implementation uses:
  1. `salaireCategoriel` (code 11) as base if provided
  2. Falls back to `ceilingAmount` from database
  3. Applies sector-specific rate from `sector_contribution_overrides` table
- **Document approach is simpler** but less accurate (doesn't reflect actual salaire catégoriel)
- **Our approach is more precise** but requires proper database configuration

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:770-787` - Calculation base logic for `salaire_categoriel`
- `features/payroll/services/payroll-calculation-v2.ts:832-841` - Sector override logic
- `features/payroll/services/payroll-calculation-v2.ts:858-863` - Work accident categorization

---

## 5. CNPS Prestations Familiales (Family Benefits)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | **Fixed 75,000 FCFA** | `salaireCategoriel` OR `ceilingAmount` from database | ❌ DIFFERENT |
| **Rate** | 5.75% (employer only) | Database-driven from `contribution_types` table | ✅ MATCH |
| **Who Pays** | Employer only | Employer only | ✅ MATCH |
| **Formula** | `75,000 × 5.75% = 4,312.50 FCFA` | `MIN(salaireCategoriel, ceiling) × rate` | ❌ DIFFERENT |

**📝 Notes:**
- **CRITICAL DIFFERENCE**: Same issue as Work Accident - document uses **fixed 75,000 FCFA**
- Our implementation uses actual `salaireCategoriel` (more accurate)
- Rate matches (5.75%) when properly configured in database
- **Recommendation**: Verify database has correct rate and ceiling configuration

**Code References:**
- Same as Work Accident above
- `features/payroll/services/payroll-calculation-v2.ts:858-863` - Family benefits categorization

---

## 6. CMU (Couverture Maladie Universelle) - Universal Health Coverage

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | **Fixed 1,000 FCFA** | **Fixed amounts** from database (500 base, 1,000 family) | ✅ MATCH |
| **Employee** | `1,000 × 50% = 500 FCFA` | Database: `fixedAmount = 500` for `cmu_employee` | ✅ MATCH |
| **Employer (No Family)** | `1,000 × 50% = 500 FCFA` | Database: `fixedAmount = 500` for `cmu_employer_base` | ✅ MATCH |
| **Employer (With Family)** | Not mentioned | Database: `fixedAmount = 1,000` for `cmu_employer_family` | ⚠️ PARTIAL |
| **Logic** | Single rate (50/50 split) | Conditional: `hasFamily` flag determines employer amount | ⚠️ PARTIAL |

**📝 Notes:**
- **MATCH**: Employee portion is fixed 500 FCFA
- **PARTIAL**: Employer portion varies by family status in our implementation:
  - No family: 500 FCFA
  - With family: 1,000 FCFA
- Document doesn't mention family variant (may be simplified version)
- Our implementation is more detailed and accurate to actual regulations

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:798-824` - Fixed amount CMU logic
- `features/payroll/services/payroll-calculation-v2.ts:807-819` - Family-aware CMU calculation

---

## 7. FDFP - Taxe d'Apprentissage (Apprenticeship Training Tax)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | Brut Fiscal | `grossSalary` (configurable via `calculationBase`) | ⚠️ PARTIAL |
| **Rate** | 0.4% (employer only) | Database-driven from `other_taxes` table | ✅ MATCH |
| **Who Pays** | Employer only | Database: `paidBy = 'employer'` | ✅ MATCH |
| **Formula** | `BrutFiscal × 0.4%` | `base × taxRate` | ✅ MATCH |

**📝 Notes:**
- **MATCH**: Rate and payer are correct
- **PARTIAL**: Base may differ (Brut Fiscal vs gross salary)
- Database config allows customization via `calculationBase` field:
  - `'brut_imposable'` - Taxable gross (matches document)
  - `'gross_salary'` - Total gross
- **Recommendation**: Verify database has `calculationBase = 'brut_imposable'` for accuracy

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:696-733` - `calculateOtherTaxes()`
- `features/payroll/services/payroll-calculation-v2.ts:706-708` - Calculation base logic

---

## 8. FDFP - Formation Professionnelle Continue (Continuing Training Tax)

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Base** | Brut Fiscal | `grossSalary` (configurable via `calculationBase`) | ⚠️ PARTIAL |
| **Rate** | 0.6% (employer only) | Database-driven from `other_taxes` table | ✅ MATCH |
| **Who Pays** | Employer only | Database: `paidBy = 'employer'` | ✅ MATCH |
| **Formula** | `BrutFiscal × 0.6%` | `base × taxRate` | ✅ MATCH |

**📝 Notes:**
- Same as FDFP Apprentissage above
- **Recommendation**: Verify database configuration for correct base

**Code References:**
- Same as FDFP Apprentissage above

---

## 9. Net Pay Calculation

| Aspect | Document Formula | Our Implementation | Status |
|--------|-----------------|-------------------|--------|
| **Formula** | `BrutFiscal + (non-taxable gains) - EmployeeDeductions` | `grossSalary - totalDeductions` | ✅ MATCH |
| **Employee Deductions** | `RetenueITS + CNPS_Retraite_EE + CMU_EE + (other)` | `cnpsEmployee + cmuEmployee + its` | ✅ MATCH |
| **Rounding** | `MROUND(NetAvantArrondi + 18, 100)` | `Math.round(grossSalary - totalDeductions)` | ❌ DIFFERENT |

**📝 Notes:**
- **MATCH**: Deduction calculation approach is the same
- **CRITICAL DIFFERENCE**: Rounding formula
  - **Document**: Rounds to nearest 100 with +18 adjustment (`MROUND(x + 18, 100)`)
  - **Our code**: Standard rounding to nearest integer (`Math.round()`)
- **Example**:
  - Net before rounding: 247,532 FCFA
  - Document: `MROUND(247,532 + 18, 100) = 247,600 FCFA`
  - Our code: `Math.round(247,532) = 247,532 FCFA`
- **Recommendation**: Investigate if this rounding rule is regulatory requirement or business rule

**Code References:**
- `features/payroll/services/payroll-calculation-v2.ts:595-596` - Net calculation with standard rounding

---

## Summary Table

| Component | Formula Match | Implementation Match | Critical Issues |
|-----------|--------------|---------------------|-----------------|
| **Brut Fiscal** | ⚠️ Partial | ⚠️ Uses gross salary instead | Need to clarify taxable vs total gross |
| **ITS (Tax)** | ✅ Match | ✅ Match | None - Progressive calculation correct |
| **CNPS Retraite** | ✅ Match | ✅ Match | None - Rates correct (6.3% / 7.7%) |
| **CNPS AT** | ❌ Different | ❌ Different | **CRITICAL**: Fixed 75K vs salaireCategoriel |
| **CNPS PF** | ❌ Different | ❌ Different | **CRITICAL**: Fixed 75K vs salaireCategoriel |
| **CMU** | ✅ Match | ⚠️ Partial | Family variant not in doc |
| **FDFP Apprentissage** | ✅ Match | ⚠️ Partial | Base may differ (need to verify DB config) |
| **FDFP FPC** | ✅ Match | ⚠️ Partial | Base may differ (need to verify DB config) |
| **Net Pay** | ✅ Match | ❌ Different | **CRITICAL**: Missing +18 rounding rule |

---

## Critical Findings

### 🔴 HIGH PRIORITY

1. **CNPS Work Accident & Family Benefits Base**
   - **Document**: Fixed 75,000 FCFA base
   - **Our Code**: Uses `salaireCategoriel` (actual base salary)
   - **Impact**: Contribution amounts will differ
   - **Action**: Determine which is legally correct for Côte d'Ivoire
   - **Files**: `payroll-calculation-v2.ts:770-787`

2. **Net Pay Rounding**
   - **Document**: `MROUND(net + 18, 100)` - Rounds to nearest 100 with +18 adjustment
   - **Our Code**: `Math.round(net)` - Standard rounding
   - **Impact**: Net pay amounts will differ (typically by 0-100 FCFA)
   - **Action**: Verify if +18 rounding is regulatory requirement
   - **Files**: `payroll-calculation-v2.ts:595-596`

### 🟡 MEDIUM PRIORITY

3. **Brut Fiscal vs Gross Salary**
   - **Document**: "Brut Fiscal" = taxable earnings only
   - **Our Code**: Uses total `grossSalary` (taxable + non-taxable)
   - **Impact**: Tax and contribution bases may differ
   - **Action**: Ensure we filter to taxable components where needed
   - **Files**: `component-reader.ts:163-172` (helper exists but may not be used everywhere)

4. **FDFP Calculation Base**
   - **Document**: Explicitly uses "Brut Fiscal" (taxable gross)
   - **Our Code**: Configurable but may use total gross
   - **Impact**: Tax amounts may differ
   - **Action**: Verify database config has `calculationBase = 'brut_imposable'`
   - **Files**: `payroll-calculation-v2.ts:706-708`

### 🟢 LOW PRIORITY

5. **CMU Family Variant**
   - **Document**: Doesn't mention family variant
   - **Our Code**: Employer pays 500 (no family) or 1,000 (with family)
   - **Impact**: Employer cost differs for employees with families
   - **Action**: Confirm this is correct per regulations
   - **Files**: `payroll-calculation-v2.ts:807-819`

---

## Recommendations

### Immediate Actions

1. **Investigate CNPS AT/PF Base** (CRITICAL)
   - [ ] Consult Côte d'Ivoire CNPS regulations
   - [ ] Determine if 75,000 FCFA fixed base is correct or if actual salaireCategoriel should be used
   - [ ] Update database seed if fixed base is correct
   - [ ] Update code logic if salaireCategoriel is correct

2. **Verify Net Pay Rounding Rule** (CRITICAL)
   - [ ] Check CI labor regulations for rounding requirements
   - [ ] Implement `MROUND(net + 18, 100)` if required
   - [ ] Add test cases for rounding edge cases
   - [ ] Document why +18 is used (likely to avoid underpayment issues)

3. **Audit Calculation Bases** (HIGH)
   - [ ] Review all components to ensure correct base is used:
     - Tax → Brut Fiscal (taxable gross)
     - CNPS Retraite → Brut Fiscal or Gross Salary (verify)
     - FDFP → Brut Fiscal (taxable gross)
     - CMU → Fixed amount (no base)
   - [ ] Add database migration to set correct `calculationBase` values
   - [ ] Add validation to ensure bases are correctly configured

### Future Improvements

4. **Add Formula Documentation**
   - [ ] Add inline comments in code referencing document formulas
   - [ ] Create unit tests that validate against document examples
   - [ ] Generate payslip preview that shows formula breakdown

5. **Database Configuration Validation**
   - [ ] Add startup check to validate payroll configuration completeness
   - [ ] Warn if contribution rates differ from document
   - [ ] Add admin UI to compare config vs document formulas

---

## Test Cases Needed

Based on this comparison, we need test cases for:

1. **CNPS AT/PF with different bases**
   ```typescript
   // Test case 1: Fixed 75K base (document)
   // Test case 2: Actual salaireCategoriel (our code)
   ```

2. **Net pay rounding**
   ```typescript
   // Example: 247,532 FCFA
   // Document: 247,600 FCFA (MROUND(247532 + 18, 100))
   // Our code: 247,532 FCFA (Math.round)
   ```

3. **Brut Fiscal vs Gross Salary**
   ```typescript
   // Employee with non-taxable allowances
   // Verify tax is calculated on taxable portion only
   ```

4. **FDFP base verification**
   ```typescript
   // Verify uses Brut Fiscal (taxable) not total gross
   ```

---

## Files to Review

1. `features/payroll/services/payroll-calculation-v2.ts` - Main calculation logic
2. `lib/salary-components/component-reader.ts` - Component categorization
3. `features/payroll/services/gross-calculation.ts` - Gross calculation
4. `features/payroll-config/strategies/progressive-monthly-tax.strategy.ts` - Tax strategy
5. `supabase/migrations/*_create_payroll_config.sql` - Database seed values

---

**Generated:** 2025-10-25
**Comparison Against:** `docs/formule-calcul-salaire.md`
**Codebase Version:** Current main branch
