/**
 * Unified Employee Payroll Data Interface
 *
 * This file defines the standardized data structure used by both single-employee
 * recalculation and batch calculation modes. Both modes MUST produce this exact
 * shape to ensure consistent payroll results.
 *
 * Architecture:
 * - On-Demand Provider: Loads data via parallel DB queries (for single employee)
 * - Batch Provider: Uses pre-fetched Maps (for bulk calculation)
 * - Both call processEmployeePayroll() with this unified structure
 *
 * Benefits:
 * - Single source of truth for payroll calculation
 * - Any changes apply to all calculation modes
 * - Type-safe data contracts between layers
 */

import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

/**
 * Unified data structure for employee payroll calculation.
 * Both single-employee and batch modes must produce this exact shape.
 */
export interface EmployeePayrollData {
  // Employee info
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate: Date;
    terminationDate: Date | null;
    contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
    rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
    paymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
    weeklyHoursRegime: '40h' | '44h' | '48h' | '52h' | '56h' | null;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | null;
    jobTitle: string | null;
    bankAccount: string | null;
    customFields: Record<string, any> | null;
  };

  // Salary info
  salary: {
    baseSalary: number;
    salaireCategoriel: number;
    sursalaire: number;
    effectiveFrom: Date;
    components: SalaryComponentInstance[];
    breakdown: {
      housingAllowance: number;
      transportAllowance: number;
      mealAllowance: number;
      seniorityBonus: number;
      familyAllowance: number;
      otherAllowances: Array<{
        code: string;
        name: string;
        amount: number;
        taxable: boolean;
      }>;
      customComponents: SalaryComponentInstance[];
    };
  };

  // Family/dependents
  dependents: {
    fiscalParts: number;           // For ITS calculation
    cmuBeneficiaryCount: number;   // For CMU calculation
    hasFamily: boolean;            // Manual override flag
  };

  // Time tracking (for DAILY/CDDTI workers)
  timeData: {
    daysWorked: number;
    totalHours: number;
    sundayHours: number;
    nightHours: number;
    nightSundayHours: number;
  } | null;

  // Salary advances
  advances: {
    disbursements: Array<{ id: string; amount: number }>;
    repayments: Array<{
      advanceId: string;
      installmentNumber: number;
      amount: number;
    }>;
    netEffect: number; // disbursements - repayments
  };
}

/**
 * Context for payroll calculation run
 */
export interface PayrollRunContext {
  id: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  paymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  countryCode: string;
}

/**
 * Tenant context for payroll calculation
 */
export interface TenantContext {
  id: string;
  countryCode: string;
  sectorCode: string;
  genericSectorCode?: string | null;
  workAccidentRate: number | null;
}

/**
 * Data provider interface - implemented by both modes
 *
 * On-Demand: Creates provider, then calls getEmployeeData() which queries DB
 * Batch: Creates provider with pre-fetched data, getEmployeeData() does O(1) lookups
 */
export interface PayrollDataProvider {
  /**
   * Get unified payroll data for a single employee
   * @param employeeId - The employee to fetch data for
   * @returns EmployeePayrollData or null if employee should be skipped
   */
  getEmployeeData(employeeId: string): Promise<EmployeePayrollData | null>;
}

/**
 * Result from processing a single employee's payroll
 */
export interface PayrollLineItemData {
  tenantId: string;
  payrollRunId: string;
  employeeId: string;

  // Denormalized employee info
  employeeName: string;
  employeeNumber: string;
  positionTitle: string | null;

  // Salary information
  baseSalary: string;
  allowances: {
    housing: number;
    transport: number;
    meal: number;
    seniority: number;
    family: number;
  };

  // Time tracking
  daysWorked: string;
  daysAbsent: string;
  hoursWorked: string;
  overtimeHours: Record<string, number>;

  // Gross calculation
  grossSalary: string;
  brutImposable: string;

  // Detailed breakdowns
  earningsDetails: any[];
  deductionsDetails: any[];

  // Deductions
  taxDeductions: { its: number };
  employeeContributions: { cnps: number; cmu: number };
  otherDeductions: {
    salaryAdvances: {
      disbursements: number;
      repayments: number;
      repaymentDetails: any[];
      disbursedAdvanceIds: string[];
    };
  };

  // Individual deduction columns
  cnpsEmployee: string;
  cmuEmployee: string;
  its: string;

  // Net calculation
  totalDeductions: string;
  netSalary: string;

  // Employer costs
  employerContributions: { cnps: number; cmu: number };
  cnpsEmployer: string;
  cmuEmployer: string;
  totalEmployerCost: string;

  // Other taxes
  totalOtherTaxes: string;
  otherTaxesDetails: any[];

  // Contribution details
  contributionDetails: any[];

  // Calculation context
  calculationContext: any;

  // Payment details
  paymentMethod: string;
  bankAccount: string | null;
  status: string;
}
