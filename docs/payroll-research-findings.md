# Payroll Research Findings - Côte d'Ivoire & West Africa
**Date:** October 2025
**Purpose:** Clarify regulatory discrepancies and research multi-country payroll systems

---

## Executive Summary

### Critical Findings

1. **Tax System Discrepancy Resolved:** Côte d'Ivoire uses **6 progressive tax brackets** (not 8) since the 2024 ITS reform
2. **CMU Contribution Clarified:** Employee pays **1,000 FCFA** (not 500); employer pays 50% for family coverage
3. **Family Benefits Rate:** CNPS family allowance is **5%** (not 5.75%) according to official sources
4. **FDFP Training Taxes:** Two taxes at **0.4%** (apprenticeship) and **1.2%** (professional training) - MISSING in current implementation
5. **Family Deductions:** Tax reductions for family charges replace the old "quotient familial" system
6. **Calculation Bases:** Different bases used - "Brut Imposable" vs "Salaire Catégoriel" for different contributions

---

## TASK 1: CÔTE D'IVOIRE REGULATORY CLARIFICATIONS

### Question 1: ITS Tax System

**ANSWER:** **6-bracket progressive system with family deductions**

#### Current Tax System (2024 Reform)
The Ordinance n°2023-719 of September 13, 2023, implemented a tax reform effective January 1, 2024:

**Tax Brackets (Monthly):**
```
Tranche 1:  0 - 75,000 FCFA        → 0%
Tranche 2:  75,001 - 240,000       → 16%
Tranche 3:  240,001 - 800,000      → 21%
Tranche 4:  800,001 - 2,400,000    → 24%
Tranche 5:  2,400,001 - 8,000,000  → 28%
Tranche 6:  8,000,001+             → 32%
```

**Key Reform Changes:**
- Merged three separate taxes (IS + CN + IGR) into single "ITS" levy
- Created zero-rate bracket for salaries < 75,000 FCFA
- Replaced "quotient familial" with **family charge deductions** (réduction d'impôt pour charges de famille)
- Over 90% of employees saw net salary increases

**Family Deductions (Parts Fiscales):**
```
1 part (single, no children):      0 FCFA
1.5 parts:                         5,500 FCFA
2 parts:                           11,000 FCFA
2.5 parts:                         16,500 FCFA
3 parts:                           22,000 FCFA
3.5 parts:                         27,500 FCFA
4 parts:                           33,000 FCFA
4.5 parts:                         38,500 FCFA
5 parts:                           44,000 FCFA
```

**Sources:**
- Direction Générale des Impôts (DGI) - Official tax authority
- Deloitte Legal Blog: "Côte d'Ivoire: Nouveautés 2024"
- Official government treasury announcement (DGTCP)

**OUR IMPLEMENTATION ERROR:**
- ❌ Used 8 brackets with annualized calculation (0-60% rates)
- ❌ Did not implement family deductions
- ✅ Should use 6 brackets with monthly progressive calculation
- ✅ Must add family deduction mechanism

---

### Question 2: CMU Contributions

**ANSWER:** **1,000 FCFA employee + variable employer contribution**

#### CMU Structure (2025)

**Employee Contribution:**
- Fixed: **1,000 FCFA per month** per person

**Employer Contribution:**
- For employee: **500 FCFA** (50% of employee's contribution)
- For spouse (no employment): **500 FCFA** (employer pays 50% of 1,000)
- For children (up to 6, <21 years): **500 FCFA each** (employer pays 50% per child)
- Beyond 6 children: **100% paid by employee**

**Example Calculations:**
```
Single employee, no dependents:
  Employee:  1,000 FCFA
  Employer:    500 FCFA
  Total:     1,500 FCFA

Married with 4 children:
  Employee:  1,000 FCFA (self)
  Employer:    500 FCFA (employee)
             + 500 FCFA (spouse)
             + 2,000 FCFA (4 children × 500)
  = Total:   4,000 FCFA employer contribution

Married with 8 children:
  Employee:  1,000 FCFA (self)
             + 1,000 FCFA (children 7-8)
  = Total:   2,000 FCFA employee

  Employer:    500 FCFA (employee)
             + 500 FCFA (spouse)
             + 3,000 FCFA (children 1-6 × 500)
  = Total:   4,000 FCFA employer
```

**Coverage:**
- 70% reimbursement rate
- Employee pays 30% co-payment ("ticket modérateur")
- Covers 900+ medications and 170+ pathologies

**Sources:**
- CLEISS (Centre des Liaisons Européennes et Internationales de Sécurité Sociale)
- IPS-CNAM official website
- Service Public Côte d'Ivoire

**OUR IMPLEMENTATION ERROR:**
- ✅ Employee contribution correct (1,000 FCFA)
- ❌ Employer base contribution should be 500 FCFA (not 500)
- ❌ Family coverage is 4,500 FCFA additional (not included in our model)
- ✅ Need to track family status in employee records

---

### Question 3: CNPS Contributions

**ANSWER:** **5% family allowance, variable work accident rates, complex calculation bases**

#### CNPS Contribution Rates (2025)

**1. Pension (Retraite)**
- Employee: **6.3%**
- Employer: **7.7%**
- Total: **14%**
- Base: **Brut Imposable** (taxable gross salary)
- Ceiling: **3,375,000 FCFA annually** (45 × SMIG of 75,000)

**2. Family Benefits (Prestations Familiales)**
- Employee: **0%**
- Employer: **5.0%** (includes 0.75% maternity)
- Base: **Salaire Catégoriel** (category salary)
- Ceiling: **70,000 FCFA monthly**

**3. Work Accidents (Accidents du Travail)**
- Employee: **0%**
- Employer: **2-5%** (varies by sector/risk level)
- Base: **Salaire Catégoriel**
- Ceiling: **70,000 FCFA monthly**

**Sector-Specific Work Accident Rates:**
```
Services/Commerce:        2.0%
Manufacturing/Industry:   3.0%
Construction/BTP:         4.0-5.0%
Agriculture:              2.5%
Mining:                   5.0%
```

**Calculation Base Definitions:**

**Brut Imposable (Taxable Gross):**
- Base salary (salaire catégoriel)
- Seniority bonus (prime d'ancienneté)
- Most allowances (housing, meal, etc.)
- Excludes: Transport allowance (< 30,000 FCFA), some benefits

**Salaire Catégoriel (Category Salary):**
- Base salary only according to employee category
- Minimum: SMIG = 75,000 FCFA
- Does NOT include allowances or bonuses
- Used for family benefits and work accident contributions

**Sources:**
- CLEISS official documentation
- CNPS official guides (Guide Employeur)
- eRegulations Côte d'Ivoire

**OUR IMPLEMENTATION ERROR:**
- ✅ Pension rates correct (6.3% / 7.7%)
- ❌ Family allowance should be 5% (not 5.75%)
- ❌ Work accident rate should be variable by sector (not fixed 3%)
- ❌ Must use correct calculation bases (Brut Imposable vs Salaire Catégoriel)
- ❌ Maternity is included in family benefits (not separate)

---

### Question 4: FDFP Training Taxes

**ANSWER:** **Two employer-only taxes at 0.4% and 1.2%**

#### FDFP (Fonds de Développement de la Formation Professionnelle)

**TAP - Taxe d'Apprentissage (Apprenticeship Tax)**
- Rate: **0.40%** of payroll
- Paid by: Employer only
- Base: **Brut Imposable** (taxable gross salary)
- Collected by: FDFP

**TFPC - Taxe de Formation Professionnelle Continue (Continuous Professional Training Tax)**
- Rate: **1.20%** of payroll
- Paid by: Employer only
- Base: **Brut Imposable** (taxable gross salary)
- Collected by: FDFP

**Total Training Taxes: 1.60% of payroll**

**Purpose:**
- Finance apprenticeship programs
- Fund continuous professional training
- Support workforce development

**Mandatory for:**
- All companies employing workers
- Based on total payroll mass

**Sources:**
- FDFP official website (fdfp.ci)
- eRegulations Côte d'Ivoire
- Ministry of Technical Education directives

**OUR IMPLEMENTATION ERROR:**
- ❌ **COMPLETELY MISSING** - We don't calculate FDFP taxes at all
- ❌ Need to add both TAP (0.4%) and TFPC (1.2%) to employer costs
- ❌ This represents significant additional employer cost (1.6% of gross payroll)

---

### Question 5: Sector Variations

**ANSWER:** **Work accident rates vary by industry risk level**

#### Sector-Specific Variations

**Work Accident Insurance Rates by Sector:**

| Sector | Rate | Risk Level |
|--------|------|------------|
| Services/Office | 2.0% | Low |
| Commerce | 2.0% | Low |
| Manufacturing/Industry | 3.0% | Medium |
| Construction/BTP | 4.0-5.0% | High |
| Agriculture | 2.5% | Medium |
| Transportation | 3.5% | Medium-High |
| Mining/Extraction | 5.0% | Very High |
| Chemicals | 4.0% | High |

**Other Sector Considerations:**
- All other CNPS rates (pension, family) are uniform across sectors
- Tax brackets apply equally to all sectors
- CMU contributions are sector-agnostic
- FDFP training taxes are uniform (0.4% + 1.2%)

**Sources:**
- CNPS risk classification documents
- Employer contribution schedules
- Industry-specific guidelines

**OUR IMPLEMENTATION:**
- ❌ Used fixed 2% rate (too simplistic)
- ✅ Should allow configurable rates per sector
- ✅ Need sector classification in company/tenant settings

---

### Question 6: Salary Components

**ANSWER:** **Structured component codes with taxable/non-taxable classifications**

#### Standard Salary Component Codes (Côte d'Ivoire)

**Earnings (Gains):**

| Code | Component | Taxable | Base for CNPS |
|------|-----------|---------|---------------|
| 11 | Salaire catégoriel | Yes | Yes (Category) |
| 12 | Sursalaire | Yes | Yes |
| 21 | Prime d'ancienneté | Yes | Yes |
| 22 | Prime de transport | No* | No |
| 23 | Avantage en nature - Logement | Yes | Yes |
| 24 | Avantage en nature - Véhicule | Yes | Yes |
| 25 | Avantage en nature - Autres | Yes | Yes |
| 31 | Prime de rendement | Yes | Yes |
| 32 | Prime de responsabilité | Yes | Yes |
| 33 | Heures supplémentaires | Yes | Yes |
| 41 | Allocations familiales | No | No |

*Transport allowance exempt up to 30,000 FCFA/month

**Common Allowances:**

**Housing Allowance (Indemnité de logement):**
- Typically 20-30% of base salary
- Fully taxable and subject to CNPS

**Transport Allowance (Prime de transport):**
- Fixed amount (typically 20,000-30,000 FCFA)
- Tax-exempt up to 30,000 FCFA
- Excluded from CNPS base

**Meal Allowance (Prime de panier/nourriture):**
- Variable or fixed
- Fully taxable and subject to CNPS

**Seniority Bonus (Prime d'ancienneté):**
- Calculated as % of base salary
- Formula: 2% per year of service (max 20-25%)
- Fully taxable and subject to CNPS

**Calculation Bases:**

**Total Brut (Total Gross):**
- Sum of ALL salary components (codes 11-41)
- Used for: Total compensation reporting

**Brut Imposable (Taxable Gross):**
- Total Brut - Non-taxable components (code 22 > 30,000, code 41)
- Used for: ITS tax calculation, CNPS pension, FDFP taxes

**Salaire Catégoriel (Category Salary):**
- Base salary only (code 11)
- Minimum: SMIG = 75,000 FCFA
- Used for: CNPS family benefits, work accident insurance

**Rounding Rules:**
- All final amounts rounded to nearest 10 FCFA
- Example: 143,604 → 143,600 FCFA

**Sources:**
- Sample payslips from Côte d'Ivoire employers
- RMO JobCenter payroll documentation
- cotedivoirepaie.ci platform

**OUR IMPLEMENTATION:**
- ✅ Should support flexible component codes
- ❌ Need to track taxable status per component
- ❌ Need to distinguish calculation bases
- ❌ Must implement proper rounding

---

## TASK 2: WEST AFRICAN PAYROLL COMPARISON

### Country 1: Senegal

**Tax System: IRPP (Impôt sur le Revenu des Personnes Physiques)**

**Tax Brackets:**
- Progressive scale up to 43% (maximum rate)
- 30% standard deduction applied before tax calculation

**Social Security Contributions:**

**CSS (Caisse de Sécurité Sociale):**
- Health/Maladie: 6% (ceiling 63,000 FCFA/month)
- TRIMF (Minimum Fiscal Tax): Variable

**IPRES (Institution de Prévoyance Retraite du Sénégal):**
- General retirement: 14%
- Complementary retirement (executives): 6%
- Base ceiling: 432,000 - 1,296,000 FCFA/month

**IPM (Institution de Prévoyance Maladie):**
- Health insurance: 2% to ICAMO
- Covers employee and family
- Pre-financing of healthcare costs

**Minimum Wage (SMIG):**
- 333,808 FCFA gross/hour (40-hour week)
- Since December 1, 2019

**Key Differences from Côte d'Ivoire:**
- Higher tax rates (up to 43%)
- Multiple retirement schemes (general + executive)
- Different health insurance structure (IPM vs CMU)
- Higher minimum wage

---

### Country 2: Burkina Faso

**Tax System: IUTS (Impôt Unique sur les Traitements et Salaires)**

**Tax Brackets:**
- Progressive scale: 1.8% to 27%
- Family dependents provide deductions: 8% to 20% within limits

**Tax Exemptions:**
- Family allowances
- Civil and military pensions
- Housing allowance: 20% up to 50,000 FCFA/month
- Function allowance: 5% up to 30,000 FCFA/month
- Transport allowance: 5% up to 20,000 FCFA/month

**Social Security Contributions:**

**CNSS (Caisse Nationale de Sécurité Sociale):**

Employee:
- Retirement: 5.5% of gross salary

Employer:
- Retirement: 5.5%
- Occupational risks: 3.5%
- Family benefits: 7%
- **Total: 16%**

**Salary Ceiling:**
- 800,000 FCFA/month (updated 2022, previously 600,000)

**Key Differences from Côte d'Ivoire:**
- Lower tax rates (max 27% vs 32%)
- More generous allowance exemptions
- Higher employer social security burden (16% vs ~13%)
- Different contribution ceiling structure

---

### Country 3: Mali

**Tax System: ITS (Impôts sur les Traitements et Salaires)**

**Tax Structure:**
- Progressive tax scale
- Specific rates not detailed in available sources
- Similar to other UEMOA countries

**Social Security Contributions:**

**INPS (Institut National de Prévoyance Sociale):**

For permanent employees:
- Employer: 18.9% - 21.9%
- Employee: 6.66%
- **Total: 25.56% - 28.56%**

For temporary/occasional workers:
- Fixed rate: 26.56%

**AMO (Assurance Maladie Obligatoire):**
- Employer: 3.50%
- Employee: 3.06%
- **Total: 6.56%**

**ANPE Tax (Employment Agency):**
- Employer only: 1%

**Minimum Wage (SMIG):**
- 28,460 FCFA for 40-hour week

**Key Differences from Côte d'Ivoire:**
- Much higher total social security burden (25-28% vs 14-20%)
- Integrated health insurance (AMO) in social security
- Employment agency tax (ANPE)
- Lower minimum wage

---

### Country 4: Benin

**Tax System: IRPP/TS (Impôt sur le Revenu des Personnes Physiques - Traitements et Salaires)**

**Tax Structure:**
- Progressive scale: 0% to 30%
- Calculated on gross taxable salary after social contributions

**Social Security Contributions:**

**CNSS (Caisse Nationale de Sécurité Sociale):**

Employer:
- Family benefits: 9%
- Occupational risks: 1-4% (varies by activity)

Employee:
- Retirement: (rate not specified in sources)

**Minimum Wage (SMIG):**
- 52,000 FCFA for 40-hour week (since January 1, 2023)

**Calculation Base:**
- All remuneration including bonuses, allowances, benefits in kind/cash
- Excluding expense reimbursements and family benefits

**Key Differences from Côte d'Ivoire:**
- Lower maximum tax rate (30% vs 32%)
- Higher family benefits rate (9% vs 5%)
- Variable occupational risk rates (1-4%)
- Different minimum wage

---

### Country 5: Togo

**Tax System: IPTS (Impôt Progressif sur les Traitements et Salaires)**

**Tax Structure:**
- Progressive taxation (specific rates not detailed)
- Similar to UEMOA standards

**Social Security Contributions:**

**CNSS (Caisse Nationale de Sécurité Sociale):**

Total contribution rate: **21.5%**

Employee:
- 4% of salary

Employer:
- 17.5% of salary

**Breakdown by branch:**
- Family benefits and maternity: 3%
- Occupational risks: 2%
- Old-age pensions: 16.5%

**Calculation Base:**
- All remuneration including allowances, bonuses, commissions, benefits in kind
- Excludes expense reimbursements and family benefits
- Must not be below SMIG

**Payment:**
- Due within first 15 days of following month

**Key Differences from Côte d'Ivoire:**
- Higher total social security rate (21.5% vs 14-20%)
- Different breakdown structure
- Fixed occupational risk rate (2%)
- Higher employee contribution (4% vs CNPS 6.3%)

---

### Country 6: Guinea (Conakry)

**Tax System: IGR/RTS (Retenue sur Traitements et Salaires)**

**Tax Structure:**
- New tax code effective January 1, 2022
- New 8% bracket for 3,000,001-5,000,000 GNF
- 15% rate for higher brackets
- Complete revision of domestic taxation

**Social Security Contributions:**

**CNSS (Caisse Nationale de Sécurité Sociale):**

Total rate: **23% of salary**

Breakdown not fully detailed in available sources.

**Key Features:**
- Major tax reform in 2022
- Different currency (Guinean Franc vs CFA Franc)
- Higher social security burden (23%)
- Less harmonized with UEMOA countries

**Key Differences from Côte d'Ivoire:**
- Not UEMOA member (different currency)
- Recent major tax reform (2022)
- Higher social security rates
- Less standardized system

---

## PATTERNS IDENTIFIED ACROSS WEST AFRICA

### Common Elements (Potential for Harmonization)

1. **Tax Structure:**
   - All countries use progressive tax brackets
   - Ranges typically 0% to 25-43%
   - Tax-free threshold for low earners
   - Monthly withholding by employers

2. **Social Security Components:**
   - Pension/retirement (employee + employer)
   - Family benefits (employer only)
   - Work accident/occupational risk (employer only)
   - Health insurance (various structures)

3. **Calculation Methodology:**
   - Gross salary → Deductions → Taxable income → Tax
   - Employer responsible for withholding and payment
   - Monthly declaration and payment cycles

4. **Minimum Wage (SMIG):**
   - All countries have statutory minimum wage
   - Range: 28,460 (Mali) to 333,808 FCFA (Senegal)
   - Regular updates/revisions

### Country-Specific Variations

| Element | Varies By Country |
|---------|-------------------|
| **Tax Rates** | 27% (Burkina) to 43% (Senegal) |
| **Tax Brackets** | Number and thresholds differ |
| **Family Deductions** | Methods and amounts vary |
| **Social Security Rates** | 14-28% total burden |
| **Health Coverage** | CMU, AMO, IPM - different systems |
| **Training Taxes** | FDFP (CI), ANPE (Mali), varies |
| **Calculation Bases** | Different definitions of gross/taxable |
| **Minimum Wage** | 28,460 to 333,808 FCFA |

### Sector-Specific Variations

| Element | Varies By Sector |
|---------|------------------|
| **Work Accident Rates** | 1-5% based on risk level |
| **Risk Classifications** | Services, Industry, Construction, Mining |
| **Calculation Ceilings** | Sometimes sector-specific |

### UEMOA Harmonization

**Harmonized Elements:**
- Currency: CFA Franc (except Guinea)
- VAT and excise taxes
- Corporate income tax (25-30% range)

**Not Yet Harmonized:**
- Personal income tax rates and brackets
- Social security contribution rates
- Health insurance systems
- Training/employment taxes
- Minimum wages

**Convergence Target:**
- Tax pressure rate: 20% of GDP
- Ongoing fiscal coordination efforts

---

## RECOMMENDATIONS FOR OUR IMPLEMENTATION

### Immediate Corrections Needed

1. **Tax Calculation (HIGH PRIORITY)**
   - Change from 8 brackets to 6 brackets
   - Change from annual to monthly progressive calculation
   - Add family deduction mechanism
   - Remove 60% top rate (should be 32%)

2. **CMU Contributions (MEDIUM PRIORITY)**
   - Keep employee at 1,000 FCFA ✓
   - Change employer base from 500 to 500 FCFA ✓
   - Add family coverage calculation (spouse + children)
   - Track family status in employee records

3. **CNPS Family Benefits (HIGH PRIORITY)**
   - Change rate from 5.75% to 5.0%
   - Confirm maternity is included (0.75% within 5%)
   - Ensure using "Salaire Catégoriel" base (not Brut Imposable)

4. **FDFP Training Taxes (CRITICAL - MISSING)**
   - Add TAP: 0.40% of Brut Imposable
   - Add TFPC: 1.20% of Brut Imposable
   - Employer-only contributions
   - Include in total employer cost

5. **Work Accident Rates (MEDIUM PRIORITY)**
   - Change from fixed 3% to variable 2-5%
   - Add sector classification to tenant/company
   - Configure rate by sector

6. **Calculation Bases (HIGH PRIORITY)**
   - Define "Brut Imposable" (for ITS, CNPS pension, FDFP)
   - Define "Salaire Catégoriel" (for family benefits, work accident)
   - Track taxable status per salary component
   - Implement proper base calculations

7. **Rounding (LOW PRIORITY)**
   - Implement rounding to nearest 10 FCFA
   - Apply to final net salary only

### Data Model Changes Required

```typescript
// Add to employee table or related config
interface Employee {
  // ... existing fields
  fiscal_parts: number;           // 1, 1.5, 2, 2.5, etc.
  has_spouse: boolean;
  dependent_children: number;     // For CMU calculation
}

// Add to tenant/company config
interface TenantConfig {
  // ... existing fields
  country_code: string;           // 'CI', 'SN', 'BF', 'ML', etc.
  sector: string;                 // 'services', 'industry', 'construction'
  work_accident_rate: number;     // 2-5% based on sector
}

// Salary component tracking
interface SalaryComponent {
  code: string;                   // '11', '12', '21', '22', etc.
  description: string;
  is_taxable: boolean;
  include_in_brut_imposable: boolean;
  include_in_salaire_categoriel: boolean;
  amount: number;
}
```

### Validation Rules to Add

1. **Tax Calculation:**
   - Fiscal parts must be valid (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
   - Family deduction lookup table
   - Monthly bracket calculation

2. **CMU:**
   - Track number of dependent children
   - Cap at 6 children for employer contribution
   - Additional children paid by employee

3. **CNPS:**
   - Correct ceiling: 3,375,000 annual / 281,250 monthly for pension
   - Correct ceiling: 70,000 monthly for family/accident
   - Use appropriate base for each contribution type

4. **FDFP:**
   - Add to all payroll calculations
   - Use Brut Imposable as base
   - Employer-only contribution

---

## SOURCES CITED

### Official Government Sources
1. **Direction Générale des Impôts (DGI) - Côte d'Ivoire**
   - Tax code and ITS reform documentation
   - Official tax brackets and rates

2. **CNPS (各国)** - National Social Security Agencies
   - Contribution rates and ceilings
   - Employer guides

3. **Service Public** - Government service portals
   - Employee rights and obligations
   - CMU enrollment

### International Organizations
4. **CLEISS** (Centre des Liaisons Européennes et Internationales de Sécurité Sociale)
   - Authoritative source for social security comparisons
   - Country-by-country contribution details

5. **UEMOA** (Union Économique et Monétaire Ouest-Africaine)
   - Fiscal harmonization directives
   - Regional convergence criteria

### Legal and Consulting Firms
6. **Deloitte Legal Blog**
   - Analysis of 2024 tax reform
   - Impact assessments

7. **AfricaPaieRH**
   - Payroll regulations by country
   - Practical implementation guides

### Development Organizations
8. **ILO** (International Labour Organization)
   - Employment conditions reports
   - Regional labor standards

9. **IMF** (International Monetary Fund)
   - Fiscal coordination studies
   - Tax policy recommendations

### Industry Resources
10. **Salary Calculators and Simulation Tools**
    - ci.talent.com, sn.talent.com
    - cotedivoirepaie.ci
    - simulateur.julaya.co

---

## NEXT STEPS

1. **Review Findings** with stakeholders
2. **Update Epic 05-EPIC-PAYROLL.md** with corrections
3. **Design Multi-Country Architecture** (see multi-country-payroll-architecture.md)
4. **Create Migration Plan** for existing calculations
5. **Implement Configuration Schema** (see country-config-schema.ts)
6. **Update Test Cases** to match corrected regulations
7. **Validate with Official Examples** from DGID/CNPS

---

**Document Version:** 1.0
**Last Updated:** October 2025
**Author:** Research Team
**Review Status:** Pending stakeholder review
