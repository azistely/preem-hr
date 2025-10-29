/**
 * Progressive Monthly Tax Strategy
 *
 * Database-driven progressive tax calculation for countries using monthly
 * progressive tax systems (e.g., Côte d'Ivoire ITS).
 *
 * This strategy replaces hardcoded tax brackets with database-loaded configuration.
 */

import type { TaxBracket, FamilyDeductionRule } from '../types';

export interface TaxCalculationInput {
  grossSalary: number;
  employeeContributions: number; // CNPS, CMU, etc.
  fiscalParts?: number; // For family deductions (1.0, 1.5, 2.0, etc.)
}

export interface TaxCalculationResult {
  grossSalary: number;
  employeeContributions: number;
  taxableIncome: number;
  annualTaxableIncome: number;
  familyDeduction: number;
  annualTaxableAfterDeduction: number;
  annualTax: number;
  monthlyTax: number;
  effectiveRate: number;
  bracketDetails: {
    min: number;
    max: number | null;
    rate: number;
    taxableInBracket: number;
    taxForBracket: number;
  }[];
}

export class ProgressiveMonthlyTaxStrategy {
  constructor(
    private readonly brackets: TaxBracket[],
    private readonly familyDeductions: FamilyDeductionRule[] = []
  ) {
    // Sort brackets by order to ensure correct calculation
    this.brackets = [...brackets].sort((a, b) => a.bracketOrder - b.bracketOrder);
  }

  /**
   * Calculate tax using progressive monthly method
   *
   * IMPORTANT: As of 2025-10-29, following the documentation method from docs/payroll-joel-ci-hr-.md
   * The family deduction is subtracted from the calculated tax, NOT from the taxable base.
   *
   * Process (Documentation Method):
   * 1. Calculate monthly taxable income (gross - employee contributions)
   * 2. Apply progressive brackets to FULL taxable income
   * 3. Calculate family deduction based on fiscal parts
   * 4. Subtract family deduction from calculated tax (not from base!)
   */
  calculate(input: TaxCalculationInput): TaxCalculationResult {
    // Step 1: Calculate monthly taxable income (Brut Imposable in CI)
    // For CI: This is gross salary minus employee social security contributions
    const taxableIncome = Math.round(
      input.grossSalary - input.employeeContributions
    );

    // Step 2: Calculate tax on FULL taxable income (before family deduction)
    const { totalTax, bracketDetails } = this.calculateProgressiveTax(
      taxableIncome
    );

    // Step 3: Get family deduction amount
    const familyDeduction = this.getFamilyDeduction(input.fiscalParts || 1.0);

    // Step 4: Subtract family deduction from calculated tax (Documentation Method)
    // Important: Deduction is applied to the tax amount, not the taxable base!
    const monthlyTax = Math.max(0, Math.round(totalTax - familyDeduction));

    // For backwards compatibility, calculate "annual" values (monthly × 12)
    const annualTaxableIncome = taxableIncome * 12;
    const annualTaxableAfterDeduction = taxableIncome * 12; // No longer used for tax calc
    const annualTax = monthlyTax * 12;

    // Effective rate (on monthly taxable income)
    const effectiveRate =
      taxableIncome > 0
        ? (monthlyTax / taxableIncome) * 100
        : 0;

    return {
      grossSalary: input.grossSalary,
      employeeContributions: input.employeeContributions,
      taxableIncome,
      annualTaxableIncome, // For display/backwards compat
      familyDeduction,
      annualTaxableAfterDeduction, // For display/backwards compat
      annualTax, // For display/backwards compat
      monthlyTax,
      effectiveRate,
      bracketDetails,
    };
  }

  /**
   * Calculate progressive tax using brackets (MONTHLY)
   *
   * Each bracket taxes only the income that falls within that bracket.
   * Example: CI ITS 2025 (MONTHLY brackets)
   * - 0-75,000: 0% → 0 tax
   * - 75,001-240,000: 16% → (income - 75,000) × 0.16 for income in this range
   * - 240,001-800,000: 21% → (income - 240,000) × 0.21 for income in this range
   * - etc.
   */
  private calculateProgressiveTax(monthlyIncome: number): {
    totalTax: number;
    bracketDetails: TaxCalculationResult['bracketDetails'];
  } {
    let totalTax = 0;
    const bracketDetails: TaxCalculationResult['bracketDetails'] = [];

    for (const bracket of this.brackets) {
      const minAmount = Number(bracket.minAmount);
      const maxAmount = bracket.maxAmount ? Number(bracket.maxAmount) : Infinity;
      const rate = Number(bracket.rate);

      // Check if income reaches this bracket
      if (monthlyIncome <= minAmount) break;

      // Calculate how much income falls in this bracket
      const incomeInBracket = Math.min(monthlyIncome, maxAmount) - minAmount;

      if (incomeInBracket <= 0) continue;

      // Calculate tax for this bracket
      const taxForBracket = Math.round(incomeInBracket * rate);

      // Add to total
      totalTax += taxForBracket;

      // Store bracket detail
      bracketDetails.push({
        min: minAmount,
        max: maxAmount === Infinity ? null : maxAmount,
        rate,
        taxableInBracket: incomeInBracket,
        taxForBracket,
      });
    }

    return { totalTax, bracketDetails };
  }

  /**
   * Get MONTHLY family deduction amount based on fiscal parts
   *
   * Example for Côte d'Ivoire (MONTHLY deductions):
   * - 1.0 parts (single) → 0 FCFA
   * - 1.5 parts (single + 1 child) → 5,500 FCFA/month
   * - 2.0 parts (married) → 11,000 FCFA/month
   * - 2.5 parts (married + 1 child) → 16,500 FCFA/month
   * - etc.
   */
  private getFamilyDeduction(fiscalParts: number): number {
    const rule = this.familyDeductions.find(
      r => Number(r.fiscalParts) === fiscalParts
    );

    return rule ? Number(rule.deductionAmount) : 0;
  }
}
