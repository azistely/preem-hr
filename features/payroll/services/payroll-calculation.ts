/**
 * Complete Payroll Calculation Service
 *
 * Orchestrates all payroll calculations from gross to net salary.
 *
 * Calculation Flow:
 * 1. Calculate gross salary (base + allowances + overtime + bonuses)
 * 2. Calculate CNPS employee contribution
 * 3. Calculate CMU employee contribution
 * 4. Calculate taxable income (gross - CNPS - CMU)
 * 5. Calculate ITS (progressive tax)
 * 6. Calculate total deductions
 * 7. Calculate net salary (gross - deductions)
 * 8. Calculate employer costs
 *
 * Story 6.1: Calculate Net Pay
 *
 * Source: payroll-cote-d-ivoire.md:148-175
 */

import type {
  PayrollCalculationInput,
  PayrollCalculationResult,
} from '../types';
import { calculateGrossSalary } from './gross-calculation';
import { calculateCNPS } from './cnps-calculation';
import { calculateCMU } from './cmu-calculation';
import { calculateITSFromGross } from './its-calculation';

/**
 * Calculate complete payroll for an employee
 *
 * This is the main payroll calculation function that combines all
 * individual calculation services.
 *
 * @param input - Payroll calculation input parameters
 * @returns Complete payroll calculation with detailed breakdown
 *
 * @example
 * ```typescript
 * // Example 7.1 from regulations (300k gross, no family)
 * const result = calculatePayroll({
 *   employeeId: '123',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 300000,
 * });
 *
 * // Expected results:
 * // Gross: 300,000
 * // CNPS Employee: 18,900 (6.3%)
 * // CMU Employee: 1,000
 * // Taxable Income: 280,100
 * // ITS: 60,815
 * // Net Salary: 219,285
 * // Employer Cost: 351,350
 *
 * // With family and allowances
 * const result2 = calculatePayroll({
 *   employeeId: '456',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 500000,
 *   housingAllowance: 100000,
 *   transportAllowance: 50000,
 *   hasFamily: true,
 *   sector: 'services',
 * });
 * // Gross: 650,000
 * // CMU Employer: 5,000 (500 + 4,500 family)
 * ```
 */
export function calculatePayroll(
  input: PayrollCalculationInput
): PayrollCalculationResult {
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
  // STEP 2: Calculate CNPS Contributions
  // ========================================
  const cnps = calculateCNPS(grossSalary, {
    sector: input.sector || 'services',
  });

  const cnpsEmployee = cnps.totalEmployee;
  const cnpsEmployer = cnps.pension.employer;

  // ========================================
  // STEP 3: Calculate CMU Contributions
  // ========================================
  const cmu = calculateCMU({
    hasFamily: input.hasFamily || false,
  });

  const cmuEmployee = cmu.employee;
  const cmuEmployer = cmu.employer;

  // ========================================
  // STEP 4: Calculate ITS (Tax)
  // ========================================
  const its = calculateITSFromGross(grossSalary, cnpsEmployee, cmuEmployee);

  // ========================================
  // STEP 5: Calculate Deductions & Net
  // ========================================
  const totalDeductions = cnpsEmployee + cmuEmployee + its.monthlyTax;
  const netSalary = Math.round(grossSalary - totalDeductions);

  // ========================================
  // STEP 6: Calculate Employer Cost
  // ========================================
  const totalEmployerContributions = cnps.totalEmployer + cmuEmployer;
  const employerCost = Math.round(
    grossSalary + totalEmployerContributions
  );

  // ========================================
  // STEP 7: Build Detailed Breakdowns
  // ========================================
  const earningsDetails = [
    {
      type: 'base_salary',
      description: 'Salaire de base',
      amount: grossCalc.proratedSalary,
    },
  ];

  if (grossCalc.allowances > 0) {
    earningsDetails.push({
      type: 'allowances',
      description: 'Indemnités (logement, transport, repas)',
      amount: grossCalc.allowances,
    });
  }

  if (grossCalc.overtimePay > 0) {
    earningsDetails.push({
      type: 'overtime',
      description: 'Heures supplémentaires',
      amount: grossCalc.overtimePay,
    });
  }

  if (grossCalc.bonuses > 0) {
    earningsDetails.push({
      type: 'bonuses',
      description: 'Primes',
      amount: grossCalc.bonuses,
    });
  }

  const deductionsDetails = [
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
      amount: its.monthlyTax,
    },
  ];

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
    brutImposable: grossSalary, // For old calculation, brut imposable = gross salary (no component-level tracking)

    // Employee Deductions
    cnpsEmployee,
    cmuEmployee,
    taxableIncome: its.taxableIncome,
    its: its.monthlyTax,
    totalDeductions,

    // Employer Contributions
    cnpsEmployer,
    cmuEmployer,
    totalEmployerContributions,

    // Net Pay
    netSalary,
    employerCost,

    // Days
    daysWorked: grossCalc.daysWorked,
    daysInPeriod: grossCalc.daysInPeriod,

    // Detailed Breakdowns
    earningsDetails,
    deductionsDetails,
    itsDetails: its,
  };
}
