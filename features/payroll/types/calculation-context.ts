/**
 * Calculation Context Types
 *
 * These types define the structure of the calculation_context JSONB field
 * in payroll_line_items. This field stores all input parameters used for
 * payroll calculation to enable exact reproduction and historical auditing.
 *
 * @see supabase/migrations/20251107_add_calculation_context.sql
 */

import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

/**
 * Employee-specific context affecting tax and contribution calculations
 */
export interface EmployeeContext {
  /** Number of fiscal parts for ITS calculation (1.0 to 5.0) */
  fiscalParts: number;

  /** Marital status at time of calculation */
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';

  /** Number of verified dependent children for CMU/ITS calculations */
  dependentChildren: number;

  /** Whether employee has family members for CMU calculation */
  hasFamily: boolean;
}

/**
 * Employment contract and work arrangement context
 */
export interface EmploymentContext {
  /** Rate type: how salary is structured */
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';

  /** Contract type affecting contribution calculations */
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';

  /** Weekly hours regime for overtime calculations */
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h';

  /** Payment frequency for this employee */
  paymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  /** Economic sector for work accident rate */
  sectorCode: string;
}

/**
 * Salary structure at time of calculation
 */
export interface SalaryContext {
  /** Salaire catégoriel (base salary code 11) */
  salaireCategoriel: number;

  /** Sursalaire (code 12, CI-specific) */
  sursalaire?: number;

  /** Snapshot of all salary components used in calculation */
  components: SalaryComponentInstance[];

  /** Pre-calculated allowances breakdown */
  allowances: {
    housing: number;
    transport: number;
    meal: number;
    seniority: number;
    family: number;
  };
}

/**
 * Time period and employee lifecycle context
 */
export interface TimeContext {
  /** Employee hire date (for pro-rata calculations) */
  hireDate: string; // ISO date string

  /** Employee termination date if terminated during period */
  terminationDate?: string; // ISO date string

  /** Payroll period start date */
  periodStart: string; // ISO date string

  /** Payroll period end date */
  periodEnd: string; // ISO date string

  /** Actual days worked this period (for daily/CDDTI workers) */
  daysWorkedThisMonth?: number;

  /** Actual hours worked this period (for CDDTI workers) */
  hoursWorkedThisMonth?: number;
}

/**
 * Calculation engine metadata
 */
export interface CalculationMeta {
  /** Calculation engine version identifier */
  version: 'v2' | string;

  /** Calculation function name */
  engine: 'calculatePayrollV2' | string;

  /** Country code for tax/contribution rules */
  countryCode: string;

  /** Timestamp when calculation was performed */
  calculatedAt: string; // ISO timestamp

  /** Tax system configuration version/ID used */
  taxSystemId?: string;

  /** Social security scheme configuration version/ID used */
  socialSecuritySchemeId?: string;
}

/**
 * Complete calculation context stored in payroll_line_items.calculation_context
 */
export interface PayrollCalculationContext {
  employeeContext: EmployeeContext;
  employmentContext: EmploymentContext;
  salaryContext: SalaryContext;
  timeContext: TimeContext;
  calculationMeta: CalculationMeta;
}

/**
 * Helper to build calculation context from payroll calculation inputs
 */
export function buildCalculationContext(params: {
  // Employee context
  fiscalParts: number;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren?: number;
  hasFamily: boolean;

  // Employment context
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h';
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  sectorCode: string;

  // Salary context
  salaireCategoriel: number;
  sursalaire?: number;
  components: SalaryComponentInstance[];
  allowances: {
    housing: number;
    transport: number;
    meal: number;
    seniority: number;
    family: number;
  };

  // Time context
  hireDate: Date;
  terminationDate?: Date;
  periodStart: Date;
  periodEnd: Date;
  daysWorkedThisMonth?: number;
  hoursWorkedThisMonth?: number;

  // Calculation meta
  countryCode: string;
  taxSystemId?: string;
  socialSecuritySchemeId?: string;
}): PayrollCalculationContext {
  return {
    employeeContext: {
      fiscalParts: params.fiscalParts,
      maritalStatus: params.maritalStatus || 'single',
      dependentChildren: params.dependentChildren || 0,
      hasFamily: params.hasFamily,
    },
    employmentContext: {
      rateType: params.rateType,
      contractType: params.contractType || 'CDI',
      weeklyHoursRegime: params.weeklyHoursRegime,
      paymentFrequency: params.paymentFrequency || 'MONTHLY',
      sectorCode: params.sectorCode,
    },
    salaryContext: {
      salaireCategoriel: params.salaireCategoriel,
      sursalaire: params.sursalaire,
      components: params.components,
      allowances: params.allowances,
    },
    timeContext: {
      hireDate: params.hireDate.toISOString().split('T')[0],
      terminationDate: params.terminationDate?.toISOString().split('T')[0],
      periodStart: params.periodStart.toISOString().split('T')[0],
      periodEnd: params.periodEnd.toISOString().split('T')[0],
      daysWorkedThisMonth: params.daysWorkedThisMonth,
      hoursWorkedThisMonth: params.hoursWorkedThisMonth,
    },
    calculationMeta: {
      version: 'v2',
      engine: 'calculatePayrollV2',
      countryCode: params.countryCode,
      calculatedAt: new Date().toISOString(),
      taxSystemId: params.taxSystemId,
      socialSecuritySchemeId: params.socialSecuritySchemeId,
    },
  };
}
