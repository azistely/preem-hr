# Sectors and Industries Management

## 📋 Overview

This document explains how sectors (secteurs d'activité) and industries affect salary components, compliance rules, and payroll calculations in Preem HR.

**Key Concepts:**
- **Industry (Industrie)** = High-level business classification stored at tenant level
- **Sector (Secteur)** = Legal classification that determines mandatory components and contribution rates
- **Sector Configurations** = Country-specific rules tied to Conventions Collectives Sectorielles

---

## 🏗️ Current Architecture

### Database Schema

```sql
-- Tenant-level industry (informational)
tenants
  ├── industry: text (nullable)
  └── country_code: text (default 'CI')

-- Sector-based legal rules (compliance)
sector_configurations
  ├── country_code: varchar(2)
  ├── sector_code: varchar(50)  -- e.g., 'AGRICULTURE', 'CONSTRUCTION'
  ├── work_accident_rate: decimal(5,4)  -- e.g., 0.0500 = 5%
  ├── default_components: jsonb
  │   ├── commonComponents: string[]  -- Required components
  │   └── excludedComponents: string[]  -- Not applicable
  └── smart_defaults: jsonb
      ├── baseSalary: number
      ├── housingAllowance: number
      └── transportAllowance: number

-- Sector-specific contribution rates
sector_contribution_overrides
  ├── contribution_type_id: uuid
  ├── sector_code: varchar(50)
  ├── sector_name: jsonb
  ├── employee_rate: decimal(5,4)
  └── employer_rate: decimal(5,4)
```

### Current Sectors (Côte d'Ivoire)

Based on Convention Collective Interprofessionnelle + Sectoral agreements:

| Sector Code | Work Accident Rate | Required Components | Smart Defaults (FCFA) |
|-------------|-------------------|---------------------|------------------------|
| **SERVICES** | 2.0% | 22, 23, 24 | Base: 150k, Housing: 30k, Transport: 25k |
| **CONSTRUCTION** | 5.0% | 22, 23, 24, HAZARD_PAY, CLOTHING | Base: 200k, Housing: 50k, Transport: 30k |
| **AGRICULTURE** | 2.5% | 22, 23 (excludes 24) | Base: 120k, Housing: 25k, Transport: 20k |
| **INDUSTRY** | 3.0% | 22, 23, 24 | Base: 180k, Housing: 40k, Transport: 25k |
| **TRANSPORT** | 4.0% | 22, 23, 24, FUEL_SUBSIDY | Base: 160k, Housing: 35k, Transport: 40k |
| **MINING** | 5.0% | 22, 23, 24, HAZARD_PAY, CLOTHING | Base: 250k, Housing: 60k, Transport: 35k |

**Component Codes:**
- `22` = Seniority bonus (ancienneté)
- `23` = Housing allowance (logement)
- `24` = Transport allowance (transport)
- `HAZARD_PAY` = Indemnité de risque (high-risk sectors)
- `CLOTHING` = Indemnité d'habillement (uniforms/protective gear)
- `FUEL_SUBSIDY` = Prime de carburant (transport sector)

---

## 🔍 Current State Analysis

### ✅ What We Have

1. **Tenant-level industry field:**
   - Stored in `tenants.industry` (text, nullable)
   - Currently informational only (not used in payroll logic)
   - Examples: "Technology", "Retail", "Construction"

2. **Sector configurations table:**
   - Country-specific sector rules
   - Work accident rates (AT/MP contribution)
   - Required salary components per sector
   - Smart defaults for new hires

3. **Sector contribution overrides:**
   - Sector-specific CNPS rates
   - Can vary by sector within same country

### ❌ What We DON'T Have

1. **No subsidiary table:**
   - Multi-entity groups not yet supported
   - Cannot have different sectors per subsidiary
   - All employees under same tenant = same industry

2. **No employee-level sector assignment:**
   - Employees don't have individual sector fields
   - Sector determined implicitly from tenant or subsidiary

3. **No UI for sector selection:**
   - Tenant setup doesn't ask for sector
   - Payroll doesn't enforce sector-based required components
   - No validation that required components are activated

4. **No sector enforcement in payroll:**
   - `calculatePayrollV2()` uses country, not sector
   - Work accident rates are country-wide, not sector-specific
   - Required components not validated

---

## 🎯 Use Cases

### Use Case 1: Single Company (One Sector)

**Scenario:** Small company, all employees in same sector

**Example:**
- **Company:** "SOGEBAT Côte d'Ivoire"
- **Sector:** CONSTRUCTION
- **Employees:** 50 (all construction workers)

**Required:**
- Tenant has `industry = "Construction"`
- System infers `sector_code = "CONSTRUCTION"` from industry
- All employees automatically get:
  - Work accident rate: 5%
  - Required components: HAZARD_PAY, CLOTHING
  - Smart defaults applied

**Current Gap:** ❌ Sector not inferred, work accident rate is country-wide (2% for all)

---

### Use Case 2: Multi-Entity Group (Multiple Sectors)

**Scenario:** Corporate group with subsidiaries in different sectors

**Example:**
- **Parent:** "Groupe BATIMAT"
- **Subsidiaries:**
  - "BATIMAT Construction" → Sector: CONSTRUCTION (5% accident rate)
  - "BATIMAT Logistics" → Sector: TRANSPORT (4% accident rate)
  - "BATIMAT Mining" → Sector: MINING (5% accident rate)

**Required:**
- Parent tenant + 3 subsidiary records
- Each subsidiary has its own `sector_code`
- Employees assigned to subsidiaries
- Payroll uses subsidiary's sector for:
  - Work accident rate
  - Required components
  - Contribution overrides

**Current Gap:** ❌ Subsidiaries table doesn't exist

---

### Use Case 3: Mixed-Sector Company (One Company, Multiple Sectors)

**Scenario:** Single company with employees in different sectors

**Example:**
- **Company:** "Société Générale CI"
- **Employees:**
  - 200 office workers → Sector: SERVICES (2% accident rate)
  - 50 drivers → Sector: TRANSPORT (4% accident rate)
  - 10 maintenance → Sector: CONSTRUCTION (5% accident rate)

**Required:**
- Employee-level sector field
- Payroll calculates per-employee sector-specific rates
- Different required components per employee group

**Current Gap:** ❌ No employee.sector field, mixed sectors not supported

---

## 🏛️ Legal Framework

### Convention Collective Interprofessionnelle (1977)

**Applies to:** All sectors in Côte d'Ivoire

**Defines:**
- Base salary components (ancienneté, logement, transport)
- Tax treatment (ITS calculation)
- CNPS base rules
- Leave entitlements

### Conventions Collectives Sectorielles

**Sector-specific agreements that ADD to the base convention:**

| Sector | Additional Rules |
|--------|------------------|
| **BTP (Construction)** | Indemnité de risque (5-10% base), vêtements de travail, accident rate 5% |
| **Mines** | Indemnité de risque (10-15% base), équipements spéciaux, accident rate 5% |
| **Transport** | Prime de carburant, heures supplémentaires spécifiques |
| **Agriculture** | Logement souvent fourni en nature, pas de transport |

**Key Point:** Sectoral conventions are **additive** (not replacements)
- Employee gets: Base convention + Sector-specific rules
- Example: Construction worker gets standard components + HAZARD_PAY + CLOTHING

---

## 🛠️ Implementation Recommendations

### Option A: Tenant-Level Sector Only (Simple)

**When to use:** Small companies, single sector

**Schema:**
```sql
ALTER TABLE tenants
  ADD COLUMN sector_code VARCHAR(50),
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code);
```

**Pros:**
- ✅ Simplest implementation
- ✅ Covers 80% of use cases
- ✅ Easy to enforce required components

**Cons:**
- ❌ Cannot support multi-sector groups
- ❌ All employees forced into same sector

---

### Option B: Subsidiary-Level Sectors (Multi-Entity)

**When to use:** Corporate groups, holding companies

**Schema:**
```sql
CREATE TABLE subsidiaries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  parent_subsidiary_id UUID REFERENCES subsidiaries(id), -- For hierarchies
  name TEXT NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  sector_code VARCHAR(50) NOT NULL,
  legal_entity_id TEXT, -- RCCM number
  tax_id TEXT, -- NIF
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code)
);

ALTER TABLE employees
  ADD COLUMN subsidiary_id UUID REFERENCES subsidiaries(id);

-- Payroll uses employee.subsidiary.sector_code for rules
```

**Pros:**
- ✅ Supports multi-entity groups
- ✅ Different sectors per subsidiary
- ✅ Legal entity separation
- ✅ Realistic for large enterprises

**Cons:**
- ❌ More complex schema
- ❌ Overkill for small companies
- ❌ Requires subsidiary management UI

---

### Option C: Employee-Level Sectors (Maximum Flexibility)

**When to use:** Mixed-sector companies

**Schema:**
```sql
ALTER TABLE employees
  ADD COLUMN sector_code VARCHAR(50),
  ADD CONSTRAINT fk_employee_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code);

-- country_code derived from employee.tenant.country_code
```

**Pros:**
- ✅ Maximum flexibility
- ✅ Supports mixed-sector companies
- ✅ Per-employee customization

**Cons:**
- ❌ Most complex
- ❌ High risk of user error
- ❌ Difficult to enforce consistency
- ❌ Not how sectors work legally (usually company-wide)

---

### ✅ Recommended Approach: **Hybrid (A + B)**

**Phase 1:** Tenant-level sector (MVP)
- Add `tenants.sector_code` (required)
- Enforce required components on activation
- Use sector-specific work accident rates
- Smart defaults on employee creation

**Phase 2:** Subsidiary support (Enterprise)
- Add `subsidiaries` table
- Employee assigned to subsidiary
- Payroll resolution: `employee.subsidiary.sector_code || employee.tenant.sector_code`

**Phase 3:** Employee-level override (Edge cases)
- Add `employees.sector_override` (nullable)
- Only used when employee's actual sector differs from company
- Example: Accountant (SERVICES) working at construction company (CONSTRUCTION)

---

## 📝 Implementation Checklist

### Phase 1: Tenant-Level Sector (MVP)

**Database:**
- [ ] Add `tenants.sector_code VARCHAR(50)` (nullable for now, required after migration)
- [ ] Add foreign key: `tenants(country_code, sector_code)` → `sector_configurations`
- [ ] Migrate existing tenants: Set sector based on industry field (best guess)

**Business Logic:**
- [ ] Create `getSectorForEmployee(employeeId)` function
  ```typescript
  // Returns employee's applicable sector
  // Resolution: employee.sector_override || employee.subsidiary?.sector_code || employee.tenant.sector_code
  ```

**Payroll:**
- [ ] Update `calculatePayrollV2()` to accept `sectorCode` param
- [ ] Load sector-specific work accident rate
- [ ] Load sector-specific contribution overrides
- [ ] Validate required components are present

**Component Activation:**
- [ ] Add sector validation on component activation
- [ ] Show warning if activating excluded component for sector
- [ ] Show error if deactivating required component for sector
- [ ] UI: Badge showing "Requis par secteur BTP" on required components

**Tenant Setup:**
- [ ] Add sector selection to tenant onboarding
- [ ] Load sectors from `sector_configurations WHERE country_code = tenant.country_code`
- [ ] Display as cards with:
  - Sector name
  - Work accident rate
  - Required components
  - Smart defaults preview

### Phase 2: Subsidiary Support

**Database:**
- [ ] Create `subsidiaries` table (see Option B schema)
- [ ] Add `employees.subsidiary_id UUID` (nullable)
- [ ] RLS policies for subsidiary isolation

**UI:**
- [ ] Subsidiaries management page (`/settings/subsidiaries`)
- [ ] Create subsidiary wizard (name, country, sector, legal IDs)
- [ ] Employee assignment to subsidiary
- [ ] Payroll by subsidiary filtering

**Reporting:**
- [ ] Payroll summary per subsidiary
- [ ] Cross-subsidiary consolidation
- [ ] Sector-based analytics

---

## 🚨 Compliance Rules

### Mandatory Components Enforcement

**Rule:** If tenant/subsidiary has sector with required components, those components MUST be activated

**Example:**
```typescript
// CONSTRUCTION sector requires: HAZARD_PAY, CLOTHING
const sectorConfig = await getSectorConfig('CI', 'CONSTRUCTION');
const requiredCodes = sectorConfig.default_components.commonComponents;

// On tenant.sector_code update:
await enforceRequiredComponents(tenantId, requiredCodes);

// On component deactivation:
if (requiredCodes.includes(componentCode)) {
  throw new Error(`Cannot deactivate ${componentCode}: Required by sector ${sectorCode}`);
}
```

**UI Indicators:**
- 🔒 **Required** badge (red, cannot deactivate)
- ⚙️ **Recommended** badge (blue, can deactivate with warning)
- 🎨 **Optional** badge (gray, free choice)

### Work Accident Rates

**Rule:** Use sector-specific rate, not country-wide rate

```typescript
// BEFORE (incorrect):
const workAccidentRate = socialSecurityScheme.employer_rates.work_accident; // 2% for all

// AFTER (correct):
const sectorConfig = await getSectorConfig(countryCode, sectorCode);
const workAccidentRate = sectorConfig.work_accident_rate; // 2-5% depending on sector
```

### Sector Contribution Overrides

**Rule:** Check for sector-specific CNPS rates before using country defaults

```typescript
// Query sector_contribution_overrides
const override = await db.query.sectorContributionOverrides.findFirst({
  where: and(
    eq(sectorContributionOverrides.contributionTypeId, contributionType.id),
    eq(sectorContributionOverrides.sectorCode, sectorCode)
  )
});

const rate = override
  ? { employee: override.employee_rate, employer: override.employer_rate }
  : { employee: contributionType.employee_rate, employer: contributionType.employer_rate };
```

---

## 🎨 UI/UX Patterns

### Tenant Setup: Sector Selection

**Design:** Card-based selector (HCI-compliant)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {sectors.map(sector => (
    <Card
      key={sector.code}
      className={cn(
        "cursor-pointer transition-all",
        selected === sector.code && "border-primary border-2"
      )}
      onClick={() => setSelected(sector.code)}
    >
      <CardHeader>
        <CardTitle>{sector.name}</CardTitle>
        <CardDescription>
          Taux AT/MP: {sector.work_accident_rate * 100}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium">Composants obligatoires:</p>
          <div className="flex flex-wrap gap-2">
            {sector.required_components.map(code => (
              <Badge key={code} variant="destructive">
                🔒 {getComponentName(code)}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### Component Activation: Compliance Badges

```tsx
<div className="flex items-center gap-2">
  <span>{component.name}</span>
  {isRequiredBySector(component.code, tenant.sector_code) && (
    <Badge variant="destructive" className="gap-1">
      🔒 Requis par secteur {tenant.sector_code}
    </Badge>
  )}
  {isExcludedBySector(component.code, tenant.sector_code) && (
    <Badge variant="secondary" className="gap-1">
      ⚠️ Non applicable au secteur {tenant.sector_code}
    </Badge>
  )}
</div>
```

### Payroll Wizard: Sector-Aware Defaults

```tsx
// Step 2: Employee details
<FormField
  control={form.control}
  name="baseSalary"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Salaire de base</FormLabel>
      <FormControl>
        <Input
          type="number"
          {...field}
          placeholder={getSectorSmartDefault(tenant.sector_code, 'baseSalary')}
        />
      </FormControl>
      <FormDescription>
        Recommandé pour le secteur {tenant.sector_code}: {
          getSectorSmartDefault(tenant.sector_code, 'baseSalary').toLocaleString('fr-FR')
        } FCFA
      </FormDescription>
    </FormItem>
  )}
/>
```

---

## 📊 Migration Strategy

### Step 1: Add Field (Non-Breaking)

```sql
-- Add nullable field
ALTER TABLE tenants
  ADD COLUMN sector_code VARCHAR(50);

-- Add foreign key (deferred)
ALTER TABLE tenants
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code)
    DEFERRABLE INITIALLY DEFERRED;
```

### Step 2: Data Migration

```sql
-- Best-effort mapping from industry to sector
UPDATE tenants
SET sector_code = CASE
  WHEN industry ILIKE '%construct%' OR industry ILIKE '%btp%' THEN 'CONSTRUCTION'
  WHEN industry ILIKE '%agri%' THEN 'AGRICULTURE'
  WHEN industry ILIKE '%mining%' OR industry ILIKE '%mine%' THEN 'MINING'
  WHEN industry ILIKE '%transport%' THEN 'TRANSPORT'
  WHEN industry ILIKE '%industr%' OR industry ILIKE '%manufactur%' THEN 'INDUSTRY'
  ELSE 'SERVICES' -- Default
END
WHERE country_code = 'CI';

-- Verify all tenants have valid sectors
SELECT COUNT(*) FROM tenants WHERE sector_code IS NULL;
```

### Step 3: Make Required

```sql
-- Make field required
ALTER TABLE tenants
  ALTER COLUMN sector_code SET NOT NULL;

-- Update constraint
ALTER TABLE tenants
  DROP CONSTRAINT fk_tenant_sector,
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code);
```

---

## 🔬 Testing Scenarios

### Test 1: Sector-Based Required Components

```typescript
test('CONSTRUCTION sector requires HAZARD_PAY and CLOTHING', async () => {
  const tenant = await createTenant({
    country_code: 'CI',
    sector_code: 'CONSTRUCTION'
  });

  // Should auto-activate required components
  const activations = await getActiveComponents(tenant.id);
  expect(activations.map(a => a.code)).toContain('HAZARD_PAY');
  expect(activations.map(a => a.code)).toContain('CLOTHING');

  // Should prevent deactivation
  await expect(
    deactivateComponent(tenant.id, 'HAZARD_PAY')
  ).rejects.toThrow('Required by sector CONSTRUCTION');
});
```

### Test 2: Work Accident Rate

```typescript
test('Uses sector-specific work accident rate', async () => {
  const employee = await createEmployee({
    tenantId: constructionTenant.id,
    baseSalary: 200000
  });

  const payroll = await calculatePayrollV2({
    employeeId: employee.id,
    period: '2025-01',
  });

  // CONSTRUCTION = 5%, not default 2%
  expect(payroll.contributions.work_accident.employer_rate).toBe(0.05);
  expect(payroll.contributions.work_accident.employer_amount).toBe(10000); // 5% of 200k
});
```

### Test 3: Smart Defaults

```typescript
test('Applies sector smart defaults on hire', async () => {
  const wizard = createHireWizard(tenant); // CONSTRUCTION sector

  // Wizard should pre-fill with sector defaults
  expect(wizard.defaults.baseSalary).toBe(200000);
  expect(wizard.defaults.housingAllowance).toBe(50000);
  expect(wizard.defaults.transportAllowance).toBe(30000);
});
```

---

## 📚 References

- **Convention Collective Interprofessionnelle (1977):** Base rules for all sectors
- **Code du Travail CI:** Legal framework for employment
- **Décret CNPS:** Social security contribution rules
- **`/docs/RCI-Convention-Collective-Interprofessionnelle-1977.pdf`:** Full text
- **`/docs/COMPLIANCE-RCI-CONVENTION-COLLECTIVE-1977.md`:** Implementation notes
- **`sector_configurations` table:** Current sector data (6 sectors for CI)
- **`sector_contribution_overrides` table:** Sector-specific CNPS rates

---

## ✅ Summary

**Current State:**
- ✅ `sector_configurations` table exists with 6 sectors for CI
- ✅ Work accident rates defined per sector (2-5%)
- ✅ Required components defined per sector
- ✅ Smart defaults for salary components
- ❌ No tenant.sector_code field (industry is informational only)
- ❌ No subsidiary support
- ❌ Payroll doesn't use sector-specific rules

**Next Steps:**
1. Add `tenants.sector_code` field (Phase 1 MVP)
2. Enforce required components on activation/deactivation
3. Update payroll to use sector-specific work accident rates
4. Add sector selection to tenant onboarding UI
5. Show compliance badges on component management
6. (Future) Add subsidiaries table for multi-entity groups

**Business Impact:**
- **Compliance:** Ensures legal requirements met per sector
- **UX:** Smart defaults reduce data entry (pre-fill with sector averages)
- **Accuracy:** Correct work accident rates (can be 2× difference between sectors)
- **Audit:** Clear audit trail of why components are required/excluded
