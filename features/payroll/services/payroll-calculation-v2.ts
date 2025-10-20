/**
 * Complete Payroll Calculation Service (V2 - Multi-Country)
 *
 * Database-driven payroll calculation that supports multiple countries.
 * Replaces hardcoded constants with configuration loaded from database.
 *
 * Calculation Flow:
 * 1. Load country configuration from database
 * 2. Calculate gross salary (base + allowances + overtime + bonuses)
 * 3. Calculate social security contributions (database-driven)
 * 4. Calculate tax using progressive strategy (database-driven)
 * 5. Calculate net salary and employer costs
 */

import type {
  PayrollCalculationInput,
  PayrollCalculationResult,
} from '../types';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { calculateGrossSalary } from './gross-calculation';
import { loadPayrollConfig, ProgressiveMonthlyTaxStrategy } from '@/features/payroll-config';

export interface PayrollCalculationInputV2 extends PayrollCalculationInput {
  countryCode: string; // Required for loading config
  fiscalParts?: number; // For tax deductions (1.0, 1.5, 2.0, etc.)
  sectorCode?: string; // For sector-specific contributions
  seniorityBonus?: number; // Seniority bonus from components
  familyAllowance?: number; // Family allowance from components
  salaireCategoriel?: number; // Code 11 - Base for CNPS Family/Accident (CI)
  sursalaire?: number; // Code 12 - Additional fixed component (CI)
  otherAllowances?: Array<{ name: string; amount: number; taxable: boolean }>; // Template components (TPT_*, PHONE, etc.)
  customComponents?: SalaryComponentInstance[]; // Custom components for future use
}

/**
 * Calculate complete payroll for an employee (V2 - Multi-Country)
 *
 * This version loads payroll rules from the database based on country code,
 * making it suitable for multi-country deployments.
 *
 * @param input - Payroll calculation input with country code
 * @returns Complete payroll calculation with detailed breakdown
 *
 * @example
 * ```typescript
 * // Côte d'Ivoire employee
 * const resultCI = await calculatePayrollV2({
 *   employeeId: '123',
 *   countryCode: 'CI',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 300000,
 *   fiscalParts: 1.0,
 *   sectorCode: 'services',
 * });
 *
 * // Senegal employee (when Senegal rules are added)
 * const resultSN = await calculatePayrollV2({
 *   employeeId: '456',
 *   countryCode: 'SN',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 250000,
 * });
 * ```
 */
export async function calculatePayrollV2(
  input: PayrollCalculationInputV2
): Promise<PayrollCalculationResult> {
  // ========================================
  // STEP 0: Load Country Configuration
  // ========================================
  const config = await loadPayrollConfig(
    input.countryCode,
    input.periodStart
  );

  // ========================================
  // STEP 1: Calculate Gross Salary
  // ========================================
  const grossCalc = calculateGrossSalary({
    employeeId: input.employeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    baseSalary: input.baseSalary,
    hireDate: input.hireDate,
    terminationDate: input.terminationDate,
    housingAllowance: input.housingAllowance,
    transportAllowance: input.transportAllowance,
    mealAllowance: input.mealAllowance,
    seniorityBonus: input.seniorityBonus || 0,
    familyAllowance: input.familyAllowance || 0,
    otherAllowances: input.otherAllowances, // Include template components
    bonuses: input.bonuses,
    overtimeHours: input.overtimeHours,
  });

  const grossSalary = grossCalc.totalGross;

  // ========================================
  // STEP 2: Calculate Social Security Contributions
  // ========================================
  const { cnpsEmployee, cnpsEmployer, cmuEmployee, cmuEmployer } =
    calculateSocialSecurityContributions(
      grossSalary,
      config.contributions,
      config.sectorOverrides,
      {
        sectorCode: input.sectorCode || config.socialSecurityScheme.defaultSectorCode, // Use database default
        hasFamily: input.hasFamily || false,
        salaireCategoriel: input.salaireCategoriel, // Code 11 for CNPS calculations
      }
    );

  // ========================================
  // STEP 3: Calculate Tax (Database-Driven)
  // ========================================
  const taxStrategy = new ProgressiveMonthlyTaxStrategy(
    config.taxBrackets,
    config.familyDeductions
  );

  // Tax calculation base varies by country (database-driven)
  // - 'gross_before_ss': Tax on gross BEFORE employee SS deductions (e.g., CI uses "Brut Imposable")
  // - 'gross_after_ss': Tax on gross AFTER employee SS deductions (e.g., some other countries)
  const employeeContributionsForTax =
    config.taxSystem.taxCalculationBase === 'gross_before_ss'
      ? 0
      : (cnpsEmployee + cmuEmployee);

  const taxResult = taxStrategy.calculate({
    grossSalary,
    employeeContributions: employeeContributionsForTax,
    fiscalParts: input.fiscalParts || 1.0,
  });

  // ========================================
  // STEP 4: Calculate Deductions & Net
  // ========================================
  const totalDeductions = cnpsEmployee + cmuEmployee + taxResult.monthlyTax;
  const netSalary = Math.round(grossSalary - totalDeductions);

  // ========================================
  // STEP 5: Calculate Other Taxes (FDFP, etc.)
  // ========================================
  const { employerTaxes, employeeTaxes, otherTaxesDetails } = calculateOtherTaxes(
    grossSalary,
    config.otherTaxes
  );

  // ========================================
  // STEP 6: Calculate Employer Cost
  // ========================================
  const totalEmployerContributions = cnpsEmployer + cmuEmployer + employerTaxes;
  const employerCost = Math.round(grossSalary + totalEmployerContributions);

  // ========================================
  // STEP 6: Build Detailed Breakdowns
  // ========================================
  const earningsDetails = buildEarningsDetails(grossCalc, input);
  const deductionsDetails = buildDeductionsDetails(
    cnpsEmployee,
    cmuEmployee,
    taxResult.monthlyTax,
    config.taxSystem // Pass config for labels
  );

  // ========================================
  // Return Complete Result
  // ========================================
  return {
    // Employee info
    employeeId: input.employeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,

    // Earnings
    baseSalary: input.baseSalary,
    proratedBaseSalary: grossCalc.proratedSalary,
    allowances: grossCalc.allowances,
    overtimePay: grossCalc.overtimePay,
    bonuses: grossCalc.bonuses,
    grossSalary,

    // Employee Deductions
    cnpsEmployee,
    cmuEmployee,
    taxableIncome: taxResult.taxableIncome,
    its: taxResult.monthlyTax,
    totalDeductions,

    // Employer Contributions
    cnpsEmployer,
    cmuEmployer,
    otherTaxesEmployer: employerTaxes,
    totalEmployerContributions,

    // Net Pay
    netSalary,
    employerCost,

    // Other Taxes Details
    otherTaxesDetails,

    // Days
    daysWorked: grossCalc.daysWorked,
    daysInPeriod: grossCalc.daysInPeriod,

    // Detailed Breakdowns
    earningsDetails,
    deductionsDetails,
    itsDetails: {
      grossSalary: taxResult.grossSalary,
      cnpsEmployeeDeduction: cnpsEmployee,
      cmuEmployeeDeduction: cmuEmployee,
      taxableIncome: taxResult.taxableIncome,
      annualTaxableIncome: taxResult.annualTaxableIncome,
      annualTax: taxResult.annualTax,
      monthlyTax: taxResult.monthlyTax,
      effectiveRate: taxResult.effectiveRate,
      bracketDetails: taxResult.bracketDetails.map(b => ({
        min: b.min,
        max: b.max || Infinity,
        rate: b.rate,
        taxableInBracket: b.taxableInBracket,
        taxForBracket: b.taxForBracket,
      })),
    },
  };
}

/**
 * Calculate other taxes (FDFP, 3FPT, etc.) from database config
 */
function calculateOtherTaxes(
  grossSalary: number,
  otherTaxes: any[]
) {
  let employerTaxes = 0;
  let employeeTaxes = 0;
  const details: any[] = [];

  for (const tax of otherTaxes) {
    // Determine calculation base
    const base = tax.calculationBase === 'brut_imposable'
      ? grossSalary
      : grossSalary;

    const amount = Math.round(base * Number(tax.taxRate));

    details.push({
      code: tax.code,
      name: tax.name,
      amount,
      rate: Number(tax.taxRate),
      base,
      paidBy: tax.paidBy,
    });

    if (tax.paidBy === 'employer') {
      employerTaxes += amount;
    } else if (tax.paidBy === 'employee') {
      employeeTaxes += amount;
    }
  }

  return {
    employerTaxes,
    employeeTaxes,
    otherTaxesDetails: details,
  };
}

/**
 * Calculate social security contributions from database config
 *
 * COUNTRY-AGNOSTIC: Works for any country by categorizing contributions
 * based on who pays (employee vs employer) and type (retirement, health, other).
 *
 * Categorization logic:
 * - Retirement/Pension contributions → cnpsEmployee + cnpsEmployer
 * - Health/Medical contributions → cmuEmployee + cmuEmployer
 * - Other employer-only contributions → cnpsEmployer
 */
function calculateSocialSecurityContributions(
  grossSalary: number,
  contributions: any[],
  sectorOverrides: any[],
  options: {
    sectorCode: string;
    hasFamily: boolean;
    salaireCategoriel?: number; // Code 11 - For CNPS calculations
  }
) {
  let cnpsEmployee = 0;
  let cnpsEmployer = 0;
  let cmuEmployee = 0;
  let cmuEmployer = 0;

  for (const contrib of contributions) {
    const code = contrib.code.toLowerCase();

    // Determine calculation base based on contribution type
    let calculationBase = grossSalary;

    if (contrib.calculationBase === 'salaire_categoriel') {
      // For salaire_categoriel: use the specific component amount, capped at ceiling
      // This is used for family benefits and work accident in Côte d'Ivoire
      // If salaireCategoriel is provided, use it (capped at ceiling), otherwise use ceiling as default
      if (options.salaireCategoriel) {
        calculationBase = Math.min(
          options.salaireCategoriel,
          contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
        );
      } else if (contrib.ceilingAmount) {
        // Fallback: use ceiling amount as the base (country-specific, from database)
        calculationBase = Number(contrib.ceilingAmount);
      } else {
        // No salaireCategoriel and no ceiling defined - this is a configuration error
        throw new Error(
          `Contribution ${contrib.code} requires salaireCategoriel but none provided and no ceiling defined in database`
        );
      }
    } else if (contrib.calculationBase === 'brut_imposable' || contrib.calculationBase === 'gross_salary') {
      // For brut_imposable/gross_salary: use gross salary, optionally capped by ceiling
      calculationBase = Math.min(
        grossSalary,
        contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
      );
    }
    // else: use grossSalary as default

    // Fixed amount contributions (e.g., CMU in Côte d'Ivoire)
    if (contrib.fixedAmount) {
      const fixedAmount = Number(contrib.fixedAmount);

      // Categorize by code pattern
      if (code.includes('cmu') || code.includes('health') || code.includes('medical')) {
        // CMU Employee (e.g., cmu_employee)
        if (code === 'cmu_employee') {
          cmuEmployee = fixedAmount;
        }
        // CMU Employer Base (no family)
        else if (code === 'cmu_employer_base' && !options.hasFamily) {
          cmuEmployer = fixedAmount;
        }
        // CMU Employer Family (with family)
        else if (code === 'cmu_employer_family' && options.hasFamily) {
          cmuEmployer = fixedAmount;
        }
      } else {
        // Other fixed contributions go to CNPS employer bucket
        cnpsEmployer += fixedAmount;
      }
      continue;
    }

    // Percentage-based contributions
    const employeeRate = contrib.employeeRate ? Number(contrib.employeeRate) : 0;
    let employerRate = contrib.employerRate ? Number(contrib.employerRate) : 0;

    // Check for sector override
    if (contrib.isVariableBySector) {
      const override = sectorOverrides.find(
        o =>
          o.contributionTypeId === contrib.id &&
          o.sectorCode === options.sectorCode
      );
      if (override) {
        employerRate = Number(override.employerRate);
      }
    }

    const employeeAmount = Math.round(calculationBase * employeeRate);
    const employerAmount = Math.round(calculationBase * employerRate);

    // Categorize contributions by code pattern (country-agnostic)
    // Retirement/Pension → CNPS buckets (both employee and employer)
    if (code.includes('pension') || code.includes('retraite') || code.includes('retirement')) {
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
    // Health/Medical → CMU buckets
    else if (code.includes('health') || code.includes('medical') || code.includes('ipress') || code.includes('maladie')) {
      cmuEmployee += employeeAmount;
      cmuEmployer += employerAmount;
    }
    // Family, Work Accident, and other employer-only → CNPS employer bucket
    else if (code.includes('family') || code.includes('familial') || code.includes('pf') ||
             code.includes('work_accident') || code.includes('accident') || code.includes('at') ||
             code.includes('maternity') || code.includes('maternite')) {
      // These are typically employer-only, but add both just in case
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
    // Catch-all: any other contribution type → CNPS buckets
    else {
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
  }

  return { cnpsEmployee, cnpsEmployer, cmuEmployee, cmuEmployer };
}

/**
 * Build earnings details array
 */
function buildEarningsDetails(grossCalc: any, input: PayrollCalculationInputV2) {
  const details = [
    {
      type: 'base_salary',
      description: 'Salaire de base',
      amount: grossCalc.proratedSalary,
    },
  ];

  // Add individual allowance components
  if (input.housingAllowance && input.housingAllowance > 0) {
    details.push({
      type: 'housing_allowance',
      description: 'Prime de logement',
      amount: input.housingAllowance,
    });
  }

  if (input.transportAllowance && input.transportAllowance > 0) {
    details.push({
      type: 'transport_allowance',
      description: 'Prime de transport',
      amount: input.transportAllowance,
    });
  }

  if (input.mealAllowance && input.mealAllowance > 0) {
    details.push({
      type: 'meal_allowance',
      description: 'Prime de panier',
      amount: input.mealAllowance,
    });
  }

  if (input.seniorityBonus && input.seniorityBonus > 0) {
    details.push({
      type: 'seniority_bonus',
      description: 'Prime d\'ancienneté',
      amount: input.seniorityBonus,
    });
  }

  if (input.familyAllowance && input.familyAllowance > 0) {
    details.push({
      type: 'family_allowance',
      description: 'Allocations familiales',
      amount: input.familyAllowance,
    });
  }

  if (grossCalc.overtimePay > 0) {
    details.push({
      type: 'overtime',
      description: 'Heures supplémentaires',
      amount: grossCalc.overtimePay,
    });
  }

  if (grossCalc.bonuses > 0) {
    details.push({
      type: 'bonuses',
      description: 'Primes',
      amount: grossCalc.bonuses,
    });
  }

  return details;
}

/**
 * Build deductions details array with country-specific labels
 */
function buildDeductionsDetails(
  cnpsEmployee: number,
  cmuEmployee: number,
  tax: number,
  taxSystem: {
    retirementContributionLabel: Record<string, string>;
    healthContributionLabel: Record<string, string>;
    incomeTaxLabel: Record<string, string>;
  }
) {
  return [
    {
      type: 'cnps_employee',
      description: taxSystem.retirementContributionLabel.fr, // Use country-specific label
      amount: cnpsEmployee,
    },
    {
      type: 'cmu_employee',
      description: taxSystem.healthContributionLabel.fr, // Use country-specific label
      amount: cmuEmployee,
    },
    {
      type: 'its',
      description: taxSystem.incomeTaxLabel.fr, // Use country-specific label
      amount: tax,
    },
  ];
}
