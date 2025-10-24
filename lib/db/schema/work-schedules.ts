/**
 * Work Schedules Schema - Variable Schedule Tracking for Daily/Hourly Workers
 *
 * Supports GAP-JOUR-002: Track irregular work schedules for employees who:
 * - Work variable days per week/month (construction, retail)
 * - Work variable hours per day (part-time, flexible schedules)
 * - Need approval workflow before payroll
 *
 * Related tables:
 * - time_entries: For clock in/out (salaried workers)
 * - work_schedules: For days/hours tracking (daily/hourly workers)
 */

import { pgTable, uuid, timestamp, numeric, text, boolean, pgPolicy, date, time, varchar } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Work Schedules - Track days and hours worked for variable schedules
 *
 * Use cases:
 * - Daily workers: Track which days they worked (present/absent)
 * - Hourly workers: Track hours worked each day
 * - Part-time: Track partial days with specific hours
 * - Approval: Manager approves weekly schedules before payroll
 *
 * @example
 * ```typescript
 * // Full day (8 hours)
 * {
 *   work_date: '2025-10-22',
 *   schedule_type: 'FULL_DAY',
 *   hours_worked: 8.00,
 *   is_present: true,
 *   status: 'pending'
 * }
 *
 * // Partial day (5 hours)
 * {
 *   work_date: '2025-10-23',
 *   schedule_type: 'PARTIAL_DAY',
 *   start_time: '08:00',
 *   end_time: '13:00',
 *   hours_worked: 5.00, // Auto-calculated
 *   is_present: true,
 *   status: 'approved'
 * }
 *
 * // Absent
 * {
 *   work_date: '2025-10-24',
 *   schedule_type: 'ABSENT',
 *   is_present: false,
 *   status: 'approved'
 * }
 * ```
 */
export const workSchedules = pgTable('work_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Work date (single day)
  workDate: date('work_date').notNull(),

  // Time tracking (optional for hourly workers)
  startTime: time('start_time'),
  endTime: time('end_time'),

  // Hours worked (auto-calculated from times or manually entered)
  hoursWorked: numeric('hours_worked', { precision: 5, scale: 2 }),

  // Attendance status
  isPresent: boolean('is_present').notNull().default(false),

  // Schedule type for quick filtering/display
  scheduleType: varchar('schedule_type', { length: 20 }).notNull().default('FULL_DAY'),
  // Values: 'FULL_DAY' (standard 8h), 'PARTIAL_DAY' (custom hours), 'ABSENT' (0h)

  // Optional notes
  notes: text('notes'),

  // Approval workflow
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // Values: 'draft', 'pending', 'approved', 'rejected'
  approvedBy: uuid('approved_by'), // References users(id)
  approvedAt: timestamp('approved_at'),
  rejectedReason: text('rejected_reason'),

  // Week grouping for bulk approval (auto-calculated via trigger)
  weekStartDate: date('week_start_date'), // Monday of the week

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
  updatedBy: uuid('updated_by'), // References users(id)
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
 * Work Schedules Relations
 */
export const workSchedulesRelations = relations(workSchedules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workSchedules.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [workSchedules.employeeId],
    references: [employees.id],
  }),
}));

/**
 * Type-safe inferred types
 */
export type WorkSchedule = typeof workSchedules.$inferSelect;
export type NewWorkSchedule = typeof workSchedules.$inferInsert;

/**
 * Schedule Type Enum
 */
export const ScheduleType = {
  FULL_DAY: 'FULL_DAY' as const,
  PARTIAL_DAY: 'PARTIAL_DAY' as const,
  ABSENT: 'ABSENT' as const,
} as const;

export type ScheduleTypeValue = typeof ScheduleType[keyof typeof ScheduleType];

/**
 * Schedule Status Enum
 */
export const ScheduleStatus = {
  DRAFT: 'draft' as const,
  PENDING: 'pending' as const,
  APPROVED: 'approved' as const,
  REJECTED: 'rejected' as const,
} as const;

export type ScheduleStatusValue = typeof ScheduleStatus[keyof typeof ScheduleStatus];

/**
 * Work Schedule Summary (for payroll integration)
 */
export type WorkScheduleSummary = {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  daysWorked: number; // Total days present
  totalHours: number; // Total hours worked
  pendingDays: number; // Days not yet approved
  approvedDays: number; // Days approved and ready for payroll
  hasUnapproved: boolean; // Whether there are unapproved schedules
};

/**
 * Weekly Schedule Group (for bulk approval)
 */
export type WeeklyScheduleGroup = {
  weekStartDate: Date;
  employeeId: string;
  schedules: WorkSchedule[];
  totalDays: number;
  totalHours: number;
  status: 'draft' | 'pending' | 'approved' | 'mixed'; // mixed = some approved, some not
};
