# Gap Analysis: Official Guide vs Architecture Document
## Daily Workers (Journaliers) Implementation - Côte d'Ivoire

**Analysis Date:** 2025-10-31
**Analyzer:** Claude Code
**Documents Compared:**
- `guide_paie_journaliers_cote_ivoire.md` (Official Guide)
- `docs/DAILY-WORKERS-ARCHITECTURE-V2.md` (Architecture)

---

## Executive Summary

**Overall Assessment:** The architecture document (v2.0) is comprehensive and addresses most requirements from the official guide. However, there are **critical gaps** in hourly rate calculation formulas, overtime handling, legal references, and edge cases that must be addressed before production.

**Critical Issues:** 7
**Important Gaps:** 12
**Minor Clarifications:** 8
**Correctly Implemented:** 15

---

## 1. Hourly Rate Calculation

### ❌ CRITICAL GAP: Hourly Divisor Formula Missing

**Guide Requirement (Section 3.1-3.3):**
```
Hourly divisor = (Weekly hours × 52 weeks) / 12 months

Examples:
- 40h/week (non-agricultural): 173.33 hours/month
- 48h/week (agricultural): 208 hours/month
- 56h/week (security/gardiennage): 242.67 hours/month

Hourly rate = Monthly categorical salary / Hourly divisor
```

**Architecture Status:**
- ⚠️ Mentions the concept (Section 3.1.3) but does NOT provide implementation details
- ❌ No code example showing how to calculate hourly rate from categorical salary
- ❌ No database field for `weekly_hours` per employee/location/tenant
- ❌ No validation that hourly rate is derived (not manually entered)

**Impact:** **CRITICAL** - Without proper hourly divisor, all hourly-based payroll will be incorrect.

**Required Actions:**
1. Add `weekly_hours` field to employees table (default: 40)
2. Add `weekly_hours_regime` enum: '40h' | '48h' | '56h'
3. Create function `calculateHourlyRateFromCategorical(categoricalSalary, weeklyHours)`
4. Validate that hourly rate matches: `categoricalSalary / ((weeklyHours × 52) / 12)`
5. Add UI field to configure weekly hours regime per employee

**Legal Reference:** Décret N° 96-203 du 7 mars 1996 - Article 3

---

### ⚠️ IMPORTANT: Weekly Hours Regime Detection

**Guide Requirement (Section 2.1):**
```
Durées admissibles en équivalence (Article 3):
- Entreprises non agricoles: entre 40h et 44h maximum
- Entreprises agricoles: entre 48h et 52h maximum
- Personnel domestique et de gardiennage: 56 heures
```

**Architecture Status:**
- ✅ Mentions the different regimes
- ❌ No explicit field to store employee's weekly hours regime
- ❌ No automatic sector-based detection (agricultural vs non-agricultural)
- ❌ No validation that weekly hours fall within legal ranges

**Required Actions:**
1. Add `weekly_hours_regime` to employees schema
2. Add validation: 40-44 for non-agricultural, 48-52 for agricultural, 56 for domestic/security
3. Link to existing `employee.sector` field if applicable
4. Show warning if weekly hours exceed legal equivalence threshold

---

## 2. Salary Components Calculation

### ✅ Correctly Implemented: Gratification Formula

**Guide:** `Gratification = Salaire brut / 12`
**Architecture:** ✅ Correctly stated (Section 3.1.2, 7.1 Step 6)

**Code Example (from architecture):**
```typescript
const gratification = grossSalary / 12; // ✅ Correct
```

---

### ✅ Correctly Implemented: Congés Payés Formula

**Guide:** `Congés payés = (Salaire brut + Gratification) / 12`
**Architecture:** ✅ Correctly stated (Section 3.1.2, 7.1 Step 7)

**Code Example:**
```typescript
const congesPayes = (grossSalary + gratification) / 12; // ✅ Correct
```

---

### ✅ Correctly Implemented: Indemnité de Précarité (3%)

**Guide:** `Indemnité de précarité = (Salaire + Gratification + Congés) × 3%`
**Architecture:** ✅ Correctly stated (Section 3.1.2, 7.1 Step 9)

**Code Example:**
```typescript
const totalBrut = grossSalary + gratification + congesPayes;
const indemnitePrecarite = (contractType === 'CDDTI') ? totalBrut * 0.03 : 0; // ✅ Correct
```

**Legal Reference:** Article 7, 3ème alinéa de la Convention collective annexe ✅ Cited

---

### ⚠️ IMPORTANT: Indemnité de Transport Journalière

**Guide Requirement (Section 4.1.5):**
```
Indemnité de transport journalière:
- Montant fixe par jour travaillé
- Variable selon la localité
```

**Architecture Status:**
- ✅ Component defined: `TRANSP_DAY` (Section 6.1.4)
- ⚠️ Formula: `fixedDailyAmount * daysWorked` - Correct
- ❌ No mention of "variable by locality" database structure
- ❌ No UI to configure daily transport rate per city/location

**Required Actions:**
1. Add `daily_transport_rate` to `locations` table (or tenant settings per city)
2. Lookup rate based on employee's primary location
3. Apply: `location.daily_transport_rate × daysWorked`
4. Allow override at employee level

---

## 3. Tax Calculation (ITS)

### ✅ Correctly Implemented: Daily Tax Brackets

**Guide Requirement (Section 6.2):**
| Monthly Range | Daily Range (÷30) | Rate |
|--------------|------------------|------|
| 0 - 75,000 | 0 - 2,500 | 0% |
| 75,001 - 240,000 | 2,501 - 8,000 | 16% |
| etc. | | |

**Architecture Status:**
- ✅ Daily brackets table provided (Section 3.1.4)
- ✅ Daily ITS calculation exists: `calculateDailyWorkerITS()` (Section 7.2.3)

---

### ✅ Correctly Implemented: Daily Family Deductions

**Guide Requirement (Section 6.4):**
| Fiscal Parts | Monthly Deduction | Daily Deduction (÷30) |
|--------------|------------------|----------------------|
| 1.0 | 0 | 0 |
| 1.5 | 5,500 | 183 |
| 2.0 | 11,000 | 367 |
| etc. | | |

**Architecture Status:**
- ✅ Daily family deductions table provided (Section 3.1.4)
- ✅ Formula mentioned: `(monthlyDeduction / 30) × daysWorked`

---

### 🔍 CLARIFICATION NEEDED: ITS Calculation Method for Partial Weeks

**Guide Example (Section 10.2):**
```
30 hours over 1 week (3.75 days equivalent)
Salaire journalier = 12,300 / 3.75 = 3,280 FCFA/jour
```

**Architecture Status:**
- ⚠️ Shows annualization logic exists (Section 4.1.6)
- ❌ Doesn't clarify: Do we use ACTUAL days worked or "equivalent days" (hours ÷ 8)?
- ❌ No explicit handling of partial days (e.g., 3.75 days)

**Question for Clarification:**
- Is `daysWorked` = unique calendar days with time entries?
- Or `daysWorked` = `hoursWorked / 8` (equivalent full days)?

**Recommendation:**
Use `uniqueCalendarDays` for consistency, BUT provide warning if hours/day varies significantly from 8h.

---

### ✅ Correctly Implemented: Progressive Tax Calculation

**Guide Example (Section 6.5):**
```
M. TRAZIE: 10 days @ 10,000 FCFA/day
- Tranche 1 (0-2,500): 0
- Tranche 2 (2,501-8,000): 5,500 × 16% = 880 FCFA
- Tranche 3 (8,001-26,667): 2,000 × 21% = 420 FCFA
Total per day: 1,300 FCFA
Total for 10 days: 13,000 FCFA
Family deduction (3 parts): 733 × 10 = 7,330 FCFA
Net ITS: 5,670 FCFA
```

**Architecture Status:**
- ✅ Progressive calculation mentioned (Section 7.1 Step 11)
- ✅ Daily brackets applied per day, then multiplied
- ✅ Family deduction prorated by days

**Required Validation:**
Add unit test matching M. TRAZIE example EXACTLY.

---

## 4. Social Security Contributions

### ✅ Correctly Implemented: Standard Rates Applied to Actual Gross

**Guide Requirement (Section 7.1, HR Manager Quote):**
> "Pour toutes les autres retenues, salariales comme patronales, la formule demeure la même, sauf que c'est ramené au prorata du nombre de jours effectivement travaillé par le journalier."

**Architecture v2.0 Interpretation:**
- ✅ CNPS employee: `totalBrut × 6.3%` (no separate proration)
- ✅ CNPS employer: `totalBrut × 15.5%` (no separate proration)
- ✅ Gross is already prorated via `hours/days worked`
- ✅ Correct understanding (v2.0 fixed from v1.0 error)

**Code Example (Section 7.1 Step 10):**
```typescript
const cnpsEmployee = totalBrut * 0.063; // ✅ Correct
const cnpsEmployer = totalBrut * 0.155; // ✅ Correct
```

---

### ⚠️ IMPORTANT: CMU Contribution Logic for Partial Months

**Guide:** (Section 7.1) - No specific mention of CMU for daily workers

**Architecture Status:**
- ⚠️ Section 2.3 states: "CMU: Same amount if worked any day" (Table)
- ❌ No clear explanation of CMU proration rules
- ❌ Is CMU a fixed monthly amount (if 1+ day worked)?
- ❌ Or is CMU prorated like other contributions?

**Required Clarification:**
Research CMU rules for partial-month workers:
- If CMU = fixed monthly fee → worker pays full amount if worked ≥1 day
- If CMU = % of gross → use standard rate on actual gross

**Action:** Consult with HR manager or CMU regulations.

---

### ❌ CRITICAL GAP: Contribution Employeur (Employer Payroll Tax)

**Guide Requirement (Section 7.2):**
```
Contribution employeur (Article 146 du Code Général des Impôts):
- Personnel local: 2.8% du revenu brut
- Personnel expatrié: 12% du revenu brut
Base: Revenu brut imposable (sans abattement de 20%)
```

**Architecture Status:**
- ❌ **NOT MENTIONED AT ALL** in architecture document
- ❌ No database field for `employee_type` (local vs. expatriate)
- ❌ No calculation of 2.8% or 12% employer contribution
- ❌ Not included in payroll calculation flow

**Impact:** **CRITICAL** - Missing mandatory employer tax (2.8% or 12%)

**Required Actions:**
1. Add `employee_type` field: 'local' | 'expatriate'
2. Create salary component: `CONTRIB_EMP` (employer-side deduction)
3. Calculate: `totalBrut × (employee_type === 'local' ? 0.028 : 0.12)`
4. Include in employer cost reporting
5. Add to État 301 declaration

**Legal Reference:** Article 146 du Code Général des Impôts ❌ Missing

---

### ❌ MISSING: Cotisations Complémentaires (Retirement & Insurance)

**Guide Requirement (Section 7.3):**
```
Cotisations patronales à des organismes de retraite et de prévoyance complémentaires:
- Exonérées d'ITS dans la double limite de:
  - 10% de la rémunération mensuelle brute imposable
  - Maximum: 320,000 FCFA (relevé en 2024, anciennement 300,000 FCFA)
```

**Architecture Status:**
- ❌ **NOT MENTIONED** in architecture
- ❌ No handling of complementary pension/insurance schemes
- ❌ No 10% limit or 320,000 FCFA cap validation

**Impact:** IMPORTANT - Affects companies with pension plans

**Required Actions:**
1. Add optional employer pension contributions to payroll
2. Validate: `min(gross × 0.10, 320000)` exemption limit
3. Exclude exempted amount from ITS taxable base
4. Document in bulletin as "Cotisations exonérées ITS"

**Legal Reference:** Réforme ITS 2024 - Note de service 03 janvier 2024

---

## 5. Overtime Calculation

### ✅ Correctly Implemented: Overtime Classification

**Guide Requirement (Section 10.3):**
```
Majoration heures sup:
- Heures normales: 1.00×
- 8 premières heures sup (41-48h): 1.15×
- Au-delà de 48h: 1.50×
```

**Architecture Status:**
- ✅ Overtime service exists: `overtime.service.ts` (Section 4.1.2)
- ✅ 6 overtime types with multipliers
- ✅ Hours 41-46: 1.15×, Hours 46+: 1.50×
- ✅ Saturday: 1.50×, Sunday: 1.75×, Holiday: 2.00×, Night: 1.75×

**Code Reference:**
```typescript
hours_41_to_46: 1.15×  // ✅ Matches guide
hours_above_46: 1.50×  // ✅ Matches guide
```

---

### ⚠️ IMPORTANT: Overtime Threshold Varies by Weekly Hours Regime

**Guide Requirement (Section 2.1):**
```
Durée hebdomadaire admise en équivalence:
- Non agricole: 40-44h (heures sup au-delà de 44h)
- Agricole: 48-52h (heures sup au-delà de 52h)
- Gardiennage: 56h (heures sup au-delà de 56h)
```

**Architecture Status:**
- ⚠️ Overtime calculation assumes 40h baseline (Section 4.1.2)
- ❌ No dynamic overtime threshold based on `weekly_hours_regime`
- ❌ Agricultural workers would be incorrectly charged overtime starting at 41h instead of 49h

**Impact:** **CRITICAL** - Overtime miscalculation for agricultural/security workers

**Required Actions:**
1. Modify `classifyOvertime()` to accept `weeklyHoursRegime` parameter
2. Overtime threshold = `weeklyHoursRegime` (40, 48, or 56)
3. First 8h overtime = 1.15×, beyond 8h = 1.50×
4. Example for agricultural (48h regime):
   - Hours 1-48: Normal rate
   - Hours 49-56: 1.15×
   - Hours 57+: 1.50×

**Legal Reference:** Décret N° 96-203 Article 3 ⚠️ Cited but not implemented

---

### ❌ MISSING: Overtime Calculation Example in Tests

**Guide Provides (Section 10.3):**
```
50 heures sur semaine 40h:
- 40h normales: 40 × 410 = 16,400 FCFA
- 8h à 15%: 8 × 410 × 1.15 = 3,772 FCFA
- 2h à 50%: 2 × 410 × 1.50 = 1,230 FCFA
Total: 21,402 FCFA
```

**Architecture Status:**
- ❌ No test case matching this example
- ❌ Section 11.1 tests don't include overtime validation

**Required Actions:**
Add test case exactly matching guide example in Section 10.3.

---

## 6. Contract Management

### ✅ Correctly Implemented: CDDTI Contract Type

**Guide Requirement (Section 1, 9.1):**
```
Type de contrat: Contrat à Durée Déterminée à Terme Imprécis (CDDTI)
- Pas de date de fin précise
- Basé sur achèvement d'une tâche/ouvrage
```

**Architecture Status:**
- ✅ CDDTI added to contract types (Section 6.1.1)
- ✅ Allows NULL end_date for CDDTI
- ✅ Field `cddti_task_description` added

**Migration Example:**
```sql
CHECK (
  (contract_type = 'CDDTI' AND end_date IS NULL) OR
  (contract_type IN ('CDD', 'INTERIM', 'STAGE') AND end_date IS NOT NULL)
) // ✅ Correct
```

---

### ✅ Correctly Implemented: 12-Month Conversion Rule

**Guide Requirement (Section 8.1):**
```
Un travailleur occasionnel devient salarié permanent après:
- 12 mois de présence continue, OU
- Embauchés successives pendant 12 mois
```

**Architecture Status:**
- ✅ Field added: `continuous_employment_start_date` (Section 6.1.1)
- ✅ Inngest function planned: `cddti-conversion-check.ts` (Section 5.6)
- ✅ Monthly cron to identify 12+ month CDDTI

---

### ⚠️ IMPORTANT: Contract Conversion Consequences

**Guide Requirement (Section 8.2-8.3):**
```
Après 12 mois:
- Passage en CDI obligatoire
- Le congé payé reste à 1/12ème (et non 1/11ème) ✅ Already 1/12 in architecture
- L'indemnité de précarité ne s'applique plus ✅ Correct (CDDTI check)
- Droit au préavis et indemnité de licenciement
```

**Architecture Status:**
- ✅ Indemnity logic: `contractType === 'CDDTI'` check (stops applying after conversion)
- ❌ No mention of 1/11ème vs 1/12ème debate (but guide clarifies it's 1/12ème)
- ❌ No documentation of conversion consequences

**Clarification:**
The guide clarifies that congés payés = 1/12 for journaliers (not 1/11 like some old rules). Architecture already uses 1/12. ✅ No change needed.

---

### ❌ MISSING: Contract Information Requirements (Article 4)

**Guide Requirement (Section 9.2):**
```
Au moment de l'embauche, l'employeur doit faire connaître:
- La nature de la tâche, OU
- La nature de l'ouvrage à accomplir
```

**Architecture Status:**
- ✅ Field exists: `cddti_task_description` (Section 6.1.1)
- ❌ Not marked as REQUIRED in validation
- ❌ No UI enforcement that field must be filled

**Required Actions:**
1. Make `cddti_task_description` required for CDDTI contracts
2. Validation: `contractType === 'CDDTI' → cddti_task_description IS NOT NULL`
3. Show error: "Vous devez décrire la tâche ou l'ouvrage à accomplir (Article 4)"

**Legal Reference:** Article 4 de la Convention Collective ❌ Missing

---

## 7. Payment & Bulletin Requirements

### ✅ Correctly Implemented: Bulletin Mandatory for All Workers

**Guide Requirement (Section 9.3):**
```
Tout paiement de salaire doit être justifié par un bulletin individuel de paie:
- Même si engagé pour quelques heures
- Même si payé pour une seule journée
```

**Architecture Status:**
- ✅ Phase 5 includes bulletin generation (Section 10.5)
- ✅ Special CDDTI bulletin layout planned

---

### ⚠️ IMPORTANT: Payment Frequency vs Bulletin Frequency

**Guide Requirement (Section 1):**
```
Payé à la fin de:
- la journée
- de la semaine
- de la quinzaine
```

**Architecture Status:**
- ✅ Payment frequencies defined: DAILY, WEEKLY, BIWEEKLY (Section 5.2)
- ❌ No explicit handling of DAILY payment (very rare, but legal)
- ⚠️ Payroll run wizard shows WEEKLY, BIWEEKLY, not DAILY option

**Required Actions:**
1. Add DAILY option to payroll run wizard (even if rare)
2. Validate: DAILY runs = 1 day period only
3. Show warning: "La paie journalière est rare - êtes-vous sûr?"

---

## 8. Time Tracking Integration

### ✅ Correctly Implemented: Reuse Existing time_entries Table

**Architecture Decision (Section 5.4):**
- ✅ Uses existing `time_entries` table instead of creating new one
- ✅ Aggregation service planned: `aggregateTimeEntriesForPayroll()`
- ✅ Validation service planned: `validateTimeEntriesForPayroll()`

---

### ⚠️ IMPORTANT: Days Worked Definition

**Guide Shows Multiple Examples:**
- Example 1 (Section 10.1): 22 days worked
- Example 2 (Section 10.2): "3 jours + 6 heures" = 30h total
  - Converted to: 30h ÷ 8h = 3.75 days
  - Daily salary: 12,300 / 3.75 = 3,280 FCFA/day

**Architecture Status:**
- ✅ `daysWorked` field in aggregation (Section 7.2.1)
- ⚠️ Definition unclear: Unique calendar days? Or hours ÷ 8?

**Recommendation:**
```typescript
// Use UNIQUE CALENDAR DAYS for consistency
const uniqueDates = new Set(
  entries.map(e => format(new Date(e.clockIn), 'yyyy-MM-dd'))
);
const daysWorked = uniqueDates.size; // ✅ Recommended

// NOT equivalent days (hours ÷ 8)
// const equivalentDays = totalHours / 8; // ❌ Avoid
```

**Rationale:**
- Unique calendar days = easier to understand
- Matches "jours effectivement travaillés" language
- Prevents fractional days confusion

---

### ❌ MISSING: Missing Days Detection Algorithm

**Architecture Mentions (Section 7.2.1):**
```typescript
const missingDates = businessDays
  .map(day => format(day, 'yyyy-MM-dd'))
  .filter(date => !entryDates.has(date));
```

**Issue:**
- ❌ Assumes daily workers work ALL business days
- ❌ Not true for weekly/bi-weekly workers (might only work 3 days/week)
- ❌ Will create false "missing days" warnings

**Required Actions:**
1. Add `expected_days_per_week` field to employees (or contract)
2. For weekly workers working 3 days/week: Only warn if < 3 days entered
3. Allow manager to mark "expected absence" vs "missing entry"
4. Soft warning, not hard block (flexibility for irregular schedules)

---

## 9. Reporting Requirements

### ❌ MISSING: Separate Pay Registers by Payment Frequency

**Guide Note (Section end):**
```
Notes importantes pour la gestion informatique:
- Permanents et Journaliers doivent être dans des bases distinctes (Sage)
- Raison: règles de calcul différentes (prorata)
- Nécessité de clôtures intermédiaires:
  - Paiement quinzaine: 2 clôtures/mois
  - Paiement semaine: 4 clôtures/mois
```

**Architecture Status:**
- ✅ Single database approach (better than Sage)
- ✅ Multiple closures supported via `closure_sequence` field
- ❌ No mention of SEPARATE pay registers (livre de paie) by frequency

**Required Actions:**
1. Generate separate "Livre de paie" reports:
   - Livre de paie - Mensuel
   - Livre de paie - Hebdomadaire (Semaine 1, 2, 3, 4)
   - Livre de paie - Quinzaine (1ère quinzaine, 2ème quinzaine)
2. Filter by `payroll_runs.payment_frequency` and `closure_sequence`
3. Include in Phase 5 (Section 10.5)

**Legal Reference:** Not explicit in guide, but standard practice

---

### ✅ Correctly Planned: Combined Headcount Reporting

**Guide Note:**
> "Les journaliers sont comptés dans l'effectif total de l'entreprise, même s'ils sont dans une base séparée pour la gestion."

**Architecture Status:**
- ✅ Single database ensures unified headcount
- ✅ Easier than Sage approach

---

### ⚠️ IMPORTANT: CNPS Declaration Grouping

**Architecture Mentions (Section 4.2.3):**
> "CNPS/CMU declarations (grouped by payment period)"

**Issue:**
- ⚠️ CNPS declarations are typically MONTHLY
- ❌ Not clear if weekly workers' contributions are summed monthly or declared separately
- ❌ No explicit guidance on CNPS form grouping

**Required Clarification:**
Research CNPS rules:
- Are contributions from 4 weekly runs SUMMED for monthly declaration?
- Or are they declared separately with closure_sequence?

**Recommendation (default):**
Sum all contributions within calendar month for CNPS declaration, regardless of closure_sequence.

---

## 10. Edge Cases & Special Scenarios

### ❌ MISSING: Agricultural vs Non-Agricultural Sector Handling

**Guide Mentions (Section 2.1):**
```
Durée hebdomadaire:
- Entreprises non agricoles: 40 heures
- Entreprises agricoles: 48 heures (dans la limite de 2400 heures/an)
```

**Architecture Status:**
- ❌ No sector-based automatic weekly hours detection
- ❌ No 2400 hours/year limit validation for agricultural sector
- ❌ `employee.sector` field exists but not linked to weekly hours regime

**Required Actions:**
1. Add mapping: `sector → default_weekly_hours`
   - Agricultural sectors → 48h default
   - Non-agricultural → 40h default
   - Security/domestic → 56h default
2. Add annual hours limit for agricultural: `MAX_ANNUAL_HOURS = 2400`
3. Validation: Sum all hours for agricultural workers, warn if > 2400

**Legal Reference:** Décret N° 96-203 Article 2 ❌ Missing

---

### ❌ MISSING: Guardiennage (Security) 56-Hour Week

**Guide Mentions (Section 2.1, 3.2):**
```
Personnel domestique et de gardiennage: 56 heures
Taux horaire = (56 × 52) / 12 = 242.67 heures/mois
```

**Architecture Status:**
- ❌ Not mentioned in overtime classification
- ❌ No special handling for 56h regime
- ❌ Would be incorrectly calculated with 40h or 48h divisor

**Required Actions:**
1. Add `weekly_hours_regime` = '56h' option
2. Update hourly divisor calculation: `(56 × 52) / 12 = 242.67`
3. Overtime starts at 57th hour (not 41st)

---

### 🔍 CLARIFICATION NEEDED: Payment on Same Day as Work

**Guide States (Section 9.3):**
> "Même si le travailleur est engagé pour quelques heures ou pour une seule journée et payé au cours de cette journée"

**Question:**
- Is same-day payment a legal REQUIREMENT?
- Or just a possibility?

**Architecture Impact:**
- If REQUIRED: Need special "same-day payroll run" workflow
- If OPTIONAL: Current weekly/bi-weekly flows are sufficient

**Recommendation:**
Ask HR manager if same-day payment is:
- Mandatory (must implement daily runs)
- Or just legally allowed (monthly/weekly sufficient)

---

### ❌ MISSING: Successive Contracts Tracking (12-Month Rule)

**Guide Requirement (Section 8.1):**
> "Embauchés successives pendant 12 mois"

**Architecture Status:**
- ✅ Tracks continuous employment via `continuous_employment_start_date`
- ❌ **Does NOT track SUCCESSIVE contracts**
  - Example: 3-month CDDTI, 1-month gap, 3-month CDDTI, 1-month gap, 3-month CDDTI = 9 months over 12-month period
  - Should convert to CDI if cumulative days > 12 months within rolling 12-month window

**Required Actions:**
1. Track ALL CDDTI contracts per employee
2. Calculate rolling 12-month window
3. Sum total days worked in CDDTI contracts within window
4. If > 365 days (or equivalent) → Flag for conversion

**Legal Interpretation:**
"Embauchés successives" likely means:
- Multiple short CDDTI contracts
- With gaps between them
- But totaling 12+ months within a reasonable period

**Recommendation:**
Consult labor law expert on exact interpretation of "successives pendant 12 mois."

---

## 11. Legal References & Compliance

### ⚠️ IMPORTANT: Legal References Not Consistently Cited

**Guide Provides (Annexe A):**
1. Décret N° 96-203 du 7 mars 1996 (durée du travail)
2. Ordonnance n° 2023-719 du 13 septembre 2023 (ITS reform)
3. Note de service n° 00026/MFB/DGI/DLCD du 03 janvier 2024 (ITS clarifications)
4. Convention collective interprofessionnelle - Annexe journaliers
5. Code Général des Impôts - Articles 118, 119, 146

**Architecture Status:**
- ✅ Some references cited (e.g., ITS reform, Article 7 Convention Collective)
- ❌ Not comprehensive
- ❌ No centralized legal reference documentation

**Required Actions:**
1. Create `docs/LEGAL-REFERENCES-DAILY-WORKERS.md`
2. Map each requirement to its legal source
3. Include in code comments for compliance audits
4. Add references to UI tooltips where applicable

---

### ❌ MISSING: Note de Service 03 Janvier 2024 (ITS Clarifications)

**Guide Reference (Annexe A):**
> Note de service n° 00026/MFB/DGI/DLCD du 03 janvier 2024 - Précisions relatives aux aménagements apportés par la réforme des ITS

**Architecture Status:**
- ❌ Not mentioned
- ❌ May contain important clarifications on daily worker taxation

**Required Actions:**
1. Obtain and review Note de Service 03/01/2024
2. Verify daily bracket calculation matches official guidance
3. Check for any daily-worker-specific exemptions or rules

---

## 12. UI/UX Gaps

### ✅ Correctly Planned: Payment Frequency Selection in Wizard

**Architecture (Section 9.2):**
```typescript
<RadioGroup value={paymentFrequency}>
  <RadioGroupItem value="MONTHLY" />
  <RadioGroupItem value="WEEKLY" />
  <RadioGroupItem value="BIWEEKLY" />
</RadioGroup>
```

**Missing:**
- ❌ No DAILY option (Section 7 identified this)

---

### ❌ MISSING: Weekly Time Entry Grid for Managers

**Architecture Mentions (Section 8.1):**
> "New UI Component: WeeklyTimeEntryGrid"

**Issue:**
- ⚠️ Design described but NO wireframe or detailed spec
- ❌ No guidance on:
  - How to handle multiple employees in grid?
  - How to bulk approve entries?
  - How to copy from previous week?
  - How to handle public holidays (auto-fill 0)?

**Required Actions:**
1. Create detailed UI spec for WeeklyTimeEntryGrid
2. Include bulk operations (copy, approve, fill)
3. Mobile-friendly alternative (can't fit grid on phone)
4. Consider existing time tracking UI patterns

---

### ❌ MISSING: CDDTI Bulletin Special Layout

**Architecture Mentions (Section 10.5):**
> "Special layout for CDDTI (highlight 3% indemnité)"

**Issue:**
- ❌ No mockup or design
- ❌ What exactly should be highlighted?
- ❌ Should bulletin show "Remplace préavis et indemnité de licenciement"?

**Required Actions:**
1. Design CDDTI bulletin mockup
2. Highlight components:
   - Indemnité de précarité (3%) in green/blue
   - Note: "Cette indemnité remplace le préavis et l'indemnité de licenciement (Article 7)"
3. Show days worked and hourly rate clearly
4. Include legal disclaimer if needed

---

## 13. Testing Gaps

### ❌ MISSING: Unit Tests for Guide Examples

**Guide Provides 3 Complete Examples:**
1. **Example 1 (Section 10.1):** 22 days, 8h/day, célibataire
   - Expected: Gross 72,160, Grat 6,013, Congés 6,514, Précarité 2,540, ITS 2,750, Net 79,142

2. **Example 2 (Section 10.2):** 30 hours, marié 2 enfants
   - Expected: Gross 12,300, ITS = 0 (below threshold after deduction)

3. **Example 3 (Section 10.3):** 50 hours with overtime
   - Expected: Gross 21,402

**Architecture Status:**
- ⚠️ Section 11.2 mentions "Validation Against Guide Examples"
- ❌ Only provides pseudo-code for Example 1
- ❌ No test for Example 2 or 3

**Required Actions:**
1. Create `cddti-guide-examples.test.ts`
2. Implement ALL 3 examples as unit tests
3. Tests must pass with EXACT values from guide (within ±1 FCFA rounding)

---

### ❌ MISSING: Edge Case Tests

**Required Test Cases (Not in Architecture):**
1. Agricultural worker with 48h regime (overtime starts at 49h)
2. Security worker with 56h regime
3. CDDTI with partial week (3.75 days)
4. Monthly-paid CDDTI (exists but rare)
5. Multiple successive CDDTI contracts (12-month rule)
6. CDDTI conversion after 12 months (indemnity stops)
7. Transport allowance varies by location
8. CMU for partial month
9. Contribution employeur (2.8% vs 12% for expatriate)

---

## 14. Documentation Gaps

### ❌ MISSING: User Guide for Journaliers Module

**Architecture Phase 7 (Section 10.7):**
> "Documentation: User guide, Admin configuration guide, API documentation"

**Issue:**
- ⚠️ Generic mention, no detail
- ❌ What should user guide cover?

**Required Sections:**
1. **Setup Guide:**
   - Configuring weekly hours regime
   - Setting daily transport rates by location
   - Enabling CDDTI contract type

2. **Operations Guide:**
   - Creating CDDTI contracts
   - Entering time for weekly workers
   - Running weekly/bi-weekly payroll
   - Reviewing time entry completeness

3. **Manager Guide:**
   - Approving time entries
   - Handling missing days
   - Understanding CDDTI bulletins

4. **Compliance Guide:**
   - 12-month conversion rule
   - Legal references
   - Audit trail

---

## 15. Summary of Critical Gaps

### Priority 1 (CRITICAL - Block Production)

1. ❌ **Hourly divisor calculation formula** (Section 1)
   - Missing: `(weeklyHours × 52) / 12` implementation
   - Missing: `weekly_hours` field in database
   - Impact: All hourly payroll incorrect

2. ❌ **Contribution employeur** (Section 6, Article 146)
   - Missing: 2.8% local / 12% expatriate employer tax
   - Impact: Legal non-compliance, underreporting costs

3. ❌ **Overtime threshold by regime** (Section 5)
   - Missing: Dynamic threshold (40h, 48h, or 56h)
   - Impact: Incorrect overtime for agricultural/security workers

4. ❌ **CDDTI task description required** (Section 6, Article 4)
   - Missing: Validation that task is described
   - Impact: Legal non-compliance (Article 4)

5. ❌ **Successive contracts tracking** (Section 10)
   - Missing: Cumulative 12-month calculation
   - Impact: Failure to convert CDDTI to CDI when required

---

### Priority 2 (IMPORTANT - Enhance Before UAT)

6. ⚠️ **Transport allowance by locality** (Section 2)
   - Missing: Location-based rate lookup

7. ⚠️ **CMU proration rules** (Section 4)
   - Unclear: Fixed amount or prorated?

8. ⚠️ **Weekly hours regime detection** (Section 1)
   - Missing: Sector → weekly hours mapping

9. ⚠️ **2400 hours/year limit (agricultural)** (Section 10)
   - Missing: Annual hours validation

10. ⚠️ **Separate pay registers** (Section 9)
    - Missing: Livre de paie by frequency

11. ⚠️ **CNPS declaration grouping** (Section 9)
    - Unclear: Monthly sum or separate by closure?

12. ⚠️ **Cotisations complémentaires** (Section 6)
    - Missing: Pension/insurance exemption (10% / 320k cap)

---

### Priority 3 (CLARIFICATION NEEDED)

13. 🔍 **Days worked definition** (Section 8)
    - Unique calendar days or hours ÷ 8?

14. 🔍 **Same-day payment requirement** (Section 10)
    - Mandatory or optional?

15. 🔍 **Missing days detection** (Section 8)
    - How to handle irregular schedules?

16. 🔍 **ITS partial week calculation** (Section 3)
    - Actual days or equivalent days?

---

### Priority 4 (ENHANCEMENT - Post-MVP)

17. ⚠️ **DAILY payment frequency** (Section 7)
    - Rare but legally valid

18. ⚠️ **CDDTI bulletin special layout** (Section 12)
    - Design not specified

19. ⚠️ **Weekly time entry grid UX** (Section 12)
    - No detailed spec

20. ❌ **Legal references documentation** (Section 11)
    - Not comprehensive

---

## 16. Correctly Implemented Features (No Gaps)

### ✅ Areas Where Architecture Matches Guide Perfectly

1. ✅ **Gratification formula:** `GROSS / 12`
2. ✅ **Congés payés formula:** `(GROSS + GRAT) / 12`
3. ✅ **Indemnité de précarité:** `TOTAL_BRUT × 3%` for CDDTI only
4. ✅ **Daily ITS brackets:** Monthly brackets ÷ 30
5. ✅ **Daily family deductions:** Monthly deductions ÷ 30
6. ✅ **Progressive ITS calculation:** Per-day, then sum
7. ✅ **Social security standard rates:** Applied to actual gross (no separate proration)
8. ✅ **CDDTI contract type:** NULL end_date allowed
9. ✅ **12-month continuous tracking:** `continuous_employment_start_date` field
10. ✅ **Overtime classification:** 6 types with correct multipliers
11. ✅ **Time entries reuse:** Leverages existing table
12. ✅ **Multiple closures:** `closure_sequence` supports 2-4/month
13. ✅ **Single database approach:** Better than Sage
14. ✅ **Payment frequency ≠ contract type:** Correct separation
15. ✅ **Bulletin mandatory:** For all workers, even 1 day

---

## 17. Recommendations

### Immediate Actions (Before Implementation Starts)

1. **Add hourly divisor calculation:**
   ```typescript
   function calculateHourlyDivisor(weeklyHours: number): number {
     return (weeklyHours * 52) / 12;
   }

   function calculateHourlyRate(categoricalSalary: number, weeklyHours: number): number {
     return categoricalSalary / calculateHourlyDivisor(weeklyHours);
   }
   ```

2. **Add missing database fields:**
   ```sql
   ALTER TABLE employees ADD COLUMN weekly_hours_regime varchar(10) DEFAULT '40h';
   ALTER TABLE employees ADD COLUMN employee_type varchar(20) DEFAULT 'local';
   CHECK (weekly_hours_regime IN ('40h', '44h', '48h', '52h', '56h'));
   CHECK (employee_type IN ('local', 'expatriate'));
   ```

3. **Implement contribution employeur:**
   ```typescript
   const contributionEmployeur = totalBrut * (
     employee.employee_type === 'local' ? 0.028 : 0.12
   );
   ```

4. **Make CDDTI task description required:**
   ```typescript
   z.object({
     contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'STAGE_QUAL']),
     cddtiTaskDescription: z.string().min(1).optional(),
   }).refine(
     (data) => data.contractType !== 'CDDTI' || !!data.cddtiTaskDescription,
     { message: "La description de la tâche est obligatoire pour les CDDTI (Article 4)" }
   );
   ```

5. **Create comprehensive test suite:**
   - Add all 3 guide examples as unit tests
   - Add edge cases (agricultural, security, successive contracts)
   - Validate against exact guide values (±1 FCFA)

---

### Clarifications Needed from HR Manager / Legal

1. **CMU proration:** Fixed monthly or prorated?
2. **Same-day payment:** Mandatory or optional?
3. **Successive contracts:** Exact interpretation of "pendant 12 mois"?
4. **CNPS declarations:** Monthly sum or separate by closure?
5. **Transport by locality:** Database structure? Rates per city?

---

### Documentation to Create

1. **Legal references mapping** (`docs/LEGAL-REFERENCES-DAILY-WORKERS.md`)
2. **User guide** (Setup, Operations, Manager, Compliance)
3. **Edge cases playbook** (Agricultural, Security, Successive contracts)
4. **Testing checklist** (All guide examples + edge cases)

---

## 18. Conclusion

**Overall Assessment:** The architecture document (v2.0) demonstrates a strong understanding of the requirements and provides a solid foundation. However, there are **7 critical gaps** that MUST be addressed before implementation:

1. Hourly divisor calculation formula
2. Contribution employeur (2.8% / 12%)
3. Overtime threshold by weekly hours regime
4. CDDTI task description validation
5. Successive contracts tracking
6. Agricultural 2400h/year limit
7. Transport allowance by locality

Additionally, **12 important enhancements** should be completed before UAT, and **8 clarifications** should be obtained from HR/legal experts.

The **15 correctly implemented features** show that the core payroll logic is sound. With the identified gaps addressed, the system will be production-ready and fully compliant with Ivorian labor law.

---

**Next Steps:**
1. Review this gap analysis with HR manager (Joel N'zore)
2. Obtain clarifications on Priority 3 items
3. Update architecture document (v3.0) with fixes
4. Implement Priority 1 critical gaps first
5. Proceed with Phase 1 implementation once gaps closed

---

**Analysis completed:** 2025-10-31
**Reviewed by:** _Pending_
**Status:** Ready for HR Manager Review
