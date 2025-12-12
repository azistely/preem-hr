/**
 * HR Workflow Engine Schema
 * Abstract workflow system for Performance Management and Training modules
 *
 * Tables:
 * - hr_workflow_definitions: Workflow templates (annual review, training request, etc.)
 * - hr_workflow_instances: Running workflow executions
 * - hr_workflow_step_instances: Individual step executions
 */

import { pgTable, uuid, timestamp, text, jsonb, boolean, integer, date, pgPolicy } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { tenantUser } from './roles';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Step types for workflow definition
 */
export type WorkflowStepType =
  | 'form'           // Fill out a form
  | 'approval'       // Approve/reject decision
  | 'review'         // Review without approval (acknowledge)
  | 'notification'   // Send notification only
  | 'wait'           // Wait for duration/condition
  | 'parallel'       // Execute multiple steps in parallel
  | 'conditional';   // Branch based on condition

/**
 * Assignment roles for workflow steps
 */
export type WorkflowAssignmentRole =
  | 'employee'       // The subject employee
  | 'manager'        // Direct manager
  | 'skip_level_manager' // Manager's manager
  | 'hr_manager'     // HR Manager
  | 'hr_admin'       // HR Admin / Tenant Admin
  | 'peer'           // Colleague (360 feedback)
  | 'custom';        // Custom assignee

/**
 * Transition triggers
 */
export type WorkflowTransitionTrigger =
  | 'manual'         // User action
  | 'form_submitted' // Form completed
  | 'approved'       // Approval received
  | 'rejected'       // Rejection received
  | 'due_date_reached' // Due date passed
  | 'condition_met'  // Condition evaluated true
  | 'all_parallel_complete' // All parallel steps done
  | 'escalation'     // Escalation triggered
  | 'timeout';       // Step timed out

/**
 * Workflow condition definition
 */
export interface WorkflowCondition {
  type: 'field_check' | 'role_check' | 'score_check' | 'date_check' | 'custom';
  field?: string;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value?: unknown;
  scoreField?: string;
  scoreThreshold?: number;
  dateField?: string;
  dateComparison?: 'before' | 'after' | 'on';
  customExpression?: string;
}

/**
 * Workflow step definition
 */
export interface WorkflowStepDefinition {
  id: string;
  type: WorkflowStepType;
  name: string;
  description?: string;

  // Assignment
  assignmentRole: WorkflowAssignmentRole;
  customAssigneeField?: string;

  // Form step config
  formTemplateId?: string;
  formTemplateSlug?: string;

  // Approval step config
  approvalConfig?: {
    requireComment?: boolean;
    allowDelegation?: boolean;
    escalateAfterDays?: number;
    escalateTo?: WorkflowAssignmentRole;
  };

  // Wait step config
  waitConfig?: {
    type: 'duration' | 'date' | 'condition';
    durationDays?: number;
    dateField?: string;
    condition?: WorkflowCondition;
  };

  // Parallel step config
  parallelSteps?: WorkflowStepDefinition[];
  parallelCompletion?: 'all' | 'any' | 'majority';

  // Conditional step config
  conditionalConfig?: {
    condition: WorkflowCondition;
    trueStepId?: string;
    falseStepId?: string;
  };

  // Timing
  defaultDurationDays?: number;
  isOptional?: boolean;
  canSkip?: boolean;

  // Notifications
  notifyOnAssignment?: boolean;
  notifyOnDue?: boolean;
  notifyOnOverdue?: boolean;

  // UI hints
  icon?: string;
  color?: string;
}

/**
 * Workflow transition definition
 */
export interface WorkflowTransitionDefinition {
  id: string;
  fromStepId: string;      // '*' for global transition
  toStepId: string;        // 'END' for completion

  trigger: WorkflowTransitionTrigger;

  // Conditions
  conditions?: WorkflowCondition[];
  conditionLogic?: 'AND' | 'OR';

  // Label for manual transitions
  label?: string;
  buttonVariant?: 'default' | 'primary' | 'destructive';
}

/**
 * Reminder schedule configuration
 */
export interface ReminderScheduleConfig {
  enabled: boolean;
  firstReminderDays: number;     // Days before due date
  repeatIntervalDays?: number;   // Repeat every N days
  maxReminders?: number;
  channels: ('email' | 'in_app' | 'push')[];
}

/**
 * Escalation rule configuration
 */
export interface EscalationRuleConfig {
  triggerDaysOverdue: number;
  escalateTo: WorkflowAssignmentRole;
  notifyOriginal: boolean;
  autoReassign: boolean;
  maxEscalations?: number;
}

// ============================================================================
// WORKFLOW DEFINITIONS TABLE (Templates)
// ============================================================================

export const hrWorkflowDefinitions = pgTable('hr_workflow_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Identification
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  icon: text('icon'), // Lucide icon name

  // Module association
  module: text('module').notNull(), // 'performance' | 'training' | 'shared'
  category: text('category'), // 'annual_review', 'quarterly_review', 'peer_feedback', 'training_request', etc.

  // Workflow configuration
  steps: jsonb('steps').notNull().$type<WorkflowStepDefinition[]>(),
  transitions: jsonb('transitions').notNull().$type<WorkflowTransitionDefinition[]>(),

  // Smart defaults configuration
  defaultDurations: jsonb('default_durations').$type<Record<string, number>>(), // stepId -> days
  reminderSchedule: jsonb('reminder_schedule').$type<ReminderScheduleConfig>(),
  escalationRules: jsonb('escalation_rules').$type<EscalationRuleConfig[]>(),

  // Versioning
  version: integer('version').notNull().default(1),
  parentId: uuid('parent_id'), // For versioned templates (self-reference handled in relations)

  // System vs custom
  isSystem: boolean('is_system').default(false).notNull(),
  isTemplate: boolean('is_template').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Targeting (smart defaults)
  countryCode: text('country_code'), // null = all countries
  tenantSizeMin: integer('tenant_size_min'), // Minimum employee count
  tenantSizeMax: integer('tenant_size_max'), // Maximum employee count

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('hr_workflow_definitions_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin' OR ${table.isSystem} = true`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// WORKFLOW INSTANCES TABLE (Running Workflows)
// ============================================================================

export const hrWorkflowInstances = pgTable('hr_workflow_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  definitionId: uuid('definition_id').notNull().references(() => hrWorkflowDefinitions.id, { onDelete: 'restrict' }),

  // Reference number (auto-generated)
  referenceNumber: text('reference_number').notNull(),

  // Subject (employee being reviewed/trained)
  subjectEmployeeId: uuid('subject_employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Polymorphic link to module-specific record
  sourceType: text('source_type').notNull(), // 'performance_cycle' | 'evaluation' | 'training_session' | 'training_request'
  sourceId: uuid('source_id').notNull(),

  // State
  status: text('status').notNull().default('pending'), // pending, in_progress, awaiting_approval, completed, cancelled, expired
  currentStepId: text('current_step_id'),
  completedStepIds: jsonb('completed_step_ids').$type<string[]>().default([]),

  // Context data (carries across steps)
  contextData: jsonb('context_data').$type<Record<string, unknown>>().default({}),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('hr_workflow_instances_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// WORKFLOW STEP INSTANCES TABLE (Step Execution)
// ============================================================================

export const hrWorkflowStepInstances = pgTable('hr_workflow_step_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  instanceId: uuid('instance_id').notNull().references(() => hrWorkflowInstances.id, { onDelete: 'cascade' }),

  // Step reference
  stepId: text('step_id').notNull(), // References step in definition
  stepOrder: integer('step_order').notNull(),

  // Assignment
  assigneeRole: text('assignee_role').notNull(), // 'employee' | 'manager' | 'hr_manager' | 'peer'
  assigneeEmployeeId: uuid('assignee_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),

  // State
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, skipped, expired

  // Form submission reference (if step has form)
  formSubmissionId: uuid('form_submission_id'), // References hr_form_submissions.id

  // Step data (outcome, scores, etc.)
  stepData: jsonb('step_data').$type<Record<string, unknown>>().default({}),

  // Approval result (if approval step)
  approvalStatus: text('approval_status'), // approved, rejected, null
  approvalComment: text('approval_comment'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  // Timing
  dueDate: date('due_date'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Reminders sent
  remindersSent: integer('reminders_sent').default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),

  // Escalation tracking
  isEscalated: boolean('is_escalated').default(false),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  escalatedToEmployeeId: uuid('escalated_to_employee_id').references(() => employees.id, { onDelete: 'set null' }),

  // Step configuration (cached from definition for performance)
  stepConfig: jsonb('step_config').$type<Record<string, unknown>>(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('hr_workflow_step_instances_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type HrWorkflowDefinition = typeof hrWorkflowDefinitions.$inferSelect;
export type NewHrWorkflowDefinition = typeof hrWorkflowDefinitions.$inferInsert;

export type HrWorkflowInstance = typeof hrWorkflowInstances.$inferSelect;
export type NewHrWorkflowInstance = typeof hrWorkflowInstances.$inferInsert;

export type HrWorkflowStepInstance = typeof hrWorkflowStepInstances.$inferSelect;
export type NewHrWorkflowStepInstance = typeof hrWorkflowStepInstances.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const hrWorkflowDefinitionsRelations = relations(hrWorkflowDefinitions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [hrWorkflowDefinitions.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [hrWorkflowDefinitions.createdBy],
    references: [users.id],
  }),
  instances: many(hrWorkflowInstances),
}));

export const hrWorkflowInstancesRelations = relations(hrWorkflowInstances, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [hrWorkflowInstances.tenantId],
    references: [tenants.id],
  }),
  definition: one(hrWorkflowDefinitions, {
    fields: [hrWorkflowInstances.definitionId],
    references: [hrWorkflowDefinitions.id],
  }),
  subjectEmployee: one(employees, {
    fields: [hrWorkflowInstances.subjectEmployeeId],
    references: [employees.id],
  }),
  createdByUser: one(users, {
    fields: [hrWorkflowInstances.createdBy],
    references: [users.id],
  }),
  stepInstances: many(hrWorkflowStepInstances),
}));

export const hrWorkflowStepInstancesRelations = relations(hrWorkflowStepInstances, ({ one }) => ({
  tenant: one(tenants, {
    fields: [hrWorkflowStepInstances.tenantId],
    references: [tenants.id],
  }),
  instance: one(hrWorkflowInstances, {
    fields: [hrWorkflowStepInstances.instanceId],
    references: [hrWorkflowInstances.id],
  }),
  assigneeEmployee: one(employees, {
    fields: [hrWorkflowStepInstances.assigneeEmployeeId],
    references: [employees.id],
    relationName: 'stepAssignee',
  }),
  assigneeUser: one(users, {
    fields: [hrWorkflowStepInstances.assigneeUserId],
    references: [users.id],
    relationName: 'stepAssigneeUser',
  }),
  approvedByUser: one(users, {
    fields: [hrWorkflowStepInstances.approvedBy],
    references: [users.id],
    relationName: 'stepApprover',
  }),
  escalatedToEmployee: one(employees, {
    fields: [hrWorkflowStepInstances.escalatedToEmployeeId],
    references: [employees.id],
    relationName: 'stepEscalatedTo',
  }),
}));

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const WorkflowStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const WorkflowStatusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  awaiting_approval: 'En attente d\'approbation',
  completed: 'Terminé',
  cancelled: 'Annulé',
  expired: 'Expiré',
};

export const StepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  EXPIRED: 'expired',
} as const;

export const StepStatusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  skipped: 'Ignoré',
  expired: 'Expiré',
};

export const WorkflowModule = {
  PERFORMANCE: 'performance',
  TRAINING: 'training',
  SHARED: 'shared',
} as const;

export const WorkflowCategory = {
  // Performance
  ANNUAL_REVIEW: 'annual_review',
  QUARTERLY_REVIEW: 'quarterly_review',
  PEER_FEEDBACK: 'peer_feedback',
  SELF_ASSESSMENT: 'self_assessment',
  OBJECTIVE_SETTING: 'objective_setting',
  // Training
  TRAINING_REQUEST: 'training_request',
  TRAINING_COMPLETION: 'training_completion',
  CERTIFICATION_RENEWAL: 'certification_renewal',
  COMPETENCY_ASSESSMENT: 'competency_assessment',
} as const;
