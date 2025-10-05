# ⚙️ EPIC: Super Admin (Cross-Tenant Management)

## Epic Overview

**Goal:** Build a minimalist super admin interface to manage country-specific rules, tenant configuration, and system-wide settings.

**Priority:** P1 (After MVP core features)

**Access:** Super admins only (cross-tenant access)

**Key Responsibilities:**
- Configure country payroll rules (CNPS rates, ITS brackets, SMIG)
- Manage tenants (create, suspend, archive)
- View system metrics and health
- Update feature flags per tenant
- Audit trail monitoring

---

## Features & User Stories

### FEATURE 1: Country Rules Management

#### Story 1.1: Configure Country Payroll Rules
**As a** super admin
**I want** to configure country-specific payroll rules
**So that** new countries can be added without code changes

**Acceptance Criteria:**
- [ ] CRUD operations on `countries` table
- [ ] Configure CNPS rates (pension, maternity, family, work accident)
- [ ] Configure ITS tax brackets (progressive)
- [ ] Set SMIG (minimum wage)
- [ ] Set legal work hours (40h standard, 48h agriculture)
- [ ] Configure overtime multipliers
- [ ] Define public holidays
- [ ] Effective-dated changes
- [ ] Validation prevents breaking changes

**Test Cases:**
```typescript
describe('Country Rules Management', () => {
  let superAdminCaller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    superAdminCaller = createCaller({ role: 'super_admin' });
  });

  it('should update CNPS rates for Côte d\'Ivoire', async () => {
    const updated = await superAdminCaller.superAdmin.updateCountryRules({
      countryCode: 'CI',
      contributionRates: {
        pension: {
          employee: 0.063,
          employer: 0.077,
          ceiling: 3375000,
        },
        maternity: {
          employee: 0,
          employer: 0.0075,
          ceiling: 70000,
        },
      },
      effectiveFrom: new Date('2025-01-01'),
    });

    expect(updated.contribution_rates.pension.employee).toBe(0.063);
  });

  it('should update ITS tax brackets', async () => {
    const updated = await superAdminCaller.superAdmin.updateTaxBrackets({
      countryCode: 'CI',
      brackets: [
        { min: 0, max: 300000, rate: 0 },
        { min: 300000, max: 547000, rate: 0.10 },
        // ... rest of brackets
      ],
      effectiveFrom: new Date('2025-01-01'),
    });

    expect(updated.tax_brackets).toHaveLength(8);
  });

  it('should update SMIG (minimum wage)', async () => {
    const updated = await superAdminCaller.superAdmin.updatePayrollRules({
      countryCode: 'CI',
      smig: 80000, // Increase from 75000
      effectiveFrom: new Date('2025-07-01'), // Future-dated
    });

    expect(updated.payroll_rules.smig).toBe(80000);
  });

  it('should prevent regular users from modifying country rules', async () => {
    const regularCaller = createCaller({ role: 'tenant_admin' });

    await expect(
      regularCaller.superAdmin.updateCountryRules({
        countryCode: 'CI',
        contributionRates: { /* ... */ },
      })
    ).rejects.toThrow('Accès refusé');
  });
});
```

**API:**
```typescript
// src/features/super-admin/api/super-admin.router.ts

export const superAdminRouter = router({
  /**
   * List all countries
   * @access SuperAdmin only
   */
  listCountries: superAdminProcedure
    .query(async () => {
      return await db.query.countries.findMany();
    }),

  /**
   * Update country rules (effective-dated)
   * @access SuperAdmin only
   */
  updateCountryRules: superAdminProcedure
    .input(z.object({
      countryCode: z.string().length(2),
      payrollRules: z.object({
        smig: z.number().min(0).optional(),
        legalHoursWeek: z.number().optional(),
        legalHoursWeekAgriculture: z.number().optional(),
        overtimeMultipliers: z.record(z.number()).optional(),
      }).optional(),
      contributionRates: z.object({
        pension: z.object({
          employee: z.number(),
          employer: z.number(),
          ceiling: z.number(),
        }).optional(),
        maternity: z.object({
          employee: z.number(),
          employer: z.number(),
          ceiling: z.number(),
        }).optional(),
        // ... other contributions
      }).optional(),
      effectiveFrom: z.date(),
    }))
    .mutation(async ({ input }) => {
      // Update country rules with effective dating
    }),

  /**
   * Update tax brackets
   * @access SuperAdmin only
   */
  updateTaxBrackets: superAdminProcedure
    .input(z.object({
      countryCode: z.string().length(2),
      brackets: z.array(z.object({
        min: z.number().min(0),
        max: z.number().nullable(), // null = infinity
        rate: z.number().min(0).max(1),
      })),
      effectiveFrom: z.date(),
    }))
    .mutation(async ({ input }) => {
      // Validate brackets don't overlap
      // Update with effective dating
    }),

  /**
   * Add public holiday
   * @access SuperAdmin only
   */
  addPublicHoliday: superAdminProcedure
    .input(z.object({
      countryCode: z.string().length(2),
      name: z.string(),
      date: z.date(),
      recurring: z.boolean().default(true), // Repeats yearly
    }))
    .mutation(async ({ input }) => {
      // Add to country.public_holidays JSONB array
    }),
});
```

---

### FEATURE 2: Tenant Management

#### Story 2.1: List & Search Tenants
**As a** super admin
**I want** to view all tenants in the system
**So that** I can manage subscriptions and support

**Acceptance Criteria:**
- [ ] List all tenants with pagination
- [ ] Search by name, slug, email
- [ ] Filter by plan (trial, starter, professional)
- [ ] Filter by status (active, suspended, archived)
- [ ] Filter by country
- [ ] Show key metrics (employee count, last login, MRR)
- [ ] Sort by created date, employee count, MRR

**Test Cases:**
```typescript
describe('Tenant Management', () => {
  it('should list all tenants across all countries', async () => {
    // Create tenants in different countries
    await createTestTenant({ countryCode: 'CI', name: 'Boutique CI' });
    await createTestTenant({ countryCode: 'SN', name: 'Boutique SN' });

    const result = await superAdminCaller.superAdmin.listTenants({
      limit: 50,
    });

    expect(result.tenants).toHaveLength(2);
  });

  it('should filter by plan', async () => {
    await createTestTenant({ plan: 'trial' });
    await createTestTenant({ plan: 'professional' });

    const result = await superAdminCaller.superAdmin.listTenants({
      plan: 'trial',
    });

    expect(result.tenants).toHaveLength(1);
    expect(result.tenants[0].plan).toBe('trial');
  });

  it('should show metrics per tenant', async () => {
    const tenant = await createTestTenant();
    await createTestEmployee({ tenantId: tenant.id });
    await createTestEmployee({ tenantId: tenant.id });

    const result = await superAdminCaller.superAdmin.getTenantMetrics(tenant.id);

    expect(result.employeeCount).toBe(2);
    expect(result.payrollRunsThisYear).toBeDefined();
    expect(result.storageUsedMB).toBeDefined();
  });
});
```

#### Story 2.2: Suspend/Archive Tenant
**As a** super admin
**I want** to suspend or archive tenants
**So that** non-paying or policy-violating tenants are blocked

**Acceptance Criteria:**
- [ ] Suspend tenant (status = 'suspended')
- [ ] Archive tenant (status = 'archived')
- [ ] Suspended tenants cannot login
- [ ] Archived tenants read-only
- [ ] Store suspension reason
- [ ] Send notification email
- [ ] Allow reactivation

**Test Cases:**
```typescript
describe('Tenant Suspension', () => {
  it('should suspend tenant and block login', async () => {
    const tenant = await createTestTenant({ status: 'active' });

    await superAdminCaller.superAdmin.suspendTenant({
      tenantId: tenant.id,
      reason: 'Non-paiement',
    });

    const updated = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    });

    expect(updated!.status).toBe('suspended');

    // Try to login as user from suspended tenant
    await expect(
      login(tenant.adminUser.email, 'password')
    ).rejects.toThrow('Compte suspendu');
  });

  it('should allow reactivation', async () => {
    const tenant = await createTestTenant({ status: 'suspended' });

    await superAdminCaller.superAdmin.reactivateTenant({
      tenantId: tenant.id,
    });

    const updated = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    });

    expect(updated!.status).toBe('active');

    // Can login again
    const session = await login(tenant.adminUser.email, 'password');
    expect(session).toBeDefined();
  });
});
```

---

### FEATURE 3: Feature Flags & Module Management

#### Story 3.1: Enable/Disable Modules per Tenant
**As a** super admin
**I want** to enable or disable modules for specific tenants
**So that** we can offer tiered pricing

**Acceptance Criteria:**
- [ ] Modules: payroll, time_tracking, workflows, reporting, api_access
- [ ] Update tenant.features JSONB array
- [ ] Frontend hides disabled modules
- [ ] API blocks access to disabled modules
- [ ] Show module usage metrics

**Test Cases:**
```typescript
describe('Feature Flags', () => {
  it('should enable module for tenant', async () => {
    const tenant = await createTestTenant({
      plan: 'starter',
      features: ['payroll', 'employees'],
    });

    await superAdminCaller.superAdmin.updateFeatures({
      tenantId: tenant.id,
      features: ['payroll', 'employees', 'time_tracking'], // Add time_tracking
    });

    const updated = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    });

    expect(updated!.features).toContain('time_tracking');
  });

  it('should block API access when module disabled', async () => {
    const tenant = await createTestTenant({
      features: ['payroll'], // No time_tracking
    });

    const caller = createCaller({ tenantId: tenant.id });

    await expect(
      caller.timeTracking.clockIn({ /* ... */ })
    ).rejects.toThrow('Module "time_tracking" non activé');
  });

  it('should hide disabled modules in frontend', async () => {
    const tenant = await createTestTenant({
      features: ['payroll'],
    });

    const config = await caller.tenants.getConfig();

    expect(config.enabledModules).toEqual(['payroll']);
    expect(config.enabledModules).not.toContain('time_tracking');
  });
});
```

---

### FEATURE 4: System Monitoring & Metrics

#### Story 4.1: View System-Wide Metrics
**As a** super admin
**I want** to see system health and usage metrics
**So that** I can monitor performance and growth

**Acceptance Criteria:**
- [ ] Total tenants (active, trial, suspended)
- [ ] Total employees across all tenants
- [ ] Payroll runs this month
- [ ] API request volume
- [ ] Error rate (last 24h)
- [ ] Database size
- [ ] Storage used
- [ ] MRR (Monthly Recurring Revenue)

**Test Cases:**
```typescript
describe('System Metrics', () => {
  it('should calculate system-wide metrics', async () => {
    // Create test data
    await createTestTenant({ plan: 'professional' }); // 2 tenants
    await createTestTenant({ plan: 'starter' });

    const metrics = await superAdminCaller.superAdmin.getSystemMetrics();

    expect(metrics.totalTenants).toBe(2);
    expect(metrics.activeTenants).toBe(2);
    expect(metrics.totalEmployees).toBeGreaterThan(0);
  });

  it('should calculate MRR', async () => {
    await createTestTenant({ plan: 'professional' }); // 10,000 FCFA/month
    await createTestTenant({ plan: 'starter' }); // 5,000 FCFA/month

    const metrics = await superAdminCaller.superAdmin.getSystemMetrics();

    expect(metrics.mrr).toBe(15000); // 10k + 5k
  });
});
```

**Dashboard UI:**
```tsx
// app/(super-admin)/metrics/page.tsx

export default async function SuperAdminMetrics() {
  const metrics = await api.superAdmin.getSystemMetrics.query();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">System Metrics</h1>

      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Tenants"
          value={metrics.totalTenants}
          subtitle={`${metrics.activeTenants} active`}
          icon="🏢"
        />

        <MetricCard
          title="Total Employees"
          value={metrics.totalEmployees}
          subtitle="Across all tenants"
          icon="👥"
        />

        <MetricCard
          title="Payroll Runs (MTD)"
          value={metrics.payrollRunsThisMonth}
          subtitle={`${metrics.totalPaidThisMonth} FCFA paid`}
          icon="💰"
        />

        <MetricCard
          title="MRR"
          value={formatCurrency(metrics.mrr)}
          subtitle="Monthly Recurring Revenue"
          icon="📈"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">System Health</h2>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <HealthIndicator
              label="API Response Time"
              value={`${metrics.avgApiResponseTimeMs}ms`}
              status={metrics.avgApiResponseTimeMs < 500 ? 'good' : 'warning'}
            />

            <HealthIndicator
              label="Error Rate (24h)"
              value={`${metrics.errorRate24h}%`}
              status={metrics.errorRate24h < 1 ? 'good' : 'critical'}
            />

            <HealthIndicator
              label="Database Size"
              value={`${metrics.databaseSizeGB} GB`}
              status={metrics.databaseSizeGB < 50 ? 'good' : 'warning'}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### FEATURE 5: Audit Trail Monitoring

#### Story 5.1: View Cross-Tenant Audit Logs
**As a** super admin
**I want** to view audit logs across all tenants
**So that** I can investigate issues and compliance

**Acceptance Criteria:**
- [ ] View audit logs across all tenants
- [ ] Filter by tenant, user, entity type, action
- [ ] Search by entity ID
- [ ] Date range filter
- [ ] Show old/new values
- [ ] Export to CSV

**Test Cases:**
```typescript
describe('Audit Trail', () => {
  it('should view audit logs across tenants', async () => {
    const tenant1 = await createTestTenant();
    const tenant2 = await createTestTenant();

    // Create audit logs
    await createEmployee(tenant1.id, { /* ... */ }); // Logs in tenant1
    await createEmployee(tenant2.id, { /* ... */ }); // Logs in tenant2

    const logs = await superAdminCaller.superAdmin.getAuditLogs({
      limit: 100,
    });

    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some(log => log.tenant_id === tenant1.id)).toBe(true);
    expect(logs.some(log => log.tenant_id === tenant2.id)).toBe(true);
  });

  it('should filter by entity type', async () => {
    await createEmployee(tenant.id);
    await createPayrollRun(tenant.id);

    const logs = await superAdminCaller.superAdmin.getAuditLogs({
      entityType: 'employee',
    });

    expect(logs.every(log => log.entity_type === 'employee')).toBe(true);
  });
});
```

---

## Implementation Phases

### Phase 1: Country Rules (Week 1)
- [ ] Story 1.1: Configure country rules
- [ ] CRUD for CNPS rates, ITS brackets, SMIG
- [ ] Validation and effective dating
- [ ] UI for country management

**Deliverable:** Can configure Côte d'Ivoire rules via super admin

### Phase 2: Tenant Management (Week 2)
- [ ] Story 2.1: List/search tenants
- [ ] Story 2.2: Suspend/archive
- [ ] Story 3.1: Feature flags
- [ ] Tenant metrics dashboard

**Deliverable:** Full tenant management interface

### Phase 3: Monitoring (Week 3)
- [ ] Story 4.1: System metrics
- [ ] Story 5.1: Audit trail viewer
- [ ] Health monitoring
- [ ] Alerting (optional)

**Deliverable:** System monitoring dashboard

---

## Security Checklist

- [ ] Super admin role enforced in middleware
- [ ] All mutations logged to audit trail
- [ ] Cannot delete country rules (only mark inactive)
- [ ] Tenant suspension sends notification
- [ ] Feature flag changes logged
- [ ] Sensitive data masked in logs (PII)
- [ ] Rate limiting on super admin endpoints

---

## Acceptance Testing Checklist

Before marking this epic complete:

- [ ] Can configure all Côte d'Ivoire rules
- [ ] Can add new country (Senegal) via UI
- [ ] Can suspend/reactivate tenants
- [ ] Suspended tenants blocked from login
- [ ] Feature flags work (enable/disable modules)
- [ ] System metrics dashboard accurate
- [ ] Audit trail shows cross-tenant activity
- [ ] Super admin access properly restricted

---

**Next:** Implementation can begin using these docs as reference!
