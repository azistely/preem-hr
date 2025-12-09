/**
 * tRPC Client for App Router
 *
 * Provides type-safe API client for use in Client Components.
 */

import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

/**
 * Inferred router output types for type-safe component props
 * Usage: type MyData = RouterOutputs['employees']['getTeamMembers']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
