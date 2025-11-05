/**
 * Main tRPC App Router
 *
 * Combines all feature routers into a single app router.
 */

import { createTRPCRouter } from '../api/trpc';
import { authRouter } from './auth';
import { payrollRouter } from './payroll';
import { payrollReviewRouter } from './payroll-review';
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
import { workSchedulesRouter } from './work-schedules';
import { policiesRouter } from './policies';
import { publicHolidaysRouter } from './public-holidays';
import { geofencingRouter } from './geofencing';
import { onboardingRouter } from './onboarding';
import { dashboardRouter } from './dashboard';
import { alertsRouter } from './alerts';
import { batchOperationsRouter } from './batch-operations';
import { workflowsRouter } from './workflows';
import { complianceRouter } from './compliance';
import { registreRouter } from './registre';
import { dataMigrationRouter } from './data-migration';
import { accountingRouter } from './accounting';
import { templatesRouter } from './templates';
import { bankingRouter } from './banking';
import { locationsRouter } from './locations';
import { bonusesRouter } from './bonuses';
import { cgeciRouter } from './cgeci';
import { variablePayInputsRouter } from './variable-pay-inputs';
import { dependentsRouter } from './dependents';
import { benefitsRouter } from './benefits';
import { employeeImportRouter } from './employee-import';
import { contractsRouter } from './contracts';
import { shiftPlanningRouter } from './shift-planning';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  dashboard: dashboardRouter,
  alerts: alertsRouter,
  batchOperations: batchOperationsRouter,
  workflows: workflowsRouter,
  compliance: complianceRouter,
  registre: registreRouter,
  dataMigration: dataMigrationRouter,
  accounting: accountingRouter,
  templates: templatesRouter,
  banking: bankingRouter,
  locations: locationsRouter,
  bonuses: bonusesRouter,
  cgeci: cgeciRouter,
  variablePayInputs: variablePayInputsRouter,
  dependents: dependentsRouter,
  benefits: benefitsRouter,
  employeeImport: employeeImportRouter,
  contracts: contractsRouter,
  payroll: payrollRouter,
  payrollReview: payrollReviewRouter,
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
  workSchedules: workSchedulesRouter,
  policies: policiesRouter,
  publicHolidays: publicHolidaysRouter,
  geofencing: geofencingRouter,
  onboarding: onboardingRouter,
  shiftPlanning: shiftPlanningRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
