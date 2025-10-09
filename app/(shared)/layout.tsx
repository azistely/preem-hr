"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/navigation/dashboard-layout";
import { api } from "@/server/api/client";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared Layout for Multi-Role Pages
 *
 * Wraps shared pages (employees, payroll, time-tracking, etc.) with role-based navigation
 * - Employees see employee navigation
 * - Managers see manager navigation
 * - HR Managers see hr_manager navigation
 * - Tenant/Super Admins see admin navigation
 */
export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading } = api.auth.me.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-96 w-96" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Non authentifié</p>
      </div>
    );
  }

  // Determine navigation based on role
  // Priority: super_admin > tenant_admin > hr_manager > manager > employee
  let userRole: string = 'employee'; // default

  if (user.role === 'super_admin' || user.role === 'tenant_admin') {
    userRole = 'admin'; // Show admin navigation
  } else if (user.role === 'hr_manager') {
    userRole = 'hr_manager';
  } else if (user.role === 'manager') {
    userRole = 'manager';
  } else if (user.role === 'employee') {
    userRole = 'employee';
  }

  return (
    <DashboardLayout userRole={userRole}>
      {children}
    </DashboardLayout>
  );
}
