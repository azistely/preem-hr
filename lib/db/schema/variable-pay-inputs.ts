import { pgTable, uuid, varchar, numeric, text, timestamp, date, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { tenantUser } from './roles';

/**
 * Variable Pay Inputs Table
 *
 * Stores variable component values with daily entry support.
 * Supports both daily tracking and monthly lump sum workflows.
 *
 * Daily Tracking:
 * - Multiple entries per component per period
 * - Each entry has a specific date (entry_date)
 * - Payroll sums all entries for the period
 *
 * Monthly Lump Sum:
 * - Single entry per component per period
 * - entry_date = period (first day of month)
 *
 * Architecture:
 * - Fixed components → employee_salaries.components JSONB
 * - Variable components → variable_pay_inputs table (this)
 * - Payroll calculation → SUM all entries by period
 */
export const variablePayInputs = pgTable('variable_pay_inputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Component identifier (matches salary_component_definitions.code)
  componentCode: varchar('component_code', { length: 50 }).notNull(),

  // Period in YYYY-MM-01 format (first day of month)
  // Used for grouping entries for payroll calculation
  period: date('period').notNull(),

  // Entry date (specific date for this entry)
  // - For daily workers: date worked (e.g., 2024-10-15)
  // - For monthly lump sum: first day of period (e.g., 2024-10-01)
  // Allows multiple entries per component per period
  entryDate: date('entry_date').notNull(),

  // Amount for this specific entry
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),

  // Optional notes (e.g., "8 heures de travail", "Commission vente #1234")
  notes: text('notes'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// Type exports for TypeScript inference
export type VariablePayInput = typeof variablePayInputs.$inferSelect;
export type NewVariablePayInput = typeof variablePayInputs.$inferInsert;
