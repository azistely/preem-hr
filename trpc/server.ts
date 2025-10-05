/**
 * tRPC Server Caller (v11) with SSR Hydration
 *
 * Server-side API caller for use in Server Components with React Query hydration
 */

import 'server-only';

import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { cache } from 'react';
import { createCallerFactory } from '@/server/api/trpc';
import { createTRPCContext } from '@/server/api/context';
import { appRouter } from '@/server/routers/_app';
import { createQueryClient } from './query-client';

/**
 * Create a stable getter for the query client
 * IMPORTANT: This must be cached to return the same client during the same request
 */
export const getQueryClient = cache(createQueryClient);

/**
 * Create a server-side caller for tRPC
 * Cached to prevent duplicate context creation
 */
const createContext = cache(async () => {
  return createTRPCContext();
});

const caller = createCallerFactory(appRouter)(createContext);

/**
 * Server-side tRPC helpers with hydration support
 *
 * Usage in Server Components:
 *
 * @example
 * // Prefetch data on server, hydrate to client
 * import { trpc, HydrateClient } from '@/trpc/server';
 *
 * export default async function Page() {
 *   void trpc.post.byId.prefetch({ id: '1' });
 *
 *   return (
 *     <HydrateClient>
 *       <ClientComponent />
 *     </HydrateClient>
 *   );
 * }
 *
 * @example
 * // Direct server-side call (no hydration)
 * const data = await trpc.post.byId();
 */
export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient,
);

// Also export as 'api' for backward compatibility
export const api = trpc;
