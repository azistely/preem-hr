/**
 * Time-Off Service
 *
 * Handles time-off requests, approvals, and balance management
 */

import { db } from '@/db';
import {
  timeOffRequests,
  timeOffBalances,
  timeOffPolicies,
  employees,
} from '@/drizzle/schema';
import { and, eq, gte, lte, or, isNull, sql } from 'drizzle-orm';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  isWeekend as isWeekendDate,
  isBefore,
  isAfter,
  addDays,
  parseISO,
} from 'date-fns';
import { countBusinessDaysExcludingHolidays } from '@/features/time-tracking/services/holiday.service';

export interface TimeOffRequestInput {
  employeeId: string;
  tenantId: string;
  policyId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  isDeductibleForAcp?: boolean;
}

export interface ApproveTimeOffInput {
  requestId: string;
  reviewedBy: string;
  notes?: string;
}

export interface RejectTimeOffInput {
  requestId: string;
  reviewedBy: string;
  reviewNotes: string;
}

export class TimeOffError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TimeOffError';
  }
}

/**
 * Calculate business days (excluding weekends)
 * @deprecated Use calculateBusinessDaysWithHolidays instead
 */
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter((day) => !isWeekendDate(day)).length;
}

/**
 * Calculate business days excluding weekends AND public holidays
 */
async function calculateBusinessDaysWithHolidays(
  startDate: Date,
  endDate: Date,
  countryCode: string
): Promise<number> {
  return await countBusinessDaysExcludingHolidays(startDate, endDate, countryCode);
}

/**
 * Request time off
 */
export async function requestTimeOff(input: TimeOffRequestInput) {
  const { employeeId, tenantId, policyId, startDate, endDate, reason, isDeductibleForAcp = true } = input;

  // Get policy
  const policy = await db.query.timeOffPolicies.findFirst({
    where: eq(timeOffPolicies.id, policyId),
  });

  if (!policy) {
    throw new TimeOffError('Politique de congé non trouvée', 'POLICY_NOT_FOUND');
  }

  // Get employee to determine country
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: {
      tenant: true,
    },
  });

  if (!employee) {
    throw new TimeOffError('Employé non trouvé', 'EMPLOYEE_NOT_FOUND');
  }

  // tenant can be an array from relations
  const tenant = Array.isArray(employee.tenant) ? employee.tenant[0] : employee.tenant;
  const countryCode = tenant?.countryCode || 'CI';

  // Validate dates
  if (isAfter(startDate, endDate)) {
    throw new TimeOffError(
      'La date de début doit être antérieure à la date de fin',
      'INVALID_DATES'
    );
  }

  // Calculate total days (excluding weekends AND public holidays)
  const totalDays = await calculateBusinessDaysWithHolidays(startDate, endDate, countryCode);

  // Validate min/max days
  if (policy.minDaysPerRequest && totalDays < parseFloat(policy.minDaysPerRequest as string)) {
    throw new TimeOffError(
      `Minimum ${policy.minDaysPerRequest} jours requis`,
      'BELOW_MINIMUM_DAYS'
    );
  }

  if (policy.maxDaysPerRequest && totalDays > parseFloat(policy.maxDaysPerRequest as string)) {
    throw new TimeOffError(
      `Maximum ${policy.maxDaysPerRequest} jours autorisés`,
      'ABOVE_MAXIMUM_DAYS'
    );
  }

  // Validate advance notice
  if (policy.advanceNoticeDays && policy.advanceNoticeDays > 0) {
    const noticeDate = addDays(new Date(), policy.advanceNoticeDays);
    if (isBefore(startDate, noticeDate)) {
      throw new TimeOffError(
        `Préavis insuffisant (${policy.advanceNoticeDays} jours requis)`,
        'INSUFFICIENT_NOTICE',
        { requiredDays: policy.advanceNoticeDays }
      );
    }
  }

  // Check blackout periods
  if (policy.blackoutPeriods && Array.isArray(policy.blackoutPeriods)) {
    for (const blackout of policy.blackoutPeriods as any[]) {
      const blackoutStart = parseISO(blackout.start);
      const blackoutEnd = parseISO(blackout.end);

      // Check if requested dates overlap with blackout
      if (
        (isAfter(startDate, blackoutStart) && isBefore(startDate, blackoutEnd)) ||
        (isAfter(endDate, blackoutStart) && isBefore(endDate, blackoutEnd)) ||
        (isBefore(startDate, blackoutStart) && isAfter(endDate, blackoutEnd))
      ) {
        throw new TimeOffError(
          `Période bloquée: ${blackout.reason}`,
          'BLACKOUT_PERIOD',
          { blackout }
        );
      }
    }
  }

  // Get current balance
  const balance = await db.query.timeOffBalances.findFirst({
    where: and(
      eq(timeOffBalances.employeeId, employeeId),
      eq(timeOffBalances.policyId, policyId)
    ),
  });

  if (!balance) {
    throw new TimeOffError(
      'Solde de congé non trouvé',
      'BALANCE_NOT_FOUND'
    );
  }

  // Check sufficient balance
  const availableBalance = parseFloat(balance.balance as string) - parseFloat(balance.pending as string);
  if (totalDays > availableBalance) {
    throw new TimeOffError(
      `Solde insuffisant (disponible: ${availableBalance.toFixed(1)} jours)`,
      'INSUFFICIENT_BALANCE',
      { available: availableBalance, requested: totalDays }
    );
  }

  // Create request
  const [request] = await db
    .insert(timeOffRequests)
    // @ts-expect-error - isDeductibleForAcp field exists in schema but Drizzle type inference doesn't pick it up
    .values({
      tenantId,
      employeeId,
      policyId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays: totalDays.toString(),
      reason,
      status: 'pending',
      isDeductibleForAcp: isDeductibleForAcp ?? true,
    })
    .returning();

  // Update balance (mark as pending)
  await db
    .update(timeOffBalances)
    .set({
      pending: (parseFloat(balance.pending as string) + totalDays).toString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeOffBalances.id, balance.id));

  return request;
}

/**
 * Approve time-off request
 */
export async function approveTimeOff(input: ApproveTimeOffInput) {
  const { requestId, reviewedBy, notes } = input;

  // Get request
  const request = await db.query.timeOffRequests.findFirst({
    where: eq(timeOffRequests.id, requestId),
  });

  if (!request) {
    throw new TimeOffError('Demande non trouvée', 'REQUEST_NOT_FOUND');
  }

  if (request.status !== 'pending') {
    throw new TimeOffError(
      'Demande déjà traitée',
      'REQUEST_ALREADY_PROCESSED',
      { currentStatus: request.status }
    );
  }

  // Update request
  const [approvedRequest] = await db
    .update(timeOffRequests)
    .set({
      status: 'approved',
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeOffRequests.id, requestId))
    .returning();

  // Update balance (move from pending to used)
  const balance = await db.query.timeOffBalances.findFirst({
    where: and(
      eq(timeOffBalances.employeeId, request.employeeId),
      eq(timeOffBalances.policyId, request.policyId)
    ),
  });

  if (balance) {
    const totalDays = parseFloat(request.totalDays as string);
    await db
      .update(timeOffBalances)
      .set({
        pending: (parseFloat(balance.pending as string) - totalDays).toString(),
        used: (parseFloat(balance.used as string) + totalDays).toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(timeOffBalances.id, balance.id));
  }

  return approvedRequest;
}

/**
 * Reject time-off request
 */
export async function rejectTimeOff(input: RejectTimeOffInput) {
  const { requestId, reviewedBy, reviewNotes } = input;

  // Get request
  const request = await db.query.timeOffRequests.findFirst({
    where: eq(timeOffRequests.id, requestId),
  });

  if (!request) {
    throw new TimeOffError('Demande non trouvée', 'REQUEST_NOT_FOUND');
  }

  if (request.status !== 'pending') {
    throw new TimeOffError(
      'Demande déjà traitée',
      'REQUEST_ALREADY_PROCESSED',
      { currentStatus: request.status }
    );
  }

  // Update request
  const [rejectedRequest] = await db
    .update(timeOffRequests)
    .set({
      status: 'rejected',
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeOffRequests.id, requestId))
    .returning();

  // Restore balance (remove from pending)
  const balance = await db.query.timeOffBalances.findFirst({
    where: and(
      eq(timeOffBalances.employeeId, request.employeeId),
      eq(timeOffBalances.policyId, request.policyId)
    ),
  });

  if (balance) {
    const totalDays = parseFloat(request.totalDays as string);
    await db
      .update(timeOffBalances)
      .set({
        pending: (parseFloat(balance.pending as string) - totalDays).toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(timeOffBalances.id, balance.id));
  }

  return rejectedRequest;
}

/**
 * Get balance for employee and policy
 */
export async function getBalance(employeeId: string, policyId: string) {
  return await db.query.timeOffBalances.findFirst({
    where: and(
      eq(timeOffBalances.employeeId, employeeId),
      eq(timeOffBalances.policyId, policyId)
    ),
  });
}

/**
 * Accrue leave balance (run monthly)
 */
export async function accrueLeaveBalance(
  employeeId: string,
  policyId: string,
  accrualDate: Date
) {
  const policy = await db.query.timeOffPolicies.findFirst({
    where: eq(timeOffPolicies.id, policyId),
  });

  if (!policy || policy.accrualMethod !== 'accrued_monthly') {
    return;
  }

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) return;

  // Get or create balance
  let balance = await getBalance(employeeId, policyId);

  if (!balance) {
    const periodStart = new Date(accrualDate.getFullYear(), 0, 1);
    const periodEnd = new Date(accrualDate.getFullYear(), 11, 31);

    [balance] = await db
      .insert(timeOffBalances)
      .values({
        tenantId: employee.tenantId,
        employeeId,
        policyId,
        balance: '0',
        used: '0',
        pending: '0',
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      })
      .returning();
  }

  // Calculate accrual
  const accrualRate = parseFloat(policy.accrualRate as string);
  const maxBalance = policy.maxBalance ? parseFloat(policy.maxBalance as string) : Infinity;
  const currentBalance = parseFloat(balance.balance as string);

  // Pro-rate for mid-month hire
  let accrualAmount = accrualRate;
  const hireDate = new Date(employee.hireDate);
  if (hireDate.getMonth() === accrualDate.getMonth()) {
    const daysInMonth = new Date(accrualDate.getFullYear(), accrualDate.getMonth() + 1, 0).getDate();
    const daysWorked = daysInMonth - hireDate.getDate() + 1;
    accrualAmount = (accrualRate * daysWorked) / daysInMonth;
  }

  // Apply max balance cap
  const newBalance = Math.min(currentBalance + accrualAmount, maxBalance);

  // Update balance
  await db
    .update(timeOffBalances)
    .set({
      balance: newBalance.toString(),
      lastAccrualDate: accrualDate.toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeOffBalances.id, balance.id));

  return balance;
}
