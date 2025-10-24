/**
 * Work Schedule Payroll Integration Service
 *
 * Integrates work schedules with payroll calculation.
 * Provides validated totals for daily/hourly workers.
 *
 * Related to GAP-JOUR-002: Variable Schedule Tracking
 */

import { calculateMonthTotals, validateSchedulesForPayroll } from './work-schedule.service';
import type { WorkScheduleSummary } from '@/lib/db/schema/work-schedules';

/**
 * Error class for payroll integration issues
 */
export class PayrollIntegrationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PayrollIntegrationError';
  }
}

/**
 * Get work schedule totals for payroll calculation
 *
 * This function validates that all schedules are approved before
 * returning totals, preventing payroll from running with unapproved data.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID
 * @param periodStart - Payroll period start (typically first day of month)
 * @param periodEnd - Payroll period end (typically last day of month)
 * @returns Work totals with validation status
 *
 * @throws PayrollIntegrationError if schedules are not approved
 *
 * @example
 * ```typescript
 * // When running payroll for October 2025
 * const totals = await getWorkScheduleTotalsForPayroll(
 *   employeeId,
 *   tenantId,
 *   new Date('2025-10-01'),
 *   new Date('2025-10-31')
 * );
 *
 * if (totals.hasUnapproved) {
 *   throw new Error(`Cannot run payroll: ${totals.unapprovedCount} unapproved schedules`);
 * }
 *
 * // Pass to payroll calculation
 * await calculatePayrollV2({
 *   employeeId,
 *   countryCode: 'CI',
 *   periodStart: new Date('2025-10-01'),
 *   periodEnd: new Date('2025-10-31'),
 *   baseSalary: 500000,
 *   rateType: 'DAILY',
 *   daysWorkedThisMonth: totals.daysWorked, // 22
 *   hoursWorkedThisMonth: totals.totalHours, // 176
 * });
 * ```
 */
export async function getWorkScheduleTotalsForPayroll(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<WorkScheduleSummary & { isValid: boolean; validationMessage?: string }> {
  // Get totals
  const totals = await calculateMonthTotals(employeeId, tenantId, periodStart);

  // Validate all schedules are approved
  const validation = await validateSchedulesForPayroll(
    employeeId,
    tenantId,
    periodStart,
    periodEnd
  );

  return {
    ...totals,
    isValid: validation.valid,
    validationMessage: validation.message,
  };
}

/**
 * Validate work schedules before payroll run
 *
 * Batch validation for multiple employees.
 * Returns list of employees with unapproved schedules.
 *
 * @param employeeIds - Array of employee UUIDs
 * @param tenantId - Tenant UUID
 * @param periodStart - Payroll period start
 * @param periodEnd - Payroll period end
 * @returns Validation results for each employee
 *
 * @example
 * ```typescript
 * // Before running payroll for all daily workers
 * const dailyWorkers = employees.filter(e => e.rateType === 'DAILY');
 * const employeeIds = dailyWorkers.map(e => e.id);
 *
 * const validation = await validateWorkSchedulesForPayrollBatch(
 *   employeeIds,
 *   tenantId,
 *   new Date('2025-10-01'),
 *   new Date('2025-10-31')
 * );
 *
 * const failed = validation.filter(v => !v.isValid);
 * if (failed.length > 0) {
 *   console.error(`Cannot run payroll for ${failed.length} employees`);
 *   console.error(failed.map(f => f.employeeName));
 * }
 * ```
 */
export async function validateWorkSchedulesForPayrollBatch(
  employeeIds: string[],
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<
  Array<{
    employeeId: string;
    isValid: boolean;
    unapprovedCount: number;
    message?: string;
  }>
> {
  const results = await Promise.all(
    employeeIds.map(async (employeeId) => {
      const validation = await validateSchedulesForPayroll(
        employeeId,
        tenantId,
        periodStart,
        periodEnd
      );

      return {
        employeeId,
        isValid: validation.valid,
        unapprovedCount: validation.unapprovedCount,
        message: validation.message,
      };
    })
  );

  return results;
}

/**
 * Calculate prorated salary for daily/hourly workers
 *
 * Calculates prorated salary based on standard monthly rate and actual
 * days/hours worked.
 *
 * @param monthlySalary - Standard monthly salary rate
 * @param standardDays - Standard working days per month (typically 22)
 * @param daysWorked - Actual days worked this month
 * @returns Prorated salary
 *
 * @example
 * ```typescript
 * // Daily worker with 500,000 FCFA monthly rate, worked 20 days out of 22
 * const prorated = calculateProratedSalary(500000, 22, 20);
 * // Returns: 454,545 FCFA (500000 / 22 * 20)
 * ```
 */
export function calculateProratedSalary(
  monthlySalary: number,
  standardDays: number,
  daysWorked: number
): number {
  if (standardDays <= 0) {
    throw new PayrollIntegrationError('Standard days must be greater than 0', 'INVALID_STANDARD_DAYS');
  }

  if (daysWorked < 0) {
    throw new PayrollIntegrationError('Days worked cannot be negative', 'INVALID_DAYS_WORKED');
  }

  const dailyRate = monthlySalary / standardDays;
  return Math.round(dailyRate * daysWorked);
}

/**
 * Calculate hourly rate from monthly salary
 *
 * @param monthlySalary - Monthly salary
 * @param standardHoursPerMonth - Standard hours per month (typically 173.33 for 40h/week)
 * @returns Hourly rate
 *
 * @example
 * ```typescript
 * const hourlyRate = calculateHourlyRate(500000, 173.33);
 * // Returns: 2,885 FCFA/hour
 * ```
 */
export function calculateHourlyRate(
  monthlySalary: number,
  standardHoursPerMonth: number = 173.33 // 40h/week * 52 weeks / 12 months
): number {
  if (standardHoursPerMonth <= 0) {
    throw new PayrollIntegrationError('Standard hours must be greater than 0', 'INVALID_STANDARD_HOURS');
  }

  return Math.round(monthlySalary / standardHoursPerMonth);
}

/**
 * Calculate salary from hours worked
 *
 * @param monthlySalary - Standard monthly salary
 * @param standardHoursPerMonth - Standard hours per month
 * @param hoursWorked - Actual hours worked
 * @returns Calculated salary
 *
 * @example
 * ```typescript
 * // Hourly worker, 500,000 monthly rate, worked 150 hours
 * const salary = calculateSalaryFromHours(500000, 173.33, 150);
 * // Returns: 432,692 FCFA
 * ```
 */
export function calculateSalaryFromHours(
  monthlySalary: number,
  standardHoursPerMonth: number,
  hoursWorked: number
): number {
  const hourlyRate = calculateHourlyRate(monthlySalary, standardHoursPerMonth);
  return Math.round(hourlyRate * hoursWorked);
}

/**
 * Get payroll calculation parameters for work schedule employee
 *
 * Helper to prepare payroll calculation input for daily/hourly workers.
 * Automatically determines rate type and calculates prorated amounts.
 *
 * @param employee - Employee data
 * @param totals - Work schedule totals
 * @param periodStart - Payroll period start
 * @param periodEnd - Payroll period end
 * @returns Parameters ready for calculatePayrollV2
 *
 * @example
 * ```typescript
 * const employee = {
 *   id: '123',
 *   baseSalary: 500000,
 *   rateType: 'DAILY',
 *   countryCode: 'CI',
 * };
 *
 * const totals = await getWorkScheduleTotalsForPayroll(
 *   employee.id,
 *   tenantId,
 *   periodStart,
 *   periodEnd
 * );
 *
 * const payrollParams = getPayrollParametersForScheduleEmployee(
 *   employee,
 *   totals,
 *   periodStart,
 *   periodEnd
 * );
 *
 * const payroll = await calculatePayrollV2(payrollParams);
 * ```
 */
export function getPayrollParametersForScheduleEmployee(
  employee: {
    id: string;
    baseSalary: number;
    rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
    countryCode: string;
    [key: string]: any;
  },
  totals: WorkScheduleSummary,
  periodStart: Date,
  periodEnd: Date
): {
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
  daysWorkedThisMonth?: number;
  hoursWorkedThisMonth?: number;
  [key: string]: any;
} {
  const baseParams = {
    employeeId: employee.id,
    countryCode: employee.countryCode,
    periodStart,
    periodEnd,
    baseSalary: employee.baseSalary,
    rateType: employee.rateType,
  };

  switch (employee.rateType) {
    case 'DAILY':
      return {
        ...baseParams,
        daysWorkedThisMonth: totals.daysWorked,
        hoursWorkedThisMonth: totals.totalHours,
      };

    case 'HOURLY':
      return {
        ...baseParams,
        hoursWorkedThisMonth: totals.totalHours,
        daysWorkedThisMonth: totals.daysWorked,
      };

    case 'MONTHLY':
    default:
      // Monthly workers don't need schedule data
      return baseParams;
  }
}
