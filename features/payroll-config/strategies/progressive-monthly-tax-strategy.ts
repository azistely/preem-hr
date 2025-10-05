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
   * Process:
   * 1. Calculate taxable income (gross - employee contributions)
   * 2. Annualize taxable income (× 12)
   * 3. Apply family deduction if applicable
   * 4. Apply progressive brackets to annual income
   * 5. Divide annual tax by 12 for monthly withholding
   */
  calculate(input: TaxCalculationInput): TaxCalculationResult {
    // Step 1: Calculate monthly taxable income
    const taxableIncome = Math.round(
      input.grossSalary - input.employeeContributions
    );

    // Step 2: Annualize
    const annualTaxableIncome = taxableIncome * 12;

    // Step 3: Apply family deduction
    const familyDeduction = this.getFamilyDeduction(input.fiscalParts || 1.0);
    const annualTaxableAfterDeduction = Math.max(
      0,
      annualTaxableIncome - familyDeduction
    );

    // Step 4: Calculate annual tax using progressive brackets
    const { totalTax, bracketDetails } = this.calculateProgressiveTax(
      annualTaxableAfterDeduction
    );

    // Step 5: Monthly tax
    const monthlyTax = Math.round(totalTax / 12);

    // Effective rate
    const effectiveRate =
      annualTaxableAfterDeduction > 0
        ? (totalTax / annualTaxableAfterDeduction) * 100
        : 0;

    return {
      grossSalary: input.grossSalary,
      employeeContributions: input.employeeContributions,
      taxableIncome,
      annualTaxableIncome,
      familyDeduction,
      annualTaxableAfterDeduction,
      annualTax: totalTax,
      monthlyTax,
      effectiveRate,
      bracketDetails,
    };
  }

  /**
   * Calculate progressive tax using brackets
   *
   * Each bracket taxes only the income that falls within that bracket.
   * Example: CI ITS 2024
   * - 0-75k: 0% → 0 tax
   * - 75k-240k: 16% → (240k-75k) × 0.16 if income > 240k
   * - etc.
   */
  private calculateProgressiveTax(annualIncome: number): {
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
      if (annualIncome <= minAmount) break;

      // Calculate how much income falls in this bracket
      const incomeInBracket = Math.min(annualIncome, maxAmount) - minAmount;

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
   * Get family deduction amount based on fiscal parts
   *
   * Example for Côte d'Ivoire:
   * - 1.0 parts (single) → 0 FCFA
   * - 1.5 parts (single + 1 child) → 5,500 FCFA
   * - 2.0 parts (married) → 11,000 FCFA
   * - etc.
   */
  private getFamilyDeduction(fiscalParts: number): number {
    const rule = this.familyDeductions.find(
      r => Number(r.fiscalParts) === fiscalParts
    );

    return rule ? Number(rule.deductionAmount) : 0;
  }
}
