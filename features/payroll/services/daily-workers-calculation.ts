/**
 * Daily Workers (Journaliers) Payroll Calculation
 *
 * Special calculation logic for daily/hourly workers with prorated deductions.
 * Integrates with the main payroll calculation flow in payroll-calculation-v2.ts
 *
 * Based on DAILY-WORKERS-ARCHITECTURE-V2.md v3.0
 */

import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';
import {
  calculateHourlyRate,
  classifyOvertime,
  calculateEquivalentDays,
  type WeeklyHoursRegime,
  type EmployeeType,
} from './daily-workers-utils';

/**
 * Input for daily workers gross calculation
 */
export interface DailyWorkersGrossInput {
  // Base salary (categorical salary - salaire catégoriel)
  categoricalSalary: number;

  // Hours worked in period
  hoursWorked: number;

  // Employee configuration
  weeklyHoursRegime: WeeklyHoursRegime;
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';

  // Rates for CDDTI-specific components
  gratificationRate?: number; // Default: 3.33% (unpaid leave provision)
  congesPayesRate?: number;   // Default: 10% (paid leave provision)
  indemnitePrecariteRate?: number; // Default: 3% (CDDTI only)

  // Transport allowance
  dailyTransportRate?: number; // FCFA per day (from tenant)

  // Overtime configuration
  saturdayHours?: number;   // Hours worked on Saturday
  sundayHours?: number;     // Hours worked on Sunday/holiday
  nightHours?: number;      // Hours worked at night (21h-5h)
}

/**
 * Result of daily workers gross calculation
 */
export interface DailyWorkersGrossResult {
  // Base components
  regularGross: number;           // Regular hours × hourly rate
  overtimeGross1: number;         // First 8 OT hours × 1.15
  overtimeGross2: number;         // Beyond 8 OT hours × 1.50
  saturdayGross: number;          // Saturday hours × 1.40
  sundayGross: number;            // Sunday/holiday × 1.40
  nightGross: number;             // Night hours × 1.75

  // Subtotal before CDDTI components
  brutBase: number;

  // CDDTI-specific components
  gratification: number;          // 3.33% of brutBase
  congesPayes: number;            // 10% of brutBase
  indemnitPrecarite: number;      // 3% of brutBase (CDDTI only)

  // Transport
  transportAllowance: number;     // dailyRate × equivalentDays

  // Total
  totalBrut: number;              // Sum of all components

  // Breakdown details
  equivalentDays: number;         // For prorata (hours ÷ 8)
  hourlyRate: number;             // Categorical salary ÷ divisor
  overtimeBreakdown: {
    regularHours: number;
    hours_threshold_to_plus8: number;
    hours_above_plus8: number;
  };

  // Component list for payroll line item
  components: SalaryComponentInstance[];
}

/**
 * Calculate gross salary for daily/hourly workers
 *
 * Applies special rules:
 * - Hourly rate based on categorical salary and weekly hours regime
 * - Dynamic overtime thresholds
 * - CDDTI-specific components (gratification, congés payés, indemnité de précarité)
 * - Transport allowance based on equivalent days worked
 *
 * @param input - Daily workers gross calculation input
 * @returns Detailed breakdown of gross salary calculation
 *
 * @example
 * ```typescript
 * // Example: CDDTI worker, 30 hours worked, 40h regime
 * const result = calculateDailyWorkersGross({
 *   categoricalSalary: 75000,
 *   hoursWorked: 30,
 *   weeklyHoursRegime: '40h',
 *   contractType: 'CDDTI',
 *   dailyTransportRate: 500,
 * });
 *
 * // Result:
 * // - hourlyRate: 432.7 FCFA
 * // - regularGross: 12,981 FCFA (30h × 432.7)
 * // - gratification: 432 FCFA (3.33%)
 * // - congesPayes: 1,298 FCFA (10%)
 * // - indemnitPrecarite: 389 FCFA (3%)
 * // - transport: 1,875 FCFA (500 × 3.75 days)
 * // - totalBrut: 16,975 FCFA
 * ```
 */
export function calculateDailyWorkersGross(
  input: DailyWorkersGrossInput
): DailyWorkersGrossResult {
  // ========================================
  // STEP 1: Calculate hourly rate
  // ========================================
  const hourlyRate = calculateHourlyRate(
    input.categoricalSalary,
    input.weeklyHoursRegime
  );

  // ========================================
  // STEP 2: Classify hours into regular and overtime
  // ========================================
  const weeklyHours = input.hoursWorked - (input.saturdayHours || 0) - (input.sundayHours || 0) - (input.nightHours || 0);
  const overtimeBreakdown = classifyOvertime(weeklyHours, input.weeklyHoursRegime);

  // ========================================
  // STEP 3: Calculate gross for each hour type
  // ========================================
  const regularGross = Math.round(hourlyRate * overtimeBreakdown.regularHours);
  const overtimeGross1 = Math.round(hourlyRate * 1.15 * overtimeBreakdown.hours_threshold_to_plus8);
  const overtimeGross2 = Math.round(hourlyRate * 1.50 * overtimeBreakdown.hours_above_plus8);
  const saturdayGross = Math.round(hourlyRate * 1.40 * (input.saturdayHours || 0));
  const sundayGross = Math.round(hourlyRate * 1.40 * (input.sundayHours || 0));
  const nightGross = Math.round(hourlyRate * 1.75 * (input.nightHours || 0));

  const brutBase = regularGross + overtimeGross1 + overtimeGross2 + saturdayGross + sundayGross + nightGross;

  // ========================================
  // STEP 4: Add CDDTI-specific components
  // ========================================
  const gratificationRate = input.gratificationRate ?? 0.0333; // 3.33% (1/30 for unpaid leave)
  const congesPayesRate = input.congesPayesRate ?? 0.10; // 10% (paid leave provision)
  const indemnitePrecariteRate = input.indemnitePrecariteRate ?? 0.03; // 3% (CDDTI only)

  const gratification = Math.round(brutBase * gratificationRate);
  const congesPayes = Math.round(brutBase * congesPayesRate);
  const indemnitPrecarite = input.contractType === 'CDDTI'
    ? Math.round(brutBase * indemnitePrecariteRate)
    : 0;

  // ========================================
  // STEP 5: Calculate transport allowance
  // ========================================
  const equivalentDays = calculateEquivalentDays(input.hoursWorked);
  const transportAllowance = Math.round((input.dailyTransportRate || 0) * equivalentDays);

  // ========================================
  // STEP 6: Calculate total
  // ========================================
  const totalBrut = brutBase + gratification + congesPayes + indemnitPrecarite + transportAllowance;

  // ========================================
  // STEP 7: Build component list
  // ========================================
  const components: SalaryComponentInstance[] = [];

  // Regular hours
  if (regularGross > 0) {
    components.push({
      code: '11',
      name: 'Salaire brut de base',
      amount: regularGross,
      sourceType: 'standard',
    });
  }

  // Overtime (first 8 hours)
  if (overtimeGross1 > 0) {
    components.push({
      code: '41',
      name: 'Heures supplémentaires (1.15×)',
      amount: overtimeGross1,
      sourceType: 'standard',
    });
  }

  // Overtime (beyond 8 hours)
  if (overtimeGross2 > 0) {
    components.push({
      code: '42',
      name: 'Heures supplémentaires (1.50×)',
      amount: overtimeGross2,
      sourceType: 'standard',
    });
  }

  // Saturday hours
  if (saturdayGross > 0) {
    components.push({
      code: '43',
      name: 'Heures samedi (1.40×)',
      amount: saturdayGross,
      sourceType: 'standard',
    });
  }

  // Sunday/holiday hours
  if (sundayGross > 0) {
    components.push({
      code: '44',
      name: 'Heures dimanche/férié (1.40×)',
      amount: sundayGross,
      sourceType: 'standard',
    });
  }

  // Night hours
  if (nightGross > 0) {
    components.push({
      code: '45',
      name: 'Heures de nuit (1.75×)',
      amount: nightGross,
      sourceType: 'standard',
    });
  }

  // Gratification (unpaid leave provision)
  if (gratification > 0) {
    components.push({
      code: '31',
      name: 'Gratification congés non pris',
      amount: gratification,
      sourceType: 'standard',
    });
  }

  // Congés payés (paid leave provision)
  if (congesPayes > 0) {
    components.push({
      code: '32',
      name: 'Provision congés payés',
      amount: congesPayes,
      sourceType: 'standard',
    });
  }

  // Indemnité de précarité (CDDTI only)
  if (indemnitPrecarite > 0) {
    components.push({
      code: '33',
      name: 'Indemnité de précarité',
      amount: indemnitPrecarite,
      sourceType: 'standard',
    });
  }

  // Transport allowance
  if (transportAllowance > 0) {
    components.push({
      code: '22',
      name: 'Indemnité de transport',
      amount: transportAllowance,
      sourceType: 'standard',
    });
  }

  return {
    regularGross,
    overtimeGross1,
    overtimeGross2,
    saturdayGross,
    sundayGross,
    nightGross,
    brutBase,
    gratification,
    congesPayes,
    indemnitPrecarite,
    transportAllowance,
    totalBrut,
    equivalentDays,
    hourlyRate,
    overtimeBreakdown,
    components,
  };
}

/**
 * Calculate prorated deductions for daily workers
 *
 * ALL deductions (CNPS, CMU, ITS) must be prorated based on equivalent days worked.
 *
 * @param totalBrut - Total gross salary
 * @param equivalentDays - Days worked (hours ÷ 8)
 * @param cnpsRate - CNPS employee rate (from database)
 * @param cmuFixedAmount - Fixed CMU amount (from database)
 * @returns Prorated deduction amounts
 *
 * @example
 * ```typescript
 * const deductions = calculateProratedDeductions(
 *   12981,  // Total brut
 *   3.75,   // Equivalent days (30h ÷ 8)
 *   0.0367, // CNPS rate (3.67%)
 *   1000    // CMU fixed amount
 * );
 *
 * // Result:
 * // - cnpsEmployee: 60 FCFA (12,981 × 3.67% × 3.75/30)
 * // - cmu: 1,000 FCFA (fixed if daysWorked > 0)
 * // - prorata: 0.125 (3.75 / 30)
 * ```
 */
export function calculateProratedDeductions(
  totalBrut: number,
  equivalentDays: number,
  cnpsRate: number,
  cmuFixedAmount: number
): {
  cnpsEmployee: number;
  cmu: number;
  prorata: number;
} {
  // Calculate prorata factor
  const prorata = equivalentDays / 30;

  // CNPS is prorated
  const cnpsEmployee = Math.round(totalBrut * cnpsRate * prorata);

  // CMU is prorated based on days worked
  // For daily/weekly workers: CMU = monthly amount × (days worked / 30)
  // Example: 5 days = 1,000 × (5/30) = 167 FCFA
  const cmu = Math.round(cmuFixedAmount * prorata);

  return {
    cnpsEmployee,
    cmu,
    prorata,
  };
}

/**
 * Calculate daily ITS (income tax) for journaliers
 *
 * Daily workers use daily tax brackets instead of monthly brackets.
 * Daily brackets = Monthly brackets ÷ 30
 *
 * @param totalBrut - Total gross salary for period
 * @param equivalentDays - Days worked (hours ÷ 8)
 * @param fiscalParts - Fiscal parts (1.0, 1.5, 2.0, etc.)
 * @param monthlyBrackets - Monthly tax brackets from database
 * @returns Total ITS for the period
 *
 * @example
 * ```typescript
 * // Monthly bracket: 0-50,000 = 0%, 50,001-130,000 = 10%, etc.
 * // Daily bracket: 0-1,667 = 0%, 1,668-4,333 = 10%, etc.
 *
 * const its = calculateDailyITS(
 *   12981,  // Total brut
 *   3.75,   // Equivalent days
 *   1.0,    // Fiscal parts
 *   monthlyBrackets
 * );
 *
 * // Calculation:
 * // 1. Daily gross = 12,981 / 3.75 = 3,462 FCFA/day
 * // 2. Apply daily brackets to 3,462 FCFA
 * // 3. Daily tax = X FCFA
 * // 4. Total ITS = X × 3.75 days
 * ```
 */
export function calculateDailyITS(
  totalBrut: number,
  equivalentDays: number,
  fiscalParts: number,
  monthlyBrackets: Array<{ min: number; max: number | null; rate: number }>
): number {
  if (equivalentDays === 0) return 0;

  // Convert monthly brackets to daily brackets
  const dailyBrackets = monthlyBrackets.map(bracket => ({
    min: bracket.min / 30,
    max: bracket.max ? bracket.max / 30 : null,
    rate: bracket.rate,
  }));

  // Calculate daily gross
  const dailyGross = totalBrut / equivalentDays;

  // Apply fiscal parts deduction
  const taxableDaily = dailyGross; // Fiscal parts are applied in bracket calculation

  // Calculate daily tax
  let dailyTax = 0;
  let remainingIncome = taxableDaily;

  for (const bracket of dailyBrackets) {
    if (remainingIncome <= 0) break;

    const bracketMax = bracket.max || Infinity;
    const bracketSize = bracketMax - bracket.min;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);

    dailyTax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  // Apply fiscal parts reduction
  dailyTax = dailyTax / fiscalParts;

  // Total ITS = daily tax × equivalent days
  const totalITS = Math.round(dailyTax * equivalentDays);

  return Math.max(0, totalITS);
}
