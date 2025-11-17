/**
 * Time Entries Aggregation Service
 *
 * Aggregates time entries data from clock-in/out system for payroll calculation.
 * Automatically extracts Saturday/Sunday/night hours from time_entries.overtime_breakdown.
 *
 * Integration: time_entries (automatic tracking) → payroll calculation (manual input)
 */

import { db } from '@/lib/db';
import { timeEntries } from '@/lib/db/schema/time-tracking';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

/**
 * Overtime breakdown structure from time_entries table
 * Based on database JSONB structure: {regular, night_work, saturday, sunday, ...}
 */
export interface OvertimeBreakdown {
  regular?: number;
  night_work?: number;
  saturday?: number;
  sunday?: number;
  public_holiday?: number;
  hours_41_to_46?: number;
  hours_above_46?: number;
}

/**
 * Aggregated hours result for payroll period
 */
export interface AggregatedTimeEntryHours {
  // Total hours by category
  totalHours: number;
  regularHours: number;
  saturdayHours: number;
  sundayHours: number;
  nightHours: number;
  publicHolidayHours: number;

  // Overtime tiers (for non-daily workers)
  overtime_41_to_46: number;
  overtime_above_46: number;

  // Presence tracking (for transport allowance)
  daysWorked: number; // Count of distinct days with entries

  // Source information
  entryCount: number;
  hasTimeEntries: boolean;
}

/**
 * Aggregate time entries for an employee during a payroll period
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID (for security)
 * @param periodStart - Period start date (YYYY-MM-DD)
 * @param periodEnd - Period end date (YYYY-MM-DD, optional - defaults to end of month)
 * @returns Aggregated hours breakdown
 *
 * @example
 * ```typescript
 * const hours = await aggregateTimeEntriesForPayroll(
 *   'employee-uuid',
 *   'tenant-uuid',
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 *
 * // Use in payroll calculation:
 * calculateDailyWorkersGross({
 *   ...other fields,
 *   hoursWorked: hours.totalHours,
 *   saturdayHours: hours.saturdayHours,
 *   sundayHours: hours.sundayHours,
 *   nightHours: hours.nightHours,
 *   presenceDays: hours.daysWorked,
 * });
 * ```
 */
export async function aggregateTimeEntriesForPayroll(
  employeeId: string,
  tenantId: string,
  periodStart: string,
  periodEnd?: string
): Promise<AggregatedTimeEntryHours> {
  // Calculate period boundaries
  const startDate = parseISO(periodStart);
  const endDate = periodEnd ? parseISO(periodEnd) : endOfMonth(startDate);

  // Query time entries for the period
  const entries = await db
    .select({
      id: timeEntries.id,
      clockIn: timeEntries.clockIn,
      clockOut: timeEntries.clockOut,
      totalHours: timeEntries.totalHours,
      overtimeBreakdown: timeEntries.overtimeBreakdown,
      status: timeEntries.status,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.employeeId, employeeId),
        eq(timeEntries.tenantId, tenantId),
        gte(timeEntries.clockIn, startDate),
        lte(timeEntries.clockIn, endDate),
        // Only include approved entries
        eq(timeEntries.status, 'approved')
      )
    );

  // Initialize accumulators
  let totalHours = 0;
  let regularHours = 0;
  let saturdayHours = 0;
  let sundayHours = 0;
  let nightHours = 0;
  let publicHolidayHours = 0;
  let overtime_41_to_46 = 0;
  let overtime_above_46 = 0;

  const uniqueDates = new Set<string>();

  // Aggregate hours from each entry
  for (const entry of entries) {
    // Track unique dates for presence days
    if (entry.clockIn) {
      const dateKey = entry.clockIn.toISOString().split('T')[0];
      uniqueDates.add(dateKey);
    }

    // Add total hours
    const entryHours = entry.totalHours ? parseFloat(entry.totalHours.toString()) : 0;
    totalHours += entryHours;

    // Extract breakdown from JSONB
    if (entry.overtimeBreakdown) {
      const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;

      // Regular hours
      if (breakdown.regular) {
        regularHours += breakdown.regular;
      }

      // Special hour categories (Saturday, Sunday, Night)
      if (breakdown.saturday) {
        saturdayHours += breakdown.saturday;
      }

      if (breakdown.sunday) {
        sundayHours += breakdown.sunday;
      }

      if (breakdown.night_work) {
        nightHours += breakdown.night_work;
      }

      if (breakdown.public_holiday) {
        publicHolidayHours += breakdown.public_holiday;
      }

      // Overtime tiers (for 40h regime workers)
      if (breakdown.hours_41_to_46) {
        overtime_41_to_46 += breakdown.hours_41_to_46;
      }

      if (breakdown.hours_above_46) {
        overtime_above_46 += breakdown.hours_above_46;
      }
    }
  }

  console.log('[TIME ENTRIES AGGREGATION]', {
    employeeId,
    periodStart,
    periodEnd: endDate.toISOString().split('T')[0],
    entryCount: entries.length,
    totalHours,
    breakdown: {
      regular: regularHours,
      saturday: saturdayHours,
      sunday: sundayHours,
      night: nightHours,
      publicHoliday: publicHolidayHours,
      overtime_41_to_46,
      overtime_above_46,
    },
    daysWorked: uniqueDates.size,
  });

  return {
    totalHours,
    regularHours,
    saturdayHours,
    sundayHours,
    nightHours,
    publicHolidayHours,
    overtime_41_to_46,
    overtime_above_46,
    daysWorked: uniqueDates.size,
    entryCount: entries.length,
    hasTimeEntries: entries.length > 0,
  };
}

/**
 * Get aggregated hours for a monthly payroll period
 *
 * Convenience wrapper that automatically calculates month boundaries
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param yearMonth - Period in YYYY-MM format
 * @returns Aggregated hours breakdown
 *
 * @example
 * ```typescript
 * const hours = await aggregateTimeEntriesForMonth(
 *   'employee-uuid',
 *   'tenant-uuid',
 *   '2025-01'
 * );
 * ```
 */
export async function aggregateTimeEntriesForMonth(
  employeeId: string,
  tenantId: string,
  yearMonth: string
): Promise<AggregatedTimeEntryHours> {
  const [year, month] = yearMonth.split('-').map(Number);
  const periodDate = new Date(year, month - 1, 1);

  const periodStart = startOfMonth(periodDate).toISOString().split('T')[0];
  const periodEnd = endOfMonth(periodDate).toISOString().split('T')[0];

  return aggregateTimeEntriesForPayroll(
    employeeId,
    tenantId,
    periodStart,
    periodEnd
  );
}
