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
  tenants,
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
  handoverNotes?: string;
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
  const { employeeId, tenantId, policyId, startDate, endDate, reason, handoverNotes, isDeductibleForAcp = true } = input;

  // Get policy
  const policy = await db.query.timeOffPolicies.findFirst({
    where: eq(timeOffPolicies.id, policyId),
  });

  if (!policy) {
    throw new TimeOffError('Politique de congé non trouvée', 'POLICY_NOT_FOUND');
  }

  // Get employee to validate existence
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new TimeOffError('Employé non trouvé', 'EMPLOYEE_NOT_FOUND');
  }

  // Get tenant to determine country (using tenantId from input)
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

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
      handoverNotes,
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

/**
 * Initialize time-off balances for a newly hired employee
 * Creates balances for all active policies with pro-rated amounts
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param hireDate - Employee hire date
 * @param contractType - Employee contract type (only CDI/CDD get balances)
 * @param initialBalanceOverride - Optional: Override balance for annual leave (from CSV import)
 */
export async function initializeEmployeeBalances(
  employeeId: string,
  tenantId: string,
  hireDate: Date,
  contractType: string,
  initialBalanceOverride?: number
) {
  // Only CDI and CDD employees are eligible for paid leave
  if (!['CDI', 'CDD'].includes(contractType)) {
    return;
  }

  // Get employee gender for filtering policies
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: {
      gender: true,
    },
  });

  const employeeGender = employee?.gender;

  // Get all active policies for tenant (active = effective_to is NULL or in future)
  const allPolicies = await db.query.timeOffPolicies.findMany({
    where: and(
      eq(timeOffPolicies.tenantId, tenantId),
      or(
        isNull(timeOffPolicies.effectiveTo),
        gte(timeOffPolicies.effectiveTo, new Date().toISOString().split('T')[0])
      )
    ),
  });

  // Filter policies by gender eligibility
  const policies = allPolicies.filter(policy => {
    // If policy has no gender restriction (NULL or 'all'), it's available to everyone
    if (!policy.eligibleGender || policy.eligibleGender === 'all') {
      return true;
    }

    // If employee has no gender set, skip gender-specific policies
    if (!employeeGender) {
      return false;
    }

    // Match policy's eligible gender with employee's gender
    return policy.eligibleGender === employeeGender;
  });

  if (policies.length === 0) {
    return;
  }

  // Calculate current year period
  const currentYear = new Date().getFullYear();
  const periodStart = new Date(currentYear, 0, 1); // Jan 1
  const periodEnd = new Date(currentYear, 11, 31); // Dec 31

  // Calculate months remaining in year (including hire month)
  const hireMonth = hireDate.getMonth() + 1; // 1-12
  const monthsRemaining = 13 - hireMonth; // Months left in year

  // Create balance for each policy
  for (const policy of policies) {
    let balance: number;

    // Check if this is annual leave policy and we have an override from import
    const isAnnualLeave = policy.policyType === 'annual_leave' ||
                          policy.name.toLowerCase().includes('congé annuel') ||
                          policy.name.toLowerCase().includes('annual leave');

    if (isAnnualLeave && initialBalanceOverride !== undefined) {
      // Use imported balance for annual leave
      balance = initialBalanceOverride;
    } else if (policy.accrualMethod === 'accrued_monthly') {
      // Pro-rate monthly accrual policies based on months remaining
      const accrualRate = parseFloat(policy.accrualRate as string);
      balance = accrualRate * monthsRemaining;
    } else if (policy.accrualMethod === 'annual_allocation') {
      // For annual allocation, use the full accrual rate
      balance = parseFloat(policy.accrualRate as string);
    } else {
      // For other methods, use accrual rate as-is
      balance = parseFloat(policy.accrualRate as string);
    }

    // Ensure balance doesn't exceed max balance if configured
    if (policy.maxBalance) {
      const maxBalance = parseFloat(policy.maxBalance as string);
      balance = Math.min(balance, maxBalance);
    }

    // Check if balance already exists
    const existingBalance = await db.query.timeOffBalances.findFirst({
      where: and(
        eq(timeOffBalances.employeeId, employeeId),
        eq(timeOffBalances.policyId, policy.id)
      ),
    });

    if (existingBalance) {
      // Balance already exists, skip
      continue;
    }

    // Create balance record
    await db.insert(timeOffBalances).values({
      tenantId,
      employeeId,
      policyId: policy.id,
      balance: balance.toFixed(1),
      used: '0',
      pending: '0',
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      lastAccrualDate: hireDate.toISOString().split('T')[0],
    });
  }
}
