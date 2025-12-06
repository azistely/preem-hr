/**
 * Shared Employee Data Transformation
 *
 * CRITICAL: This is the SINGLE transformation function used by BOTH providers.
 * Any changes here apply to ALL calculation modes (single and batch).
 *
 * This ensures consistency between:
 * - recalculateSingleEmployee() (on-demand provider)
 * - calculatePayrollRunOptimized() (batch provider)
 */

import type {
  EmployeePayrollData,
  PayrollRunContext,
} from '../employee-payroll-data';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

/**
 * Raw employee record from database (or batch prefetch)
 */
export interface RawEmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  hireDate: string | Date;
  terminationDate: string | Date | null;
  rateType: string | null;
  paymentFrequency: string | null;
  weeklyHoursRegime: string | null;
  maritalStatus: string | null;
  jobTitle: string | null;
  bankAccount: string | null;
  customFields: Record<string, any> | null;
}

/**
 * Raw salary record from database (or batch prefetch)
 */
export interface RawSalaryRecord {
  id: string;
  baseSalary: string;
  components: SalaryComponentInstance[] | null;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
}

/**
 * Raw contract record from database (or batch prefetch)
 */
export interface RawContractRecord {
  id: string;
  contractType: string;
  startDate: string | Date;
  endDate: string | Date | null;
}

/**
 * Raw dependent data (from batch prefetch or calculated)
 */
export interface RawDependentData {
  fiscalParts: number;
  cmuDependents: number;
}

/**
 * Raw time entry aggregate (from batch prefetch or calculated)
 */
export interface RawTimeData {
  daysWorked: number;
  totalHours: number;
  sundayHours: number;
  nightHours: number;
  nightSundayHours: number;
}

/**
 * Raw advance data (from batch prefetch or calculated)
 */
export interface RawAdvanceData {
  disbursements: Array<{ id: string; amount: number }>;
  repayments: Array<{
    advanceId: string;
    installmentNumber: number;
    amount: number;
  }>;
  netEffect: number;
}

/**
 * Raw ACP payment data (from employee record)
 */
export interface RawACPData {
  acpPaymentActive: boolean;
  acpPaymentDate: string | null;
  acpLastPaidAt: string | null;
}

/**
 * Salary breakdown from component reader
 * Note: Types align with ComponentsBreakdown from component-reader.ts
 */
export interface SalaryBreakdown {
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
}

/**
 * Base salary amounts extracted from components
 */
export interface BaseSalaryAmounts {
  totalBaseSalary: number;
  salaireCategoriel: number;
  sursalaire: number;
}

/**
 * SINGLE transformation function used by BOTH providers.
 * Any changes here apply to all calculation modes.
 *
 * @param employee - Raw employee record
 * @param salary - Raw salary record
 * @param contract - Raw contract record (optional)
 * @param dependents - Dependent data (fiscal parts + CMU)
 * @param timeData - Time tracking data (for DAILY/CDDTI)
 * @param advances - Salary advance data
 * @param breakdown - Salary component breakdown
 * @param baseAmounts - Extracted base salary amounts
 * @param effectiveSeniorityBonus - Auto-calculated seniority bonus
 * @param acpData - ACP payment data (optional)
 * @param periodStart - Payroll period start date (for ACP date check)
 * @param periodEnd - Payroll period end date (for ACP date check)
 * @returns Unified EmployeePayrollData
 */
export function transformToEmployeePayrollData(
  employee: RawEmployeeRecord,
  salary: RawSalaryRecord,
  contract: RawContractRecord | null,
  dependents: RawDependentData,
  timeData: RawTimeData | null,
  advances: RawAdvanceData,
  breakdown: SalaryBreakdown,
  baseAmounts: BaseSalaryAmounts,
  effectiveSeniorityBonus: number,
  acpData?: RawACPData,
  periodStart?: string,
  periodEnd?: string
): EmployeePayrollData {
  // Parse dates consistently
  const hireDate = typeof employee.hireDate === 'string'
    ? new Date(employee.hireDate)
    : employee.hireDate;

  const terminationDate = employee.terminationDate
    ? (typeof employee.terminationDate === 'string'
        ? new Date(employee.terminationDate)
        : employee.terminationDate)
    : null;

  const effectiveFrom = typeof salary.effectiveFrom === 'string'
    ? new Date(salary.effectiveFrom)
    : salary.effectiveFrom;

  // Parse contract type
  const contractType = contract?.contractType as
    | 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;

  // Parse rate type with default
  const rateType = (employee.rateType || 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY';

  // Parse payment frequency
  const paymentFrequency = employee.paymentFrequency as
    | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;

  // Parse weekly hours regime
  const weeklyHoursRegime = employee.weeklyHoursRegime as
    | '40h' | '44h' | '48h' | '52h' | '56h' | null;

  // Parse marital status
  const maritalStatus = employee.maritalStatus as
    | 'single' | 'married' | 'divorced' | 'widowed' | null;

  // Extract custom fields
  const customFields = employee.customFields || {};
  const hasFamily = customFields.hasFamily || false;

  // Get salary components
  const components = (salary.components || []) as SalaryComponentInstance[];

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNumber: employee.employeeNumber,
      hireDate,
      terminationDate,
      contractType,
      rateType,
      paymentFrequency,
      weeklyHoursRegime,
      maritalStatus,
      jobTitle: employee.jobTitle,
      bankAccount: employee.bankAccount,
      customFields,
    },

    salary: {
      baseSalary: baseAmounts.totalBaseSalary,
      salaireCategoriel: baseAmounts.salaireCategoriel,
      sursalaire: baseAmounts.sursalaire,
      effectiveFrom,
      components,
      breakdown: {
        housingAllowance: breakdown.housingAllowance,
        transportAllowance: breakdown.transportAllowance,
        mealAllowance: breakdown.mealAllowance,
        seniorityBonus: effectiveSeniorityBonus,
        familyAllowance: breakdown.familyAllowance,
        otherAllowances: breakdown.otherAllowances,
        customComponents: breakdown.customComponents,
      },
    },

    dependents: {
      fiscalParts: dependents.fiscalParts,
      cmuBeneficiaryCount: dependents.cmuDependents,
      hasFamily,
    },

    timeData: timeData ? {
      daysWorked: timeData.daysWorked,
      totalHours: timeData.totalHours,
      sundayHours: timeData.sundayHours,
      nightHours: timeData.nightHours,
      nightSundayHours: timeData.nightSundayHours,
    } : null,

    advances: {
      disbursements: advances.disbursements,
      repayments: advances.repayments,
      netEffect: advances.netEffect,
    },

    // ACP payment info (populated if employee should receive ACP this period)
    acpPaymentInfo: determineACPPaymentInfo(acpData, periodStart, periodEnd, contractType),
  };
}

/**
 * Determine if ACP should be calculated for this employee in this period
 *
 * @param acpData - Raw ACP data from employee record
 * @param periodStart - Payroll period start date
 * @param periodEnd - Payroll period end date
 * @param contractType - Employee contract type (only CDI/CDD eligible)
 * @returns ACP payment info or undefined if not applicable
 */
function determineACPPaymentInfo(
  acpData?: RawACPData,
  periodStart?: string,
  periodEnd?: string,
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null
): EmployeePayrollData['acpPaymentInfo'] {
  // Skip if no ACP data or missing period dates
  if (!acpData || !periodStart || !periodEnd) {
    return undefined;
  }

  // Only CDI/CDD contracts are eligible for ACP
  if (!contractType || !['CDI', 'CDD'].includes(contractType)) {
    return undefined;
  }

  // Check if ACP is active and payment date is set
  if (!acpData.acpPaymentActive || !acpData.acpPaymentDate) {
    return undefined;
  }

  // Check if acpPaymentDate falls within the payroll period
  const acpDate = new Date(acpData.acpPaymentDate);
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  // Include the end date (<=) since payroll periods are inclusive
  const shouldCalculate = acpDate >= start && acpDate <= end;

  if (!shouldCalculate) {
    return undefined;
  }

  return {
    shouldCalculate: true,
    acpPaymentDate: acpData.acpPaymentDate,
    acpLastPaidAt: acpData.acpLastPaidAt,
  };
}

/**
 * Check if an employee should be skipped from payroll calculation
 *
 * @param data - Transformed employee payroll data
 * @returns Object with skip flag and reason
 */
export function shouldSkipEmployee(
  data: EmployeePayrollData
): { skip: boolean; reason?: string } {
  const { employee, timeData } = data;

  // Skip daily workers with 0 days worked
  if (employee.rateType === 'DAILY') {
    const daysWorked = timeData?.daysWorked || 0;
    if (daysWorked === 0) {
      return {
        skip: true,
        reason: `Daily worker ${employee.id}: 0 days worked`,
      };
    }
  }

  // Skip CDDTI workers with 0 hours worked
  if (employee.contractType === 'CDDTI') {
    const hoursWorked = timeData?.totalHours || 0;
    if (hoursWorked === 0) {
      return {
        skip: true,
        reason: `CDDTI worker ${employee.id}: 0 hours worked`,
      };
    }
  }

  return { skip: false };
}
