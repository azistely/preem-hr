"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/navigation/dashboard-layout";
import { api } from "@/server/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
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

  // Use hr_manager for HR managers and admin for tenant admins
  const userRole = user.role === 'tenant_admin' || user.role === 'super_admin'
    ? 'admin'
    : 'hr_manager';

  return (
    <DashboardLayout userRole={userRole}>
      {children}
    </DashboardLayout>
  );
}
