import { pgTable, uuid, numeric, text, date, timestamp, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

export const employeeSalaries = pgTable('employee_salaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Salary details
  baseSalary: numeric('base_salary', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('XOF'),
  payFrequency: text('pay_frequency').notNull().default('monthly'),

  // Allowances (recurring)
  housingAllowance: numeric('housing_allowance', { precision: 15, scale: 2 }).default('0'),
  transportAllowance: numeric('transport_allowance', { precision: 15, scale: 2 }).default('0'),
  mealAllowance: numeric('meal_allowance', { precision: 15, scale: 2 }).default('0'),
  otherAllowances: jsonb('other_allowances').default([]),

  // Effective dating
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),

  // Change tracking
  changeReason: text('change_reason'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
}, (table) => [
  // RLS Policy: Tenant Isolation for Employee Salaries
  // Note: employee_salaries doesn't have direct tenant_id, so we join with employees
  pgPolicy('employee_salaries_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`EXISTS (
      SELECT 1 FROM ${employees}
      WHERE ${employees.id} = ${table.employeeId}
        AND ${employees.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid
    ) OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`EXISTS (
      SELECT 1 FROM ${employees}
      WHERE ${employees.id} = ${table.employeeId}
        AND ${employees.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid
    )`,
  }),
]);
