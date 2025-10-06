# Formula Editing Gap Analysis

**Last Updated:** 2025-10-06
**Status:** Gap Identification & Implementation Plan

---

## 🎯 Executive Summary

**Current State:** Formula components (seniority, family allowance) are auto-calculated but formulas are **hardcoded** in calculator functions. Custom components support metadata-based formulas but there's **no UI to edit formulas**.

**Gap:** No way for users (Super Admin, Tenant Admin, HR Manager) to **modify formula parameters** when:
- Government changes regulations (e.g., seniority from 2% → 2.5%)
- Company policy changes (e.g., custom component percentage update)
- Individual employee exceptions (e.g., special seniority rate)

---

## 📊 Current Implementation Analysis

### What Works Today

#### 1. **Standard Components (Super Admin Seeded)**
```typescript
// Code: 11-41 (base salary, transport, housing, etc.)
// Location: salary_component_definitions table
// Metadata: Contains taxTreatment, socialSecurityTreatment
// Formula Support: ✅ Stored in metadata.calculationRule
```

**Example (Seniority - Code 21):**
```json
{
  "taxTreatment": {
    "isTaxable": true,
    "includeInBrutImposable": true,
    "includeInSalaireCategoriel": true
  },
  "calculationRule": {
    "type": "auto-calculated",
    "rate": 0.02,   // 2% per year
    "cap": 0.25     // Max 25%
  }
}
```

**Problem:** Formula is in **database metadata** but calculator function **ignores it** and uses hardcoded values:

```typescript
// lib/salary-components/component-calculator.ts (lines 76-77)
const ratePerYear = metadata?.calculationRule?.rate ?? 0.02; // ✅ Reads metadata
const maxRate = metadata?.calculationRule?.cap ?? 0.25;      // ✅ Reads metadata

// BUT: Standard components don't have metadata loaded in payroll context!
// Metadata only exists on custom components, not standard definitions
```

---

#### 2. **Custom Components (Tenant-Specific)**
```typescript
// Codes: CUSTOM_001, CUSTOM_002, etc.
// Location: custom_salary_components table
// Metadata: Full metadata support (tax, CNPS, formulas)
// Formula Support: ✅ Stored in metadata.calculationRule
```

**Example (Custom Overtime):**
```json
{
  "taxTreatment": { "isTaxable": true },
  "calculationRule": {
    "type": "percentage",
    "rate": 1.5,      // 150% of hourly rate
    "baseAmount": 0   // Will be calculated
  }
}
```

**Problem:**
- ✅ Metadata stored correctly
- ❌ No UI to **create** formula-based custom components (only tax metadata form)
- ❌ No UI to **edit** formula parameters after creation
- ❌ No validation/preview when changing formulas

---

#### 3. **Template Library (Curated)**
```typescript
// Codes: PHONE, PERFORMANCE, etc.
// Location: salary_component_templates table
// Formula Support: ✅ Stored in metadata
```

**Current Behavior:**
- Templates have `suggestedAmount` (fixed amounts like 10,000 FCFA)
- No formula templates exist yet (all are fixed amounts)
- When added to tenant, becomes custom component with metadata

---

### Formula Calculation Flow (Current)

```typescript
// STEP 1: Hire employee
autoInjectCalculatedComponents({
  baseSalary: 300000,
  hireDate: new Date('2018-01-01'),
  taxDependents: 2,
  countryCode: 'CI'
})
→ Calls calculateSeniorityBonus() with HARDCODED defaults (0.02, 0.25)
→ Returns component instance: { code: '21', amount: 42000, ... }

// STEP 2: Payroll run
getEmployeeSalaryComponents(employeeSalary)
→ Reads employee_salaries.components (JSONB array)
→ Recalculates auto-calculated components
→ BUT: Still uses HARDCODED defaults, not DB metadata!
```

**Key Issue:** Calculator functions have fallback defaults that **always execute** because standard component metadata is **never loaded** during payroll.

---

## 🚨 Identified Gaps

### Gap 1: No Way to Update Standard Component Formulas

**Use Case:** Côte d'Ivoire government changes seniority from 2%/year to 2.5%/year

**Current Behavior:**
1. Super admin can update `salary_component_definitions.metadata` in database
2. ❌ But calculator function still uses hardcoded fallback: `rate ?? 0.02`
3. ❌ No UI to make this change (requires SQL)
4. ❌ Change affects all tenants globally (not tenant-specific)

**Expected Behavior:**
- Super admin can edit standard component formulas via UI
- Changes apply to all tenants using that component
- Effective date support (apply from next payroll period)
- Audit trail of formula changes

**Impact:** **CRITICAL** - Regulatory compliance depends on this

---

### Gap 2: No Way to Override Standard Component Formulas Per Tenant

**Use Case:** Company wants seniority to max at 20% instead of 25% (stricter policy)

**Current Behavior:**
- ❌ No mechanism to override standard component formulas
- Only workaround: Create custom component with different formula
- But then employee has 2 seniority components (confusing)

**Expected Behavior:**
- Tenant admin can override standard component formula parameters
- Override stored in tenant-specific config
- Clearly labeled as "Customized" in UI
- Option to revert to standard

**Impact:** **HIGH** - Companies need policy flexibility

---

### Gap 3: No UI to Create/Edit Custom Component Formulas

**Use Case:** Create "Overtime Pay" component that calculates 1.5× hourly rate

**Current Behavior:**
- ✅ Custom component creation form exists (`/settings/salary-components/new`)
- ✅ Tax treatment form (CI-specific checkboxes)
- ❌ No formula builder UI
- ❌ No way to specify calculation type (fixed/percentage/auto-calculated)
- Only workaround: Manually edit `custom_salary_components.metadata` in database

**Expected Behavior:**
- Formula builder section in create/edit form
- Select calculation type: Fixed Amount / Percentage / Auto-Calculated
- Input fields for rate, cap, base amount
- Preview calculation with sample data
- Validation rules

**Impact:** **HIGH** - Blocks non-technical users from using formulas

---

### Gap 4: No Employee-Specific Formula Overrides

**Use Case:** Senior engineer gets special seniority rate (3%/year instead of 2%)

**Current Behavior:**
- ❌ No way to override formula for individual employee
- Only workaround: Manually calculate and add as custom allowance (loses auto-calculation)

**Expected Behavior:**
- Option to override component formula per employee
- Stored in `employee_salaries.components` with `overrideMetadata` flag
- Clearly shown in UI ("Custom rate for this employee")
- Audit trail

**Impact:** **MEDIUM** - Needed for individual negotiations

---

### Gap 5: No Formula Change History/Versioning

**Use Case:** View what seniority formula was used in January vs. October

**Current Behavior:**
- ❌ Metadata changes overwrite previous values
- ❌ No audit trail of formula changes
- ❌ Historical payslips may become inconsistent if formula changes retroactively

**Expected Behavior:**
- Formula changes are versioned with effective dates
- Historical payslips reference formula version used
- Ability to query "what formula was active on date X?"
- Clear UI showing formula history

**Impact:** **CRITICAL** - Audit compliance requirement

---

### Gap 6: No Formula Preview/Testing

**Use Case:** Test new formula before applying to employees

**Current Behavior:**
- ❌ No way to preview formula results
- ❌ No sandbox/test mode
- Changes apply immediately to all calculations

**Expected Behavior:**
- Formula preview with sample employee data
- "What-if" calculator: "If base = 300,000, years = 7 → result = ?"
- Dry-run mode: "Apply this formula to see results without saving"
- Comparison view: Old formula vs. New formula for sample employees

**Impact:** **HIGH** - Risk mitigation before changes go live

---

## 📋 Use Case Catalog

### Regulatory Changes (Government-Driven)

| Use Case | Current Workaround | Ideal Solution | Priority |
|----------|-------------------|----------------|----------|
| **Seniority rate change** (2% → 2.5%) | Super admin edits DB directly, but calculator ignores it | Edit formula in UI, effective from date X | **P0** |
| **Family allowance rate change** (4,200 → 5,000 FCFA) | Hardcoded in calculator, requires code change | Edit formula in UI | **P0** |
| **Transport exemption cap change** (30k → 35k) | Edit `salary_component_definitions.metadata` | Edit exemption cap in UI | **P1** |
| **CNPS inclusion rule change** | Edit metadata `includeInCnpsBase` | Toggle checkbox in UI | **P1** |

---

### Company Policy Changes (Tenant-Driven)

| Use Case | Current Workaround | Ideal Solution | Priority |
|----------|-------------------|----------------|----------|
| **Custom seniority cap** (max 20% not 25%) | Create custom component, duplicate logic | Override standard formula | **P1** |
| **Performance bonus formula** (10% of base) | Create custom component with fixed amount, recalculate manually | Create formula-based custom component | **P1** |
| **Overtime pay** (1.5× hourly rate) | Calculate outside system, add as fixed amount | Auto-calculated formula | **P2** |
| **Commission** (3% of sales) | Manual entry each month | Formula with external data source | **P2** |

---

### Individual Exceptions (Employee-Driven)

| Use Case | Current Workaround | Ideal Solution | Priority |
|----------|-------------------|----------------|----------|
| **Special seniority rate** (3% not 2%) | Add fixed allowance manually | Override formula for employee | **P2** |
| **Higher transport allowance** (50k not 25k) | Edit fixed amount | Override amount with note | **P3** |
| **Custom performance bonus** (different % per employee) | Manual calculation | Employee-specific formula param | **P3** |

---

### Auditing & Compliance

| Use Case | Current Workaround | Ideal Solution | Priority |
|----------|-------------------|----------------|----------|
| **View formula used in Jan 2025** | Check code history on GitHub | Formula version history in DB | **P0** |
| **Prove calculation is correct** | Manually trace code logic | Formula audit log with calculations | **P0** |
| **Compare formulas across countries** | Query DB, compare JSON | Visual formula comparison UI | **P2** |

---

## 🏗️ Proposed Architecture

### Database Schema Changes

#### 1. **Add Formula Versioning Table**

```sql
CREATE TABLE salary_component_formula_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL, -- References custom_salary_components OR salary_component_definitions
  component_type TEXT NOT NULL, -- 'standard' | 'custom'
  version_number INT NOT NULL,

  -- Formula data
  calculation_rule JSONB NOT NULL, -- { type, rate, cap, baseAmount }

  -- Metadata
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL if currently active
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_version UNIQUE (component_id, component_type, version_number)
);

-- Index for querying active formula at a date
CREATE INDEX idx_formula_active_at
ON salary_component_formula_versions(component_id, component_type, effective_from, effective_to);
```

---

#### 2. **Add Tenant Formula Overrides Table**

```sql
CREATE TABLE tenant_component_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  component_code TEXT NOT NULL, -- '21' for seniority

  -- Override metadata
  override_metadata JSONB NOT NULL, -- Only the fields being overridden

  -- Effective dates
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tenant_override UNIQUE (tenant_id, component_code, effective_from)
);
```

---

#### 3. **Add Employee Formula Overrides**

```sql
-- Already exists in employee_salaries.components JSONB
-- Just need to support overrideMetadata field:

{
  "code": "21",
  "name": "Prime d'ancienneté",
  "amount": 67500, // Calculated with 3% not 2%
  "metadata": {
    "taxTreatment": { ... },
    "calculationRule": {
      "type": "auto-calculated",
      "rate": 0.03, // ← Override for this employee
      "cap": 0.25
    }
  },
  "overrideMetadata": true, // ← Flag to show this is custom
  "overrideReason": "Négociation individuelle - Senior Engineer"
}
```

---

### Code Architecture Changes

#### 1. **Formula Loader Service**

```typescript
// lib/salary-components/formula-loader.ts

/**
 * Loads the active formula for a component at a given date
 * Priority: Employee override > Tenant override > Standard definition
 */
export async function loadFormulaMetadata(input: {
  componentCode: string;
  tenantId: string;
  employeeId?: string;
  asOfDate?: Date;
}): Promise<ComponentMetadata> {
  const { componentCode, tenantId, employeeId, asOfDate = new Date() } = input;

  // 1. Check employee-specific override
  if (employeeId) {
    const employeeOverride = await getEmployeeComponentOverride(employeeId, componentCode);
    if (employeeOverride?.overrideMetadata) {
      return employeeOverride.metadata;
    }
  }

  // 2. Check tenant-specific override
  const tenantOverride = await db
    .select()
    .from(tenantComponentOverrides)
    .where(and(
      eq(tenantComponentOverrides.tenantId, tenantId),
      eq(tenantComponentOverrides.componentCode, componentCode),
      lte(tenantComponentOverrides.effectiveFrom, asOfDate),
      or(
        isNull(tenantComponentOverrides.effectiveTo),
        gte(tenantComponentOverrides.effectiveTo, asOfDate)
      )
    ))
    .limit(1);

  if (tenantOverride.length > 0) {
    return mergeMetadata(standardMetadata, tenantOverride[0].overrideMetadata);
  }

  // 3. Fall back to standard definition (with version support)
  const versionedFormula = await db
    .select()
    .from(salaryComponentFormulaVersions)
    .where(and(
      eq(salaryComponentFormulaVersions.componentCode, componentCode),
      eq(salaryComponentFormulaVersions.componentType, 'standard'),
      lte(salaryComponentFormulaVersions.effectiveFrom, asOfDate),
      or(
        isNull(salaryComponentFormulaVersions.effectiveTo),
        gte(salaryComponentFormulaVersions.effectiveTo, asOfDate)
      )
    ))
    .orderBy(desc(salaryComponentFormulaVersions.versionNumber))
    .limit(1);

  if (versionedFormula.length > 0) {
    return versionedFormula[0].calculationRule as ComponentMetadata;
  }

  // 4. Ultimate fallback: standard definition current metadata
  return getStandardComponentMetadata(componentCode);
}
```

---

#### 2. **Updated Calculator Functions**

```typescript
// lib/salary-components/component-calculator.ts

export async function calculateSeniorityBonus(input: {
  baseSalary: number;
  hireDate: Date;
  currentDate?: Date;
  tenantId: string;      // ← NEW: Required for formula lookup
  employeeId?: string;   // ← NEW: Optional for employee overrides
}): Promise<SeniorityCalculationResult> {
  const { baseSalary, hireDate, currentDate = new Date(), tenantId, employeeId } = input;

  // Load formula metadata (respects overrides and versions)
  const metadata = await loadFormulaMetadata({
    componentCode: '21',
    tenantId,
    employeeId,
    asOfDate: currentDate
  });

  const ratePerYear = metadata.calculationRule?.rate ?? 0.02; // Fallback only if metadata missing
  const maxRate = metadata.calculationRule?.cap ?? 0.25;

  const yearsOfService = (currentDate.getTime() - hireDate.getTime()) / millisecondsPerYear;
  const calculatedRate = yearsOfService * ratePerYear;
  const rate = Math.min(calculatedRate, maxRate);
  const amount = Math.round(baseSalary * rate);

  return {
    yearsOfService,
    rate,
    amount,
    isCapped: calculatedRate > maxRate,
    formulaVersion: metadata._version, // Track which version was used
  };
}
```

---

### UI Components

#### 1. **Formula Builder Component**

```typescript
// components/salary-components/formula-builder.tsx

export function FormulaBuilder({
  metadata,
  onChange
}: {
  metadata: ComponentMetadata;
  onChange: (metadata: ComponentMetadata) => void;
}) {
  const calculationType = metadata.calculationRule?.type || 'fixed';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Règle de calcul</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Calculation Type Selector */}
        <Select value={calculationType} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Montant fixe</SelectItem>
            <SelectItem value="percentage">Pourcentage du salaire de base</SelectItem>
            <SelectItem value="auto-calculated">Auto-calculé (formule)</SelectItem>
          </SelectContent>
        </Select>

        {/* Conditional Fields Based on Type */}
        {calculationType === 'fixed' && (
          <Input
            type="number"
            label="Montant fixe (FCFA)"
            value={metadata.calculationRule?.baseAmount || 0}
            onChange={(e) => handleFieldChange('baseAmount', parseFloat(e.target.value))}
          />
        )}

        {calculationType === 'percentage' && (
          <>
            <Input
              type="number"
              label="Pourcentage (%)"
              value={(metadata.calculationRule?.rate || 0) * 100}
              onChange={(e) => handleFieldChange('rate', parseFloat(e.target.value) / 100)}
              min={0}
              max={100}
            />
            <FormDescription>
              Exemple: 10% signifie 10,000 FCFA pour un salaire de base de 100,000 FCFA
            </FormDescription>
          </>
        )}

        {calculationType === 'auto-calculated' && (
          <>
            <Input
              type="number"
              label="Taux par année (%)"
              value={(metadata.calculationRule?.rate || 0) * 100}
              onChange={(e) => handleFieldChange('rate', parseFloat(e.target.value) / 100)}
            />
            <Input
              type="number"
              label="Plafond maximum (%)"
              value={(metadata.calculationRule?.cap || 0) * 100}
              onChange={(e) => handleFieldChange('cap', parseFloat(e.target.value) / 100)}
            />
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Cette formule sera calculée automatiquement à chaque paie.
                Exemple: Prime d'ancienneté = 2% par an, max 25%
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Formula Preview */}
        <FormulaPreview metadata={metadata} />
      </CardContent>
    </Card>
  );
}
```

---

#### 2. **Formula Preview Component**

```typescript
// components/salary-components/formula-preview.tsx

export function FormulaPreview({ metadata }: { metadata: ComponentMetadata }) {
  const [baseSalary, setBaseSalary] = useState(300000);
  const [yearsOfService, setYearsOfService] = useState(5);

  const result = useMemo(() => {
    const rule = metadata.calculationRule;
    if (!rule) return null;

    if (rule.type === 'fixed') {
      return rule.baseAmount;
    }

    if (rule.type === 'percentage') {
      return baseSalary * (rule.rate || 0);
    }

    if (rule.type === 'auto-calculated') {
      const calculatedRate = yearsOfService * (rule.rate || 0);
      const rate = Math.min(calculatedRate, rule.cap || 1);
      return baseSalary * rate;
    }

    return null;
  }, [metadata, baseSalary, yearsOfService]);

  return (
    <Card className="bg-muted">
      <CardHeader>
        <CardTitle>Aperçu du calcul</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Sample Inputs */}
        <div className="space-y-4">
          <div>
            <label>Salaire de base (FCFA)</label>
            <Input
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(parseFloat(e.target.value))}
            />
          </div>

          {metadata.calculationRule?.type === 'auto-calculated' && (
            <div>
              <label>Années de service</label>
              <Input
                type="number"
                value={yearsOfService}
                onChange={(e) => setYearsOfService(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        {/* Result */}
        <div className="mt-6 p-4 bg-white rounded-lg border-2 border-primary">
          <p className="text-sm text-muted-foreground">Résultat estimé:</p>
          <p className="text-3xl font-bold text-primary">
            {result ? formatCurrency(result) : '—'} FCFA
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

#### 3. **Formula Version History Component**

```typescript
// components/salary-components/formula-history.tsx

export function FormulaHistory({ componentCode }: { componentCode: string }) {
  const { data: versions } = useFormulaVersionHistory(componentCode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des formules</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Effective du</TableHead>
              <TableHead>Effective au</TableHead>
              <TableHead>Formule</TableHead>
              <TableHead>Modifié par</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions?.map((version) => (
              <TableRow key={version.id}>
                <TableCell>v{version.versionNumber}</TableCell>
                <TableCell>{formatDate(version.effectiveFrom)}</TableCell>
                <TableCell>{version.effectiveTo ? formatDate(version.effectiveTo) : 'En cours'}</TableCell>
                <TableCell>
                  <FormulaDisplay calculationRule={version.calculationRule} />
                </TableCell>
                <TableCell>{version.changedBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

## 🛤️ Implementation Roadmap

### Phase 1: Foundation (P0 - Week 1)

**Goal:** Fix current formula loading so DB metadata is actually used

- [ ] Update `calculateSeniorityBonus()` to accept tenantId parameter
- [ ] Load standard component metadata from DB (not just hardcoded fallbacks)
- [ ] Update `autoInjectCalculatedComponents()` to pass metadata
- [ ] Test: Change seniority rate in DB, verify it's used in calculation
- [ ] Add `formula_version` field to payroll line items for audit trail

**Deliverables:**
- Formula metadata flows from DB → Calculator → Payroll
- Fallback defaults only used if DB query fails

---

### Phase 2: Formula UI (P0 - Week 2)

**Goal:** Allow users to edit formulas via UI

- [ ] Add Formula Builder component to custom component create/edit forms
- [ ] Add Formula Preview component
- [ ] Update `updateCustomComponent` tRPC endpoint to handle formula changes
- [ ] Add Super Admin route for editing standard component formulas
- [ ] Add validation rules (rate must be > 0, cap must be >= rate)

**Deliverables:**
- Tenant Admin can create formula-based custom components
- Super Admin can edit standard component formulas
- Formula preview works with sample data

---

### Phase 3: Versioning & History (P0 - Week 3)

**Goal:** Track formula changes over time for auditing

- [ ] Create `salary_component_formula_versions` table
- [ ] Create migration to populate initial versions from current metadata
- [ ] Update formula loader to query by effective date
- [ ] Add Formula History UI component
- [ ] Update payroll calculator to record which formula version was used

**Deliverables:**
- All formula changes are versioned
- Historical payslips show which formula was active
- Audit log of "who changed what when"

---

### Phase 4: Tenant Overrides (P1 - Week 4)

**Goal:** Allow companies to customize standard component formulas

- [ ] Create `tenant_component_overrides` table
- [ ] Add "Customize Formula" button on standard components
- [ ] Update formula loader to check tenant overrides
- [ ] Add UI to show "Customized" badge on overridden components
- [ ] Add "Revert to Standard" option

**Deliverables:**
- Tenant Admin can override standard formulas
- Clear visual distinction between standard and customized
- Option to revert to standard

---

### Phase 5: Employee Overrides (P2 - Week 5)

**Goal:** Support individual employee formula exceptions

- [ ] Add `overrideMetadata` flag to employee component instances
- [ ] Add "Customize for Employee" option in employee salary view
- [ ] Update formula loader to check employee overrides first
- [ ] Add audit note field for override reason
- [ ] Show "Custom Rate" badge in employee payslip

**Deliverables:**
- HR Manager can override formula for specific employee
- Override reason captured for audit
- Employee payslips clearly show custom rates

---

### Phase 6: Testing & Dry-Run (P2 - Week 6)

**Goal:** Allow testing formulas before applying

- [ ] Add "Dry Run" mode to payroll calculator
- [ ] Add "Compare Formulas" UI (old vs. new)
- [ ] Add batch preview: "What if we change seniority to 2.5%?"
- [ ] Add rollback functionality for recent formula changes

**Deliverables:**
- Test formulas with sample data before going live
- See impact of formula changes across all employees
- Rollback if mistake detected

---

## 🎯 Success Criteria

### Functional Requirements

- [ ] Super Admin can edit standard component formulas via UI
- [ ] Tenant Admin can create formula-based custom components
- [ ] Tenant Admin can override standard component formulas
- [ ] HR Manager can override formulas for individual employees
- [ ] All formula changes are versioned with effective dates
- [ ] Historical payslips show which formula version was used
- [ ] Formula preview works with sample data

### Non-Functional Requirements

- [ ] Formula changes don't break existing payslips
- [ ] Performance: Formula loading adds < 50ms to payroll calculation
- [ ] Security: Only authorized users can edit formulas
- [ ] Audit: Complete history of "who changed what when"
- [ ] UX: Non-technical users can use formula builder

---

## 🚀 Quick Wins

### Immediate (Can Ship Today)

1. **Fix calculator fallbacks** - Make them actually read DB metadata
2. **Add formula preview** - Show calculation result with sample data
3. **Document workaround** - How to edit formulas via SQL for now

### Short-Term (This Week)

1. **Add Formula Builder to custom component form** - Enable formula creation
2. **Add Formula History view** - Show what formulas existed when
3. **Super Admin formula edit UI** - Stop requiring SQL for standard components

---

## 📚 Related Documentation

- **Formula Guide:** `/docs/SALARY-COMPONENT-FORMULAS.md`
- **User Guide:** `/docs/SALARY-COMPONENTS-USER-GUIDE.md`
- **EPIC 06:** `/docs/06-EPIC-EMPLOYEE-MANAGEMENT.md` (lines 1493-1730)
- **Type Definitions:** `/features/employees/types/salary-components.ts`
- **Calculator:** `/lib/salary-components/component-calculator.ts`

---

**Status:** 🔴 **CRITICAL GAPS IDENTIFIED** - Formula editing is required for regulatory compliance but not currently supported via UI.

**Next Action:** Implement Phase 1 (Foundation) to fix formula loading from DB.
