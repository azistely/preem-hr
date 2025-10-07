/**
 * Hook to get current user's employee record
 *
 * In development: Uses first employee from mock tenant
 * In production: Will get employee linked to authenticated user
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';

export function useCurrentEmployee() {
  // In dev: Get first employee from mock tenant
  // TODO: In production, get from auth context (user.employeeId)
  const { data: employees, isLoading } = trpc.employees.list.useQuery({
    status: 'active',
  }, {
    // Prevent unnecessary refetches since employee data rarely changes
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Memoize employee to prevent reference changes
  const currentEmployee = useMemo(
    () => employees?.employees?.[0],
    [employees?.employees]
  );

  // Memoize employee ID to prevent downstream queries from refetching
  const employeeId = useMemo(
    () => currentEmployee?.id,
    [currentEmployee?.id]
  );

  return {
    employee: currentEmployee,
    employeeId,
    isLoading,
  };
}
