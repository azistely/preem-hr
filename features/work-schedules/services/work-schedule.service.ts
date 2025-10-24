/**
 * Work Schedule Service - Business Logic for Variable Schedule Tracking
 *
 * Handles:
 * - Recording daily work schedules (days/hours)
 * - Bulk operations (week entry)
 * - Approval workflow
 * - Monthly totals for payroll
 *
 * Related to GAP-JOUR-002: Variable Schedule Tracking
 */

import { db } from '@/db';
import { workSchedules, type NewWorkSchedule, type WorkSchedule, type WorkScheduleSummary, type WeeklyScheduleGroup, ScheduleStatus } from '@/lib/db/schema/work-schedules';
import { employees } from '@/drizzle/schema';
import { eq, and, gte, lte, sql, desc, asc, inArray } from 'drizzle-orm';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, isFuture } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Custom error class for work schedule operations
 */
export class WorkScheduleError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WorkScheduleError';
  }
}

/**
 * Record a single work day
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param workDate - Date of work
 * @param data - Schedule data (hours, times, status)
 * @returns Created or updated work schedule
 *
 * @example
 * ```typescript
 * // Record full day (8 hours)
 * await recordWorkDay(employeeId, tenantId, new Date('2025-10-22'), {
 *   scheduleType: 'FULL_DAY',
 *   hoursWorked: 8,
 *   isPresent: true,
 * });
 *
 * // Record partial day with times
 * await recordWorkDay(employeeId, tenantId, new Date('2025-10-23'), {
 *   scheduleType: 'PARTIAL_DAY',
 *   startTime: '08:00',
 *   endTime: '13:00',
 *   isPresent: true,
 * });
 * ```
 */
export async function recordWorkDay(
  employeeId: string,
  tenantId: string,
  workDate: Date,
  data: {
    scheduleType?: 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT';
    hoursWorked?: number;
    startTime?: string;
    endTime?: string;
    isPresent?: boolean;
    notes?: string;
    status?: 'draft' | 'pending';
    createdBy?: string;
  }
): Promise<WorkSchedule> {
  try {
    // Validate employee exists and belongs to tenant
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      ),
    });

    if (!employee) {
      throw new WorkScheduleError('Employé introuvable', 'EMPLOYEE_NOT_FOUND');
    }

    // Prepare schedule data
    const scheduleData: NewWorkSchedule = {
      tenantId,
      employeeId,
      workDate: format(workDate, 'yyyy-MM-dd'),
      scheduleType: data.scheduleType || 'FULL_DAY',
      isPresent: data.isPresent ?? (data.scheduleType !== 'ABSENT'),
      hoursWorked: data.hoursWorked?.toString(),
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      status: data.status || 'draft',
      createdBy: data.createdBy,
    };

    // Upsert (insert or update if exists)
    const result = await db
      .insert(workSchedules)
      .values(scheduleData)
      .onConflictDoUpdate({
        target: [workSchedules.tenantId, workSchedules.employeeId, workSchedules.workDate],
        set: {
          scheduleType: scheduleData.scheduleType,
          isPresent: scheduleData.isPresent,
          hoursWorked: scheduleData.hoursWorked,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          notes: scheduleData.notes,
          status: scheduleData.status,
          updatedAt: new Date(),
          updatedBy: data.createdBy,
        },
      })
      .returning();

    return result[0] as WorkSchedule;
  } catch (error) {
    if (error instanceof WorkScheduleError) {
      throw error;
    }
    throw new WorkScheduleError(
      `Impossible d'enregistrer le jour de travail: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      'RECORD_FAILED'
    );
  }
}

/**
 * Record a full week of schedules (bulk operation)
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param weekSchedules - Array of daily schedules for the week
 * @returns Array of created/updated schedules
 *
 * @example
 * ```typescript
 * await recordWeek(employeeId, tenantId, [
 *   { workDate: new Date('2025-10-21'), isPresent: true, hoursWorked: 8 },
 *   { workDate: new Date('2025-10-22'), isPresent: true, hoursWorked: 8 },
 *   { workDate: new Date('2025-10-23'), isPresent: false }, // Absent
 *   { workDate: new Date('2025-10-24'), isPresent: true, hoursWorked: 6 },
 *   { workDate: new Date('2025-10-25'), isPresent: true, hoursWorked: 8 },
 * ]);
 * ```
 */
export async function recordWeek(
  employeeId: string,
  tenantId: string,
  weekSchedules: Array<{
    workDate: Date;
    isPresent: boolean;
    hoursWorked?: number;
    startTime?: string;
    endTime?: string;
    scheduleType?: 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT';
    notes?: string;
  }>,
  createdBy?: string
): Promise<WorkSchedule[]> {
  try {
    const results: WorkSchedule[] = [];

    // Record each day in the week
    for (const daySchedule of weekSchedules) {
      const result = await recordWorkDay(employeeId, tenantId, daySchedule.workDate, {
        scheduleType: daySchedule.scheduleType || (daySchedule.isPresent ? 'FULL_DAY' : 'ABSENT'),
        hoursWorked: daySchedule.hoursWorked,
        startTime: daySchedule.startTime,
        endTime: daySchedule.endTime,
        isPresent: daySchedule.isPresent,
        notes: daySchedule.notes,
        status: 'draft', // Week recording always starts as draft
        createdBy,
      });
      results.push(result);
    }

    return results;
  } catch (error) {
    if (error instanceof WorkScheduleError) {
      throw error;
    }
    throw new WorkScheduleError(
      `Impossible d'enregistrer la semaine: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      'RECORD_WEEK_FAILED'
    );
  }
}

/**
 * Get all schedules for an employee in a date range
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns Array of work schedules
 */
export async function getSchedules(
  employeeId: string,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<WorkSchedule[]> {
  const schedules = await db
    .select()
    .from(workSchedules)
    .where(
      and(
        eq(workSchedules.tenantId, tenantId),
        eq(workSchedules.employeeId, employeeId),
        gte(workSchedules.workDate, format(startDate, 'yyyy-MM-dd')),
        lte(workSchedules.workDate, format(endDate, 'yyyy-MM-dd'))
      )
    )
    .orderBy(asc(workSchedules.workDate));

  return schedules as WorkSchedule[];
}

/**
 * Get monthly schedule for an employee
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param month - Any date in the target month
 * @returns Array of work schedules for the month
 */
export async function getMonthSchedule(
  employeeId: string,
  tenantId: string,
  month: Date
): Promise<WorkSchedule[]> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  return await getSchedules(employeeId, tenantId, monthStart, monthEnd);
}

/**
 * Calculate monthly totals for payroll integration
 *
 * Uses database function for accurate calculation.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param month - Any date in the target month
 * @returns Summary with days/hours worked and approval status
 *
 * @example
 * ```typescript
 * const totals = await calculateMonthTotals(employeeId, tenantId, new Date('2025-10-01'));
 * console.log(totals);
 * // {
 * //   daysWorked: 22,
 * //   totalHours: 176,
 * //   pendingDays: 0,
 * //   approvedDays: 22,
 * //   hasUnapproved: false
 * // }
 * ```
 */
export async function calculateMonthTotals(
  employeeId: string,
  tenantId: string,
  month: Date
): Promise<WorkScheduleSummary> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Use database function for accurate calculation
  const result = await db.execute(sql`
    SELECT * FROM get_work_schedule_totals(
      ${employeeId}::uuid,
      ${tenantId}::uuid,
      ${format(monthStart, 'yyyy-MM-dd')}::date,
      ${format(monthEnd, 'yyyy-MM-dd')}::date
    )
  `);

  const row = (result as any).rows?.[0] as any;

  return {
    employeeId,
    periodStart: monthStart,
    periodEnd: monthEnd,
    daysWorked: Number(row.days_worked || 0),
    totalHours: Number(row.total_hours || 0),
    pendingDays: Number(row.pending_days || 0),
    approvedDays: Number(row.approved_days || 0),
    hasUnapproved: Number(row.pending_days || 0) > 0,
  };
}

/**
 * Submit week for approval
 *
 * Changes all schedules in the week from 'draft' to 'pending'.
 * Prevents submission of future weeks or already approved weeks.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param weekStartDate - Monday of the week
 * @returns Updated schedules
 */
export async function submitWeekForApproval(
  employeeId: string,
  tenantId: string,
  weekStartDate: Date
): Promise<WorkSchedule[]> {
  try {
    // Validate week is not in the future
    const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 }); // Monday start
    if (isFuture(weekEnd)) {
      throw new WorkScheduleError(
        'Impossible de soumettre une semaine future pour approbation',
        'FUTURE_WEEK'
      );
    }

    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    const weekStartFormatted = format(weekStart, 'yyyy-MM-dd');

    // Get all schedules for this week
    const schedules = await db
      .select()
      .from(workSchedules)
      .where(
        and(
          eq(workSchedules.tenantId, tenantId),
          eq(workSchedules.employeeId, employeeId),
          eq(workSchedules.weekStartDate, weekStartFormatted)
        )
      );

    if (schedules.length === 0) {
      throw new WorkScheduleError(
        'Aucun horaire trouvé pour cette semaine',
        'NO_SCHEDULES'
      );
    }

    // Check if already approved
    const hasApproved = schedules.some((s) => s.status === 'approved');
    if (hasApproved) {
      throw new WorkScheduleError(
        'Cette semaine contient des horaires déjà approuvés',
        'ALREADY_APPROVED'
      );
    }

    // Update all draft schedules to pending
    const scheduleIds = schedules.map((s) => s.id);
    const updated = await db
      .update(workSchedules)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(workSchedules.id, scheduleIds),
          eq(workSchedules.status, 'draft')
        )
      )
      .returning();

    return updated as WorkSchedule[];
  } catch (error) {
    if (error instanceof WorkScheduleError) {
      throw error;
    }
    throw new WorkScheduleError(
      `Impossible de soumettre la semaine: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      'SUBMIT_FAILED'
    );
  }
}

/**
 * Approve schedules (single or batch)
 *
 * @param scheduleIds - Array of schedule IDs to approve
 * @param approvedBy - User ID approving
 * @returns Updated schedules
 */
export async function approveSchedules(
  scheduleIds: string[],
  approvedBy: string
): Promise<WorkSchedule[]> {
  try {
    // Validate schedules are pending
    const schedules = await db
      .select()
      .from(workSchedules)
      .where(inArray(workSchedules.id, scheduleIds));

    const notPending = schedules.filter((s) => s.status !== 'pending');
    if (notPending.length > 0) {
      throw new WorkScheduleError(
        'Certains horaires ne sont pas en attente d\'approbation',
        'NOT_PENDING'
      );
    }

    // Approve all schedules
    const updated = await db
      .update(workSchedules)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(workSchedules.id, scheduleIds))
      .returning();

    return updated as WorkSchedule[];
  } catch (error) {
    if (error instanceof WorkScheduleError) {
      throw error;
    }
    throw new WorkScheduleError(
      `Impossible d'approuver les horaires: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      'APPROVE_FAILED'
    );
  }
}

/**
 * Reject schedules
 *
 * @param scheduleIds - Array of schedule IDs to reject
 * @param approvedBy - User ID rejecting
 * @param rejectedReason - Reason for rejection
 * @returns Updated schedules
 */
export async function rejectSchedules(
  scheduleIds: string[],
  approvedBy: string,
  rejectedReason: string
): Promise<WorkSchedule[]> {
  try {
    const updated = await db
      .update(workSchedules)
      .set({
        status: 'rejected',
        approvedBy,
        approvedAt: new Date(),
        rejectedReason,
        updatedAt: new Date(),
      })
      .where(inArray(workSchedules.id, scheduleIds))
      .returning();

    return updated as WorkSchedule[];
  } catch (error) {
    throw new WorkScheduleError(
      `Impossible de rejeter les horaires: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      'REJECT_FAILED'
    );
  }
}

/**
 * Get pending schedules for approval (manager view)
 *
 * @param tenantId - Tenant UUID
 * @param filters - Optional filters (date range, employee)
 * @returns Array of pending schedules grouped by week
 */
export async function getPendingSchedules(
  tenantId: string,
  filters?: {
    employeeId?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<WeeklyScheduleGroup[]> {
  const conditions = [
    eq(workSchedules.tenantId, tenantId),
    eq(workSchedules.status, 'pending'),
  ];

  if (filters?.employeeId) {
    conditions.push(eq(workSchedules.employeeId, filters.employeeId));
  }

  if (filters?.startDate) {
    conditions.push(gte(workSchedules.workDate, format(filters.startDate, 'yyyy-MM-dd')));
  }

  if (filters?.endDate) {
    conditions.push(lte(workSchedules.workDate, format(filters.endDate, 'yyyy-MM-dd')));
  }

  const pending = await db
    .select()
    .from(workSchedules)
    .where(and(...conditions))
    .orderBy(desc(workSchedules.weekStartDate), asc(workSchedules.workDate));

  // Group by week and employee
  const grouped = new Map<string, WeeklyScheduleGroup>();

  for (const schedule of pending) {
    const key = `${schedule.employeeId}-${schedule.weekStartDate}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        weekStartDate: new Date(schedule.weekStartDate!),
        employeeId: schedule.employeeId,
        schedules: [],
        totalDays: 0,
        totalHours: 0,
        status: 'pending',
      });
    }

    const group = grouped.get(key)!;
    group.schedules.push(schedule as WorkSchedule);
    if (schedule.isPresent) {
      group.totalDays++;
      group.totalHours += Number(schedule.hoursWorked || 0);
    }
  }

  return Array.from(grouped.values());
}

/**
 * Validate schedules are approved before payroll
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param periodStart - Payroll period start
 * @param periodEnd - Payroll period end
 * @returns Validation result
 */
export async function validateSchedulesForPayroll(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  valid: boolean;
  unapprovedCount: number;
  message?: string;
}> {
  const totals = await calculateMonthTotals(employeeId, tenantId, periodStart);

  if (totals.hasUnapproved) {
    return {
      valid: false,
      unapprovedCount: totals.pendingDays,
      message: `${totals.pendingDays} jour(s) non approuvé(s). Approuvez tous les horaires avant de lancer la paie.`,
    };
  }

  return {
    valid: true,
    unapprovedCount: 0,
  };
}
