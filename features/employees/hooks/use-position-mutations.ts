/**
 * Position Mutation Hooks
 */

import { trpc } from '@/lib/trpc/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Create new position
 */
export function useCreatePosition() {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.positions.create.useMutation({
    onSuccess: (position) => {
      toast.success(`Poste "${position.title}" créé avec succès`);

      // Invalidate list cache
      utils.positions.list.invalidate();

      // Navigate to positions list
      router.push('/positions');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création du poste');
    },
  });
}
