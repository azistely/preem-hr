# Compliance Analysis: Convention Collective Interprofessionnelle (Côte d'Ivoire, 1977)

**Document:** Convention Collective Interprofessionnelle de la République de Côte d'Ivoire
**Date:** 1977 (still in force with amendments)
**Scope:** All private sector employers and employees in Côte d'Ivoire
**Status:** 🔴 **MANDATORY COMPLIANCE REQUIRED**

---

## Document Overview

The Convention Collective Interprofessionnelle (CCI) is the **master labor agreement** governing all employment relationships in Côte d'Ivoire's private sector. It establishes:

- Employee classification systems
- Minimum salary scales
- Allowances and benefits
- Working conditions
- Leave entitlements
- Termination procedures
- Social protections

**Legal Status:** This convention has **force of law** and must be displayed in all workplaces.

---

## Key Findings from Document Analysis

### 1. Employee Classification System

**Article 6 - Professional Categories**

The CCI establishes **8 professional categories** (A1 to F):

| Category | Description | Minimum Coefficient | Examples |
|----------|-------------|---------------------|----------|
| **A1** | Manœuvres (Unskilled workers) | 90 | Cleaners, porters, messengers |
| **A2** | Ouvriers spécialisés (Semi-skilled) | 100 | Machine operators, drivers |
| **B1** | Ouvriers qualifiés (Skilled workers) | 120 | Electricians, mechanics, typists |
| **B2** | Ouvriers hautement qualifiés | 140 | Senior technicians, skilled craftsmen |
| **C** | Employés (Clerks/Office workers) | 155 | Accountants, secretaries, cashiers |
| **D** | Agents de maîtrise (Supervisors) | 185 | Team leaders, foremen |
| **E** | Cadres moyens (Middle managers) | 255 | Department heads, senior supervisors |
| **F** | Cadres supérieurs (Senior executives) | 400+ | Directors, senior managers |

**Coefficient System:**
- Each category has a **minimum coefficient**
- Actual salary = Base rate × Coefficient
- Coefficient increases with seniority and merit

**Implementation Impact:**
```typescript
// Current system status: ✅ PARTIALLY COMPLIANT
// We have employee.category field but need to:
// 1. Enforce coefficient minimums
// 2. Add coefficient tracking
// 3. Validate category changes
```

---

### 2. Minimum Salary (SMIG - Salaire Minimum Interprofessionnel Garanti)

**Article 11 - Salary Minimums**

**Current SMIG (2025):** 75,000 FCFA/month (updated by government decree)

**Key Rules:**
1. **Absolute minimum:** No employee can be paid less than SMIG
2. **Category minimums:** SMIG × Category coefficient
3. **Regional variations:** None (unified national minimum)
4. **Probation period:** Same minimum applies (no reduction allowed)

**Calculation:**
```
Minimum Salary = SMIG × (Category Coefficient / 100)

Examples:
- Category A1 (coeff 90): 75,000 × 0.90 = 67,500 FCFA
  → Rounded up to 75,000 FCFA (SMIG floor)
- Category C (coeff 155): 75,000 × 1.55 = 116,250 FCFA
- Category E (coeff 255): 75,000 × 2.55 = 191,250 FCFA
```

**Implementation Impact:**
```typescript
// Current system status: ✅ COMPLIANT
// We validate minimum wage in payroll calculations
// Location: features/payroll/services/payroll-calculation-v2.ts
// Action needed: Add coefficient-based validation
```

---

### 3. Prime d'Ancienneté (Seniority Bonus)

**Article 16 - Seniority Allowance**

**Mandatory Calculation:**

| Years of Service | Rate |
|-----------------|------|
| 0-2 years | 0% |
| 3-5 years | 2% |
| 6-10 years | 4% |
| 11-15 years | 6% |
| 16-20 years | 8% |
| 21-25 years | 10% |
| 26+ years | 12% |

**Calculation Base:** Salaire catégoriel (base salary for category)

**Key Rules:**
1. **Automatic:** Applies automatically when threshold reached
2. **Continuous service:** Counts from hire date (with same employer)
3. **Payslip requirement:** Must appear as separate line item
4. **Taxable:** Subject to income tax and social security contributions
5. **Cap:** Maximum 12% (no progression beyond 26 years)

**Implementation Impact:**
```typescript
// Current system status: ✅ IMPLEMENTED
// Location: features/payroll/services/payroll-calculation-v2.ts
// Component code: 21 (Prime d'ancienneté)
// Formula: calculationRule: { type: 'auto-calculated', rate: 0.02, cap: 0.12 }
```

---

### 4. Indemnités de Fonction (Position Allowances)

**Article 18 - Special Allowances**

**Mandatory Allowances by Category:**

#### 4.1 Prime de Caisse (Cashier Allowance)
- **Who:** Employees handling cash (cashiers, accountants)
- **Amount:** 10-15% of base salary
- **Condition:** Minimum 50% of work time handling money
- **Taxable:** Yes

#### 4.2 Prime de Danger (Hazard Pay)
- **Who:** Workers in dangerous conditions
- **Amount:** 15-25% of base salary
- **Examples:** Chemical handlers, high-voltage electricians
- **Condition:** Certified dangerous work environment
- **Taxable:** Yes

#### 4.3 Prime de Salissure (Dirt/Grime Allowance)
- **Who:** Workers in unsanitary conditions
- **Amount:** 10% of base salary
- **Examples:** Sewage workers, garbage collectors
- **Taxable:** Yes

#### 4.4 Indemnité de Représentation (Representation Allowance)
- **Who:** Category E and F (managers/executives)
- **Amount:** 20-40% of base salary
- **Purpose:** Professional representation expenses
- **Taxable:** Partially (50% exempt)

**Implementation Impact:**
```typescript
// Current system status: ⚠️ PARTIALLY COMPLIANT
// We support custom components but need:
// 1. Pre-configured templates for these mandatory allowances
// 2. Category-based eligibility rules
// 3. Tax treatment rules (especially representation allowance)
```

---

### 5. Avantages en Nature (Benefits in Kind)

**Article 20 - In-Kind Benefits**

**Valuation Rules:**

#### 5.1 Logement (Housing)
- **Employer-provided housing:** 20-30% of base salary
- **Housing allowance (cash):** Market rate or 25% of base salary
- **Tax treatment:** Taxable as salary
- **CNPS:** Included in contribution base

#### 5.2 Nourriture (Meals)
- **Employer canteen:** Free or subsidized
- **Meal allowance:** 10,000-15,000 FCFA/month
- **Valuation if free:** 15% of SMIG
- **Tax treatment:** Taxable

#### 5.3 Véhicule de Fonction (Company Vehicle)
- **Personal use allowed:** 25% of base salary
- **Professional use only:** Not taxable
- **Fuel/maintenance:** Separate calculation
- **Tax treatment:** Taxable if personal use

#### 5.4 Téléphone (Phone)
- **Company phone with personal use:** 5,000-10,000 FCFA/month
- **Professional only:** Not taxable
- **Tax treatment:** Taxable if personal use

**Implementation Impact:**
```typescript
// Current system status: ✅ IMPLEMENTED
// We have benefits in kind support in payroll calculation
// Component codes: 23-27 (Avantages en nature)
// Action needed: Add valuation guidance in UI
```

---

### 6. Heures Supplémentaires (Overtime)

**Article 23 - Overtime Rates**

**Mandatory Rates:**

| Period | Rate | Notes |
|--------|------|-------|
| **Weekday overtime** (after 40h) | +15% | Hours 41-48 |
| **Weekday overtime** (after 48h) | +50% | Beyond 48 hours |
| **Saturday** | +50% | Any Saturday work |
| **Sunday** | +75% | Any Sunday work |
| **Public holiday** | +100% | Double pay |
| **Night work** (9pm-5am) | +75% | In addition to other bonuses |

**Key Rules:**
1. **Normal work week:** 40 hours (8h/day × 5 days)
2. **Maximum:** 48 hours/week (with overtime)
3. **Exceptional:** 60 hours/week (requires labor inspector approval)
4. **Rest period:** Minimum 24 consecutive hours/week (usually Sunday)
5. **Compensatory rest:** Can replace overtime pay if agreed in writing

**Calculation Example:**
```
Base hourly rate: 500 FCFA/hour
Saturday (4 hours): 500 × 4 × 1.50 = 3,000 FCFA
Sunday (4 hours): 500 × 4 × 1.75 = 3,500 FCFA
Public holiday (8 hours): 500 × 8 × 2.00 = 8,000 FCFA
```

**Implementation Impact:**
```typescript
// Current system status: ⚠️ NOT IMPLEMENTED
// Need to add:
// 1. Time tracking system
// 2. Overtime calculation engine
// 3. Different rates for weekday/Saturday/Sunday/holiday
// 4. Integration with payroll
```

---

### 7. Congés Payés (Paid Leave)

**Article 28 - Annual Leave**

**Entitlement Calculation:**

| Service Period | Days/Month | Annual Total |
|----------------|-----------|--------------|
| **Standard** | 2 days/month | 24 days/year |
| **Under 21 years old** | 2.5 days/month | 30 days/year |
| **After 15 years service** | +2 days | 26 days/year |
| **After 20 years service** | +4 days | 28 days/year |
| **After 25 years service** | +6 days | 30 days/year |

**Key Rules:**
1. **Accrual:** Earned monthly (pro-rata)
2. **Reference period:** June 1st to May 31st
3. **Carryover:** Maximum 6 months (must use or lose)
4. **Payment:** Full salary during leave
5. **Termination:** Unused leave must be paid out
6. **Minimum continuous:** 12 days minimum continuous leave

**Special Leave (Congés Exceptionnels):**

| Event | Days | Paid? |
|-------|------|-------|
| **Marriage** (employee) | 4 days | Yes |
| **Marriage** (child) | 2 days | Yes |
| **Birth of child** | 3 days | Yes |
| **Death of spouse/child** | 5 days | Yes |
| **Death of parent** | 3 days | Yes |
| **Death of sibling** | 2 days | Yes |
| **Moving house** | 2 days | Yes |

**Implementation Impact:**
```typescript
// Current system status: ⚠️ PARTIALLY IMPLEMENTED
// We have leave tracking but need:
// 1. Age-based accrual rates (under 21)
// 2. Seniority-based bonus days (15/20/25 years)
// 3. Special leave types (marriage, birth, death)
// 4. Leave carryover rules (6-month max)
// 5. Leave balance validation
```

---

### 8. Congé de Maternité (Maternity Leave)

**Article 30 - Maternity Protection**

**Entitlement:**
- **Total duration:** 14 weeks
- **Pre-birth:** 8 weeks (can work until 6 weeks before if medical approval)
- **Post-birth:** 6 weeks minimum
- **Twins/complications:** +2 weeks
- **Payment:** 100% of salary (CNPS reimburses employer)

**Key Rules:**
1. **Medical certificate:** Required to confirm pregnancy
2. **Notice period:** Must inform employer 3 months before due date
3. **Job protection:** Cannot be dismissed during pregnancy or leave
4. **Return rights:** Same position or equivalent
5. **Nursing breaks:** 1 hour/day for 12 months after return (paid)

**Implementation Impact:**
```typescript
// Current system status: ⚠️ NOT IMPLEMENTED
// Need to add:
// 1. Maternity leave type
// 2. 14-week duration (with medical extension)
// 3. Full salary payment
// 4. CNPS reimbursement tracking
// 5. Job protection validation
```

---

### 9. Préavis (Notice Period)

**Article 35 - Termination Notice**

**Notice Periods by Category:**

| Category | Notice Period | Worked or Paid |
|----------|---------------|----------------|
| **A1-A2** | 8 days | Must be worked |
| **B1-B2** | 15 days | Must be worked |
| **C** | 1 month | Must be worked |
| **D** | 2 months | Must be worked |
| **E-F** | 3 months | Must be worked or paid |

**Key Rules:**
1. **Gross misconduct:** No notice required (immediate termination)
2. **Employee resignation:** Same notice periods apply
3. **During probation:** 8 days notice for all categories
4. **Notice period calculation:** Calendar days, not working days
5. **Payment in lieu:** Allowed for categories E-F only
6. **Job search time:** 2 days/week during notice (paid, for employee terminations)

**Implementation Impact:**
```typescript
// Current system status: ⚠️ NOT IMPLEMENTED
// Need to add:
// 1. Termination workflow
// 2. Notice period calculation by category
// 3. Job search time tracking
// 4. Notice payment calculation
// 5. Payslip integration
```

---

### 10. Indemnité de Licenciement (Severance Pay)

**Article 37 - Severance Calculation**

**Mandatory Severance:**

| Years of Service | Rate (per year) | Calculation Base |
|-----------------|----------------|------------------|
| **1-5 years** | 30% of monthly salary | Average last 12 months |
| **6-10 years** | 35% of monthly salary | Average last 12 months |
| **11+ years** | 40% of monthly salary | Average last 12 months |

**Calculation Example:**
```
Employee: 8 years of service
Average salary (last 12 months): 300,000 FCFA/month

Calculation:
- First 5 years: 5 × (300,000 × 0.30) = 450,000 FCFA
- Years 6-8: 3 × (300,000 × 0.35) = 315,000 FCFA
Total severance: 765,000 FCFA
```

**Exemptions (No Severance):**
1. ❌ Gross misconduct (faute lourde)
2. ❌ Employee resignation
3. ❌ Retirement (normal age)
4. ❌ End of fixed-term contract
5. ❌ During probation period

**Tax Treatment:**
- ✅ **Tax-free** up to legal minimum
- ⚠️ **Taxable** if exceeds legal minimum

**Implementation Impact:**
```typescript
// Current system status: ⚠️ NOT IMPLEMENTED
// Need to add:
// 1. Severance calculator
// 2. Average salary calculation (last 12 months)
// 3. Tiered rate calculation (30%/35%/40%)
// 4. Exemption rules (misconduct, resignation, etc.)
// 5. Tax treatment differentiation
```

---

### 11. Certificat de Travail (Work Certificate)

**Article 40 - Employment Documents**

**Mandatory Documents at Termination:**

#### 11.1 Certificat de Travail (Work Certificate)
**Required content:**
- Employee name and date of birth
- Hire date and termination date
- Position(s) held
- Categories/coefficients
- Reason for leaving (if dismissal)
- "Free of all obligations" clause

**Timeline:** Must be provided within **48 hours** of termination

#### 11.2 Bulletin de Paie Final (Final Payslip)
**Must include:**
- Last month's salary
- Prorated vacation pay (congés payés)
- Notice period payment
- Severance pay (if applicable)
- All outstanding allowances

**Timeline:** Must be paid within **8 days** of termination

#### 11.3 Attestation CNPS (Social Security Certificate)
**Purpose:** For CNPS benefits claim
**Content:** Total contributions paid, periods covered
**Timeline:** Within **15 days** of termination

**Implementation Impact:**
```typescript
// Current system status: ⚠️ NOT IMPLEMENTED
// Need to add:
// 1. Document generation system
// 2. Work certificate template (French)
// 3. Final payslip with all terminal payments
// 4. CNPS attestation generator
// 5. Deadline tracking and alerts
```

---

## Summary of Compliance Gaps

### 🔴 Critical Gaps (Must Implement)

| Feature | Current Status | Priority | Complexity |
|---------|---------------|----------|------------|
| **Coefficient-based salary validation** | ⚠️ Partial | P0 | Low |
| **Overtime calculation** | ❌ Missing | P0 | High |
| **Severance calculator** | ❌ Missing | P0 | Medium |
| **Notice period calculation** | ❌ Missing | P0 | Medium |
| **Maternity leave** | ❌ Missing | P1 | Medium |
| **Termination documents** | ❌ Missing | P1 | Medium |
| **Special leave types** | ⚠️ Partial | P1 | Low |

### ✅ Compliant Features

| Feature | Status | Location |
|---------|--------|----------|
| **Seniority bonus** | ✅ Implemented | `payroll-calculation-v2.ts:21` |
| **SMIG validation** | ✅ Implemented | `payroll-calculation-v2.ts` |
| **Benefits in kind** | ✅ Implemented | Component codes 23-27 |
| **Family allowances** | ✅ Implemented | Component code 41 |
| **Tax calculation** | ✅ Implemented | `tax-calculation-v2.ts` |
| **CNPS calculation** | ✅ Implemented | `social-security-calculation-v2.ts` |

---

## Implementation Roadmap

### Phase 1: Employee Classification Enhancement (1 week)
- [ ] Add `coefficient` field to employee schema
- [ ] Implement category-coefficient validation
- [ ] Update salary validation to check category minimums
- [ ] Add coefficient display in employee profile

### Phase 2: Overtime System (3 weeks)
- [ ] Design time tracking data model
- [ ] Implement overtime calculation engine
- [ ] Add different rates (weekday/Saturday/Sunday/holiday)
- [ ] Create timesheet UI
- [ ] Integrate with payroll

### Phase 3: Leave Management Enhancement (2 weeks)
- [ ] Add age-based accrual rules (under 21)
- [ ] Implement seniority-based bonus days
- [ ] Add special leave types (marriage, birth, death)
- [ ] Implement carryover rules (6-month max)
- [ ] Add leave balance validation

### Phase 4: Maternity Leave (1 week)
- [ ] Add maternity leave type
- [ ] Implement 14-week duration (with extensions)
- [ ] Add CNPS reimbursement tracking
- [ ] Add job protection validation
- [ ] Create maternity leave request workflow

### Phase 5: Termination Workflow (3 weeks)
- [ ] Design termination data model
- [ ] Implement notice period calculator
- [ ] Implement severance calculator
- [ ] Create termination wizard
- [ ] Generate work certificate
- [ ] Generate final payslip
- [ ] Generate CNPS attestation

### Phase 6: Position Allowances Templates (1 week)
- [ ] Pre-configure cashier allowance template
- [ ] Pre-configure hazard pay template
- [ ] Pre-configure representation allowance template
- [ ] Add category-based eligibility validation
- [ ] Implement tax treatment rules

**Total Estimated Effort:** 11 weeks

---

## Legal References

**Primary Source:**
- Convention Collective Interprofessionnelle de la République de Côte d'Ivoire (1977)

**Related Legislation:**
- Code du Travail de Côte d'Ivoire (Labor Code)
- CNPS Decree (Social Security)
- Tax Code (Code Général des Impôts)

**Updates:**
- SMIG updated annually by government decree
- Some provisions amended by sectoral agreements
- Check Ministry of Labor website for latest decrees

---

**Status:** 📋 Compliance analysis complete
**Next Step:** Prioritize implementation based on client audit requirements
**Owner:** Development team + Legal/HR advisor
