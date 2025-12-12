/**
 * HR Form Builder Schema
 * Dynamic form definitions and submissions for Performance Management and Training modules
 *
 * Tables:
 * - hr_form_templates: Form definitions with JSONB schemas
 * - hr_form_submissions: Completed form responses
 */

import { pgTable, uuid, timestamp, text, jsonb, boolean, integer, pgPolicy, numeric } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { tenantUser } from './roles';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Form field types
 */
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'rating'        // Star/scale rating
  | 'slider'        // Range slider
  | 'employee'      // Employee picker
  | 'multiemployee' // Multiple employee picker
  | 'file'          // File upload
  | 'rich_text'     // Rich text editor
  | 'computed'      // Auto-calculated
  | 'heading'       // Section header (display only)
  | 'paragraph';    // Paragraph text (display only)

/**
 * Rating scale configuration
 */
export interface RatingScaleConfig {
  type: 'numeric' | 'emoji' | 'stars' | 'custom';
  scale: 3 | 5 | 7 | 10;
  labels?: Record<number, string>; // e.g., { 1: 'Insuffisant', 5: 'Excellent' }
  colors?: Record<number, string>; // Custom colors per value
  lowLabel?: string;  // e.g., 'Pas du tout'
  highLabel?: string; // e.g., 'Parfaitement'
}

/**
 * Field condition for conditional logic
 */
export interface FormFieldCondition {
  field: string;          // Field ID to check
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
            'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' |
            'in' | 'not_in';
  value: unknown;
}

/**
 * Conditional rule for showing/hiding/requiring fields
 */
export interface FormConditionalRule {
  conditions: FormFieldCondition[];
  logic: 'AND' | 'OR';
  action: 'show' | 'hide' | 'require' | 'disable' | 'skip_to';
  targetField?: string;   // For 'skip_to' action
}

/**
 * Computed field configuration
 */
export interface ComputedFieldConfig {
  formula: 'sum' | 'average' | 'min' | 'max' | 'count' | 'weighted_average' | 'custom';
  sourceFields: string[];
  weights?: Record<string, number>; // For weighted_average
  customFormula?: string;           // For 'custom' formula type
  decimals?: number;
  suffix?: string;                  // e.g., '%', 'points'
}

/**
 * Slider field configuration
 */
export interface SliderFieldConfig {
  min: number;
  max: number;
  step: number;
  showValue?: boolean;
  unit?: string;
}

/**
 * Field option for select/radio/checkbox
 */
export interface FormFieldOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
}

/**
 * Complete field definition
 */
export interface FormFieldDefinition {
  id: string;
  type: FormFieldType;
  label: string;

  // Appearance
  placeholder?: string;
  helpText?: string;
  icon?: string;

  // Validation
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidation?: string;

  // Options (for select, radio, checkbox, multiselect)
  options?: FormFieldOption[];
  allowOther?: boolean;     // Allow "Other" option with free text

  // Rating config
  ratingConfig?: RatingScaleConfig;

  // Slider config
  sliderConfig?: SliderFieldConfig;

  // Computed config
  computedConfig?: ComputedFieldConfig;

  // Layout
  section?: string;
  order?: number;
  width?: 'full' | 'half' | 'third';

  // Conditional logic
  conditions?: FormConditionalRule[];

  // Display options
  readOnly?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
}

/**
 * Section definition for grouping fields
 */
export interface FormSectionDefinition {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  order: number;
  conditions?: FormConditionalRule[];
}

/**
 * Scoring configuration for evaluation forms
 */
export interface FormScoringConfig {
  enabled: boolean;
  method: 'sum' | 'average' | 'weighted' | 'custom';

  // Field weights (for weighted scoring)
  fieldWeights?: Record<string, number>;

  // Section weights
  sectionWeights?: Record<string, number>;

  // Scoring thresholds for categorization
  thresholds?: Array<{
    label: string;
    min: number;
    max: number;
    color: string;
  }>;

  // Custom scoring formula (optional)
  customFormula?: string;
}

/**
 * Computed scores from form submission
 */
export interface ComputedScores {
  byField: Record<string, number>;
  bySection: Record<string, number>;
  total: number;
  percentage: number;
  category?: string; // Based on thresholds
}

/**
 * Complete form definition (stored as JSONB)
 */
export interface FormDefinition {
  version: string; // Schema version for migration
  fields: FormFieldDefinition[];
  sections: FormSectionDefinition[];

  // Global rules
  globalConditions?: FormConditionalRule[];

  // Form behavior
  autoSave?: boolean;
  autoSaveInterval?: number; // seconds
  showProgress?: boolean;
  allowDraft?: boolean;

  // Completion config
  completionMessage?: string;
}

// ============================================================================
// FORM TEMPLATES TABLE
// ============================================================================

export const hrFormTemplates = pgTable('hr_form_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Identification
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),

  // Module association
  module: text('module').notNull(), // 'performance' | 'training' | 'shared'
  category: text('category').notNull(), // 'self_evaluation', 'manager_evaluation', '360_feedback', 'training_feedback', etc.

  // Form structure
  definition: jsonb('definition').notNull().$type<FormDefinition>(),

  // Scoring configuration
  scoringEnabled: boolean('scoring_enabled').default(false),
  scoringConfig: jsonb('scoring_config').$type<FormScoringConfig>(),

  // Default rating scale (can be overridden per field)
  defaultRatingScale: jsonb('default_rating_scale').$type<RatingScaleConfig>(),

  // Versioning
  version: integer('version').notNull().default(1),
  parentId: uuid('parent_id'), // For versioned templates

  // System vs custom
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Targeting (smart defaults)
  countryCode: text('country_code'),
  targetDepartments: jsonb('target_departments').$type<string[]>(),
  targetPositions: jsonb('target_positions').$type<string[]>(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('hr_form_templates_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin' OR ${table.isSystem} = true`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// FORM SUBMISSIONS TABLE
// ============================================================================

export const hrFormSubmissions = pgTable('hr_form_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => hrFormTemplates.id, { onDelete: 'restrict' }),

  // Polymorphic source (what triggered this form)
  sourceType: text('source_type').notNull(), // 'performance_evaluation' | 'training_session' | 'workflow_step' | 'competency_assessment'
  sourceId: uuid('source_id').notNull(),

  // Respondent (who filled the form)
  respondentEmployeeId: uuid('respondent_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  respondentUserId: uuid('respondent_user_id').references(() => users.id, { onDelete: 'set null' }),
  respondentRole: text('respondent_role'), // 'employee' | 'manager' | 'peer' | 'hr_manager'

  // Subject (who is being evaluated - may be same as respondent for self-evaluation)
  subjectEmployeeId: uuid('subject_employee_id').references(() => employees.id, { onDelete: 'set null' }),

  // Response data (matches form definition)
  data: jsonb('data').notNull().$type<Record<string, unknown>>(),

  // Computed scores (if scoring enabled)
  scores: jsonb('scores').$type<ComputedScores>(),
  totalScore: numeric('total_score', { precision: 10, scale: 2 }),
  maxPossibleScore: numeric('max_possible_score', { precision: 10, scale: 2 }),

  // Status
  status: text('status').notNull().default('draft'), // draft, submitted, reviewed

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  lastSavedAt: timestamp('last_saved_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('hr_form_submissions_tenant_isolation', {
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

export type HrFormTemplate = typeof hrFormTemplates.$inferSelect;
export type NewHrFormTemplate = typeof hrFormTemplates.$inferInsert;

export type HrFormSubmission = typeof hrFormSubmissions.$inferSelect;
export type NewHrFormSubmission = typeof hrFormSubmissions.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const hrFormTemplatesRelations = relations(hrFormTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [hrFormTemplates.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [hrFormTemplates.createdBy],
    references: [users.id],
  }),
  submissions: many(hrFormSubmissions),
}));

export const hrFormSubmissionsRelations = relations(hrFormSubmissions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [hrFormSubmissions.tenantId],
    references: [tenants.id],
  }),
  template: one(hrFormTemplates, {
    fields: [hrFormSubmissions.templateId],
    references: [hrFormTemplates.id],
  }),
  respondentEmployee: one(employees, {
    fields: [hrFormSubmissions.respondentEmployeeId],
    references: [employees.id],
    relationName: 'hr_form_submissions_respondent',
  }),
  respondentUser: one(users, {
    fields: [hrFormSubmissions.respondentUserId],
    references: [users.id],
  }),
  subjectEmployee: one(employees, {
    fields: [hrFormSubmissions.subjectEmployeeId],
    references: [employees.id],
    relationName: 'hr_form_submissions_subject',
  }),
}));

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const FormSubmissionStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
} as const;

export const FormSubmissionStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  reviewed: 'Revu',
};

export const FormModule = {
  PERFORMANCE: 'performance',
  TRAINING: 'training',
  SHARED: 'shared',
} as const;

export const FormCategory = {
  // Performance
  SELF_EVALUATION: 'self_evaluation',
  MANAGER_EVALUATION: 'manager_evaluation',
  PEER_FEEDBACK: 'peer_feedback',
  FEEDBACK_360: '360_feedback',
  OBJECTIVE_REVIEW: 'objective_review',
  // Training
  TRAINING_FEEDBACK: 'training_feedback',
  TRAINING_EVALUATION: 'training_evaluation',
  COMPETENCY_ASSESSMENT: 'competency_assessment',
  SKILL_ASSESSMENT: 'skill_assessment',
} as const;

/**
 * Default rating scale (French labels, 5-point)
 */
export const DefaultRatingScale: RatingScaleConfig = {
  type: 'numeric',
  scale: 5,
  labels: {
    1: 'Insuffisant',
    2: 'A améliorer',
    3: 'Satisfaisant',
    4: 'Très bien',
    5: 'Excellent',
  },
  lowLabel: 'Insuffisant',
  highLabel: 'Excellent',
};

/**
 * Corporate rating scale (for large companies)
 */
export const CorporateRatingScale: RatingScaleConfig = {
  type: 'numeric',
  scale: 5,
  labels: {
    1: 'Nécessite amélioration significative',
    2: 'Nécessite amélioration',
    3: 'Répond aux attentes',
    4: 'Dépasse les attentes',
    5: 'Performance exceptionnelle',
  },
  lowLabel: 'En dessous des attentes',
  highLabel: 'Exceptionnel',
};

/**
 * Simple rating scale (for small companies)
 */
export const SimpleRatingScale: RatingScaleConfig = {
  type: 'stars',
  scale: 5,
  labels: {
    1: '1 étoile',
    2: '2 étoiles',
    3: '3 étoiles',
    4: '4 étoiles',
    5: '5 étoiles',
  },
};
