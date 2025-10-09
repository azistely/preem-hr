# RBAC Testing Guide

This guide provides step-by-step instructions for testing the Role-Based Access Control (RBAC) implementation in Preem HR.

## Prerequisites

1. Local development environment running
2. Supabase project configured
3. Database seeded with test data
4. Access to Supabase dashboard

## Setup Test Users

### Step 1: Create Test Tenants

```sql
-- Run in Supabase SQL Editor

-- Create test tenant
INSERT INTO tenants (id, name, slug, country_code, sector_code, currency, timezone, plan, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Company', 'test-company', 'CI', 'SERVICES', 'XOF', 'Africa/Abidjan', 'trial', 'active')
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Create Test Users in Supabase Auth

Use Supabase Dashboard → Authentication → Users → Add User:

1. **Employee User:**
   - Email: `employee@test.preem.hr`
   - Password: `TestPass123!`
   - Auto-confirm: Yes

2. **Manager User:**
   - Email: `manager@test.preem.hr`
   - Password: `TestPass123!`
   - Auto-confirm: Yes

3. **HR Manager User:**
   - Email: `hr@test.preem.hr`
   - Password: `TestPass123!`
   - Auto-confirm: Yes

4. **Tenant Admin User:**
   - Email: `admin@test.preem.hr`
   - Password: `TestPass123!`
   - Auto-confirm: Yes

### Step 3: Update User Metadata in Supabase

For each user created above, update their `app_metadata`:

1. Go to Supabase Dashboard → Authentication → Users
2. Click on the user
3. Click "Edit User"
4. Update `app_metadata` field:

**Employee:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "role": "employee"
}
```

**Manager:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "role": "manager"
}
```

**HR Manager:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "role": "hr_manager"
}
```

**Tenant Admin:**
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "role": "tenant_admin"
}
```

### Step 4: Create Database User Records

```sql
-- Run in Supabase SQL Editor

INSERT INTO users (id, tenant_id, email, first_name, last_name, role, status)
VALUES
  -- Replace these UUIDs with actual Supabase Auth user IDs
  ('[EMPLOYEE_USER_ID]', '00000000-0000-0000-0000-000000000001', 'employee@test.preem.hr', 'Test', 'Employee', 'employee', 'active'),
  ('[MANAGER_USER_ID]', '00000000-0000-0000-0000-000000000001', 'manager@test.preem.hr', 'Test', 'Manager', 'manager', 'active'),
  ('[HR_USER_ID]', '00000000-0000-0000-0000-000000000001', 'hr@test.preem.hr', 'Test', 'HR', 'hr_manager', 'active'),
  ('[ADMIN_USER_ID]', '00000000-0000-0000-0000-000000000001', 'admin@test.preem.hr', 'Test', 'Admin', 'tenant_admin', 'active')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  tenant_id = EXCLUDED.tenant_id;
```

## Test Cases

### Test 1: Employee Role Access

**Login as:** `employee@test.preem.hr`

**Expected Results:**

| Route | Expected Behavior |
|-------|------------------|
| `/employee/dashboard` | ✅ Access granted, page loads |
| `/employee/payslips` | ✅ Access granted, page loads |
| `/employee/profile` | ✅ Access granted, page loads |
| `/employee/profile/edit` | ✅ Access granted, page loads |
| `/manager/dashboard` | ❌ Redirect to `/employee/dashboard?error=access_denied` |
| `/admin/dashboard` | ❌ Redirect to `/employee/dashboard?error=access_denied` |
| `/employees` | ❌ Redirect to `/employee/dashboard?error=access_denied` |
| `/payroll/runs` | ❌ Redirect to `/employee/dashboard?error=access_denied` |
| `/admin/settings/users` | ❌ Redirect to `/employee/dashboard?error=access_denied` |

**Checklist:**
- [ ] Can view own dashboard
- [ ] Can view own payslips
- [ ] Can view/edit own profile
- [ ] Cannot access manager pages
- [ ] Cannot access admin pages
- [ ] Cannot access shared HR pages
- [ ] Redirected to employee dashboard when denied
- [ ] Navigation only shows employee menu items

---

### Test 2: Manager Role Access

**Login as:** `manager@test.preem.hr`

**Expected Results:**

| Route | Expected Behavior |
|-------|------------------|
| `/employee/dashboard` | ✅ Access granted |
| `/employee/payslips` | ✅ Access granted |
| `/manager/dashboard` | ✅ Access granted, page loads |
| `/manager/team` | ✅ Access granted, page loads |
| `/manager/time-tracking` | ✅ Access granted, page loads |
| `/manager/time-off/approvals` | ✅ Access granted, page loads |
| `/manager/reports/overtime` | ✅ Access granted, page loads |
| `/admin/dashboard` | ❌ Redirect to `/manager/dashboard?error=access_denied` |
| `/employees` | ❌ Redirect to `/manager/dashboard?error=access_denied` |
| `/payroll/runs` | ❌ Redirect to `/manager/dashboard?error=access_denied` |
| `/admin/settings/users` | ❌ Redirect to `/manager/dashboard?error=access_denied` |

**Checklist:**
- [ ] Can view all employee pages
- [ ] Can view manager dashboard
- [ ] Can view team members
- [ ] Can view time tracking
- [ ] Can view time-off approvals
- [ ] Cannot access admin pages
- [ ] Cannot access shared HR pages
- [ ] Redirected to manager dashboard when denied
- [ ] Navigation shows manager menu items

---

### Test 3: HR Manager Role Access

**Login as:** `hr@test.preem.hr`

**Expected Results:**

| Route | Expected Behavior |
|-------|------------------|
| `/employee/dashboard` | ✅ Access granted |
| `/manager/dashboard` | ✅ Access granted |
| `/admin/dashboard` | ✅ Access granted, page loads |
| `/employees` | ✅ Access granted, page loads |
| `/employees/new` | ✅ Access granted, page loads |
| `/payroll/runs` | ✅ Access granted, page loads |
| `/payroll/runs/new` | ✅ Access granted, page loads |
| `/payroll/calculator` | ✅ Access granted, page loads |
| `/positions` | ✅ Access granted, page loads |
| `/salaries` | ✅ Access granted, page loads |
| `/time-tracking` | ✅ Access granted, page loads |
| `/time-off` | ✅ Access granted, page loads |
| `/admin/policies/time-off` | ✅ Access granted, page loads |
| `/admin/public-holidays` | ✅ Access granted, page loads |
| `/admin/geofencing` | ✅ Access granted, page loads |
| `/admin/employees/import-export` | ✅ Access granted, page loads |
| `/admin/settings/users` | ❌ Redirect to `/admin/dashboard?error=access_denied` |
| `/admin/settings/billing` | ❌ Redirect to `/admin/dashboard?error=access_denied` |
| `/admin/audit-log` | ❌ Redirect to `/admin/dashboard?error=access_denied` |

**Checklist:**
- [ ] Can view all employee and manager pages
- [ ] Can view admin dashboard
- [ ] Can manage employees
- [ ] Can run payroll
- [ ] Can manage positions
- [ ] Can manage salaries
- [ ] Can configure time-off policies
- [ ] Cannot access admin settings
- [ ] Cannot access user management
- [ ] Cannot access billing
- [ ] Redirected to admin dashboard when denied
- [ ] Navigation shows HR manager menu items

---

### Test 4: Tenant Admin Role Access

**Login as:** `admin@test.preem.hr`

**Expected Results:**

| Route | Expected Behavior |
|-------|------------------|
| All HR Manager routes | ✅ Access granted |
| `/admin/settings/dashboard` | ✅ Access granted, page loads |
| `/admin/settings/users` | ✅ Access granted, page loads |
| `/admin/settings/roles` | ✅ Access granted, page loads |
| `/admin/settings/company` | ✅ Access granted, page loads |
| `/admin/settings/billing` | ✅ Access granted, page loads |
| `/admin/settings/costs` | ✅ Access granted, page loads |
| `/admin/settings/security` | ✅ Access granted, page loads |
| `/admin/settings/integrations` | ✅ Access granted, page loads |
| `/admin/audit-log` | ✅ Access granted, page loads |

**Checklist:**
- [ ] Can view all HR manager pages
- [ ] Can view admin settings dashboard
- [ ] Can manage users
- [ ] Can manage roles
- [ ] Can configure company settings
- [ ] Can view billing
- [ ] Can view audit logs
- [ ] Navigation shows tenant admin menu items
- [ ] Default landing is `/admin/settings/dashboard`

---

### Test 5: Navigation Menu Visibility

**For each role, verify navigation menu:**

**Employee:**
- [ ] Shows: Dashboard, Payslips, Profile
- [ ] Hides: All manager and admin items

**Manager:**
- [ ] Shows: Dashboard, Team, Time Tracking, Approvals, Reports
- [ ] Hides: Admin items, Employees management, Payroll

**HR Manager:**
- [ ] Shows: Dashboard, Payroll, Employees, Positions, Time, Time-off policies
- [ ] Hides: Admin settings, User management, Billing

**Tenant Admin:**
- [ ] Shows: Everything HR Manager has PLUS Admin Settings section
- [ ] Shows: User management, Billing, Audit logs, Security

---

### Test 6: Direct URL Access (Bypass Attempt)

**For each role, try accessing URLs directly:**

1. **Employee tries manager route:**
   ```
   http://localhost:3000/manager/dashboard
   ```
   Expected: Redirect to `/employee/dashboard?error=access_denied`

2. **Manager tries admin route:**
   ```
   http://localhost:3000/admin/dashboard
   ```
   Expected: Redirect to `/manager/dashboard?error=access_denied`

3. **HR Manager tries admin settings:**
   ```
   http://localhost:3000/admin/settings/users
   ```
   Expected: Redirect to `/admin/dashboard?error=access_denied`

**Checklist:**
- [ ] Direct URL access is blocked
- [ ] Proper redirects happen
- [ ] Error parameter is added to URL
- [ ] No flash of unauthorized content

---

### Test 7: tRPC API Authorization

**Test API endpoints with different roles:**

1. **Employee tries to list all employees:**
   ```typescript
   // In browser console (logged in as employee)
   const employees = await trpc.employees.list.query();
   ```
   Expected: Error "Accès refusé - Rôle RH requis"

2. **HR Manager tries to delete user:**
   ```typescript
   // In browser console (logged in as hr_manager)
   const result = await trpc.users.delete.mutate({ userId: 'xxx' });
   ```
   Expected: Error "Accès refusé - Rôle administrateur requis"

**Checklist:**
- [ ] API properly rejects unauthorized calls
- [ ] Error messages in French
- [ ] Proper HTTP status codes (403 Forbidden)

---

### Test 8: Row-Level Security (RLS)

**Create two tenants and verify data isolation:**

1. Create second tenant in database
2. Create users for both tenants with same role (e.g., hr_manager)
3. Login as user from Tenant A
4. Try to access employee from Tenant B via API
5. Verify data is filtered by RLS

**Expected:**
- [ ] Users can only see data from their tenant
- [ ] Super admin can see all tenants (if implemented)
- [ ] RLS policies properly enforced

---

### Test 9: Session Management

**Test authentication flows:**

1. **Login/Logout:**
   - [ ] Login redirects to correct default dashboard
   - [ ] Logout clears session
   - [ ] Cannot access protected routes after logout

2. **Session Expiry:**
   - [ ] Expired session redirects to login
   - [ ] Redirect parameter preserves intended destination

3. **Cross-tab Behavior:**
   - [ ] Logout in one tab logs out all tabs
   - [ ] Session refresh works across tabs

---

## Automated Testing (Future)

### Playwright Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('RBAC - Employee Role', () => {
  test.beforeEach(async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.fill('[name="email"]', 'employee@test.preem.hr');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/employee/dashboard');
  });

  test('can access employee dashboard', async ({ page }) => {
    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL('/employee/dashboard');
  });

  test('cannot access admin dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL('/employee/dashboard?error=access_denied');
  });

  test('cannot access employees list', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL('/employee/dashboard?error=access_denied');
  });
});
```

---

## Troubleshooting

### Issue: Redirect loop

**Symptom:** Browser keeps redirecting between pages

**Cause:** Middleware redirecting to a route that user doesn't have access to

**Fix:** Check default dashboard path for role in `getDefaultPath()` function

---

### Issue: User has role but still denied

**Symptom:** User with correct role cannot access page

**Possible Causes:**
1. Role not in Supabase `app_metadata`
2. Role mismatch between database and JWT
3. Middleware configuration missing route

**Fix:**
1. Check Supabase user `app_metadata.role`
2. Check database `users.role` field
3. Verify route in `ROUTE_ACCESS` object in `/middleware.ts`

---

### Issue: 404 on protected route

**Symptom:** Page returns 404 instead of redirect

**Cause:** Page doesn't exist or middleware not running

**Fix:**
1. Verify page exists in `/app` directory
2. Check middleware `config.matcher` includes the route
3. Check Next.js dev server is running

---

### Issue: Flash of unauthorized content

**Symptom:** User sees page briefly before redirect

**Cause:** Client-side check instead of middleware

**Fix:** Ensure middleware is handling the route (check `matcher` config)

---

## Performance Considerations

1. **Middleware Performance:**
   - Middleware runs on every request
   - Should complete in < 50ms
   - Monitor in production with Vercel Analytics

2. **Database Queries:**
   - User role fetched from JWT (not database)
   - RLS policies add query overhead
   - Consider caching user permissions

3. **Navigation:**
   - Navigation computed client-side
   - Consider memoizing with React.useMemo

---

## Security Checklist

Before production deployment:

- [ ] All test users removed
- [ ] Test dashboard page deleted
- [ ] Supabase service role key secured
- [ ] RLS policies verified
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] Session timeout configured
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] All routes in middleware config

---

## Reporting Issues

When reporting RBAC issues, include:

1. User role (from JWT and database)
2. Route attempted
3. Expected behavior
4. Actual behavior
5. Browser console errors
6. Network tab (check redirect chain)
7. Supabase logs

**Example:**
```
Role: hr_manager
Route: /admin/settings/users
Expected: Access granted
Actual: Redirect to /admin/dashboard
Error: None in console
JWT Claims: { role: "hr_manager", tenant_id: "xxx" }
Database Role: hr_manager
```

---

## Next Steps

After completing manual testing:

1. Create automated Playwright tests
2. Add E2E tests to CI/CD pipeline
3. Monitor access denials in production
4. Set up alerts for unusual patterns
5. Document role assignment process
6. Create admin UI for role management

---

**Happy Testing!** 🚀
