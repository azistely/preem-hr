# Compliance Gap Analysis: Côte d'Ivoire Labor Law

**Reference:** Convention Collective Interprofessionnelle 1977
**Analysis Date:** 2025-10-06
**Status:** 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Executive Summary

**Compliance Score:** 🟡 **65% Compliant**

- ✅ **13 features compliant** - Core payroll calculations working
- ⚠️ **7 features partially compliant** - Need enhancements
- ❌ **5 features missing** - Critical legal requirements

**Audit Risk:** 🔴 **HIGH** - Missing mandatory termination workflows and overtime tracking

---

## Compliance Matrix

### 🟢 Fully Compliant (13 features)

| Feature | Legal Requirement | Implementation | Evidence |
|---------|------------------|----------------|----------|
| **SMIG Validation** | Article 11 | ✅ Complete | `payroll-calculation-v2.ts` enforces 75,000 FCFA minimum |
| **Seniority Bonus** | Article 16 | ✅ Complete | Component code 21, auto-calculated 2-12% |
| **Family Allowances** | Article 19 | ✅ Complete | Component code 41, 4,200 FCFA × dependents |
| **Housing Benefits** | Article 20 | ✅ Complete | Component codes 23-25, 20-30% valuation |
| **Meal Benefits** | Article 20 | ✅ Complete | Component code 26, fixed amount |
| **Transport Benefits** | Article 20 | ✅ Complete | Component code 27, tax-exempt up to 30k |
| **Tax Calculation (ITS)** | Tax Code | ✅ Complete | `tax-calculation-v2.ts` with progressive brackets |
| **CNPS Employee** | CNPS Decree | ✅ Complete | `social-security-calculation-v2.ts` 6.3% |
| **CNPS Employer** | CNPS Decree | ✅ Complete | `social-security-calculation-v2.ts` 15.6% |
| **CMU Contribution** | CMU Law | ✅ Complete | 1% employee + 2% employer |
| **FDFP Contribution** | FDFP Law | ✅ Complete | 1.2% employer on gross |
| **Net Salary Calculation** | Labor Code | ✅ Complete | Accurate brut → net conversion |
| **Payslip Generation** | Article 14 | ✅ Complete | French language, all required line items |

---

### 🟡 Partially Compliant (7 features)

| Feature | Legal Requirement | What's Missing | Priority |
|---------|------------------|----------------|----------|
| **Employee Categories** | Article 6 | Need coefficient tracking and validation | P1 |
| **Position Allowances** | Article 18 | Missing pre-configured templates (cashier, hazard, representation) | P1 |
| **Annual Leave** | Article 28 | Missing age-based accrual (under 21) and seniority bonuses | P1 |
| **Special Leave** | Article 28 | Missing marriage, birth, death leave types | P2 |
| **Leave Carryover** | Article 28 | No 6-month carryover limit enforcement | P2 |
| **Contract Management** | Article 4 | Need probation period tracking and validation | P2 |
| **Salary Components** | Multiple | Need smart templates (Phase 4-Alternative) | P1 |

---

### 🔴 Missing / Non-Compliant (5 features)

| Feature | Legal Requirement | Audit Risk | Complexity | Priority |
|---------|------------------|------------|------------|----------|
| **Overtime Calculation** | Article 23 | 🔴 CRITICAL | High | P0 |
| **Termination Workflow** | Articles 35-40 | 🔴 CRITICAL | High | P0 |
| **Severance Calculator** | Article 37 | 🔴 CRITICAL | Medium | P0 |
| **Work Certificate Generation** | Article 40 | 🔴 CRITICAL | Low | P0 |
| **Maternity Leave** | Article 30 | 🟡 MEDIUM | Medium | P1 |

---

## Detailed Gap Analysis

### Gap 1: Overtime Calculation ❌ CRITICAL

**Legal Requirement:** Article 23 mandates specific overtime rates:
- Weekday (41-48h): +15%
- Weekday (48h+): +50%
- Saturday: +50%
- Sunday: +75%
- Public holiday: +100%
- Night work (9pm-5am): +75%

**Current Status:** ❌ **NOT IMPLEMENTED**

**Impact:**
- Cannot pay employees correctly for overtime
- Cannot comply with labor inspections
- Risk of employee lawsuits
- Fines up to 500,000 FCFA per violation

**Solution Required:**
```typescript
// New feature needed
interface OvertimeCalculation {
  regularHours: number;        // Max 40/week
  weekdayOvertime: number;     // 15% or 50%
  saturdayHours: number;       // 50%
  sundayHours: number;         // 75%
  holidayHours: number;        // 100%
  nightHours: number;          // 75%
}

// Integration point
// Component code: 31 (Prime de rendement / Overtime)
// Add to payroll calculation pipeline
```

**Effort:** 3 weeks (timesheet system + calculation engine + UI)

---

### Gap 2: Termination Workflow ❌ CRITICAL

**Legal Requirement:** Articles 35-40 mandate:
- Notice period calculation (8 days to 3 months by category)
- Severance pay calculation (30-40% per year)
- Work certificate generation (within 48 hours)
- Final payslip (within 8 days)
- CNPS attestation (within 15 days)

**Current Status:** ❌ **NOT IMPLEMENTED**

**Impact:**
- Cannot legally terminate employees
- Cannot provide mandatory documents
- Risk of unfair dismissal lawsuits
- Penalties up to 1,000,000 FCFA per case

**Solution Required:**
```typescript
// New module needed
interface Termination {
  employee: Employee;
  terminationDate: Date;
  reason: 'dismissal' | 'resignation' | 'retirement' | 'misconduct';

  // Auto-calculated
  noticePeriod: number;        // Days by category
  noticePayment: number;       // If payment in lieu
  severance: number;           // Tiered calculation
  vacationPayout: number;      // Unused leave

  // Generated documents
  workCertificate: PDF;
  finalPayslip: PDF;
  cnpsAttestation: PDF;
}
```

**Effort:** 3 weeks (workflow + calculator + document generation)

---

### Gap 3: Severance Calculator ❌ CRITICAL

**Legal Requirement:** Article 37 mandates tiered severance:
- Years 1-5: 30% of monthly salary per year
- Years 6-10: 35% of monthly salary per year
- Years 11+: 40% of monthly salary per year

**Current Status:** ❌ **NOT IMPLEMENTED**

**Impact:**
- Cannot calculate terminal payments correctly
- Risk of underpayment (employee lawsuit)
- Risk of overpayment (employer loss)
- Labor inspector fines

**Solution Required:**
```typescript
// New service
export async function calculateSeverance(
  employeeId: string,
  terminationDate: Date
): Promise<{
  yearsOfService: number;
  averageSalary: number;  // Last 12 months
  tier1Amount: number;     // Years 1-5 @ 30%
  tier2Amount: number;     // Years 6-10 @ 35%
  tier3Amount: number;     // Years 11+ @ 40%
  totalSeverance: number;
  taxFreeAmount: number;   // Legal minimum
  taxableAmount: number;   // Excess over minimum
}> {
  // Implementation
}
```

**Effort:** 1 week (calculator + tests + UI)

---

### Gap 4: Work Certificate Generation ❌ CRITICAL

**Legal Requirement:** Article 40 mandates work certificate with:
- Employee identity
- Employment period
- Positions held
- Categories/coefficients
- Reason for leaving
- "Free of all obligations" clause
- Must be provided within 48 hours

**Current Status:** ❌ **NOT IMPLEMENTED**

**Impact:**
- Legal violation (mandatory document)
- Employee cannot claim CNPS benefits
- Cannot apply for new jobs
- Fines: 100,000-500,000 FCFA

**Solution Required:**
```typescript
// New document generator
export async function generateWorkCertificate(
  employeeId: string,
  terminationDate: Date,
  terminationReason: string
): Promise<PDF> {
  // Template in French
  // Required fields from Article 40
  // Digital signature support
}
```

**Effort:** 3 days (template + generator)

---

### Gap 5: Maternity Leave 🟡 MEDIUM PRIORITY

**Legal Requirement:** Article 30 mandates:
- 14 weeks total (8 pre-birth + 6 post-birth)
- 100% salary payment
- CNPS reimbursement
- Job protection
- Cannot be dismissed

**Current Status:** ⚠️ **PARTIAL** (generic leave tracking exists)

**Impact:**
- Cannot handle maternity leave correctly
- Risk of discrimination claims
- CNPS reimbursement issues
- Moderate legal risk

**Solution Required:**
```typescript
// Enhance leave system
interface MaternityLeave {
  type: 'maternity';
  duration: 14 weeks;          // 98 days
  preBirthWeeks: 8;
  postBirthWeeks: 6;
  payment: 100%;               // Full salary
  cnpsReimbursement: true;     // Track separately
  jobProtection: true;         // Cannot dismiss
}
```

**Effort:** 1 week (leave type + CNPS tracking + validation)

---

## Priority-Based Implementation Plan

### 🔥 P0 - CRITICAL (Must implement before production)

**Timeline:** 4 weeks
**Audit Risk:** 🔴 CRITICAL

1. **Week 1:** Severance calculator + Work certificate generator
2. **Week 2-3:** Termination workflow (notice + documents)
3. **Week 4:** Overtime calculation (basic version)

**Deliverables:**
- [ ] Severance calculation service
- [ ] Work certificate PDF generator
- [ ] Final payslip generator
- [ ] CNPS attestation generator
- [ ] Termination wizard UI
- [ ] Basic overtime calculation

---

### ⚡ P1 - HIGH (Next sprint after P0)

**Timeline:** 3 weeks
**Audit Risk:** 🟡 MEDIUM

1. **Week 1:** Employee coefficient system
2. **Week 2:** Enhanced leave management
3. **Week 3:** Position allowance templates

**Deliverables:**
- [ ] Coefficient field + validation
- [ ] Age-based leave accrual (under 21)
- [ ] Seniority leave bonuses (15/20/25 years)
- [ ] Cashier allowance template
- [ ] Hazard pay template
- [ ] Representation allowance template

---

### 📋 P2 - MEDIUM (After P1)

**Timeline:** 2 weeks
**Audit Risk:** 🟢 LOW

1. **Week 1:** Special leave types
2. **Week 2:** Contract management enhancements

**Deliverables:**
- [ ] Marriage leave (4 days)
- [ ] Birth leave (3 days)
- [ ] Death leave (2-5 days)
- [ ] Leave carryover limits
- [ ] Probation tracking

---

## Compliance Validation Checklist

### Before Production Launch

**Legal Requirements:**
- [ ] All P0 features implemented and tested
- [ ] Severance calculator verified against CCI Article 37
- [ ] Work certificate template reviewed by legal counsel
- [ ] Overtime rates match Article 23 exactly
- [ ] Termination workflow follows Articles 35-40

**Audit Readiness:**
- [ ] Sample payslips reviewed by labor expert
- [ ] Termination documents reviewed by legal
- [ ] CNPS contribution calculations verified
- [ ] Tax calculations certified by tax advisor
- [ ] All required documents available in French

**Testing:**
- [ ] End-to-end termination scenario (dismissal)
- [ ] End-to-end termination scenario (resignation)
- [ ] Severance calculation for 1/5/10/15/20+ years
- [ ] Overtime calculation for all rate types
- [ ] Document generation in production-quality

---

## Risk Assessment

### Legal Risks by Gap

| Gap | Violation Type | Fine Range | Lawsuit Risk | Total Risk |
|-----|---------------|------------|--------------|------------|
| **No overtime tracking** | Labor Code violation | 200k-500k FCFA | High | 🔴 CRITICAL |
| **No termination docs** | Mandatory documents | 100k-500k FCFA | High | 🔴 CRITICAL |
| **No severance calc** | Payment violation | Variable | High | 🔴 CRITICAL |
| **No maternity leave** | Discrimination | 500k-1M FCFA | Medium | 🟡 MEDIUM |
| **Missing coefficients** | Classification error | 50k-200k FCFA | Low | 🟡 MEDIUM |

**Total Potential Fines:** 850,000 - 2,700,000 FCFA ($1,400-$4,400 USD)

**Lawsuit Risk:** 🔴 **HIGH** - Missing termination and overtime features create employee litigation exposure

---

## Recommendations

### Immediate Actions (This Week)

1. ✅ **Mark system as "BETA"** - Do NOT use for employee terminations until P0 complete
2. ✅ **Add disclaimer** - "Overtime and termination features under development"
3. ✅ **Communicate to clients** - Set expectations on missing features
4. ✅ **Prioritize P0 development** - 4-week sprint starting immediately

### Medium-Term Actions (Next Month)

1. **Hire legal advisor** - Review all compliance features
2. **Partner with labor expert** - Certify payroll calculations
3. **Conduct mock audit** - Test with sample employee data
4. **Document compliance** - Create audit trail for all calculations

### Long-Term Actions (Ongoing)

1. **Monitor legal changes** - SMIG updates, new decrees
2. **Update templates** - Keep document templates current
3. **Training materials** - Help users understand legal requirements
4. **Compliance dashboard** - Show real-time compliance status

---

## Success Criteria

**System is audit-ready when:**

✅ All P0 features implemented (overtime, termination, severance)
✅ Legal advisor approves all document templates
✅ Sample payslips reviewed by labor expert
✅ End-to-end termination tested successfully
✅ All calculations verified against CCI articles
✅ French translations certified by native speaker
✅ User documentation covers all legal requirements

**Timeline to Full Compliance:** 9 weeks (P0: 4 weeks + P1: 3 weeks + P2: 2 weeks)

---

**Status:** 📋 Gap analysis complete
**Next Step:** Begin P0 implementation (severance + termination + overtime)
**Owner:** Development team + Legal advisor
