import { pgTable, uuid, numeric, text, date, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { employees } from './employees';

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
});
