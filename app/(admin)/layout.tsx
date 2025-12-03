"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/navigation/dashboard-layout";
import { api } from "@/server/api/client";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AdminLayout - Optimized for instant navigation
 *
 * Performance optimizations based on TanStack Query best practices:
 * 1. Uses placeholderData to show previous user data during refetch
 * 2. Only shows skeleton on FIRST load (when no cached data exists)
 * 3. Cached auth data (staleTime: 5min) prevents loading flash on navigation
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading, isFetching } = api.auth.me.useQuery(undefined, {
    // Keep previous data while refetching - prevents content flash
    placeholderData: (previousData) => previousData,
  });

  // Only show loading skeleton on FIRST load (no cached data)
  // On subsequent navigations, we have cached user data, so render immediately
  const showSkeleton = isLoading && !user;

  if (showSkeleton) {
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

  // Map user role appropriately for navigation
  // - hr_manager: HR Manager navigation
  // - tenant_admin: Admin navigation (HR + tenant admin features)
  // - super_admin: Super Admin navigation (everything + multi-country config)
  const userRole = user.role === 'super_admin'
    ? 'super_admin'
    : user.role === 'tenant_admin'
    ? 'tenant_admin'
    : 'hr_manager';

  return (
    <DashboardLayout userRole={userRole}>
      {children}
    </DashboardLayout>
  );
}
