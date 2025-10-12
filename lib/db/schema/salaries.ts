import { pgTable, uuid, numeric, text, date, timestamp, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

export const employeeSalaries = pgTable('employee_salaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Salary components
  baseSalary: numeric('base_salary', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('XOF'),
  payFrequency: text('pay_frequency').notNull().default('monthly'),

  // Legacy: allowances JSONB (deprecated, use components instead)
  allowances: jsonb('allowances').notNull().default({}),

  // Single source of truth: components JSONB array
  // Contains SalaryComponentInstance[] with code, name, amount, sourceType, metadata
  // Must always contain base salary component (code '11')
  components: jsonb('components').notNull().default([]),

  // Effective dating
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),

  // Change tracking
  changeReason: text('change_reason'),
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
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
