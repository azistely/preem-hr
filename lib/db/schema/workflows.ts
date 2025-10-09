import { pgTable, uuid, timestamp, text, jsonb, boolean, integer, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Workflows - Business process automation definitions (Legacy - Phase 3)
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
 * Workflow Instances - Running workflow executions (Legacy - Phase 3)
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

/**
 * PHASE 4: VISUAL WORKFLOW BUILDER
 * Workflow Definitions - User-created no-code workflows
 */
export const workflowDefinitions = pgTable('workflow_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Workflow metadata
  name: text('name').notNull(),
  description: text('description'),

  // Trigger configuration
  triggerType: text('trigger_type').notNull(), // 'contract_expiry', 'salary_change', 'employee_hired', etc.
  triggerConfig: jsonb('trigger_config').notNull().default('{}'),

  // Conditions (optional filtering)
  conditions: jsonb('conditions').notNull().default('[]'),

  // Actions to execute
  actions: jsonb('actions').notNull().default('[]'),

  // Metadata
  status: text('status').notNull().default('draft'), // 'draft', 'active', 'paused', 'archived'
  createdBy: uuid('created_by').notNull().references(() => users.id),
  version: integer('version').notNull().default(1),

  // Execution stats
  executionCount: integer('execution_count').notNull().default(0),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  successCount: integer('success_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),

  // Template metadata
  isTemplate: boolean('is_template').default(false),
  templateCategory: text('template_category'), // 'contract_management', 'payroll', 'onboarding', 'offboarding'

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('workflow_definitions_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Workflow Executions - Execution history with detailed logs
 */
export const workflowExecutions = pgTable('workflow_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Execution context
  triggerEventId: uuid('trigger_event_id'), // Reference to event that triggered this
  employeeId: uuid('employee_id').references(() => employees.id), // If employee-specific

  // Execution results
  status: text('status').notNull(), // 'running', 'success', 'failed', 'skipped'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  // What happened
  actionsExecuted: jsonb('actions_executed').notNull().default('[]'),
  errorMessage: text('error_message'),
  executionLog: jsonb('execution_log').notNull().default('[]'),

  // Context data
  workflowSnapshot: jsonb('workflow_snapshot').notNull(), // Snapshot of workflow at execution time
  triggerData: jsonb('trigger_data').notNull().default('{}'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('workflow_executions_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// Type exports
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert;

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type NewWorkflowDefinition = typeof workflowDefinitions.$inferInsert;

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type NewWorkflowExecution = typeof workflowExecutions.$inferInsert;
