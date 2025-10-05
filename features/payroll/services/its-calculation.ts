/**
 * ITS (Impôt sur les Traitements et Salaires) Calculation Service
 *
 * Progressive income tax calculation for Côte d'Ivoire (2024 Reform).
 *
 * The ITS replaced the previous three-tax system (IS, CN, IGR) with a
 * single progressive tax applied at source.
 *
 * Stories 4.1 & 4.2: ITS Calculation
 *
 * Source: payroll-cote-d-ivoire.md:74-89
 */

import { ITS_BRACKETS } from '../constants';
import type { ITSResult, ITSBracketDetail } from '../types';

/**
 * Calculate taxable income
 *
 * Taxable income = Gross salary - Employee CNPS - Employee CMU
 *
 * Important: Do NOT subtract employer contributions
 *
 * @param grossSalary - Monthly gross salary in FCFA
 * @param cnpsEmployee - Employee CNPS contribution
 * @param cmuEmployee - Employee CMU contribution (1,000 FCFA)
 * @returns Monthly taxable income
 *
 * @example
 * ```typescript
 * // Example 7.1 from regulations
 * const taxableIncome = calculateTaxableIncome({
 *   grossSalary: 300000,
 *   cnpsEmployee: 18900,
 *   cmuEmployee: 1000,
 * });
 * // taxableIncome = 280,100 (300k - 18.9k - 1k)
 * ```
 */
export function calculateTaxableIncome(params: {
  grossSalary: number;
  cnpsEmployee: number;
  cmuEmployee: number;
}): number {
  return Math.round(
    params.grossSalary - params.cnpsEmployee - params.cmuEmployee
  );
}

/**
 * Calculate ITS using progressive tax brackets
 *
 * Process:
 * 1. Annualize monthly taxable income (× 12)
 * 2. Apply progressive brackets to annual income
 * 3. Divide annual tax by 12 for monthly withholding
 *
 * The progressive calculation means:
 * - First 300,000 FCFA: 0% tax
 * - Next 247,000 FCFA (300k-547k): 10% tax
 * - Next 432,000 FCFA (547k-979k): 15% tax
 * - And so on...
 *
 * @param annualTaxableIncome - Annual taxable income in FCFA
 * @returns Complete ITS calculation with bracket breakdown
 *
 * @example
 * ```typescript
 * // Example 7.1: 300k gross → 280,100 taxable monthly
 * const its = calculateITS(280100 * 12); // 3,361,200 annual
 * // Bracket 1 (0-300k): 0 FCFA
 * // Bracket 2 (300k-547k): 247,000 × 10% = 24,700 FCFA
 * // Bracket 3 (547k-979k): 432,000 × 15% = 64,800 FCFA
 * // Bracket 4 (979k-1.519M): 540,000 × 20% = 108,000 FCFA
 * // Bracket 5 (1.519M-2.644M): 1,125,000 × 25% = 281,250 FCFA
 * // Bracket 6 (2.644M-3.361M): 717,200 × 35% = 251,020 FCFA
 * // Total annual: 729,770 FCFA
 * // Monthly: 60,815 FCFA
 * ```
 */
export function calculateITS(annualTaxableIncome: number): ITSResult {
  let totalTax = 0;
  const bracketDetails: ITSBracketDetail[] = [];

  for (const bracket of ITS_BRACKETS) {
    // Check if income reaches this bracket
    if (annualTaxableIncome <= bracket.min) break;

    // Calculate how much income falls in this bracket
    const incomeInBracket = Math.min(annualTaxableIncome, bracket.max) - bracket.min;

    if (incomeInBracket <= 0) continue;

    // Calculate tax for this bracket
    const taxForBracket = Math.round(incomeInBracket * bracket.rate);

    // Add to total
    totalTax += taxForBracket;

    // Store bracket detail
    bracketDetails.push({
      min: bracket.min,
      max: bracket.max,
      rate: bracket.rate,
      taxableInBracket: incomeInBracket,
      taxForBracket,
    });
  }

  const monthlyTax = Math.round(totalTax / 12);
  const effectiveRate = annualTaxableIncome > 0
    ? (totalTax / annualTaxableIncome) * 100
    : 0;

  return {
    grossSalary: 0, // To be filled by caller
    cnpsEmployeeDeduction: 0, // To be filled by caller
    cmuEmployeeDeduction: 0, // To be filled by caller
    taxableIncome: Math.round(annualTaxableIncome / 12),
    annualTaxableIncome,
    annualTax: totalTax,
    monthlyTax,
    effectiveRate,
    bracketDetails,
  };
}

/**
 * Calculate complete ITS from gross salary and deductions
 *
 * This is a convenience function that combines taxable income calculation
 * and ITS calculation in one step.
 *
 * @param grossSalary - Monthly gross salary
 * @param cnpsEmployee - Employee CNPS contribution
 * @param cmuEmployee - Employee CMU contribution
 * @returns Complete ITS calculation result
 *
 * @example
 * ```typescript
 * // Example 7.1 from regulations (300k gross)
 * const result = calculateITSFromGross(300000, 18900, 1000);
 * // result.taxableIncome = 280,100
 * // result.monthlyTax = 60,815
 * // result.netSalary = 300,000 - 18,900 - 1,000 - 60,815 = 219,285
 * ```
 */
export function calculateITSFromGross(
  grossSalary: number,
  cnpsEmployee: number,
  cmuEmployee: number
): ITSResult {
  const taxableIncome = calculateTaxableIncome({
    grossSalary,
    cnpsEmployee,
    cmuEmployee,
  });

  const annualTaxableIncome = taxableIncome * 12;
  const itsResult = calculateITS(annualTaxableIncome);

  // Fill in the fields that calculateITS left empty
  return {
    ...itsResult,
    grossSalary,
    cnpsEmployeeDeduction: cnpsEmployee,
    cmuEmployeeDeduction: cmuEmployee,
    taxableIncome,
  };
}
