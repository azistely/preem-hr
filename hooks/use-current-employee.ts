/**
 * Hook to get current user's employee record
 *
 * Uses the authenticated user's employeeId to fetch their employee profile
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';

export function useCurrentEmployee() {
  // Get the authenticated user's info (includes employeeId)
  const { data: user, isLoading: isLoadingUser } = trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch the employee record using the user's employeeId
  const { data: employee, isLoading: isLoadingEmployee } = trpc.employees.getById.useQuery(
    { id: user?.employeeId! },
    {
      enabled: !!user?.employeeId, // Only fetch if we have an employeeId
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Memoize employee ID
  const employeeId = useMemo(
    () => user?.employeeId,
    [user?.employeeId]
  );

  return {
    employee,
    employeeId,
    isLoading: isLoadingUser || isLoadingEmployee,
  };
}
