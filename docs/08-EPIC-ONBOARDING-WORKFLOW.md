# 🚀 EPIC: Guided Onboarding Workflow (Signup to First Payroll)

## Epic Overview

**Goal:** Create a zero-to-hero onboarding experience that guides a new company from signup through their first payroll run, optimized for low digital literacy users. The onboarding adapts to company size and complexity, showing only relevant steps.

**Priority:** P0 (Must-have for MVP - first user experience)

**Source Documents:**
- `01-CONSTRAINTS-AND-RULES.md` - UX constraints for low literacy
- `02-ARCHITECTURE-OVERVIEW.md` - Workflow engine patterns
- `03-DATABASE-SCHEMA.md` - Tenants, employees, positions, payroll tables
- `04-DOMAIN-MODELS.md` - Business entities, validation rules, domain events
- `HCI-DESIGN-PRINCIPLES.md` - **UX design principles for low digital literacy**
- `09-EPIC-WORKFLOW-AUTOMATION.md` - Workflow automation infrastructure
- `GAPS-AND-IMPLEMENTATION-PLAN.md` - Feature priorities and implementation gaps

**Core Philosophy:**
> "Start with the simplest path, reveal complexity only when needed."

**Adaptive Journey:**
```
Signup → Discovery Questionnaire → Adaptive Setup Path → First Payroll → Success
                ↓
    ┌───────────┴───────────┐
    │ Small (1-10 employees) │ → Simple path (3 steps)
    │ Medium (11-50)         │ → Structured path (5 steps)
    │ Large (51+)            │ → Full path (8 steps)
    └────────────────────────┘
```

**Dependencies:**
- Multi-tenant infrastructure
- Employee management system
- Payroll calculation engine
- Workflow engine (basic)

---

## Success Criteria

- [x] Discovery questionnaire completes in < 2 minutes
- [x] Solo business onboarding in < 10 minutes
- [x] Small team onboarding in < 15 minutes
- [x] Medium/Large onboarding in < 30 minutes
- [x] Zero prior HR/payroll knowledge required
- [x] French-only UI with simple language
- [x] Mobile-responsive (works on phone)
- [x] Progressive disclosure (one step at a time)
- [x] Contextual help at each step
- [x] Can resume if interrupted
- [x] Can skip optional features and add later
- [x] First payroll run successful
- [x] Clear visual progress indicator with branching

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
- [ ] Redirect to onboarding discovery questionnaire
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

### FEATURE 2: Questionnaire-Based Discovery & Adaptive Onboarding

**Design Philosophy:**
- Ask smart questions first to understand company needs
- Show only relevant steps based on answers
- Allow skipping advanced features (can add later)
- Progressive complexity (start simple, add features as needed)

---

#### Story 2.1: Discovery Questionnaire
**As a** new user (after signup)
**I want** to answer simple questions about my business
**So that** the onboarding adapts to my specific needs

**Acceptance Criteria:**
- [ ] Welcome screen with friendly introduction
- [ ] 7-10 quick questions (single-choice, visual)
- [ ] Each question on its own screen
- [ ] Can go back to previous question
- [ ] Progress indicator (Question X/Y)
- [ ] Questions in simple French
- [ ] Visual icons for each option
- [ ] Auto-save answers (can resume)
- [ ] Generate onboarding path based on answers
- [ ] Show path preview before starting

**Questions to Ask:**

**Q1: Combien d'employés avez-vous ?**
```
┌─────────────────────────────────────┐
│ 🧍 Juste moi (Solo)                │ → SIMPLE_PATH
├─────────────────────────────────────┤
│ 👥 2-10 employés (Petite équipe)   │ → SMALL_TEAM_PATH
├─────────────────────────────────────┤
│ 👔 11-50 employés (Moyenne)         │ → MEDIUM_ORG_PATH
├─────────────────────────────────────┤
│ 🏢 51+ employés (Grande)            │ → LARGE_ORG_PATH
└─────────────────────────────────────┘
```

**Q2: Votre entreprise a-t-elle des départements ?**
```
┌─────────────────────────────────────┐
│ ❌ Non, équipe plate                │ → Skip departments setup
├─────────────────────────────────────┤
│ ✅ Oui, plusieurs départements      │ → Add departments step
└─────────────────────────────────────┘
```

**Q3: Avez-vous des employés avec des types de contrat différents ?**
```
┌─────────────────────────────────────┐
│ ❌ Non, tous à temps plein          │ → Skip contract types setup
├─────────────────────────────────────┤
│ ✅ Oui (temps partiel, stages, CDD)│ → Add contract types wizard
└─────────────────────────────────────┘
```

**Q4: Comment payez-vous vos employés ?**
```
┌─────────────────────────────────────┐
│ 💰 Salaire fixe seulement           │ → Simple salary setup
├─────────────────────────────────────┤
│ 🎁 Salaire + primes/indemnités      │ → Add allowances wizard
├─────────────────────────────────────┤
│ 📊 Salaire + commissions            │ → Add commissions setup
├─────────────────────────────────────┤
│ 🎯 Tout ça                          │ → Full compensation wizard
└─────────────────────────────────────┘
```

**Q5: Voulez-vous suivre le temps de travail (pointage) ?**
```
┌─────────────────────────────────────┐
│ ❌ Non, pas pour l'instant          │ → Skip time tracking
├─────────────────────────────────────┤
│ ⏰ Oui, pointage simple              │ → Enable basic time tracking
├─────────────────────────────────────┤
│ 📍 Oui, avec géolocalisation        │ → Enable geofencing
├─────────────────────────────────────┤
│ 📊 Oui, avec heures supplémentaires │ → Enable overtime tracking
└─────────────────────────────────────┘
```

**Q6: Voulez-vous gérer les congés ?**
```
┌─────────────────────────────────────┐
│ ❌ Non, pas pour l'instant          │ → Skip time-off setup
├─────────────────────────────────────┤
│ ✅ Oui, congés légaux seulement     │ → Enable with default policy
├─────────────────────────────────────┤
│ 🎯 Oui, avec politiques personnalisées│ → Add custom policies wizard
└─────────────────────────────────────┘
```

**Q7: Quelle est la fréquence de paie ?**
```
┌─────────────────────────────────────┐
│ 📅 Mensuel (fin du mois)            │ → Set monthly payroll
├─────────────────────────────────────┤
│ 📆 Bi-mensuel (2x par mois)         │ → Set bi-weekly payroll
└─────────────────────────────────────┘
```

**Test Cases:**
```typescript
describe('Discovery Questionnaire', () => {
  it('should save answers after each question', async () => {
    const result = await caller.onboarding.answerQuestion({
      tenantId: tenant.id,
      questionId: 'company_size',
      answer: 'small_team',
    });

    expect(result.onboardingState.answers.company_size).toBe('small_team');
  });

  it('should generate simple path for solo business', async () => {
    await answerQuestionnaire(tenant.id, {
      company_size: 'solo',
      has_departments: false,
      contract_types: 'full_time_only',
      compensation: 'fixed_salary',
      time_tracking: 'none',
      time_off: 'none',
      payroll_frequency: 'monthly',
    });

    const path = await caller.onboarding.getAdaptivePath({ tenantId: tenant.id });

    expect(path.steps).toEqual([
      'country_selection',
      'company_info',
      'first_employee', // Just the owner
      'salary_setup',
      'payroll_preview',
      'completion',
    ]);
    expect(path.estimatedMinutes).toBeLessThanOrEqual(10);
  });

  it('should generate complex path for large org', async () => {
    await answerQuestionnaire(tenant.id, {
      company_size: 'large',
      has_departments: true,
      contract_types: 'multiple',
      compensation: 'full',
      time_tracking: 'overtime',
      time_off: 'custom_policies',
      payroll_frequency: 'monthly',
    });

    const path = await caller.onboarding.getAdaptivePath({ tenantId: tenant.id });

    expect(path.steps).toEqual([
      'country_selection',
      'company_info',
      'departments_setup',
      'positions_hierarchy',
      'contract_types_setup',
      'compensation_components',
      'bulk_employee_import',
      'time_tracking_config',
      'time_off_policies',
      'approval_workflows',
      'payroll_preview',
      'completion',
    ]);
    expect(path.estimatedMinutes).toBeGreaterThan(20);
  });

  it('should allow resuming questionnaire', async () => {
    // Answer first 3 questions
    await answerQuestion(tenant.id, 'company_size', 'medium');
    await answerQuestion(tenant.id, 'has_departments', true);
    await answerQuestion(tenant.id, 'contract_types', 'multiple');

    // Logout and login
    const session = await login(user.email, password);

    // Resume from question 4
    const state = await caller.onboarding.getQuestionnaireState({ tenantId: tenant.id });
    expect(state.currentQuestionIndex).toBe(3);
    expect(state.answers).toHaveLength(3);
  });
});
```

**UI Design:**
```tsx
export function DiscoveryQuestionnairePage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const { data: questionnaireState } = api.onboarding.getQuestionnaireState.useQuery();
  const answerQuestion = api.onboarding.answerQuestion.useMutation();

  const questions = [
    {
      id: 'company_size',
      title: 'Combien d\'employés avez-vous ?',
      subtitle: 'Comptez tous vos employés actuels, y compris vous-même',
      options: [
        { value: 'solo', icon: '🧍', label: 'Juste moi', description: 'Travailleur autonome' },
        { value: 'small_team', icon: '👥', label: '2-10 employés', description: 'Petite équipe' },
        { value: 'medium', icon: '👔', label: '11-50 employés', description: 'Moyenne entreprise' },
        { value: 'large', icon: '🏢', label: '51+ employés', description: 'Grande organisation' },
      ],
    },
    // ... other questions
  ];

  const handleAnswer = async (answer: string) => {
    await answerQuestion.mutateAsync({
      questionId: questions[currentQuestion].id,
      answer,
    });

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Questionnaire complete, generate path
      router.push('/onboarding/path-preview');
    }
  };

  return (
    <OnboardingLayout
      title="Configurons votre espace"
      subtitle="Quelques questions rapides pour personnaliser votre expérience"
      currentStep={currentQuestion + 1}
      totalSteps={questions.length}
    >
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">
            {questions[currentQuestion].title}
          </h2>
          <p className="text-muted-foreground">
            {questions[currentQuestion].subtitle}
          </p>
        </div>

        <div className="grid gap-3">
          {questions[currentQuestion].options.map((option) => (
            <QuestionOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              onClick={() => handleAnswer(option.value)}
              className="min-h-[72px] cursor-pointer hover:border-primary"
            />
          ))}
        </div>

        {currentQuestion > 0 && (
          <Button
            variant="ghost"
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
            className="w-full"
          >
            ← Retour
          </Button>
        )}
      </div>
    </OnboardingLayout>
  );
}

function QuestionOptionCard({ icon, label, description, onClick, className }) {
  return (
    <Card
      className={cn("p-4 transition-all hover:shadow-md", className)}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="text-4xl">{icon}</div>
        <div className="flex-1">
          <p className="font-semibold text-lg">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
}
```

---

#### Story 2.2: Adaptive Path Preview
**As a** new user (after questionnaire)
**I want** to see what steps I'll go through
**So that** I understand what to expect

**Acceptance Criteria:**
- [ ] Show visual flow diagram with all steps
- [ ] Highlight which steps are required vs optional
- [ ] Show estimated time to complete
- [ ] Allow editing questionnaire answers
- [ ] "Commencer" button to start onboarding
- [ ] Mobile-friendly visualization

**Test Cases:**
```typescript
describe('Adaptive Path Preview', () => {
  it('should show personalized path based on answers', async () => {
    await answerQuestionnaire(tenant.id, {
      company_size: 'small_team',
      has_departments: false,
      // ... other answers
    });

    const preview = await caller.onboarding.getPathPreview({ tenantId: tenant.id });

    expect(preview.steps).toEqual([
      { id: 'country', title: 'Pays', required: true, duration: 1 },
      { id: 'company_info', title: 'Informations', required: true, duration: 2 },
      { id: 'bulk_import', title: 'Employés', required: true, duration: 5 },
      { id: 'salary', title: 'Salaires', required: true, duration: 3 },
      { id: 'preview', title: 'Aperçu', required: true, duration: 2 },
      { id: 'completion', title: 'Terminé', required: true, duration: 1 },
    ]);

    expect(preview.totalDuration).toBe(14); // minutes
  });
});
```

**UI Design:**
```tsx
export function PathPreviewPage() {
  const { data: preview } = api.onboarding.getPathPreview.useQuery();
  const startOnboarding = api.onboarding.startOnboarding.useMutation();

  return (
    <OnboardingLayout
      title="Votre parcours de configuration"
      subtitle={`Nous avons personnalisé ${preview.steps.length} étapes pour vous`}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {preview.steps.length} étapes
                </h3>
                <p className="text-muted-foreground">
                  Environ {preview.totalDuration} minutes
                </p>
              </div>
              <Clock className="h-12 w-12 text-primary" />
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {preview.steps.map((step, index) => (
            <StepPreviewCard
              key={step.id}
              number={index + 1}
              title={step.title}
              duration={step.duration}
              required={step.required}
            />
          ))}
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => startOnboarding.mutate()}
            className="w-full min-h-[56px] text-lg"
          >
            Commencer la configuration
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/onboarding/questionnaire')}
            className="w-full"
          >
            Modifier mes réponses
          </Button>
        </div>

        <HelpBox>
          💡 Vous pouvez interrompre à tout moment et reprendre plus tard
        </HelpBox>
      </div>
    </OnboardingLayout>
  );
}

function StepPreviewCard({ number, title, duration, required }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
          {number}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">
            {duration} min · {required ? 'Requis' : 'Optionnel'}
          </p>
        </div>
      </div>
    </Card>
  );
}
```

---

#### Story 2.3: Country Selection (All Paths)
**As a** new user
**I want** to select my country
**So that** payroll rules are configured correctly

**Acceptance Criteria:**
- [ ] Show in all onboarding paths (required step)
- [ ] Country selector with flags and descriptions
- [ ] Load country-specific rules (CNPS rates, ITS brackets, SMIG)
- [ ] Set tenant.country_code
- [ ] Show visual progress in current path
- [ ] Simple French: "Où est située votre entreprise ?"

**Test Cases:**
```typescript
describe('Country Selection', () => {
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
});
```

**UI Design:**
```tsx
export function CountrySelectionStep() {
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Où est située votre entreprise ?"
      subtitle="Sélectionnez le pays pour configurer automatiquement les règles de paie"
    >
      <div className="space-y-4">
        <RadioGroup>
          <RadioCard
            value="CI"
            icon="🇨🇮"
            title="Côte d'Ivoire"
            description="CNPS, ITS, SMIG 75 000 FCFA"
            className="min-h-[60px]"
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

---

#### Story 2.4: Company Information (All Paths)
**As a** new user
**I want** to provide company details
**So that** documents and reports are properly labeled

**Acceptance Criteria:**
- [ ] Collect company info (legal name, industry, tax ID)
- [ ] Optional fields clearly marked
- [ ] Validate tax ID format (if provided)
- [ ] Update tenant record
- [ ] Simple labels, no jargon

**Test Cases:**
```typescript
describe('Company Information', () => {
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
});
```

---

#### Story 2.5: Departments Setup (Medium/Large Paths Only)
**As a** user with a structured organization
**I want** to create departments
**So that** employees can be organized by department

**Acceptance Criteria:**
- [ ] Only shown if `has_departments = true` in questionnaire
- [ ] Pre-fill with common departments (Direction, Comptabilité, Commercial, etc.)
- [ ] Allow adding/editing/deleting departments
- [ ] Each department has: name, description
- [ ] Validate unique department names
- [ ] Can skip and add later

**Test Cases:**
```typescript
describe('Departments Setup', () => {
  it('should create multiple departments', async () => {
    const result = await caller.onboarding.createDepartments({
      tenantId: tenant.id,
      departments: [
        { name: 'Direction', description: 'Direction générale' },
        { name: 'Commercial', description: 'Équipe de vente' },
        { name: 'Comptabilité', description: 'Finances et paie' },
      ],
    });

    expect(result.departments).toHaveLength(3);
    expect(result.departments[0].name).toBe('Direction');
  });

  it('should skip if not needed', async () => {
    // Solo/small team path skips this step
    const path = await getOnboardingPath(soloTenant.id);
    expect(path.steps).not.toContain('departments_setup');
  });
});
```

**UI Design:**
```tsx
export function DepartmentsSetupStep() {
  const [departments, setDepartments] = useState([
    { name: 'Direction', description: '' },
    { name: 'Commercial', description: '' },
    { name: 'Comptabilité', description: '' },
  ]);
  const { nextStep, skipStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Créez vos départements"
      subtitle="Organisez votre entreprise en départements"
    >
      <div className="space-y-4">
        <HelpBox>
          💡 Suggestions basées sur votre secteur d'activité
        </HelpBox>

        {departments.map((dept, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-3">
              <Input
                placeholder="Nom du département"
                value={dept.name}
                onChange={(e) => updateDepartment(index, 'name', e.target.value)}
              />
              <Input
                placeholder="Description (optionnel)"
                value={dept.description}
                onChange={(e) => updateDepartment(index, 'description', e.target.value)}
              />
            </div>
          </Card>
        ))}

        <Button
          variant="outline"
          onClick={addDepartment}
          className="w-full"
        >
          + Ajouter un département
        </Button>

        <div className="space-y-2">
          <Button onClick={nextStep} className="w-full min-h-[44px]">
            Continuer
          </Button>
          <Button
            variant="ghost"
            onClick={skipStep}
            className="w-full"
          >
            Passer cette étape
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
```

---

#### Story 2.6: Employee Setup (Adaptive)
**As a** new user
**I want** to add employees efficiently
**So that** I can run payroll

**Acceptance Criteria:**
- [ ] **Solo Path:** Quick form to add owner as employee
- [ ] **Small Team Path (2-10):** Add 1-10 employees individually with wizard
- [ ] **Medium/Large Path (11+):** Bulk import via CSV template
- [ ] Validate salary >= SMIG
- [ ] Create employee records with positions
- [ ] Show success message with count

**Path-Specific Implementations:**

**Solo Path:**
```tsx
export function SoloEmployeeSetupStep() {
  const { data: ownerInfo } = api.onboarding.getOwnerInfo.useQuery();
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Ajoutez-vous comme employé"
      subtitle="Créez votre profil employé pour générer votre paie"
    >
      <Form>
        <FormField
          name="firstName"
          label="Prénom"
          defaultValue={ownerInfo?.firstName}
          required
        />
        <FormField
          name="lastName"
          label="Nom"
          defaultValue={ownerInfo?.lastName}
          required
        />
        <FormField
          name="position"
          label="Votre fonction"
          defaultValue="Gérant"
          required
        />
        <FormField
          name="baseSalary"
          label="Salaire mensuel (FCFA)"
          placeholder="Minimum 75 000 FCFA"
          min={75000}
          required
        />

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer
        </Button>
      </Form>
    </OnboardingLayout>
  );
}
```

**Small Team Path:**
```tsx
export function SmallTeamEmployeeSetupStep() {
  const [employees, setEmployees] = useState([createEmptyEmployee()]);
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Ajoutez votre équipe"
      subtitle={`${employees.length} employé(s) ajouté(s)`}
    >
      <div className="space-y-4">
        {employees.map((emp, index) => (
          <EmployeeCard
            key={index}
            employee={emp}
            onUpdate={(data) => updateEmployee(index, data)}
            onRemove={() => removeEmployee(index)}
          />
        ))}

        <Button
          variant="outline"
          onClick={addEmployee}
          className="w-full"
          disabled={employees.length >= 10}
        >
          + Ajouter un employé
        </Button>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer ({employees.length} employés)
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

**Medium/Large Path:**
```tsx
export function BulkEmployeeImportStep() {
  const [file, setFile] = useState<File | null>(null);
  const downloadTemplate = api.onboarding.downloadEmployeeTemplate.useMutation();
  const importEmployees = api.onboarding.importEmployees.useMutation();
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Importez vos employés"
      subtitle="Utilisez notre modèle Excel pour importer vos employés en masse"
    >
      <div className="space-y-6">
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-4">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Téléchargez le modèle</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Remplissez le fichier Excel avec les informations de vos employés
              </p>
              <Button
                variant="outline"
                onClick={() => downloadTemplate.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger le modèle Excel
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <FileUpload
            accept=".xlsx,.csv"
            onFileSelect={setFile}
            className="min-h-[120px]"
          />

          {file && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Fichier sélectionné:</p>
              <p className="text-sm text-muted-foreground">{file.name}</p>
            </div>
          )}
        </Card>

        <Button
          onClick={() => importEmployees.mutate({ file })}
          disabled={!file}
          className="w-full min-h-[44px]"
        >
          Importer les employés
        </Button>

        <HelpBox>
          💡 Besoin d'aide ? Regardez notre{' '}
          <a href="#" className="underline">
            guide d'importation
          </a>
        </HelpBox>
      </div>
    </OnboardingLayout>
  );
}
```

**Test Cases:**
```typescript
describe('Employee Setup (Adaptive)', () => {
  it('should show solo form for solo path', async () => {
    await answerQuestionnaire(tenant.id, { company_size: 'solo' });
    const path = await getOnboardingPath(tenant.id);

    const employeeStep = path.steps.find(s => s.id === 'employee_setup');
    expect(employeeStep.variant).toBe('solo');
  });

  it('should show wizard for small team', async () => {
    await answerQuestionnaire(tenant.id, { company_size: 'small_team' });
    const path = await getOnboardingPath(tenant.id);

    const employeeStep = path.steps.find(s => s.id === 'employee_setup');
    expect(employeeStep.variant).toBe('wizard');
  });

  it('should show bulk import for medium/large', async () => {
    await answerQuestionnaire(tenant.id, { company_size: 'medium' });
    const path = await getOnboardingPath(tenant.id);

    const employeeStep = path.steps.find(s => s.id === 'employee_setup');
    expect(employeeStep.variant).toBe('bulk_import');
  });
});
```

---

#### Story 2.7: Compensation Components (If Needed)
**As a** user who pays allowances/commissions
**I want** to configure compensation components
**So that** payroll includes all earnings

**Acceptance Criteria:**
- [ ] Only shown if `compensation != 'fixed_salary'` in questionnaire
- [ ] Pre-configured components based on country (Transport, Logement, etc.)
- [ ] Allow enabling/disabling components
- [ ] Set default amounts (can override per employee)
- [ ] Explain tax implications
- [ ] Can skip and configure later

**Test Cases:**
```typescript
describe('Compensation Components', () => {
  it('should show for users with allowances', async () => {
    await answerQuestionnaire(tenant.id, { compensation: 'with_allowances' });
    const path = await getOnboardingPath(tenant.id);

    expect(path.steps).toContain('compensation_components');
  });

  it('should skip for fixed salary only', async () => {
    await answerQuestionnaire(tenant.id, { compensation: 'fixed_salary' });
    const path = await getOnboardingPath(tenant.id);

    expect(path.steps).not.toContain('compensation_components');
  });

  it('should create components with defaults', async () => {
    const result = await caller.onboarding.configureCompensation({
      tenantId: tenant.id,
      components: [
        { type: 'transport', enabled: true, defaultAmount: 25000 },
        { type: 'logement', enabled: true, defaultAmount: 50000 },
      ],
    });

    expect(result.components).toHaveLength(2);
  });
});
```

---

#### Story 2.8: Time Tracking Configuration (If Needed)
**As a** user who wants time tracking
**I want** to configure clock-in settings
**So that** employees can start tracking time

**Acceptance Criteria:**
- [ ] Only shown if `time_tracking != 'none'` in questionnaire
- [ ] Enable/disable geofencing
- [ ] Set office location (if geofencing enabled)
- [ ] Set geofence radius (50m - 5000m)
- [ ] Configure overtime rules
- [ ] Explain how it works to employees

**UI Design:**
```tsx
export function TimeTrackingConfigStep() {
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const { nextStep, skipStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Configurez le pointage"
      subtitle="Définissez les règles de pointage pour vos employés"
    >
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Géolocalisation</h3>
              <p className="text-sm text-muted-foreground">
                Restreindre le pointage à un lieu spécifique
              </p>
            </div>
            <Switch
              checked={geofencingEnabled}
              onCheckedChange={setGeofencingEnabled}
            />
          </div>

          {geofencingEnabled && (
            <div className="space-y-4">
              <LocationPicker
                onLocationSelect={(lat, lng) => setOfficeLocation({ lat, lng })}
              />

              <div>
                <label className="text-sm font-medium">Rayon autorisé</label>
                <Slider
                  min={50}
                  max={5000}
                  step={50}
                  value={[radius]}
                  onValueChange={([value]) => setRadius(value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {radius} mètres autour du bureau
                </p>
              </div>
            </div>
          )}
        </Card>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer
        </Button>

        <Button variant="ghost" onClick={skipStep} className="w-full">
          Configurer plus tard
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

---

#### Story 2.9: Time-Off Policies (If Needed)
**As a** user who manages leave
**I want** to configure time-off policies
**So that** employees can request leave

**Acceptance Criteria:**
- [ ] Only shown if `time_off != 'none'` in questionnaire
- [ ] Pre-configured with statutory minimums by country
- [ ] Allow customizing accrual rates
- [ ] Set approval workflow (auto vs manager)
- [ ] Explain how balances work

**UI Design:**
```tsx
export function TimeOffPoliciesStep() {
  const { data: defaultPolicies } = api.onboarding.getDefaultPolicies.useQuery();
  const { nextStep } = useOnboarding();

  return (
    <OnboardingLayout
      title="Configurez les congés"
      subtitle="Définissez les politiques de congés pour vos employés"
    >
      <div className="space-y-4">
        <HelpBox>
          ✅ Nous avons pré-configuré les congés légaux de Côte d'Ivoire (2,2 jours/mois)
        </HelpBox>

        {defaultPolicies?.map((policy) => (
          <PolicyCard
            key={policy.id}
            name={policy.name}
            description={policy.description}
            accrualRate={policy.accrualRate}
            enabled={policy.enabled}
            onToggle={(enabled) => updatePolicy(policy.id, { enabled })}
          />
        ))}

        <Button
          variant="outline"
          onClick={addCustomPolicy}
          className="w-full"
        >
          + Ajouter une politique personnalisée
        </Button>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Continuer
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

---

#### Story 2.10: Payroll Preview (All Paths)
**As a** new user
**I want** to see a preview of payroll
**So that** I understand what will be paid

**Acceptance Criteria:**
- [ ] Calculate payroll for all employees (current month)
- [ ] Show breakdown per employee (collapsible)
- [ ] Show totals (gross, net, employer cost)
- [ ] Visual breakdown with progress bars
- [ ] Explanation tooltips
- [ ] "Cela vous semble-t-il correct ?" confirmation

**Test Cases:**
```typescript
describe('Payroll Preview', () => {
  it('should calculate preview for all employees', async () => {
    await createTestEmployee({ baseSalary: 300000 });
    await createTestEmployee({ baseSalary: 200000 });

    const preview = await caller.onboarding.previewPayroll({
      tenantId: tenant.id,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    });

    expect(preview.employees).toHaveLength(2);
    expect(preview.totalGross).toBe(500000);
    expect(preview.totalNet).toBeCloseTo(438570, 0);
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
      subtitle={`Paie de ${format(preview.period, 'MMMM yyyy', { locale: fr })}`}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Employés</p>
            <p className="text-3xl font-bold">{preview.employeeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Salaires nets</p>
            <p className="text-3xl font-bold text-green-600">
              {preview.totalNet.toLocaleString('fr-FR')}
            </p>
          </Card>
        </div>

        {/* Employee Breakdown (Collapsible) */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Détail par employé</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {preview.employees.map((emp) => (
              <Collapsible key={emp.id}>
                <CollapsibleTrigger className="w-full p-3 hover:bg-muted rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Net: {emp.netSalary.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4 space-y-2">
                  <PayrollBreakdown payslip={emp} />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        <Button onClick={nextStep} className="w-full min-h-[44px]">
          Cela me semble correct, continuer
        </Button>
      </div>
    </OnboardingLayout>
  );
}
```

---

#### Story 2.11: Completion & Next Steps (All Paths)
**As a** new user
**I want** to celebrate completion and know what to do next
**So that** I feel accomplished and ready to use the system

**Acceptance Criteria:**
- [ ] Confetti animation on load
- [ ] Success message with personalized summary
- [ ] Show what was configured
- [ ] Show next steps (action items)
- [ ] Mark onboarding as complete
- [ ] Redirect to dashboard
- [ ] Send welcome email with resources

**Test Cases:**
```typescript
describe('Onboarding Completion', () => {
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

**UI Design:**
```tsx
export function CompletionStep() {
  const { data: summary } = api.onboarding.getSummary.useQuery();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-green-50 to-blue-50">
      {showConfetti && <Confetti />}

      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Félicitations ! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Votre espace Preem est configuré et prêt à l'emploi
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* What was configured */}
          <div>
            <h2 className="font-semibold mb-3">Ce qui a été configuré:</h2>
            <div className="grid gap-2">
              <ConfiguredItem
                icon={<Building className="h-5 w-5" />}
                text={`Entreprise: ${summary.companyName}`}
              />
              <ConfiguredItem
                icon={<Users className="h-5 w-5" />}
                text={`${summary.employeeCount} employé(s) ajouté(s)`}
              />
              {summary.departmentCount > 0 && (
                <ConfiguredItem
                  icon={<Folder className="h-5 w-5" />}
                  text={`${summary.departmentCount} département(s)`}
                />
              )}
              {summary.timeTrackingEnabled && (
                <ConfiguredItem
                  icon={<Clock className="h-5 w-5" />}
                  text="Pointage activé"
                />
              )}
              {summary.timeOffEnabled && (
                <ConfiguredItem
                  icon={<Calendar className="h-5 w-5" />}
                  text="Gestion des congés activée"
                />
              )}
            </div>
          </div>

          {/* Next steps */}
          <div>
            <h2 className="font-semibold mb-3">Prochaines étapes:</h2>
            <div className="space-y-3">
              <NextStepCard
                number={1}
                title="Lancez votre première paie"
                description="Générez les bulletins de paie de vos employés"
                action="Aller à Paie"
                href="/payroll"
              />
              <NextStepCard
                number={2}
                title="Invitez vos employés"
                description="Ils pourront consulter leurs bulletins et pointer"
                action="Gérer les accès"
                href="/employees"
              />
              {!summary.timeTrackingEnabled && (
                <NextStepCard
                  number={3}
                  title="Activer le pointage (optionnel)"
                  description="Suivez les heures de travail de vos employés"
                  action="Configurer"
                  href="/settings/time-tracking"
                />
              )}
            </div>
          </div>

          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full min-h-[56px] text-lg"
          >
            Accéder à mon tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfiguredItem({ icon, text }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted">
      <div className="text-primary">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function NextStepCard({ number, title, description, action, href }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
          {number}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          <Link href={href}>
            <Button variant="outline" size="sm">
              {action} →
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
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
- [ ] Track questionnaire answers
- [ ] Allow resume from last step
- [ ] Show "Reprendre là où vous étiez" on login
- [ ] Clear state when onboarding complete

**Test Cases:**
```typescript
describe('Onboarding - Save & Resume', () => {
  it('should save progress after each step', async () => {
    await caller.onboarding.selectCountry({ tenantId: tenant.id, countryCode: 'CI' });

    const state = await getOnboardingState(tenant.id);
    expect(state.currentStep).toBe(2);
    expect(state.completedSteps).toContain(1);

    await caller.onboarding.setCompanyInfo({ /* ... */ });

    const updatedState = await getOnboardingState(tenant.id);
    expect(updatedState.currentStep).toBe(3);
    expect(updatedState.completedSteps).toEqual([1, 2]);
  });

  it('should resume from last step on login', async () => {
    // Partially complete onboarding
    await answerQuestionnaire(tenant.id, { company_size: 'medium' });
    await caller.onboarding.selectCountry({ tenantId: tenant.id, countryCode: 'CI' });
    await caller.onboarding.setCompanyInfo({ /* ... */ });

    // Logout and login again
    const session = await login(user.email, password);

    const state = await caller.onboarding.getState({ tenantId: tenant.id });
    expect(state.currentStep).toBe(3); // Resume at departments setup
    expect(state.isComplete).toBe(false);
    expect(state.path).toBe('medium');
  });

  it('should preserve questionnaire answers on resume', async () => {
    await answerQuestionnaire(tenant.id, {
      company_size: 'small_team',
      has_departments: false,
      time_tracking: 'overtime',
    });

    // Logout and login
    await login(user.email, password);

    const state = await caller.onboarding.getState({ tenantId: tenant.id });
    expect(state.questionnaireAnswers.company_size).toBe('small_team');
    expect(state.questionnaireAnswers.time_tracking).toBe('overtime');
  });

  it('should clear state when complete', async () => {
    await completeOnboarding(tenant.id);

    const state = await getOnboardingState(tenant.id);
    expect(state.isComplete).toBe(true);
    expect(state.currentStep).toBeNull();
    expect(state.questionnaireAnswers).toEqual({});
  });
});
```

---

## Visual Flow Diagrams

### Adaptive Branching Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      QUESTIONNAIRE                          │
│              (7 questions, ~2 minutes)                      │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │   Path Decision  │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    v            v            v
┌───────┐   ┌────────┐   ┌──────────┐
│ SOLO  │   │ SMALL  │   │ MED/LARGE│
│ PATH  │   │ TEAM   │   │   PATH   │
└───┬───┘   └───┬────┘   └─────┬────┘
    │           │              │
    │           │              │
    v           v              v
┌───────────────────────────────────────────────────────────┐
│                     CORE STEPS (All Paths)                │
├───────────────────────────────────────────────────────────┤
│ 1. Country Selection                                      │
│ 2. Company Information                                    │
└───────────────────────────────────────────────────────────┘
    │           │              │
    │           │              │
    v           v              v
┌──────┐    ┌──────┐      ┌──────────┐
│ Skip │    │ Skip │      │ Create   │
│ Dept │    │ Dept │      │ Dept     │ ← Medium/Large only
└──┬───┘    └──┬───┘      └─────┬────┘
   │           │              │
   v           v              v
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Add 1    │ │ Add 2-10 │ │ Bulk     │
│ Employee │ │ Employees│ │ Import   │
│ (Owner)  │ │ (Wizard) │ │ (CSV)    │
└─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │
      │            │            │
      v            v            v
┌─────────────────────────────────────────────┐
│        OPTIONAL FEATURES (If Selected)      │
├─────────────────────────────────────────────┤
│ • Compensation Components (if allowances)   │
│ • Time Tracking Config (if enabled)         │
│ • Time-Off Policies (if enabled)            │
│ • Approval Workflows (if Medium/Large)      │
└──────────────────┬──────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────┐
│           COMPLETION (All Paths)            │
├─────────────────────────────────────────────┤
│ • Payroll Preview                           │
│ • Success Celebration                       │
│ • Next Steps                                │
└─────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Discovery & Core Paths (Week 1-2)
- [ ] Story 1.1: Signup flow
- [ ] Story 2.1: Discovery questionnaire (7 questions)
- [ ] Story 2.2: Adaptive path preview
- [ ] Story 2.3: Country selection
- [ ] Story 2.4: Company information
- [ ] Story 2.6: Solo path employee setup
- [ ] Story 2.10: Payroll preview
- [ ] Story 2.11: Completion
- [ ] Story 3.1: Save/resume state

**Deliverable:** Solo business can complete onboarding in < 10 minutes

### Phase 2: Small Team Path (Week 3)
- [ ] Story 2.6: Small team wizard (2-10 employees)
- [ ] Story 2.7: Compensation components (optional)
- [ ] Story 2.8: Time tracking config (optional)
- [ ] Story 2.9: Time-off policies (optional)

**Deliverable:** Small teams can onboard in < 15 minutes

### Phase 3: Medium/Large Paths (Week 4)
- [ ] Story 2.5: Departments setup
- [ ] Story 2.6: Bulk employee import (CSV)
- [ ] Advanced features wizard
- [ ] Approval workflows configuration

**Deliverable:** Large organizations can onboard in < 30 minutes

---

## Acceptance Testing Checklist

Before marking this epic complete:

### Questionnaire
- [ ] All 7 questions have clear options
- [ ] Can go back to previous question
- [ ] Auto-saves after each answer
- [ ] Can resume questionnaire if interrupted
- [ ] Path preview shows correct steps based on answers

### Solo Path
- [ ] Completes in < 10 minutes
- [ ] Only shows essential steps
- [ ] No departments/bulk import shown
- [ ] Owner added as employee
- [ ] First payroll preview accurate

### Small Team Path
- [ ] Completes in < 15 minutes
- [ ] Can add 2-10 employees individually
- [ ] Optional features can be skipped
- [ ] Payroll preview accurate for all employees

### Medium/Large Path
- [ ] Completes in < 30 minutes
- [ ] Departments wizard shown
- [ ] Bulk import works with CSV template
- [ ] All advanced features accessible
- [ ] Payroll preview accurate

### General Requirements
- [ ] Mobile-responsive on phones
- [ ] French UI with zero jargon
- [ ] Visual progress clear at each step
- [ ] Can resume if interrupted
- [ ] Validation prevents errors
- [ ] Success screen celebratory
- [ ] Redirects to dashboard on completion
- [ ] Works with low connectivity

---

## UX Checklist (Low Digital Literacy)

- [ ] One question/step per screen
- [ ] Large touch targets (44x44px minimum)
- [ ] Simple French (no jargon)
- [ ] Visual icons for each option
- [ ] Progress bar shows current position
- [ ] Encouraging messages at each step
- [ ] Can go back to previous step
- [ ] Auto-save progress continuously
- [ ] Clear error messages with solutions
- [ ] Help box on each step
- [ ] Confetti animation on completion
- [ ] Next steps clearly presented

---

**Next:** Read `09-EPIC-WORKFLOW-AUTOMATION.md`
