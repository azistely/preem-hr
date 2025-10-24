# Company Onboarding Review & Improvement Plan

**Generated:** October 23, 2025
**Purpose:** Analyze current company onboarding flow and identify missing critical features

---

## Current Onboarding Flow (Q1 → Q2 → Q3)

### ✅ **Step Q1: Company Setup**
**Goal:** Configure country and company basics
**Duration:** ~2-3 minutes
**Progress:** 1 of 3

#### What's Currently Collected:
1. **Country Selection** 🇨🇮
   - Country code (CI, SN, BF, ML)
   - Auto-loads tax rules (CNPS/IPRES, ITS/IRPP, SMIG)
   - Helper text shows implications

2. **Company Information**
   - Legal name (required)
   - Industry/activity type (free text, required)
   - Sector for work accident rate (dropdown, required)
     - Services/Commerce (2% AT)
     - Agriculture (2.5% AT)
     - Industry (3% AT)
     - Transport (3.5% AT)
     - Construction (5% AT)
     - Mining (5% AT)
   - Tax ID (optional)

#### ✅ What Works Well:
- Smart defaults (CI pre-selected)
- Clear helper text explaining impact
- Single form = fast completion
- Mobile-optimized

#### ❌ What's MISSING (Critical):
1. **Contact Information**
   - HR manager name ❌
   - HR manager email ❌
   - HR manager phone ❌
   - Company phone ❌
   - Company address ❌

2. **Legal/Compliance Basics**
   - CNPS employer number ❌
   - Date company founded/registered ❌
   - Legal structure (SARL, SA, EURL, etc.) ❌
   - Registration number (RCCM) ❌

3. **Payroll Configuration**
   - Bank account for salary payments ❌
   - Default payment method (bank transfer, cash, check) ❌
   - Payroll closing day (e.g., 25th of each month) ❌
   - Payment day (e.g., 5th of next month) ❌

4. **Company Logo/Branding**
   - Logo upload for payslips ❌
   - Company stamp/signature ❌

#### 🎯 Recommendations for Q1:

**KEEP AS-IS:**
- Country + sector selection
- Single-form approach

**ADD (Required):**
- HR contact section (name, email, phone)
- Company address (for payslips and legal docs)
- CNPS employer number (critical for exports)
- Bank account for disbursements

**ADD (Optional - Skip with defaults):**
- Legal structure dropdown
- Registration number (RCCM)
- Company logo upload

**MOVE TO LATER:**
- Payroll schedule (move to Q3)

---

### ✅ **Step Q2: First Employee + Payslip Preview**
**Goal:** Add first employee and see working payroll calculation
**Duration:** ~3-5 minutes
**Progress:** 2 of 3

#### What's Currently Collected:
1. **Employee Personal Info**
   - First name, last name (required)
   - Email (optional)
   - Phone (required)
   - Hire date (required)

2. **Employment Details**
   - Position title (required)

3. **Salary Configuration**
   - Base salary (monthly) OR
   - Base components (Code 10, Code 11, Code 12)
   - Transport allowance (optional)
   - Housing allowance (optional)
   - Meal allowance (optional)
   - Custom components (optional)

4. **Family Status** (for deductions)
   - Marital status (single, married, divorced, widowed)
   - Dependent children (number)

5. **Payslip Preview**
   - Shows calculated gross, net, taxes, contributions
   - Builds confidence in system

#### ✅ What Works Well:
- Immediate payslip preview = "aha!" moment
- Smart defaults (user's own name prefilled)
- Family deductions calculated automatically
- Two-phase approach (preview then save)

#### ❌ What's MISSING (Important):
1. **Banking Information**
   - Employee bank account ❌
   - Bank name ❌
   - Account type (salary, savings) ❌

2. **Identification**
   - National ID number ❌
   - CNPS employee number ❌
   - Tax ID number ❌

3. **Employment Type**
   - Contract type (CDI, CDD, Intern, Contractor) ❌
   - If CDD: Contract end date ❌
   - Probation period (yes/no, duration) ❌

4. **Work Configuration**
   - Rate type (MONTHLY, DAILY, HOURLY) ❌
   - Employee category (A1, A2, B1, C, D, E) ❌
   - Coefficient (for minimum wage validation) ❌
   - Department assignment ❌

5. **Emergency Contact**
   - Emergency contact name ❌
   - Emergency contact phone ❌
   - Relationship ❌

#### 🎯 Recommendations for Q2:

**KEEP AS-IS:**
- Core personal info
- Salary configuration
- Family status
- Payslip preview flow

**ADD (Required - Phase 1):**
- Banking information section
  - Bank account number
  - Bank name (dropdown with major banks)
  - Checkbox: "I'll add this later" (skippable)

**ADD (Required - Phase 2):**
- Employment type section
  - Contract type dropdown (CDI/CDD/Stage)
  - If CDD: Show end date picker
  - Rate type: Monthly (default), Daily, Hourly

**ADD (Optional - Can skip):**
- Employee category dropdown (with helper text)
- Department dropdown (if departments exist)
- CNPS employee number
- National ID number

**DEFER TO LATER:**
- Emergency contact (can be added in employee profile)
- Document uploads (can be added in employee documents)

---

### ✅ **Step Q3: Payroll Frequency**
**Goal:** Configure payroll schedule
**Duration:** ~30 seconds
**Progress:** 3 of 3

#### What's Currently Collected:
1. **Payroll Frequency**
   - Monthly (default)
   - Bi-weekly

2. **Action:** Creates first draft payroll run

#### ✅ What Works Well:
- Very fast (2 buttons)
- Clear choice
- Auto-creates first run

#### ❌ What's MISSING (Important):
1. **Payroll Schedule Details**
   - Payroll closing day ❌ (e.g., "25th of each month")
   - Payment day ❌ (e.g., "5th of next month")
   - Time entry cutoff ❌ (e.g., "23rd at 5 PM")

2. **First Payroll Configuration**
   - Period for first run ❌
   - Expected employees in first run ❌
   - Preview of first run period ❌

3. **Banking Setup Confirmation**
   - Company bank account confirmed? ❌
   - Payment file format preference ❌

#### 🎯 Recommendations for Q3:

**REPLACE CURRENT APPROACH WITH:**

**New Q3 Structure: "Calendrier de Paie"**

1. **Frequency Selection** (KEEP)
   - Monthly (recommended)
   - Bi-weekly

2. **NEW: Schedule Configuration**
   - Payroll closing day picker
     - Helper: "Dernier jour pour enregistrer les heures/changements"
     - Default: 25th
   - Payment day picker
     - Helper: "Jour où les salaires sont virés aux employés"
     - Default: 5th of next month
   - Preview: "Prochaine paie: 1-25 Jan → Paiement 5 Fév"

3. **NEW: First Run Configuration**
   - "Votre première paie sera pour quelle période?"
   - Month/period selector (default: current month)
   - "Combien d'employés allez-vous payer?" (prefill: 1)

4. **Banking Confirmation** (OPTIONAL)
   - "Avez-vous configuré votre compte bancaire?"
   - Yes → Continue
   - No → Show reminder card, allow skip

---

### ✅ **Step SUCCESS: Completion Page**
**Goal:** Celebrate completion and guide next steps
**Duration:** Variable (user choice)

#### What's Currently Shown:
1. **Success Message** 🎉
   - Congratulations header
   - Summary cards (1 employee, configured, ready)

2. **Checklist** ✅
   - Country configured
   - Company info saved
   - First employee created
   - Payroll frequency set
   - System ready

3. **Primary Actions**
   - View employees
   - Go to dashboard

4. **Progressive Feature Discovery**
   - Time tracking card
   - Leave management card
   - Overtime reports card
   - Time-off policies card (admin only)

5. **Skip Option**
   - Link to dashboard

#### ✅ What Works Well:
- Celebration moment
- Clear summary
- Progressive disclosure of advanced features
- Multiple exit paths

#### ❌ What's MISSING (Nice to Have):
1. **Guided Tour Offer**
   - "Voulez-vous une visite guidée?" ❌
   - 2-minute interactive tutorial ❌

2. **Quick Setup Checklist**
   - "Tâches recommandées" ❌
     - Add more employees ❌
     - Upload company logo ❌
     - Add departments ❌
     - Set up time-off policies ❌
     - Configure approval workflow ❌

3. **Help Resources**
   - Link to documentation ❌
   - Link to video tutorials ❌
   - Link to support chat ❌

4. **What Happens Next**
   - "Que faire maintenant?" section ❌
   - Numbered steps for next week ❌

#### 🎯 Recommendations for SUCCESS Page:

**KEEP AS-IS:**
- Success header and celebration
- Summary cards
- Primary actions
- Progressive feature discovery

**ADD (Recommended):**
1. **Next Steps Checklist** (Collapsible)
   ```
   Prochaines étapes recommandées (Optionnel):
   ☐ Ajouter plus d'employés (ou importer en masse)
   ☐ Créer vos départements
   ☐ Configurer les politiques de congés
   ☐ Personnaliser vos bulletins de paie
   ☐ Inviter vos managers
   ```

2. **Quick Actions Grid**
   - Larger cards with clear CTAs
   - "Add employees" card with import option
   - "Set up departments" card
   - "Configure policies" card
   - "Customize payslips" card

3. **Resource Center Link**
   - Small card: "Besoin d'aide?"
   - Link to documentation
   - Link to support

---

## Missing Features from Old Onboarding Flow

### 🗂️ **Department Setup Step** (REMOVED - Should be restored)

**What it did:**
- Pre-filled with 3 common departments
- Allow editing, adding, removing departments
- Required at least 2 departments
- Skippable

**Why it was removed:**
- Likely to simplify flow

**Should it come back?**
- ✅ **YES** - But as optional in SUCCESS page
- Many SMBs need departments immediately
- Can't assign employees to departments without them
- Should NOT be required in main flow
- Should be easy to add from dashboard or success page

**Recommendation:**
- Add "Set up departments" card to SUCCESS page
- Add "Create departments" quick action in dashboard
- Add to suggested next steps checklist

---

### 📁 **Bulk Import Step** (REMOVED - Should be restored)

**What it did:**
- Download CSV template
- Fill template in Excel/Sheets
- Upload and validate CSV
- Import multiple employees at once

**Why it was removed:**
- Likely too complex for onboarding flow

**Should it come back?**
- ✅ **YES** - But as alternative path, not main flow
- Critical for companies with 5+ existing employees
- Should be offered on SUCCESS page
- Should be accessible from employees list

**Recommendation:**
- Keep single employee in Q2 as main path
- Add "Import multiple employees" option on SUCCESS page
- Add prominent "Import from Excel" button on /employees page
- Keep bulk import implementation (already exists)

---

## Summary of Required Changes

### 🔴 **CRITICAL (Must Add):**

#### Q1 Changes:
- [ ] Add HR contact fields (name, email, phone)
- [ ] Add company address (for payslips)
- [ ] Add CNPS employer number
- [ ] Add company bank account field

#### Q2 Changes:
- [ ] Add banking information section (account, bank name)
  - Make skippable with "I'll add this later" option
- [ ] Add contract type field (CDI/CDD/Stage)
- [ ] Add rate type field (Monthly/Daily/Hourly)
  - Default: Monthly
  - Show helper text for each type

#### Q3 Changes:
- [ ] Add payroll closing day picker (default: 25th)
- [ ] Add payment day picker (default: 5th)
- [ ] Add first run period selector
- [ ] Show preview: "Next run: 1-25 Jan → Payment 5 Feb"

---

### 🟡 **IMPORTANT (Should Add):**

#### Q1 Optional Fields:
- [ ] Legal structure dropdown (skippable)
- [ ] Registration number (RCCM) (skippable)
- [ ] Company logo upload (skippable)

#### Q2 Optional Fields:
- [ ] Employee category dropdown (with helper)
- [ ] Department dropdown (if exists)
- [ ] CNPS employee number (skippable)
- [ ] National ID number (skippable)

#### SUCCESS Page:
- [ ] Add "Next steps" checklist (collapsible)
- [ ] Add "Add departments" quick action
- [ ] Add "Import employees" quick action
- [ ] Add "Need help?" resource link

---

### 🟢 **NICE TO HAVE (Can Defer):**

- [ ] Guided tour offer on success page
- [ ] Interactive tutorial system
- [ ] Video tutorials library
- [ ] More detailed help texts
- [ ] Multi-language support (beyond French)

---

## HCI Compliance Check

### ✅ Current Flow Strengths:
1. **Fast completion** - Under 10 minutes total
2. **Progressive disclosure** - One thing at a time
3. **Smart defaults** - Pre-filled where possible
4. **Immediate feedback** - Payslip preview in Q2
5. **Mobile-optimized** - Works on 5" screens
6. **Zero jargon** - Business language throughout
7. **Task-oriented** - "Configure your company" not "Set up tenant"

### ⚠️ Current Flow Weaknesses:
1. **Missing critical data** - Can't run real payroll without bank accounts
2. **No validation** - Minimum wage not checked in Q2
3. **No departments** - Can't organize employees
4. **Limited employee config** - Missing contract type, rate type
5. **Incomplete payroll setup** - No schedule details
6. **No bulk import path** - Companies with 5+ employees struggle

---

## Implementation Priority

### Phase 1 (Week 1-2): Critical Fields ⚠️
1. Add HR contact and company address to Q1
2. Add CNPS employer number to Q1
3. Add company bank account to Q1
4. Add banking info section to Q2 (skippable)
5. Add contract type and rate type to Q2

### Phase 2 (Week 3-4): Payroll Configuration 📅
1. Redesign Q3 with schedule configuration
2. Add closing day and payment day pickers
3. Add first run period selector
4. Add period preview

### Phase 3 (Week 5): Optional Features & Polish ✨
1. Add department quick action to SUCCESS
2. Add bulk import card to SUCCESS
3. Add next steps checklist
4. Add resource center link
5. Add skippable optional fields (legal structure, etc.)

### Phase 4 (Week 6+): Advanced Features 🚀
1. Guided tour system
2. Interactive tutorial
3. Video help library
4. Advanced validation (min wage, coefficient checks)

---

## Technical Notes

### Existing API Endpoints (Already Implemented):
- ✅ `onboarding.setCompanyInfoV2` - Update with new fields
- ✅ `onboarding.createFirstEmployeeV2` - Update with new fields
- ✅ `onboarding.createFirstPayrollRun` - Update with schedule params
- ✅ `onboarding.createDepartments` - Exists but not used
- ✅ `onboarding.importEmployees` - Exists but not exposed

### New API Endpoints Needed:
- ❌ `onboarding.validateMinimumWage` - Check salary vs coefficient
- ❌ `onboarding.getBankList` - Dropdown of major banks
- ❌ `onboarding.getPayrollSchedulePreview` - Calculate next run dates

### Database Schema Updates Needed:
- ✅ `tenants` table has all required fields
- ✅ `employees` table has contract_type, rate_type fields
- ❌ Need to add `payroll_closing_day` to tenants
- ❌ Need to add `default_payment_day` to tenants
- ❌ Need to add `hr_contact_name`, `hr_contact_email`, `hr_contact_phone` to tenants

---

## User Flow Comparison

### BEFORE (Current Q1-Q2-Q3):
```
Q1 (2 min): Country + Company name + Sector
Q2 (3 min): First employee + Payslip preview
Q3 (30 sec): Payroll frequency
SUCCESS: Go to dashboard
```
**Total time:** ~5-6 minutes
**Completion rate:** Unknown
**Can run real payroll:** ❌ NO (missing bank accounts, CNPS #, schedule)

### AFTER (Improved Q1-Q2-Q3):
```
Q1 (3 min): Country + Company + Contact + Bank + CNPS #
Q2 (4 min): Employee + Banking + Contract + Payslip preview
Q3 (2 min): Schedule configuration + First run preview
SUCCESS: Next steps guide + Quick actions
```
**Total time:** ~9-10 minutes
**Completion rate:** Target 85%+
**Can run real payroll:** ✅ YES (all critical data collected)

---

## Success Metrics

### Current Metrics (Unknown):
- Onboarding completion rate: ?
- Time to first payroll run: ?
- Support tickets from onboarding: ?

### Target Metrics (Post-Implementation):
- Onboarding completion rate: >85%
- Time to complete: <10 minutes
- Time to first real payroll: <24 hours after onboarding
- Support tickets: <10% of new users
- User satisfaction: >4.5/5

---

## Conclusion

The current onboarding flow is **well-designed for speed and simplicity**, but it's **missing critical data** needed to run real payroll. The main gaps are:

1. **Company details** - Contact info, bank account, CNPS number
2. **Employee banking** - Can't pay employees without bank accounts
3. **Employment configuration** - Contract type, rate type, category
4. **Payroll schedule** - Closing day, payment day, first run period
5. **Department organization** - No way to structure company
6. **Bulk import** - No path for companies with existing employees

**Recommendation:** Implement Phase 1 and Phase 2 changes to make the onboarding flow **production-ready** for real payroll operations, while maintaining the **speed and simplicity** that makes the current flow successful.

---

**Document Version:** 1.0
**Last Updated:** October 23, 2025
**Next Review:** After Phase 1 implementation
