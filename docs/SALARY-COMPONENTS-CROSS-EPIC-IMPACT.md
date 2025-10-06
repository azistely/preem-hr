# 🔗 Salary Components System - Cross-EPIC Impact Analysis

**Date:** October 2025
**Status:** Design Complete, Implementation Pending
**Primary EPIC:** 06-EPIC-EMPLOYEE-MANAGEMENT.md

---

## Executive Summary

The new **Salary Components System** introduces a three-level admin architecture (Super Admin → Tenant Admin → HR Manager) with:
- Country-specific standard components (seeded by super admin)
- Template library for common custom components
- Sector-based configurations (work accident rates, smart defaults)
- Flexible JSONB metadata for multi-country tax treatment

**This impacts 3 EPICs:**
1. ✅ **EPIC 06 - Employee Management** (Primary owner)
2. ⚠️ **EPIC 05 - Payroll** (Must read components with metadata)
3. ⚠️ **EPIC 08 - Onboarding Workflow** (Must include sector selection + template library)

---

## 🎯 Impact on EPIC 05: Payroll

**Location:** `/docs/05-EPIC-PAYROLL.md`

### Required Changes

#### 1. Update Salary Input Sources

**Current:**
```typescript
// Reads from old format
const salary = {
  baseSalary: employee.baseSalary,
  housingAllowance: employee.housingAllowance,
  transportAllowance: employee.transportAllowance,
  mealAllowance: employee.mealAllowance,
};
```

**New (Backward Compatible):**
```typescript
// Reads from components with fallback
const getEmployeeSalaryComponents = (employee: Employee) => {
  // Try new format first
  if (employee.currentSalary.components && employee.currentSalary.components.length > 0) {
    return employee.currentSalary.components;
  }

  // Fallback to old format
  return convertOldFormat(employee.currentSalary);
};

const convertOldFormat = (salary: EmployeeSalary) => {
  return [
    { code: '11', amount: salary.baseSalary, name: 'Salaire de base', metadata: { ... } },
    { code: '23', amount: salary.housingAllowance, name: 'Indemnité logement', metadata: { ... } },
    // ...
  ];
};
```

---

#### 2. Update Tax Calculation Logic

**Current:** Uses hardcoded tax treatment
```typescript
const brutImposable = baseSalary + housingAllowance + mealAllowance;  // Fixed logic
const salaireCategoriel = baseSalary;  // Only base
```

**New:** Reads metadata dynamically
```typescript
const calculateTaxBase = (components: Component[], countryCode: string) => {
  switch (countryCode) {
    case 'CI':
      return calculateCI(components);
    case 'BF':
      return calculateBF(components);
    case 'SN':
      return calculateSN(components);
  }
};

const calculateCI = (components: Component[]) => {
  const salaireCategoriel = components
    .filter(c => c.metadata?.taxTreatment?.includeInSalaireCategoriel)
    .reduce((sum, c) => sum + c.amount, 0);

  const brutImposable = components
    .filter(c => c.metadata?.taxTreatment?.includeInBrutImposable)
    .reduce((sum, c) => sum + c.amount, 0);

  return { salaireCategoriel, brutImposable };
};
```

---

#### 3. Update Payslip Generation

**Current:** Fixed 4 lines
```
Salaire de base:        300,000 FCFA
Indemnité logement:      50,000 FCFA
Indemnité transport:     30,000 FCFA
```

**New:** Dynamic component listing
```typescript
const generatePayslipLines = (components: Component[]) => {
  return components
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map(component => ({
      code: component.code,
      label: component.name,
      amount: component.amount,
      isTaxable: component.metadata?.taxTreatment?.isTaxable || false,
    }));
};

// Renders as:
// Salaire de base (11):        300,000 FCFA
// Prime d'ancienneté (21):      12,000 FCFA
// Indemnité logement (23):      50,000 FCFA
// Prime de téléphone (CUSTOM_001):  10,000 FCFA
```

---

#### 4. Add Auto-Calculate Seniority

**New Feature:**
```typescript
// features/payroll/services/component-calculators.ts
export const calculateSeniority = (
  baseSalary: number,
  hireDate: Date,
  asOfDate: Date
): Component => {
  const yearsOfService = differenceInYears(asOfDate, hireDate);
  const seniorityRate = Math.min(yearsOfService * 0.02, 0.25);  // Max 25%

  return {
    code: '21',
    amount: Math.round(baseSalary * seniorityRate),
    name: "Prime d'ancienneté",
    metadata: {
      taxTreatment: {
        isTaxable: true,
        includeInBrutImposable: true,
        includeInSalaireCategoriel: false,
      },
      autoCalculated: true,
      formula: `${yearsOfService} years × 2% × ${baseSalary}`,
    },
  };
};

// Used in payroll calculation
const components = await getEmployeeSalaryComponents(employee);
const baseComponent = components.find(c => c.code === '11');
const seniority = calculateSeniority(baseComponent.amount, employee.hireDate, payrollPeriod.endDate);
components.push(seniority);  // Add to components before calculation
```

---

### Updated Files in EPIC 05

```
features/payroll/services/
├── payroll-calculation-v2.ts        ← Update to read components
├── component-calculators.ts         ← NEW: Seniority auto-calc
├── tax-base-calculator.ts           ← NEW: Country-specific bases
└── metadata-readers.ts              ← NEW: Read tax treatment

features/payroll/types/
└── salary-components.ts             ← NEW: Component types

components/payroll/
├── payslip-preview.tsx              ← Update to list components
└── payslip-pdf-generator.tsx        ← Update PDF template
```

---

### Acceptance Criteria Updates for EPIC 05

Add to existing criteria:
- [ ] Read salary from `components` array with fallback to old format
- [ ] Support country-specific tax base calculation via metadata
- [ ] Auto-calculate seniority bonus (code 21) during payroll run
- [ ] Display all components dynamically on payslip
- [ ] Handle custom components (codes starting with "CUSTOM_")
- [ ] Respect tax treatment metadata for each component

---

## 🎯 Impact on EPIC 08: Onboarding Workflow

**Location:** `/docs/08-EPIC-ONBOARDING-WORKFLOW.md`

### Required Changes

#### 1. Add Sector Selection Step

**New Onboarding Step (After Company Info):**

```tsx
// features/onboarding/components/sector-selection-step.tsx
export const SectorSelectionStep = ({ form }) => {
  const { data: sectors } = useSectorConfigurations(form.watch('countryCode'));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quel est votre secteur d'activité?</CardTitle>
        <CardDescription>
          Cela nous permet de configurer automatiquement les taux et composants appropriés
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup>
          {sectors?.map(sector => (
            <div key={sector.code} className="flex items-center space-x-2 p-4 border rounded">
              <RadioGroupItem value={sector.code} />
              <Label>
                <div className="font-medium">{sector.name.fr}</div>
                <div className="text-sm text-muted-foreground">
                  Taux d'accident du travail: {sector.workAccidentRate * 100}%
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Auto-configuration preview */}
        {form.watch('sectorCode') && (
          <Alert className="mt-4">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Configuration automatique</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm">
                <li>Taux d'accidents: {selectedSector.workAccidentRate * 100}%</li>
                <li>Composants standard: {selectedSector.commonComponents.length}</li>
                <li>Salaire par défaut: {formatCurrency(selectedSector.smartDefaults.baseSalary)}</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
```

---

#### 2. Add Template Library Step (Optional)

**New Optional Step:**

```tsx
// features/onboarding/components/component-templates-step.tsx
export const ComponentTemplatesStep = ({ form }) => {
  const { data: templates } = usePopularTemplates(form.watch('countryCode'));
  const addTemplate = useAddFromTemplate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composants de salaire populaires (Optionnel)</CardTitle>
        <CardDescription>
          Ajoutez des composants couramment utilisés dans votre pays
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates?.map(template => (
            <Card key={template.code}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {getComponentIcon(template.category)}
                  {template.name.fr}
                </CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Montant suggéré:</span>
                    <span className="font-medium">
                      {formatCurrency(template.suggestedAmount)} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Imposable:</span>
                    <span>{template.metadata.taxTreatment.isTaxable ? 'Oui' : 'Non'}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => addTemplate.mutate(template.code)}
                  className="w-full"
                >
                  Ajouter
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Button variant="ghost">Passer cette étape</Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

#### 3. Update Onboarding Flow

**New Step Sequence:**

```typescript
// features/onboarding/config/onboarding-steps.ts
export const ONBOARDING_STEPS = [
  {
    id: 'company-info',
    title: 'Informations de l\'entreprise',
    component: CompanyInfoStep,
    required: true,
  },
  {
    id: 'sector',              // ← NEW
    title: 'Secteur d\'activité',
    component: SectorSelectionStep,
    required: true,
  },
  {
    id: 'component-templates', // ← NEW (Optional)
    title: 'Composants de salaire',
    component: ComponentTemplatesStep,
    required: false,
  },
  {
    id: 'admin-user',
    title: 'Administrateur',
    component: AdminUserStep,
    required: true,
  },
  // ... rest
];
```

---

### Updated Files in EPIC 08

```
features/onboarding/components/
├── sector-selection-step.tsx         ← NEW
├── component-templates-step.tsx      ← NEW
└── onboarding-wizard.tsx             ← Update step flow

features/onboarding/hooks/
├── use-sector-configurations.ts      ← NEW
├── use-popular-templates.ts          ← NEW
└── use-add-from-template.ts          ← NEW

features/onboarding/services/
└── company-setup-service.ts          ← Update to save sector
```

---

### Acceptance Criteria Updates for EPIC 08

Add to existing criteria:
- [ ] Display sector selection with work accident rates
- [ ] Show auto-configuration preview when sector selected
- [ ] Save sector to tenant settings
- [ ] Display popular component templates for tenant's country
- [ ] Allow one-click "add from template" during onboarding
- [ ] Make template selection optional (can skip)
- [ ] Pre-configure smart defaults based on sector selection

---

## 📊 New Database Tables (Shared Across EPICs)

### salary_component_definitions
```sql
CREATE TABLE salary_component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  category VARCHAR(20) NOT NULL,
  component_type VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  is_common BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code, code)
);
```

### salary_component_templates
```sql
CREATE TABLE salary_component_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}',
  suggested_amount NUMERIC(15,2),
  is_popular BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code, code)
);
```

### sector_configurations
```sql
CREATE TABLE sector_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  sector_code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  work_accident_rate NUMERIC(5,4) NOT NULL,
  default_components JSONB DEFAULT '{}',
  smart_defaults JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code, sector_code)
);
```

### custom_salary_components
```sql
CREATE TABLE custom_salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_code VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, country_code, code)
);

-- RLS Policy
CREATE POLICY tenant_isolation ON custom_salary_components
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Update employee_salaries table
```sql
ALTER TABLE employee_salaries
  ADD COLUMN components JSONB DEFAULT '[]';

-- Backward compatibility: Keep existing columns
-- baseSalary, housingAllowance, transportAllowance, mealAllowance
```

---

## 🚀 Implementation Order

1. **Phase 1: Database Schema** (EPIC 06)
   - [ ] Create 4 new tables
   - [ ] Add `components` column to employee_salaries
   - [ ] Seed standard components for CI
   - [ ] Seed component templates library
   - [ ] Seed sector configurations

2. **Phase 2: Backend Services** (EPIC 06)
   - [ ] Implement tRPC routers for component management
   - [ ] Build metadata builder/reader utilities
   - [ ] Create component auto-calculators (seniority)

3. **Phase 3: Payroll Integration** (EPIC 05)
   - [ ] Update payroll calculation to read components
   - [ ] Implement country-specific tax base calculators
   - [ ] Update payslip generation

4. **Phase 4: Onboarding Updates** (EPIC 08)
   - [ ] Add sector selection step
   - [ ] Add template library step (optional)
   - [ ] Update company setup service

5. **Phase 5: Employee Management UI** (EPIC 06)
   - [ ] Update hire wizard to use components
   - [ ] Add "custom allowance" UI for HR
   - [ ] Build admin settings for component management

---

## ✅ Testing Considerations

### Cross-EPIC Integration Tests

```typescript
describe('Salary Components Cross-EPIC Integration', () => {
  it('should hire employee → auto-inject components → run payroll with metadata', async () => {
    // EPIC 06: Hire employee
    const employee = await createEmployee({
      baseSalary: 300000,
      housingAllowance: 50000,
      transportAllowance: 30000,
    });

    // Verify components auto-injected
    expect(employee.currentSalary.components).toHaveLength(3);
    expect(employee.currentSalary.components[0].metadata.taxTreatment).toBeDefined();

    // EPIC 05: Run payroll
    const payrollResult = await calculatePayrollV2(employee, '2025-10', 'CI');

    // Verify metadata used correctly
    expect(payrollResult.salaireCategoriel).toBe(300000);  // Only base
    expect(payrollResult.brutImposable).toBe(380000);      // Base + housing
  });

  it('should complete onboarding → sector configured → hire with smart defaults', async () => {
    // EPIC 08: Onboarding with sector selection
    await completeOnboarding({
      countryCode: 'CI',
      sectorCode: 'CONSTRUCTION',
    });

    const tenant = await getTenant();
    expect(tenant.settings.workAccidentRate).toBe(0.05);

    // EPIC 06: Hire employee with smart defaults
    const defaults = await getEmployeeDefaults(tenant.id);
    expect(defaults.baseSalary).toBe(200000);  // Higher for construction
  });
});
```

---

## 📚 Documentation Updates Required

### EPIC 05 - Payroll
- [ ] Add "Reading Salary Components" section
- [ ] Document metadata-based tax calculations
- [ ] Add backward compatibility notes
- [ ] Update payslip examples with components

### EPIC 08 - Onboarding
- [ ] Add sector selection step documentation
- [ ] Document template library integration
- [ ] Update onboarding flow diagrams
- [ ] Add auto-configuration examples

### EPIC 06 - Employee Management
- [x] Three-level admin architecture documented
- [x] Multi-country metadata design documented
- [x] Data model updated with new tables
- [x] Acceptance criteria updated

---

## 🔄 Migration Strategy

**Existing Data:**
- Keep old columns (baseSalary, housingAllowance, etc.) for backward compatibility
- Background job to migrate old format → components array
- Dual-write during transition period

**Migration Script:**
```sql
-- Migrate existing salaries to component format
UPDATE employee_salaries
SET components = jsonb_build_array(
  jsonb_build_object(
    'code', '11',
    'amount', base_salary,
    'name', 'Salaire de base',
    'metadata', (SELECT metadata FROM salary_component_definitions WHERE code = '11' AND country_code = 'CI')
  ),
  jsonb_build_object(
    'code', '23',
    'amount', housing_allowance,
    'name', 'Indemnité logement',
    'metadata', (SELECT metadata FROM salary_component_definitions WHERE code = '23' AND country_code = 'CI')
  )
  -- ... rest
)
WHERE components = '[]';
```

---

**Document Version:** 1.0
**Last Updated:** October 2025
**Status:** Ready for Implementation
