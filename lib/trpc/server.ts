/**
 * tRPC Server Client for Server Components
 *
 * Provides type-safe API client for use in Server Components and Server Actions.
 */

import { httpBatchLink } from '@trpc/client';
import { appRouter } from '@/server/routers/_app';

export const serverClient = appRouter.createCaller({});

// Export for use in server components
export const api = serverClient;
