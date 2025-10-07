/**
 * Payroll Integration Service
 *
 * Provides integration points for payroll calculation to consume
 * overtime hours and time-off data.
 */

import { db } from '@/db';
import { timeEntries, timeOffRequests } from '@/drizzle/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { format } from 'date-fns';
import { getOvertimeSummary, calculateOvertimePay } from './overtime.service';
import type { OvertimeBreakdown } from './overtime.service';

export interface PayrollPeriodInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  baseSalary: number;
  countryCode: string;
}

export interface PayrollOvertimeData {
  breakdown: OvertimeBreakdown;
  overtimePay: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
}

export interface PayrollTimeOffData {
  unpaidDays: number;
  paidDays: number;
  daysWorked: number;
  proratedSalary?: number;
}

/**
 * Get overtime data for payroll period
 *
 * This function is called by the payroll calculation service to get
 * approved overtime hours and calculate overtime pay.
 */
export async function getOvertimeForPayroll(
  input: PayrollPeriodInput
): Promise<PayrollOvertimeData> {
  const { employeeId, periodStart, periodEnd, baseSalary, countryCode } = input;

  // Get overtime summary (only approved entries)
  const breakdown = await getOvertimeSummary(employeeId, periodStart, periodEnd);

  // Calculate overtime pay
  const overtimePay = await calculateOvertimePay(baseSalary, breakdown, countryCode);

  // Calculate totals
  const totalRegularHours = breakdown.regular;
  const totalOvertimeHours =
    (breakdown.hours_41_to_46 || 0) +
    (breakdown.hours_above_46 || 0) +
    (breakdown.night_work || 0) +
    (breakdown.weekend || 0);

  return {
    breakdown,
    overtimePay,
    totalRegularHours,
    totalOvertimeHours,
  };
}

/**
 * Get time-off data for payroll period
 *
 * This function checks for approved time-off and calculates
 * pro-rated salary if there's unpaid leave.
 */
export async function getTimeOffForPayroll(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  baseSalary: number
): Promise<PayrollTimeOffData> {
  // Get approved time-off requests in period
  const timeOffData = await db.query.timeOffRequests.findMany({
    where: and(
      eq(timeOffRequests.employeeId, employeeId),
      eq(timeOffRequests.status, 'approved'),
      gte(timeOffRequests.startDate, format(periodStart, 'yyyy-MM-dd')),
      lte(timeOffRequests.endDate, format(periodEnd, 'yyyy-MM-dd'))
    ),
    with: {
      policy: true,
    },
  });

  // Calculate unpaid and paid days
  let unpaidDays = 0;
  let paidDays = 0;

  for (const request of timeOffData) {
    const days = parseFloat(request.totalDays as string);
    if (request.policy?.isPaid) {
      paidDays += days;
    } else {
      unpaidDays += days;
    }
  }

  // Calculate days worked and pro-rated salary
  const daysInPeriod = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysWorked = daysInPeriod - unpaidDays - paidDays;

  let proratedSalary: number | undefined;
  if (unpaidDays > 0) {
    proratedSalary = baseSalary * (daysWorked / daysInPeriod);
  }

  return {
    unpaidDays,
    paidDays,
    daysWorked,
    proratedSalary,
  };
}

/**
 * Get complete time tracking data for payroll calculation
 *
 * This is the main integration point called by payroll service.
 * Returns all time tracking data needed for accurate payroll calculation.
 */
export async function getTimeTrackingDataForPayroll(input: PayrollPeriodInput) {
  const overtime = await getOvertimeForPayroll(input);
  const timeOff = await getTimeOffForPayroll(
    input.employeeId,
    input.periodStart,
    input.periodEnd,
    input.baseSalary
  );

  return {
    overtime,
    timeOff,
  };
}

/**
 * Validate all time entries are approved before payroll run
 *
 * This function checks that all time entries in the period
 * have been approved by a manager. Prevents running payroll
 * with pending time entries.
 */
export async function validateTimeEntriesForPayroll(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ isValid: boolean; pendingCount: number; message?: string }> {
  const pendingEntries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(periodStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(periodEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'pending')
    ),
  });

  if (pendingEntries.length > 0) {
    return {
      isValid: false,
      pendingCount: pendingEntries.length,
      message: `${pendingEntries.length} pointage(s) en attente d'approbation`,
    };
  }

  return {
    isValid: true,
    pendingCount: 0,
  };
}

/**
 * Example usage in payroll calculation service:
 *
 * ```typescript
 * import { getTimeTrackingDataForPayroll, validateTimeEntriesForPayroll } from '@/features/time-tracking/services/payroll-integration.service';
 *
 * // In calculatePayroll function
 * export async function calculatePayroll(runId: string, employeeId: string) {
 *   const employee = await getEmployee(employeeId);
 *   const periodStart = new Date('2025-01-01');
 *   const periodEnd = new Date('2025-01-31');
 *
 *   // Validate all time entries are approved
 *   const validation = await validateTimeEntriesForPayroll(employeeId, periodStart, periodEnd);
 *   if (!validation.isValid) {
 *     throw new Error(validation.message);
 *   }
 *
 *   // Get time tracking data
 *   const timeData = await getTimeTrackingDataForPayroll({
 *     employeeId,
 *     periodStart,
 *     periodEnd,
 *     baseSalary: employee.baseSalary,
 *     countryCode: employee.tenant.countryCode,
 *   });
 *
 *   // Calculate gross salary
 *   let grossSalary = employee.baseSalary;
 *
 *   // Adjust for unpaid leave
 *   if (timeData.timeOff.unpaidDays > 0) {
 *     grossSalary = timeData.timeOff.proratedSalary;
 *   }
 *
 *   // Add overtime pay
 *   grossSalary += timeData.overtime.overtimePay;
 *
 *   // Continue with CNPS, ITS, etc. calculation...
 *
 *   // Store overtime breakdown in payroll_line_items
 *   await db.insert(payrollLineItems).values({
 *     payrollRunId: runId,
 *     employeeId,
 *     baseSalary: employee.baseSalary,
 *     overtimePay: timeData.overtime.overtimePay,
 *     overtimeHours: timeData.overtime.breakdown, // JSONB field
 *     daysWorked: timeData.timeOff.daysWorked,
 *     grossSalary,
 *     // ... other fields
 *   });
 * }
 * ```
 */
