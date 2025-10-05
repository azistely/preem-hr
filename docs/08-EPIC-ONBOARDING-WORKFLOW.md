# 🚀 EPIC: Guided Onboarding Workflow (Signup to First Payroll)

## Epic Overview

**Goal:** Create a zero-to-hero onboarding experience that guides a new company from signup through their first payroll run, optimized for low digital literacy users.

**Priority:** P0 (Must-have for MVP - first user experience)

**Source Documents:**
- `01-CONSTRAINTS-AND-RULES.md` - UX constraints for low literacy
- `02-ARCHITECTURE-OVERVIEW.md` - Workflow engine patterns
- `03-DATABASE-SCHEMA.md` - Tenants, employees, positions, payroll tables

**User Journey:**
```
Signup → Company Setup → First Employee → Position → Salary → First Payroll → Success
```

**Dependencies:**
- Multi-tenant infrastructure
- Employee management system
- Payroll calculation engine
- Workflow engine (basic)

---

## Success Criteria

- [x] Complete onboarding in < 15 minutes (for 1 employee)
- [x] Zero prior HR/payroll knowledge required
- [x] French-only UI with simple language
- [x] Mobile-responsive (works on phone)
- [x] Progressive disclosure (one step at a time)
- [x] Contextual help at each step
- [x] Can resume if interrupted
- [x] First payroll run successful
- [x] Clear visual progress indicator

---

## Features & User Stories

### FEATURE 1: Company Registration

#### Story 1.1: Create Account (Signup)
**As a** new user
**I want** to create an account
**So that** I can start using Preem

**Acceptance Criteria:**
- [ ] Marketing homepage in French
- [ ] Simple signup form (email, password, company name)
- [ ] Email verification
- [ ] Create tenant record
- [ ] Create user with role 'tenant_admin'
- [ ] Set trial period (30 days)
- [ ] Redirect to onboarding flow
- [ ] Large touch targets (min 44x44px)
- [ ] Simple labels: "Créer mon compte"

**Test Cases:**
```typescript
describe('Company Registration', () => {
  it('should create tenant and admin user', async () => {
    const result = await caller.auth.signup({
      email: 'patron@maboutique.ci',
      password: 'MotDePasse123!',
      companyName: 'Ma Boutique',
    });

    expect(result.tenant.id).toBeDefined();
    expect(result.tenant.name).toBe('Ma Boutique');
    expect(result.tenant.slug).toBe('ma-boutique');
    expect(result.tenant.plan).toBe('trial');
    expect(result.tenant.trial_ends_at).toBeDefined();

    expect(result.user.role).toBe('tenant_admin');
    expect(result.user.tenant_id).toBe(result.tenant.id);
  });

  it('should validate email format', async () => {
    await expect(
      caller.auth.signup({
        email: 'invalid-email',
        password: 'Password123!',
        companyName: 'Test Co',
      })
    ).rejects.toThrow('Email invalide');
  });

  it('should enforce password strength', async () => {
    await expect(
      caller.auth.signup({
        email: 'test@example.com',
        password: '12345', // Too weak
        companyName: 'Test Co',
      })
    ).rejects.toThrow('Le mot de passe doit contenir au moins 8 caractères');
  });

  it('should prevent duplicate email', async () => {
    await caller.auth.signup({
      email: 'existing@example.com',
      password: 'Password123!',
      companyName: 'First Co',
    });

    await expect(
      caller.auth.signup({
        email: 'existing@example.com',
        password: 'Password123!',
        companyName: 'Second Co',
      })
    ).rejects.toThrow('Cet email est déjà utilisé');
  });

  it('should generate unique tenant slug', async () => {
    const tenant1 = await createTenant({ name: 'Ma Boutique' });
    expect(tenant1.slug).toBe('ma-boutique');

    const tenant2 = await createTenant({ name: 'Ma Boutique' }); // Duplicate name
    expect(tenant2.slug).toBe('ma-boutique-2');
  });
});
```

**UI Design (Mobile-First):**
```tsx
// Marketing homepage
export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50">
      {/* Hero section */}
      <section className="px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Gérez votre paie facilement
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Solution simple de paie et RH pour la Côte d'Ivoire
        </p>

        <Link
          href="/signup"
          className="inline-block bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-700 min-h-[44px]"
        >
          Créer mon compte gratuitement
        </Link>

        <p className="mt-4 text-sm text-gray-500">
          Essai gratuit 30 jours · Pas de carte bancaire requise
        </p>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="💰"
            title="Calcul de paie automatique"
            description="Salaire brut, CNPS, ITS calculés automatiquement"
          />
          <FeatureCard
            icon="👥"
            title="Gestion des employés"
            description="Ajoutez et gérez vos employés facilement"
          />
          <FeatureCard
            icon="⏰"
            title="Pointage mobile"
            description="Vos employés pointent depuis leur téléphone"
          />
        </div>
      </section>
    </div>
  );
}

// Signup form
export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-bold">Créer mon compte</h2>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <FormField
              name="companyName"
              label="Nom de votre entreprise"
              placeholder="Ex: Ma Boutique"
              required
            />

            <FormField
              name="email"
              type="email"
              label="Votre email"
              placeholder="patron@maboutique.ci"
              required
            />

            <FormField
              name="password"
              type="password"
              label="Mot de passe"
              placeholder="Au moins 8 caractères"
              required
            />

            <Button
              type="submit"
              className="w-full min-h-[44px] text-lg"
              disabled={isLoading}
            >
              {isLoading ? 'Création...' : 'Créer mon compte'}
            </Button>
          </Form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-orange-600 underline">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### FEATURE 2: Guided Onboarding Steps

#### Story 2.1: Welcome & Country Selection
**As a** new user (after signup)
**I want** to select my country
**So that** payroll rules are configured correctly

**Acceptance Criteria:**
- [ ] Welcome screen with friendly message
- [ ] Country selector (start with CI only, expand later)
- [ ] Load country-specific rules (CNPS rates, ITS brackets, SMIG)
- [ ] Set tenant.country_code
- [ ] Show visual progress: Step 1/6
- [ ] Simple French: "Où est située votre entreprise ?"

**Test Cases:**
```typescript
describe('Onboarding - Country Selection', () => {
  it('should load Côte d\'Ivoire rules', async () => {
    const result = await caller.onboarding.selectCountry({
      tenantId: tenant.id,
      countryCode: 'CI',
    });

    expect(result.tenant.country_code).toBe('CI');
    expect(result.tenant.currency).toBe('XOF');

    // Check rules loaded
    const rules = await db.query.countries.findFirst({
      where: eq(countries.code, 'CI'),
    });

    expect(rules.payroll_rules.smig).toBe(75000);
    expect(rules.contribution_rates.pension.employee).toBe(0.063);
  });

  it('should show only active countries', async () => {
    const countries = await caller.onboarding.getAvailableCountries();

    expect(countries).toEqual([
      { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
      // Future: BJ, SN, BF, ML, etc.
    ]);
  });
});
```

**UI Design:**
```tsx
export function CountrySelectionStep() {
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Où est située votre entreprise ?"
      step={1}
      totalSteps={6}
    >
      <div className="space-y-4">
        <p className="text-gray-600">
          Sélectionnez le pays pour configurer automatiquement les règles de paie.
        </p>

        <RadioGroup>
          <RadioCard
            value="CI"
            icon="🇨🇮"
            title="Côte d'Ivoire"
            description="CNPS, ITS, SMIG 75 000 FCFA"
            className="min-h-[60px]" // Large touch target
          />

          {/* Future countries */}
          <RadioCard
            value="SN"
            icon="🇸🇳"
            title="Sénégal"
            description="Bientôt disponible"
            disabled
          />
        </RadioGroup>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

#### Story 2.2: Company Information
**As a** new user
**I want** to provide company details
**So that** documents and reports are properly labeled

**Acceptance Criteria:**
- [ ] Collect company info (legal name, industry, tax ID)
- [ ] Optional fields clearly marked
- [ ] Validate tax ID format (if provided)
- [ ] Update tenant record
- [ ] Show progress: Step 2/6
- [ ] Simple labels, no jargon

**Test Cases:**
```typescript
describe('Onboarding - Company Info', () => {
  it('should update tenant with company details', async () => {
    const result = await caller.onboarding.setCompanyInfo({
      tenantId: tenant.id,
      legalName: 'Ma Boutique SARL',
      industry: 'commerce',
      taxId: 'CI-123456789',
      address: 'Abidjan, Cocody',
    });

    expect(result.tenant.name).toBe('Ma Boutique SARL');
    expect(result.tenant.tax_id).toBe('CI-123456789');
    expect(result.tenant.industry).toBe('commerce');
  });

  it('should validate tax ID format', async () => {
    await expect(
      caller.onboarding.setCompanyInfo({
        tenantId: tenant.id,
        legalName: 'Test Co',
        taxId: 'INVALID', // Wrong format
      })
    ).rejects.toThrow('Numéro d\'identification fiscale invalide');
  });
});
```

#### Story 2.3: Add First Employee
**As a** new user
**I want** to add my first employee (or myself)
**So that** I can run payroll

**Acceptance Criteria:**
- [ ] Simple form: Name, email, hire date, salary
- [ ] Pre-fill owner as first employee option
- [ ] Validate salary >= SMIG (75,000)
- [ ] Create employee record
- [ ] Skip complex fields (bank account, etc.) for now
- [ ] Show progress: Step 3/6
- [ ] Encouragement: "Bravo ! Vous avez ajouté votre premier employé 🎉"

**Test Cases:**
```typescript
describe('Onboarding - First Employee', () => {
  it('should add first employee with minimal info', async () => {
    const result = await caller.onboarding.addFirstEmployee({
      tenantId: tenant.id,
      firstName: 'Kouadio',
      lastName: 'Yao',
      email: 'kouadio@maboutique.ci',
      hireDate: new Date('2025-01-01'),
      baseSalary: 200000,
    });

    expect(result.employee.id).toBeDefined();
    expect(result.employee.employee_number).toBe('EMP-000001');
    expect(result.employee.status).toBe('active');

    // Check salary created
    const salary = await db.query.employee_salaries.findFirst({
      where: eq(employee_salaries.employee_id, result.employee.id),
    });
    expect(salary.base_salary).toBe(200000);
  });

  it('should pre-fill owner info', async () => {
    const prefilled = await caller.onboarding.getPrefillData({
      tenantId: tenant.id,
    });

    expect(prefilled.firstName).toBe(tenant.created_by.first_name);
    expect(prefilled.email).toBe(tenant.created_by.email);
  });

  it('should validate SMIG minimum', async () => {
    await expect(
      caller.onboarding.addFirstEmployee({
        tenantId: tenant.id,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        hireDate: new Date('2025-01-01'),
        baseSalary: 50000, // Below SMIG
      })
    ).rejects.toThrow('Le salaire doit être au moins 75 000 FCFA (SMIG)');
  });
});
```

**UI Design:**
```tsx
export function AddFirstEmployeeStep() {
  const { nextStep } = useOnboarding();
  const { data: prefill } = api.onboarding.getPrefillData.useQuery();

  return (
    <OnboardingLayout
      title="Ajoutez votre premier employé"
      step={3}
      totalSteps={6}
    >
      <div className="space-y-4">
        <HelpBox>
          💡 Vous pouvez vous ajouter vous-même comme employé
        </HelpBox>

        <Form>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              name="firstName"
              label="Prénom"
              defaultValue={prefill?.firstName}
              required
            />
            <FormField
              name="lastName"
              label="Nom"
              defaultValue={prefill?.lastName}
              required
            />
          </div>

          <FormField
            name="email"
            type="email"
            label="Email"
            defaultValue={prefill?.email}
            required
          />

          <FormField
            name="hireDate"
            type="date"
            label="Date d'embauche"
            defaultValue={new Date()}
            required
          />

          <FormField
            name="baseSalary"
            type="number"
            label="Salaire mensuel (FCFA)"
            placeholder="Minimum 75 000 FCFA"
            hint="Le SMIG en Côte d'Ivoire est de 75 000 FCFA"
            min={75000}
            required
          />

          <Button onClick={nextStep} className="w-full min-h-[44px]">
            Continuer
          </Button>
        </Form>
      </div>
    </OnboardingLayout>
  );
}
```

#### Story 2.4: Create First Position
**As a** new user
**I want** to define a position for the employee
**So that** org structure is clear

**Acceptance Criteria:**
- [ ] Simple position form: Title, department
- [ ] Auto-create position from employee context
- [ ] Default to "Gérant" if owner
- [ ] Create position record
- [ ] Create assignment (employee → position)
- [ ] Show progress: Step 4/6
- [ ] Skip if too complex, allow later

**Test Cases:**
```typescript
describe('Onboarding - First Position', () => {
  it('should create position and assign employee', async () => {
    const employee = await createTestEmployee();

    const result = await caller.onboarding.createFirstPosition({
      tenantId: tenant.id,
      employeeId: employee.id,
      title: 'Gérant',
      departmentName: 'Direction',
    });

    expect(result.position.title).toBe('Gérant');
    expect(result.department.name).toBe('Direction');

    // Check assignment created
    const assignment = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.employee_id, employee.id),
        eq(assignments.position_id, result.position.id)
      ),
    });
    expect(assignment).toBeDefined();
  });

  it('should auto-suggest "Gérant" for owner', async () => {
    const suggestion = await caller.onboarding.suggestPosition({
      tenantId: tenant.id,
      isOwner: true,
    });

    expect(suggestion.title).toBe('Gérant');
    expect(suggestion.department).toBe('Direction');
  });
});
```

#### Story 2.5: Review First Payroll Calculation
**As a** new user
**I want** to see a preview of the first payroll
**So that** I understand what will be paid

**Acceptance Criteria:**
- [ ] Calculate payroll for first employee (current month)
- [ ] Show breakdown:
  - Salaire brut
  - CNPS (employee + employer)
  - CMU
  - ITS
  - Salaire net
  - Coût total
- [ ] Visual breakdown (progress bars, colors)
- [ ] Explanation tooltips
- [ ] Show progress: Step 5/6
- [ ] "Aperçu de votre première paie"

**Test Cases:**
```typescript
describe('Onboarding - Payroll Preview', () => {
  it('should calculate preview for first employee', async () => {
    const employee = await createTestEmployee({ baseSalary: 300000 });

    const preview = await caller.onboarding.previewPayroll({
      tenantId: tenant.id,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    });

    expect(preview.employees).toHaveLength(1);

    const emp = preview.employees[0];
    expect(emp.grossSalary).toBe(300000);
    expect(emp.cnpsEmployee).toBe(18900); // 6.3%
    expect(emp.cmuEmployee).toBe(1000);
    expect(emp.its).toBeCloseTo(60815, 0);
    expect(emp.netSalary).toBeCloseTo(219285, 0);
    expect(emp.employerCost).toBeGreaterThan(300000);
  });

  it('should show explanation for each component', async () => {
    const explanations = await caller.onboarding.getPayrollExplanations();

    expect(explanations).toEqual({
      cnpsEmployee: 'Cotisation retraite (6,3% du salaire brut)',
      cnpsEmployer: 'Cotisation retraite employeur (7,7%)',
      cmu: 'Couverture maladie universelle (1 000 FCFA)',
      its: 'Impôt sur les traitements et salaires (progressif)',
      netSalary: 'Salaire à verser à l\'employé',
      employerCost: 'Coût total pour l\'entreprise',
    });
  });
});
```

**UI Design:**
```tsx
export function PayrollPreviewStep() {
  const { data: preview } = api.onboarding.previewPayroll.useQuery();
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Aperçu de votre première paie"
      step={5}
      totalSteps={6}
    >
      <div className="space-y-6">
        <HelpBox>
          💡 Voici le calcul automatique de la paie pour {preview.employees[0].name}
        </HelpBox>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Détail de la paie</h3>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Gross Salary */}
            <PayrollLine
              label="Salaire brut"
              amount={preview.employees[0].grossSalary}
              color="green"
              tooltip="Salaire de base + primes + heures supplémentaires"
            />

            {/* Deductions */}
            <div className="pl-4 border-l-2 border-red-200 space-y-2">
              <PayrollLine
                label="CNPS employé (6,3%)"
                amount={-preview.employees[0].cnpsEmployee}
                color="red"
                tooltip="Cotisation retraite déduite du salaire"
              />

              <PayrollLine
                label="CMU"
                amount={-preview.employees[0].cmuEmployee}
                color="red"
                tooltip="Couverture maladie universelle (fixe)"
              />

              <PayrollLine
                label="ITS"
                amount={-preview.employees[0].its}
                color="red"
                tooltip="Impôt sur les traitements et salaires"
              />
            </div>

            {/* Net Salary */}
            <Separator />
            <PayrollLine
              label="Salaire net"
              amount={preview.employees[0].netSalary}
              color="blue"
              size="lg"
              tooltip="Montant à verser à l'employé"
            />

            {/* Employer Cost */}
            <Separator />
            <PayrollLine
              label="Coût total entreprise"
              amount={preview.employees[0].employerCost}
              color="purple"
              tooltip="Salaire brut + cotisations patronales"
            />
          </CardContent>
        </Card>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

#### Story 2.6: Complete Onboarding
**As a** new user
**I want** to finalize setup
**So that** I can start using the system

**Acceptance Criteria:**
- [ ] Show success message with confetti animation
- [ ] Mark onboarding as complete in tenant settings
- [ ] Show next steps:
  - "Ajouter plus d'employés"
  - "Configurer le pointage mobile"
  - "Lancer la paie du mois"
- [ ] Redirect to dashboard
- [ ] Show progress: Step 6/6 ✓

**Test Cases:**
```typescript
describe('Onboarding - Completion', () => {
  it('should mark onboarding complete', async () => {
    const result = await caller.onboarding.complete({
      tenantId: tenant.id,
    });

    expect(result.tenant.settings.onboarding_completed).toBe(true);
    expect(result.tenant.settings.onboarding_completed_at).toBeDefined();
  });

  it('should generate first payroll run (draft)', async () => {
    await caller.onboarding.complete({ tenantId: tenant.id });

    const payrollRun = await db.query.payroll_runs.findFirst({
      where: eq(payroll_runs.tenant_id, tenant.id),
    });

    expect(payrollRun.status).toBe('draft');
    expect(payrollRun.period_start).toBeDefined();
  });
});
```

---

### FEATURE 3: Onboarding State Management

#### Story 3.1: Save & Resume Progress
**As a** new user
**I want** my progress saved automatically
**So that** I can resume if interrupted

**Acceptance Criteria:**
- [ ] Store onboarding state in tenant.settings.onboarding
- [ ] Track completed steps
- [ ] Allow resume from last step
- [ ] Show "Reprendre là où vous étiez" on login
- [ ] Clear state when onboarding complete

**Test Cases:**
```typescript
describe('Onboarding - Save & Resume', () => {
  it('should save progress after each step', async () => {
    await caller.onboarding.selectCountry({ tenantId: tenant.id, countryCode: 'CI' });

    const state = await getOnboardingState(tenant.id);
    expect(state.currentStep).toBe(2); // Moved to step 2
    expect(state.completedSteps).toContain(1);

    await caller.onboarding.setCompanyInfo({ /* ... */ });

    const updatedState = await getOnboardingState(tenant.id);
    expect(updatedState.currentStep).toBe(3);
    expect(updatedState.completedSteps).toEqual([1, 2]);
  });

  it('should resume from last step on login', async () => {
    // Partially complete onboarding
    await caller.onboarding.selectCountry({ tenantId: tenant.id, countryCode: 'CI' });
    await caller.onboarding.setCompanyInfo({ /* ... */ });

    // Logout and login again
    const session = await login(user.email, password);

    const state = await caller.onboarding.getState({ tenantId: tenant.id });
    expect(state.currentStep).toBe(3); // Resume at step 3
    expect(state.isComplete).toBe(false);
  });

  it('should clear state when complete', async () => {
    await completeOnboarding(tenant.id);

    const state = await getOnboardingState(tenant.id);
    expect(state.isComplete).toBe(true);
    expect(state.currentStep).toBeNull();
  });
});
```

---

## Implementation Phases

### Phase 1: Registration & Country Setup (Week 1)
- [ ] Story 1.1: Signup flow
- [ ] Story 2.1: Country selection
- [ ] Story 2.2: Company info
- [ ] Onboarding layout component
- [ ] Progress indicator

**Deliverable:** Can create account and select country

### Phase 2: Employee & Position Setup (Week 2)
- [ ] Story 2.3: Add first employee
- [ ] Story 2.4: Create first position
- [ ] Auto-assignment logic
- [ ] Validation and error handling

**Deliverable:** Can add employee with position

### Phase 3: Payroll Preview & Completion (Week 3)
- [ ] Story 2.5: Payroll preview
- [ ] Visual breakdown components
- [ ] Tooltips and help text
- [ ] Story 2.6: Completion flow
- [ ] Story 3.1: Save/resume state

**Deliverable:** Complete onboarding flow working end-to-end

---

## Acceptance Testing Checklist

Before marking this epic complete:

- [ ] Can complete full onboarding in < 15 min
- [ ] Mobile-responsive on phones
- [ ] French UI with zero jargon
- [ ] Visual progress clear at each step
- [ ] Can resume if interrupted
- [ ] Validation prevents errors (SMIG, email, etc.)
- [ ] First payroll preview accurate
- [ ] Success screen celebratory
- [ ] Redirects to dashboard on completion
- [ ] Works with low connectivity (graceful degradation)

---

## UX Checklist (Low Digital Literacy)

- [ ] One question per screen
- [ ] Large touch targets (44x44px minimum)
- [ ] Simple French (no "CNPS", use "Cotisation retraite")
- [ ] Tooltips for complex terms
- [ ] Visual progress bar
- [ ] Encouraging messages ("Bravo !")
- [ ] Can go back to previous step
- [ ] Pre-fill when possible
- [ ] Clear error messages with solutions
- [ ] Help box on each step

---

**Next:** Read `10-API-CONTRACTS.md`
