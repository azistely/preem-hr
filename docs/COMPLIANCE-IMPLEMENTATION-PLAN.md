# Compliance Implementation Plan

## 🎯 Mission

Build mandatory compliance enforcement into Preem HR to ensure:
1. **Sector-based required components** are always activated
2. **Legal parameters** (tax, CNPS) cannot be modified by users
3. **Work accident rates** use sector-specific values
4. **UI prevents** illegal configurations (not just warns)

---

## 📊 Current State Assessment

### ✅ What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Option B Architecture | ✅ Implemented | Templates + activations pattern |
| Dynamic Widget System | ✅ Implemented | Auto-selects correct widget per field |
| Read-Only Tax Fields | ✅ Implemented | Tax/CNPS shown with lock badges |
| Sector Configurations | ✅ Database exists | 6 sectors with rules for CI |
| Legal Bounds in UI | ✅ Implemented | Sliders enforce min/max |

### ❌ What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No `tenant.sector_code` field | Cannot determine sector | 🔴 Critical |
| Payroll uses country-wide accident rate | Wrong rates (2-5% difference) | 🔴 Critical |
| Required components not enforced | Users can skip mandatory components | 🔴 Critical |
| No sector selection UI | Tenants don't choose sector | 🔴 Critical |
| No compliance validation on activation | Can activate excluded components | 🟡 High |
| No subsidiary support | Multi-entity groups not supported | 🟢 Medium |

---

## 🏗️ Implementation Phases

### Phase 1: Mandatory Sector Assignment (Week 1)

**Goal:** Every tenant MUST have a sector, determines required components and rates

#### 1.1 Database Migration

```sql
-- File: supabase/migrations/20251007_add_tenant_sector.sql

-- Add sector_code field (nullable initially)
ALTER TABLE tenants
  ADD COLUMN sector_code VARCHAR(50);

-- Add foreign key
ALTER TABLE tenants
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code)
    DEFERRABLE INITIALLY DEFERRED;

-- Migrate existing data (best-effort from industry field)
UPDATE tenants
SET sector_code = CASE
  WHEN industry ILIKE '%construct%' OR industry ILIKE '%btp%' THEN 'CONSTRUCTION'
  WHEN industry ILIKE '%agri%' THEN 'AGRICULTURE'
  WHEN industry ILIKE '%mining%' OR industry ILIKE '%mine%' THEN 'MINING'
  WHEN industry ILIKE '%transport%' THEN 'TRANSPORT'
  WHEN industry ILIKE '%industr%' OR industry ILIKE '%manufactur%' THEN 'INDUSTRY'
  ELSE 'SERVICES' -- Safe default
END
WHERE country_code = 'CI' AND sector_code IS NULL;

-- Make required after migration
ALTER TABLE tenants
  ALTER COLUMN sector_code SET NOT NULL;

-- Add index
CREATE INDEX idx_tenants_sector ON tenants(country_code, sector_code);

-- Add comment
COMMENT ON COLUMN tenants.sector_code IS
  'Legal sector code (CONSTRUCTION, SERVICES, etc.) - determines required salary components, work accident rates, and sector-specific CNPS contributions. References sector_configurations table.';
```

**Testing:**
```typescript
// tests/sectors/tenant-sector.test.ts
test('New tenant requires sector_code', async () => {
  await expect(
    createTenant({ name: 'Test', country_code: 'CI' }) // Missing sector_code
  ).rejects.toThrow('sector_code is required');
});

test('Tenant sector_code must exist in sector_configurations', async () => {
  await expect(
    createTenant({ name: 'Test', country_code: 'CI', sector_code: 'INVALID' })
  ).rejects.toThrow('foreign key constraint');
});
```

#### 1.2 tRPC Endpoints

```typescript
// server/routers/sectors.ts
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { sectorConfigurations } from '@/drizzle/schema';

export const sectorsRouter = router({
  // Get available sectors for a country
  listSectorsForCountry: publicProcedure
    .input(z.object({ countryCode: z.string().length(2) }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.sectorConfigurations.findMany({
        where: eq(sectorConfigurations.countryCode, input.countryCode),
        orderBy: asc(sectorConfigurations.sectorCode),
      });
    }),

  // Get sector details with required components
  getSectorDetails: publicProcedure
    .input(z.object({ countryCode: z.string(), sectorCode: z.string() }))
    .query(async ({ input, ctx }) => {
      const config = await ctx.db.query.sectorConfigurations.findFirst({
        where: and(
          eq(sectorConfigurations.countryCode, input.countryCode),
          eq(sectorConfigurations.sectorCode, input.sectorCode)
        ),
      });

      if (!config) throw new TRPCError({ code: 'NOT_FOUND' });

      // Load component details for required components
      const requiredCodes = config.default_components.commonComponents;
      const components = await ctx.db.query.salaryComponentTemplates.findMany({
        where: inArray(salaryComponentTemplates.code, requiredCodes),
      });

      return {
        ...config,
        requiredComponents: components,
      };
    }),

  // Update tenant sector (with validation)
  updateTenantSector: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      sectorCode: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify sector exists
      const sectorExists = await ctx.db.query.sectorConfigurations.findFirst({
        where: and(
          eq(sectorConfigurations.countryCode, ctx.tenant.country_code),
          eq(sectorConfigurations.sectorCode, input.sectorCode)
        ),
      });

      if (!sectorExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Sector ${input.sectorCode} not valid for country ${ctx.tenant.country_code}`
        });
      }

      // Update tenant
      await ctx.db.update(tenants)
        .set({ sector_code: input.sectorCode, updated_at: new Date().toISOString() })
        .where(eq(tenants.id, input.tenantId));

      // Auto-activate required components
      await enforceRequiredComponents(ctx.db, input.tenantId, input.sectorCode);

      return { success: true };
    }),
});
```

#### 1.3 Sector Selection UI

**File:** `app/onboarding/sector-selection/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export default function SectorSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: tenant } = trpc.tenants.getCurrent.useQuery();
  const { data: sectors, isLoading } = trpc.sectors.listSectorsForCountry.useQuery({
    countryCode: tenant?.country_code || 'CI',
  });
  const updateSector = trpc.sectors.updateTenantSector.useMutation();

  const handleContinue = async () => {
    if (!selected || !tenant) return;

    await updateSector.mutateAsync({
      tenantId: tenant.id,
      sectorCode: selected,
    });

    router.push('/onboarding/components');
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Quel est votre secteur d'activité ?</h1>
        <p className="text-muted-foreground mt-2">
          Ceci détermine les composants de salaire obligatoires et les taux de cotisations sociales applicables à votre entreprise.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sectors?.map((sector) => (
          <Card
            key={sector.sector_code}
            className={cn(
              "cursor-pointer transition-all hover:shadow-lg",
              selected === sector.sector_code && "border-primary border-2 shadow-lg"
            )}
            onClick={() => setSelected(sector.sector_code)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{sector.sector_code}</CardTitle>
                  <CardDescription className="mt-1">
                    Taux accident du travail: <strong>{(parseFloat(sector.work_accident_rate) * 100).toFixed(1)}%</strong>
                  </CardDescription>
                </div>
                {selected === sector.sector_code && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Required Components */}
              <div>
                <p className="text-sm font-medium mb-2">Composants obligatoires:</p>
                <div className="flex flex-wrap gap-2">
                  {sector.default_components.commonComponents.map((code) => (
                    <Badge key={code} variant="destructive" className="text-xs">
                      🔒 {code}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Smart Defaults */}
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Valeurs recommandées:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Salaire base:</span>
                    <br />
                    <span className="font-medium">
                      {sector.smart_defaults.baseSalary.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Logement:</span>
                    <br />
                    <span className="font-medium">
                      {sector.smart_defaults.housingAllowance.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end mt-8">
        <Button
          size="lg"
          disabled={!selected || updateSector.isPending}
          onClick={handleContinue}
          className="min-h-[56px] px-8"
        >
          {updateSector.isPending ? 'Enregistrement...' : 'Continuer'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
```

**Deliverables:**
- ✅ Database migration applied
- ✅ All existing tenants have valid sector
- ✅ tRPC endpoints for sector management
- ✅ Sector selection UI in onboarding flow
- ✅ Tests pass

---

### Phase 2: Required Components Enforcement (Week 2)

**Goal:** System automatically activates and prevents deactivation of sector-required components

#### 2.1 Business Logic

```typescript
// lib/compliance/sector-enforcement.ts

import { db } from '@/lib/db';
import { sectorConfigurations, salaryComponentTemplates, tenantSalaryComponentActivations } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Get sector configuration with required components
 */
export async function getSectorConfig(countryCode: string, sectorCode: string) {
  const config = await db.query.sectorConfigurations.findFirst({
    where: and(
      eq(sectorConfigurations.countryCode, countryCode),
      eq(sectorConfigurations.sectorCode, sectorCode)
    ),
  });

  if (!config) {
    throw new Error(`Sector ${sectorCode} not found for country ${countryCode}`);
  }

  return config;
}

/**
 * Auto-activate required components for a sector
 */
export async function enforceRequiredComponents(
  database: typeof db,
  tenantId: string,
  sectorCode: string
) {
  // Get tenant to determine country
  const tenant = await database.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) throw new Error('Tenant not found');

  // Get sector config
  const sectorConfig = await getSectorConfig(tenant.country_code, sectorCode);
  const requiredCodes = sectorConfig.default_components.commonComponents;

  // Get template IDs for required codes
  const templates = await database.query.salaryComponentTemplates.findMany({
    where: and(
      eq(salaryComponentTemplates.countryCode, tenant.country_code),
      inArray(salaryComponentTemplates.code, requiredCodes)
    ),
  });

  // Check which are already activated
  const existingActivations = await database.query.tenantSalaryComponentActivations.findMany({
    where: eq(tenantSalaryComponentActivations.tenantId, tenantId),
  });

  const existingTemplateIds = existingActivations.map(a => a.templateId);

  // Activate missing required components
  const toActivate = templates.filter(t => !existingTemplateIds.includes(t.id));

  for (const template of toActivate) {
    await database.insert(tenantSalaryComponentActivations).values({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      template_id: template.id,
      is_active: true,
      custom_name: null,
      overrides: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return {
    activated: toActivate.length,
    required: requiredCodes,
  };
}

/**
 * Check if a component is required by sector
 */
export async function isComponentRequiredBySector(
  tenantId: string,
  componentCode: string
): Promise<boolean> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { country_code: true, sector_code: true },
  });

  if (!tenant || !tenant.sector_code) return false;

  const sectorConfig = await getSectorConfig(tenant.country_code, tenant.sector_code);
  return sectorConfig.default_components.commonComponents.includes(componentCode);
}

/**
 * Check if a component is excluded by sector
 */
export async function isComponentExcludedBySector(
  tenantId: string,
  componentCode: string
): Promise<boolean> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { country_code: true, sector_code: true },
  });

  if (!tenant || !tenant.sector_code) return false;

  const sectorConfig = await getSectorConfig(tenant.country_code, tenant.sector_code);
  return sectorConfig.default_components.excludedComponents?.includes(componentCode) || false;
}
```

#### 2.2 tRPC Validation

```typescript
// server/routers/salary-components.ts

import { isComponentRequiredBySector } from '@/lib/compliance/sector-enforcement';

// Update deactivation endpoint
deactivateComponent: protectedProcedure
  .input(z.object({ activationId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    // Get activation with template code
    const activation = await ctx.db.query.tenantSalaryComponentActivations.findFirst({
      where: eq(tenantSalaryComponentActivations.id, input.activationId),
      with: { template: { columns: { code: true } } },
    });

    if (!activation) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Check if required by sector
    const isRequired = await isComponentRequiredBySector(
      ctx.tenant.id,
      activation.template.code
    );

    if (isRequired) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot deactivate ${activation.template.code}: Required by sector ${ctx.tenant.sector_code}`,
      });
    }

    // Proceed with deactivation
    await ctx.db.update(tenantSalaryComponentActivations)
      .set({ is_active: false, updated_at: new Date().toISOString() })
      .where(eq(tenantSalaryComponentActivations.id, input.activationId));

    return { success: true };
  }),
```

#### 2.3 UI Indicators

```typescript
// app/settings/salary-components/page.tsx

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';

function ComponentListItem({ activation }) {
  const { data: tenant } = trpc.tenants.getCurrent.useQuery();
  const sectorConfig = trpc.sectors.getSectorDetails.useQuery({
    countryCode: tenant?.country_code || 'CI',
    sectorCode: tenant?.sector_code || 'SERVICES',
  });

  const isRequired = sectorConfig.data?.requiredComponents
    ?.some(c => c.code === activation.code);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span>{activation.name}</span>
        {isRequired && (
          <Badge variant="destructive" className="gap-1">
            <Lock className="h-3 w-3" />
            Requis par secteur {tenant?.sector_code}
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={isRequired} // Cannot deactivate if required
        onClick={() => handleDeactivate(activation.id)}
      >
        {isRequired ? 'Non modifiable' : 'Désactiver'}
      </Button>
    </div>
  );
}
```

**Deliverables:**
- ✅ Auto-activation of required components on sector change
- ✅ Validation prevents deactivating required components
- ✅ UI shows lock badges on required components
- ✅ Error messages reference sector name
- ✅ Tests cover all enforcement scenarios

---

### Phase 3: Sector-Specific Payroll Rates (Week 3)

**Goal:** Payroll uses correct work accident rates and contribution overrides per sector

#### 3.1 Update Payroll Calculation

```typescript
// features/payroll/services/payroll-calculation-v2.ts

import { getSectorConfig } from '@/lib/compliance/sector-enforcement';

export async function calculatePayrollV2(params: PayrollCalculationParams) {
  // ... existing code ...

  // Get employee's sector (tenant.sector_code for now, later: subsidiary → tenant fallback)
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, employee.tenant_id),
    columns: { country_code: true, sector_code: true },
  });

  if (!tenant.sector_code) {
    throw new Error(`Tenant ${tenant.id} has no sector_code assigned`);
  }

  // Load sector configuration
  const sectorConfig = await getSectorConfig(tenant.country_code, tenant.sector_code);

  // Use sector-specific work accident rate
  const workAccidentRate = parseFloat(sectorConfig.work_accident_rate);

  // Check for sector-specific contribution overrides
  const contributionOverrides = await db.query.sectorContributionOverrides.findMany({
    where: eq(sectorContributionOverrides.sectorCode, tenant.sector_code),
  });

  // Apply overrides to contribution rates
  const adjustedRates = contributionTypes.map(ct => {
    const override = contributionOverrides.find(o => o.contribution_type_id === ct.id);
    return override
      ? { ...ct, employee_rate: override.employee_rate, employer_rate: override.employer_rate }
      : ct;
  });

  // ... rest of calculation with sector-aware rates ...
}
```

#### 3.2 Tests

```typescript
// features/payroll/services/__tests__/sector-payroll.test.ts

describe('Sector-Specific Payroll', () => {
  it('uses CONSTRUCTION work accident rate (5%)', async () => {
    const tenant = await createTenant({ country_code: 'CI', sector_code: 'CONSTRUCTION' });
    const employee = await createEmployee({ tenant_id: tenant.id, base_salary: 200000 });

    const payroll = await calculatePayrollV2({ employee_id: employee.id, period: '2025-01' });

    expect(payroll.contributions.work_accident.employer_rate).toBe(0.05);
    expect(payroll.contributions.work_accident.employer_amount).toBe(10000); // 5% of 200k
  });

  it('uses SERVICES work accident rate (2%)', async () => {
    const tenant = await createTenant({ country_code: 'CI', sector_code: 'SERVICES' });
    const employee = await createEmployee({ tenant_id: tenant.id, base_salary: 200000 });

    const payroll = await calculatePayrollV2({ employee_id: employee.id, period: '2025-01' });

    expect(payroll.contributions.work_accident.employer_rate).toBe(0.02);
    expect(payroll.contributions.work_accident.employer_amount).toBe(4000); // 2% of 200k
  });

  it('applies sector contribution overrides if present', async () => {
    // Assume MINING sector has custom CNPS rates
    const tenant = await createTenant({ country_code: 'CI', sector_code: 'MINING' });
    const employee = await createEmployee({ tenant_id: tenant.id, base_salary: 300000 });

    const payroll = await calculatePayrollV2({ employee_id: employee.id, period: '2025-01' });

    // Verify sector override was applied (would differ from standard rates)
    expect(payroll.contributions.cnps_employee.rate).toBeDefined();
  });
});
```

**Deliverables:**
- ✅ `calculatePayrollV2()` loads sector from tenant
- ✅ Work accident rate uses `sectorConfig.work_accident_rate`
- ✅ Contribution overrides applied if exist
- ✅ Tests verify correct rates per sector
- ✅ Error if tenant has no sector

---

### Phase 4: Smart Defaults Integration (Week 4)

**Goal:** Pre-fill salary component values with sector-appropriate defaults

#### 4.1 Hire Wizard Integration

```typescript
// app/employees/hire/components/SalaryStep.tsx

import { trpc } from '@/lib/trpc';

function SalaryStep() {
  const { data: tenant } = trpc.tenants.getCurrent.useQuery();
  const { data: sectorConfig } = trpc.sectors.getSectorDetails.useQuery({
    countryCode: tenant?.country_code || 'CI',
    sectorCode: tenant?.sector_code || 'SERVICES',
  });

  const defaults = sectorConfig?.smart_defaults;

  const form = useForm({
    defaultValues: {
      baseSalary: defaults?.baseSalary || 150000,
      housingAllowance: defaults?.housingAllowance || 30000,
      transportAllowance: defaults?.transportAllowance || 25000,
    },
  });

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="baseSalary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Salaire de base</FormLabel>
            <FormControl>
              <Input type="number" {...field} className="min-h-[48px]" />
            </FormControl>
            <FormDescription>
              Recommandé pour le secteur {tenant?.sector_code}: {defaults?.baseSalary.toLocaleString('fr-FR')} FCFA
            </FormDescription>
          </FormItem>
        )}
      />
      {/* ... other fields with smart defaults ... */}
    </div>
  );
}
```

**Deliverables:**
- ✅ Hire wizard loads sector smart defaults
- ✅ Salary fields pre-filled with sector-appropriate values
- ✅ Description shows "Recommandé pour secteur X"
- ✅ User can override defaults (not forced)

---

## 📋 Full Implementation Checklist

### Database & Schema
- [ ] Add `tenants.sector_code VARCHAR(50) NOT NULL`
- [ ] Add foreign key to `sector_configurations`
- [ ] Migrate existing tenants (map industry → sector)
- [ ] Add index on `(country_code, sector_code)`
- [ ] Add comment documenting sector purpose

### Business Logic
- [ ] `getSectorConfig(countryCode, sectorCode)` function
- [ ] `enforceRequiredComponents(tenantId, sectorCode)` function
- [ ] `isComponentRequiredBySector(tenantId, code)` function
- [ ] `isComponentExcludedBySector(tenantId, code)` function
- [ ] Update `calculatePayrollV2()` to use sector rates

### tRPC Endpoints
- [ ] `sectors.listSectorsForCountry` - Get available sectors
- [ ] `sectors.getSectorDetails` - Get config + required components
- [ ] `sectors.updateTenantSector` - Change tenant sector (validates)
- [ ] Update `salaryComponents.deactivate` - Prevent deactivating required
- [ ] Update `salaryComponents.activate` - Warn if excluded

### UI Components
- [ ] Sector selection page (onboarding)
- [ ] Sector card component (shows rates + required components)
- [ ] Compliance badges (🔒 Required, ⚠️ Excluded)
- [ ] Disable deactivate button for required components
- [ ] Show sector info in tenant settings
- [ ] Pre-fill smart defaults in hire wizard

### Tests
- [ ] Sector enforcement tests (auto-activation)
- [ ] Deactivation validation tests (cannot remove required)
- [ ] Payroll rate tests (correct work accident rate per sector)
- [ ] Smart defaults tests (pre-filled values)
- [ ] Migration tests (all tenants have valid sector)

### Documentation
- [ ] Update API docs with sector endpoints
- [ ] Add sector selection to onboarding guide
- [ ] Document sector enforcement rules
- [ ] Add troubleshooting guide (why can't I deactivate X?)

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// Sector enforcement logic
describe('enforceRequiredComponents', () => {
  it('activates missing required components');
  it('does not duplicate existing activations');
  it('throws error if sector not found');
});

// Validation logic
describe('isComponentRequiredBySector', () => {
  it('returns true for required components');
  it('returns false for optional components');
  it('handles tenants without sector_code');
});
```

### Integration Tests

```typescript
// tRPC endpoint tests
describe('sectors.updateTenantSector', () => {
  it('updates tenant sector and auto-activates components');
  it('rejects invalid sector codes');
  it('enforces country + sector combination');
});

// Payroll tests
describe('Payroll with sectors', () => {
  it('calculates correct work accident rate per sector');
  it('applies sector contribution overrides');
  it('fails if tenant has no sector');
});
```

### E2E Tests (Playwright)

```typescript
test('Onboarding flow with sector selection', async ({ page }) => {
  // 1. Start onboarding
  await page.goto('/onboarding');

  // 2. Sector selection step
  await page.click('text=CONSTRUCTION');
  await expect(page.locator('text=Taux accident du travail: 5.0%')).toBeVisible();
  await page.click('button:has-text("Continuer")');

  // 3. Verify required components auto-activated
  await page.goto('/settings/salary-components');
  await expect(page.locator('text=HAZARD_PAY')).toBeVisible();
  await expect(page.locator('text=Requis par secteur CONSTRUCTION')).toBeVisible();

  // 4. Try to deactivate required component (should fail)
  await page.click('[data-component="HAZARD_PAY"] button:has-text("Désactiver")');
  await expect(page.locator('text=Cannot deactivate')).toBeVisible();
});
```

---

## 🚀 Deployment Strategy

### Pre-Deployment

1. **Staging Test:**
   - Deploy to staging environment
   - Run full test suite
   - Manually test sector selection UI
   - Verify payroll calculations with different sectors

2. **Data Validation:**
   - Verify `sector_configurations` table has data for all countries
   - Check that all component codes in `default_components.commonComponents` exist

3. **Rollback Plan:**
   - Keep migration script to revert sector_code to nullable
   - Document rollback steps in runbook

### Deployment

```bash
# 1. Apply migration (makes sector_code required)
npm run db:migrate

# 2. Verify migration
npm run db:studio
# Check: SELECT COUNT(*) FROM tenants WHERE sector_code IS NULL; -- Should be 0

# 3. Deploy application code
npm run build
npm run deploy

# 4. Smoke test
# - Create new tenant → Should require sector selection
# - Change tenant sector → Required components auto-activate
# - Try to deactivate required component → Should fail
```

### Post-Deployment Monitoring

```sql
-- Check sector distribution
SELECT sector_code, COUNT(*) as tenant_count
FROM tenants
GROUP BY sector_code
ORDER BY tenant_count DESC;

-- Check required component activations
SELECT t.sector_code, COUNT(DISTINCT a.id) as activations
FROM tenants t
LEFT JOIN tenant_salary_component_activations a ON a.tenant_id = t.id
WHERE a.is_active = true
GROUP BY t.sector_code;

-- Find tenants with missing required components (should be 0)
SELECT t.id, t.name, t.sector_code
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_salary_component_activations a
  WHERE a.tenant_id = t.id
    AND a.is_active = true
    -- Add required component check here
);
```

---

## 📊 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| All tenants have sector | 100% | `SELECT COUNT(*) FROM tenants WHERE sector_code IS NULL;` → 0 |
| Required components activated | 100% | Query: tenants with sector vs activations of required components |
| Payroll uses sector rates | 100% | Sample payroll calculations show sector-specific work accident rates |
| No illegal deactivations | 100% | Error logs show tRPC validation blocking deactivation attempts |
| User onboarding completion | >90% | Analytics: % who complete sector selection step |

---

## 🔮 Future Enhancements

### Phase 5: Subsidiary Support (Month 2)

- Create `subsidiaries` table
- Add `employees.subsidiary_id` (nullable, falls back to tenant)
- Sector resolution: `employee.subsidiary.sector_code || employee.tenant.sector_code`
- Multi-entity payroll exports

### Phase 6: Sector-Specific Templates (Month 3)

- Create `sector_component_templates` (sector-specific variants)
- Example: "CONSTRUCTION_HOUSING_CI" with higher bounds than "HOUSING_CI"
- Template selection: Try sector-specific first, fall back to country-wide

### Phase 7: Compliance Audit Trail (Month 4)

- Log all sector changes
- Track required component enforcement events
- Dashboard showing compliance status per tenant
- Alerts when sector rules change (new legislation)

---

## 📚 References

- `/docs/SECTORS-INDUSTRIES-MANAGEMENT.md` - Detailed sector documentation
- `/docs/SALARY-COMPONENTS-UI-WIDGETS-GUIDE.md` - Widget system architecture
- `/docs/HCI-DESIGN-PRINCIPLES.md` - UX guidelines for compliance features
- `sector_configurations` table schema
- Convention Collective Interprofessionnelle 1977

---

## ✅ Summary

**Implementation Timeline:** 4 weeks

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Sector Assignment | `tenant.sector_code` field, sector selection UI |
| 2 | Component Enforcement | Auto-activation, deactivation validation, lock badges |
| 3 | Payroll Integration | Sector-specific rates in payroll calculations |
| 4 | Smart Defaults | Pre-filled salary fields in hire wizard |

**After Phase 4:**
- ✅ Every tenant has a sector
- ✅ Required components cannot be deactivated
- ✅ Payroll uses correct sector-specific rates
- ✅ UI prevents illegal configurations
- ✅ New hires get smart defaults for their sector
- ✅ System is legally compliant with sectoral conventions

**Next Steps:**
1. Review this plan with team
2. Create GitHub issues for each phase
3. Set up staging environment for testing
4. Begin Phase 1 implementation
