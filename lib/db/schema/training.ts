/**
 * Training & Learning Management Schema
 * Complete training management system including courses, sessions, requests, plans, and certifications
 *
 * Tables:
 * - training_courses: Course catalog
 * - training_sessions: Scheduled sessions
 * - training_enrollments: Employee enrollments
 * - training_requests: Training request workflow
 * - training_plans: Annual training plans
 * - training_plan_items: Plan line items
 * - training_evaluations: Kirkpatrick evaluations
 * - employee_skills: Skills inventory
 * - employee_certifications: Certification tracking with expiry
 * - training_tax_obligations: FDFP (CI), ONFP (SN) tracking
 */

import { pgTable, uuid, timestamp, text, jsonb, boolean, date, integer, numeric, pgPolicy, time } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { departments } from './departments';
import { competencies } from './performance';
import { tenantUser } from './roles';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Training modality
 */
export type TrainingModality = 'in_person' | 'virtual' | 'e_learning' | 'blended' | 'on_the_job';

/**
 * Training request status
 */
export type TrainingRequestStatus = 'draft' | 'submitted' | 'manager_approved' | 'hr_approved' | 'scheduled' | 'rejected' | 'cancelled';

/**
 * Certification status
 */
export type CertificationStatus = 'active' | 'expired' | 'pending_renewal' | 'revoked';

/**
 * Skill proficiency level
 */
export type SkillProficiencyLevel = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// TRAINING COURSES TABLE (Catalog)
// ============================================================================

export const trainingCourses = pgTable('training_courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Course identification
  code: text('code').notNull(), // "TRAIN-SEC-001"
  name: text('name').notNull(), // "Formation Sécurité au Travail"
  description: text('description'),
  shortDescription: text('short_description'), // For cards/lists

  // Category
  category: text('category').notNull(), // 'securite', 'technique', 'soft_skills', 'management', 'reglementaire'

  // Modality
  modality: text('modality').notNull().default('in_person'), // in_person, virtual, e_learning, blended, on_the_job

  // Duration
  durationHours: integer('duration_hours').notNull(),
  durationDays: numeric('duration_days', { precision: 4, scale: 1 }), // Calculated from hours

  // Provider
  provider: text('provider'), // Internal or external provider name
  isExternal: boolean('is_external').default(false).notNull(),

  // Costs
  costPerParticipant: numeric('cost_per_participant', { precision: 15, scale: 2 }),
  currency: text('currency').default('XOF'),

  // Competencies addressed
  linkedCompetencyIds: jsonb('linked_competency_ids').default([]).$type<string[]>(),

  // Prerequisites
  prerequisites: jsonb('prerequisites').default([]).$type<string[]>(),
  prerequisiteCourseIds: jsonb('prerequisite_course_ids').default([]).$type<string[]>(),

  // Certification (if course leads to certification)
  grantsCertification: boolean('grants_certification').default(false).notNull(),
  certificationValidityMonths: integer('certification_validity_months'), // e.g., 24 for biennial

  // Recurrence (for mandatory trainings)
  isMandatory: boolean('is_mandatory').default(false).notNull(),
  mandatoryRecurrenceMonths: integer('mandatory_recurrence_months'), // e.g., 12 for annual

  // Country-specific (for regulatory compliance)
  countryCode: text('country_code'), // null = all countries
  isRegulatory: boolean('is_regulatory').default(false).notNull(), // Required by law

  // Materials
  materialsUrl: text('materials_url'),

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('training_courses_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING SESSIONS TABLE
// ============================================================================

export const trainingSessions = pgTable('training_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => trainingCourses.id, { onDelete: 'cascade' }),

  // Session identification
  sessionCode: text('session_code').notNull(), // "SEC-2025-S01"
  name: text('name'), // Optional override, defaults to course name

  // Schedule
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),

  // Location
  location: text('location'),
  isVirtual: boolean('is_virtual').default(false).notNull(),
  virtualMeetingUrl: text('virtual_meeting_url'),

  // Instructor
  instructorName: text('instructor_name'),
  instructorEmail: text('instructor_email'),
  isInternalInstructor: boolean('is_internal_instructor').default(false).notNull(),
  instructorEmployeeId: uuid('instructor_employee_id').references(() => employees.id, { onDelete: 'set null' }),

  // Capacity
  maxParticipants: integer('max_participants'),
  minParticipants: integer('min_participants').default(1),

  // Registration
  registrationDeadline: date('registration_deadline'),
  registrationOpen: boolean('registration_open').default(true).notNull(),

  // Status
  status: text('status').notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled

  // Notes
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('training_sessions_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING ENROLLMENTS TABLE
// ============================================================================

export const trainingEnrollments = pgTable('training_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => trainingSessions.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Status
  status: text('status').notNull().default('enrolled'), // enrolled, attended, completed, no_show, cancelled

  // Attendance tracking
  attendancePercentage: integer('attendance_percentage'), // 0-100
  attendedAt: timestamp('attended_at', { withTimezone: true }), // When marked as attended

  // Completion
  completionStatus: text('completion_status'), // passed, failed, pending
  completionScore: numeric('completion_score', { precision: 5, scale: 2 }), // e.g., quiz score
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Certificate (if applicable)
  certificateIssued: boolean('certificate_issued').default(false),
  certificateIssuedAt: timestamp('certificate_issued_at', { withTimezone: true }),
  certificateDocumentId: uuid('certificate_document_id'), // Reference to uploaded_documents

  // Cost allocation
  allocatedCost: numeric('allocated_cost', { precision: 15, scale: 2 }),

  // Linked training request
  trainingRequestId: uuid('training_request_id'), // Reference to training_requests

  // Notes
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  enrolledBy: uuid('enrolled_by').references(() => users.id),
}, (table) => [
  pgPolicy('training_enrollments_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING REQUESTS TABLE
// ============================================================================

export const trainingRequests = pgTable('training_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Reference number
  referenceNumber: text('reference_number').notNull(), // "TR-2025-0001"

  // Requester
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Request type
  requestType: text('request_type').notNull().default('individual'), // individual, team, mandatory

  // Course (existing or custom)
  courseId: uuid('course_id').references(() => trainingCourses.id, { onDelete: 'set null' }),
  customCourseName: text('custom_course_name'), // If requesting unlisted course
  customCourseDescription: text('custom_course_description'),

  // Justification
  justification: text('justification').notNull(),
  linkedObjectiveId: uuid('linked_objective_id'), // Reference to objectives table
  requestOrigin: text('request_origin').notNull().default('self'), // self, manager, evaluation, mandatory

  // Timing preferences
  preferredStartDate: date('preferred_start_date'),
  preferredEndDate: date('preferred_end_date'),
  urgency: text('urgency').notNull().default('normal'), // low, normal, high, urgent

  // Budget
  estimatedCost: numeric('estimated_cost', { precision: 15, scale: 2 }),
  approvedBudget: numeric('approved_budget', { precision: 15, scale: 2 }),

  // Status workflow
  status: text('status').notNull().default('draft'), // draft, submitted, manager_approved, hr_approved, scheduled, rejected, cancelled

  // Manager approval
  managerApprovalStatus: text('manager_approval_status'), // pending, approved, rejected
  managerApprovedBy: uuid('manager_approved_by').references(() => users.id),
  managerApprovedAt: timestamp('manager_approved_at', { withTimezone: true }),
  managerComment: text('manager_comment'),

  // HR approval
  hrApprovalStatus: text('hr_approval_status'), // pending, approved, rejected
  hrApprovedBy: uuid('hr_approved_by').references(() => users.id),
  hrApprovedAt: timestamp('hr_approved_at', { withTimezone: true }),
  hrComment: text('hr_comment'),

  // Rejection
  rejectionReason: text('rejection_reason'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),

  // Scheduled session
  scheduledSessionId: uuid('scheduled_session_id').references(() => trainingSessions.id, { onDelete: 'set null' }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
}, (table) => [
  pgPolicy('training_requests_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING PLANS TABLE
// ============================================================================

export const trainingPlans = pgTable('training_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Plan identification
  name: text('name').notNull(), // "Plan de Formation 2025"
  year: integer('year').notNull(),
  description: text('description'),

  // Scope
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }), // null = company-wide

  // Budget
  totalBudget: numeric('total_budget', { precision: 15, scale: 2 }),
  currency: text('currency').default('XOF'),
  allocatedBudget: numeric('allocated_budget', { precision: 15, scale: 2 }).default('0'),
  spentBudget: numeric('spent_budget', { precision: 15, scale: 2 }).default('0'),

  // Status
  status: text('status').notNull().default('draft'), // draft, submitted, approved, in_progress, completed

  // Approval
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('training_plans_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING PLAN ITEMS TABLE
// ============================================================================

export const trainingPlanItems = pgTable('training_plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => trainingPlans.id, { onDelete: 'cascade' }),

  // Course (existing or planned)
  courseId: uuid('course_id').references(() => trainingCourses.id, { onDelete: 'set null' }),
  customCourseName: text('custom_course_name'), // For new courses to be created

  // Target participants
  targetParticipantCount: integer('target_participant_count').notNull(),
  targetEmployeeIds: jsonb('target_employee_ids').default([]).$type<string[]>(),
  targetDepartmentIds: jsonb('target_department_ids').default([]).$type<string[]>(),
  targetPositions: jsonb('target_positions').default([]).$type<string[]>(),

  // Budget allocation
  budgetAllocated: numeric('budget_allocated', { precision: 15, scale: 2 }),
  budgetSpent: numeric('budget_spent', { precision: 15, scale: 2 }).default('0'),

  // Timing (quarter preference)
  plannedQuarter: integer('planned_quarter'), // 1, 2, 3, 4
  plannedMonth: integer('planned_month'), // 1-12

  // Priority
  priority: text('priority').notNull().default('medium'), // low, medium, high, critical

  // Status
  status: text('status').notNull().default('planned'), // planned, scheduled, in_progress, completed, cancelled

  // Linked session (when scheduled)
  sessionId: uuid('session_id').references(() => trainingSessions.id, { onDelete: 'set null' }),

  // Notes
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('training_plan_items_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING EVALUATIONS TABLE (Kirkpatrick)
// ============================================================================

export const trainingEvaluations = pgTable('training_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').notNull().references(() => trainingEnrollments.id, { onDelete: 'cascade' }),

  // Kirkpatrick level
  evaluationLevel: integer('evaluation_level').notNull(), // 1: Reaction, 2: Learning, 3: Behavior, 4: Results

  // Response data (dynamic form)
  responses: jsonb('responses').notNull().default({}).$type<Record<string, unknown>>(),

  // Scores
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }),

  // Status
  status: text('status').notNull().default('pending'), // pending, completed

  // Timing
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('training_evaluations_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// EMPLOYEE SKILLS TABLE (Inventory)
// ============================================================================

export const employeeSkills = pgTable('employee_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Skill identification
  skillName: text('skill_name').notNull(), // Free text skill name
  skillCategory: text('skill_category'), // 'language', 'software', 'technical', 'soft_skill'

  // Proficiency
  proficiencyLevel: integer('proficiency_level').notNull().default(3), // 1-5

  // Source
  source: text('source').notNull().default('self_declared'), // self_declared, assessment, training, certification

  // Linked competency (optional)
  linkedCompetencyId: uuid('linked_competency_id').references(() => competencies.id, { onDelete: 'set null' }),

  // Evidence
  evidenceNotes: text('evidence_notes'),
  linkedTrainingEnrollmentId: uuid('linked_training_enrollment_id').references(() => trainingEnrollments.id, { onDelete: 'set null' }),

  // Validation
  isValidated: boolean('is_validated').default(false).notNull(),
  validatedBy: uuid('validated_by').references(() => users.id),
  validatedAt: timestamp('validated_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('employee_skills_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// EMPLOYEE CERTIFICATIONS TABLE
// ============================================================================

export const employeeCertifications = pgTable('employee_certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Certification details
  certificationName: text('certification_name').notNull(),
  certificationCode: text('certification_code'), // e.g., "PMP", "AWS-SAA"
  issuingOrganization: text('issuing_organization').notNull(),

  // Category
  category: text('category'), // 'safety', 'technical', 'professional', 'regulatory'

  // Validity
  issueDate: date('issue_date').notNull(),
  expiryDate: date('expiry_date'),
  isLifetime: boolean('is_lifetime').default(false).notNull(),

  // Status
  status: text('status').notNull().default('active'), // active, expired, pending_renewal, revoked

  // Credential ID (for verification)
  credentialId: text('credential_id'),
  verificationUrl: text('verification_url'),

  // Document
  documentId: uuid('document_id'), // Reference to uploaded_documents

  // Linked training
  linkedEnrollmentId: uuid('linked_enrollment_id').references(() => trainingEnrollments.id, { onDelete: 'set null' }),
  linkedCourseId: uuid('linked_course_id').references(() => trainingCourses.id, { onDelete: 'set null' }),

  // Renewal tracking
  renewalReminderSent: boolean('renewal_reminder_sent').default(false),
  renewalReminderSentAt: timestamp('renewal_reminder_sent_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  pgPolicy('employee_certifications_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// ============================================================================
// TRAINING TAX OBLIGATIONS TABLE (Country-Specific)
// ============================================================================

export const trainingTaxObligations = pgTable('training_tax_obligations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Period
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12

  // Country
  countryCode: text('country_code').notNull(), // 'CI', 'SN', etc.

  // Tax calculation base
  payrollTaxableBase: numeric('payroll_taxable_base', { precision: 15, scale: 2 }).notNull(),

  // Côte d'Ivoire (FDFP)
  tapRate: numeric('tap_rate', { precision: 5, scale: 4 }), // 0.004 (0.4%)
  tapAmount: numeric('tap_amount', { precision: 15, scale: 2 }),
  tfpcRate: numeric('tfpc_rate', { precision: 5, scale: 4 }), // 0.012 (1.2%)
  tfpcAmount: numeric('tfpc_amount', { precision: 15, scale: 2 }),
  fdfpTotalDue: numeric('fdfp_total_due', { precision: 15, scale: 2 }),
  fdfpCreditRate: numeric('fdfp_credit_rate', { precision: 5, scale: 4 }), // Up to 0.008 (0.8%)
  fdfpCreditAvailable: numeric('fdfp_credit_available', { precision: 15, scale: 2 }),

  // Senegal (ONFP)
  onfpRate: numeric('onfp_rate', { precision: 5, scale: 4 }), // 0.03 (3%)
  onfpAmount: numeric('onfp_amount', { precision: 15, scale: 2 }),
  onfpCreditRate: numeric('onfp_credit_rate', { precision: 5, scale: 4 }), // Up to 0.015 (1.5%)
  onfpCreditAvailable: numeric('onfp_credit_available', { precision: 15, scale: 2 }),

  // Training expenses for credit
  trainingExpenses: numeric('training_expenses', { precision: 15, scale: 2 }).default('0'),
  creditUsed: numeric('credit_used', { precision: 15, scale: 2 }).default('0'),
  creditBalance: numeric('credit_balance', { precision: 15, scale: 2 }).default('0'),

  // Status
  status: text('status').notNull().default('draft'), // draft, submitted, paid

  // Payment
  paymentDate: date('payment_date'),
  paymentReference: text('payment_reference'),

  // Linked payroll run (for calculation)
  payrollRunId: uuid('payroll_run_id'), // Reference to payroll_runs

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  pgPolicy('training_tax_obligations_tenant_isolation', {
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

export type TrainingCourse = typeof trainingCourses.$inferSelect;
export type NewTrainingCourse = typeof trainingCourses.$inferInsert;

export type TrainingSession = typeof trainingSessions.$inferSelect;
export type NewTrainingSession = typeof trainingSessions.$inferInsert;

export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
export type NewTrainingEnrollment = typeof trainingEnrollments.$inferInsert;

export type TrainingRequest = typeof trainingRequests.$inferSelect;
export type NewTrainingRequest = typeof trainingRequests.$inferInsert;

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type NewTrainingPlan = typeof trainingPlans.$inferInsert;

export type TrainingPlanItem = typeof trainingPlanItems.$inferSelect;
export type NewTrainingPlanItem = typeof trainingPlanItems.$inferInsert;

export type TrainingEvaluation = typeof trainingEvaluations.$inferSelect;
export type NewTrainingEvaluation = typeof trainingEvaluations.$inferInsert;

export type EmployeeSkill = typeof employeeSkills.$inferSelect;
export type NewEmployeeSkill = typeof employeeSkills.$inferInsert;

export type EmployeeCertification = typeof employeeCertifications.$inferSelect;
export type NewEmployeeCertification = typeof employeeCertifications.$inferInsert;

export type TrainingTaxObligation = typeof trainingTaxObligations.$inferSelect;
export type NewTrainingTaxObligation = typeof trainingTaxObligations.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const trainingCoursesRelations = relations(trainingCourses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [trainingCourses.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [trainingCourses.createdBy],
    references: [users.id],
  }),
  sessions: many(trainingSessions),
}));

export const trainingSessionsRelations = relations(trainingSessions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [trainingSessions.tenantId],
    references: [tenants.id],
  }),
  course: one(trainingCourses, {
    fields: [trainingSessions.courseId],
    references: [trainingCourses.id],
  }),
  instructorEmployee: one(employees, {
    fields: [trainingSessions.instructorEmployeeId],
    references: [employees.id],
  }),
  createdByUser: one(users, {
    fields: [trainingSessions.createdBy],
    references: [users.id],
  }),
  enrollments: many(trainingEnrollments),
}));

export const trainingEnrollmentsRelations = relations(trainingEnrollments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [trainingEnrollments.tenantId],
    references: [tenants.id],
  }),
  session: one(trainingSessions, {
    fields: [trainingEnrollments.sessionId],
    references: [trainingSessions.id],
  }),
  employee: one(employees, {
    fields: [trainingEnrollments.employeeId],
    references: [employees.id],
  }),
  enrolledByUser: one(users, {
    fields: [trainingEnrollments.enrolledBy],
    references: [users.id],
  }),
  evaluations: many(trainingEvaluations),
}));

export const trainingRequestsRelations = relations(trainingRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trainingRequests.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [trainingRequests.employeeId],
    references: [employees.id],
  }),
  course: one(trainingCourses, {
    fields: [trainingRequests.courseId],
    references: [trainingCourses.id],
  }),
  scheduledSession: one(trainingSessions, {
    fields: [trainingRequests.scheduledSessionId],
    references: [trainingSessions.id],
  }),
  managerApprovedByUser: one(users, {
    fields: [trainingRequests.managerApprovedBy],
    references: [users.id],
    relationName: 'training_requests_manager_approved_by',
  }),
  hrApprovedByUser: one(users, {
    fields: [trainingRequests.hrApprovedBy],
    references: [users.id],
    relationName: 'training_requests_hr_approved_by',
  }),
}));

export const trainingPlansRelations = relations(trainingPlans, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [trainingPlans.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [trainingPlans.departmentId],
    references: [departments.id],
  }),
  approvedByUser: one(users, {
    fields: [trainingPlans.approvedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [trainingPlans.createdBy],
    references: [users.id],
  }),
  items: many(trainingPlanItems),
}));

export const trainingPlanItemsRelations = relations(trainingPlanItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trainingPlanItems.tenantId],
    references: [tenants.id],
  }),
  plan: one(trainingPlans, {
    fields: [trainingPlanItems.planId],
    references: [trainingPlans.id],
  }),
  course: one(trainingCourses, {
    fields: [trainingPlanItems.courseId],
    references: [trainingCourses.id],
  }),
  session: one(trainingSessions, {
    fields: [trainingPlanItems.sessionId],
    references: [trainingSessions.id],
  }),
}));

export const trainingEvaluationsRelations = relations(trainingEvaluations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trainingEvaluations.tenantId],
    references: [tenants.id],
  }),
  enrollment: one(trainingEnrollments, {
    fields: [trainingEvaluations.enrollmentId],
    references: [trainingEnrollments.id],
  }),
}));

export const employeeSkillsRelations = relations(employeeSkills, ({ one }) => ({
  tenant: one(tenants, {
    fields: [employeeSkills.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [employeeSkills.employeeId],
    references: [employees.id],
  }),
  linkedCompetency: one(competencies, {
    fields: [employeeSkills.linkedCompetencyId],
    references: [competencies.id],
  }),
  linkedTrainingEnrollment: one(trainingEnrollments, {
    fields: [employeeSkills.linkedTrainingEnrollmentId],
    references: [trainingEnrollments.id],
  }),
  validatedByUser: one(users, {
    fields: [employeeSkills.validatedBy],
    references: [users.id],
  }),
}));

export const employeeCertificationsRelations = relations(employeeCertifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [employeeCertifications.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [employeeCertifications.employeeId],
    references: [employees.id],
  }),
  linkedEnrollment: one(trainingEnrollments, {
    fields: [employeeCertifications.linkedEnrollmentId],
    references: [trainingEnrollments.id],
  }),
  linkedCourse: one(trainingCourses, {
    fields: [employeeCertifications.linkedCourseId],
    references: [trainingCourses.id],
  }),
  createdByUser: one(users, {
    fields: [employeeCertifications.createdBy],
    references: [users.id],
  }),
}));

export const trainingTaxObligationsRelations = relations(trainingTaxObligations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trainingTaxObligations.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const TrainingModalityType = {
  IN_PERSON: 'in_person',
  VIRTUAL: 'virtual',
  E_LEARNING: 'e_learning',
  BLENDED: 'blended',
  ON_THE_JOB: 'on_the_job',
} as const;

export const TrainingModalityLabels: Record<string, string> = {
  in_person: 'Présentiel',
  virtual: 'Virtuel',
  e_learning: 'E-learning',
  blended: 'Mixte',
  on_the_job: 'Sur le terrain',
};

export const TrainingCategoryType = {
  SAFETY: 'securite',
  TECHNICAL: 'technique',
  SOFT_SKILLS: 'soft_skills',
  MANAGEMENT: 'management',
  REGULATORY: 'reglementaire',
  ONBOARDING: 'onboarding',
} as const;

export const TrainingCategoryLabels: Record<string, string> = {
  securite: 'Sécurité',
  technique: 'Technique',
  soft_skills: 'Compétences comportementales',
  management: 'Management',
  reglementaire: 'Réglementaire',
  onboarding: 'Intégration',
};

export const TrainingRequestStatusType = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  MANAGER_APPROVED: 'manager_approved',
  HR_APPROVED: 'hr_approved',
  SCHEDULED: 'scheduled',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const TrainingRequestStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  manager_approved: 'Approuvée (Manager)',
  hr_approved: 'Approuvée (RH)',
  scheduled: 'Planifiée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

export const CertificationStatusType = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  PENDING_RENEWAL: 'pending_renewal',
  REVOKED: 'revoked',
} as const;

export const CertificationStatusLabels: Record<string, string> = {
  active: 'Active',
  expired: 'Expirée',
  pending_renewal: 'Renouvellement requis',
  revoked: 'Révoquée',
};

export const EnrollmentCompletionStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

export const EnrollmentCompletionStatusLabels: Record<string, string> = {
  passed: 'Réussi',
  failed: 'Échoué',
  pending: 'En attente',
};

export const KirkpatrickLevelLabels: Record<number, string> = {
  1: 'Réaction - Satisfaction',
  2: 'Apprentissage - Connaissances acquises',
  3: 'Comportement - Mise en application',
  4: 'Résultats - Impact sur l\'entreprise',
};
