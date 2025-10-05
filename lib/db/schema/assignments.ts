import { pgTable, uuid, text, date, timestamp, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { positions } from './positions';
import { tenantUser } from './roles';

export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').notNull().references(() => positions.id, { onDelete: 'restrict' }),

  // Assignment details
  assignmentType: text('assignment_type').notNull().default('primary'),

  // Effective dating
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),

  // Tracking
  assignmentReason: text('assignment_reason'),
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
