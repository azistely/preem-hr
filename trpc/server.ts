/**
 * tRPC Server Caller (v11)
 *
 * Server-side API caller for use in Server Components
 */

import 'server-only';

import { cache } from 'react';
import { createCallerFactory } from '@/server/api/trpc';
import { createTRPCContext } from '@/server/api/context';
import { appRouter } from '@/server/routers/_app';

/**
 * Create a server-side caller for tRPC
 * Cached to prevent duplicate context creation
 */
const createContext = cache(async () => {
  return createTRPCContext();
});

const caller = createCallerFactory(appRouter);

export const api = caller(createContext);
