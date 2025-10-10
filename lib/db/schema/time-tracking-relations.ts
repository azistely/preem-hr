/**
 * Relations for time tracking tables
 */
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { timeOffRequests, timeOffPolicies, timeOffBalances, timeEntries } from './time-tracking';

export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [timeOffRequests.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [timeOffRequests.employeeId],
    references: [employees.id],
  }),
  policy: one(timeOffPolicies, {
    fields: [timeOffRequests.policyId],
    references: [timeOffPolicies.id],
  }),
  balance: one(timeOffBalances, {
    fields: [timeOffRequests.balanceId],
    references: [timeOffBalances.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [timeEntries.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [timeEntries.employeeId],
    references: [employees.id],
  }),
}));
