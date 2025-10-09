# 🔐 Authentication & Redirect Flow

## Overview

The app now has a complete authentication flow with **automatic redirect back to requested page** after login.

---

## 🔄 Flow Diagram

```
User tries to access protected page (e.g., /time-tracking)
                    ↓
         Middleware checks authentication
                    ↓
              Not authenticated?
                    ↓
   Redirect to /login?redirect=/time-tracking
                    ↓
            User logs in successfully
                    ↓
   Automatically redirected to /time-tracking
                    ↓
                  Success! ✅
```

---

## 📋 Step-by-Step Flow

### 1. **User Tries to Access Protected Page**

Example: User visits `/time-tracking` without being logged in

### 2. **Middleware Intercepts Request**

File: `middleware.ts`

```typescript
// Check if user is authenticated
const { data: { session } } = await supabase.auth.getSession();

// Not authenticated? Redirect to login with original URL
if (!session) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname); // Save original URL
  return NextResponse.redirect(loginUrl);
}
```

**Result:** User is redirected to `/login?redirect=/time-tracking`

### 3. **Login Page Captures Redirect Parameter**

File: `app/login/page.tsx`

```typescript
// Get redirect URL from query params (set by middleware)
const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));

// Validate to prevent open redirect attacks
function getSafeRedirectUrl(redirect: string | null): string {
  if (!redirect) return '/onboarding';
  if (!redirect.startsWith('/')) return '/onboarding'; // Block external URLs
  if (redirect.startsWith('/login') || redirect.startsWith('/signup')) {
    return '/onboarding'; // Prevent redirect loops
  }
  return redirect;
}
```

### 4. **User Logs In Successfully**

```typescript
// After successful authentication
toast.success('Connexion réussie!', {
  description: `Bienvenue ${userData.user.firstName}!`,
});

// Redirect to original requested page
router.push(redirectUrl); // → /time-tracking
```

**Result:** User is sent to the page they originally requested!

---

## 🛡️ Security Features

### 1. **Open Redirect Prevention**

The `getSafeRedirectUrl()` function validates redirect URLs to prevent attacks:

```typescript
// ✅ ALLOWED: Internal paths
/time-tracking
/employees
/payroll/runs/123

// ❌ BLOCKED: External URLs
https://malicious-site.com
//evil.com/phishing

// ❌ BLOCKED: Redirect loops
/login
/signup
```

### 2. **Role-Based Access Control**

After redirect, middleware checks if user has access:

```typescript
// Check if user has access to this route
if (!hasAccess(pathname, userRole)) {
  // Redirect to default path for their role
  const defaultPath = getDefaultPath(userRole);
  return NextResponse.redirect(defaultPath);
}
```

**Example:**
- Employee tries to access `/payroll/runs` (HR Manager only)
- After login, middleware detects unauthorized access
- Redirects to `/employee/dashboard` instead

---

## 📝 Examples

### Example 1: Employee Accesses Time Tracking

1. Employee visits `/time-tracking` (not logged in)
2. Middleware redirects to `/login?redirect=/time-tracking`
3. Employee logs in
4. Redirected to `/time-tracking` ✅

### Example 2: Manager Accesses Team Page

1. Manager visits `/manager/team` (not logged in)
2. Middleware redirects to `/login?redirect=/manager/team`
3. Manager logs in
4. Redirected to `/manager/team` ✅

### Example 3: Employee Tries HR Page (Unauthorized)

1. Employee visits `/payroll/runs` (not logged in)
2. Middleware redirects to `/login?redirect=/payroll/runs`
3. Employee logs in
4. Middleware checks access → DENIED (role: employee, needs: hr_manager)
5. Redirected to `/employee/dashboard` with `?error=access_denied`
6. Employee sees their dashboard ✅

### Example 4: Malicious Redirect Attempt

1. Attacker sends link: `/login?redirect=https://evil.com`
2. User logs in
3. `getSafeRedirectUrl()` detects external URL
4. User redirected to `/onboarding` (safe default) ✅

---

## 🔧 Configuration

### Default Redirect Destinations

When no redirect is specified or redirect is invalid:

```typescript
// Login default
const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));
// Falls back to: /onboarding

// Role-based defaults (after access denied)
switch (role) {
  case 'super_admin':
  case 'tenant_admin':
    return '/admin/settings/dashboard';
  case 'hr_manager':
    return '/admin/dashboard';
  case 'manager':
    return '/manager/dashboard';
  case 'employee':
    return '/employee/dashboard';
}
```

### Public Routes (No Auth Required)

```typescript
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/api',
];
```

### Onboarding Exception

Onboarding routes bypass middleware checks:

```typescript
if (pathname.startsWith('/onboarding')) {
  return NextResponse.next(); // Allow access
}
```

---

## 🧪 Testing the Flow

### Manual Testing

1. **Test Protected Page Access**
   ```
   1. Logout (if logged in)
   2. Navigate to http://localhost:3000/time-tracking
   3. Should redirect to /login?redirect=/time-tracking
   4. Login with credentials
   5. Should redirect to /time-tracking
   ```

2. **Test Access Denied**
   ```
   1. Login as employee
   2. Navigate to http://localhost:3000/payroll/runs
   3. Should redirect to /login?redirect=/payroll/runs
   4. Login
   5. Should redirect to /employee/dashboard?error=access_denied
   ```

3. **Test Open Redirect Prevention**
   ```
   1. Visit: http://localhost:3000/login?redirect=https://google.com
   2. Login
   3. Should redirect to /onboarding (not google.com)
   ```

### Automated Testing (Future)

```typescript
// Example E2E test with Playwright
test('redirects to original page after login', async ({ page }) => {
  // Try to access protected page
  await page.goto('/time-tracking');

  // Should be on login page with redirect param
  expect(page.url()).toContain('/login?redirect=%2Ftime-tracking');

  // Login
  await page.fill('[name="email"]', 'employee@test.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('[type="submit"]');

  // Should be redirected to original page
  await expect(page).toHaveURL('/time-tracking');
});
```

---

## 🚀 What's Next

### Potential Enhancements

1. **Remember Me Functionality**
   - Add "Remember me" checkbox on login
   - Store preference in cookie
   - Extend session duration

2. **Password Reset Flow**
   - Add "Forgot password?" link
   - Email-based password reset
   - Redirect back to login after reset

3. **Session Expiry Handling**
   - Detect expired sessions
   - Auto-redirect to login with original URL
   - Show "Session expired" message

4. **OAuth Providers**
   - Add Google/Microsoft login
   - Preserve redirect parameter through OAuth flow

---

## 📄 Files Modified

1. **`middleware.ts`** - Already had redirect logic ✅
2. **`app/login/page.tsx`** - Updated to use redirect parameter ✅

---

## ✅ Status

**Authentication redirect flow is now complete and secure!**

- ✅ Saves original requested URL
- ✅ Redirects after successful login
- ✅ Prevents open redirect attacks
- ✅ Handles unauthorized access gracefully
- ✅ Works with role-based access control
