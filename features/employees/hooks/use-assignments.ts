/**
 * Assignment Hooks
 *
 * Manages employee-position assignments and transfers
 */

import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

/**
 * Get current assignment for employee
 */
export function useCurrentAssignment(
  employeeId: string | undefined,
  assignmentType: 'primary' | 'secondary' | 'temporary' = 'primary'
) {
  return trpc.assignments.getCurrent.useQuery(
    { employeeId: employeeId!, assignmentType },
    { enabled: !!employeeId }
  );
}

/**
 * Create new assignment
 */
export function useCreateAssignment() {
  const utils = trpc.useUtils();

  return trpc.assignments.create.useMutation({
    onSuccess: () => {
      toast.success('Affectation créée avec succès');
      utils.employees.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'affectation');
    },
  });
}

/**
 * Transfer employee to new position
 */
export function useTransferEmployee() {
  const utils = trpc.useUtils();

  return trpc.assignments.transfer.useMutation({
    onSuccess: (assignment) => {
      toast.success('Transfert effectué avec succès');

      // Invalidate relevant caches
      utils.employees.list.invalidate();
      utils.employees.getById.invalidate({ id: assignment.employeeId });
      utils.assignments.getCurrent.invalidate({ employeeId: assignment.employeeId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du transfert');
    },
  });
}
