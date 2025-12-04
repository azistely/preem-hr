/**
 * Batch Payroll Data Provider
 *
 * Uses pre-fetched Maps for O(1) lookups instead of database queries.
 * Used for bulk payroll calculation where batch prefetching is efficient.
 *
 * Key features:
 * - O(1) data lookup from pre-loaded Maps
 * - Uses shared transform function for consistency with on-demand provider
 * - Returns null for employees that should be skipped
 * - NO database calls in getEmployeeData()
 */

import type {
  PayrollDataProvider,
  EmployeePayrollData,
} from '../employee-payroll-data';
import {
  transformToEmployeePayrollData,
  shouldSkipEmployee,
  type RawEmployeeRecord,
  type RawSalaryRecord,
  type RawContractRecord,
  type RawDependentData,
  type RawTimeData,
  type RawAdvanceData,
  type SalaryBreakdown,
  type BaseSalaryAmounts,
} from './transform-employee-data';
import {
  calculateFiscalPartsFromBatch,
  type BatchPayrollData,
  type BatchEmployeeSalary,
  type BatchEmploymentContract,
  type BatchDependentData,
  type BatchTimeEntryAggregate,
  type BatchAdvanceData,
} from '../batch-prefetch.service';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

/**
 * Raw employee record type (from employees table select)
 */
type EmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  hireDate: string;
  terminationDate: string | null;
  rateType: string | null;
  paymentFrequency: string | null;
  weeklyHoursRegime: string | null;
  maritalStatus: string | null;
  jobTitle: string | null;
  bankAccount: string | null;
  customFields: Record<string, any> | null;
};

/**
 * Batch Payroll Data Provider
 *
 * Provides O(1) data lookup from pre-fetched Maps.
 * No database queries are made in getEmployeeData().
 */
export class BatchPayrollDataProvider implements PayrollDataProvider {
  private employees: Map<string, EmployeeRecord>;

  constructor(
    private batchData: BatchPayrollData,
    private employeeRecords: EmployeeRecord[],
    private tenantId: string,
    private periodStart: string,
    private periodEnd: string,
    private countryCode: string
  ) {
    // Build employee lookup map
    this.employees = new Map(
      employeeRecords.map(e => [e.id, e])
    );
  }

  /**
   * Get unified payroll data for a single employee
   *
   * Uses O(1) Map lookups - NO database queries.
   * All data must be pre-fetched via batch-prefetch.service.ts
   */
  async getEmployeeData(employeeId: string): Promise<EmployeePayrollData | null> {
    // O(1) lookups from pre-fetched Maps
    const employee = this.employees.get(employeeId);
    if (!employee) {
      throw new Error(`Employee ${employeeId} not found in batch data`);
    }

    const salary = this.batchData.salaries.get(employeeId);
    if (!salary) {
      throw new Error('Aucun salaire trouvé pour cet employé');
    }

    const contract = this.batchData.contracts.get(employeeId) || null;
    const dependentBatch = this.batchData.dependents.get(employeeId);
    const timeEntry = this.batchData.timeEntries.get(employeeId) || null;
    const advanceBatch = this.batchData.advances.get(employeeId);

    // Transform batch data to raw data format
    const dependentData = this.transformDependentData(employee, dependentBatch);
    const timeData = this.transformTimeData(timeEntry, employee.rateType, contract?.contractType);
    const advanceData = this.transformAdvanceData(advanceBatch);

    // Process salary components (sync operations, no DB)
    const { breakdown, baseAmounts, effectiveSeniorityBonus } = await this.processSalaryComponents(
      salary,
      employee,
      contract?.contractType as 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | undefined
    );

    // Transform to unified format using shared function
    const data = transformToEmployeePayrollData(
      employee as RawEmployeeRecord,
      {
        id: salary.id,
        baseSalary: salary.baseSalary,
        components: salary.components,
        effectiveFrom: salary.effectiveFrom,
        effectiveTo: salary.effectiveTo,
      } as RawSalaryRecord,
      contract ? {
        id: contract.id,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
      } as RawContractRecord : null,
      dependentData,
      timeData,
      advanceData,
      breakdown,
      baseAmounts,
      effectiveSeniorityBonus
    );

    // Check if employee should be skipped
    const skipCheck = shouldSkipEmployee(data);
    if (skipCheck.skip) {
      console.log(`[BATCH PROVIDER] Skipping: ${skipCheck.reason}`);
      return null;
    }

    return data;
  }

  // ============================================
  // Private Transform Methods (Pure functions, no DB)
  // ============================================

  private transformDependentData(
    employee: EmployeeRecord,
    batchData?: BatchDependentData
  ): RawDependentData {
    // If we have batch data, use it
    if (batchData) {
      return {
        fiscalParts: batchData.fiscalParts,
        cmuDependents: batchData.cmuDependents,
      };
    }

    // Fallback: calculate from employee marital status only (no dependents)
    const maritalStatus = employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | null;
    const fiscalParts = calculateFiscalPartsFromBatch(maritalStatus, 0);

    return {
      fiscalParts,
      cmuDependents: 0,
    };
  }

  private transformTimeData(
    batchData: BatchTimeEntryAggregate | null,
    rateType: string | null,
    contractType?: string
  ): RawTimeData | null {
    // Only return time data for daily/hourly workers or CDDTI
    const effectiveRateType = rateType || 'MONTHLY';
    if (effectiveRateType !== 'DAILY' && effectiveRateType !== 'HOURLY' && contractType !== 'CDDTI') {
      return null;
    }

    if (!batchData) {
      return {
        daysWorked: 0,
        totalHours: 0,
        sundayHours: 0,
        nightHours: 0,
        nightSundayHours: 0,
      };
    }

    return {
      daysWorked: batchData.daysWorked,
      totalHours: batchData.totalHours,
      sundayHours: batchData.sundayHours,
      nightHours: batchData.nightHours,
      nightSundayHours: batchData.nightSundayHours,
    };
  }

  private transformAdvanceData(batchData?: BatchAdvanceData): RawAdvanceData {
    if (!batchData) {
      return {
        disbursements: [],
        repayments: [],
        netEffect: 0,
      };
    }

    return {
      disbursements: batchData.disbursements,
      repayments: batchData.repayments.map(r => ({
        advanceId: r.advanceId,
        installmentNumber: r.installmentNumber,
        amount: r.amount,
      })),
      netEffect: batchData.netEffect,
    };
  }

  /**
   * Process salary components from batch data
   *
   * This is the ONE place where we might need async operations
   * for component processing, but no DB queries.
   */
  private async processSalaryComponents(
    salary: BatchEmployeeSalary,
    employee: EmployeeRecord,
    contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'
  ): Promise<{
    breakdown: SalaryBreakdown;
    baseAmounts: BaseSalaryAmounts;
    effectiveSeniorityBonus: number;
  }> {
    // Get components breakdown
    const { getEmployeeSalaryComponentsForPeriod } = await import('@/lib/salary-components/component-reader');
    const breakdown = await getEmployeeSalaryComponentsForPeriod(
      {
        components: salary.components,
        baseSalary: salary.baseSalary,
      } as any,
      employee.id,
      this.periodStart,
      this.tenantId,
      this.periodEnd
    );

    // Extract base salary components
    const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } =
      await import('@/lib/salary-components/base-salary-loader');

    const salaryComponents = salary.components || [];
    const extractedAmounts = await extractBaseSalaryAmounts(salaryComponents, this.countryCode);
    const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, this.countryCode);
    const salaireCategoriel = await getSalaireCategoriel(salaryComponents, this.countryCode);

    // Auto-calculate Prime d'ancienneté if not in stored components
    let effectiveSeniorityBonus = breakdown.seniorityBonus;

    if (effectiveSeniorityBonus === 0 && salaireCategoriel > 0) {
      const { calculateSeniorityBonus } = await import('@/lib/salary-components/component-calculator');

      const seniorityCalc = await calculateSeniorityBonus({
        baseSalary: salaireCategoriel,
        hireDate: new Date(employee.hireDate),
        currentDate: new Date(this.periodEnd),
        tenantId: this.tenantId,
        countryCode: this.countryCode,
        contractType,
      });

      effectiveSeniorityBonus = seniorityCalc.amount;
    }

    return {
      breakdown: {
        housingAllowance: breakdown.housingAllowance,
        transportAllowance: breakdown.transportAllowance,
        mealAllowance: breakdown.mealAllowance,
        seniorityBonus: effectiveSeniorityBonus,
        familyAllowance: breakdown.familyAllowance,
        otherAllowances: breakdown.otherAllowances,
        customComponents: breakdown.customComponents,
      },
      baseAmounts: {
        totalBaseSalary,
        salaireCategoriel,
        sursalaire: extractedAmounts['12'] || 0,
      },
      effectiveSeniorityBonus,
    };
  }
}
