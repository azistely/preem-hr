/**
 * tRPC API Route Handler for Next.js App Router (v11)
 *
 * Exposes the tRPC router via HTTP endpoints.
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { appRouter } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/api/context';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
  });

export { handler as GET, handler as POST };
