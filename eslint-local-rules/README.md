# Custom ESLint Rules for Preem HR

This directory contains custom ESLint rules that enforce security and architectural patterns specific to our multi-tenant HR system.

## Rules

### `no-tenantid-in-input` 🔒 CRITICAL SECURITY

**Purpose:** Prevents tenant data leakage by ensuring `tenantId` is never accepted as a parameter in tRPC endpoint input schemas.

**Why this matters:**
- Preem HR is a multi-tenant system where users can belong to multiple companies
- If endpoints accept `tenantId` as input, malicious users could access other tenants' data
- The secure pattern is to always use `ctx.user.tenantId` from the authenticated session context

**Violation Example:**
```typescript
// ❌ SECURITY VULNERABILITY - Don't do this!
export const badRouter = createTRPCRouter({
  getEmployees: publicProcedure
    .input(z.object({
      tenantId: z.string().uuid(), // ❌ VIOLATES RULE
    }))
    .query(async ({ input }) => {
      return await db.query.employees.findMany({
        where: eq(employees.tenantId, input.tenantId), // ❌ DATA LEAK
      });
    }),
});
```

**Correct Pattern:**
```typescript
// ✅ SECURE - Always do this!
export const goodRouter = createTRPCRouter({
  getEmployees: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'inactive']).optional(),
      // NO tenantId field - it comes from ctx
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId; // ✅ From authenticated context

      return await db.query.employees.findMany({
        where: and(
          eq(employees.tenantId, tenantId), // ✅ SECURE
          input.status ? eq(employees.status, input.status) : undefined
        ),
      });
    }),
});
```

**Exception:**
The rule automatically exempts `server/routers/tenant.ts`, which legitimately needs `tenantId` for these admin operations:
- `switchTenant` - User chooses which tenant to activate (validates access via user_tenants)
- `addUserToTenant` - Admin grants tenant access (requires super_admin/tenant_admin role)
- `removeUserFromTenant` - Admin revokes tenant access (requires super_admin/tenant_admin role)

## Running the Linter

```bash
# Check all router files for violations
npm run lint:security

# Auto-fix violations (if possible)
npm run lint:security:fix
```

## Integration

The rule is automatically run:
- ❌ (Coming soon) As a pre-commit hook via Husky
- ❌ (Coming soon) In CI/CD pipeline before deployments
- ✅ Manually via `npm run lint:security`

## Architecture Context

This rule enforces the tenant isolation pattern implemented in:
- **Context Layer:** `server/api/context.ts:111` - Automatically sets `ctx.user.tenantId` to user's active tenant
- **Router Layer:** All 47 routers (except tenant.ts) use `ctx.user.tenantId` exclusively
- **Database Layer:** All queries filter by `tenantId`

See `.claude/CLAUDE.md` section "🔒 Tenant Isolation (CRITICAL SECURITY)" for complete architecture documentation.

## Enforcement Level

This rule is configured as **ERROR** (not warning) because:
- Violations are critical security vulnerabilities
- They can lead to cross-tenant data leakage
- They violate GDPR/data privacy regulations
- There is no valid reason to accept `tenantId` as input (except in tenant.ts)

## Need Help?

If you need to:
1. **Accept tenantId for a new admin operation:** Add your endpoint to `server/routers/tenant.ts` with proper access control
2. **Report a false positive:** File an issue with the endpoint details
3. **Understand the architecture:** Read `.claude/CLAUDE.md` section "🔒 Tenant Isolation"

## Related Documentation

- `.claude/CLAUDE.md` - Development guidelines including tenant isolation rules
- `server/api/context.ts` - Context creation and tenant override implementation
- `server/routers/tenant.ts` - Example of legitimate tenantId usage with validation
