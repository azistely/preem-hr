/**
 * Next.js 15 Middleware - Role-Based Access Control (RBAC)
 *
 * Protects routes based on user role:
 * - super_admin: Full access to all routes (cross-tenant)
 * - tenant_admin: All tenant routes + admin settings
 * - hr_manager: All shared routes + admin dashboard + policies
 * - manager: Manager routes + shared routes (employees, payroll view)
 * - employee: Employee routes only
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * User role type
 */
type UserRole = 'super_admin' | 'tenant_admin' | 'hr_manager' | 'manager' | 'employee';

/**
 * Route access configuration
 */
const ROUTE_ACCESS: Record<string, UserRole[]> = {
  // Employee routes (accessible by all authenticated users)
  '/employee/dashboard': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/employee/payslips': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/employee/profile': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/employee/profile/edit': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/employee/my-schedule': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],

  // Manager routes
  '/manager/dashboard': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/team': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/time-tracking': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/time-tracking/manual-entry': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/time-off/approvals': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/reports/overtime': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/manager/shift-planning': ['manager', 'hr_manager', 'tenant_admin', 'super_admin'],

  // Admin dashboard (HR Manager+)
  '/admin/dashboard': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Admin policies (HR Manager+)
  '/admin/policies': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/policies/time-off': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/policies/overtime': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/policies/accrual': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Admin time management (HR Manager+)
  '/admin/time-tracking': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/time-tracking/import': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/time-off': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/public-holidays': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/geofencing': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Admin employee management (HR Manager+)
  '/admin/employees/import-export': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/admin/benefits': ['hr_manager', 'tenant_admin', 'super_admin'],

  // HR-specific routes (HR Manager+)
  '/hr/shift-planning': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Automation Hub (HR Manager+)
  '/automation': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/automation/reminders': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/automation/bulk-actions': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/automation/rules': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/automation/history': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Alerts and Workflows (HR Manager+)
  '/alerts': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/workflows': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/workflows/new': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/batch-operations': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/events': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Admin settings (Tenant Admin only)
  '/admin/settings': ['tenant_admin', 'super_admin'],
  '/admin/settings/dashboard': ['tenant_admin', 'super_admin'],
  '/admin/settings/users': ['tenant_admin', 'super_admin'],
  '/admin/settings/roles': ['tenant_admin', 'super_admin'],
  '/admin/settings/company': ['tenant_admin', 'super_admin'],
  '/admin/settings/billing': ['tenant_admin', 'super_admin'],
  '/admin/settings/costs': ['tenant_admin', 'super_admin'],
  '/admin/settings/security': ['tenant_admin', 'super_admin'],
  '/admin/settings/integrations': ['tenant_admin', 'super_admin'],
  '/admin/audit-log': ['tenant_admin', 'super_admin'],

  // Test routes (development only - should be removed in production)
  '/test-dashboard': ['tenant_admin', 'super_admin'],

  // Onboarding routes (all authenticated users)
  '/onboarding': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],

  // Shared routes (HR Manager+)
  '/employees': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/employees/new': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/runs': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/runs/new': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/calculator': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/dashboard': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/positions': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/positions/new': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/positions/org-chart': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/salaries': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/salaries/bulk-adjustment': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/salaries/bands': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/time-tracking': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'], // Employee time tracking
  '/time-off': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'], // Employee time-off requests
  '/terminations': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/contracts': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/horaires': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/horaires/approvals': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/leave/balances': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/reports': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/bonuses': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/payroll/variable-inputs': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Settings (accessible based on role)
  '/settings': ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'],
  '/settings/salary-components': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/settings/sectors': ['hr_manager', 'tenant_admin', 'super_admin'],

  // Compliance (HR Manager+)
  '/compliance/registre-personnel': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/compliance/cdd': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/compliance/declarations': ['hr_manager', 'tenant_admin', 'super_admin'],
  '/compliance/inspection': ['hr_manager', 'tenant_admin', 'super_admin'],
};

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/sn',  // Senegal homepage
  '/bf',  // Burkina Faso homepage
  '/login',
  '/signup',
  '/api',
  '/auth/confirm',           // Email verification callback
  '/auth/verify-email',      // Email verification pending page
  '/auth/forgot-password',   // Forgot password page
  '/auth/reset-password',    // Reset password page
  '/auth/auth-code-error',   // Auth error page
  '/auth/resend-verification', // Resend verification (future)
];

/**
 * Get default redirect path based on role
 */
function getDefaultPath(role: UserRole): string {
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
    default:
      return '/employee/dashboard';
  }
}

/**
 * Check if user has access to a route
 */
function hasAccess(pathname: string, role: UserRole): boolean {
  // Super admin has access to everything
  if (role === 'super_admin') return true;

  // Check exact match first
  if (ROUTE_ACCESS[pathname]) {
    return ROUTE_ACCESS[pathname].includes(role);
  }

  // Check prefix matches (for dynamic routes)
  for (const [routePath, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname.startsWith(routePath + '/')) {
      return allowedRoles.includes(role);
    }
  }

  // Default deny for protected routes
  return false;
}

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.includes(pathname)) return true;

  // Prefix match
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route + '/'));
}

/**
 * Middleware execution
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/templates') || // Public templates (e.g., employee import template)
    pathname.includes('/api/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|css|js|xlsx|xls|csv)$/)
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Update Supabase session (validates session and refreshes cookies)
  const { supabaseResponse, user } = await updateSession(request);

  // Redirect to login if not authenticated
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Extract user role from JWT claims (app_metadata)
  const userRole = (user.app_metadata?.role || 'employee') as UserRole;

  // Check if user has access to this route
  if (!hasAccess(pathname, userRole)) {
    // Redirect to default path for their role
    const defaultPath = getDefaultPath(userRole);
    const redirectUrl = new URL(defaultPath, request.url);

    // Don't add error parameter - just silently redirect to their dashboard
    // Users will naturally end up at their role-appropriate dashboard

    return NextResponse.redirect(redirectUrl);
  }

  // User has access - return response with updated session cookies
  return supabaseResponse;
}

/**
 * Matcher configuration
 * Only run middleware on protected routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$).*)',
  ],
};
