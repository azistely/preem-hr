/**
 * Main tRPC App Router
 *
 * Combines all feature routers into a single app router.
 */

import { createTRPCRouter } from '../api/trpc';
import { payrollRouter } from './payroll';

export const appRouter = createTRPCRouter({
  payroll: payrollRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
