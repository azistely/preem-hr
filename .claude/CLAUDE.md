# Claude Code Instructions for Preem HR

> This file contains project-specific instructions that Claude Code will automatically read at the start of every session.

## 🎯 Project Mission

Build an enterprise HR/payroll system for French-speaking West Africa that is:
- **Simple enough** for users with low digital literacy and zero HR knowledge
- **Powerful enough** to handle complex multi-country payroll regulations
- **Modern and elegant** in design and user experience

## 📚 Required Reading (ALWAYS)

Before implementing ANY feature, you MUST read:

1. **`docs/01-CONSTRAINTS-AND-RULES.md`** - Hard constraints that can NEVER be violated
2. **`docs/HCI-DESIGN-PRINCIPLES.md`** - UX principles for low digital literacy + **Multi-Country UX Patterns**
3. **`docs/TYPESCRIPT-BEST-PRACTICES.md`** - TypeScript guidelines to avoid common errors
4. Relevant EPIC document (e.g., `docs/05-EPIC-PAYROLL.md`)
5. **`docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md`** - Multi-country architecture (if working on payroll/config)

## 🎨 UI/UX Non-Negotiables

### Core Philosophy
> "If a user needs documentation to use a feature, we failed."

Every UI feature MUST pass this checklist:
- [ ] Can a user with **no HR knowledge** complete this task?
- [ ] Can it be done on a **slow 3G connection**?
- [ ] Are there **fewer than 3 steps** to complete the primary action?
- [ ] Is the primary action **obvious within 3 seconds**?
- [ ] Can it be used **with one hand** on a 5" phone screen?
- [ ] Does it work **without any help text** or documentation?

### HCI Principles (MANDATORY)

1. **Zero Learning Curve** - Instant understanding, no training required
2. **Task-Oriented Design** - Design around user goals ("Pay my employees"), not system operations
3. **Error Prevention** - Make it impossible to make mistakes (disable invalid actions)
4. **Cognitive Load Minimization** - Show only what's needed for the current step
5. **Immediate Feedback** - Every action gets instant, clear visual confirmation
6. **Graceful Degradation** - Works perfectly on slow networks and old devices

### Design Patterns to Always Use

#### ✅ Wizards for Complex Tasks
```tsx
// Break complex tasks into 3-5 simple steps
<Wizard>
  <WizardStep title="Quelle période?" icon={Calendar}>
    <MonthPicker />
  </WizardStep>
  <WizardStep title="Vérifiez les employés" icon={Users}>
    <EmployeeList />
  </WizardStep>
  <WizardStep title="Confirmation" icon={Check}>
    <ReviewSummary />
  </WizardStep>
</Wizard>
```

#### ✅ Progressive Disclosure
```tsx
// Show essential info, hide complexity behind "Voir les détails"
<Card>
  <div className="text-3xl font-bold">{netSalary} FCFA</div>
  <Collapsible>
    <CollapsibleTrigger>Voir les détails</CollapsibleTrigger>
    <CollapsibleContent>
      <DetailedBreakdown />
    </CollapsibleContent>
  </Collapsible>
</Card>
```

#### ✅ Smart Defaults
```tsx
// Pre-fill with 95% probable value
<DatePicker
  defaultValue={getNextPaymentDate()} // Auto-calculated
  helperText="Habituellement le 5 du mois suivant"
/>
```

### Design Patterns to NEVER Use

#### ❌ Information Overload
```tsx
// DON'T show everything at once
<div>
  <p>Gross Salary: {gross}</p>
  <p>CNPS Employee: {cnpsEmp}</p>
  <p>CNPS Employer: {cnpsEr}</p>
  <p>Taxable Income: {taxable}</p>
  <p>ITS Bracket 1: {br1}</p>
  {/* ... 20 more lines */}
</div>
```

#### ❌ Technical Jargon
```tsx
// DON'T expose system internals
<label>Tax System ID:</label>
<input name="taxSystemId" />

// DO use business language
<label>Pays:</label>
<select>
  <option value="CI">🇨🇮 Côte d'Ivoire</option>
</select>
```

## 🔧 Technical Requirements

### TypeScript (MANDATORY)
- **ALWAYS run `npm run type-check` before committing**
- **Read `docs/TYPESCRIPT-BEST-PRACTICES.md` before writing code**
- **Never use `as any`** - Fix types properly or ask for help
- **Use manual joins** for Drizzle ORM (not `with:` relations) - see docs
- **Handle optionals** - Always use `??`, `?.`, or explicit checks
- **Derive types from schema** - Use `$inferSelect`, `$inferInsert`

### UI Library: shadcn/ui (Radix UI + Tailwind)
- **Buttons:** min-h-[44px] for touch targets
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React (always with text, never icon-only)
- **Language:** 100% French (no English in UI)

### Spacing & Typography
```tsx
// Touch targets
Button: min-h-[44px] min-w-[44px]
Input: min-h-[48px]
Primary CTA: min-h-[56px]

// Text sizes
Primary: text-3xl font-bold (outcomes)
Secondary: text-lg (actions, labels)
Tertiary: text-sm text-muted-foreground (hints)

// Spacing
gap-4  // Default between fields
gap-6  // Between sections
gap-8  // Between major page sections
```

### Colors (Semantic)
- `primary` - Main actions, key results
- `success` - Completed, approved, paid
- `destructive` - Errors, warnings, delete
- `muted` - Secondary info, disabled states

## 🌍 Multi-Country Design Requirements

**Context:** Preem HR supports multiple West African countries (CI, SN, BF, etc.) with different tax/social security rules.

**Key Patterns (see `HCI-DESIGN-PRINCIPLES.md` for details):**

1. **Country-Aware Smart Defaults** - Detect country from tenant, auto-configure everything
2. **Country-Specific Labels** - Use CNPS for CI, IPRES for SN, IRPP for SN tax (not generic "social security")
3. **Family Deductions** - Load from database, show friendly labels ("Marié + 2 enfants" not "3.0")
4. **Sector Rates** - Auto-detect, hide in advanced view (don't force user to select work accident rates)
5. **Multi-Country Comparison** - Visual cards with flags for super admin, not raw tables

**Implementation Rules:**
- Country code flows from tenant → payroll calculations (never ask user to select repeatedly)
- All country-specific config loads from database (tax_systems, social_security_schemes tables)
- Error messages reference country-specific rules ("inférieur au SMIG de Côte d'Ivoire (75,000 FCFA)")
- Use database-driven `calculatePayrollV2()` for all payroll (supports countryCode param)

## 🔒 Tenant Isolation (CRITICAL SECURITY)

**Context:** Preem HR is a multi-tenant system where users can belong to multiple companies and switch between them.

**Architecture:**
- User's `active_tenant_id` determines which tenant data they see
- Backend context automatically sets `ctx.user.tenantId` to the active tenant
- This pattern protects ALL 391+ usage points automatically

### Mandatory Rules for tRPC Endpoints

**✅ ALWAYS DO THIS:**
```typescript
// Correct Pattern - Tenant from authenticated context
someEndpoint: protectedProcedure
  .input(z.object({
    // NO tenantId field - it comes from ctx
    employeeId: z.string().uuid(),
  }))
  .query(async ({ ctx, input }) => {
    const tenantId = ctx.user.tenantId; // ✅ From authenticated context

    // Query MUST filter by tenantId
    const data = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, tenantId) // ✅ CRITICAL: Always filter
      ),
    });

    return data;
  })
```

**❌ NEVER DO THIS:**
```typescript
// VULNERABLE - Frontend can pass ANY tenantId
badEndpoint: publicProcedure
  .input(z.object({
    tenantId: z.string().uuid(), // ❌ SECURITY HOLE
    employeeId: z.string().uuid(),
  }))
  .query(async ({ input }) => {
    // ❌ Using user-provided tenantId = DATA LEAK
    return await db.query.employees.findFirst({
      where: and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId), // ❌ VULNERABLE
      ),
    });
  })
```

### Implementation Checklist (tRPC Endpoints)

When creating ANY tRPC endpoint that accesses tenant data:

1. [ ] **Use `protectedProcedure`** (never `publicProcedure` for tenant data)
2. [ ] **NO `tenantId` in input schema** (except `tenant.ts` admin operations)
3. [ ] **Get tenantId from context:** `const tenantId = ctx.user.tenantId`
4. [ ] **Filter ALL queries by tenantId** (employees, payroll, etc.)
5. [ ] **Test with multiple tenants** to verify no data leakage

### Exception: Admin Operations

**Only `server/routers/tenant.ts` may accept `tenantId` in input:**
- `switchTenant` - User chooses which tenant to activate
- `addUserToTenant` - Admin grants tenant access
- `removeUserFromTenant` - Admin revokes tenant access

These endpoints MUST validate:
- User has access to the tenant (via `user_tenants` table)
- User has required role (super_admin/tenant_admin)

### Frontend Best Practices

**✅ DO:**
```typescript
// Let backend determine tenantId from session
const { data: employees } = api.employees.list.useQuery({
  status: 'active',
  // NO tenantId parameter
});
```

**❌ DON'T:**
```typescript
// Don't pass tenantId from frontend
const { data: user } = api.auth.me.useQuery();
const { data: employees } = api.employees.list.useQuery({
  tenantId: user?.tenantId, // ❌ Could be stale/cached
  status: 'active',
});
```

## 🚫 Common Mistakes to Avoid

1. **Don't assume users understand HR terms** - Explain or hide complexity
2. **Don't use small touch targets** - Always min 44×44px
3. **Don't show all fields at once** - Use wizards and progressive disclosure
4. **Don't use English** - Everything in French (business language)
5. **Don't forget mobile** - Design for 5" screens first
6. **Don't skip loading states** - Show feedback for operations > 300ms
7. **Don't hardcode country rules** - Use database config (tax_systems, social_security_schemes)
8. **Don't make users select country repeatedly** - Use tenant.countryCode context
9. **🔒 NEVER accept tenantId in tRPC input schemas** - Use `ctx.user.tenantId` (CRITICAL SECURITY)

## 📋 Implementation Checklist

When implementing a new UI feature:

1. [ ] Read `docs/HCI-DESIGN-PRINCIPLES.md` (includes Multi-Country UX Patterns)
2. [ ] Design with wizard/progressive disclosure pattern
3. [ ] All text in French (use `lib/i18n/fr.ts`)
4. [ ] Touch targets ≥ 44×44px
5. [ ] Smart defaults implemented
6. [ ] Loading states added
7. [ ] Error prevention (not just handling)
8. [ ] Test on mobile viewport (375×667)
9. [ ] Verify with HCI checklist above

**For Multi-Country Features:**
1. [ ] Country detected from tenant context (tenant.countryCode)
2. [ ] Country-specific labels used (CNPS/IPRES, ITS/IRPP)
3. [ ] Database config loaded via RuleLoader/tRPC endpoints
4. [ ] Family deductions loaded from family_deduction_rules table
5. [ ] Sector rates auto-detected from employee.sector field
6. [ ] Use `calculatePayrollV2()` with countryCode parameter

**For tRPC Endpoints (SECURITY CRITICAL):**
1. [ ] Uses `protectedProcedure` (never `publicProcedure` for tenant data)
2. [ ] NO `tenantId` in input schema (use `ctx.user.tenantId` instead)
3. [ ] All database queries filter by `tenantId`
4. [ ] Tested with multiple tenants to verify no data leakage
5. [ ] ESLint passes (no-tenantid-in-input rule enforced)

## 🎯 Success Metrics

Every feature should optimize for:
- **Task completion rate** > 90% (without help)
- **Time to complete** < 3 minutes (for payroll run)
- **Error rate** < 5%
- **Help requests** < 10% of tasks

---

**Remember:** The goal is not to build a feature-complete system. The goal is to build a system that **anyone can use effortlessly**, even with zero training.
