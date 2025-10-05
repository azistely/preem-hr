/**
 * Base Salary and Gross Calculation Service
 *
 * Handles calculation of gross salary including:
 * - Base salary with proration for partial months
 * - Allowances (housing, transport, meal)
 * - Validation against SMIG minimum wage
 *
 * Story 1.1: Calculate Monthly Gross Salary
 */

import { SMIG, STANDARD_DAYS_IN_MONTH } from '../constants';
import type { GrossCalculationInput, GrossCalculationResult } from '../types';
import { calculateOvertime } from './overtime-calculation';

/**
 * Calculate the number of days in a given month
 */
function getDaysInMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the number of days worked in a period
 *
 * Handles:
 * - Mid-month hires
 * - Mid-month terminations
 * - Regular full-month periods
 */
function calculateDaysWorked(
  periodStart: Date,
  periodEnd: Date,
  hireDate?: Date,
  terminationDate?: Date
): { daysWorked: number; daysInPeriod: number; prorationFactor: number } {
  const daysInPeriod = getDaysInMonth(periodStart);

  // Determine actual work start date
  const workStart = hireDate && hireDate > periodStart ? hireDate : periodStart;

  // Determine actual work end date
  const workEnd =
    terminationDate && terminationDate < periodEnd ? terminationDate : periodEnd;

  // If hired after period end or terminated before period start
  if (workStart > periodEnd || workEnd < periodStart) {
    return {
      daysWorked: 0,
      daysInPeriod,
      prorationFactor: 0,
    };
  }

  // Calculate days worked (inclusive)
  const daysWorked = Math.floor(
    (workEnd.getTime() - workStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  // Proration factor
  const prorationFactor = daysWorked / daysInPeriod;

  return {
    daysWorked,
    daysInPeriod,
    prorationFactor,
  };
}

/**
 * Validate that salary meets minimum wage requirements (SMIG)
 */
function validateSMIG(baseSalary: number): void {
  if (baseSalary < SMIG) {
    throw new Error(
      `Le salaire de base (${baseSalary} FCFA) est inférieur au SMIG (${SMIG} FCFA)`
    );
  }
}

/**
 * Calculate prorated base salary
 */
function calculateBasePay(
  baseSalary: number,
  prorationFactor: number
): number {
  return Math.round(baseSalary * prorationFactor);
}

/**
 * Calculate total allowances
 */
function calculateAllowances(
  housingAllowance: number = 0,
  transportAllowance: number = 0,
  mealAllowance: number = 0
): number {
  return Math.round(housingAllowance + transportAllowance + mealAllowance);
}

/**
 * Calculate gross salary for an employee
 *
 * This is the main function for Story 1.1
 *
 * @param input - Gross calculation input parameters
 * @returns Complete gross calculation result with breakdown
 *
 * @example
 * ```typescript
 * // Full month calculation
 * const result = calculateGrossSalary({
 *   employeeId: '123',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 300000,
 *   housingAllowance: 50000,
 * });
 * // result.totalGross = 350000
 *
 * // Mid-month hire
 * const result2 = calculateGrossSalary({
 *   employeeId: '123',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 300000,
 *   hireDate: new Date('2025-01-15'),
 * });
 * // result2.proratedSalary = 164516 (17 days / 31 days)
 * ```
 */
export function calculateGrossSalary(
  input: GrossCalculationInput
): GrossCalculationResult {
  // Validate SMIG
  validateSMIG(input.baseSalary);

  // Calculate days worked and proration
  const { daysWorked, daysInPeriod, prorationFactor } = calculateDaysWorked(
    input.periodStart,
    input.periodEnd,
    input.hireDate,
    input.terminationDate
  );

  // Calculate prorated base salary
  const proratedSalary = calculateBasePay(input.baseSalary, prorationFactor);

  // Calculate allowances
  const allowances = calculateAllowances(
    input.housingAllowance,
    input.transportAllowance,
    input.mealAllowance
  );

  // Calculate overtime if provided
  let overtimePay = 0;
  if (input.overtimeHours && input.overtimeHours.length > 0) {
    const overtimeResult = calculateOvertime({
      hourlyRate: input.baseSalary / 173.33,
      hours: input.overtimeHours,
    });
    overtimePay = overtimeResult.total;
  }

  // Bonuses
  const bonuses = input.bonuses || 0;

  // Total gross
  const totalGross = proratedSalary + allowances + overtimePay + bonuses;

  return {
    baseSalary: input.baseSalary,
    proratedSalary,
    allowances,
    overtimePay,
    bonuses,
    totalGross,
    daysWorked,
    daysInPeriod,
    prorationFactor,
    breakdown: {
      base: proratedSalary,
      allowances,
      overtime: overtimePay,
      bonuses,
    },
  };
}

/**
 * Get current salary for an employee as of a specific date
 *
 * This would query the employee_salaries table with effective dating.
 * For now, this is a placeholder that would be implemented with database access.
 */
export async function getCurrentSalary(
  employeeId: string,
  asOfDate: Date
): Promise<{
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  mealAllowance: number;
}> {
  // This would be implemented with actual database query
  // For now, returning a placeholder
  throw new Error('Not implemented - requires database access');
}
