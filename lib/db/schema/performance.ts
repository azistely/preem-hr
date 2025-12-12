/**
 * Performance Management Schema
 * Complete performance management system for evaluations, objectives, feedback, and calibration
 *
 * Tables:
 * - performance_cycles: Evaluation periods (annual, quarterly, etc.)
 * - objectives: Individual/team/company objectives
 * - evaluations: Evaluation submissions
 * - competency_ratings: Per-competency ratings within evaluations
 * - continuous_feedback: Ad-hoc feedback/recognition
 * - one_on_one_meetings: 1:1 meeting tracking
 * - calibration_sessions: Large company calibration (9-box)
 * - calibration_ratings: Calibrated ratings
 */

import { pgTable, uuid, timestamp, text, jsonb, boolean, date, integer, numeric, pgPolicy } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { departments } from './departments';
import { tenantUser } from './roles';
import { hrFormTemplates } from './hr-forms';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Objective type
 */
export type ObjectiveType = 'quantitative' | 'qualitative' | 'behavioral' | 'project';

/**
 * Objective level (for cascade)
 */
export type ObjectiveLevel = 'company' | 'team' | 'individual';

/**
 * Evaluation type
 */
export type EvaluationType = 'self' | 'manager' | 'peer' | '360_report';

/**
 * Performance cycle status
 */
export type PerformanceCycleStatus = 'planning' | 'objective_setting' | 'active' | 'calibration' | 'closed';

/**
 * Company size profile for smart defaults
 */
export type CompanySizeProfile = 'small' | 'medium' | 'large';

// ============================================================================
// PERFORMANCE CYCLES TABLE
// ============================================================================

export const performanceCycles = pgTable('performance_cycles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Cycle identification
  name: text('name').notNull(), // "Evaluation Annuelle 2025"
  description: text('description'),
  cycleType: text('cycle_type').notNull().default('annual'), // annual, semi_annual, quarterly

  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  // Workflow phases (configurable deadlines)
  objectiveSettingDeadline: date('objective_setting_deadline'),
  selfEvaluationDeadline: date('self_evaluation_deadline'),
  managerEvaluationDeadline: date('manager_evaluation_deadline'),
  calibrationDeadline: date('calibration_deadline'),
  resultsReleaseDate: date('results_release_date'),

  // Template reference
  evaluationTemplateId: uuid('evaluation_template_id').references(() => hrFormTemplates.id, { onDelete: 'set null' }),

  // Status
  status: text('status').notNull().default('planning'), // planning, objective_setting, active, calibration, closed

  // Configuration flags (smart defaults based on company size)
  includeObjectives: boolean('include_objectives').notNull().default(true),
  includeSelfEvaluation: boolean('include_self_evaluation').notNull().default(true),
  includeManagerEvaluation: boolean('include_manager_evaluation').notNull().default(true),
  includePeerFeedback: boolean('include_peer_feedback').notNull().default(false),
  include360Feedback: boolean('include_360_feedback').notNull().default(false),
  includeCalibration: boolean('include_calibration').notNull().default(false),

  // Company size optimization
  companySizeProfile: text('company_size_profile').default('medium'), // small, medium, large

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('performance_cycles_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// COMPETENCIES TABLE (Catalog)
// ============================================================================

export const competencies = pgTable('competencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Competency identification
  code: text('code').notNull(), // "COMP-LEAD-001"
  name: text('name').notNull(), // "Leadership d'équipe"
  description: text('description'),

  // Category
  category: text('category').notNull(), // 'technique', 'comportemental', 'leadership', 'metier'

  // Proficiency levels definition (1-5 with descriptions)
  proficiencyLevels: jsonb('proficiency_levels').notNull().$type<Array<{
    level: number;
    name: string;
    description: string;
    behaviors?: string[];
  }>>(),

  // Whether this competency is core to the organization
  isCore: boolean('is_core').default(false),

  // Display order
  displayOrder: integer('display_order').default(0).notNull(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('competencies_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// JOB ROLE COMPETENCIES TABLE (Mapping)
// ============================================================================

export const jobRoleCompetencies = pgTable('job_role_competencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Role identification (can be jobTitle or departmentId)
  jobTitle: text('job_title'),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),

  // Competency mapping
  competencyId: uuid('competency_id').notNull().references(() => competencies.id, { onDelete: 'cascade' }),
  requiredLevel: integer('required_level').notNull().default(3), // Expected proficiency (1-5)
  isCritical: boolean('is_critical').default(false).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('job_role_competencies_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// OBJECTIVES TABLE
// ============================================================================

export const objectives = pgTable('objectives', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  cycleId: uuid('cycle_id').notNull().references(() => performanceCycles.id, { onDelete: 'cascade' }),

  // Ownership
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }), // NULL for company/team objectives
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),

  // Objective details
  title: text('title').notNull(),
  description: text('description'),
  objectiveType: text('objective_type').notNull().default('qualitative'), // quantitative, qualitative, behavioral, project
  objectiveLevel: text('objective_level').notNull().default('individual'), // company, team, individual

  // Cascade/alignment
  parentObjectiveId: uuid('parent_objective_id'), // For objective cascade (self-reference)

  // KPI definition (for quantitative)
  targetValue: numeric('target_value', { precision: 15, scale: 2 }),
  targetUnit: text('target_unit'), // "%", "FCFA", "units"
  currentValue: numeric('current_value', { precision: 15, scale: 2 }),

  // Weighting
  weight: numeric('weight', { precision: 5, scale: 2 }).default('1.0'), // Objective weight for scoring

  // Status workflow
  status: text('status').notNull().default('draft'), // draft, proposed, approved, in_progress, completed, cancelled

  // Dates
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Achievement
  achievementScore: numeric('achievement_score', { precision: 5, scale: 2 }), // 0-100 or rating scale
  achievementNotes: text('achievement_notes'),

  // Approval workflow
  proposedBy: uuid('proposed_by').references(() => users.id),
  proposedAt: timestamp('proposed_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('objectives_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// EVALUATIONS TABLE
// ============================================================================

export const evaluations = pgTable('evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  cycleId: uuid('cycle_id').notNull().references(() => performanceCycles.id, { onDelete: 'cascade' }),

  // Subject (who is being evaluated)
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Evaluator (who is evaluating)
  evaluatorId: uuid('evaluator_id').references(() => employees.id, { onDelete: 'set null' }), // NULL for self-evaluation
  evaluationType: text('evaluation_type').notNull().default('self'), // self, manager, peer, 360_report

  // Form submission reference
  formSubmissionId: uuid('form_submission_id'), // References hr_form_submissions.id

  // Status
  status: text('status').notNull().default('pending'), // pending, in_progress, submitted, validated, shared

  // Form responses (dynamic, matches template) - stored here for quick access
  responses: jsonb('responses').notNull().default({}).$type<Record<string, unknown>>(),

  // Scores
  objectivesScore: numeric('objectives_score', { precision: 5, scale: 2 }), // Average objective achievement
  competenciesScore: numeric('competencies_score', { precision: 5, scale: 2 }), // Average competency rating
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }), // Weighted overall
  overallRating: text('overall_rating'), // "exceeds", "meets", "below", etc.

  // Comments
  strengthsComment: text('strengths_comment'),
  improvementAreasComment: text('improvement_areas_comment'),
  developmentPlanComment: text('development_plan_comment'),
  generalComment: text('general_comment'),

  // Workflow
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  validatedBy: uuid('validated_by').references(() => users.id),
  sharedAt: timestamp('shared_at', { withTimezone: true }),

  // Employee acknowledgment
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  employeeComment: text('employee_comment'), // Employee's response/comments

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('evaluations_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// COMPETENCY RATINGS TABLE (Evaluation Details)
// ============================================================================

export const competencyRatings = pgTable('competency_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),

  // Competency being rated
  competencyId: uuid('competency_id').notNull().references(() => competencies.id, { onDelete: 'cascade' }),

  // Rating
  rating: integer('rating').notNull(), // 1-5 typically
  comment: text('comment'),

  // Expected vs actual (for gap analysis)
  expectedLevel: integer('expected_level'), // From job role mapping

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('competency_ratings_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// CONTINUOUS FEEDBACK TABLE
// ============================================================================

export const continuousFeedback = pgTable('continuous_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Recipient
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Giver
  givenBy: uuid('given_by').notNull().references(() => users.id),

  // Feedback type
  feedbackType: text('feedback_type').notNull().default('recognition'), // recognition, constructive, coaching

  // Content
  title: text('title'),
  content: text('content').notNull(),

  // Visibility
  isPrivate: boolean('is_private').default(false).notNull(), // Only visible to recipient + HR
  isAnonymous: boolean('is_anonymous').default(false).notNull(), // Hide giver identity

  // Linked to cycle (optional)
  cycleId: uuid('cycle_id').references(() => performanceCycles.id, { onDelete: 'set null' }),

  // Tags/categories
  tags: jsonb('tags').default([]).$type<string[]>(),

  // Acknowledgment
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('continuous_feedback_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// ONE-ON-ONE MEETINGS TABLE
// ============================================================================

export const oneOnOneMeetings = pgTable('one_on_one_meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Participants
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  managerId: uuid('manager_id').notNull().references(() => employees.id),

  // Meeting details
  meetingDate: date('meeting_date').notNull(),
  duration: integer('duration'), // Minutes

  // Agenda & Notes
  agendaItems: jsonb('agenda_items').default([]).$type<Array<{ topic: string; completed: boolean }>>(),
  notes: text('notes'),

  // Action items
  actionItems: jsonb('action_items').default([]).$type<Array<{
    description: string;
    assignee: 'employee' | 'manager';
    dueDate?: string;
    completed: boolean;
  }>>(),

  // Status
  status: text('status').notNull().default('scheduled'), // scheduled, completed, cancelled

  // Linked cycle (optional)
  cycleId: uuid('cycle_id').references(() => performanceCycles.id, { onDelete: 'set null' }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('one_on_one_meetings_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// CALIBRATION SESSIONS TABLE (Large Companies)
// ============================================================================

export const calibrationSessions = pgTable('calibration_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  cycleId: uuid('cycle_id').notNull().references(() => performanceCycles.id, { onDelete: 'cascade' }),

  // Session details
  name: text('name').notNull(),
  description: text('description'),
  sessionDate: date('session_date'),

  // Scope (which employees/departments)
  scope: jsonb('scope').default({}).$type<{
    departmentIds?: string[];
    employeeIds?: string[];
  }>(),

  // Status
  status: text('status').notNull().default('scheduled'), // scheduled, in_progress, completed

  // Results summary
  resultsSummary: jsonb('results_summary').default({}).$type<{
    totalEmployees: number;
    ratingDistribution: Record<string, number>;
    adjustments: number;
  }>(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('calibration_sessions_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// CALIBRATION RATINGS TABLE
// ============================================================================

export const calibrationRatings = pgTable('calibration_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  calibrationSessionId: uuid('calibration_session_id').notNull().references(() => calibrationSessions.id, { onDelete: 'cascade' }),
  evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),

  // Original vs calibrated
  originalRating: text('original_rating').notNull(),
  calibratedRating: text('calibrated_rating'),

  // 9-box position
  performanceAxis: integer('performance_axis'), // 1-3
  potentialAxis: integer('potential_axis'), // 1-3

  // Justification
  justification: text('justification'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  calibratedBy: uuid('calibrated_by').references(() => users.id),
}, (table) => [
  pgPolicy('calibration_ratings_tenant_isolation', {
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

export type PerformanceCycle = typeof performanceCycles.$inferSelect;
export type NewPerformanceCycle = typeof performanceCycles.$inferInsert;

export type Competency = typeof competencies.$inferSelect;
export type NewCompetency = typeof competencies.$inferInsert;

export type JobRoleCompetency = typeof jobRoleCompetencies.$inferSelect;
export type NewJobRoleCompetency = typeof jobRoleCompetencies.$inferInsert;

export type Objective = typeof objectives.$inferSelect;
export type NewObjective = typeof objectives.$inferInsert;

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;

export type CompetencyRating = typeof competencyRatings.$inferSelect;
export type NewCompetencyRating = typeof competencyRatings.$inferInsert;

export type ContinuousFeedback = typeof continuousFeedback.$inferSelect;
export type NewContinuousFeedback = typeof continuousFeedback.$inferInsert;

export type OneOnOneMeeting = typeof oneOnOneMeetings.$inferSelect;
export type NewOneOnOneMeeting = typeof oneOnOneMeetings.$inferInsert;

export type CalibrationSession = typeof calibrationSessions.$inferSelect;
export type NewCalibrationSession = typeof calibrationSessions.$inferInsert;

export type CalibrationRating = typeof calibrationRatings.$inferSelect;
export type NewCalibrationRating = typeof calibrationRatings.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const performanceCyclesRelations = relations(performanceCycles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [performanceCycles.tenantId],
    references: [tenants.id],
  }),
  evaluationTemplate: one(hrFormTemplates, {
    fields: [performanceCycles.evaluationTemplateId],
    references: [hrFormTemplates.id],
  }),
  createdByUser: one(users, {
    fields: [performanceCycles.createdBy],
    references: [users.id],
  }),
  objectives: many(objectives),
  evaluations: many(evaluations),
  calibrationSessions: many(calibrationSessions),
}));

export const competenciesRelations = relations(competencies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [competencies.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [competencies.createdBy],
    references: [users.id],
  }),
  jobRoleCompetencies: many(jobRoleCompetencies),
  ratings: many(competencyRatings),
}));

export const jobRoleCompetenciesRelations = relations(jobRoleCompetencies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [jobRoleCompetencies.tenantId],
    references: [tenants.id],
  }),
  competency: one(competencies, {
    fields: [jobRoleCompetencies.competencyId],
    references: [competencies.id],
  }),
  department: one(departments, {
    fields: [jobRoleCompetencies.departmentId],
    references: [departments.id],
  }),
  createdByUser: one(users, {
    fields: [jobRoleCompetencies.createdBy],
    references: [users.id],
  }),
}));

export const objectivesRelations = relations(objectives, ({ one }) => ({
  tenant: one(tenants, {
    fields: [objectives.tenantId],
    references: [tenants.id],
  }),
  cycle: one(performanceCycles, {
    fields: [objectives.cycleId],
    references: [performanceCycles.id],
  }),
  employee: one(employees, {
    fields: [objectives.employeeId],
    references: [employees.id],
  }),
  department: one(departments, {
    fields: [objectives.departmentId],
    references: [departments.id],
  }),
  proposedByUser: one(users, {
    fields: [objectives.proposedBy],
    references: [users.id],
    relationName: 'objectives_proposed_by',
  }),
  approvedByUser: one(users, {
    fields: [objectives.approvedBy],
    references: [users.id],
    relationName: 'objectives_approved_by',
  }),
  createdByUser: one(users, {
    fields: [objectives.createdBy],
    references: [users.id],
    relationName: 'objectives_created_by',
  }),
}));

export const evaluationsRelations = relations(evaluations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [evaluations.tenantId],
    references: [tenants.id],
  }),
  cycle: one(performanceCycles, {
    fields: [evaluations.cycleId],
    references: [performanceCycles.id],
  }),
  employee: one(employees, {
    fields: [evaluations.employeeId],
    references: [employees.id],
    relationName: 'evaluations_employee',
  }),
  evaluator: one(employees, {
    fields: [evaluations.evaluatorId],
    references: [employees.id],
    relationName: 'evaluations_evaluator',
  }),
  validatedByUser: one(users, {
    fields: [evaluations.validatedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [evaluations.createdBy],
    references: [users.id],
  }),
  competencyRatings: many(competencyRatings),
  calibrationRatings: many(calibrationRatings),
}));

export const competencyRatingsRelations = relations(competencyRatings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [competencyRatings.tenantId],
    references: [tenants.id],
  }),
  evaluation: one(evaluations, {
    fields: [competencyRatings.evaluationId],
    references: [evaluations.id],
  }),
  competency: one(competencies, {
    fields: [competencyRatings.competencyId],
    references: [competencies.id],
  }),
}));

export const continuousFeedbackRelations = relations(continuousFeedback, ({ one }) => ({
  tenant: one(tenants, {
    fields: [continuousFeedback.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [continuousFeedback.employeeId],
    references: [employees.id],
  }),
  givenByUser: one(users, {
    fields: [continuousFeedback.givenBy],
    references: [users.id],
  }),
  cycle: one(performanceCycles, {
    fields: [continuousFeedback.cycleId],
    references: [performanceCycles.id],
  }),
}));

export const oneOnOneMeetingsRelations = relations(oneOnOneMeetings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [oneOnOneMeetings.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [oneOnOneMeetings.employeeId],
    references: [employees.id],
    relationName: 'one_on_one_meetings_employee',
  }),
  manager: one(employees, {
    fields: [oneOnOneMeetings.managerId],
    references: [employees.id],
    relationName: 'one_on_one_meetings_manager',
  }),
  cycle: one(performanceCycles, {
    fields: [oneOnOneMeetings.cycleId],
    references: [performanceCycles.id],
  }),
}));

export const calibrationSessionsRelations = relations(calibrationSessions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [calibrationSessions.tenantId],
    references: [tenants.id],
  }),
  cycle: one(performanceCycles, {
    fields: [calibrationSessions.cycleId],
    references: [performanceCycles.id],
  }),
  createdByUser: one(users, {
    fields: [calibrationSessions.createdBy],
    references: [users.id],
  }),
  ratings: many(calibrationRatings),
}));

export const calibrationRatingsRelations = relations(calibrationRatings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calibrationRatings.tenantId],
    references: [tenants.id],
  }),
  session: one(calibrationSessions, {
    fields: [calibrationRatings.calibrationSessionId],
    references: [calibrationSessions.id],
  }),
  evaluation: one(evaluations, {
    fields: [calibrationRatings.evaluationId],
    references: [evaluations.id],
  }),
  calibratedByUser: one(users, {
    fields: [calibrationRatings.calibratedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const PerformanceCycleStatus = {
  PLANNING: 'planning',
  OBJECTIVE_SETTING: 'objective_setting',
  ACTIVE: 'active',
  CALIBRATION: 'calibration',
  CLOSED: 'closed',
} as const;

export const PerformanceCycleStatusLabels: Record<string, string> = {
  planning: 'Planification',
  objective_setting: 'Définition des objectifs',
  active: 'En cours',
  calibration: 'Calibration',
  closed: 'Clôturé',
};

export const CycleType = {
  ANNUAL: 'annual',
  SEMI_ANNUAL: 'semi_annual',
  QUARTERLY: 'quarterly',
} as const;

export const CycleTypeLabels: Record<string, string> = {
  annual: 'Annuel',
  semi_annual: 'Semestriel',
  quarterly: 'Trimestriel',
};

export const ObjectiveStatus = {
  DRAFT: 'draft',
  PROPOSED: 'proposed',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const ObjectiveStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  proposed: 'Proposé',
  approved: 'Approuvé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const EvaluationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  VALIDATED: 'validated',
  SHARED: 'shared',
} as const;

export const EvaluationStatusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  shared: 'Partagé',
};

export const FeedbackType = {
  RECOGNITION: 'recognition',
  CONSTRUCTIVE: 'constructive',
  COACHING: 'coaching',
} as const;

export const FeedbackTypeLabels: Record<string, string> = {
  recognition: 'Reconnaissance',
  constructive: 'Constructif',
  coaching: 'Coaching',
};

export const CompetencyCategory = {
  TECHNIQUE: 'technique',
  COMPORTEMENTAL: 'comportemental',
  LEADERSHIP: 'leadership',
  METIER: 'metier',
} as const;

export const CompetencyCategoryLabels: Record<string, string> = {
  technique: 'Technique',
  comportemental: 'Comportemental',
  leadership: 'Leadership',
  metier: 'Métier',
};
