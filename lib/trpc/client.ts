/**
 * tRPC Client for App Router
 *
 * Provides type-safe API client for use in Client Components.
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
