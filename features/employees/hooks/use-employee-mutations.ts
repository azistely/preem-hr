/**
 * Employee Mutation Hooks
 *
 * Handles employee creation, updates, termination, and suspension
 */

import { trpc } from '@/lib/trpc/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Create new employee (hire)
 */
export function useCreateEmployee() {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.employees.create.useMutation({
    onSuccess: (employee) => {
      toast.success(`${employee.firstName} ${employee.lastName} a été embauché(e) avec succès`);

      // Invalidate list cache
      utils.employees.list.invalidate();

      // Navigate to employee detail page
      router.push(`/employees/${employee.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'embauche');
    },
  });
}

/**
 * Update employee information
 */
export function useUpdateEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.update.useMutation({
    onSuccess: (employee) => {
      toast.success('Informations mises à jour avec succès');

      // Invalidate caches
      utils.employees.list.invalidate();
      utils.employees.getById.invalidate({ id: employee.id });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
}

/**
 * Terminate employee
 */
export function useTerminateEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.terminate.useMutation({
    onSuccess: (employee) => {
      toast.success(`${employee.firstName} ${employee.lastName} a été cessé(e) avec succès`);

      // Invalidate caches
      utils.employees.list.invalidate();
      utils.employees.getById.invalidate({ id: employee.id });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la cessation');
    },
  });
}

/**
 * Suspend employee
 */
export function useSuspendEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.suspend.useMutation({
    onSuccess: (employee) => {
      toast.success(`${employee.firstName} ${employee.lastName} a été suspendu(e) avec succès`);

      // Invalidate caches
      utils.employees.list.invalidate();
      utils.employees.getById.invalidate({ id: employee.id });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suspension');
    },
  });
}

/**
 * Reactivate suspended employee
 */
export function useReactivateEmployee() {
  const utils = trpc.useUtils();

  return trpc.employees.reactivate.useMutation({
    onSuccess: (employee) => {
      toast.success(`${employee.firstName} ${employee.lastName} a été réactivé(e) avec succès`);

      // Invalidate caches
      utils.employees.list.invalidate();
      utils.employees.getById.invalidate({ id: employee.id });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la réactivation');
    },
  });
}
