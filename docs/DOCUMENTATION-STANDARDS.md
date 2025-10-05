# Documentation Standards Guide

**Purpose:** Prevent future inconsistencies and maintain coherent, accurate documentation
**Audience:** Developers, technical writers, AI assistants
**Last Updated:** October 5, 2025

---

## 1. Payroll Terminology Standards

### 1.1 Official Terms (Use These)

**Salary Components:**
- **Brut Imposable** (Taxable Gross) - NOT "Gross Salary"
  - Use for: ITS calculation, CNPS pension, FDFP taxes
  - Definition: Base salary + taxable allowances + overtime + bonuses
  - Excludes: Reimbursements, non-taxable benefits

- **Salaire Catégoriel** (Categorical Salary) - NOT "Capped Salary"
  - Use for: CNPS family, work accident, maternity
  - Definition: min(Brut Imposable, 70,000 FCFA)
  - Always capped at 70,000 FCFA

- **Total Brut** (Total Gross) - NOT "Gross Pay"
  - Definition: All salary components including non-taxable
  - Use for: Payslip totals, reporting

### 1.2 Tax & Contribution Terms

**ITS (Impôt sur les Traitements et Salaires):**
- ✅ Use: "ITS" or "Impôt sur les Traitements et Salaires"
- ❌ Avoid: "Income Tax", "IT", "Payroll Tax"
- Note: Never translate to English in French-facing documentation

**CNPS (Caisse Nationale de Prévoyance Sociale):**
- ✅ Use: "CNPS" (full name on first mention)
- Components:
  - Pension (Retraite)
  - Family Allowance (Prestations Familiales)
  - Work Accident (Accidents de Travail)
  - Maternity (Maternité)
- ❌ Avoid: "Social Security", "SS"

**FDFP (Fonds de Développement de la Formation Professionnelle):**
- ✅ Use: "FDFP" with full name on first mention
- Components:
  - TAP: Taxe d'Apprentissage (0.4%)
  - TFPC: Taxe de Formation Professionnelle Continue (1.2%)
- ❌ Avoid: "Training Tax", "Professional Development Tax"

**CMU (Couverture Maladie Universelle):**
- ✅ Use: "CMU" or "Couverture Maladie Universelle"
- ❌ Avoid: "Universal Health Coverage" (except in English translations)

### 1.3 Country-Specific Terms

**Côte d'Ivoire:**
- ✅ "Côte d'Ivoire" (with accent)
- ❌ "Ivory Coast" (English only)
- Currency: FCFA (Franc CFA)
- Minimum wage: SMIG (Salaire Minimum Interprofessionnel Garanti)

**Multi-Country:**
- Use country codes: CI (Côte d'Ivoire), SN (Senegal), BF (Burkina Faso)
- Always specify country when discussing regulations
- Example: "ITS (Côte d'Ivoire)" vs "IR (Senegal)"

### 1.4 Forbidden Terms

| ❌ Don't Use | ✅ Use Instead | Reason |
|-------------|---------------|--------|
| "Gross Salary" | "Brut Imposable" or "Total Brut" | Ambiguous |
| "Net Pay" | "Salaire Net" | French context |
| "Deductions" | "Retenues" or "Cotisations" | More precise |
| "Tax Bracket" | "Tranche d'imposition" | Official term |
| "Dependents" | "Personnes à charge" or "Parts fiscales" | Legal term |

---

## 2. Formula Documentation Standards

### 2.1 Formula Presentation Format

**Standard Template:**

```markdown
### [Calculation Name]

**Purpose:** [One-line description]

**Calculation Base:** [Which salary base to use]

**Formula:**
```
[Mathematical formula in plaintext]
```

**Where:**
- Variable 1: [Definition]
- Variable 2: [Definition]

**Example:**
```
Input: [Values]
Calculation: [Step-by-step]
Result: [Final value]
```

**Source:** [Reference to official document/regulation]

**Last Updated:** [Date]
```

**Example:**

```markdown
### CNPS Pension Contribution (Employee)

**Purpose:** Calculate employee's monthly pension contribution

**Calculation Base:** Brut Imposable (capped at 3,375,000 FCFA)

**Formula:**
```
CNPS Pension (Employee) = min(Brut Imposable, 3,375,000) × 6.3%
```

**Where:**
- Brut Imposable: Base salary + taxable allowances + overtime + bonuses
- Ceiling: 3,375,000 FCFA (45 × SMIG)
- Rate: 6.3% (employee portion)

**Example:**
```
Input: Brut Imposable = 500,000 FCFA
Calculation: min(500,000, 3,375,000) × 0.063 = 500,000 × 0.063
Result: 31,500 FCFA
```

**Source:** Code de Prévoyance Sociale, Article 12 (2025)

**Last Updated:** October 5, 2025
```

### 2.2 Progressive Tax Documentation

**Template for Progressive Calculations:**

```markdown
### [Tax Name] Progressive Calculation

**Brackets (Effective [Date]):**

| Bracket | Income Range (FCFA) | Rate | Tax on Bracket |
|---------|---------------------|------|----------------|
| 1 | 0 - 75,000 | 0% | 0 |
| 2 | 75,000 - 240,000 | 16% | (Income - 75,000) × 16% |
| ... | ... | ... | ... |

**Calculation Method:**
1. Determine which brackets apply to income
2. Calculate tax for each bracket separately
3. Sum all bracket taxes
4. Apply rounding rules

**Worked Example:**
```
Income: 300,000 FCFA

Bracket 1 (0-75,000):
  75,000 × 0% = 0

Bracket 2 (75,000-240,000):
  (240,000 - 75,000) × 16% = 165,000 × 0.16 = 26,400

Bracket 3 (240,000-300,000):
  (300,000 - 240,000) × 21% = 60,000 × 0.21 = 12,600

Total: 0 + 26,400 + 12,600 = 39,000 FCFA
```

**Source:** [Official regulation]
```

### 2.3 Configuration Reference Format

**When formulas depend on configuration:**

```markdown
**Formula:**
```
[Calculation] × rate
```

**Where:**
- rate: Configured in `country_config.contribution_types` table
- Default (Côte d'Ivoire): [value]
- See: [Link to configuration documentation]

**⚠️ Warning:** Do not hardcode rate values in implementation code.
Use configuration-driven approach.
```

---

## 3. Multi-Country Documentation Standards

### 3.1 When to Specify Country

**Always specify country for:**
- Tax rates and brackets
- Contribution rates
- Regulatory requirements
- Official forms/documents
- Legal references

**Example:**
```markdown
❌ Wrong:
"The ITS rate is 16% for incomes between 75,000 and 240,000 FCFA."

✅ Correct:
"In Côte d'Ivoire, the ITS rate is 16% for monthly incomes between 75,000 and 240,000 FCFA (effective January 2024)."
```

### 3.2 Country Comparison Tables

**Format for multi-country comparisons:**

```markdown
| Feature | Côte d'Ivoire (CI) | Senegal (SN) | Burkina Faso (BF) |
|---------|-------------------|--------------|-------------------|
| Tax System | Progressive (6 brackets) | Progressive (5 brackets) | Progressive (4 brackets) |
| Max Rate | 32% | 40% | 25% |
| Family Deduction | Parts fiscales | Parts fiscales | Fixed deduction |
| Pension Rate (Employee) | 6.3% | 5.6% | 5.5% |
| Minimum Wage | 75,000 FCFA | 52,500 FCFA | 34,664 FCFA |
| Currency | FCFA (XOF) | FCFA (XOF) | FCFA (XOF) |

**Last Updated:** October 2025
**Source:** [Research document reference]
```

### 3.3 Generic vs Country-Specific Sections

**Structure:**

```markdown
## [Feature Name]

### Overview (Generic)
[Country-agnostic description of feature]

### Implementation Patterns (Generic)
[How to implement regardless of country]

### Country-Specific Rules

#### Côte d'Ivoire (CI)
[CI-specific rules, rates, regulations]

#### Senegal (SN)
[SN-specific rules, rates, regulations]

[...]

### Configuration Approach
[How to add new countries]
```

---

## 4. Version Control & Change Tracking

### 4.1 Regulatory Change Documentation

**When tax rates or rules change:**

1. **Create a dated section:**
   ```markdown
   ## ITS Tax Brackets

   ### Current (Effective January 1, 2024)
   [Current brackets]

   ### Historical

   #### 2020-2023 (Superseded)
   [Old brackets]
   **Reason for change:** Tax reform simplification
   **Official source:** [Link]
   ```

2. **Update changelog:**
   ```markdown
   ## Changelog

   ### October 5, 2025
   - Updated ITS brackets based on payroll research findings
   - Changed from 8 brackets (0-60%) to 6 brackets (0-32%)
   - Corrected calculation from annualized to monthly progressive
   - **Impact:** All payroll calculations updated
   - **Migration:** See DOCUMENTATION-UPDATE-CHECKLIST.md
   ```

### 4.2 Effective Date Tracking

**Always include effective dates:**

```markdown
**Effective Date:** January 1, 2024
**Applicable to:** All payroll runs with period ending on or after this date
**Supersedes:** Previous ITS system (3 separate cédules)
```

### 4.3 Archiving Old Versions

**Structure:**
```
docs/
├── current/
│   ├── payroll-calculation.md
│   └── tax-rates.md
└── archived/
    ├── 2023/
    │   ├── payroll-calculation-2023.md
    │   └── tax-rates-2023.md
    └── 2022/
        └── ...
```

**Archive naming:** `[filename]-[year].md`

---

## 5. Cross-Reference Requirements

### 5.1 When to Link to Other Docs

**Always link when:**
- Referencing a formula defined elsewhere
- Citing a regulatory requirement
- Mentioning a database schema
- Using a term defined in glossary
- Referring to an example

**Link format:**
```markdown
See [ITS Progressive Calculation](./payroll-calculation.md#its-progressive-calculation)

Reference: [Database Schema - Employee Salaries](/docs/03-DATABASE-SCHEMA.md#employee-salaries)

Definition: [Brut Imposable](#glossary-brut-imposable)
```

### 5.2 Maintaining Link Integrity

**Before renaming or moving files:**
1. Search for all references: `grep -r "old-filename.md" docs/`
2. Update all links
3. Create redirect if needed
4. Test all links with link checker

**Link checker command:**
```bash
npm run docs:check-links
```

### 5.3 Source of Truth Declarations

**In each document, declare dependencies:**

```markdown
## Dependencies

This document depends on:
- [payroll-research-findings.md](./payroll-research-findings.md) - Tax rates
- [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md) - Employee fields
- [multi-country-payroll-architecture.md](./multi-country-payroll-architecture.md) - Configuration

**Last Verified:** October 5, 2025
```

---

## 6. Example & Test Case Standards

### 6.1 Official Example Format

**Use real regulatory examples:**

```markdown
## Example 7.1: Standard Employee (300,000 FCFA)

**Source:** Direction Générale des Impôts, Guide de Calcul de la Paie 2024, Page 45

**Employee Profile:**
- Base Salary: 300,000 FCFA
- Allowances: None
- Overtime: None
- Marital Status: Married, 2 children
- Fiscal Parts: 2.0

**Calculation:**

1. **Brut Imposable:**
   ```
   300,000 FCFA (base salary only)
   ```

2. **CNPS Pension (Employee):**
   ```
   min(300,000, 3,375,000) × 6.3% = 18,900 FCFA
   ```

3. **CMU (Employee):**
   ```
   1,000 FCFA (fixed)
   ```

4. **FDFP (Employer):**
   ```
   TAP:  300,000 × 0.4% = 1,200 FCFA
   TFPC: 300,000 × 1.2% = 3,600 FCFA
   Total: 4,800 FCFA
   ```

5. **Taxable Income:**
   ```
   300,000 - 18,900 - 1,000 - 11,000 (family deduction)
   = 269,100 FCFA
   ```

6. **ITS (Monthly Progressive):**
   ```
   Bracket 1 (0-75,000):      75,000 × 0%  = 0
   Bracket 2 (75,000-240,000): 165,000 × 16% = 26,400
   Bracket 3 (240,000-269,100): 29,100 × 21% = 6,111
   Total: 32,511 FCFA
   ```

7. **Net Salary:**
   ```
   300,000 - 18,900 - 1,000 - 32,511 = 247,589 FCFA
   Rounded: 247,590 FCFA (nearest 10)
   ```

**Verification:**
- [ ] Calculation matches official example
- [ ] All rates from configuration
- [ ] Rounding applied correctly

**Last Verified:** October 5, 2025
```

### 6.2 Edge Case Documentation

**Document all edge cases:**

```markdown
## Edge Cases

### Case 1: Salary Below SMIG
**Scenario:** Employee hired at 60,000 FCFA
**Expected:** Validation error
**Error Message:** "Le salaire doit être >= SMIG (75,000 FCFA)"

### Case 2: High Earner Above All Brackets
**Scenario:** Monthly income of 10,000,000 FCFA
**Expected:** Top bracket (32%) applies to excess over 8,000,000

### Case 3: Mid-Month Hire
**Scenario:** Hired on January 15, salary 300,000
**Expected:** Prorated to 17/31 days = 164,516 FCFA
**Note:** All contributions calculated on prorated amount
```

### 6.3 Test Data Standards

**Use realistic, verified data:**

```markdown
## Test Employees

### Employee A: Minimum Wage Worker
- Salary: 75,000 FCFA (SMIG)
- Status: Single (1.0 parts)
- Expected Net: ~65,520 FCFA

### Employee B: Mid-Level Manager
- Salary: 500,000 FCFA
- Status: Married + 2 children (2.0 parts)
- Expected Net: ~398,740 FCFA

### Employee C: Executive
- Salary: 2,000,000 FCFA
- Status: Married + 4 children (3.0 parts)
- Expected Net: ~1,496,850 FCFA

**Source:** Test data validated against official payroll software
**Last Updated:** October 2025
```

---

## 7. Review Checklist

### 7.1 Before Publishing Documentation

**Documentation Quality Check:**

- [ ] All formulas include worked examples
- [ ] Country specified for all regulations
- [ ] Effective dates included
- [ ] Source citations provided
- [ ] Terms match official terminology
- [ ] Links to related documents work
- [ ] Code examples are tested
- [ ] No hardcoded values (use constants)
- [ ] Changelog updated
- [ ] Review by subject matter expert

### 7.2 Payroll Documentation Specific

- [ ] Tax brackets verified against official source
- [ ] Calculation bases correctly specified (Brut Imposable vs Salaire Catégoriel)
- [ ] Progressive calculations shown step-by-step
- [ ] Family deductions documented
- [ ] FDFP taxes included
- [ ] Rounding rules applied
- [ ] Employer vs employee costs separated
- [ ] CMU family coverage logic clear
- [ ] Test cases match official examples

### 7.3 Multi-Country Documentation

- [ ] Country code in headers
- [ ] Comparison table if multiple countries
- [ ] Configuration-driven approach documented
- [ ] No Côte d'Ivoire assumptions in generic sections
- [ ] Adding new countries process explained

---

## 8. Automation Opportunities

### 8.1 Documentation Generation

**Generate from configuration:**

```typescript
// Generate tax bracket documentation from database
const generateTaxBracketDocs = async (countryCode: string) => {
  const brackets = await db.query.tax_brackets.findMany({
    where: eq(tax_brackets.country_code, countryCode),
    orderBy: asc(tax_brackets.min_amount),
  });

  const markdown = `
### ITS Tax Brackets (${countryCode})

| Bracket | Min (FCFA) | Max (FCFA) | Rate |
|---------|------------|------------|------|
${brackets.map(b => `| ${b.bracket_number} | ${b.min_amount} | ${b.max_amount} | ${b.rate * 100}% |`).join('\n')}

**Last Updated:** ${new Date().toISOString()}
**Source:** Configuration Database
  `.trim();

  return markdown;
};
```

### 8.2 Link Validation

**Automated link checker:**

```bash
# Run on pre-commit hook
npm run docs:validate

# Checks:
# - All internal links resolve
# - No broken references
# - All code examples have matching files
```

### 8.3 Consistency Validation

**Check for inconsistencies:**

```typescript
// Validate all ITS rate references match configuration
const validateITSRates = () => {
  const configRates = CONFIG.ITS_BRACKETS.map(b => b.rate);
  const docRates = extractRatesFromDocs('**/*.md');

  const mismatches = docRates.filter(r => !configRates.includes(r));

  if (mismatches.length > 0) {
    throw new Error(`Inconsistent ITS rates found: ${mismatches}`);
  }
};
```

---

## 9. Common Mistakes to Avoid

### 9.1 Payroll Documentation Mistakes

| ❌ Mistake | ✅ Correct Approach |
|-----------|-------------------|
| Using 8 ITS brackets | Use 6 brackets (0-32%) |
| Annualizing ITS calculation | Calculate progressively on monthly income |
| Forgetting FDFP taxes | Always include 1.6% employer cost |
| Wrong CNPS family rate (5.75%) | Use 5.0% |
| No family deductions | Apply parts fiscales system |
| Generic "Gross Salary" | Specify "Brut Imposable" or "Salaire Catégoriel" |
| Rounding to 1 FCFA | Round to nearest 10 FCFA |

### 9.2 Documentation Structure Mistakes

| ❌ Mistake | ✅ Correct Approach |
|-----------|-------------------|
| No effective dates | Always include date range |
| Hardcoded values in examples | Use constants and reference config |
| Missing source citations | Cite official regulations |
| Country-specific rules in generic docs | Separate generic and country-specific |
| No changelog | Maintain detailed changelog |

---

## 10. Templates

### 10.1 New Payroll Calculation Document

```markdown
# [Calculation Name] - [Country]

**Country:** [ISO Code]
**Effective Date:** [Date]
**Last Updated:** [Date]
**Source:** [Official Regulation Reference]

---

## Overview

[Brief description of what this calculation does]

## Regulatory Context

[Legal requirement, why this exists]

## Calculation

### Step 1: [Step Name]

**Formula:**
```
[Formula]
```

**Where:**
- [Variable definitions]

**Example:**
[Worked example]

### Step 2: [Step Name]

[...]

## Configuration

**Database Tables:**
- [Table references]

**Constants:**
- [Constant references]

## Edge Cases

[List edge cases]

## Test Cases

[List test scenarios]

## Changelog

### [Date]
- [Change description]
```

### 10.2 Multi-Country Regulation Document

```markdown
# [Regulation Topic] - Multi-Country

**Scope:** [Countries covered]
**Last Updated:** [Date]

---

## Generic Implementation

[Country-agnostic approach]

## Country-Specific Rules

### Côte d'Ivoire (CI)
[CI-specific rules]

### Senegal (SN)
[SN-specific rules]

[...]

## Configuration Mapping

| Feature | Database Table | Configuration Key |
|---------|---------------|-------------------|
| [Feature] | [Table] | [Key] |

## Adding New Countries

1. [Step 1]
2. [Step 2]
[...]
```

---

## 11. Glossary Maintenance

**Maintain central glossary:**

File: `/docs/GLOSSARY.md`

```markdown
# Payroll Glossary

## A

**Abattement** (Tax Deduction)
French term for allowable deductions from taxable income.

## B

**Brut Imposable** (Taxable Gross)
Base salary + taxable allowances + overtime + bonuses.
Used for: ITS, CNPS pension, FDFP.
See: [Calculation Guide](#)

[...]

## Last Updated
October 5, 2025
```

**Link from all docs:**
```markdown
See [Glossary](./GLOSSARY.md) for term definitions.
```

---

## Summary

Following these standards ensures:
- ✅ Consistency across all documentation
- ✅ Accuracy in payroll calculations
- ✅ Easy maintenance and updates
- ✅ Regulatory compliance
- ✅ Multi-country scalability
- ✅ Developer clarity
- ✅ Reduced errors

**Next Steps:**
1. Apply these standards to all existing docs
2. Use templates for new documentation
3. Run validation scripts regularly
4. Update standards as needed

---

**Document Version:** 1.0
**Approved By:** [Pending]
**Next Review:** January 2026
