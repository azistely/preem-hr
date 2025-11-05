/**
 * Shift Planning Schema - Proactive Scheduling System
 *
 * Supports GAP-SHIFT-001: Future shift planning and assignment
 * Enables managers to create, assign, and publish schedules in advance
 *
 * Key Features:
 * - Shift templates (reusable shift definitions)
 * - Planned shifts (future assignments)
 * - Shift swaps (employee-initiated trading)
 * - Coverage requirements (staffing rules)
 *
 * Integrates with:
 * - employment_contracts (determines CDDTI vs CDI/CDD pay calculations)
 * - work_schedules (retrospective tracking for reconciliation)
 * - time_entries (clock in/out for attendance verification)
 */

import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  time,
  numeric,
  integer,
  boolean,
  date,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { departments } from './departments';
import { positions } from './positions';
import { locations } from './locations';
import { workSchedules } from './work-schedules';
import { timeEntries } from './time-tracking';
import { tenantUser } from './roles';

// ============================================
// TABLE: shift_templates
// ============================================

/**
 * Shift Templates - Reusable Shift Definitions
 *
 * Define standard shifts (Morning, Afternoon, Night, Weekend)
 * that can be quickly assigned to employees.
 *
 * @example
 * ```typescript
 * {
 *   name: "Morning Shift",
 *   code: "MORN",
 *   startTime: "08:00:00",
 *   endTime: "16:00:00",
 *   breakMinutes: 60,
 *   durationHours: 8.00,
 *   paidHours: 7.00,
 *   shiftType: "regular",
 *   color: "#3B82F6"
 * }
 * ```
 */
export const shiftTemplates = pgTable(
  'shift_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Template identification
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 50 }),
    color: varchar('color', { length: 7 }).default('#3B82F6'),

    // Shift timing
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    durationHours: numeric('duration_hours', { precision: 5, scale: 2 }),

    // Break time (unpaid)
    breakMinutes: integer('break_minutes').default(0),
    paidHours: numeric('paid_hours', { precision: 5, scale: 2 }),

    // Shift metadata
    shiftType: varchar('shift_type', { length: 20 }).notNull().default('regular'),
    // Values: 'regular', 'overtime', 'night', 'weekend', 'on_call'

    // Applicability filters
    applicableDepartments: uuid('applicable_departments').array(),
    applicablePositions: uuid('applicable_positions').array(),
    applicableSectors: varchar('applicable_sectors', { length: 50 }).array(),

    // Capacity planning
    minEmployees: integer('min_employees').default(1),
    maxEmployees: integer('max_employees'),

    // Legal compliance
    requiresRestPeriod: boolean('requires_rest_period').default(true),
    minRestHours: integer('min_rest_hours').default(11),
    maxConsecutiveDays: integer('max_consecutive_days').default(6),

    // Cost metadata
    overtimeMultiplier: numeric('overtime_multiplier', { precision: 4, scale: 2 }).default('1.00'),

    // Notes
    description: text('description'),
    notes: text('notes'),

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: tenantUser,
      using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
      withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    }),
  ]
);

// ============================================
// TABLE: planned_shifts
// ============================================

/**
 * Planned Shifts - Future Shift Assignments
 *
 * Assigns employees to shifts on specific dates.
 * Tracks status from draft → published → confirmed → completed.
 * Links to actual attendance for reconciliation.
 *
 * @example
 * ```typescript
 * {
 *   employeeId: "...",
 *   shiftTemplateId: "...",
 *   shiftDate: "2025-11-10",
 *   startTime: "08:00:00",
 *   endTime: "16:00:00",
 *   contractType: "CDDTI", // Critical for cost calculation
 *   status: "published",
 *   hasConflicts: false
 * }
 * ```
 */
export const plannedShifts = pgTable(
  'planned_shifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Assignment
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    shiftTemplateId: uuid('shift_template_id').references(() => shiftTemplates.id, {
      onDelete: 'set null',
    }),

    // Schedule date
    shiftDate: date('shift_date').notNull(),

    // Timing (from template, can be overridden)
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakMinutes: integer('break_minutes').default(0),

    // Calculated fields (auto-calculated via trigger)
    durationHours: numeric('duration_hours', { precision: 5, scale: 2 }).notNull(),
    paidHours: numeric('paid_hours', { precision: 5, scale: 2 }).notNull(),

    // Location (multi-site support)
    locationId: uuid('location_id'),

    // Context (denormalized for performance)
    departmentId: uuid('department_id'),
    positionId: uuid('position_id'),

    // Contract context (CRITICAL for cost calculation)
    contractId: uuid('contract_id'),
    contractType: varchar('contract_type', { length: 20 }),
    // Values: 'CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM'

    // Shift metadata
    shiftType: varchar('shift_type', { length: 20 }).notNull().default('regular'),

    // Cost calculation
    overtimeMultiplier: numeric('overtime_multiplier', { precision: 4, scale: 2 }).default('1.00'),
    estimatedCost: numeric('estimated_cost', { precision: 15, scale: 2 }),

    // Status workflow
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    // Values: 'draft', 'published', 'confirmed', 'completed', 'cancelled', 'no_show'

    publishedAt: timestamp('published_at'),
    publishedBy: uuid('published_by'),

    confirmedAt: timestamp('confirmed_at'),
    confirmedBy: uuid('confirmed_by'),

    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: uuid('cancelled_by'),
    cancellationReason: text('cancellation_reason'),

    // Actual attendance (reconciliation with work_schedules/time_entries)
    actualClockIn: timestamp('actual_clock_in'),
    actualClockOut: timestamp('actual_clock_out'),
    actualHours: numeric('actual_hours', { precision: 5, scale: 2 }),
    attendanceStatus: varchar('attendance_status', { length: 20 }),
    // Values: 'scheduled', 'present', 'absent', 'late', 'early_departure'

    workScheduleId: uuid('work_schedule_id'),
    timeEntryId: uuid('time_entry_id'),

    // Conflict tracking (auto-detected via trigger)
    hasConflicts: boolean('has_conflicts').default(false),
    conflictTypes: text('conflict_types').array(),
    // Values: ['overlapping_shift', 'time_off', 'rest_period_violation']

    // Notes
    notes: text('notes'),
    employeeNotes: text('employee_notes'),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: tenantUser,
      using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
      withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    }),
  ]
);

// ============================================
// TABLE: shift_swap_requests
// ============================================

/**
 * Shift Swap Requests - Employee-Initiated Trading
 *
 * Allows employees to swap shifts with manager approval.
 * Supports bilateral swaps (1-for-1) and unilateral giveaways.
 *
 * @example
 * ```typescript
 * {
 *   originalShiftId: "...",
 *   originalEmployeeId: "...",
 *   targetEmployeeId: "...", // or NULL for open swaps
 *   swapType: "bilateral",
 *   reason: "Family emergency",
 *   status: "pending"
 * }
 * ```
 */
export const shiftSwapRequests = pgTable(
  'shift_swap_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Original shift
    originalShiftId: uuid('original_shift_id')
      .notNull()
      .references(() => plannedShifts.id, { onDelete: 'cascade' }),
    originalEmployeeId: uuid('original_employee_id')
      .notNull()
      .references(() => employees.id),

    // Target employee
    targetEmployeeId: uuid('target_employee_id').references(() => employees.id),

    // Offered shift in return (optional)
    offeredShiftId: uuid('offered_shift_id').references(() => plannedShifts.id, {
      onDelete: 'set null',
    }),

    // Swap type
    swapType: varchar('swap_type', { length: 20 }).notNull().default('bilateral'),
    // Values: 'bilateral', 'unilateral', 'pickup'

    // Request details
    reason: text('reason'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),

    // Approval workflow
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    // Values: 'pending', 'target_accepted', 'manager_approved', 'approved', 'rejected', 'cancelled', 'expired'

    targetResponse: varchar('target_response', { length: 20 }),
    targetResponseAt: timestamp('target_response_at'),
    targetResponseNotes: text('target_response_notes'),

    managerResponse: varchar('manager_response', { length: 20 }),
    managerResponseAt: timestamp('manager_response_at'),
    managerResponseBy: uuid('manager_response_by').references(() => users.id),
    managerResponseNotes: text('manager_response_notes'),

    // Expiry
    expiresAt: timestamp('expires_at'),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: tenantUser,
      using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
      withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    }),
  ]
);

// ============================================
// TABLE: shift_coverage_requirements
// ============================================

/**
 * Shift Coverage Requirements - Staffing Rules
 *
 * Defines minimum/maximum employees needed per time period.
 * Used for validation and capacity planning.
 *
 * @example
 * ```typescript
 * {
 *   departmentId: "...",
 *   dayOfWeek: 1, // Monday
 *   startTime: "08:00:00",
 *   endTime: "17:00:00",
 *   minEmployees: 2,
 *   maxEmployees: 5,
 *   optimalEmployees: 3
 * }
 * ```
 */
export const shiftCoverageRequirements = pgTable(
  'shift_coverage_requirements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Scope
    departmentId: uuid('department_id'),
    locationId: uuid('location_id'),
    positionId: uuid('position_id'),

    // Time scope
    dayOfWeek: integer('day_of_week'), // 0=Sunday, 6=Saturday, NULL=all days
    startDate: date('start_date'),
    endDate: date('end_date'),

    // Time period within day
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),

    // Staffing requirements
    minEmployees: integer('min_employees').notNull().default(1),
    maxEmployees: integer('max_employees'),
    optimalEmployees: integer('optimal_employees'),

    // Skill requirements
    requiredSkills: text('required_skills').array(),

    // Priority
    priority: integer('priority').default(1), // 1-5

    // Notes
    description: text('description'),

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: tenantUser,
      using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
      withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    }),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const shiftTemplatesRelations = relations(shiftTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shiftTemplates.tenantId],
    references: [tenants.id],
  }),
}));

export const plannedShiftsRelations = relations(plannedShifts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [plannedShifts.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [plannedShifts.employeeId],
    references: [employees.id],
  }),
  shiftTemplate: one(shiftTemplates, {
    fields: [plannedShifts.shiftTemplateId],
    references: [shiftTemplates.id],
  }),
  workSchedule: one(workSchedules, {
    fields: [plannedShifts.workScheduleId],
    references: [workSchedules.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [plannedShifts.timeEntryId],
    references: [timeEntries.id],
  }),
}));

export const shiftSwapRequestsRelations = relations(shiftSwapRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shiftSwapRequests.tenantId],
    references: [tenants.id],
  }),
  originalShift: one(plannedShifts, {
    fields: [shiftSwapRequests.originalShiftId],
    references: [plannedShifts.id],
  }),
  originalEmployee: one(employees, {
    fields: [shiftSwapRequests.originalEmployeeId],
    references: [employees.id],
  }),
  targetEmployee: one(employees, {
    fields: [shiftSwapRequests.targetEmployeeId],
    references: [employees.id],
  }),
}));

export const shiftCoverageRequirementsRelations = relations(
  shiftCoverageRequirements,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [shiftCoverageRequirements.tenantId],
      references: [tenants.id],
    }),
    department: one(departments, {
      fields: [shiftCoverageRequirements.departmentId],
      references: [departments.id],
    }),
    position: one(positions, {
      fields: [shiftCoverageRequirements.positionId],
      references: [positions.id],
    }),
  })
);

// ============================================
// TYPE EXPORTS
// ============================================

export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type NewShiftTemplate = typeof shiftTemplates.$inferInsert;

export type PlannedShift = typeof plannedShifts.$inferSelect;
export type NewPlannedShift = typeof plannedShifts.$inferInsert;

export type ShiftSwapRequest = typeof shiftSwapRequests.$inferSelect;
export type NewShiftSwapRequest = typeof shiftSwapRequests.$inferInsert;

export type ShiftCoverageRequirement = typeof shiftCoverageRequirements.$inferSelect;
export type NewShiftCoverageRequirement = typeof shiftCoverageRequirements.$inferInsert;

// ============================================
// ENUMS
// ============================================

export const ShiftType = {
  REGULAR: 'regular' as const,
  OVERTIME: 'overtime' as const,
  NIGHT: 'night' as const,
  WEEKEND: 'weekend' as const,
  ON_CALL: 'on_call' as const,
} as const;

export type ShiftTypeValue = (typeof ShiftType)[keyof typeof ShiftType];

export const ShiftStatus = {
  DRAFT: 'draft' as const,
  PUBLISHED: 'published' as const,
  CONFIRMED: 'confirmed' as const,
  COMPLETED: 'completed' as const,
  CANCELLED: 'cancelled' as const,
  NO_SHOW: 'no_show' as const,
} as const;

export type ShiftStatusValue = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const SwapType = {
  BILATERAL: 'bilateral' as const,
  UNILATERAL: 'unilateral' as const,
  PICKUP: 'pickup' as const,
} as const;

export type SwapTypeValue = (typeof SwapType)[keyof typeof SwapType];

export const SwapStatus = {
  PENDING: 'pending' as const,
  TARGET_ACCEPTED: 'target_accepted' as const,
  MANAGER_APPROVED: 'manager_approved' as const,
  APPROVED: 'approved' as const,
  REJECTED: 'rejected' as const,
  CANCELLED: 'cancelled' as const,
  EXPIRED: 'expired' as const,
} as const;

export type SwapStatusValue = (typeof SwapStatus)[keyof typeof SwapStatus];

// ============================================
// SUMMARY TYPES (for UI/API)
// ============================================

export type WeeklyScheduleSummary = {
  weekStartDate: Date;
  departmentId?: string;
  dailySummaries: {
    date: Date;
    totalShifts: number;
    publishedShifts: number;
    confirmedShifts: number;
    totalHours: number;
    employeesScheduled: number;
    hasConflicts: boolean;
  }[];
  weekTotals: {
    totalShifts: number;
    totalHours: number;
    employeesScheduled: number;
    conflictCount: number;
  };
};

export type EmployeeSchedule = {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  shifts: PlannedShift[];
  totalHours: number;
  totalShifts: number;
  unconfirmedCount: number;
};

export type ShiftConflict = {
  shiftId: string;
  conflictTypes: string[];
  details: {
    overlappingShifts?: PlannedShift[];
    timeOffRequests?: any[];
    restPeriodViolation?: {
      hoursSinceLastShift: number;
      minimumRequired: number;
    };
  };
};
