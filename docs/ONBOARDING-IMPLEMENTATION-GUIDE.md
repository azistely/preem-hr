# 🚀 Task-First Onboarding: Complete Implementation Guide

**Date:** October 8, 2025
**Status:** READY FOR IMPLEMENTATION
**Author:** HCI Analysis + Technical Architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Question 1: Country + Company Info](#question-1-country--company-info)
5. [Question 2: First Employee + Payslip Preview](#question-2-first-employee--payslip-preview)
6. [Question 3: Payroll Frequency](#question-3-payroll-frequency)
7. [Success Screen](#success-screen)
8. [Backend Services](#backend-services)
9. [tRPC API Endpoints](#trpc-api-endpoints)
10. [Frontend Components](#frontend-components)
11. [Database Schema Updates](#database-schema-updates)
12. [Testing Strategy](#testing-strategy)
13. [Migration Plan](#migration-plan)

---

## Executive Summary

### Problem Statement

**Current Onboarding:**
- Takes 16-31 minutes to complete
- Questionnaire disconnected from configuration
- Missing critical payroll data (family status, allowances, sector)
- No immediate feedback or success moments
- Users don't see value until the very end

**User Need (from HCI analysis):**
> "Get the user to successfully complete ONE small, real task and feel confident they didn't break anything."

### Solution: 3-Question Task-First Onboarding

**Core Principle:** Show success EARLY, then progressively enhance.

**Flow:**
1. **Q1: Country + Company Info** (~1-2 min)
   - Select country → Auto-configure tax/social security rules
   - Enter company name + sector → Store for payroll calculations

2. **Q2: First Employee + Payslip Preview** (~2-3 min)
   - Add first employee with critical payroll data
   - **IMMEDIATE SUCCESS MOMENT:** See calculated payslip

3. **Q3: Payroll Frequency** (~30 sec)
   - Select monthly/bi-monthly
   - Create first draft payroll run

4. **Success Screen** (~1 min)
   - Celebrate completion
   - Progressive disclosure of optional features

**Total Time:** 3-5 minutes ✅
**Success Moment:** Question 2 (within 3 minutes) ✅

### Key Wins

✅ **Immediate confidence:** User sees working payslip in < 3 minutes
✅ **Payroll correctness:** Collects all critical data upfront (family status, sector, allowances)
✅ **Optimistic UI:** Instant feedback on every action
✅ **Progressive enhancement:** Optional features shown AFTER success
✅ **40% faster:** 3-5 min vs. current 16-31 min

---

## Architecture Overview

### Design Principles (from `docs/HCI-DESIGN-PRINCIPLES.md`)

1. **Zero Learning Curve** - No training required, instant understanding
2. **Task-Oriented Design** - Focus on user goals, not system operations
3. **Error Prevention** - Make mistakes impossible through smart defaults
4. **Cognitive Load Minimization** - One question at a time, progressive disclosure
5. **Immediate Feedback** - Optimistic UI with instant visual confirmation
6. **Graceful Degradation** - Works on slow networks (3G) and old devices

### Payroll Correctness Requirements

**Critical Data (from `docs/ONBOARDING-PAYROLL-CORRECTNESS-AUDIT.md`):**

| Data | Why Critical | Impact if Missing |
|------|--------------|-------------------|
| **Family status** (marital + dependents) | Determines fiscal parts (tax deduction) | Employee overpays tax by 5,625 FCFA/month |
| **Company sector** | Determines work accident rate (2-5%) | Employer contribution error |
| **Allowances** (transport, housing, meal) | Part of gross salary, affects tax | Employee loses 50,000-90,000 FCFA/month |
| **Country code** | Loads correct tax/social security rules | Entire payroll calculation wrong |

**Implementation Requirement:** ALL critical data MUST be collected in Q1-Q2.

### Technology Stack

**Backend:**
- Service: `features/onboarding/services/onboarding.service.ts`
- Router: `server/routers/onboarding.ts`
- Database: `drizzle/schema.ts` (PostgreSQL via Drizzle ORM)
- Payroll: `features/payroll/services/payroll-calculation-v2.ts`

**Frontend:**
- Framework: Next.js 14 (App Router)
- UI Library: shadcn/ui (Radix UI + Tailwind CSS)
- Forms: React Hook Form + Zod validation
- API: tRPC (type-safe API)
- State: React Query (optimistic updates)

**Database Schema:**
- `tenants` - Company information, settings
- `employees` - Employee records
- `positions` - Job positions
- `assignments` - Employee-position links
- `employee_salaries` - Salary records with components
- `tax_systems` - Country tax rules (progressive brackets)
- `social_security_schemes` - CNPS/IPRES/CMU rates
- `family_deduction_rules` - Family allowance by country

---

## Implementation Roadmap

### Phase 1: Backend Services (Week 1)

**New Services to Create:**

```typescript
// features/onboarding/services/onboarding-v2.service.ts

export async function setCompanyInfoV2(input: {
  tenantId: string;
  legalName: string;
  industry: string;
  sector: 'SERVICES' | 'COMMERCE' | 'TRANSPORT' | 'INDUSTRIE' | 'CONSTRUCTION';
  taxId?: string;
}): Promise<Tenant>

export async function createFirstEmployeeV2(input: {
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  positionTitle: string;
  baseSalary: number;
  hireDate: Date;
  // CRITICAL: Family status (payroll correctness)
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number; // 0-10
  // OPTIONAL: Allowances (can be 0)
  transportAllowance?: number;
  housingAllowance?: number;
  mealAllowance?: number;
}): Promise<{
  employee: Employee;
  position: Position;
  assignment: Assignment;
  salary: EmployeeSalary;
  payslipPreview: PayrollCalculationResult;
}>

export async function createFirstPayrollRun(input: {
  tenantId: string;
  userId: string;
  frequency: 'monthly' | 'bi_weekly';
}): Promise<{
  payrollRun: PayrollRun;
  employeeCount: number;
  totalNetSalary: number;
}>

export async function completeOnboardingV2(
  tenantId: string
): Promise<OnboardingState>
```

**Existing Services to Keep (from `features/onboarding/services/onboarding.service.ts`):**

```typescript
// Line 470: Already working perfectly
export async function selectCountry(input: SelectCountryInput)

// Line 60: Keep for state management
export async function getOnboardingState(tenantId: string): Promise<OnboardingState>
```

### Phase 2: tRPC Endpoints (Week 1)

**New Endpoints to Add:**

```typescript
// server/routers/onboarding.ts

export const onboardingRouter = createTRPCRouter({
  // ✅ KEEP EXISTING (Lines 245-266, 271-297, 302-331)
  selectCountry: publicProcedure.input(...).mutation(...),
  setCompanyInfo: publicProcedure.input(...).mutation(...),
  createFirstEmployee: publicProcedure.input(...).mutation(...),

  // ➕ ADD NEW
  setCompanyInfoV2: publicProcedure
    .input(z.object({
      legalName: z.string().min(2),
      industry: z.string().min(2),
      sector: z.enum(['SERVICES', 'COMMERCE', 'TRANSPORT', 'INDUSTRIE', 'CONSTRUCTION']),
      taxId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return setCompanyInfoV2({
        tenantId: ctx.user.tenantId,
        ...input,
      });
    }),

  createFirstEmployeeV2: publicProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      phone: z.string().min(1),
      positionTitle: z.string().min(1),
      baseSalary: z.number().min(75000), // Country-specific minimum
      hireDate: z.date(),
      // CRITICAL: Family status
      maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
      dependentChildren: z.number().min(0).max(10),
      // OPTIONAL: Allowances
      transportAllowance: z.number().optional(),
      housingAllowance: z.number().optional(),
      mealAllowance: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createFirstEmployeeV2({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),

  createFirstPayrollRun: publicProcedure
    .input(z.object({
      frequency: z.enum(['monthly', 'bi_weekly']),
    }))
    .mutation(async ({ input, ctx }) => {
      return createFirstPayrollRun({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        frequency: input.frequency,
      });
    }),

  completeOnboardingV2: publicProcedure
    .mutation(async ({ ctx }) => {
      return completeOnboardingV2(ctx.user.tenantId);
    }),
});
```

### Phase 3: Frontend Pages (Week 2)

**Pages to Create:**

```
app/onboarding/
  ├── q1/
  │   └── page.tsx         # Country + Company Info
  ├── q2/
  │   └── page.tsx         # First Employee + Payslip Preview
  ├── q3/
  │   └── page.tsx         # Payroll Frequency
  └── success/
      └── page.tsx         # Success Screen
```

### Phase 4: Components (Week 2)

**Components to Create:**

```
features/onboarding/components/
  ├── onboarding-question.tsx          # Layout wrapper
  ├── country-selector.tsx              # Q1: Country selection
  ├── company-info-form.tsx             # Q1: Company info
  ├── employee-form-v2.tsx              # Q2: Employee entry (with family status)
  ├── payslip-preview-card.tsx          # Q2: Immediate success moment
  ├── frequency-selector.tsx            # Q3: Monthly/bi-weekly
  ├── success-celebration.tsx           # Success screen
  └── progressive-feature-cards.tsx     # Optional feature upsells
```

### Phase 5: Optimistic UI (Week 3)

- Add optimistic updates to all mutations
- Add loading/success/error states
- Add rollback on error
- Test network failures (offline, slow 3G)

### Phase 6: Testing (Week 4)

- E2E test: Complete flow (< 5 min)
- Test payroll correctness (family status, allowances, sector)
- Test on mobile devices (5" screens)
- User testing with 5 non-technical users

---

## Question 1: Country + Company Info

### UI Design

**File:** `app/onboarding/q1/page.tsx`

**Layout:**
```tsx
<OnboardingQuestion
  title="Où est située votre entreprise ?"
  subtitle="Nous configurons automatiquement les règles de paie (CNPS, ITS, SMIG)"
  progress={{ current: 1, total: 3 }}
>
  {/* Step 1: Country Selection */}
  <CountrySelector
    value={selectedCountry}
    onSelect={(country) => {
      setSelectedCountry(country);
      selectCountryMutation.mutate({ countryCode: country });
    }}
  />

  {/* Step 2: Company Info (appears after country selected) */}
  {selectedCountry && (
    <CompanyInfoForm
      defaultValues={{
        legalName: user.companyName, // Pre-filled from signup
      }}
      onSubmit={async (data) => {
        await setCompanyInfoMutation.mutateAsync(data);
        router.push('/onboarding/q2');
      }}
    />
  )}
</OnboardingQuestion>
```

### Immediate Actions

**When user selects country:**

```typescript
// Optimistic UI: Show checkmark instantly
setSelectedCountry('CI');
setStatus('saving');

// Background mutation
await selectCountry.mutateAsync({ countryCode: 'CI' });

// Database updates (from service line 470-493)
// - tenant.countryCode = 'CI'
// - tenant.currency = 'XOF'
// - Loads: tax_systems, social_security_schemes for CI

setStatus('saved');
```

**When user submits company info:**

```typescript
// Optimistic UI: Show "Enregistrement..." button state
setIsSubmitting(true);

// Background mutation
await setCompanyInfoV2.mutateAsync({
  legalName: data.legalName,
  industry: data.industry,
  sector: data.sector, // CRITICAL: For work accident rate
  taxId: data.taxId,
});

// Database updates
// - tenant.name = data.legalName
// - tenant.industry = data.industry
// - tenant.settings.sector = data.sector

// Navigate to Q2
router.push('/onboarding/q2');
```

### Component: Country Selector

**File:** `features/onboarding/components/country-selector.tsx`

```tsx
interface CountrySelectorProps {
  value: string | null;
  onSelect: (countryCode: string) => void;
}

export function CountrySelector({ value, onSelect }: CountrySelectorProps) {
  return (
    <div className="space-y-3">
      <CountryCard
        code="CI"
        flag="🇨🇮"
        name="Côte d'Ivoire"
        details="CNPS 6.3%, ITS progressif, SMIG 75,000 FCFA"
        selected={value === 'CI'}
        onClick={() => onSelect('CI')}
      />

      <CountryCard
        code="SN"
        flag="🇸🇳"
        name="Sénégal"
        details="IPRES 14%, IRPP progressif, SMIG 52,500 FCFA"
        disabled
        comingSoon
      />
    </div>
  );
}
```

### Component: Company Info Form

**File:** `features/onboarding/components/company-info-form.tsx`

```tsx
interface CompanyInfoFormProps {
  defaultValues?: {
    legalName?: string;
  };
  onSubmit: (data: CompanyInfoFormData) => Promise<void>;
}

export function CompanyInfoForm({ defaultValues, onSubmit }: CompanyInfoFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(companyInfoSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Nom de l'entreprise"
        {...register('legalName')}
        error={errors.legalName?.message}
        required
      />

      <FormField
        label="Secteur d'activité"
        type="select"
        {...register('sector')}
        error={errors.sector?.message}
        required
        helperText="💡 Détermine le taux de cotisation accident du travail (2-5%)"
      >
        <option value="SERVICES">Services (2% cotisation AT)</option>
        <option value="COMMERCE">Commerce (2% cotisation AT)</option>
        <option value="TRANSPORT">Transport (3% cotisation AT)</option>
        <option value="INDUSTRIE">Industrie (4% cotisation AT)</option>
        <option value="CONSTRUCTION">Construction (5% cotisation AT)</option>
      </FormField>

      <FormField
        label="Secteur d'activité (détail)"
        {...register('industry')}
        error={errors.industry?.message}
        placeholder="Ex: Vente de vêtements, Restaurant, Coiffure"
        required
      />

      <FormField
        label="Numéro fiscal (optionnel)"
        {...register('taxId')}
        error={errors.taxId?.message}
        placeholder="Ex: CI-123456789"
      />

      <Button type="submit" size="lg" className="w-full min-h-[56px]">
        Continuer ✅
      </Button>
    </form>
  );
}

const companyInfoSchema = z.object({
  legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  industry: z.string().min(2, 'Le secteur est requis'),
  sector: z.enum(['SERVICES', 'COMMERCE', 'TRANSPORT', 'INDUSTRIE', 'CONSTRUCTION']),
  taxId: z.string().optional(),
});
```

### What Gets Configured

1. **Country-specific rules loaded:**
   - Tax brackets from `tax_systems` table
   - Social security rates from `social_security_schemes` table
   - Minimum wage (SMIG) for validation

2. **Company info stored:**
   - `tenant.name` - Company legal name
   - `tenant.industry` - Industry description
   - `tenant.settings.sector` - Sector code (for work accident rate)
   - `tenant.taxId` - Tax identification number

3. **Smart defaults set:**
   - Currency = XOF (West Africa CFA franc)
   - Minimum salary validation = 75,000 FCFA (CI)

### Reference Implementation

**Existing code to reuse:**
- Country selection service: `features/onboarding/services/onboarding.service.ts:470-493`
- Company info service: `features/onboarding/services/onboarding.service.ts:508-545`
- Database schema: `drizzle/schema.ts` (tenants table)

---

## Question 2: First Employee + Payslip Preview

### UI Design

**File:** `app/onboarding/q2/page.tsx`

**Layout:**
```tsx
<OnboardingQuestion
  title="Ajoutez votre premier employé"
  subtitle="Pour générer votre première paie"
  progress={{ current: 2, total: 3 }}
>
  <EmployeeFormV2
    defaultValues={{
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      positionTitle: 'Propriétaire',
      hireDate: new Date(),
    }}
    onSubmit={async (data) => {
      const result = await createFirstEmployeeMutation.mutateAsync(data);
      setPayslipPreview(result.payslipPreview);
      setShowSuccess(true);
    }}
  />

  {/* IMMEDIATE SUCCESS MOMENT */}
  {showSuccess && payslipPreview && (
    <PayslipPreviewCard
      employee={employee}
      payslip={payslipPreview}
      onContinue={() => router.push('/onboarding/q3')}
      onEdit={() => setShowSuccess(false)}
    />
  )}
</OnboardingQuestion>
```

### Immediate Actions

**When user submits employee form:**

```typescript
// Optimistic UI: Show "Création..." button state
setIsSubmitting(true);

// Background mutation
const result = await createFirstEmployeeV2.mutateAsync({
  firstName: data.firstName,
  lastName: data.lastName,
  email: data.email,
  phone: data.phone,
  positionTitle: data.positionTitle,
  baseSalary: data.baseSalary,
  hireDate: data.hireDate,
  // CRITICAL: Family status
  maritalStatus: data.maritalStatus,
  dependentChildren: data.dependentChildren,
  // OPTIONAL: Allowances
  transportAllowance: data.transportAllowance || 0,
  housingAllowance: data.housingAllowance || 0,
  mealAllowance: data.mealAllowance || 0,
});

// Database operations (in transaction):
// 1. Create position (line 580-596)
// 2. Create employee (line 601-619) with fiscalParts calculated
// 3. Create assignment (line 622-633)
// 4. Create salary with components (line 636-656)
// 5. Calculate payslip preview using calculatePayrollV2()

// Show immediate success
setPayslipPreview(result.payslipPreview);
setShowSuccess(true);

// Confetti animation
confetti();
```

### Component: Employee Form V2 (with Family Status)

**File:** `features/onboarding/components/employee-form-v2.tsx`

```tsx
interface EmployeeFormV2Props {
  defaultValues?: Partial<EmployeeFormData>;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
}

export function EmployeeFormV2({ defaultValues, onSubmit }: EmployeeFormV2Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchemaV2),
    defaultValues,
  });

  const maritalStatus = watch('maritalStatus');
  const showAllowances = watch('showAllowances', false);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Informations de base</h3>

        <FormField
          label="Prénom"
          {...register('firstName')}
          error={errors.firstName?.message}
          required
        />

        <FormField
          label="Nom"
          {...register('lastName')}
          error={errors.lastName?.message}
          required
        />

        <FormField
          label="Email (optionnel)"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />

        <FormField
          label="Téléphone"
          {...register('phone')}
          error={errors.phone?.message}
          placeholder="+225 01 23 45 67 89"
          required
        />

        <FormField
          label="Fonction"
          {...register('positionTitle')}
          error={errors.positionTitle?.message}
          placeholder="Ex: Gérant, Vendeur, Caissier"
          required
        />

        <FormField
          label="Date d'embauche"
          type="date"
          {...register('hireDate')}
          error={errors.hireDate?.message}
          required
        />
      </div>

      {/* CRITICAL: Family Status (for tax calculation) */}
      <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
        <h3 className="text-lg font-semibold">
          Situation familiale
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (pour le calcul de l'impôt)
          </span>
        </h3>

        <FormField
          label="Statut marital"
          type="select"
          {...register('maritalStatus')}
          error={errors.maritalStatus?.message}
          required
        >
          <option value="single">Célibataire</option>
          <option value="married">Marié(e)</option>
          <option value="divorced">Divorcé(e)</option>
          <option value="widowed">Veuf/Veuve</option>
        </FormField>

        <FormField
          label="Nombre d'enfants à charge"
          type="number"
          {...register('dependentChildren')}
          error={errors.dependentChildren?.message}
          min={0}
          max={10}
          defaultValue={0}
          required
          helperText="💡 Réduit l'impôt sur le revenu (ITS)"
        />

        {/* Show fiscal parts preview */}
        <div className="text-sm p-3 bg-white rounded border">
          <strong>Parts fiscales:</strong> {calculateFiscalParts(maritalStatus, watch('dependentChildren'))}
          <p className="text-muted-foreground mt-1">
            {maritalStatus === 'married' && '1.0 (marié) + '}
            {watch('dependentChildren') > 0 && `${Math.min(watch('dependentChildren'), 4) * 0.5} (enfants)`}
          </p>
        </div>
      </div>

      {/* Salary */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Rémunération</h3>

        <FormField
          label="Salaire de base mensuel"
          type="number"
          {...register('baseSalary')}
          error={errors.baseSalary?.message}
          min={75000}
          suffix="FCFA"
          required
          helperText="💡 Minimum légal: 75,000 FCFA (SMIG Côte d'Ivoire)"
        />

        {/* Optional: Allowances (collapsible) */}
        <Collapsible open={showAllowances}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              onClick={() => setValue('showAllowances', !showAllowances)}
            >
              {showAllowances ? 'Masquer' : 'Ajouter'} les indemnités (transport, logement)
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4">
            <FormField
              label="Indemnité de transport"
              type="number"
              {...register('transportAllowance')}
              error={errors.transportAllowance?.message}
              min={0}
              suffix="FCFA"
              placeholder="Ex: 25,000"
              helperText="Montant mensuel (optionnel)"
            />

            <FormField
              label="Indemnité de logement"
              type="number"
              {...register('housingAllowance')}
              error={errors.housingAllowance?.message}
              min={0}
              suffix="FCFA"
              placeholder="Ex: 50,000"
              helperText="Montant mensuel (optionnel)"
            />

            <FormField
              label="Indemnité de repas"
              type="number"
              {...register('mealAllowance')}
              error={errors.mealAllowance?.message}
              min={0}
              suffix="FCFA"
              placeholder="Ex: 15,000"
              helperText="Montant mensuel (optionnel)"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Button type="submit" size="lg" className="w-full min-h-[56px]">
        Créer mon profil ✅
      </Button>
    </form>
  );
}

const employeeSchemaV2 = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().min(1, 'Le téléphone est requis'),
  positionTitle: z.string().min(1, 'La fonction est requise'),
  baseSalary: z.number().min(75000, 'Inférieur au SMIG de Côte d\'Ivoire (75,000 FCFA)'),
  hireDate: z.date(),
  // CRITICAL: Family status
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
  dependentChildren: z.number().min(0).max(10),
  // OPTIONAL: Allowances
  transportAllowance: z.number().optional(),
  housingAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
});

// Helper: Calculate fiscal parts for preview
function calculateFiscalParts(maritalStatus: string, dependents: number): number {
  let parts = 1.0; // Base

  if (maritalStatus === 'married') {
    parts += 1.0; // +1 for spouse
  }

  // +0.5 per child (max 4 children counted)
  const countedChildren = Math.min(dependents, 4);
  parts += countedChildren * 0.5;

  return parts;
}
```

### Component: Payslip Preview Card (Success Moment)

**File:** `features/onboarding/components/payslip-preview-card.tsx`

```tsx
interface PayslipPreviewCardProps {
  employee: {
    firstName: string;
    lastName: string;
  };
  payslip: PayrollCalculationResult;
  onContinue: () => void;
  onEdit: () => void;
}

export function PayslipPreviewCard({
  employee,
  payslip,
  onContinue,
  onEdit,
}: PayslipPreviewCardProps) {
  return (
    <Card className="border-2 border-green-500 bg-green-50/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              ✅ {employee.firstName} {employee.lastName} ajouté(e)
            </h3>
            <p className="text-sm text-muted-foreground">
              Profil créé et paie calculée automatiquement
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payslip Summary */}
        <div className="p-4 bg-white rounded-lg border">
          <h4 className="font-semibold mb-3">📊 Aperçu de la paie mensuelle</h4>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Salaire brut:</span>
              <strong className="text-lg">{payslip.grossSalary.toLocaleString()} FCFA</strong>
            </div>

            <Separator />

            <div className="flex justify-between text-sm">
              <span>CNPS (6.3%):</span>
              <span className="text-red-600">-{payslip.cnpsEmployee.toLocaleString()} FCFA</span>
            </div>

            {payslip.cmuEmployee > 0 && (
              <div className="flex justify-between text-sm">
                <span>CMU (1%):</span>
                <span className="text-red-600">-{payslip.cmuEmployee.toLocaleString()} FCFA</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>ITS ({payslip.fiscalParts} parts):</span>
              <span className="text-red-600">-{payslip.incomeTax.toLocaleString()} FCFA</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
              <span className="font-semibold">Salaire net:</span>
              <strong className="text-2xl text-green-700">
                {payslip.netSalary.toLocaleString()} FCFA
              </strong>
            </div>
          </div>

          {/* Collapsible: Detailed breakdown */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <ChevronDown className="w-4 h-4 mr-2" />
                Voir les détails
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-3 text-sm">
              {/* Gross components */}
              <div>
                <h5 className="font-semibold mb-2">Composantes du salaire brut:</h5>
                <div className="space-y-1 pl-3">
                  <div className="flex justify-between">
                    <span>Salaire de base:</span>
                    <span>{payslip.baseSalary.toLocaleString()} FCFA</span>
                  </div>
                  {payslip.transportAllowance > 0 && (
                    <div className="flex justify-between">
                      <span>Indemnité transport:</span>
                      <span>{payslip.transportAllowance.toLocaleString()} FCFA</span>
                    </div>
                  )}
                  {payslip.housingAllowance > 0 && (
                    <div className="flex justify-between">
                      <span>Indemnité logement:</span>
                      <span>{payslip.housingAllowance.toLocaleString()} FCFA</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Employer contributions */}
              <div>
                <h5 className="font-semibold mb-2">Cotisations patronales:</h5>
                <div className="space-y-1 pl-3">
                  <div className="flex justify-between">
                    <span>CNPS employeur:</span>
                    <span>{payslip.cnpsEmployer.toLocaleString()} FCFA</span>
                  </div>
                  {payslip.cmuEmployer > 0 && (
                    <div className="flex justify-between">
                      <span>CMU employeur:</span>
                      <span>{payslip.cmuEmployer.toLocaleString()} FCFA</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Coût total employeur:</span>
                  <span>{payslip.totalEmployerCost.toLocaleString()} FCFA</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onContinue}
            size="lg"
            className="flex-1 min-h-[56px]"
          >
            C'est correct, continuer ✅
          </Button>

          <Button
            onClick={onEdit}
            variant="outline"
            size="lg"
          >
            Modifier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Backend Service Implementation

**File:** `features/onboarding/services/onboarding-v2.service.ts`

```typescript
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';

export async function createFirstEmployeeV2(input: CreateFirstEmployeeV2Input) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Validate minimum salary (country-specific)
  const countryCode = tenant.countryCode || 'CI';
  const minimumWage = countryCode === 'CI' ? 75000 : 52500; // CI: 75K, SN: 52.5K

  if (input.baseSalary < minimumWage) {
    throw new ValidationError(
      `Le salaire doit être supérieur ou égal au SMIG de ${countryCode === 'CI' ? 'Côte d\'Ivoire' : 'Sénégal'} (${minimumWage.toLocaleString()} FCFA)`
    );
  }

  // ========================================
  // CALCULATE FISCAL PARTS (Critical for tax)
  // ========================================
  let fiscalParts = 1.0; // Base

  if (input.maritalStatus === 'married') {
    fiscalParts += 1.0; // +1 for spouse
  }

  // +0.5 per child (max 4 children counted)
  const countedChildren = Math.min(input.dependentChildren, 4);
  fiscalParts += countedChildren * 0.5;

  // ========================================
  // CALCULATE CMU FLAG (Critical for CMU employer contribution)
  // ========================================
  const hasFamily = input.maritalStatus === 'married' || input.dependentChildren > 0;

  // ========================================
  // CREATE RECORDS IN TRANSACTION
  // ========================================
  return await db.transaction(async (tx) => {
    // Step 1: Create position
    const [position] = await tx
      .insert(positions)
      .values({
        tenantId: input.tenantId,
        title: input.positionTitle,
        employmentType: 'full_time',
        status: 'active',
        headcount: 1,
        currency: tenant.currency || 'XOF',
        weeklyHours: '40',
        minSalary: String(input.baseSalary),
        maxSalary: String(input.baseSalary),
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    // Step 2: Generate employee number
    const employeeNumber = await generateEmployeeNumber(input.tenantId);

    // Step 3: Create employee with fiscal parts
    const [employee] = await tx
      .insert(employees)
      .values({
        tenantId: input.tenantId,
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone,
        hireDate: input.hireDate.toISOString().split('T')[0],
        countryCode: tenant.countryCode || 'CI',
        coefficient: 100,
        status: 'active',

        // CRITICAL: Store family status for payroll
        maritalStatus: input.maritalStatus,
        dependentChildren: input.dependentChildren,
        fiscalParts: fiscalParts, // Pre-calculated for tax
        hasFamily: hasFamily, // For CMU employer contribution

        customFields: {},
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    // Step 4: Create assignment
    const [assignment] = await tx
      .insert(assignments)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        positionId: position.id,
        assignmentType: 'primary',
        effectiveFrom: input.hireDate.toISOString().split('T')[0],
        effectiveTo: null,
        createdBy: input.userId,
      })
      .returning();

    // Step 5: Create salary with components
    // Auto-inject CNPS, ITS, CMU components
    const componentsWithCalculated = await autoInjectCalculatedComponents({
      tenantId: input.tenantId,
      countryCode: tenant.countryCode || 'CI',
      components: [],
      baseSalary: input.baseSalary,
    });

    const [salary] = await tx
      .insert(employeeSalaries)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        baseSalary: String(input.baseSalary),
        components: componentsWithCalculated,
        currency: tenant.currency || 'XOF',
        effectiveFrom: input.hireDate.toISOString().split('T')[0],
        effectiveTo: null,
        changeReason: 'Initial hire',
        createdBy: input.userId,
      })
      .returning();

    // ========================================
    // CALCULATE PAYSLIP PREVIEW (Immediate feedback)
    // ========================================
    const payslipPreview = await calculatePayrollV2({
      employeeId: employee.id,
      countryCode: tenant.countryCode || 'CI',
      periodStart: new Date(),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      baseSalary: input.baseSalary,
      hireDate: input.hireDate,
      fiscalParts: fiscalParts, // Use calculated fiscal parts
      transportAllowance: input.transportAllowance || 0,
      housingAllowance: input.housingAllowance || 0,
      mealAllowance: input.mealAllowance || 0,
      sectorCode: tenant.settings?.sector || 'SERVICES',
    });

    // Update onboarding state
    const currentSettings = (tenant.settings as any) || {};
    await tx
      .update(tenants)
      .set({
        settings: {
          ...currentSettings,
          onboarding: {
            ...currentSettings.onboarding,
            firstEmployeeId: employee.id,
            current_question: 3, // Move to Q3
          },
        },
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, input.tenantId));

    return {
      employee,
      position,
      assignment,
      salary,
      payslipPreview,
    };
  });
}
```

### What Gets Configured

1. **Employee record created with critical payroll data:**
   - Basic info (name, email, phone, hire date)
   - **Family status** (maritalStatus, dependentChildren) → Calculates fiscalParts
   - **hasFamily** flag → Determines CMU employer contribution

2. **Position and assignment created:**
   - Job position with title, salary range
   - Employee-position link

3. **Salary record created:**
   - Base salary
   - Allowances (transport, housing, meal)
   - Auto-injected components (CNPS, ITS, CMU)

4. **Payslip preview calculated:**
   - Uses `calculatePayrollV2()` from `features/payroll/services/payroll-calculation-v2.ts:64`
   - Loads country-specific rules from database
   - Returns complete breakdown (gross, deductions, net)

### Reference Implementation

**Existing code to reuse:**
- Create employee service: `features/onboarding/services/onboarding.service.ts:563-682`
- Auto-inject components: `lib/salary-components/component-calculator.ts` (line 636)
- Calculate payroll: `features/payroll/services/payroll-calculation-v2.ts:64`
- Database schema: `drizzle/schema.ts` (employees, positions, assignments, employeeSalaries)

---

## Question 3: Payroll Frequency

### UI Design

**File:** `app/onboarding/q3/page.tsx`

**Layout:**
```tsx
<OnboardingQuestion
  title="Quelle est la fréquence de paie ?"
  subtitle="À quelle fréquence payez-vous vos employés ?"
  progress={{ current: 3, total: 3 }}
>
  <FrequencySelector
    onSelect={async (frequency) => {
      await createPayrollRunMutation.mutateAsync({ frequency });
      router.push('/onboarding/success');
    }}
  />
</OnboardingQuestion>
```

### Immediate Actions

**When user selects frequency:**

```typescript
// Optimistic UI: Show "Configuration..." state
setStatus('configuring');

// Background mutation
const result = await createFirstPayrollRun.mutateAsync({
  frequency: 'monthly',
});

// Database operations:
// 1. Update tenant settings (payroll frequency)
// 2. Create first payroll run (draft status)
// 3. Calculate totals for all employees

// Navigate to success screen
router.push('/onboarding/success');
```

### Component: Frequency Selector

**File:** `features/onboarding/components/frequency-selector.tsx`

```tsx
interface FrequencySelectorProps {
  onSelect: (frequency: 'monthly' | 'bi_weekly') => void;
}

export function FrequencySelector({ onSelect }: FrequencySelectorProps) {
  return (
    <div className="space-y-3">
      <FrequencyCard
        value="monthly"
        icon="📅"
        title="Mensuel (fin du mois)"
        description="Paiement une fois par mois"
        example="31 janvier, 28 février, 31 mars..."
        onClick={() => onSelect('monthly')}
      />

      <FrequencyCard
        value="bi_weekly"
        icon="📆"
        title="Bi-mensuel (2x par mois)"
        description="Paiement deux fois par mois"
        example="15 et 30 de chaque mois"
        onClick={() => onSelect('bi_weekly')}
      />
    </div>
  );
}

interface FrequencyCardProps {
  value: string;
  icon: string;
  title: string;
  description: string;
  example: string;
  onClick: () => void;
}

function FrequencyCard(props: FrequencyCardProps) {
  return (
    <Card
      className="p-6 cursor-pointer transition-all hover:shadow-lg hover:border-primary"
      onClick={props.onClick}
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl">{props.icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">{props.title}</h3>
          <p className="text-muted-foreground mb-2">{props.description}</p>
          <p className="text-sm text-primary">
            Exemple: {props.example}
          </p>
        </div>
      </div>
    </Card>
  );
}
```

### Backend Service Implementation

**File:** `features/onboarding/services/onboarding-v2.service.ts`

```typescript
export async function createFirstPayrollRun(input: {
  tenantId: string;
  userId: string;
  frequency: 'monthly' | 'bi_weekly';
}) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Update tenant settings
  const currentSettings = (tenant.settings as any) || {};
  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        payrollFrequency: input.frequency,
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId));

  // Calculate next period based on frequency
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get employee count
  const employeesList = await db
    .select()
    .from(employees)
    .where(eq(employees.tenantId, input.tenantId))
    .where(eq(employees.status, 'active'));

  const employeeCount = employeesList.length;

  // Calculate total net salary (simplified - would use calculatePayrollV2 for each)
  let totalNetSalary = 0;
  for (const emp of employeesList) {
    const [salary] = await db
      .select()
      .from(employeeSalaries)
      .where(eq(employeeSalaries.employeeId, emp.id))
      .where(eq(employeeSalaries.tenantId, input.tenantId))
      .orderBy(desc(employeeSalaries.effectiveFrom))
      .limit(1);

    if (salary) {
      // Quick approximation (actual would use calculatePayrollV2)
      const baseSalary = parseFloat(salary.baseSalary);
      const estimatedNet = baseSalary * 0.85; // ~85% after deductions
      totalNetSalary += estimatedNet;
    }
  }

  // TODO: Create actual payroll run record when payroll_runs table exists
  // For now, just return summary

  return {
    payrollRun: {
      periodStart,
      periodEnd,
      frequency: input.frequency,
      status: 'draft',
    },
    employeeCount,
    totalNetSalary: Math.round(totalNetSalary),
  };
}
```

### What Gets Configured

1. **Payroll frequency stored:**
   - `tenant.settings.payrollFrequency` = 'monthly' | 'bi_weekly'

2. **First payroll run created (draft):**
   - Period: Current month
   - Status: Draft (not finalized)
   - Employee count
   - Total net salary (estimated)

### Reference Implementation

**New service** - No existing equivalent (simplified version for MVP)

---

## Success Screen

### UI Design

**File:** `app/onboarding/success/page.tsx`

**Layout:**
```tsx
<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 flex items-center justify-center">
  <Card className="max-w-2xl w-full">
    <CardHeader className="text-center">
      <Confetti /> {/* Celebration animation */}

      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
        <PartyPopper className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-3xl font-bold mb-2">
        🎉 Félicitations !
      </h1>
      <p className="text-lg text-muted-foreground">
        Votre première paie est prête
      </p>
    </CardHeader>

    <CardContent className="space-y-6">
      {/* Summary */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-green-700">
                {summary.employeeCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Employé{summary.employeeCount > 1 ? 's' : ''}
              </div>
            </div>

            <div>
              <div className="text-3xl font-bold text-green-700">
                {summary.totalNetSalary.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                FCFA à payer
              </div>
            </div>

            <div>
              <div className="text-3xl font-bold text-green-700">
                {summary.frequency === 'monthly' ? 'Mensuel' : 'Bi-mensuel'}
              </div>
              <div className="text-sm text-muted-foreground">
                Fréquence
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <div className="space-y-2">
        <ChecklistItem icon="🇨🇮" text={`Entreprise configurée (${tenant.countryCode})`} />
        <ChecklistItem icon="✅" text={`${summary.employeeCount} employé(s) ajouté(s)`} />
        <ChecklistItem icon="💰" text="Paie calculée automatiquement" />
        <ChecklistItem icon="📅" text="Fréquence configurée" />
      </div>

      {/* Primary action */}
      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full min-h-[56px]"
          onClick={() => router.push('/payroll')}
        >
          Voir le bulletin de paie
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/dashboard')}
        >
          Aller au tableau de bord
        </Button>
      </div>

      {/* Progressive disclosure: Optional features */}
      <Card className="mt-8">
        <CardHeader>
          <h3 className="font-semibold">Voulez-vous configurer ?</h3>
          <p className="text-sm text-muted-foreground">
            Fonctionnalités optionnelles (vous pouvez le faire plus tard)
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              icon="👥"
              title="Ajouter plus d'employés"
              href="/employees/add"
            />

            <FeatureCard
              icon="⏰"
              title="Pointage"
              subtitle="Suivi du temps de travail"
              href="/settings/time-tracking"
            />

            <FeatureCard
              icon="🏖️"
              title="Congés"
              subtitle="Gestion des absences"
              href="/settings/time-off"
            />

            <FeatureCard
              icon="💰"
              title="Indemnités"
              subtitle="Primes et bonus"
              href="/settings/compensation"
            />
          </div>

          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => router.push('/dashboard')}
          >
            Je configurerai plus tard
          </Button>
        </CardContent>
      </Card>
    </CardContent>
  </Card>
</div>
```

### Component: Feature Card (Upsell)

**File:** `features/onboarding/components/progressive-feature-cards.tsx`

```tsx
interface FeatureCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  href: string;
}

export function FeatureCard({ icon, title, subtitle, href }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card className="p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary">
        <div className="text-center">
          <div className="text-3xl mb-2">{icon}</div>
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

interface ChecklistItemProps {
  icon: string;
  text: string;
}

function ChecklistItem({ icon, text }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
      <span className="text-xl">{icon}</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}
```

### Backend Service Implementation

**File:** `features/onboarding/services/onboarding-v2.service.ts`

```typescript
export async function completeOnboardingV2(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', tenantId);
  }

  const currentSettings = (tenant.settings as any) || {};

  // Mark onboarding as complete
  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        onboarding: {
          ...currentSettings.onboarding,
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
          current_question: null,
        },
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));

  return {
    onboarding_complete: true,
    onboarding_completed_at: new Date().toISOString(),
  };
}
```

---

## Backend Services

### New Services to Create

**File:** `features/onboarding/services/onboarding-v2.service.ts`

```typescript
/**
 * Onboarding Service V2 - Task-First Approach
 *
 * Simplifies onboarding to 3 questions with immediate action on each.
 * Focuses on getting to payslip preview as fast as possible.
 */

import { db } from '@/lib/db';
import { tenants, employees, positions, assignments, employeeSalaries } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateEmployeeNumber } from '@/features/employees/services/employee-number';
import { autoInjectCalculatedComponents } from '@/lib/salary-components/component-calculator';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';

// ========================================
// TYPES
// ========================================

export interface SetCompanyInfoV2Input {
  tenantId: string;
  legalName: string;
  industry: string;
  sector: 'SERVICES' | 'COMMERCE' | 'TRANSPORT' | 'INDUSTRIE' | 'CONSTRUCTION';
  taxId?: string;
}

export interface CreateFirstEmployeeV2Input {
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  positionTitle: string;
  baseSalary: number;
  hireDate: Date;
  // CRITICAL: Family status (payroll correctness)
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number; // 0-10
  // OPTIONAL: Allowances
  transportAllowance?: number;
  housingAllowance?: number;
  mealAllowance?: number;
}

export interface CreateFirstPayrollRunInput {
  tenantId: string;
  userId: string;
  frequency: 'monthly' | 'bi_weekly';
}

// ========================================
// SERVICE FUNCTIONS
// ========================================

/**
 * Set company information with sector (V2)
 *
 * Adds sector field which is critical for work accident rate calculation.
 */
export async function setCompanyInfoV2(input: SetCompanyInfoV2Input) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  const currentSettings = (tenant.settings as any) || {};

  const [updated] = await db
    .update(tenants)
    .set({
      name: input.legalName,
      industry: input.industry,
      taxId: input.taxId || null,
      settings: {
        ...currentSettings,
        sector: input.sector, // CRITICAL: For work accident rate
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId))
    .returning();

  return updated;
}

/**
 * Create first employee with family status (V2)
 *
 * CRITICAL CHANGES FROM V1:
 * - Collects maritalStatus and dependentChildren
 * - Calculates fiscalParts for tax deduction
 * - Calculates hasFamily for CMU employer contribution
 * - Returns immediate payslip preview
 */
export async function createFirstEmployeeV2(input: CreateFirstEmployeeV2Input) {
  // [Implementation shown in Question 2 section above]
  // See lines 547-682 for reference to existing createFirstEmployee
  // Key additions: fiscalParts calculation, hasFamily flag, payslip preview
}

/**
 * Create first payroll run (V2)
 *
 * Stores payroll frequency and creates draft payroll run.
 */
export async function createFirstPayrollRun(input: CreateFirstPayrollRunInput) {
  // [Implementation shown in Question 3 section above]
}

/**
 * Complete onboarding (V2)
 *
 * Marks onboarding as complete in tenant settings.
 */
export async function completeOnboardingV2(tenantId: string) {
  // [Implementation shown in Success Screen section above]
}
```

### Existing Services to Keep

**From:** `features/onboarding/services/onboarding.service.ts`

```typescript
// Line 470-493: ✅ Keep (works perfectly)
export async function selectCountry(input: SelectCountryInput)

// Line 60-83: ✅ Keep (state management)
export async function getOnboardingState(tenantId: string)
```

### Services to Deprecate (Not Remove Yet)

**From:** `features/onboarding/services/onboarding.service.ts`

```typescript
// Line 88-127: ❌ Deprecate (no longer using questionnaire)
export async function answerQuestion(...)

// Line 146-301: ❌ Deprecate (no longer using path preview)
export async function getPathPreview(...)

// Line 306-324: ❌ Deprecate (no longer using step-based flow)
export async function startOnboarding(...)

// Line 329-358: ❌ Deprecate (no longer using steps)
export async function completeStep(...)
```

**Migration Strategy:** Keep old functions for backward compatibility during transition, mark as `@deprecated` in JSDoc.

---

## tRPC API Endpoints

### Endpoints to Add

**File:** `server/routers/onboarding.ts`

[Implementation shown in Phase 2 of Implementation Roadmap above]

### Endpoints to Keep

**From:** `server/routers/onboarding.ts`

```typescript
// Lines 245-266: ✅ Keep
selectCountry: publicProcedure.input(...).mutation(...)

// Lines 149-161: ✅ Keep (state management)
getState: publicProcedure.query(...)

// Lines 188-203: ✅ Keep (final completion)
complete: publicProcedure.mutation(...)
```

### Endpoints to Deprecate

```typescript
// Lines 59-79: ❌ Deprecate (questionnaire not used)
getQuestionnaireState: publicProcedure.query(...)

// Lines 84-106: ❌ Deprecate (questionnaire not used)
answerQuestion: publicProcedure.mutation(...)

// Lines 111-123: ❌ Deprecate (path preview not used)
getPathPreview: publicProcedure.query(...)

// Lines 128-144: ❌ Deprecate (step-based flow not used)
startOnboarding: publicProcedure.mutation(...)

// Lines 166-183: ❌ Deprecate (steps not used)
completeStep: publicProcedure.mutation(...)
```

---

## Frontend Components

### Core Layout Component

**File:** `features/onboarding/components/onboarding-question.tsx`

```tsx
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OnboardingQuestionProps {
  title: string;
  subtitle: string;
  progress?: {
    current: number;
    total: number;
  };
  showProgress?: boolean;
  children: ReactNode;
}

export function OnboardingQuestion({
  title,
  subtitle,
  progress = { current: 1, total: 3 },
  showProgress = true,
  children,
}: OnboardingQuestionProps) {
  const progressPercent = (progress.current / progress.total) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 p-4">
      {/* Progress bar */}
      {showProgress && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Étape {progress.current} sur {progress.total}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Question card */}
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader className="text-center pb-4">
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {children}
        </CardContent>
      </Card>

      {/* Help text */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        Besoin d'aide ? <a href="/support" className="underline hover:text-primary">Contactez-nous</a>
      </p>
    </div>
  );
}
```

### Reusable Form Components

**File:** `features/onboarding/components/form-field.tsx`

```tsx
import { forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  suffix?: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'select';
  children?: React.ReactNode; // For select options
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, suffix, type = 'text', children, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={props.name} className="text-base">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {type === 'select' ? (
          <select
            ref={ref as any}
            className={cn(
              "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              error && "border-red-500",
              className
            )}
            {...props}
          >
            {children}
          </select>
        ) : (
          <div className="relative">
            <Input
              ref={ref}
              type={type}
              className={cn(
                "min-h-[48px] text-base",
                error && "border-red-500",
                suffix && "pr-20",
                className
              )}
              {...props}
            />
            {suffix && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {suffix}
              </div>
            )}
          </div>
        )}

        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
```

### All Components Summary

**Components to create:**

```
features/onboarding/components/
  ├── onboarding-question.tsx          # Layout wrapper (implemented above)
  ├── form-field.tsx                   # Reusable form field (implemented above)
  ├── country-selector.tsx             # Q1: Country cards (implemented in Q1)
  ├── company-info-form.tsx            # Q1: Company form (implemented in Q1)
  ├── employee-form-v2.tsx             # Q2: Employee entry (implemented in Q2)
  ├── payslip-preview-card.tsx         # Q2: Success moment (implemented in Q2)
  ├── frequency-selector.tsx           # Q3: Frequency cards (implemented in Q3)
  ├── success-celebration.tsx          # Success screen main component
  └── progressive-feature-cards.tsx    # Optional feature upsells (implemented in Success)
```

**Existing components to keep:**

```
features/onboarding/components/
  ├── onboarding-layout.tsx            # ❌ Deprecate (replaced by onboarding-question.tsx)
  ├── question-option-card.tsx         # ✅ Keep (can reuse for frequency/country cards)
  └── help-box.tsx                     # ✅ Keep (helpful hints)
```

---

## Database Schema Updates

### Required Schema Changes

**File:** `drizzle/schema.ts` (or relevant schema file)

#### 1. Add Family Status Fields to `employees` Table

```typescript
export const employees = pgTable('employees', {
  // ... existing fields ...

  // CRITICAL: Family status (for tax calculation)
  maritalStatus: varchar('marital_status', { length: 20 }), // 'single', 'married', 'divorced', 'widowed'
  dependentChildren: integer('dependent_children').default(0), // 0-10
  fiscalParts: numeric('fiscal_parts', { precision: 3, scale: 1 }).default('1.0'), // Pre-calculated fiscal parts
  hasFamily: boolean('has_family').default(false), // For CMU employer contribution

  // ... other fields ...
});
```

**Migration:**

```sql
-- Migration: Add family status fields
ALTER TABLE employees
  ADD COLUMN marital_status VARCHAR(20),
  ADD COLUMN dependent_children INTEGER DEFAULT 0,
  ADD COLUMN fiscal_parts NUMERIC(3,1) DEFAULT 1.0,
  ADD COLUMN has_family BOOLEAN DEFAULT false;

-- Set defaults for existing employees
UPDATE employees
SET
  marital_status = 'single',
  dependent_children = 0,
  fiscal_parts = 1.0,
  has_family = false
WHERE marital_status IS NULL;
```

#### 2. Add Sector Field to `tenants` Settings

**Current:**
```typescript
settings: jsonb('settings') // Generic JSONB
```

**Usage:**
```typescript
// Store sector in tenant.settings.sector
{
  "sector": "SERVICES", // or COMMERCE, TRANSPORT, INDUSTRIE, CONSTRUCTION
  "onboarding": { ... },
  "payrollFrequency": "monthly"
}
```

**No schema change needed** - Already using JSONB for flexibility.

#### 3. Ensure Required Tables Exist

**Already exist (from `drizzle/schema.ts`):**
- ✅ `tenants` - Company information
- ✅ `employees` - Employee records
- ✅ `positions` - Job positions
- ✅ `assignments` - Employee-position links
- ✅ `employee_salaries` - Salary records
- ✅ `tax_systems` - Country tax rules
- ✅ `social_security_schemes` - CNPS/IPRES/CMU rates

**May need to create later (not blocking for MVP):**
- ⚠️ `payroll_runs` - Payroll run records (can use tenant settings for now)
- ⚠️ `payslips` - Individual payslips (can generate on-the-fly for now)

### Database Schema References

**Main schema file:** `drizzle/schema.ts`

**Key tables for onboarding:**
```typescript
// From drizzle/schema.ts
import { tenants } from '@/drizzle/schema'; // Company data
import { employees } from '@/drizzle/schema'; // Employee records
import { positions } from '@/drizzle/schema'; // Job positions
import { assignments } from '@/drizzle/schema'; // Employee-position links
import { employeeSalaries } from '@/drizzle/schema'; // Salary records with components
```

**Payroll configuration tables:**
```typescript
// Referenced in calculatePayrollV2 (line 70-73)
import { taxSystems } from '@/drizzle/schema'; // Tax brackets by country
import { socialSecuritySchemes } from '@/drizzle/schema'; // CNPS/IPRES rates
import { familyDeductionRules } from '@/drizzle/schema'; // Family allowances
```

---

## Testing Strategy

### Phase 1: Unit Tests

**Test:** Backend service functions

```typescript
// features/onboarding/services/__tests__/onboarding-v2.service.test.ts

describe('createFirstEmployeeV2', () => {
  it('should calculate fiscal parts correctly for single employee', async () => {
    const result = await createFirstEmployeeV2({
      maritalStatus: 'single',
      dependentChildren: 0,
      // ... other fields
    });

    expect(result.employee.fiscalParts).toBe(1.0);
  });

  it('should calculate fiscal parts correctly for married with 2 children', async () => {
    const result = await createFirstEmployeeV2({
      maritalStatus: 'married',
      dependentChildren: 2,
      // ... other fields
    });

    // 1.0 (base) + 1.0 (married) + 1.0 (2 children × 0.5) = 3.0
    expect(result.employee.fiscalParts).toBe(3.0);
  });

  it('should calculate hasFamily flag correctly', async () => {
    const result = await createFirstEmployeeV2({
      maritalStatus: 'married',
      dependentChildren: 0,
      // ... other fields
    });

    expect(result.employee.hasFamily).toBe(true);
  });

  it('should return payslip preview with correct calculations', async () => {
    const result = await createFirstEmployeeV2({
      baseSalary: 300000,
      transportAllowance: 25000,
      maritalStatus: 'single',
      dependentChildren: 0,
      // ... other fields
    });

    expect(result.payslipPreview.grossSalary).toBe(325000);
    expect(result.payslipPreview.cnpsEmployee).toBeGreaterThan(0);
    expect(result.payslipPreview.incomeTax).toBeGreaterThan(0);
    expect(result.payslipPreview.netSalary).toBeLessThan(result.payslipPreview.grossSalary);
  });
});
```

### Phase 2: Integration Tests

**Test:** Complete onboarding flow

```typescript
// app/onboarding/__tests__/onboarding-flow.test.ts

describe('3-Question Onboarding Flow', () => {
  it('should complete onboarding in < 5 minutes', async () => {
    const startTime = Date.now();

    // Q1: Country + Company
    await selectCountry({ countryCode: 'CI' });
    await setCompanyInfoV2({
      legalName: 'Ma Boutique',
      industry: 'Commerce de détail',
      sector: 'COMMERCE',
    });

    // Q2: First Employee
    const empResult = await createFirstEmployeeV2({
      firstName: 'Jean',
      lastName: 'Kouassi',
      phone: '+225 01 23 45 67 89',
      positionTitle: 'Gérant',
      baseSalary: 300000,
      hireDate: new Date(),
      maritalStatus: 'married',
      dependentChildren: 2,
      transportAllowance: 25000,
    });

    expect(empResult.payslipPreview).toBeDefined();
    expect(empResult.payslipPreview.netSalary).toBeGreaterThan(0);

    // Q3: Payroll Frequency
    await createFirstPayrollRun({ frequency: 'monthly' });

    // Complete
    await completeOnboardingV2(tenantId);

    const endTime = Date.now();
    const durationMinutes = (endTime - startTime) / 1000 / 60;

    expect(durationMinutes).toBeLessThan(5); // Should complete in < 5 min
  });
});
```

### Phase 3: Payroll Correctness Tests

**Test:** Verify payroll calculations with family status

```typescript
// features/payroll/__tests__/payroll-correctness.test.ts

describe('Payroll Correctness with Family Status', () => {
  it('should calculate lower tax for married employee with children', async () => {
    // Create employee: Married + 2 children
    const marriedEmp = await createFirstEmployeeV2({
      baseSalary: 300000,
      maritalStatus: 'married',
      dependentChildren: 2,
      // ... other fields
    });

    // Create employee: Single, no children (same salary)
    const singleEmp = await createFirstEmployeeV2({
      baseSalary: 300000,
      maritalStatus: 'single',
      dependentChildren: 0,
      // ... other fields
    });

    // Married employee should pay LESS tax
    expect(marriedEmp.payslipPreview.incomeTax).toBeLessThan(singleEmp.payslipPreview.incomeTax);

    // Married employee should have higher net salary
    expect(marriedEmp.payslipPreview.netSalary).toBeGreaterThan(singleEmp.payslipPreview.netSalary);
  });

  it('should calculate CMU employer contribution for employees with family', async () => {
    const empWithFamily = await createFirstEmployeeV2({
      baseSalary: 300000,
      maritalStatus: 'married',
      dependentChildren: 0,
      // ... other fields
    });

    // Should have CMU employer contribution (1%)
    expect(empWithFamily.payslipPreview.cmuEmployer).toBeGreaterThan(0);
  });

  it('should use correct sector rate for work accident contribution', async () => {
    // Set company sector to CONSTRUCTION (5% AT rate)
    await setCompanyInfoV2({
      sector: 'CONSTRUCTION',
      // ... other fields
    });

    const emp = await createFirstEmployeeV2({
      baseSalary: 300000,
      // ... other fields
    });

    // Total employer contribution should include 5% work accident rate
    // (This test depends on how work accident is stored in payslip)
    expect(emp.payslipPreview.cnpsEmployer).toBeGreaterThan(0);
  });
});
```

### Phase 4: E2E Tests (Playwright)

**Test:** Full user journey

```typescript
// e2e/onboarding.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should complete onboarding and see payslip preview', async ({ page }) => {
    await page.goto('/onboarding/q1');

    // Q1: Select country
    await page.click('text=🇨🇮 Côte d\'Ivoire');
    await expect(page.locator('text=Configuration automatique: CNPS 6.3%')).toBeVisible();

    // Fill company info
    await page.fill('input[name="legalName"]', 'Ma Boutique');
    await page.selectOption('select[name="sector"]', 'COMMERCE');
    await page.fill('input[name="industry"]', 'Vente de vêtements');
    await page.click('button:has-text("Continuer")');

    // Q2: Add first employee
    await expect(page).toHaveURL('/onboarding/q2');

    await page.fill('input[name="firstName"]', 'Jean');
    await page.fill('input[name="lastName"]', 'Kouassi');
    await page.fill('input[name="phone"]', '+225 01 23 45 67 89');
    await page.fill('input[name="positionTitle"]', 'Gérant');
    await page.fill('input[name="baseSalary"]', '300000');

    // Family status
    await page.selectOption('select[name="maritalStatus"]', 'married');
    await page.fill('input[name="dependentChildren"]', '2');

    // Submit
    await page.click('button:has-text("Créer mon profil")');

    // Should see payslip preview
    await expect(page.locator('text=ajouté')).toBeVisible();
    await expect(page.locator('text=Salaire net')).toBeVisible();

    // Verify net salary is displayed
    const netSalary = await page.locator('text=/\\d{3},\\d{3} FCFA/').first();
    await expect(netSalary).toBeVisible();

    // Continue to Q3
    await page.click('button:has-text("C\'est correct, continuer")');

    // Q3: Select frequency
    await expect(page).toHaveURL('/onboarding/q3');
    await page.click('text=Mensuel (fin du mois)');

    // Should reach success screen
    await expect(page).toHaveURL('/onboarding/success');
    await expect(page.locator('text=Félicitations')).toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 });

    // Run same flow as above
    // Verify touch targets are ≥ 44px
    // Verify no horizontal scrolling
  });
});
```

### Phase 5: User Testing

**Process:**
1. Recruit 5 users with low digital literacy
2. Give task: "Set up your first employee and calculate their salary"
3. Observe (no help allowed)
4. Measure:
   - Time to completion (target: < 5 min)
   - Errors made (target: < 1 error)
   - Help requests (target: 0)
   - Confidence rating (target: 4/5)

**Success Criteria:**
- ✅ 4/5 users complete in < 5 minutes
- ✅ 5/5 users see payslip preview without help
- ✅ 4/5 users rate confidence as 4/5 or higher

---

## Migration Plan

### Phase 1: Parallel Implementation (Week 1-2)

**Goal:** Build new flow alongside existing flow

**Tasks:**
1. Create new service functions (`onboarding-v2.service.ts`)
2. Add new tRPC endpoints (keep existing ones)
3. Create new page routes (`/onboarding/q1`, `/onboarding/q2`, `/onboarding/q3`)
4. Build new components

**Testing:** Test new flow in isolation (feature flag)

### Phase 2: Feature Flag Rollout (Week 3)

**Goal:** Gradual rollout to users

**Implementation:**
```typescript
// app/onboarding/page.tsx

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Feature flag: Use new onboarding for 10% of users
    const useNewOnboarding = user.id.charCodeAt(0) % 10 === 0;

    if (useNewOnboarding) {
      router.push('/onboarding/q1'); // New flow
    } else {
      router.push('/onboarding/questionnaire'); // Old flow
    }
  }, []);

  return null;
}
```

**Rollout Schedule:**
- Week 3, Day 1: 10% of users
- Week 3, Day 3: 25% of users
- Week 3, Day 5: 50% of users
- Week 4, Day 1: 100% of users

### Phase 3: Monitor & Iterate (Week 4)

**Metrics to Track:**

```typescript
// Analytics events
analytics.track('onboarding_started', {
  flow: 'v2',
  timestamp: Date.now(),
});

analytics.track('onboarding_question_completed', {
  questionNumber: 1,
  duration: 45, // seconds
});

analytics.track('onboarding_completed', {
  flow: 'v2',
  totalDuration: 240, // seconds (4 min)
  employeeCount: 1,
  hadErrors: false,
});
```

**Success Metrics:**
- Average completion time < 5 minutes (target: 3-4 min)
- Completion rate > 90% (users who start finish)
- Error rate < 5%
- Payroll correctness: 100% (no missing family status)

### Phase 4: Cleanup (Week 5)

**Goal:** Remove old flow

**Tasks:**
1. Delete old questionnaire page (`/onboarding/questionnaire`)
2. Delete old step pages (`/onboarding/steps/*`)
3. Mark old service functions as `@deprecated`
4. Remove old tRPC endpoints (after grace period)
5. Update documentation

**Migration Safety:**
- Keep old functions for 1 month (in case of rollback)
- Add console warnings: `console.warn('Using deprecated onboarding function')`
- Redirect old URLs to new flow

---

## Appendix: File Reference Map

### Services

| File | Line | Function | Status |
|------|------|----------|--------|
| `features/onboarding/services/onboarding.service.ts` | 470-493 | `selectCountry()` | ✅ Keep |
| `features/onboarding/services/onboarding.service.ts` | 508-545 | `setCompanyInfo()` | ✅ Keep |
| `features/onboarding/services/onboarding.service.ts` | 563-682 | `createFirstEmployee()` | 🔄 Enhance to V2 |
| `features/onboarding/services/onboarding-v2.service.ts` | New | `setCompanyInfoV2()` | ➕ Create |
| `features/onboarding/services/onboarding-v2.service.ts` | New | `createFirstEmployeeV2()` | ➕ Create |
| `features/onboarding/services/onboarding-v2.service.ts` | New | `createFirstPayrollRun()` | ➕ Create |
| `features/onboarding/services/onboarding-v2.service.ts` | New | `completeOnboardingV2()` | ➕ Create |

### Payroll Calculation

| File | Line | Function | Usage |
|------|------|----------|-------|
| `features/payroll/services/payroll-calculation-v2.ts` | 64-100 | `calculatePayrollV2()` | ✅ Use for payslip preview |
| `lib/salary-components/component-calculator.ts` | 636 | `autoInjectCalculatedComponents()` | ✅ Use for CNPS/ITS/CMU injection |

### Database Schema

| File | Table | Fields | Status |
|------|-------|--------|--------|
| `drizzle/schema.ts` | `tenants` | `name`, `countryCode`, `currency`, `settings` | ✅ Existing |
| `drizzle/schema.ts` | `employees` | All fields + NEW: `maritalStatus`, `dependentChildren`, `fiscalParts`, `hasFamily` | 🔄 Add fields |
| `drizzle/schema.ts` | `positions` | All fields | ✅ Existing |
| `drizzle/schema.ts` | `assignments` | All fields | ✅ Existing |
| `drizzle/schema.ts` | `employee_salaries` | All fields | ✅ Existing |

### tRPC Router

| File | Line | Endpoint | Status |
|------|------|----------|--------|
| `server/routers/onboarding.ts` | 245-266 | `selectCountry` | ✅ Keep |
| `server/routers/onboarding.ts` | 271-297 | `setCompanyInfo` | ✅ Keep |
| `server/routers/onboarding.ts` | 302-331 | `createFirstEmployee` | 🔄 Enhance to V2 |
| `server/routers/onboarding.ts` | New | `setCompanyInfoV2` | ➕ Create |
| `server/routers/onboarding.ts` | New | `createFirstEmployeeV2` | ➕ Create |
| `server/routers/onboarding.ts` | New | `createFirstPayrollRun` | ➕ Create |
| `server/routers/onboarding.ts` | New | `completeOnboardingV2` | ➕ Create |

### Documentation

| File | Section | Reference |
|------|---------|-----------|
| `docs/HCI-DESIGN-PRINCIPLES.md` | All | Design principles to follow |
| `docs/ONBOARDING-PAYROLL-CORRECTNESS-AUDIT.md` | All | Critical payroll data requirements |
| `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` | All | Multi-country architecture |
| `docs/01-CONSTRAINTS-AND-RULES.md` | All | Hard constraints |

---

## Summary Checklist

### Before Starting Implementation

- [ ] Read `docs/HCI-DESIGN-PRINCIPLES.md` (understand design philosophy)
- [ ] Read `docs/ONBOARDING-PAYROLL-CORRECTNESS-AUDIT.md` (understand critical data)
- [ ] Read this document fully (understand architecture)
- [ ] Set up feature flag system (for gradual rollout)

### Backend (Week 1)

- [ ] Create `features/onboarding/services/onboarding-v2.service.ts`
- [ ] Implement `setCompanyInfoV2()` with sector field
- [ ] Implement `createFirstEmployeeV2()` with family status + payslip preview
- [ ] Implement `createFirstPayrollRun()` with frequency
- [ ] Implement `completeOnboardingV2()`
- [ ] Add new tRPC endpoints to `server/routers/onboarding.ts`
- [ ] Write unit tests for all service functions
- [ ] Test payroll correctness (family status → fiscal parts → tax)

### Database (Week 1)

- [ ] Add migration for employee family status fields
- [ ] Test migration on staging database
- [ ] Run migration on production database
- [ ] Verify existing employees have default values

### Frontend Components (Week 2)

- [ ] Create `features/onboarding/components/onboarding-question.tsx`
- [ ] Create `features/onboarding/components/form-field.tsx`
- [ ] Create `features/onboarding/components/country-selector.tsx`
- [ ] Create `features/onboarding/components/company-info-form.tsx`
- [ ] Create `features/onboarding/components/employee-form-v2.tsx`
- [ ] Create `features/onboarding/components/payslip-preview-card.tsx`
- [ ] Create `features/onboarding/components/frequency-selector.tsx`
- [ ] Create `features/onboarding/components/progressive-feature-cards.tsx`

### Frontend Pages (Week 2)

- [ ] Create `app/onboarding/q1/page.tsx` (Country + Company)
- [ ] Create `app/onboarding/q2/page.tsx` (Employee + Payslip)
- [ ] Create `app/onboarding/q3/page.tsx` (Frequency)
- [ ] Create `app/onboarding/success/page.tsx` (Success screen)
- [ ] Add routing logic with feature flag

### Optimistic UI (Week 3)

- [ ] Add optimistic updates to all mutations
- [ ] Add loading states (button spinners, skeleton loaders)
- [ ] Add success states (checkmarks, confetti)
- [ ] Add error states (rollback, error messages)
- [ ] Test offline behavior (network failures)

### Testing (Week 4)

- [ ] Write unit tests for all service functions
- [ ] Write integration tests for complete flow
- [ ] Write payroll correctness tests (family status scenarios)
- [ ] Write E2E tests with Playwright
- [ ] Test on mobile devices (5" screens, touch targets)
- [ ] Conduct user testing with 5 non-technical users

### Deployment (Week 4-5)

- [ ] Deploy to staging environment
- [ ] Enable feature flag for 10% of users
- [ ] Monitor metrics (completion time, error rate)
- [ ] Gradually increase to 100%
- [ ] Document any issues found
- [ ] Plan cleanup of old flow

### Cleanup (Week 5)

- [ ] Mark old functions as `@deprecated`
- [ ] Add console warnings to old functions
- [ ] Delete old pages (after grace period)
- [ ] Delete old endpoints (after grace period)
- [ ] Update documentation
- [ ] Celebrate successful migration! 🎉

---

**Questions or Issues?**

Contact: [Your team's communication channel]

**Last Updated:** October 8, 2025
