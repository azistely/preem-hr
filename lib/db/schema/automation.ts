/**
 * Workflow Automation & Orchestration Schema
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Tables:
 * - alerts: Proactive notifications for HR managers
 * - batch_operations: Bulk operations tracking with progress
 * - payroll_events: Event-driven payroll changes audit trail
 */

import { pgTable, uuid, timestamp, text, jsonb, integer, boolean, numeric, date, pgPolicy } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { payrollRuns } from './payroll';
import { tenantUser } from './roles';

/**
 * ALERTS TABLE
 * Proactive alerts for HR managers (contract expiry, leave notifications, document expiry)
 */
export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Alert details
  type: text('type').notNull(), // 'contract_expiry', 'leave_notification', 'document_expiry', 'payroll_reminder'
  severity: text('severity').notNull(), // 'info', 'warning', 'urgent'
  message: text('message').notNull(),

  // Assignment
  assigneeId: uuid('assignee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }), // Optional

  // Action
  actionUrl: text('action_url'),
  actionLabel: text('action_label'),
  dueDate: timestamp('due_date', { withTimezone: true }),

  // State
  status: text('status').notNull().default('active'), // 'active', 'dismissed', 'completed'
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  dismissedBy: uuid('dismissed_by').references(() => users.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by').references(() => users.id),

  // Metadata (JSONB with Zod validation)
  metadata: jsonb('metadata').notNull().default('{}'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('alerts_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * BATCH OPERATIONS TABLE
 * Tracks bulk operations with progress monitoring (salary updates, document generation)
 */
export const batchOperations = pgTable('batch_operations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Operation details
  operationType: text('operation_type').notNull(), // 'salary_update', 'document_generation', 'contract_renewal'
  entityType: text('entity_type').notNull(), // 'employees', 'contracts', 'payroll_line_items'
  entityIds: uuid('entity_ids').array().notNull(), // Array of UUIDs

  // Parameters (operation-specific data)
  params: jsonb('params').notNull(),

  // Progress tracking
  status: text('status').notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  totalCount: integer('total_count').notNull(),
  processedCount: integer('processed_count').default(0),
  successCount: integer('success_count').default(0),
  errorCount: integer('error_count').default(0),
  errors: jsonb('errors').notNull().default('[]'), // Array of { entityId, error, timestamp }

  // Execution timing
  startedBy: uuid('started_by').notNull().references(() => users.id),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  estimatedCompletionAt: timestamp('estimated_completion_at', { withTimezone: true }),

  // Result data
  resultData: jsonb('result_data').notNull().default('{}'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('batch_operations_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * PAYROLL EVENTS TABLE
 * Event-driven payroll changes audit trail (termination, hire, salary change, leave)
 */
export const payrollEvents = pgTable('payroll_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Event details
  eventType: text('event_type').notNull(), // 'termination', 'hire', 'salary_change', 'unpaid_leave', 'position_change'
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'set null' }),

  // Event data
  eventDate: date('event_date').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'), // Event-specific data

  // Calculated amounts
  amountCalculated: numeric('amount_calculated', { precision: 15, scale: 2 }),
  isProrated: boolean('is_prorated').default(false),
  workingDays: integer('working_days'),
  daysWorked: integer('days_worked'),
  prorationPercentage: numeric('proration_percentage', { precision: 5, scale: 2 }),

  // Processing state
  processingStatus: text('processing_status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  processedAt: timestamp('processed_at', { withTimezone: true }),
  errorMessage: text('error_message'),

  // Impact tracking
  impactedPayrollRuns: uuid('impacted_payroll_runs').array().notNull().default(sql`ARRAY[]::uuid[]`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('payroll_events_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// Type exports for TypeScript
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type BatchOperation = typeof batchOperations.$inferSelect;
export type NewBatchOperation = typeof batchOperations.$inferInsert;

export type PayrollEvent = typeof payrollEvents.$inferSelect;
export type NewPayrollEvent = typeof payrollEvents.$inferInsert;

// Relations
export const alertsRelations = relations(alerts, ({one}) => ({
  tenant: one(tenants, {
    fields: [alerts.tenantId],
    references: [tenants.id]
  }),
  assignee: one(users, {
    fields: [alerts.assigneeId],
    references: [users.id],
    relationName: "alerts_assigneeId_users_id"
  }),
  employee: one(employees, {
    fields: [alerts.employeeId],
    references: [employees.id]
  }),
  dismissedByUser: one(users, {
    fields: [alerts.dismissedBy],
    references: [users.id],
    relationName: "alerts_dismissedBy_users_id"
  }),
  completedByUser: one(users, {
    fields: [alerts.completedBy],
    references: [users.id],
    relationName: "alerts_completedBy_users_id"
  }),
}));

export const batchOperationsRelations = relations(batchOperations, ({one}) => ({
  tenant: one(tenants, {
    fields: [batchOperations.tenantId],
    references: [tenants.id]
  }),
  startedByUser: one(users, {
    fields: [batchOperations.startedBy],
    references: [users.id]
  }),
}));

export const payrollEventsRelations = relations(payrollEvents, ({one}) => ({
  tenant: one(tenants, {
    fields: [payrollEvents.tenantId],
    references: [tenants.id]
  }),
  employee: one(employees, {
    fields: [payrollEvents.employeeId],
    references: [employees.id]
  }),
  payrollRun: one(payrollRuns, {
    fields: [payrollEvents.payrollRunId],
    references: [payrollRuns.id]
  }),
  createdByUser: one(users, {
    fields: [payrollEvents.createdBy],
    references: [users.id]
  }),
}));
