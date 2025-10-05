/**
 * CMU (Couverture Maladie Universelle) Calculation Service
 *
 * Universal Health Coverage contributions for Côte d'Ivoire:
 * - Employee: Fixed 1,000 FCFA
 * - Employer for employee: 500 FCFA
 * - Employer for family: 4,500 FCFA (spouse + up to 6 children)
 *
 * Story 3.1: Calculate CMU Contributions
 *
 * Source: payroll-cote-d-ivoire.md:59-61
 */

import { CMU_RATES } from '../constants';
import type { CMUResult } from '../types';

/**
 * Calculate CMU contributions
 *
 * CMU is a fixed-rate contribution (not percentage-based):
 * - Employee always pays 1,000 FCFA
 * - Employer pays 500 FCFA for the employee
 * - If employee has declared family, employer pays additional 4,500 FCFA
 *
 * @param options - Configuration options
 * @param options.hasFamily - Whether employee has declared family members
 * @returns CMU contribution breakdown
 *
 * @example
 * ```typescript
 * // Employee without family
 * const result = calculateCMU({ hasFamily: false });
 * // result.employee = 1,000
 * // result.employer = 500
 * // result.total = 1,500
 *
 * // Employee with family (spouse + children)
 * const result2 = calculateCMU({ hasFamily: true });
 * // result2.employee = 1,000
 * // result2.employer = 5,000 (500 + 4,500)
 * // result2.total = 6,000
 * ```
 */
export function calculateCMU(options: { hasFamily?: boolean } = {}): CMUResult {
  const hasFamily = options.hasFamily || false;

  // Employee contribution (fixed)
  const employee = CMU_RATES.employeeFixed;

  // Employer contribution
  const employer = hasFamily
    ? CMU_RATES.employerEmployee + CMU_RATES.employerFamily
    : CMU_RATES.employerEmployee;

  return {
    employee,
    employer,
    total: employee + employer,
    hasFamily,
  };
}
