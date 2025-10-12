/**
 * Payroll Calculation Types
 *
 * Type definitions for all payroll calculations in Côte d'Ivoire.
 */

// ========================================
// Salary Information
// ========================================
export interface SalaryInfo {
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  otherAllowances?: Array<{
    name: string;
    amount: number;
    taxable: boolean;
  }>;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

// ========================================
// CNPS Calculation Results
// ========================================
export interface CNPSPensionResult {
  grossSalary: number;
  cappedSalary: number;
  employee: number;
  employer: number;
  total: number;
}

export interface CNPSOtherResult {
  grossSalary: number;
  cappedSalary: number;
  maternity: number;
  family: number;
  workAccident: number;
  total: number;
}

export interface CNPSResult {
  pension: CNPSPensionResult;
  other: CNPSOtherResult;
  totalEmployee: number;
  totalEmployer: number;
}

// ========================================
// CMU Calculation Results
// ========================================
export interface CMUResult {
  employee: number;
  employer: number;
  total: number;
  hasFamily: boolean;
}

// ========================================
// ITS (Tax) Calculation Results
// ========================================
export interface ITSBracketDetail {
  min: number;
  max: number;
  rate: number;
  taxableInBracket: number;
  taxForBracket: number;
}

export interface ITSResult {
  grossSalary: number;
  cnpsEmployeeDeduction: number;
  cmuEmployeeDeduction: number;
  taxableIncome: number;
  annualTaxableIncome: number;
  annualTax: number;
  monthlyTax: number;
  effectiveRate: number;
  bracketDetails: ITSBracketDetail[];
}

// ========================================
// Overtime Calculation
// ========================================
export type OvertimeType =
  | 'hours_41_to_46'
  | 'hours_above_46'
  | 'night'
  | 'sunday_or_holiday'
  | 'night_sunday_or_holiday';

export interface OvertimeHours {
  count: number;
  type: OvertimeType;
}

export interface OvertimeResult {
  baseSalary: number;
  hourlyRate: number;
  hours_41_to_46?: number;
  hours_above_46?: number;
  night?: number;
  sunday_or_holiday?: number;
  night_sunday_or_holiday?: number;
  total: number;
  breakdown: Array<{
    type: OvertimeType;
    hours: number;
    multiplier: number;
    amount: number;
  }>;
}

// ========================================
// Gross Salary Calculation
// ========================================
export interface GrossCalculationInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  baseSalary: number;
  hireDate?: Date;
  terminationDate?: Date;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  seniorityBonus?: number;
  familyAllowance?: number;
  otherAllowances?: Array<{
    name: string;
    amount: number;
    taxable: boolean;
  }>;
  bonuses?: number;
  overtimeHours?: OvertimeHours[];
}

export interface GrossCalculationResult {
  baseSalary: number;
  proratedSalary: number;
  allowances: number;
  overtimePay: number;
  bonuses: number;
  totalGross: number;
  daysWorked: number;
  daysInPeriod: number;
  prorationFactor: number;
  breakdown: {
    base: number;
    allowances: number;
    overtime: number;
    bonuses: number;
  };
}

// ========================================
// Complete Payroll Calculation
// ========================================
export interface PayrollCalculationInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  bonuses?: number;
  overtimeHours?: OvertimeHours[];
  hasFamily?: boolean;
  hireDate?: Date;
  terminationDate?: Date;
  sector?: 'services' | 'construction' | 'agriculture' | 'other';
}

export interface PayrollCalculationResult {
  // Employee info
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;

  // Earnings
  baseSalary: number;
  proratedBaseSalary: number;
  allowances: number;
  overtimePay: number;
  bonuses: number;
  grossSalary: number;

  // Employee Deductions
  cnpsEmployee: number;
  cmuEmployee: number;
  taxableIncome: number;
  its: number;
  totalDeductions: number;

  // Employer Contributions
  cnpsEmployer: number;
  cmuEmployer: number;
  otherTaxesEmployer?: number;
  totalEmployerContributions: number;

  // Net Pay
  netSalary: number;
  employerCost: number;

  // Other Taxes Details
  otherTaxesDetails?: Array<{
    code: string;
    name: string;
    amount: number;
    rate: number;
    base: number;
    paidBy: string;
  }>;

  // Days
  daysWorked: number;
  daysInPeriod: number;

  // Detailed Breakdowns
  earningsDetails: Array<{
    type: string;
    description: string;
    amount: number;
  }>;
  deductionsDetails: Array<{
    type: string;
    description: string;
    amount: number;
  }>;
  itsDetails: ITSResult;
}

// ========================================
// Payroll Run
// ========================================
export interface PayrollRunSummary {
  runId: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalEmployerCost: number;
  totalEmployeeContributions: number;
  totalEmployerContributions: number;
  totalTax: number;
}
