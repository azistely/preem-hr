/**
 * Salary Advances - Drizzle Relations
 *
 * Defines the relationships between salary advance tables and other entities
 */

import { relations } from 'drizzle-orm';
import {
  salaryAdvances,
  salaryAdvanceRepayments,
  salaryAdvancePolicies,
} from './salary-advances';
import { employees } from './employees';
import { users } from './users';
import { tenants } from './tenants';

/**
 * Salary Advances Relations
 */
export const salaryAdvancesRelations = relations(salaryAdvances, ({ one, many }) => ({
  // Parent relationships
  tenant: one(tenants, {
    fields: [salaryAdvances.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [salaryAdvances.employeeId],
    references: [employees.id],
  }),
  approvedByUser: one(users, {
    fields: [salaryAdvances.approvedBy],
    references: [users.id],
  }),
  rejectedByUser: one(users, {
    fields: [salaryAdvances.rejectedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [salaryAdvances.createdBy],
    references: [users.id],
  }),

  // Child relationships
  repayments: many(salaryAdvanceRepayments),
}));

/**
 * Salary Advance Repayments Relations
 */
export const salaryAdvanceRepaymentsRelations = relations(
  salaryAdvanceRepayments,
  ({ one }) => ({
    // Parent relationships
    tenant: one(tenants, {
      fields: [salaryAdvanceRepayments.tenantId],
      references: [tenants.id],
    }),
    advance: one(salaryAdvances, {
      fields: [salaryAdvanceRepayments.salaryAdvanceId],
      references: [salaryAdvances.id],
    }),
  })
);

/**
 * Salary Advance Policies Relations
 */
export const salaryAdvancePoliciesRelations = relations(
  salaryAdvancePolicies,
  ({ one }) => ({
    // Parent relationships
    tenant: one(tenants, {
      fields: [salaryAdvancePolicies.tenantId],
      references: [tenants.id],
    }),
    createdByUser: one(users, {
      fields: [salaryAdvancePolicies.createdBy],
      references: [users.id],
    }),
  })
);
