/**
 * Main tRPC App Router
 *
 * Combines all feature routers into a single app router.
 */

import { createTRPCRouter } from '../api/trpc';
import { payrollRouter } from './payroll';
import { tenantRouter } from './tenant';
import { employeesRouter } from './employees';
import { positionsRouter } from './positions';
import { assignmentsRouter } from './assignments';
import { salariesRouter } from './salaries';
import { salaryReviewsRouter } from './salary-reviews';
import { bulkAdjustmentsRouter } from './bulk-adjustments';
import { salaryBandsRouter } from './salary-bands';

export const appRouter = createTRPCRouter({
  payroll: payrollRouter,
  tenant: tenantRouter,
  employees: employeesRouter,
  positions: positionsRouter,
  assignments: assignmentsRouter,
  salaries: salariesRouter,
  salaryReviews: salaryReviewsRouter,
  bulkAdjustments: bulkAdjustmentsRouter,
  salaryBands: salaryBandsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
