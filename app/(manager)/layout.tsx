"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/navigation/dashboard-layout";
import { api } from "@/server/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerLayout({
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

  // Determine correct role for navigation:
  // - Admins keep their admin nav when accessing manager routes
  // - HR managers keep their hr_manager nav when accessing manager routes
  // - Regular managers see manager nav
  const userRole = user.role === 'tenant_admin' || user.role === 'super_admin'
    ? 'admin'
    : user.role === 'hr_manager'
    ? 'hr_manager'
    : 'manager';

  return (
    <DashboardLayout userRole={userRole}>
      {children}
    </DashboardLayout>
  );
}
