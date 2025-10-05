import { pgTable, uuid, timestamp, text, jsonb, boolean, integer, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { tenantUser } from './roles';

/**
 * Workflows - Business process automation definitions
 */
export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Workflow details
  name: text('name').notNull(),
  description: text('description'),
  triggerEvent: text('trigger_event').notNull(),

  // Workflow definition (JSONB with steps, conditions, actions)
  definition: jsonb('definition').notNull(),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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

/**
 * Workflow Instances - Running workflow executions
 */
export const workflowInstances = pgTable('workflow_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),

  // Instance details
  entityType: text('entity_type').notNull(), // employee, payroll_run, time_off_request, etc.
  entityId: uuid('entity_id').notNull(),

  // Execution state
  status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
  currentStep: integer('current_step').default(0),
  stepData: jsonb('step_data').notNull().default('{}'),
  errorMessage: text('error_message'),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
