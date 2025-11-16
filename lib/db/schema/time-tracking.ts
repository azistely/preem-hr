import { pgTable, uuid, timestamp, numeric, text, boolean, pgPolicy, date, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Time Entries - Clock in/out records with geofencing AND manual entry
 *
 * Supports two workflows:
 * 1. Clock in/out - Automatic tracking via mobile (entrySource: 'clock_in_out')
 * 2. Manual entry - Manager/HR enters hours for date (entrySource: 'manual')
 */
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Time tracking
  clockIn: timestamp('clock_in').notNull(),
  clockOut: timestamp('clock_out'),
  totalHours: numeric('total_hours', { precision: 5, scale: 2 }),

  // Entry source - distinguishes manual entries from automatic clock in/out
  entrySource: text('entry_source').notNull().default('clock_in_out'), // 'clock_in_out' | 'manual'

  // Location tracking (for multi-site support)
  locationId: uuid('location_id'), // References locations(id) - added for GAP-LOC-001

  // Geofencing (only for clock_in_out entries)
  clockInLocation: text('clock_in_location'), // GEOGRAPHY(POINT) stored as text
  clockOutLocation: text('clock_out_location'), // GEOGRAPHY(POINT) stored as text
  geofenceVerified: boolean('geofence_verified').default(false),

  // Photo verification (only for clock_in_out entries)
  clockInPhotoUrl: text('clock_in_photo_url'),
  clockOutPhotoUrl: text('clock_out_photo_url'),

  // Entry metadata
  entryType: text('entry_type').notNull().default('regular'), // regular, overtime, on_call, night, weekend
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  approvedBy: uuid('approved_by'), // References users(id)
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),

  // Overtime breakdown (from overtime.service.ts classifyOvertimeHours)
  overtimeBreakdown: jsonb('overtime_breakdown'), // {hours_41_to_46, hours_above_46, night_work, weekend_work}

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
 * Time Off Policies - Leave policy definitions
 */
export const timeOffPolicies = pgTable('time_off_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Policy details
  name: text('name').notNull(),
  policyType: text('policy_type').notNull(), // annual_leave, sick_leave, maternity, paternity, unpaid

  // Allocation
  accrualMethod: text('accrual_method'), // fixed, accrued_monthly, accrued_hourly
  accrualRate: numeric('accrual_rate', { precision: 5, scale: 2 }),
  maxBalance: numeric('max_balance', { precision: 5, scale: 2 }),

  // Rules
  requiresApproval: boolean('requires_approval').notNull().default(true),
  advanceNoticeDays: integer('advance_notice_days').default(0), // days
  minDaysPerRequest: numeric('min_days_per_request', { precision: 3, scale: 2 }),
  maxDaysPerRequest: numeric('max_days_per_request', { precision: 3, scale: 2 }),
  blackoutPeriods: jsonb('blackout_periods'),

  // Gender eligibility
  eligibleGender: text('eligible_gender'), // male, female, or NULL (all genders)

  // Status
  isPaid: boolean('is_paid').default(true),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)

  // Additional fields
  templateId: uuid('template_id'),
  complianceLevel: text('compliance_level'),
  legalReference: text('legal_reference'),
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
 * Time Off Balances - Employee leave balances
 */
export const timeOffBalances = pgTable('time_off_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => timeOffPolicies.id, { onDelete: 'cascade' }),

  // Balance details
  year: integer('year').notNull(),
  allocated: numeric('allocated', { precision: 5, scale: 2 }).notNull().default('0'),
  used: numeric('used', { precision: 5, scale: 2 }).notNull().default('0'),
  pending: numeric('pending', { precision: 5, scale: 2 }).notNull().default('0'),
  carriedOver: numeric('carried_over', { precision: 5, scale: 2 }).notNull().default('0'),

  // Calculated field
  available: numeric('available', { precision: 5, scale: 2 }).notNull().default('0'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
 * Time Off Requests - Employee leave requests
 */
export const timeOffRequests = pgTable('time_off_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => timeOffPolicies.id),

  // Request details
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  totalDays: numeric('total_days', { precision: 5, scale: 2 }).notNull(),
  reason: text('reason'),
  notes: text('notes'),

  // Approval workflow
  status: text('status').notNull().default('pending'), // pending, approved, rejected, cancelled
  submittedAt: timestamp('submitted_at'),
  reviewedBy: uuid('reviewed_by'), // References users(id)
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),

  // ACP (Allocations de Congés Payés) tracking
  isDeductibleForAcp: boolean('is_deductible_for_acp').default(true),
  acpAmount: numeric('acp_amount', { precision: 15, scale: 2 }),
  acpPaidInPayrollRunId: uuid('acp_paid_in_payroll_run_id'),
  acpPaidAt: timestamp('acp_paid_at'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
