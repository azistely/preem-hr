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
  gratificationRate?: number; // Default: 6.25% (75% annual bonus / 12 months)
  congesPayesRate?: number;   // Default: 10.15% (2.2 days/month provision)
  indemnitePrecariteRate?: number; // Default: 3% of (base + grat + congés)

  // Transport allowance
  dailyTransportRate?: number; // FCFA per day (from tenant)
  presenceDays?: number;       // IMPORTANT: Actual days present (for transport), NOT equivalent days (hours ÷ 8)

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
  gratification: number;          // 6.25% of brutBase - Prime annuelle de 75%
  congesPayes: number;            // 10.15% of (brutBase + gratification) - Provision 2.2 jours/mois
  indemnitPrecarite: number;      // 3% of (brutBase + gratification + congesPayes) - CDDTI only

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
 * // - gratification: 811 FCFA (6.25% of 12,981)
 * // - congesPayes: 1,400 FCFA (10.15% of 13,792)
 * // - indemnitPrecarite: 456 FCFA (3% of 15,192)
 * // - transport: 1,875 FCFA (500 × 3.75 days)
 * // - totalBrut: 17,523 FCFA
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
  // CDDTI-specific rates (derived from official formulas)
  // Source: SALAIRE TYPE JOURNALIER NOUVEAU 2023.txt
  // Gratification: (Monthly × 0.75) / (12 × 173.33) = Hourly × 0.0625
  // Congés payés: (Base + Grat) × 8 × 2.2 / 173.33 = (Base + Grat) × 0.10153
  // Précarité: (Base + Grat + Congés) × 3%
  const gratificationRate = input.gratificationRate ?? 0.0625; // 6.25% - Prime annuelle de 75% répartie sur l'année
  const congesPayesRate = input.congesPayesRate ?? 0.10153; // 10.153% - Provision de 2.2 jours/mois
  const indemnitePrecariteRate = input.indemnitePrecariteRate ?? 0.03; // 3% (CDDTI only)

  const gratification = Math.round(brutBase * gratificationRate);
  const congesPayes = Math.round((brutBase + gratification) * congesPayesRate);
  const indemnitPrecarite = input.contractType === 'CDDTI'
    ? Math.round((brutBase + gratification + congesPayes) * indemnitePrecariteRate)
    : 0;

  // ========================================
  // STEP 5: Calculate transport allowance
  // ========================================
  // ✅ IMPORTANT: Use actual presence days (if provided) instead of equivalent days
  // Per user feedback (2025-11-03): "Les jours sont uniquement utilisés pour l'indemnité de transport.
  // Et pour les jours, dès lors que le salarié est arrivé sur site, il a droit à 1 jour d'indemnité
  // de transport, même s'il n'a travaillé qu'une heure."
  //
  // Translation: Transport is based on presence days (1 day on site = 1 full transport),
  // NOT equivalent days (hours ÷ 8)
  const equivalentDays = calculateEquivalentDays(input.hoursWorked);
  const daysForTransport = input.presenceDays !== undefined ? input.presenceDays : equivalentDays;
  const transportAllowance = Math.round((input.dailyTransportRate || 0) * daysForTransport);

  console.log('[DAILY WORKERS] Transport calculation:', {
    hoursWorked: input.hoursWorked,
    equivalentDays, // For ITS/deductions prorata
    presenceDays: input.presenceDays,
    daysForTransport,
    dailyRate: input.dailyTransportRate || 0,
    transportAllowance,
  });

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

  // Gratification (75% annual bonus spread over 12 months)
  if (gratification > 0) {
    components.push({
      code: '31',
      name: 'Prime de gratification',
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
 * Per guide_paie_journaliers_cote_ivoire.md (lines 229-315):
 * - Calculate daily tax using progressive brackets
 * - Apply FIXED family deduction (subtract, not divide)
 * - Family deduction = (monthly deduction ÷ 30) × days worked
 *
 * @param totalBrut - Total gross salary for period
 * @param equivalentDays - Days worked (hours ÷ 8)
 * @param fiscalParts - Fiscal parts (1.0, 1.5, 2.0, etc.)
 * @param monthlyBrackets - Monthly tax brackets from database
 * @param familyDeductions - Family deduction rules from database (monthly amounts)
 * @returns Total ITS for the period
 *
 * @example
 * ```typescript
 * // Guide example (lines 268-315): 10,000 FCFA/day, 10 days, 3 fiscal parts
 * const its = calculateDailyITS(
 *   100000,  // Total brut (10,000 × 10 days)
 *   10,      // Equivalent days
 *   3.0,     // Fiscal parts
 *   monthlyBrackets,
 *   familyDeductions
 * );
 *
 * // Calculation:
 * // 1. Daily gross = 100,000 / 10 = 10,000 FCFA/day
 * // 2. Apply daily brackets → 1,300 FCFA/day tax
 * // 3. Gross tax = 1,300 × 10 = 13,000 FCFA
 * // 4. Family deduction = 733 FCFA/day × 10 = 7,330 FCFA (for 3 parts)
 * // 5. Net ITS = 13,000 - 7,330 = 5,670 FCFA ✅
 * ```
 */
export function calculateDailyITS(
  totalBrut: number,
  equivalentDays: number,
  fiscalParts: number,
  monthlyBrackets: Array<{ min: number; max: number | null; rate: number }>,
  familyDeductions: Array<{ fiscalParts: number; deductionAmount: number }> = []
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

  // Calculate daily tax using progressive brackets
  let dailyTax = 0;
  let remainingIncome = dailyGross;

  for (const bracket of dailyBrackets) {
    if (remainingIncome <= 0) break;

    const bracketMax = bracket.max || Infinity;
    const bracketSize = bracketMax - bracket.min;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);

    dailyTax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  // Calculate gross tax for the period
  const grossTax = Math.round(dailyTax * equivalentDays);

  // Get family deduction (FIXED amount, not division!)
  // Per guide lines 248-259: Monthly deductions range from 0 to 44,000 FCFA
  // Daily deduction = monthly deduction ÷ 30 (round first, then multiply)
  const monthlyDeduction = getFamilyDeduction(fiscalParts, familyDeductions);
  const dailyDeduction = Math.round(monthlyDeduction / 30); // Round daily rate first (guide practice)
  const totalDeduction = dailyDeduction * equivalentDays;

  // Subtract family deduction from gross tax (guide line 313)
  const netITS = Math.max(0, grossTax - totalDeduction);

  console.log('[DAILY ITS CALCULATION]', {
    totalBrut,
    equivalentDays,
    dailyGross: dailyGross.toFixed(2),
    dailyTax: dailyTax.toFixed(2),
    grossTax,
    fiscalParts,
    monthlyDeduction,
    dailyDeduction: dailyDeduction.toFixed(2),
    totalDeduction,
    netITS,
  });

  return netITS;
}

/**
 * Get family deduction amount from rules
 *
 * @param fiscalParts - Fiscal parts (1.0, 1.5, 2.0, etc.)
 * @param familyDeductions - Family deduction rules from database
 * @returns Monthly deduction amount in FCFA
 */
function getFamilyDeduction(
  fiscalParts: number,
  familyDeductions: Array<{ fiscalParts: number; deductionAmount: number }>
): number {
  const rule = familyDeductions.find(
    r => Number(r.fiscalParts) === fiscalParts
  );

  return rule ? Number(rule.deductionAmount) : 0;
}
