/**
 * Compliance Tracker Schema
 * Configurable tracker engine for HR compliance management
 *
 * Tables:
 * - compliance_tracker_types: Templates defining tracker structure (accidents, visits, certifications, disciplinary)
 * - compliance_trackers: Individual tracker records/dossiers
 * - compliance_action_items: Action plans linked to trackers
 * - compliance_tracker_comments: History/comments timeline
 */

import { pgTable, uuid, timestamp, text, jsonb, boolean, date, pgPolicy } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { tenantUser } from './roles';
import { uploadedDocuments } from './documents';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Field definition for dynamic forms
 */
export interface TrackerFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'datetime' | 'select' | 'multiselect' |
        'number' | 'employee' | 'multiemployee' | 'file' | 'checkbox' | 'location';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helpText?: string;
  section?: string;
  readOnly?: boolean;
  computed?: {
    type: 'add_hours' | 'add_business_days';
    sourceField: string;
    value: number;
  };
}

/**
 * Section grouping for forms
 */
export interface TrackerSectionDefinition {
  id: string;
  title: string;
  description?: string;
}

/**
 * Conditional workflow rules
 */
export interface TrackerRule {
  condition: {
    field: string;
    operator: 'equals' | 'not_equals';
    value: string;
  };
  action: 'skip_action_plan' | 'require_field';
  targetField?: string;
}

/**
 * Complete tracker type definition (stored as JSONB)
 */
export interface TrackerTypeDefinition {
  fields: TrackerFieldDefinition[];
  sections?: TrackerSectionDefinition[];
  rules?: TrackerRule[];
}

/**
 * Workflow status definition
 */
export interface WorkflowStatusDefinition {
  id: string;
  label: string;
  color: 'default' | 'info' | 'warning' | 'success' | 'destructive';
  isFinal?: boolean;
}

// ============================================================================
// TRACKER TYPES TABLE (Templates)
// ============================================================================

export const complianceTrackerTypes = pgTable('compliance_tracker_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Type identification
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  icon: text('icon'), // Lucide icon name

  // Schema definition
  definition: jsonb('definition').notNull().$type<TrackerTypeDefinition>(),
  workflowStatuses: jsonb('workflow_statuses').notNull().$type<WorkflowStatusDefinition[]>(),
  defaultAssigneeRole: text('default_assignee_role'), // 'hr_manager' | 'manager'

  // Reference number prefix (e.g., "ACC" for accidents → ACC-2025-001)
  referencePrefix: text('reference_prefix').notNull(),

  // System vs custom
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('compliance_tracker_types_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRACKERS TABLE (Dossiers)
// ============================================================================

export const complianceTrackers = pgTable('compliance_trackers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  trackerTypeId: uuid('tracker_type_id').notNull().references(() => complianceTrackerTypes.id, { onDelete: 'restrict' }),

  // Identification
  referenceNumber: text('reference_number').notNull(), // Auto-generated: ACC-2025-001
  title: text('title').notNull(),

  // Status & priority
  status: text('status').notNull().default('nouveau'),
  priority: text('priority').notNull().default('medium'), // low, medium, high, critical

  // Form data (matches type definition)
  data: jsonb('data').notNull().$type<Record<string, unknown>>(),

  // Assignment
  assigneeId: uuid('assignee_id').references(() => employees.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),

  // Related employee (e.g., accident victim, disciplinary subject)
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),

  // Closure
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => users.id),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('compliance_trackers_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// ACTION ITEMS TABLE (Plan d'actions)
// ============================================================================

export const complianceActionItems = pgTable('compliance_action_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  trackerId: uuid('tracker_id').notNull().references(() => complianceTrackers.id, { onDelete: 'cascade' }),

  // Action details
  title: text('title').notNull(),
  description: text('description'),

  // Status & priority
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, cancelled
  priority: text('priority').notNull().default('medium'), // low, medium, high, critical

  // Assignment
  assigneeId: uuid('assignee_id').references(() => employees.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),

  // Completion
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by').references(() => users.id),

  // Proof/evidence document
  proofDocumentId: uuid('proof_document_id').references(() => uploadedDocuments.id, { onDelete: 'set null' }),

  // Source reference (e.g., "recommendation_1", "audit_finding_3")
  source: text('source'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('compliance_action_items_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// COMMENTS TABLE (Historique/Suivi)
// ============================================================================

export const complianceTrackerComments = pgTable('compliance_tracker_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  trackerId: uuid('tracker_id').notNull().references(() => complianceTrackers.id, { onDelete: 'cascade' }),

  // Comment content
  content: text('content').notNull(),

  // Status change tracking
  isStatusChange: boolean('is_status_change').default(false).notNull(),
  oldStatus: text('old_status'),
  newStatus: text('new_status'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('compliance_tracker_comments_tenant_isolation', {
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

export type ComplianceTrackerType = typeof complianceTrackerTypes.$inferSelect;
export type NewComplianceTrackerType = typeof complianceTrackerTypes.$inferInsert;

export type ComplianceTracker = typeof complianceTrackers.$inferSelect;
export type NewComplianceTracker = typeof complianceTrackers.$inferInsert;

export type ComplianceActionItem = typeof complianceActionItems.$inferSelect;
export type NewComplianceActionItem = typeof complianceActionItems.$inferInsert;

export type ComplianceTrackerComment = typeof complianceTrackerComments.$inferSelect;
export type NewComplianceTrackerComment = typeof complianceTrackerComments.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const complianceTrackerTypesRelations = relations(complianceTrackerTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [complianceTrackerTypes.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [complianceTrackerTypes.createdBy],
    references: [users.id],
  }),
  trackers: many(complianceTrackers),
}));

export const complianceTrackersRelations = relations(complianceTrackers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [complianceTrackers.tenantId],
    references: [tenants.id],
  }),
  trackerType: one(complianceTrackerTypes, {
    fields: [complianceTrackers.trackerTypeId],
    references: [complianceTrackerTypes.id],
  }),
  assignee: one(employees, {
    fields: [complianceTrackers.assigneeId],
    references: [employees.id],
    relationName: 'compliance_trackers_assignee',
  }),
  employee: one(employees, {
    fields: [complianceTrackers.employeeId],
    references: [employees.id],
    relationName: 'compliance_trackers_employee',
  }),
  closedByUser: one(users, {
    fields: [complianceTrackers.closedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [complianceTrackers.createdBy],
    references: [users.id],
  }),
  actionItems: many(complianceActionItems),
  comments: many(complianceTrackerComments),
}));

export const complianceActionItemsRelations = relations(complianceActionItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [complianceActionItems.tenantId],
    references: [tenants.id],
  }),
  tracker: one(complianceTrackers, {
    fields: [complianceActionItems.trackerId],
    references: [complianceTrackers.id],
  }),
  assignee: one(employees, {
    fields: [complianceActionItems.assigneeId],
    references: [employees.id],
  }),
  completedByUser: one(users, {
    fields: [complianceActionItems.completedBy],
    references: [users.id],
  }),
  proofDocument: one(uploadedDocuments, {
    fields: [complianceActionItems.proofDocumentId],
    references: [uploadedDocuments.id],
  }),
  createdByUser: one(users, {
    fields: [complianceActionItems.createdBy],
    references: [users.id],
  }),
}));

export const complianceTrackerCommentsRelations = relations(complianceTrackerComments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [complianceTrackerComments.tenantId],
    references: [tenants.id],
  }),
  tracker: one(complianceTrackers, {
    fields: [complianceTrackerComments.trackerId],
    references: [complianceTrackers.id],
  }),
  createdByUser: one(users, {
    fields: [complianceTrackerComments.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const TrackerPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const TrackerPriorityLabels: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
};

export const ActionItemStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const ActionItemStatusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

// Pre-built tracker type slugs
export const TrackerTypeSlugs = {
  ACCIDENTS: 'accidents',
  VISITS: 'visites-reglementaires',
  CERTIFICATIONS: 'certifications',
  DISCIPLINARY: 'procedures-disciplinaires',
} as const;
