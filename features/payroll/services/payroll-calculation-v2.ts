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
import { calculateGrossSalary } from './gross-calculation';
import { loadPayrollConfig, ProgressiveMonthlyTaxStrategy } from '@/features/payroll-config';

export interface PayrollCalculationInputV2 extends PayrollCalculationInput {
  countryCode: string; // Required for loading config
  fiscalParts?: number; // For tax deductions (1.0, 1.5, 2.0, etc.)
  sectorCode?: string; // For sector-specific contributions
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
        sectorCode: input.sectorCode || 'SERVICES', // Default to SERVICES (uppercase to match database)
        hasFamily: input.hasFamily || false,
      }
    );

  // ========================================
  // STEP 3: Calculate Tax (Database-Driven)
  // ========================================
  const taxStrategy = new ProgressiveMonthlyTaxStrategy(
    config.taxBrackets,
    config.familyDeductions
  );

  const taxResult = taxStrategy.calculate({
    grossSalary,
    employeeContributions: cnpsEmployee + cmuEmployee,
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
  const earningsDetails = buildEarningsDetails(grossCalc);
  const deductionsDetails = buildDeductionsDetails(
    cnpsEmployee,
    cmuEmployee,
    taxResult.monthlyTax
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
  options: { sectorCode: string; hasFamily: boolean }
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
      // For salaire_categoriel: use ceiling amount as the base (not a cap)
      // This is used for family benefits and work accident in Côte d'Ivoire (70,000 FCFA)
      calculationBase = contrib.ceilingAmount ? Number(contrib.ceilingAmount) : grossSalary;
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

      // Categorize by code pattern (health/medical → CMU bucket)
      if (code.includes('cmu') || code.includes('health') || code.includes('medical')) {
        cmuEmployee = fixedAmount;
        // CMU employer: 500 for employee + 4,500 for family (CI-specific)
        cmuEmployer = options.hasFamily ? 5000 : 500;
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
function buildEarningsDetails(grossCalc: any) {
  const details = [
    {
      type: 'base_salary',
      description: 'Salaire de base',
      amount: grossCalc.proratedSalary,
    },
  ];

  if (grossCalc.allowances > 0) {
    details.push({
      type: 'allowances',
      description: 'Indemnités (logement, transport, repas)',
      amount: grossCalc.allowances,
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
 * Build deductions details array
 */
function buildDeductionsDetails(
  cnpsEmployee: number,
  cmuEmployee: number,
  tax: number
) {
  return [
    {
      type: 'cnps_employee',
      description: 'CNPS Retraite (6,3%)',
      amount: cnpsEmployee,
    },
    {
      type: 'cmu_employee',
      description: 'CMU (Cotisation salariale)',
      amount: cmuEmployee,
    },
    {
      type: 'its',
      description: 'ITS (Impôt sur les traitements et salaires)',
      amount: tax,
    },
  ];
}
