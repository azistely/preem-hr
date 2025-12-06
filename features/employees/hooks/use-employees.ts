/**
 * Employee Management Hooks
 *
 * Provides tRPC hooks for listing, filtering, and searching employees
 */

import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';

export interface EmployeeFilters {
  status?: 'active' | 'terminated' | 'suspended';
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  search?: string;
  positionId?: string;
  departmentId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * List employees with filters and pagination
 */
export function useEmployees(filters?: EmployeeFilters) {
  return trpc.employees.list.useQuery({
    status: filters?.status,
    contractType: filters?.contractType,
    search: filters?.search,
    positionId: filters?.positionId,
    departmentId: filters?.departmentId,
    limit: filters?.limit || 50,
    cursor: filters?.cursor,
  }, {
    placeholderData: keepPreviousData, // For smooth pagination (tRPC v11)
  });
}

/**
 * Get single employee by ID with full details
 */
export function useEmployee(employeeId: string | undefined) {
  return trpc.employees.getById.useQuery(
    { id: employeeId! },
    { enabled: !!employeeId }
  );
}

/**
 * Update employee mutation
 */
export function useUpdateEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.update.useMutation({
    onSuccess: (data) => {
      // Invalidate employee queries to refresh data
      if (data && 'id' in data) {
        utils.employees.getById.invalidate({ id: data.id as string });
      }
      utils.employees.list.invalidate();
    },
  });
}

/**
 * Reactivate employee mutation
 */
export function useReactivateEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.reactivate.useMutation({
    onSuccess: (data) => {
      // Invalidate employee queries to refresh data
      utils.employees.getById.invalidate({ id: data.id });
      utils.employees.list.invalidate();
    },
  });
}
