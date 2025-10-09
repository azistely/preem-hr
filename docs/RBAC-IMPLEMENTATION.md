# Role-Based Access Control (RBAC) Implementation

## Overview

This document describes the RBAC implementation for Preem HR, including route protection, role definitions, and access control patterns.

## Role Definitions

Based on `docs/02-ARCHITECTURE-OVERVIEW.md` Section 8.2 and database schema:

### 1. Employee (`employee`)
**Base role** - Access to personal data and self-service features.

**Permissions:**
- View own payslips
- View own profile
- Edit own profile
- Request time-off (future feature)
- Clock in/out (future feature)

**Cannot:**
- View other employees' data
- Access payroll runs
- Manage positions or salaries
- Access admin settings

### 2. Manager (`manager`)
**Team management** - Supervise direct reports, approve time-off.

**Permissions:**
- All employee permissions PLUS:
- View team members
- View team time tracking
- Approve time-off requests
- View overtime reports
- View team attendance (future feature)

**Cannot:**
- Run payroll
- Manage positions or salaries
- Add/remove employees
- Access admin settings

### 3. HR Manager (`hr_manager`)
**HR operations** - Manage employees, view payroll, configure policies.

**Permissions:**
- All manager permissions PLUS:
- Manage all employees (CRUD)
- View all payroll runs
- Run payroll calculations
- Manage positions and org structure
- Manage salary bands
- Configure time-off policies
- Configure overtime policies
- Manage public holidays
- Import/export employees
- Configure geofencing

**Cannot:**
- Manage users (user accounts)
- Change company settings
- Manage billing
- Access audit logs
- Configure integrations

### 4. Tenant Admin (`tenant_admin`)
**Full tenant management** - Everything within their tenant.

**Permissions:**
- All hr_manager permissions PLUS:
- Manage user accounts
- Manage roles & permissions
- Configure company settings
- Manage billing & subscription
- View audit logs
- Configure security settings
- Manage integrations

**Cannot:**
- Access other tenants
- Manage country-level rules (tax brackets, social security)

### 5. Super Admin (`super_admin`)
**Platform management** - Cross-tenant access, manage country rules.

**Permissions:**
- All tenant_admin permissions PLUS:
- Access all tenants
- Manage country rules (tax systems, social security schemes)
- Manage tenant settings across all tenants
- View cross-tenant analytics

## Route-to-Role Access Matrix

### Employee Routes
| Route | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-------|----------|---------|------------|--------------|-------------|
| `/employee/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/employee/payslips` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/employee/profile` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/employee/profile/edit` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Manager Routes
| Route | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-------|----------|---------|------------|--------------|-------------|
| `/manager/dashboard` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/manager/team` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/manager/time-tracking` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/manager/time-off/approvals` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/manager/reports/overtime` | ❌ | ✅ | ✅ | ✅ | ✅ |

### HR Manager Routes
| Route | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-------|----------|---------|------------|--------------|-------------|
| `/admin/dashboard` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/policies/time-off` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/policies/time-off/[id]` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/policies/time-off/new` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/policies/overtime` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/policies/accrual` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/time-tracking` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/time-off` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/public-holidays` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/geofencing` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin/employees/import-export` | ❌ | ❌ | ✅ | ✅ | ✅ |

### Tenant Admin Routes
| Route | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-------|----------|---------|------------|--------------|-------------|
| `/admin/settings/dashboard` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/users` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/roles` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/company` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/billing` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/costs` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/security` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/settings/integrations` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/admin/audit-log` | ❌ | ❌ | ❌ | ✅ | ✅ |

### Shared Routes (All HR+ roles)
| Route | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-------|----------|---------|------------|--------------|-------------|
| `/employees` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/employees/new` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/employees/[id]` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/payroll/runs` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/payroll/runs/new` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/payroll/runs/[id]` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/payroll/calculator` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/payroll/dashboard` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/positions` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/positions/new` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/positions/org-chart` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/salaries` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/salaries/bulk-adjustment` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/salaries/bands` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/time-tracking` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/time-off` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/terminations` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/settings/salary-components` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/settings/sectors` | ❌ | ❌ | ✅ | ✅ | ✅ |

## Implementation Details

### 1. Middleware (`/middleware.ts`)

The middleware implements route protection at the edge (before page loads):

**Key Features:**
- Extracts user role from Supabase JWT
- Checks route access against `ROUTE_ACCESS` configuration
- Redirects unauthorized users to their default dashboard
- Allows public routes (login, signup, landing page)
- Preserves authentication flow

**Flow:**
```
1. User requests /admin/dashboard
2. Middleware checks Supabase session
3. If no session → redirect to /login?redirect=/admin/dashboard
4. If session exists → extract role from JWT
5. Check if role has access to /admin/dashboard
6. If yes → allow request
7. If no → redirect to default path for role (with error param)
```

### 2. Navigation (`/lib/navigation/index.ts`)

Role-based navigation menus:

**Employee Navigation:**
- Dashboard
- Payslips
- Profile

**Manager Navigation:**
- Dashboard
- Team members
- Time tracking
- Time-off approvals
- Overtime reports

**HR Manager Navigation:**
- Admin dashboard
- Payroll (runs, calculator, dashboard)
- Employees (list, new, import/export, positions, salaries)
- Time tracking
- Time-off policies
- Public holidays
- Geofencing
- Settings

**Tenant Admin Navigation:**
- All HR Manager items PLUS:
- Admin settings dashboard
- User management
- Roles & permissions
- Company settings
- Billing & costs
- Security settings
- Audit logs
- Integrations

### 3. tRPC Procedures (`/server/api/trpc.ts`)

API-level authorization using middleware:

```typescript
// All authenticated users
protectedProcedure

// Employee or higher
employeeProcedure

// Manager or higher
managerProcedure

// HR Manager or higher
hrManagerProcedure

// Tenant Admin or higher
adminProcedure

// Super Admin only
superAdminProcedure
```

**Example usage:**
```typescript
export const employeesRouter = router({
  // Only HR Manager+ can list all employees
  list: hrManagerProcedure
    .input(...)
    .query(async ({ ctx }) => {
      // ctx.user is guaranteed to be hr_manager, tenant_admin, or super_admin
    }),

  // Only Tenant Admin+ can delete employees
  delete: adminProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      // ctx.user is guaranteed to be tenant_admin or super_admin
    }),
});
```

## Default Redirects

When an unauthorized user tries to access a protected route, they're redirected to their role's default dashboard:

| Role | Default Path |
|------|-------------|
| `employee` | `/employee/dashboard` |
| `manager` | `/manager/dashboard` |
| `hr_manager` | `/admin/dashboard` |
| `tenant_admin` | `/admin/settings/dashboard` |
| `super_admin` | `/admin/settings/dashboard` |

## Testing RBAC

### Manual Testing

1. **Create test users with different roles:**
   ```sql
   -- In Supabase SQL editor
   UPDATE users SET role = 'employee' WHERE email = 'employee@test.com';
   UPDATE users SET role = 'manager' WHERE email = 'manager@test.com';
   UPDATE users SET role = 'hr_manager' WHERE email = 'hr@test.com';
   UPDATE users SET role = 'tenant_admin' WHERE email = 'admin@test.com';
   ```

2. **Test access patterns:**
   - Login as employee → should only access /employee/* routes
   - Login as manager → should access /employee/* and /manager/* routes
   - Login as hr_manager → should access shared routes + /admin/dashboard + policies
   - Login as tenant_admin → should access everything

3. **Test redirects:**
   - Employee tries /admin/dashboard → redirected to /employee/dashboard
   - Manager tries /admin/settings/users → redirected to /manager/dashboard
   - HR Manager tries /admin/settings/billing → redirected to /admin/dashboard

### Automated Testing (Future)

```typescript
// Example test cases
describe('RBAC Middleware', () => {
  it('should allow employee to access /employee/dashboard', async () => {
    const response = await fetch('/employee/dashboard', {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    expect(response.status).toBe(200);
  });

  it('should deny employee access to /admin/dashboard', async () => {
    const response = await fetch('/admin/dashboard', {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    expect(response.status).toBe(307); // Redirect
    expect(response.headers.get('location')).toBe('/employee/dashboard');
  });
});
```

## Security Considerations

### Defense in Depth

RBAC is enforced at multiple levels:

1. **Middleware** - Route-level protection (first line of defense)
2. **tRPC Procedures** - API-level authorization (second line of defense)
3. **Row-Level Security (RLS)** - Database-level isolation (third line of defense)

### RLS Policies

Database tables have RLS policies that automatically filter by tenant:

```sql
-- Example from schema.ts
CREATE POLICY tenant_isolation ON employees
  FOR ALL
  TO public
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );
```

This ensures that even if middleware or API authorization is bypassed, users can only access data from their tenant (except super_admin).

### JWT Claims

User role is stored in Supabase JWT `app_metadata`:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "app_metadata": {
    "tenant_id": "tenant-uuid",
    "role": "hr_manager"
  }
}
```

Middleware extracts role from JWT for authorization decisions.

## Future Enhancements

1. **Permission-Based Access** - Fine-grained permissions beyond roles
2. **Dynamic Route Protection** - Configure routes in database
3. **Custom Role Creation** - Tenant admins can create custom roles
4. **Audit Logging** - Log all access attempts (successful + denied)
5. **Session Management** - Track active sessions, force logout

## Recommendations

1. **Always check role in both middleware AND tRPC procedures**
   - Middleware provides UX (redirect before page loads)
   - tRPC procedures provide API security

2. **Use hierarchical role checks**
   - hr_manager includes manager permissions
   - tenant_admin includes hr_manager permissions
   - super_admin includes tenant_admin permissions

3. **Test with all role types**
   - Ensure each role can access exactly what they should
   - Ensure each role is denied access to restricted routes

4. **Monitor access patterns**
   - Track denied access attempts
   - Alert on unusual patterns

5. **Keep route configuration centralized**
   - All route definitions in `/middleware.ts`
   - Single source of truth for access control

## References

- Architecture: `/docs/02-ARCHITECTURE-OVERVIEW.md` (Section 8.2)
- Database Schema: `/drizzle/schema.ts` (users table, role field)
- Middleware Implementation: `/middleware.ts`
- Navigation Configuration: `/lib/navigation/index.ts`
- tRPC Procedures: `/server/api/trpc.ts`
