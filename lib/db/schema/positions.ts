import { pgTable, uuid, text, numeric, date, timestamp, integer, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { tenantUser } from './roles';

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Position info
  title: text('title').notNull(),
  code: text('code'),
  description: text('description'),

  // Hierarchy
  departmentId: uuid('department_id'), // References departments(id)
  reportsToPositionId: uuid('reports_to_position_id'), // Self-reference

  // Compensation
  minSalary: numeric('min_salary', { precision: 15, scale: 2 }),
  maxSalary: numeric('max_salary', { precision: 15, scale: 2 }),
  currency: text('currency').notNull().default('XOF'),

  // Job details
  jobLevel: text('job_level'),
  employmentType: text('employment_type').notNull().default('full_time'),
  weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 }).notNull().default('40'),
  workSchedule: jsonb('work_schedule'),

  // Status
  status: text('status').notNull().default('active'),
  headcount: integer('headcount').notNull().default(1),

  // Effective dating
  effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
  effectiveTo: date('effective_to'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
  updatedBy: uuid('updated_by'), // References users(id)
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
