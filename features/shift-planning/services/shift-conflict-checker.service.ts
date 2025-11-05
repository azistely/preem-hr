/**
 * Shift Conflict Checker Service
 *
 * Validates planned shifts for conflicts:
 * - Overlapping shifts (same employee, same time)
 * - Approved time off (employee has leave)
 * - Rest period violations (< 11 hours between shifts - CI law)
 * - Shift length violations (> 12 hours for security/healthcare - CI law)
 *
 * @module shift-planning/services/shift-conflict-checker
 */

import { db } from '@/lib/db';
import { plannedShifts, type PlannedShift, type NewPlannedShift } from '@/lib/db/schema/shift-planning';
import { timeOffRequests } from '@/lib/db/schema/time-tracking';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, between, sql, lte, gte, or, lt, gt } from 'drizzle-orm';
import { validateShiftLength } from '@/lib/compliance/shift-validation.service';

// ============================================
// Types
// ============================================

export interface ConflictCheck {
  hasConflicts: boolean;
  conflicts: ShiftConflict[];
}

export interface ShiftConflict {
  type: ConflictType;
  message: string;
  details?: any;
}

export type ConflictType =
  | 'overlapping_shift'
  | 'time_off'
  | 'rest_period_violation'
  | 'shift_length_violation'
  | 'max_hours_exceeded';

export interface RestPeriodViolation {
  hoursSinceLastShift: number;
  minimumRequired: number;
  lastShiftDate: string;
  lastShiftEndTime: string;
}

// ============================================
// Main Conflict Checker
// ============================================

/**
 * Check all possible conflicts for a planned shift
 *
 * @param shift - Shift to validate
 * @returns Conflict check result
 *
 * @example
 * ```typescript
 * const result = await checkAllConflicts({
 *   employeeId: "...",
 *   shiftDate: "2025-11-10",
 *   startTime: "08:00:00",
 *   endTime: "16:00:00",
 *   tenantId: "..."
 * });
 *
 * if (result.hasConflicts) {
 *   result.conflicts.forEach(c => console.log(c.message));
 * }
 * ```
 */
export async function checkAllConflicts(
  shift: Partial<NewPlannedShift> & {
    employeeId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    tenantId: string;
    id?: string; // Existing shift ID (for updates)
  }
): Promise<ConflictCheck> {
  const conflicts: ShiftConflict[] = [];

  // Run all checks in parallel
  const [
    overlappingShifts,
    timeOffConflict,
    restPeriodViolation,
    shiftLengthViolation,
  ] = await Promise.all([
    checkOverlappingShifts(shift),
    checkTimeOffConflicts(shift.employeeId, shift.tenantId, shift.shiftDate),
    checkRestPeriodViolation(shift),
    checkShiftLengthCompliance(shift),
  ]);

  // Overlapping shifts
  if (overlappingShifts.length > 0) {
    conflicts.push({
      type: 'overlapping_shift',
      message: `Conflit: L'employé a déjà un quart prévu ce jour (${overlappingShifts.length} conflit(s))`,
      details: { overlappingShifts },
    });
  }

  // Time off conflicts
  if (timeOffConflict.length > 0) {
    conflicts.push({
      type: 'time_off',
      message: `Conflit: L'employé a un congé approuvé ce jour`,
      details: { timeOffRequests: timeOffConflict },
    });
  }

  // Rest period violations
  if (restPeriodViolation) {
    conflicts.push({
      type: 'rest_period_violation',
      message: `Conflit: Période de repos insuffisante (${restPeriodViolation.hoursSinceLastShift.toFixed(1)}h depuis le dernier quart, minimum ${restPeriodViolation.minimumRequired}h requis)`,
      details: { restPeriodViolation },
    });
  }

  // Shift length violations
  if (shiftLengthViolation) {
    conflicts.push({
      type: 'shift_length_violation',
      message: shiftLengthViolation.message,
      details: shiftLengthViolation.details,
    });
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

// ============================================
// Individual Conflict Checks
// ============================================

/**
 * Check for overlapping shifts on the same date
 *
 * @param shift - Shift to check
 * @returns Array of overlapping shifts
 */
export async function checkOverlappingShifts(shift: {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  tenantId: string;
  id?: string;
}): Promise<PlannedShift[]> {
  try {
    const overlapping = await db
      .select()
      .from(plannedShifts)
      .where(
        and(
          eq(plannedShifts.tenantId, shift.tenantId),
          eq(plannedShifts.employeeId, shift.employeeId),
          eq(plannedShifts.shiftDate, shift.shiftDate),
          // Exclude current shift if updating
          shift.id ? sql`${plannedShifts.id} != ${shift.id}` : sql`true`,
          // Not cancelled or no-show
          sql`${plannedShifts.status} NOT IN ('cancelled', 'no_show')`,
          // Time ranges overlap
          sql`(${plannedShifts.startTime}, ${plannedShifts.endTime}) OVERLAPS (${shift.startTime}::time, ${shift.endTime}::time)`
        )
      );

    return overlapping;
  } catch (error) {
    console.error('Error checking overlapping shifts:', error);
    return [];
  }
}

/**
 * Check for approved time off on the shift date
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param shiftDate - Shift date
 * @returns Array of conflicting time off requests
 */
export async function checkTimeOffConflicts(
  employeeId: string,
  tenantId: string,
  shiftDate: string
): Promise<any[]> {
  try {
    const conflicts = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.tenantId, tenantId),
          eq(timeOffRequests.employeeId, employeeId),
          eq(timeOffRequests.status, 'approved'),
          lte(timeOffRequests.startDate, shiftDate),
          gte(timeOffRequests.endDate, shiftDate)
        )
      );

    return conflicts;
  } catch (error) {
    console.error('Error checking time off conflicts:', error);
    return [];
  }
}

/**
 * Check for rest period violations (11 hours minimum in CI)
 *
 * @param shift - Shift to check
 * @returns Rest period violation details or null
 */
export async function checkRestPeriodViolation(shift: {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  tenantId: string;
  id?: string;
}): Promise<RestPeriodViolation | null> {
  try {
    // Find the most recent shift before this one
    const [lastShift] = await db
      .select()
      .from(plannedShifts)
      .where(
        and(
          eq(plannedShifts.tenantId, shift.tenantId),
          eq(plannedShifts.employeeId, shift.employeeId),
          or(
            // Previous day
            lt(plannedShifts.shiftDate, shift.shiftDate),
            // Same day but earlier time
            and(
              eq(plannedShifts.shiftDate, shift.shiftDate),
              lt(plannedShifts.endTime, shift.startTime)
            )
          ),
          // Exclude current shift if updating
          shift.id ? sql`${plannedShifts.id} != ${shift.id}` : sql`true`,
          // Not cancelled or no-show
          sql`${plannedShifts.status} NOT IN ('cancelled', 'no_show')`
        )
      )
      .orderBy(sql`${plannedShifts.shiftDate} DESC, ${plannedShifts.endTime} DESC`)
      .limit(1);

    if (!lastShift) {
      return null; // No previous shift, no violation
    }

    // Calculate hours between shifts
    const lastShiftEnd = new Date(`${lastShift.shiftDate}T${lastShift.endTime}`);
    const currentShiftStart = new Date(`${shift.shiftDate}T${shift.startTime}`);
    const hoursSinceLastShift =
      (currentShiftStart.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60);

    const minimumRestHours = 11; // CI labor law

    if (hoursSinceLastShift < minimumRestHours) {
      return {
        hoursSinceLastShift,
        minimumRequired: minimumRestHours,
        lastShiftDate: lastShift.shiftDate,
        lastShiftEndTime: lastShift.endTime,
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking rest period:', error);
    return null;
  }
}

/**
 * Check for shift length compliance (sector-specific)
 *
 * Uses existing shift-validation.service.ts to enforce sector limits
 * (e.g., 12-hour max for security/healthcare)
 *
 * @param shift - Shift to check
 * @returns Conflict or null
 */
export async function checkShiftLengthCompliance(shift: {
  employeeId: string;
  startTime: string;
  endTime: string;
  tenantId: string;
}): Promise<ShiftConflict | null> {
  try {
    // Get employee to check sector
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(eq(employees.id, shift.employeeId), eq(employees.tenantId, shift.tenantId))
      )
      .limit(1);

    if (!employee || !employee.sector) {
      return null; // Can't validate without sector info
    }

    // Use existing compliance service
    const clockIn = new Date(`2000-01-01T${shift.startTime}`);
    const clockOut = new Date(`2000-01-01T${shift.endTime}`);
    const validation = validateShiftLength(clockIn, clockOut, employee.sector);

    if (!validation.isValid) {
      return {
        type: 'shift_length_violation',
        message: validation.errorMessage ?? 'Durée de quart invalide',
        details: {
          shiftLength: validation.shiftLength,
          maxAllowed: validation.maxAllowed,
          sector: employee.sector,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking shift length compliance:', error);
    return null;
  }
}

/**
 * Check for weekly max hours violations
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param weekStartDate - Start of week (Monday)
 * @param additionalHours - Hours to add (for new shift)
 * @returns Conflict or null
 */
export async function checkMaxHoursViolation(
  employeeId: string,
  tenantId: string,
  weekStartDate: string,
  additionalHours: number
): Promise<ShiftConflict | null> {
  try {
    // Get all shifts for the week
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const weekShifts = await db
      .select()
      .from(plannedShifts)
      .where(
        and(
          eq(plannedShifts.tenantId, tenantId),
          eq(plannedShifts.employeeId, employeeId),
          between(
            plannedShifts.shiftDate,
            weekStartDate,
            weekEndDate.toISOString().split('T')[0]
          ),
          sql`${plannedShifts.status} NOT IN ('cancelled', 'no_show')`
        )
      );

    const totalHours = weekShifts.reduce(
      (sum, shift) => sum + Number(shift.paidHours ?? 0),
      0
    );
    const projectedTotal = totalHours + additionalHours;

    // CI law: Max 40-56 hours per week depending on regime
    // For safety, we'll warn at 60 hours
    const maxWeeklyHours = 60;

    if (projectedTotal > maxWeeklyHours) {
      return {
        type: 'max_hours_exceeded',
        message: `Attention: Total hebdomadaire de ${projectedTotal.toFixed(1)}h dépasse ${maxWeeklyHours}h`,
        details: {
          currentHours: totalHours,
          additionalHours,
          projectedTotal,
          maxWeeklyHours,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking max hours:', error);
    return null;
  }
}

// ============================================
// Batch Conflict Checking
// ============================================

/**
 * Check conflicts for multiple shifts at once
 *
 * @param shifts - Array of shifts to check
 * @returns Map of shift index to conflict check result
 */
export async function checkWeekConflicts(
  shifts: Array<
    Partial<NewPlannedShift> & {
      employeeId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      tenantId: string;
    }
  >
): Promise<Map<number, ConflictCheck>> {
  const results = new Map<number, ConflictCheck>();

  // Check each shift
  for (let i = 0; i < shifts.length; i++) {
    const result = await checkAllConflicts(shifts[i]);
    if (result.hasConflicts) {
      results.set(i, result);
    }
  }

  return results;
}

/**
 * Get conflict summary for display
 *
 * @param check - Conflict check result
 * @returns Human-readable summary
 */
export function getConflictSummary(check: ConflictCheck): string {
  if (!check.hasConflicts) {
    return 'Aucun conflit détecté';
  }

  const messages = check.conflicts.map((c) => c.message);
  return messages.join('\n');
}
