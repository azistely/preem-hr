/**
 * Overtime Calculation Service
 *
 * Calculates overtime pay with various multipliers according to
 * Côte d'Ivoire labor code (Décret n° 96-203 du 7 mars 1996).
 *
 * Story 5.1: Calculate Overtime Pay
 *
 * Source: payroll-cote-d-ivoire.md:96-112
 */

import { OVERTIME_MULTIPLIERS, OVERTIME_LIMITS, WORKING_HOURS } from '../constants';
import type { OvertimeHours, OvertimeResult, OvertimeType } from '../types';

/**
 * Validate overtime hours against legal limits
 *
 * Limits:
 * - Maximum 15 hours per week
 * - Maximum 3 hours per day
 *
 * @throws Error if overtime exceeds legal limits
 */
function validateOvertimeLimits(totalHours: number): void {
  if (totalHours > OVERTIME_LIMITS.maxHoursPerWeek) {
    throw new Error(
      `Dépassement de la limite d'heures supplémentaires (${OVERTIME_LIMITS.maxHoursPerWeek}h/semaine). ` +
      `Total demandé: ${totalHours}h`
    );
  }
}

/**
 * Get multiplier for overtime type
 */
function getMultiplier(type: OvertimeType): number {
  return OVERTIME_MULTIPLIERS[type];
}

/**
 * Calculate hourly rate from monthly salary
 *
 * Formula: Monthly salary / 173.33 hours
 * (40 hours/week × 52 weeks / 12 months)
 *
 * @param monthlySalary - Monthly base salary
 * @returns Hourly rate in FCFA
 */
export function calculateHourlyRate(monthlySalary: number): number {
  return monthlySalary / WORKING_HOURS.monthlyHours;
}

/**
 * Calculate overtime pay
 *
 * Applies correct multipliers based on time classification:
 * - Hours 41-46: × 1.15 (15% increase)
 * - Hours 46+: × 1.50 (50% increase)
 * - Night work: × 1.75 (75% increase)
 * - Sunday/Holiday: × 1.75 (75% increase)
 * - Night + Sunday/Holiday: × 2.00 (100% increase)
 *
 * @param params - Calculation parameters
 * @param params.hourlyRate - Hourly rate (or monthly salary to auto-calculate)
 * @param params.monthlySalary - Monthly salary (alternative to hourlyRate)
 * @param params.hours - Array of overtime hours by type
 * @returns Complete overtime calculation with breakdown
 *
 * @example
 * ```typescript
 * // Example 7.2 from regulations
 * const result = calculateOvertime({
 *   monthlySalary: 200000,
 *   hours: [
 *     { count: 6, type: 'hours_41_to_46' },
 *     { count: 4, type: 'hours_above_46' },
 *   ],
 * });
 * // Hourly rate: 200,000 / 173.33 = 1,154 FCFA/h
 * // Hours 41-46: 6 × 1,154 × 1.15 = 7,968 FCFA
 * // Hours 46+: 4 × 1,154 × 1.50 = 6,924 FCFA
 * // Total: 14,892 FCFA
 *
 * // Night + Sunday work
 * const result2 = calculateOvertime({
 *   hourlyRate: 1000,
 *   hours: [
 *     { count: 8, type: 'night_sunday_or_holiday' },
 *   ],
 * });
 * // Night + Sunday: 8 × 1,000 × 2.00 = 16,000 FCFA
 * ```
 */
export function calculateOvertime(params: {
  hourlyRate?: number;
  monthlySalary?: number;
  hours: OvertimeHours[];
}): OvertimeResult {
  // Calculate hourly rate if not provided
  const hourlyRate = params.hourlyRate ||
    (params.monthlySalary ? calculateHourlyRate(params.monthlySalary) : 0);

  if (hourlyRate <= 0) {
    throw new Error(
      'Le taux horaire doit être fourni ou calculé à partir du salaire mensuel'
    );
  }

  // Validate total hours
  const totalHours = params.hours.reduce((sum, h) => sum + h.count, 0);
  validateOvertimeLimits(totalHours);

  // Calculate overtime for each type
  const breakdown = params.hours.map((item) => {
    const multiplier = getMultiplier(item.type);
    const amount = item.count * hourlyRate * multiplier;

    return {
      type: item.type,
      hours: item.count,
      multiplier,
      amount,
    };
  });

  // Calculate totals by type
  const totals: Partial<Record<OvertimeType, number>> = {};
  breakdown.forEach((item) => {
    totals[item.type] = Math.round((totals[item.type] || 0) + item.amount);
  });

  const total = Math.round(breakdown.reduce((sum, item) => sum + item.amount, 0));

  return {
    baseSalary: params.monthlySalary || 0,
    hourlyRate,
    ...totals,
    total,
    breakdown,
  };
}
