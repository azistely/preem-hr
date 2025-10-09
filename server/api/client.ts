/**
 * tRPC Client Export
 *
 * Re-exports the tRPC client as 'api' for use in components.
 */

import { trpc } from '@/lib/trpc/client';

export const api = trpc;
