import { pgTable, uuid, timestamp, numeric, text, boolean, pgPolicy, date, integer } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Time Entries - Clock in/out records with geofencing
 */
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Time tracking
  clockIn: timestamp('clock_in').notNull(),
  clockOut: timestamp('clock_out'),
  totalHours: numeric('total_hours', { precision: 5, scale: 2 }),

  // Location tracking (for multi-site support)
  locationId: uuid('location_id'), // References locations(id) - added for GAP-LOC-001

  // Geofencing
  clockInLocation: text('clock_in_location'), // GEOGRAPHY(POINT) stored as text
  clockOutLocation: text('clock_out_location'), // GEOGRAPHY(POINT) stored as text
  geofenceVerified: boolean('geofence_verified').default(false),

  // Photo verification
  clockInPhotoUrl: text('clock_in_photo_url'),
  clockOutPhotoUrl: text('clock_out_photo_url'),

  // Entry metadata
  entryType: text('entry_type').notNull().default('regular'), // regular, overtime, on_call
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  approvedBy: uuid('approved_by'), // References users(id)
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),

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
  policyType: text('policy_type').notNull(), // annual, sick, personal, maternity, paternity, unpaid
  description: text('description'),

  // Allocation
  daysPerYear: numeric('days_per_year', { precision: 5, scale: 2 }),
  accrualRate: text('accrual_rate'), // monthly, yearly, per_pay_period
  maxCarryover: numeric('max_carryover', { precision: 5, scale: 2 }),
  maxAccrual: numeric('max_accrual', { precision: 5, scale: 2 }),

  // Rules
  requiresApproval: boolean('requires_approval').notNull().default(true),
  minimumIncrement: numeric('minimum_increment', { precision: 3, scale: 2 }).default('0.5'), // 0.5 = half day
  advanceNoticeRequired: integer('advance_notice_required').default(0), // days
  blackoutPeriods: text('blackout_periods'), // JSONB stored as text

  // Status
  isActive: boolean('is_active').notNull().default(true),

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
  balanceId: uuid('balance_id').references(() => timeOffBalances.id),

  // Request details
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  daysRequested: numeric('days_requested', { precision: 5, scale: 2 }).notNull(),
  reason: text('reason'),
  notes: text('notes'),

  // Approval workflow
  status: text('status').notNull().default('pending'), // pending, approved, rejected, cancelled
  reviewedBy: uuid('reviewed_by'), // References users(id)
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  cancellationReason: text('cancellation_reason'),

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
