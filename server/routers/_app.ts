/**
 * Main tRPC App Router
 *
 * Combines all feature routers into a single app router.
 */

import { createTRPCRouter } from '../api/trpc';
import { authRouter } from './auth';
import { payrollRouter } from './payroll';
import { tenantRouter } from './tenant';
import { employeesRouter } from './employees';
import { positionsRouter } from './positions';
import { assignmentsRouter } from './assignments';
import { salariesRouter } from './salaries';
import { salaryReviewsRouter } from './salary-reviews';
import { bulkAdjustmentsRouter } from './bulk-adjustments';
import { salaryBandsRouter } from './salary-bands';
import { salaryComponentsRouter } from './salary-components';
import { employeeCategoriesRouter } from './employee-categories';
import { sectorsRouter } from './sectors';
import { terminationsRouter } from './terminations';
import { documentsRouter } from './documents';
import { jobSearchDaysRouter } from './job-search-days';
import { timeTrackingRouter } from './time-tracking';
import { timeOffRouter } from './time-off';
import { policiesRouter } from './policies';
import { publicHolidaysRouter } from './public-holidays';
import { geofencingRouter } from './geofencing';
import { onboardingRouter } from './onboarding';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  payroll: payrollRouter,
  tenant: tenantRouter,
  employees: employeesRouter,
  positions: positionsRouter,
  assignments: assignmentsRouter,
  salaries: salariesRouter,
  salaryReviews: salaryReviewsRouter,
  bulkAdjustments: bulkAdjustmentsRouter,
  salaryBands: salaryBandsRouter,
  salaryComponents: salaryComponentsRouter,
  employeeCategories: employeeCategoriesRouter,
  sectors: sectorsRouter,
  terminations: terminationsRouter,
  documents: documentsRouter,
  jobSearchDays: jobSearchDaysRouter,
  timeTracking: timeTrackingRouter,
  timeOff: timeOffRouter,
  policies: policiesRouter,
  publicHolidays: publicHolidaysRouter,
  geofencing: geofencingRouter,
  onboarding: onboardingRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
