/**
 * CNPS (Caisse Nationale de Prévoyance Sociale) Calculation Service
 *
 * Calculates social security contributions for Côte d'Ivoire:
 * - Pension (Retraite): Employee 6.3%, Employer 7.7%, ceiling 3,375,000 FCFA
 * - Maternity: Employer only 0.75%, ceiling 70,000 FCFA
 * - Family Allowance: Employer only 5%, ceiling 70,000 FCFA
 * - Work Accident: Employer only 2-5% (sector-dependent), ceiling 70,000 FCFA
 *
 * Stories 2.1 & 2.2: CNPS Contributions Calculation
 *
 * Source: payroll-cote-d-ivoire.md:46-61
 */

import { CNPS_RATES } from '../constants';
import type { CNPSPensionResult, CNPSOtherResult, CNPSResult } from '../types';

/**
 * Calculate CNPS Pension contributions (Retraite)
 *
 * Rules:
 * - Employee: 6.3% of gross salary (capped at 3,375,000 FCFA)
 * - Employer: 7.7% of gross salary (capped at 3,375,000 FCFA)
 *
 * @param grossSalary - Monthly gross salary in FCFA
 * @returns Pension contribution breakdown
 *
 * @example
 * ```typescript
 * // Example 7.1 from regulations (300k gross)
 * const result = calculateCNPSPension(300000);
 * // result.employee = 18,900 (300k × 6.3%)
 * // result.employer = 23,100 (300k × 7.7%)
 *
 * // High earner above ceiling
 * const result2 = calculateCNPSPension(5000000);
 * // result2.employee = 212,625 (3,375,000 × 6.3%)
 * // result2.employer = 259,875 (3,375,000 × 7.7%)
 * ```
 */
export function calculateCNPSPension(grossSalary: number): CNPSPensionResult {
  // Apply ceiling
  const cappedSalary = Math.min(grossSalary, CNPS_RATES.pension.ceiling);

  // Calculate contributions
  const employee = Math.round(cappedSalary * CNPS_RATES.pension.employee);
  const employer = Math.round(cappedSalary * CNPS_RATES.pension.employer);

  return {
    grossSalary,
    cappedSalary,
    employee,
    employer,
    total: employee + employer,
  };
}

/**
 * Calculate other CNPS contributions
 *
 * Includes:
 * - Maternity (Maternité): 0.75% employer only
 * - Family Allowance (Prestations familiales): 5% employer only
 * - Work Accident (Accidents du travail): 2-5% employer (sector-dependent)
 *
 * All use the same ceiling: 70,000 FCFA
 *
 * @param grossSalary - Monthly gross salary in FCFA
 * @param options - Configuration options
 * @param options.sector - Business sector (affects work accident rate)
 * @returns Other CNPS contributions breakdown
 *
 * @example
 * ```typescript
 * // Salary below ceiling
 * const result = calculateCNPSOther(60000, { sector: 'services' });
 * // result.maternity = 450 (60k × 0.75%)
 * // result.family = 3,000 (60k × 5%)
 * // result.workAccident = 1,200 (60k × 2%)
 *
 * // Salary above ceiling
 * const result2 = calculateCNPSOther(300000, { sector: 'services' });
 * // result2.maternity = 525 (70k × 0.75%)
 * // result2.family = 3,500 (70k × 5%)
 * // result2.workAccident = 1,400 (70k × 2%)
 *
 * // Construction sector (higher work accident rate)
 * const result3 = calculateCNPSOther(100000, { sector: 'construction' });
 * // result3.workAccident = 3,500 (70k × 5%)
 * ```
 */
export function calculateCNPSOther(
  grossSalary: number,
  options: {
    sector?: 'services' | 'construction' | 'agriculture' | 'other';
  } = {}
): CNPSOtherResult {
  // Apply ceiling (same for all three)
  const cappedSalary = Math.min(grossSalary, CNPS_RATES.maternity.ceiling);

  // Maternity contribution (employer only)
  const maternity = Math.round(cappedSalary * CNPS_RATES.maternity.employer);

  // Family allowance contribution (employer only)
  const family = Math.round(cappedSalary * CNPS_RATES.family.employer);

  // Work accident rate depends on sector
  const workAccidentRate = getWorkAccidentRate(options.sector);
  const workAccident = Math.round(cappedSalary * workAccidentRate);

  return {
    grossSalary,
    cappedSalary,
    maternity,
    family,
    workAccident,
    total: maternity + family + workAccident,
  };
}

/**
 * Get work accident contribution rate based on business sector
 *
 * Rates:
 * - Services: 2% (minimum)
 * - Construction/BTP: 5% (maximum)
 * - Agriculture: 3.5% (mid-range)
 * - Other: 2% (default to minimum)
 */
function getWorkAccidentRate(
  sector?: 'services' | 'construction' | 'agriculture' | 'other'
): number {
  switch (sector) {
    case 'construction':
      return CNPS_RATES.workAccident.employerMax;
    case 'agriculture':
      return 0.035; // Mid-range
    case 'services':
    case 'other':
    default:
      return CNPS_RATES.workAccident.employerMin;
  }
}

/**
 * Calculate all CNPS contributions (pension + other)
 *
 * This is a convenience function that calculates all CNPS contributions
 * at once and provides a complete breakdown.
 *
 * @param grossSalary - Monthly gross salary in FCFA
 * @param options - Configuration options
 * @returns Complete CNPS contribution breakdown
 *
 * @example
 * ```typescript
 * const result = calculateCNPS(300000, { sector: 'services' });
 * // result.totalEmployee = 18,900
 * // result.totalEmployer = 28,125
 * ```
 */
export function calculateCNPS(
  grossSalary: number,
  options: {
    sector?: 'services' | 'construction' | 'agriculture' | 'other';
  } = {}
): CNPSResult {
  const pension = calculateCNPSPension(grossSalary);
  const other = calculateCNPSOther(grossSalary, options);

  return {
    pension,
    other,
    totalEmployee: pension.employee,
    totalEmployer: pension.employer + other.total,
  };
}
