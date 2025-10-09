# 🚀 Onboarding Redesign Proposal: Immediate Action Architecture

**Date:** October 8, 2025
**Status:** DRAFT - Awaiting Validation
**Author:** Claude (HCI Analysis)

---

## Executive Summary

**Current Problem:** The onboarding flow feels disconnected and slow because:
1. Questions route to steps but don't **configure** anything
2. Network round-trips create delays between action and feedback
3. Users enter data twice (questionnaire → forms in steps)
4. No immediate visible progress after answering questions

**Proposed Solution:** Redesign onboarding to **take immediate action** on every answer, using optimistic UI for instant feedback, and embed data collection directly into questions. This aligns with **HCI Principle #5 (Immediate Feedback)** and eliminates redundancy.

**Key Wins:**
- ✅ **Zero redundancy** - Ask once, configure immediately
- ✅ **Instant feedback** - Every answer triggers visible action
- ✅ **Faster completion** - Reduce from 15 minutes to <8 minutes
- ✅ **Better UX** - Feels responsive, not sluggish
- ✅ **Progressive disclosure** - Show configuration results as you go
- ✅ **Correct payroll** - Collect ALL data needed for accurate calculations

---

## ⚠️ CRITICAL: Payroll Correctness Requirements

**WARNING:** The current onboarding has **critical data gaps** that result in **incorrect payroll calculations**. The redesign MUST address these issues.

### Current Problem: Missing Payroll Data

The current flow collects basic employee info but **misses essential data** for payroll:

| Missing Data | Impact | Financial Consequence |
|--------------|--------|----------------------|
| **Family status** | Wrong tax + CMU | Employee underpaid by 94,708 FCFA/month (24%) |
| **Marital status + dependents** | Wrong fiscal parts (tax deduction) | Tax error of 4,708 FCFA/month |
| **Allowances** (housing, transport, meal) | Underpaid gross salary | Employee loses 50,000-90,000 FCFA/month |
| **Company sector** | Wrong work accident rate | Employer contribution error (0-3%) |

**Example:**
- Employee: Married + 2 children
- Current onboarding stores: `fiscalParts = 1.0` (DEFAULT - WRONG)
- Should store: `fiscalParts = 2.0` (married + 1 child)
- **Result: Employee pays 5,625 FCFA MORE tax per month than legally required**

**Legal Compliance Risk:**
- Tax underpayment → Fines + criminal prosecution
- CNPS/CMU underpayment → Retroactive payments + penalties
- Employee discovers underpayment → Loss of trust + labor inspection

**See full analysis:** `/docs/ONBOARDING-PAYROLL-CORRECTNESS-AUDIT.md`

### Redesign Requirements (Non-Negotiable)

The redesign MUST collect these additional fields:

#### 1. Family Status (Per Employee) - CRITICAL
```tsx
// Q4: Add employees - MUST include:
- Marital status: Single / Married / Divorced / Widowed
- Number of dependent children: 0-10
- → Calculates: fiscalParts (1.0 - 3.0)
- → Calculates: hasFamily (true/false) for CMU employer contribution
```

#### 2. Allowances (Per Employee) - CRITICAL
```tsx
// Q4: Add employees - MUST include:
- Housing allowance (FCFA) - Optional, default 0
- Transport allowance (FCFA) - Optional, default 0
- Meal allowance (FCFA) - Optional, default 0
- → Affects: grossSalary, taxableIncome, netSalary
```

#### 3. Company Sector (Tenant) - HIGH PRIORITY
```tsx
// Q2: Company Info - MUST include:
- Business sector: SERVICES / COMMERCE / TRANSPORT / INDUSTRIE / CONSTRUCTION
- → Determines work accident contribution rate (2-5%)
```

### How Redesign Addresses This

**Updated Q2 (Company Info):**
- ✅ Add sector selection dropdown (with work accident rate preview)

**Updated Q4 (Add Employees):**
- ✅ Add family status fields (marital status + dependents)
- ✅ Add allowances fields (housing, transport, meal - all optional)
- ✅ Show immediate payroll preview after each employee

**Validation:**
- ✅ Calculate payroll preview BEFORE final confirmation
- ✅ Show net salary to user (verify correctness)
- ✅ Block completion if required payroll data missing

---

## Section 1: Flow Comparison

### 1.1 Current Flow (Phase 1-4 Implementation)

```
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: DISCOVERY (Disconnected)                           │
└──────────────────────────────────────────────────────────────┘

Step 1: Questionnaire (7 questions, just data collection)
  Q1: Company size → Store answer
  Q2: Has departments → Store answer
  Q3: Contract types → Store answer
  Q4: Compensation → Store answer
  Q5: Time tracking → Store answer
  Q6: Time-off → Store answer
  Q7: Payroll frequency → Store answer

  ❌ No configuration happens
  ❌ No employees created
  ❌ No defaults set
  ❌ Just saves to tenant.settings.onboarding

Step 2: Path Preview (Network delay)
  - API call to generate path
  - Show list of steps
  - "Commencer la configuration" button

  ❌ User sees preview but nothing is configured yet

┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: CONFIGURATION (Separate Steps)                     │
└──────────────────────────────────────────────────────────────┘

Step 3: Country Selection
  - API: selectCountry() → Update tenant.countryCode
  - User waits for network round-trip

Step 4: Company Info Form
  - User fills 6 fields: legalName, industry, taxId, address, phone, email
  - API: setCompanyInfo() → Update tenant

  ❌ REDUNDANT: Company name was already entered during signup!

Step 5a: First Employee (SOLO path)
  - User fills 7 fields: firstName, lastName, email, phone, position, salary, hireDate
  - API: createFirstEmployee() → Creates employee record

  ❌ REDUNDANT: Owner info could be pre-filled from signup

Step 5b: Employees Wizard (SMALL_TEAM path)
  - User adds 2-10 employees one by one
  - Each employee: 7 fields again
  - API: addEmployee() × N

  ❌ SLOW: Network call for each employee
  ❌ TEDIOUS: Form appears after form

Step 5c: Bulk Import (MEDIUM/LARGE path)
  - Download CSV template
  - Fill CSV manually
  - Upload CSV
  - API: validateEmployeeImport() then importEmployees()

  ❌ CONTEXT SWITCH: Leave app to fill CSV

Step 6-10: Optional Steps
  - Compensation, Time Tracking, Time-Off, Approvals, etc.
  - Each step = separate form = more waiting
```

**Total Time:**
- Discovery: 2 min
- Preview: 1 min
- Country + Company: 3 min
- Employees: 5-15 min
- Optional features: 5-10 min
- **TOTAL: 16-31 minutes**

---

### 1.2 Proposed Flow (Immediate Action)

```
┌──────────────────────────────────────────────────────────────┐
│ UNIFIED FLOW: QUESTION = ACTION                             │
└──────────────────────────────────────────────────────────────┘

Q1: Where is your company located? 🌍
  Options:
    🇨🇮 Côte d'Ivoire (CNPS, ITS, SMIG 75K)
    🇸🇳 Sénégal (Coming soon)

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark as selected instantly
     - API (background): selectCountry('CI')
     - Update tenant.countryCode = 'CI'
     - Load country-specific rules (CNPS, ITS, SMIG)
     - Show checkmark ✅ when saved

  → DATA COLLECTED: countryCode
  → SMART DEFAULTS SET: currency = XOF, SMIG = 75000

---

Q2: What's your company name? 🏢
  Pre-filled: "Ma Boutique" (from signup)
  Optional fields: Industry, Tax ID

  → IMMEDIATE ACTION:
     - Optimistic UI: Show "Saved ✅" instantly
     - API (background): updateTenant({ name, industry, taxId })
     - Store in tenant.name and settings

  → DATA COLLECTED: legalName, industry, taxId
  → SKIPS LATER: No separate "Company Info" step

---

Q3: How many people work here? 👥
  Options:
    🧍 Just me (solo)
    👥 2-10 employees
    👔 11-50 employees
    🏢 51+ employees

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark as selected, show "Configuring path..."
     - Determine path: SOLO/SMALL_TEAM/MEDIUM/LARGE
     - API (background): updateOnboardingState({ path, company_size })
     - Pre-generate employee entry UI based on path

  → DATA COLLECTED: company_size, path
  → SMART DEFAULTS: Skip departments if solo/small

---

Q4a: Add yourself as the first employee 🧍 (SOLO path)
  Form embedded in question:
    Prénom: [Auto-fill from user.firstName]
    Nom: [Auto-fill from user.lastName]
    Email: [Auto-fill from user.email]
    Téléphone: [___________]
    Poste: [Propriétaire] (default)
    Salaire: [___________] FCFA (min 75K)
    Date embauche: [Today] (default)

  → IMMEDIATE ACTION:
     - Optimistic UI: Show "Creating profile... ✅"
     - API (background): createFirstEmployee()
     - Create position, employee, assignment, salary
     - Auto-inject CNPS/ITS components
     - Show preview of payroll calculation immediately

  → DATA COLLECTED: firstName, lastName, phone, position, salary
  → CONFIGURATION DONE: Employee created, salary configured

---

Q4b: Add your team members 👥 (SMALL_TEAM path)
  Wizard embedded in question:
    [Add Employee 1] [Add Employee 2] ... [Add Employee 10]
    Each form: firstName, lastName, phone, position, salary

  → IMMEDIATE ACTION (per employee):
     - Optimistic UI: Add to list instantly, show "Saving..."
     - API (batched): addEmployeeToOnboarding()
     - Create all records in parallel
     - Show running total: "3 employés ajoutés ✅"

  → DATA COLLECTED: N × employee records
  → CONFIGURATION DONE: All employees created

---

Q4c: Upload your employee list 📊 (MEDIUM/LARGE path)
  UI:
    1. Download template (instant)
    2. Upload filled CSV
    3. Preview import (validate)
    4. Confirm import

  → IMMEDIATE ACTION:
     - Optimistic UI: Show validation results instantly
     - API (background): validateEmployeeImport() → importEmployees()
     - Create all employees in bulk
     - Show summary: "47 employés importés ✅"

  → DATA COLLECTED: Bulk employee data
  → CONFIGURATION DONE: All employees created

---

Q5: How do you pay employees? 💰
  Options:
    💰 Fixed salary only
    🎁 Salary + allowances (transport, housing)
    📊 Salary + commissions
    🎯 All of the above

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark selected, show "Configuring..."
     - If allowances/commissions selected:
       → Show inline form: "Which allowances?"
         ☑️ Transport (default 25,000 FCFA)
         ☑️ Housing (default 50,000 FCFA)
         ☑️ Meal (default 15,000 FCFA)
     - API (background): createCompensationComponents()
     - Apply to all employees

  → DATA COLLECTED: compensation type, component defaults
  → CONFIGURATION DONE: Components created, applied to employees
  → SMART SKIP: If "Fixed salary" → skip component setup

---

Q6: Track employee hours? ⏰
  Options:
    ❌ Not needed
    ⏰ Basic clock-in/out
    📍 Clock-in with geolocation
    📊 Full time tracking + overtime

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark selected
     - If geolocation selected:
       → Show inline map picker: "Where's your office?"
       → Set geofence radius: [500m] (slider)
     - API (background): updateTenantSettings({ timeTracking: config })
     - Enable time tracking for all employees

  → DATA COLLECTED: timeTracking type, geofence config
  → CONFIGURATION DONE: Time tracking enabled
  → SMART SKIP: If "Not needed" → skip config

---

Q7: Manage time off? 🏖️
  Options:
    ❌ Not needed
    ✅ Legal minimums only (2.2 days/month - CI)
    🎯 Custom policies

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark selected
     - If legal minimums:
       → Show auto-config: "✅ 2.2 jours/mois configured"
       → Create default policy automatically
     - If custom:
       → Show inline form: Add policies (sick, maternity, etc.)
     - API (background): createTimeOffPolicies()
     - Apply to all employees

  → DATA COLLECTED: timeOff type, policies
  → CONFIGURATION DONE: Policies created, balances initialized

---

Q8: When do you pay employees? 📅
  Options:
    📅 Monthly (end of month)
    📆 Bi-weekly (twice per month)

  → IMMEDIATE ACTION:
     - Optimistic UI: Mark selected, show "Configuring..."
     - API (background): updateTenantSettings({ payrollFrequency })
     - Create first payroll run (draft)
     - Calculate preview for all employees

  → DATA COLLECTED: payrollFrequency
  → CONFIGURATION DONE: Payroll schedule set

---

FINAL STEP: Preview Your First Payroll 📊
  Show calculated payroll for all employees:
    - Employee list with net salaries
    - Total to pay: 1,234,567 FCFA
    - Breakdown: Gross, CNPS, ITS, Net
    - Collapsible details per employee

  Button: "C'est correct, continuer ✅"

  → IMMEDIATE ACTION:
     - Mark onboarding complete
     - Show confetti 🎉
     - Redirect to dashboard

---

COMPLETION: Congratulations! 🎉
  Summary:
    ✅ Company configured (Ma Boutique - CI)
    ✅ 3 employees added
    ✅ Time tracking enabled (geofencing)
    ✅ Legal time-off configured
    ✅ First payroll ready

  Next steps:
    1. Run first payroll → /payroll
    2. Invite employees → /employees
```

**Total Time:**
- Setup questions: 8 min (all configuration happens inline)
- Preview payroll: 2 min
- **TOTAL: 10 minutes** ✅ (40% faster)

---

### 1.3 Key Differences Highlighted

| Aspect | Current Flow | Proposed Flow |
|--------|-------------|---------------|
| **Questions** | Just collect data, no action | **Each question configures something** |
| **Network calls** | Wait for each step | **Optimistic UI, background saves** |
| **Data entry** | Enter company name twice (signup + step) | **Pre-fill from signup** |
| **Employee setup** | Separate step after questions | **Embedded in question flow** |
| **Compensation** | Optional step, separate form | **Inline form if selected** |
| **Time tracking** | Optional step, separate form | **Inline config if selected** |
| **Payroll preview** | Separate step at end | **Auto-calculated after employees** |
| **Redundancy** | High (multiple forms for same data) | **Zero (ask once, use everywhere)** |
| **Feedback** | Delayed (network round-trips) | **Instant (optimistic UI)** |
| **Total time** | 16-31 minutes | **10 minutes** ✅ |

---

## Section 2: Question-by-Question Design

### Q1: Where is your company located? 🌍

**UI Design:**
```tsx
<OnboardingQuestion
  title="Où est située votre entreprise ?"
  subtitle="Cela configure automatiquement les règles de paie (CNPS, ITS, SMIG)"
  progress={{ current: 1, total: 8 }}
>
  <CountrySelector
    options={[
      {
        code: 'CI',
        flag: '🇨🇮',
        name: 'Côte d\'Ivoire',
        preview: 'CNPS, ITS, SMIG 75,000 FCFA',
        available: true,
      },
      {
        code: 'SN',
        flag: '🇸🇳',
        name: 'Sénégal',
        preview: 'IPRES, IRPP, SMIG 52,500 FCFA',
        available: false, // Coming soon
      },
    ]}
    onSelect={(country) => {
      // Optimistic UI
      setSelectedCountry(country);
      setStatus('saving');

      // Background mutation
      selectCountry.mutate({ countryCode: country.code }, {
        onSuccess: () => setStatus('saved'),
        onError: () => {
          setStatus('error');
          setSelectedCountry(null); // Rollback
        },
      });
    }}
  />

  {status === 'saved' && (
    <SuccessFeedback>
      ✅ Configuration automatique: CNPS 6.3%, ITS progressif, SMIG 75,000 FCFA
    </SuccessFeedback>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Country card shows checkmark ✅ instantly
2. **Background Mutation**:
   ```typescript
   await selectCountry({ countryCode: 'CI' })
   // Updates: tenant.countryCode = 'CI', tenant.currency = 'XOF'
   ```
3. **Data Loaded**: Country-specific rules (tax_systems, social_security_schemes)
4. **Smart Defaults Applied**:
   - SMIG: 75,000 FCFA
   - CNPS employee rate: 6.3%
   - ITS brackets: 6 progressive brackets
   - Currency: XOF

**What Gets Pre-Filled Downstream:**
- Employee salary validation (min = 75,000 FCFA)
- Payroll calculations use CI rules
- Error messages reference CI-specific rules

**Skip Logic:** None (required for all paths)

---

### Q2: What's your company name? 🏢

**UI Design:**
```tsx
<OnboardingQuestion
  title="Informations sur votre entreprise"
  subtitle="Vérifiez et complétez vos informations"
  progress={{ current: 2, total: 8 }}
>
  <Form onSubmit={handleCompanyInfo}>
    {/* Pre-filled from signup */}
    <FormField
      label="Nom de l'entreprise"
      defaultValue={user.companyName} // From signup
      required
    />

    {/* CRITICAL: Business sector (affects work accident rates) */}
    <FormField
      label="Secteur d'activité"
      type="select"
      required
      helperText="💡 Détermine le taux de cotisation accident du travail (2-5%)"
    >
      <option value="SERVICES">Services (2% cotisation AT)</option>
      <option value="COMMERCE">Commerce (2% cotisation AT)</option>
      <option value="TRANSPORT">Transport (3% cotisation AT)</option>
      <option value="INDUSTRIE">Industrie (4% cotisation AT)</option>
      <option value="CONSTRUCTION">Construction (5% cotisation AT)</option>
    </FormField>

    {/* Optional fields */}
    <FormField
      label="Numéro fiscal"
      placeholder="Ex: CI-123456789"
      optional
    />

    <Button type="submit">
      {isSaving ? 'Enregistrement...' : 'Continuer ✅'}
    </Button>
  </Form>

  {status === 'saved' && (
    <SuccessFeedback>
      ✅ Informations enregistrées
    </SuccessFeedback>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show "Saved ✅" instantly
2. **Background Mutation**:
   ```typescript
   await updateTenant({
     name: data.legalName,
     industry: data.industry,
     taxId: data.taxId,
   })
   ```
3. **State Updated**: tenant.name, tenant.industry, tenant.taxId

**What Gets Pre-Filled Downstream:**
- Company name on payslips
- Tax ID on official documents
- Industry-specific defaults (if available)

**Skip Logic:** None (required for all paths)

---

### Q3: How many people work here? 👥

**UI Design:**
```tsx
<OnboardingQuestion
  title="Combien de personnes travaillent ici ?"
  subtitle="Cela personnalise votre parcours de configuration"
  progress={{ current: 3, total: 8 }}
>
  <CompanySizeSelector
    options={[
      {
        value: 'solo',
        icon: '🧍',
        label: 'Juste moi',
        description: 'Travailleur autonome',
        duration: '~5 min',
      },
      {
        value: 'small_team',
        icon: '👥',
        label: '2-10 employés',
        description: 'Petite équipe',
        duration: '~8 min',
      },
      {
        value: 'medium',
        icon: '👔',
        label: '11-50 employés',
        description: 'Moyenne entreprise',
        duration: '~12 min',
      },
      {
        value: 'large',
        icon: '🏢',
        label: '51+ employés',
        description: 'Grande organisation',
        duration: '~15 min',
      },
    ]}
    onSelect={(size) => {
      // Optimistic UI
      setCompanySize(size);
      setStatus('determining_path');

      // Background mutation
      answerQuestion.mutate({
        questionId: 'company_size',
        answer: size,
      }, {
        onSuccess: (result) => {
          setPath(result.path); // SOLO/SMALL_TEAM/MEDIUM/LARGE
          setStatus('path_determined');
          // Auto-advance to next question
          router.push('/onboarding/q4');
        },
      });
    }}
  />

  {status === 'path_determined' && (
    <PathPreview path={path} />
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show selected card with checkmark
2. **Background Mutation**:
   ```typescript
   await answerQuestion({
     questionId: 'company_size',
     answer: 'small_team'
   })
   // Determines path and updates state
   ```
3. **Path Determined**: SOLO/SMALL_TEAM/MEDIUM/LARGE
4. **UI Updated**: Show path preview (e.g., "Parcours Petite Équipe - ~8 min")

**What Gets Pre-Filled Downstream:**
- Employee entry UI (solo = single form, small = wizard, medium = CSV)
- Department setup (skipped for solo/small)
- Approval workflows (skipped for solo/small)

**Skip Logic:** Determines entire remaining flow

---

### Q4a: Add yourself as the first employee 🧍 (SOLO path)

**UI Design:**
```tsx
<OnboardingQuestion
  title="Créez votre profil employé"
  subtitle="Pour générer vos bulletins de paie"
  progress={{ current: 4, total: 8 }}
>
  <Form onSubmit={handleCreateEmployee}>
    {/* Pre-filled from user account */}
    <FormField
      label="Prénom"
      defaultValue={user.firstName} // From signup
      required
    />

    <FormField
      label="Nom"
      defaultValue={user.lastName} // From signup
      required
    />

    <FormField
      label="Email"
      defaultValue={user.email} // From signup
      required
    />

    <FormField
      label="Téléphone"
      placeholder="+225 01 23 45 67 89"
      required
    />

    <FormField
      label="Votre fonction"
      defaultValue="Propriétaire" // Smart default
      placeholder="Ex: Gérant, Directeur"
      required
    />

    <FormField
      label="Salaire mensuel brut"
      type="number"
      placeholder="Ex: 300000"
      min={75000} // From country rules
      suffix="FCFA"
      required
      helperText="💡 Minimum légal: 75,000 FCFA"
    />

    <FormField
      label="Date d'embauche"
      type="date"
      defaultValue={new Date()} // Today
      required
    />

    <Button type="submit" size="lg">
      {isCreating ? 'Création...' : 'Créer mon profil ✅'}
    </Button>
  </Form>

  {status === 'created' && (
    <EmployeeCreatedPreview employee={createdEmployee}>
      ✅ Profil créé

      {/* Show immediate payroll preview */}
      <PayrollPreviewCard>
        <h4>Aperçu de votre paie mensuelle</h4>
        <div>
          <span>Salaire brut:</span>
          <strong>{baseSalary.toLocaleString()} FCFA</strong>
        </div>
        <div>
          <span>CNPS (6.3%):</span>
          <strong>-{cnpsAmount.toLocaleString()} FCFA</strong>
        </div>
        <div>
          <span>ITS:</span>
          <strong>-{itsAmount.toLocaleString()} FCFA</strong>
        </div>
        <div className="total">
          <span>Salaire net:</span>
          <strong>{netSalary.toLocaleString()} FCFA</strong>
        </div>
      </PayrollPreviewCard>
    </EmployeeCreatedPreview>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show "Creating profile... ⏳" instantly
2. **Background Mutation**:
   ```typescript
   await createFirstEmployee({
     firstName, lastName, email, phone,
     positionTitle, baseSalary, hireDate
   })
   // Creates: position, employee, assignment, salary
   // Auto-injects: CNPS, ITS components
   ```
3. **Employee Created**: Full record with salary components
4. **Payroll Calculated**: Immediate preview of net salary
5. **State Updated**: Store employeeId in onboarding state

**What Gets Pre-Filled Downstream:**
- Payroll preview step (already calculated)
- Employee count (1)

**Skip Logic:** Only shown for SOLO path

---

### Q4b: Add your team members 👥 (SMALL_TEAM path)

**UI Design:**
```tsx
<OnboardingQuestion
  title="Ajoutez les membres de votre équipe"
  subtitle="Ajoutez entre 2 et 10 employés"
  progress={{ current: 4, total: 8 }}
>
  {/* Progress indicator */}
  <ProgressCard>
    <Users className="h-8 w-8" />
    <div>
      <strong>{employees.length} employé(s) ajouté(s)</strong>
      <p className="text-sm">Vous pouvez en ajouter jusqu'à 10</p>
    </div>
  </ProgressCard>

  {/* List of added employees */}
  {employees.length > 0 && (
    <EmployeeList>
      {employees.map(emp => (
        <EmployeeCard key={emp.id}>
          <div>
            <strong>{emp.firstName} {emp.lastName}</strong>
            <p>{emp.positionTitle} · {emp.baseSalary.toLocaleString()} FCFA</p>
          </div>
          <Button variant="ghost" onClick={() => removeEmployee(emp.id)}>
            <X />
          </Button>
        </EmployeeCard>
      ))}
    </EmployeeList>
  )}

  {/* Add employee form (inline) */}
  {employees.length < 10 && (
    <EmployeeForm
      onSubmit={async (data) => {
        // Optimistic UI: Add to list immediately
        const tempId = `temp-${Date.now()}`;
        setEmployees([...employees, { ...data, id: tempId, status: 'saving' }]);

        // Background mutation
        const result = await addEmployee.mutateAsync(data);

        // Update with real ID
        setEmployees(prev =>
          prev.map(e => e.id === tempId ? { ...result, status: 'saved' } : e)
        );

        toast.success(`${data.firstName} ${data.lastName} ajouté ✅`);
        resetForm();
      }}
    />
  )}

  {/* Finish button */}
  {employees.length > 0 && (
    <Button size="lg" onClick={handleFinish}>
      Continuer avec {employees.length} employé(s) ✅
    </Button>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered (per employee):**
1. **Optimistic UI**: Add employee to list instantly with "Saving..." badge
2. **Background Mutation**:
   ```typescript
   await addEmployeeToOnboarding({
     firstName, lastName, email, phone,
     positionTitle, baseSalary, hireDate
   })
   // Creates: position, employee, assignment, salary
   ```
3. **Employee Added**: Full record created
4. **UI Updated**: Badge changes from "Saving..." to "✅"
5. **Running Total**: Show "3 employés ajoutés"

**What Gets Pre-Filled Downstream:**
- Payroll preview (all employees calculated)
- Total payroll cost

**Skip Logic:** Only shown for SMALL_TEAM path

---

### Q4c: Upload your employee list 📊 (MEDIUM/LARGE path)

**UI Design:**
```tsx
<OnboardingQuestion
  title="Importez vos employés"
  subtitle="Utilisez notre modèle Excel pour importer en masse"
  progress={{ current: 4, total: 8 }}
>
  {/* Step 1: Download template */}
  <Card className="p-6">
    <FileSpreadsheet className="h-8 w-8" />
    <h4>1. Téléchargez le modèle</h4>
    <p>Modèle Excel avec colonnes pré-configurées</p>
    <Button onClick={downloadTemplate}>
      <Download /> Télécharger le modèle
    </Button>
  </Card>

  {/* Step 2: Upload filled CSV */}
  <Card className="p-6">
    <Upload className="h-8 w-8" />
    <h4>2. Importez votre fichier</h4>
    <FileUpload
      accept=".csv,.xlsx"
      onFileSelect={(file) => {
        // Optimistic UI: Show validation in progress
        setStatus('validating');

        // Background validation
        validateImport.mutate({ file }, {
          onSuccess: (result) => {
            setValidationResult(result);
            setStatus('validated');
          },
        });
      }}
    />
  </Card>

  {/* Step 3: Validation results */}
  {validationResult && (
    <ValidationResults>
      <div className="stats">
        <Stat label="Total lignes" value={validationResult.totalRows} />
        <Stat label="Valides" value={validationResult.validRows} color="green" />
        <Stat label="Erreurs" value={validationResult.invalidRows} color="red" />
      </div>

      {validationResult.errors.length > 0 && (
        <ErrorList errors={validationResult.errors} />
      )}

      {validationResult.validRows > 0 && (
        <Button
          size="lg"
          onClick={async () => {
            // Optimistic UI: Show import progress
            setStatus('importing');

            // Background import
            const result = await importEmployees.mutateAsync({ file });

            setStatus('imported');
            toast.success(`${result.importedCount} employés importés ✅`);
          }}
        >
          Importer {validationResult.validRows} employé(s) ✅
        </Button>
      )}
    </ValidationResults>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show validation progress bar
2. **Background Validation**:
   ```typescript
   const result = await validateEmployeeImport({ csvContent })
   // Returns: validRows, invalidRows, errors[], data[]
   ```
3. **Validation Results**: Shown instantly
4. **Background Import** (if valid):
   ```typescript
   await importEmployeesFromCSV({ csvContent })
   // Creates all employees in bulk
   ```
5. **Import Complete**: Show "47 employés importés ✅"

**What Gets Pre-Filled Downstream:**
- Payroll preview (all employees calculated)
- Department assignments (if provided in CSV)

**Skip Logic:** Only shown for MEDIUM/LARGE path

---

### Q5: How do you pay employees? 💰

**UI Design:**
```tsx
<OnboardingQuestion
  title="Comment payez-vous vos employés ?"
  subtitle="Configurez les composantes de rémunération"
  progress={{ current: 5, total: 8 }}
>
  <CompensationTypeSelector
    options={[
      {
        value: 'fixed_salary',
        icon: '💰',
        label: 'Salaire fixe seulement',
        description: 'Salaire de base uniquement',
      },
      {
        value: 'with_allowances',
        icon: '🎁',
        label: 'Salaire + primes/indemnités',
        description: 'Transport, logement, etc.',
      },
      {
        value: 'with_commissions',
        icon: '📊',
        label: 'Salaire + commissions',
        description: 'Pour les équipes commerciales',
      },
      {
        value: 'full',
        icon: '🎯',
        label: 'Tout ça',
        description: 'Salaire + primes + commissions',
      },
    ]}
    onSelect={(type) => {
      setCompensationType(type);

      if (type === 'fixed_salary') {
        // No additional config needed
        handleNext();
      } else {
        // Show inline form for allowances
        setShowAllowancesForm(true);
      }
    }}
  />

  {/* Inline allowances configuration */}
  {showAllowancesForm && (
    <AllowancesForm>
      <h4>Quelles indemnités offrez-vous ?</h4>

      <CheckboxCard
        icon="🚗"
        label="Transport"
        defaultChecked
        defaultAmount={25000}
        onToggle={(enabled, amount) => {
          // Optimistic UI
          updateAllowance('transport', enabled, amount);
        }}
      />

      <CheckboxCard
        icon="🏠"
        label="Logement"
        defaultChecked
        defaultAmount={50000}
      />

      <CheckboxCard
        icon="🍽️"
        label="Repas"
        defaultAmount={15000}
      />

      <Button
        onClick={async () => {
          // Optimistic UI: Show "Configuring..."
          setStatus('configuring');

          // Background mutation
          await createCompensationComponents({ components: allowances });

          setStatus('configured');
          toast.success('Indemnités configurées ✅');
          handleNext();
        }}
      >
        Continuer ✅
      </Button>
    </AllowancesForm>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show selected type instantly
2. **If "Fixed salary"**:
   - No mutation needed
   - Skip to next question
3. **If allowances/commissions**:
   - Show inline form instantly
   - Background mutation on confirm:
     ```typescript
     await createCompensationComponents({
       components: [
         { type: 'transport', defaultAmount: 25000 },
         { type: 'housing', defaultAmount: 50000 },
       ]
     })
     ```
4. **Components Created**: Available for all employees
5. **Payroll Updated**: Recalculate with new components

**What Gets Pre-Filled Downstream:**
- Employee salary setup (components available)
- Payroll calculations (include components)

**Skip Logic:**
- If "Fixed salary" → Skip component setup
- If allowances → Show inline config

---

### Q6: Track employee hours? ⏰

**UI Design:**
```tsx
<OnboardingQuestion
  title="Voulez-vous suivre le temps de travail ?"
  subtitle="Pointage des heures d'arrivée et de départ"
  progress={{ current: 6, total: 8 }}
>
  <TimeTrackingSelector
    options={[
      {
        value: 'none',
        icon: '❌',
        label: 'Non, pas pour l\'instant',
        description: 'Vous pourrez activer plus tard',
      },
      {
        value: 'basic',
        icon: '⏰',
        label: 'Oui, pointage simple',
        description: 'Entrée et sortie basiques',
      },
      {
        value: 'geofencing',
        icon: '📍',
        label: 'Oui, avec géolocalisation',
        description: 'Pointage uniquement au bureau',
      },
      {
        value: 'overtime',
        icon: '📊',
        label: 'Oui, avec heures supplémentaires',
        description: 'Suivi complet du temps',
      },
    ]}
    onSelect={(type) => {
      setTimeTrackingType(type);

      if (type === 'none') {
        // No config needed
        handleNext();
      } else if (type === 'geofencing') {
        // Show inline geofence config
        setShowGeofenceForm(true);
      } else {
        // Enable basic/overtime tracking
        enableTimeTracking({ type });
        handleNext();
      }
    }}
  />

  {/* Inline geofence configuration */}
  {showGeofenceForm && (
    <GeofenceForm>
      <h4>Où est situé votre bureau ?</h4>

      <LocationPicker
        defaultLocation={companyAddress}
        onLocationSelect={(lat, lng) => {
          setOfficeLocation({ lat, lng });
        }}
      />

      <div>
        <Label>Rayon autorisé</Label>
        <Slider
          min={50}
          max={5000}
          step={50}
          value={[radius]}
          onValueChange={([value]) => setRadius(value)}
        />
        <p className="text-sm">{radius} mètres autour du bureau</p>
      </div>

      <Button
        onClick={async () => {
          // Optimistic UI
          setStatus('configuring');

          // Background mutation
          await updateTenantSettings({
            timeTracking: {
              type: 'geofencing',
              officeLocation,
              radius,
            },
          });

          setStatus('configured');
          toast.success('Géolocalisation configurée ✅');
          handleNext();
        }}
      >
        Continuer ✅
      </Button>
    </GeofenceForm>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show selected option instantly
2. **If "None"**:
   - No mutation needed
   - Skip to next question
3. **If "Basic" or "Overtime"**:
   - Background mutation:
     ```typescript
     await updateTenantSettings({
       timeTracking: { type: 'basic' | 'overtime' }
     })
     ```
   - Enable for all employees
4. **If "Geofencing"**:
   - Show inline map picker
   - Background mutation on confirm:
     ```typescript
     await updateTenantSettings({
       timeTracking: {
         type: 'geofencing',
         officeLocation: { lat, lng },
         radius: 500,
       }
     })
     ```

**What Gets Pre-Filled Downstream:**
- Employee profiles (time tracking enabled)
- Mobile app config (geofence rules)

**Skip Logic:**
- If "None" → Skip config
- If "Geofencing" → Show inline map

---

### Q7: Manage time off? 🏖️

**UI Design:**
```tsx
<OnboardingQuestion
  title="Voulez-vous gérer les congés ?"
  subtitle="Congés payés, permissions, absences"
  progress={{ current: 7, total: 8 }}
>
  <TimeOffSelector
    options={[
      {
        value: 'none',
        icon: '❌',
        label: 'Non, pas pour l\'instant',
        description: 'Vous pourrez activer plus tard',
      },
      {
        value: 'legal_only',
        icon: '✅',
        label: 'Oui, congés légaux seulement',
        description: '2,2 jours par mois (CI)',
      },
      {
        value: 'custom_policies',
        icon: '🎯',
        label: 'Oui, avec politiques personnalisées',
        description: 'Congés maladie, maternité, etc.',
      },
    ]}
    onSelect={async (type) => {
      setTimeOffType(type);

      if (type === 'none') {
        // No config needed
        handleNext();
      } else if (type === 'legal_only') {
        // Optimistic UI: Show auto-config
        setStatus('configuring');

        // Background mutation: Create default policy
        await createTimeOffPolicies({
          policies: [
            {
              name: 'Congés annuels',
              type: 'annual_leave',
              accrualRate: 2.2, // days per month (CI legal)
              requiresApproval: true,
            },
          ],
        });

        setStatus('configured');
        toast.success('Congés légaux configurés ✅ (2.2 jours/mois)');
        handleNext();
      } else {
        // Show inline policy builder
        setShowPolicyForm(true);
      }
    }}
  />

  {/* Inline policy builder */}
  {showPolicyForm && (
    <PolicyForm>
      <h4>Créez vos politiques de congés</h4>

      {/* Default policy (pre-filled) */}
      <PolicyCard
        name="Congés annuels"
        accrualRate={2.2}
        editable
      />

      {/* Additional policies */}
      <Button variant="outline" onClick={addPolicy}>
        + Ajouter une politique
      </Button>

      <Button
        onClick={async () => {
          // Optimistic UI
          setStatus('creating');

          // Background mutation
          await createTimeOffPolicies({ policies });

          setStatus('created');
          toast.success(`${policies.length} politique(s) créée(s) ✅`);
          handleNext();
        }}
      >
        Continuer ✅
      </Button>
    </PolicyForm>
  )}
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show selected option instantly
2. **If "None"**:
   - No mutation needed
   - Skip to next question
3. **If "Legal only"**:
   - Background mutation:
     ```typescript
     await createTimeOffPolicies({
       policies: [{
         name: 'Congés annuels',
         accrualRate: 2.2, // CI legal
       }]
     })
     ```
   - Initialize balances for all employees
   - Show "✅ 2.2 jours/mois configured"
4. **If "Custom policies"**:
   - Show inline policy builder
   - Create multiple policies on confirm

**What Gets Pre-Filled Downstream:**
- Employee time-off balances (initialized)
- Leave request approvals (enabled)

**Skip Logic:**
- If "None" → Skip config
- If "Legal only" → Auto-configure
- If "Custom" → Show inline builder

---

### Q8: When do you pay employees? 📅

**UI Design:**
```tsx
<OnboardingQuestion
  title="Quelle est la fréquence de paie ?"
  subtitle="À quelle fréquence payez-vous vos employés ?"
  progress={{ current: 8, total: 8 }}
>
  <PayrollFrequencySelector
    options={[
      {
        value: 'monthly',
        icon: '📅',
        label: 'Mensuel (fin du mois)',
        description: 'Paiement une fois par mois',
        example: '31 janvier, 28 février, 31 mars...',
      },
      {
        value: 'bi_weekly',
        icon: '📆',
        label: 'Bi-mensuel (2x par mois)',
        description: 'Paiement deux fois par mois',
        example: '15 et 30 de chaque mois',
      },
    ]}
    onSelect={async (frequency) => {
      // Optimistic UI: Show "Calculating payroll..."
      setStatus('calculating');

      // Background mutation
      await updateTenantSettings({ payrollFrequency: frequency });

      // Create first payroll run (draft)
      const payrollRun = await createPayrollRun({
        periodStart: getNextPeriodStart(frequency),
        periodEnd: getNextPeriodEnd(frequency),
        status: 'draft',
      });

      // Calculate preview for all employees
      const preview = await calculatePayrollPreview({ runId: payrollRun.id });

      setPayrollPreview(preview);
      setStatus('calculated');

      // Auto-advance to payroll preview
      router.push('/onboarding/payroll-preview');
    }}
  />
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Optimistic UI**: Show "Calculating payroll..." progress
2. **Background Mutations**:
   ```typescript
   // Update frequency
   await updateTenantSettings({ payrollFrequency: 'monthly' })

   // Create first payroll run (draft)
   const run = await createPayrollRun({
     periodStart: '2025-01-01',
     periodEnd: '2025-01-31',
     status: 'draft'
   })

   // Calculate payroll for all employees
   const preview = await calculatePayrollPreview({ runId: run.id })
   ```
3. **Payroll Calculated**: Full breakdown for all employees
4. **State Updated**: First payroll run ready
5. **Auto-Advance**: Redirect to payroll preview screen

**What Gets Pre-Filled Downstream:**
- Payroll preview (already calculated)
- Payroll schedule (recurring runs)

**Skip Logic:** None (required for all paths)

---

### FINAL: Preview Your First Payroll 📊

**UI Design:**
```tsx
<OnboardingQuestion
  title="Aperçu de votre première paie"
  subtitle={`Paie de ${format(period, 'MMMM yyyy', { locale: fr })}`}
  progress={{ current: 9, total: 9 }}
  showProgress={false} // Hide, this is the final step
>
  {/* Summary cards */}
  <div className="grid grid-cols-2 gap-4">
    <SummaryCard
      label="Employés"
      value={preview.employeeCount}
      icon={<Users />}
    />
    <SummaryCard
      label="Salaires nets"
      value={`${preview.totalNet.toLocaleString()} FCFA`}
      icon={<DollarSign />}
      color="green"
    />
  </div>

  {/* Employee breakdown (collapsible) */}
  <Card>
    <CardHeader>
      <h3>Détail par employé</h3>
    </CardHeader>
    <CardContent>
      {preview.employees.map(emp => (
        <Collapsible key={emp.id}>
          <CollapsibleTrigger>
            <div>
              <strong>{emp.name}</strong>
              <p className="text-sm">Net: {emp.netSalary.toLocaleString()} FCFA</p>
            </div>
            <ChevronDown />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PayrollBreakdown payslip={emp} />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </CardContent>
  </Card>

  {/* Confirmation */}
  <div className="space-y-3">
    <Button
      size="lg"
      onClick={async () => {
        // Mark onboarding complete
        await completeOnboarding();

        // Show confetti
        confetti();

        // Redirect to completion screen
        router.push('/onboarding/complete');
      }}
    >
      C'est correct, continuer ✅
    </Button>

    <Button variant="ghost" onClick={() => router.back()}>
      Modifier les informations
    </Button>
  </div>
</OnboardingQuestion>
```

**Immediate Actions Triggered:**
1. **Display Calculated Payroll**: No network call needed (already calculated in Q8)
2. **On Confirm**:
   ```typescript
   await completeOnboarding()
   // Marks: onboarding_complete = true, onboarding_completed_at = now
   ```
3. **Show Confetti**: Celebratory animation
4. **Redirect**: Go to completion screen

**What Gets Pre-Filled Downstream:**
- Dashboard shows first payroll run (draft)
- User can run payroll immediately

**Skip Logic:** None (required for all paths)

---

## Section 3: Technical Implementation Plan

### 3.1 Files to Modify

#### Backend Service (`features/onboarding/services/onboarding.service.ts`)

**Changes:**
```typescript
// ✅ KEEP (already good):
- getOnboardingState()
- answerQuestion()
- determineOnboardingPath()
- selectCountry()
- setCompanyInfo()
- createFirstEmployee()
- addEmployeeToOnboarding()
- importEmployeesFromCSV()
- createDepartments()

// 🔄 REFACTOR:
// Remove getPathPreview() - no longer needed
// Path is determined immediately after Q3, not shown in separate preview page

// Remove startOnboarding() - no longer needed
// No separate "start" action, just answer questions

// Remove completeStep() - no longer needed
// Steps don't exist anymore, just questions that configure

// ➕ ADD NEW:
export async function createCompensationComponents(input: {
  tenantId: string;
  userId: string;
  components: Array<{
    type: string;
    defaultAmount: number;
  }>;
}) {
  // Create compensation component definitions
  // Store in tenant.settings.compensation_components
}

export async function configureTimeTracking(input: {
  tenantId: string;
  type: 'basic' | 'geofencing' | 'overtime';
  officeLocation?: { lat: number; lng: number };
  radius?: number;
}) {
  // Update tenant.settings.timeTracking
  // Enable for all employees
}

export async function createTimeOffPolicies(input: {
  tenantId: string;
  userId: string;
  policies: Array<{
    name: string;
    type: string;
    accrualRate: number;
  }>;
}) {
  // Create time-off policies
  // Initialize balances for all employees
}

export async function createFirstPayrollRun(input: {
  tenantId: string;
  userId: string;
  frequency: 'monthly' | 'bi_weekly';
}) {
  // Create first payroll run (draft)
  // Calculate preview for all employees
  // Return: payroll run + calculations
}
```

#### tRPC Router (`server/routers/onboarding.ts`)

**Changes:**
```typescript
export const onboardingRouter = createTRPCRouter({
  // ✅ KEEP (already good):
  getQuestionnaireState: publicProcedure.query(...),
  answerQuestion: protectedProcedure.mutation(...),
  selectCountry: protectedProcedure.mutation(...),
  setCompanyInfo: protectedProcedure.mutation(...),
  createFirstEmployee: protectedProcedure.mutation(...),
  addEmployee: protectedProcedure.mutation(...),
  validateEmployeeImport: protectedProcedure.mutation(...),
  importEmployees: protectedProcedure.mutation(...),
  createDepartments: protectedProcedure.mutation(...),

  // ❌ REMOVE (no longer needed):
  // getPathPreview - Path determined in answerQuestion
  // startOnboarding - No separate start action
  // completeStep - No steps, just questions
  // getSummary - Replaced by completion screen query

  // ➕ ADD NEW:
  createCompensationComponents: protectedProcedure
    .input(z.object({
      components: z.array(z.object({
        type: z.string(),
        defaultAmount: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return createCompensationComponents({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        components: input.components,
      });
    }),

  configureTimeTracking: protectedProcedure
    .input(z.object({
      type: z.enum(['basic', 'geofencing', 'overtime']),
      officeLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
      radius: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return configureTimeTracking({
        tenantId: ctx.user.tenantId,
        ...input,
      });
    }),

  createTimeOffPolicies: protectedProcedure
    .input(z.object({
      policies: z.array(z.object({
        name: z.string(),
        type: z.string(),
        accrualRate: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return createTimeOffPolicies({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        policies: input.policies,
      });
    }),

  createFirstPayrollRun: protectedProcedure
    .input(z.object({
      frequency: z.enum(['monthly', 'bi_weekly']),
    }))
    .mutation(async ({ ctx, input }) => {
      return createFirstPayrollRun({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        frequency: input.frequency,
      });
    }),

  getPayrollPreview: protectedProcedure.query(async ({ ctx }) => {
    // Get latest payroll run for tenant
    // Return calculated payroll for all employees
  }),
});
```

---

### 3.2 New Components Needed

#### 1. `<OnboardingQuestion>` Layout (Replaces `OnboardingLayout`)

```tsx
// features/onboarding/components/onboarding-question.tsx

interface OnboardingQuestionProps {
  title: string;
  subtitle: string;
  progress?: { current: number; total: number };
  showProgress?: boolean;
  children: React.ReactNode;
}

export function OnboardingQuestion({
  title,
  subtitle,
  progress = { current: 1, total: 8 },
  showProgress = true,
  children,
}: OnboardingQuestionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 p-4">
      {/* Progress bar */}
      {showProgress && (
        <div className="max-w-2xl mx-auto mb-6">
          <ProgressBar current={progress.current} total={progress.total} />
        </div>
      )}

      {/* Question card */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {children}
        </CardContent>
      </Card>

      {/* Help text */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        Besoin d'aide ? <a href="/support" className="underline">Contactez-nous</a>
      </p>
    </div>
  );
}
```

#### 2. `<CompanySizeSelector>` (Question 3)

```tsx
// features/onboarding/components/company-size-selector.tsx

interface CompanySizeSelectorProps {
  options: Array<{
    value: string;
    icon: string;
    label: string;
    description: string;
    duration: string;
  }>;
  onSelect: (size: string) => void;
}

export function CompanySizeSelector({ options, onSelect }: CompanySizeSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  return (
    <div className="space-y-3">
      {options.map(option => (
        <Card
          key={option.value}
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md",
            selected === option.value && "border-primary border-2"
          )}
          onClick={() => {
            setSelected(option.value);
            setStatus('saving');
            onSelect(option.value);
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">{option.icon}</div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{option.label}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
              <p className="text-xs text-primary mt-1">{option.duration}</p>
            </div>
            {selected === option.value && (
              <div>
                {status === 'saving' && <Loader className="animate-spin" />}
                {status === 'saved' && <Check className="text-green-600" />}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

#### 3. `<EmployeeForm>` (Inline, Embedded in Questions)

```tsx
// features/onboarding/components/employee-form.tsx

interface EmployeeFormProps {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function EmployeeForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Ajouter cet employé',
}: EmployeeFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        setIsSubmitting(true);
        try {
          await onSubmit(data);
        } finally {
          setIsSubmitting(false);
        }
      })}
      className="space-y-4"
    >
      <Input
        label="Prénom"
        {...register('firstName')}
        error={errors.firstName?.message}
        className="min-h-[48px]"
      />

      <Input
        label="Nom"
        {...register('lastName')}
        error={errors.lastName?.message}
        className="min-h-[48px]"
      />

      {/* ... other fields */}

      <Button type="submit" disabled={isSubmitting} className="w-full min-h-[48px]">
        {isSubmitting ? 'Ajout...' : submitLabel}
      </Button>

      {onCancel && (
        <Button variant="ghost" onClick={onCancel} className="w-full">
          Annuler
        </Button>
      )}
    </form>
  );
}
```

#### 4. `<AllowancesForm>` (Inline Compensation Config)

```tsx
// features/onboarding/components/allowances-form.tsx

export function AllowancesForm({ onComplete }: { onComplete: (allowances: Allowance[]) => void }) {
  const [allowances, setAllowances] = useState([
    { type: 'transport', enabled: true, amount: 25000 },
    { type: 'housing', enabled: true, amount: 50000 },
    { type: 'meal', enabled: false, amount: 15000 },
  ]);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Quelles indemnités offrez-vous ?</h4>

      {allowances.map((allowance, idx) => (
        <CheckboxCard
          key={allowance.type}
          icon={ALLOWANCE_ICONS[allowance.type]}
          label={ALLOWANCE_LABELS[allowance.type]}
          checked={allowance.enabled}
          amount={allowance.amount}
          onToggle={(enabled, amount) => {
            const updated = [...allowances];
            updated[idx] = { ...updated[idx], enabled, amount };
            setAllowances(updated);
          }}
        />
      ))}

      <Button
        onClick={() => onComplete(allowances.filter(a => a.enabled))}
        className="w-full min-h-[48px]"
      >
        Continuer ✅
      </Button>
    </div>
  );
}
```

#### 5. `<GeofenceForm>` (Inline Time Tracking Config)

```tsx
// features/onboarding/components/geofence-form.tsx

export function GeofenceForm({ onComplete }: { onComplete: (config: GeofenceConfig) => void }) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(500);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Où est situé votre bureau ?</h4>

      <LocationPicker
        onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
      />

      <div>
        <Label>Rayon autorisé</Label>
        <Slider
          min={50}
          max={5000}
          step={50}
          value={[radius]}
          onValueChange={([value]) => setRadius(value)}
        />
        <p className="text-sm text-muted-foreground">
          {radius} mètres autour du bureau
        </p>
      </div>

      <Button
        disabled={!location}
        onClick={() => onComplete({ location: location!, radius })}
        className="w-full min-h-[48px]"
      >
        Continuer ✅
      </Button>
    </div>
  );
}
```

---

### 3.3 State Management Updates

#### Current State (tenant.settings.onboarding):

```typescript
{
  questionnaire_complete: boolean;
  questionnaire_answers: {
    company_size: 'solo' | 'small_team' | 'medium' | 'large';
    has_departments: boolean;
    // ... other answers
  };
  current_step: string | null;
  completed_steps: string[];
  path: 'SOLO' | 'SMALL_TEAM' | 'MEDIUM' | 'LARGE';
  onboarding_complete: boolean;
  onboarding_completed_at: string | null;
}
```

#### Proposed State (simplified):

```typescript
{
  // ❌ Remove questionnaire tracking (no longer separate phase)
  // questionnaire_complete: boolean;
  // questionnaire_answers: {...};

  // ❌ Remove step tracking (no steps, just questions)
  // current_step: string | null;
  // completed_steps: string[];

  // ✅ Keep essential state
  path: 'SOLO' | 'SMALL_TEAM' | 'MEDIUM' | 'LARGE';
  onboarding_complete: boolean;
  onboarding_completed_at: string | null;

  // ✅ Add question progress
  current_question: number; // 1-8

  // ✅ Add configuration state
  configured: {
    country: boolean;
    company_info: boolean;
    employees: boolean;
    compensation: boolean;
    time_tracking: boolean;
    time_off: boolean;
    payroll_frequency: boolean;
  };
}
```

#### State Updates (per question):

```typescript
// Q1: Country
await selectCountry({ countryCode: 'CI' })
// Updates: tenant.countryCode, tenant.currency
// State: configured.country = true, current_question = 2

// Q2: Company Info
await updateTenant({ name, industry, taxId })
// Updates: tenant.name, tenant.industry, tenant.taxId
// State: configured.company_info = true, current_question = 3

// Q3: Company Size
await answerQuestion({ questionId: 'company_size', answer: 'small_team' })
// Updates: onboarding.path = 'SMALL_TEAM'
// State: current_question = 4

// Q4: Employees
await addEmployeeToOnboarding({ ... }) × N
// Creates: employees, positions, assignments, salaries
// State: configured.employees = true, current_question = 5

// Q5: Compensation
await createCompensationComponents({ ... })
// Creates: compensation components
// State: configured.compensation = true, current_question = 6

// Q6: Time Tracking
await configureTimeTracking({ ... })
// Updates: tenant.settings.timeTracking
// State: configured.time_tracking = true, current_question = 7

// Q7: Time Off
await createTimeOffPolicies({ ... })
// Creates: time-off policies
// State: configured.time_off = true, current_question = 8

// Q8: Payroll Frequency
await createFirstPayrollRun({ frequency: 'monthly' })
// Creates: first payroll run (draft)
// State: configured.payroll_frequency = true, current_question = 9 (final)
```

---

### 3.4 Optimistic UI Patterns

#### Pattern 1: Instant Selection Feedback

```tsx
const [selected, setSelected] = useState<string | null>(null);
const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

const selectCountry = api.onboarding.selectCountry.useMutation();

const handleSelect = async (countryCode: string) => {
  // Optimistic UI: Update immediately
  setSelected(countryCode);
  setStatus('saving');

  try {
    // Background mutation
    await selectCountry.mutateAsync({ countryCode });

    // Success
    setStatus('saved');

    // Auto-advance to next question after 500ms
    setTimeout(() => router.push('/onboarding/q2'), 500);
  } catch (error) {
    // Rollback on error
    setSelected(null);
    setStatus('error');
    toast.error(error.message);
  }
};

// UI Feedback
{status === 'saving' && <Loader className="animate-spin" />}
{status === 'saved' && <Check className="text-green-600" />}
{status === 'error' && <AlertCircle className="text-red-600" />}
```

#### Pattern 2: List Updates with Temp IDs

```tsx
const [employees, setEmployees] = useState<Employee[]>([]);
const addEmployee = api.onboarding.addEmployee.useMutation();

const handleAddEmployee = async (data: EmployeeFormData) => {
  // Generate temp ID
  const tempId = `temp-${Date.now()}`;

  // Optimistic UI: Add to list immediately with "Saving..." badge
  setEmployees([
    ...employees,
    { ...data, id: tempId, status: 'saving' }
  ]);

  try {
    // Background mutation
    const result = await addEmployee.mutateAsync(data);

    // Replace temp with real employee
    setEmployees(prev =>
      prev.map(e => e.id === tempId ? { ...result, status: 'saved' } : e)
    );

    toast.success(`${data.firstName} ${data.lastName} ajouté ✅`);
  } catch (error) {
    // Remove from list on error
    setEmployees(prev => prev.filter(e => e.id !== tempId));
    toast.error(error.message);
  }
};

// UI Badge
{employee.status === 'saving' && <Badge variant="secondary">Sauvegarde...</Badge>}
{employee.status === 'saved' && <Badge variant="success">✅</Badge>}
```

#### Pattern 3: Progressive Enhancement (Form → Preview)

```tsx
const [showPreview, setShowPreview] = useState(false);
const [payrollPreview, setPayrollPreview] = useState(null);

const createPayrollRun = api.onboarding.createFirstPayrollRun.useMutation();

const handleSubmit = async (frequency: string) => {
  // Show loading state
  setShowPreview(false);
  toast.loading('Calcul de la paie...');

  try {
    // Background mutation
    const result = await createPayrollRun.mutateAsync({ frequency });

    // Show preview immediately
    setPayrollPreview(result.preview);
    setShowPreview(true);

    toast.dismiss();
    toast.success('Paie calculée ✅');
  } catch (error) {
    toast.dismiss();
    toast.error(error.message);
  }
};

// UI
{!showPreview && <FrequencySelector onSelect={handleSubmit} />}
{showPreview && <PayrollPreview data={payrollPreview} />}
```

---

### 3.5 Backend API Changes

#### Service Function Signature Updates

**Before:**
```typescript
// Separate step completion
export async function completeStep(tenantId: string, stepId: string): Promise<OnboardingState>

// Path preview generation
export async function getPathPreview(tenantId: string): Promise<PathPreview>
```

**After:**
```typescript
// ❌ Remove completeStep() - no longer needed
// ❌ Remove getPathPreview() - path determined in answerQuestion()

// ✅ Add new configuration functions
export async function createCompensationComponents(input: CreateCompensationComponentsInput)
export async function configureTimeTracking(input: ConfigureTimeTrackingInput)
export async function createTimeOffPolicies(input: CreateTimeOffPoliciesInput)
export async function createFirstPayrollRun(input: CreateFirstPayrollRunInput)
```

#### Database Operations (Batching for Performance)

**Current (Sequential):**
```typescript
// Each employee = separate network call
for (const employee of employees) {
  await addEmployee(employee); // 1 round-trip each
}
// Total: N round-trips for N employees
```

**Proposed (Batched):**
```typescript
// Client: Queue mutations optimistically
const mutations = employees.map(emp => ({
  type: 'addEmployee',
  data: emp,
  tempId: `temp-${Date.now()}-${Math.random()}`,
}));

// Client: Update UI optimistically (all at once)
setEmployees(mutations.map(m => ({ ...m.data, id: m.tempId, status: 'saving' })));

// Server: Batch insert
await db.transaction(async (tx) => {
  for (const employee of employees) {
    await tx.insert(employees).values(employee);
    await tx.insert(positions).values(position);
    await tx.insert(assignments).values(assignment);
    await tx.insert(employeeSalaries).values(salary);
  }
});
// Total: 1 round-trip for N employees ✅
```

**Implementation:**
```typescript
export async function batchAddEmployees(input: {
  tenantId: string;
  userId: string;
  employees: Array<{
    firstName: string;
    lastName: string;
    // ... other fields
  }>;
}) {
  return await db.transaction(async (tx) => {
    const results = [];

    for (const empData of input.employees) {
      // Create all related records for this employee
      const position = await tx.insert(positions).values({ ... }).returning();
      const employee = await tx.insert(employees).values({ ... }).returning();
      const assignment = await tx.insert(assignments).values({ ... }).returning();
      const salary = await tx.insert(employeeSalaries).values({ ... }).returning();

      results.push({ employee, position, assignment, salary });
    }

    return results;
  });
}
```

---

### 3.6 Migration Strategy

#### Phase 1: Backend (Week 1)
- [ ] Add new service functions (createCompensationComponents, etc.)
- [ ] Add new tRPC endpoints
- [ ] Add batchAddEmployees for performance
- [ ] Keep existing functions (for backward compatibility)
- [ ] Test all new endpoints

#### Phase 2: Frontend Components (Week 2)
- [ ] Create `<OnboardingQuestion>` layout component
- [ ] Create selector components (CompanySizeSelector, etc.)
- [ ] Create inline form components (AllowancesForm, GeofenceForm, etc.)
- [ ] Test components in isolation (Storybook)

#### Phase 3: Question Pages (Week 3)
- [ ] Create `/app/onboarding/q1/page.tsx` (Country)
- [ ] Create `/app/onboarding/q2/page.tsx` (Company Info)
- [ ] Create `/app/onboarding/q3/page.tsx` (Company Size)
- [ ] Create `/app/onboarding/q4/page.tsx` (Employees - adaptive)
- [ ] Create `/app/onboarding/q5/page.tsx` (Compensation)
- [ ] Create `/app/onboarding/q6/page.tsx` (Time Tracking)
- [ ] Create `/app/onboarding/q7/page.tsx` (Time Off)
- [ ] Create `/app/onboarding/q8/page.tsx` (Payroll Frequency)
- [ ] Create `/app/onboarding/payroll-preview/page.tsx` (Final preview)

#### Phase 4: Optimistic UI (Week 4)
- [ ] Add optimistic updates to all mutations
- [ ] Add loading/success/error states
- [ ] Add rollback on error
- [ ] Test network failures

#### Phase 5: Cleanup (Week 5)
- [ ] Remove old questionnaire page
- [ ] Remove old preview page
- [ ] Remove old step template
- [ ] Remove unused service functions
- [ ] Update routing logic
- [ ] Update documentation

#### Phase 6: Testing & Validation (Week 6)
- [ ] E2E test: SOLO path (< 10 min)
- [ ] E2E test: SMALL_TEAM path (< 8 min)
- [ ] E2E test: MEDIUM path (< 12 min)
- [ ] E2E test: LARGE path (< 15 min)
- [ ] Test network failures (offline, slow 3G)
- [ ] Test on mobile devices
- [ ] User testing with 5 non-technical users

---

## Section 4: HCI Compliance Checklist

### HCI Principle #1: Zero Learning Curve ✅

**How Addressed:**
- Questions use plain French, no jargon ("Combien de personnes travaillent ici ?" not "Configure organization structure")
- Visual icons for every option (🏢, 👥, 💰, etc.)
- Inline help text shows what happens ("Configuration automatique: CNPS 6.3%")
- Immediate feedback shows what was configured (checkmarks, previews)

**Specific Improvements Over Current:**
- No separate "path preview" step to understand
- No need to learn "steps" concept
- Configuration happens as you answer, no mental model of "later steps" needed

---

### HCI Principle #2: Task-Oriented Design ✅

**How Addressed:**
- Questions focused on business goals:
  - "Where is your company?" (not "Configure country code")
  - "How many people work here?" (not "Select organization size")
  - "How do you pay employees?" (not "Configure compensation components")
- Actions are business outcomes, not system operations:
  - "Add employee" creates full profile (not "Create employee record")
  - "Configure time tracking" enables feature (not "Update tenant settings")

**Specific Improvements Over Current:**
- Eliminated system-oriented language ("complete step", "start onboarding")
- Every question = user's business need, not system requirement

---

### HCI Principle #3: Error Prevention Over Error Handling ✅

**How Addressed:**
- Country selection loads correct rules (can't misconfigure)
- Salary validation uses country-specific minimum (can't enter invalid amount)
- Employee CSV validation before import (can't import invalid data)
- Geofence radius has slider with min/max (can't enter invalid value)
- Pre-filled defaults reduce typing errors (hireDate = today, position = "Propriétaire")

**Specific Improvements Over Current:**
- Fewer free-text fields (more selections)
- More smart defaults (less user input required)
- Inline validation (immediate feedback, not on submit)

---

### HCI Principle #4: Cognitive Load Minimization ✅

**How Addressed:**
- Progressive disclosure: One question at a time (not 7 on one page)
- Only show relevant configuration (compensation only if selected)
- Inline forms embedded in questions (no context switching)
- Collapsible details in payroll preview (show total, hide breakdown)

**Specific Improvements Over Current:**
- **Eliminated "path preview" screen** - reduces cognitive load (no need to understand entire flow upfront)
- **No separate steps** - reduces mental model complexity
- **Inline configuration** - no need to remember "I'll configure this later"

---

### HCI Principle #5: Immediate Feedback ✅

**How Addressed:**
- Optimistic UI: Every selection shows checkmark instantly
- Background mutations: Network calls happen after UI updates
- Progress indicators: Show "Saving...", "Saved ✅", "Error ❌"
- Live previews: Payroll calculation shows immediately after employee entry
- Running totals: "3 employés ajoutés" updates in real-time

**Specific Improvements Over Current:**
- **Zero network delays** - UI updates instantly, saves in background
- **Visible progress** - Every action shows immediate result
- **No waiting** - Configuration happens as you answer, not at the end

---

### HCI Principle #6: Graceful Degradation ✅

**How Addressed:**
- Optimistic UI works offline (updates UI first)
- Background mutations queue and retry (network failures handled)
- Local state persists (can resume if interrupted)
- Progressive enhancement (works without JS for basic flow)

**Specific Improvements Over Current:**
- **Batched mutations** - Fewer network calls = more resilient to slow connections
- **Optimistic updates** - Works even on 3G (doesn't wait for server)
- **Rollback on error** - Graceful handling of network failures

---

### Mobile-First Design ✅

**How Addressed:**
- Touch targets ≥ 48px (all buttons, cards)
- Single-column layout (easy one-handed use)
- Large text (text-lg for labels, text-2xl for titles)
- Minimal scrolling per question (one screen per question)
- Bottom-sticky CTA buttons (thumb-friendly)

**Specific Improvements Over Current:**
- **No separate preview screen** - reduces scrolling
- **Inline forms** - no navigation between pages
- **Fewer steps** - less back-and-forth on small screens

---

### French Language & Business Terms ✅

**How Addressed:**
- 100% French UI (no English, no tech terms)
- Business language ("employés" not "resources", "paie" not "payroll run")
- Contextual help in French ("💡 Minimum légal: 75,000 FCFA")
- Error messages in French with actionable fixes

**Specific Improvements Over Current:**
- **More conversational** - Questions feel like dialogue, not forms
- **Business-focused** - Language matches user's reality (boutique, commerce, salaire)

---

## Validation Questions for User

Before implementing, please confirm:

1. **Flow Philosophy**: Do you agree that **every question should configure something immediately**, not just collect data?

2. **Redundancy Elimination**: Should we **pre-fill company name from signup** (Q2), or still ask user to re-enter?

3. **Path Preview**: Should we **eliminate the separate "path preview" page** and just show adaptive UI as users answer?

4. **Optimistic UI**: Are you comfortable with **optimistic updates** (UI changes before server confirms)? This requires rollback logic if mutations fail.

5. **Inline Forms**: Should compensation/time tracking config be **embedded in questions** (as proposed), or still separate steps?

6. **Completion Time**: Target completion time is **10 minutes for small teams**. Is this acceptable, or should we aim for <5 minutes?

7. **Migration**: Should we **replace current flow entirely**, or run both in parallel (A/B test)?

---

## Next Steps (After Validation)

1. **Validate Design**: User confirms approach (this document)
2. **Create Wireframes**: Design mockups for each question (Figma)
3. **Implement Backend**: Add new service functions (Week 1)
4. **Build Components**: Create UI components (Week 2)
5. **Build Pages**: Create question pages (Week 3)
6. **Add Optimistic UI**: Implement instant feedback (Week 4)
7. **Test & Iterate**: E2E tests + user testing (Week 5-6)
8. **Deploy**: Gradual rollout (10% → 50% → 100%)

---

**Questions? Feedback?** Please review and provide feedback before we proceed with implementation.
