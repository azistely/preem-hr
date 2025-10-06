/**
 * Position Management Hooks
 *
 * Provides tRPC hooks for position CRUD and organizational hierarchy
 */

import { trpc } from '@/lib/trpc/client';

/**
 * List all positions
 */
export function usePositions(status?: 'active' | 'inactive') {
  return trpc.positions.list.useQuery({ status });
}

/**
 * Get position hierarchy (org chart)
 */
export function usePositionHierarchy(positionId: string | undefined) {
  return trpc.positions.getHierarchy.useQuery(
    { positionId: positionId! },
    { enabled: !!positionId }
  );
}
