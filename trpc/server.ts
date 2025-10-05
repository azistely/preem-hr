/**
 * tRPC Server Caller (v11)
 *
 * Server-side API caller for use in Server Components
 */

import 'server-only';

import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { cache } from 'react';
import { createCallerFactory } from '@/server/api/trpc';
import { createTRPCContext } from '@/server/api/context';
import { appRouter } from '@/server/routers/_app';
import { createQueryClient } from './query-client';

/**
 * Create a server-side caller for tRPC
 * Cached to prevent duplicate context creation
 */
const createContext = cache(async () => {
  return createTRPCContext();
});

const caller = createCallerFactory(appRouter);

export const api = caller(createContext);

export const { TRPCHydrationBoundary, HydrateClient } = createHydrationHelpers<
  typeof appRouter
>(api, createQueryClient);
