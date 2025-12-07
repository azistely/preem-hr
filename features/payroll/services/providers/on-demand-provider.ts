/**
 * On-Demand Payroll Data Provider
 *
 * Loads employee payroll data via parallel database queries.
 * Used for single-employee recalculation where batch prefetching
 * would be inefficient.
 *
 * Key features:
 * - Parallel queries for optimal latency
 * - Uses shared transform function for consistency with batch provider
 * - Returns null for employees that should be skipped
 */

import { db } from '@/lib/db';
import {
  employees,
  employeeSalaries,
  timeEntries,
} from '@/lib/db/schema';
import { employmentContracts } from '@/drizzle/schema';
import { and, eq, sql, or, isNull, desc } from 'drizzle-orm';
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
  type RawACPData,
  type SalaryBreakdown,
  type BaseSalaryAmounts,
} from './transform-employee-data';
import {
  calculateFiscalPartsFromDependents,
  getVerifiedDependentsCount,
} from '@/features/employees/services/dependent-verification.service';
import {
  processEmployeeAdvances,
  getPayrollMonth,
} from '../salary-advance-integration';
import { aggregateTimeEntriesForPayroll } from '../time-entries-aggregation.service';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

/**
 * On-Demand Payroll Data Provider
 *
 * Fetches employee data via parallel database queries.
 * Each call to getEmployeeData() makes ~6 parallel queries.
 */
export class OnDemandPayrollDataProvider implements PayrollDataProvider {
  constructor(
    private tenantId: string,
    private periodStart: string,
    private periodEnd: string,
    private payrollRunId: string,
    private countryCode: string
  ) {}

  /**
   * Get unified payroll data for a single employee
   *
   * Executes parallel queries for:
   * 1. Employee record
   * 2. Current salary
   * 3. Current contract
   * 4. Fiscal parts (from dependents)
   * 5. CMU dependents
   * 6. Time entries (for DAILY/CDDTI)
   * 7. Salary advances
   */
  async getEmployeeData(employeeId: string): Promise<EmployeePayrollData | null> {
    // First, get the employee to determine contract type for parallel query optimization
    const employee = await this.fetchEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get contract first to determine if we need time data
    // Pass employee status to allow terminated employees to access their (now inactive) contract
    const isTerminatedEmployee = employee.status === 'terminated';
    const contract = await this.fetchContract(employeeId, isTerminatedEmployee);
    const contractType = contract?.contractType as 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | undefined;
    const rateType = (employee.rateType || 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY';

    // Execute remaining queries in parallel
    const [
      salary,
      dependentData,
      timeData,
      advanceData,
    ] = await Promise.all([
      this.fetchSalary(employeeId),
      this.fetchDependentData(employeeId),
      this.fetchTimeData(employeeId, rateType, contractType),
      this.fetchAdvances(employeeId),
    ]);

    if (!salary) {
      throw new Error('Aucun salaire trouvé pour cet employé');
    }

    // Get salary component breakdown
    const { breakdown, baseAmounts, effectiveSeniorityBonus } = await this.processSalaryComponents(
      salary,
      employee,
      contractType
    );

    // Prepare ACP data from employee record
    const acpData: RawACPData = {
      acpPaymentActive: (employee as any).acpPaymentActive || false,
      acpPaymentDate: (employee as any).acpPaymentDate,
      acpLastPaidAt: (employee as any).acpLastPaidAt,
    };

    // Transform to unified format
    const data = transformToEmployeePayrollData(
      employee as RawEmployeeRecord,
      salary as RawSalaryRecord,
      contract as RawContractRecord | null,
      dependentData,
      timeData,
      advanceData,
      breakdown,
      baseAmounts,
      effectiveSeniorityBonus,
      acpData,
      this.periodStart,
      this.periodEnd
    );

    // Check if employee should be skipped
    const skipCheck = shouldSkipEmployee(data);
    if (skipCheck.skip) {
      console.log(`[ON-DEMAND PROVIDER] Skipping: ${skipCheck.reason}`);
      return null;
    }

    return data;
  }

  // ============================================
  // Private Query Methods
  // ============================================

  private async fetchEmployee(employeeId: string) {
    return db.query.employees.findFirst({
      where: and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, this.tenantId)
      ),
    });
  }

  private async fetchSalary(employeeId: string) {
    const salaries = await db
      .select()
      .from(employeeSalaries)
      .where(
        and(
          eq(employeeSalaries.employeeId, employeeId),
          sql`${employeeSalaries.effectiveFrom} <= ${this.periodEnd}`,
          or(
            isNull(employeeSalaries.effectiveTo),
            sql`${employeeSalaries.effectiveTo} >= ${this.periodStart}`
          )
        )
      )
      .orderBy(desc(employeeSalaries.effectiveFrom));

    return salaries[0] || null;
  }

  private async fetchContract(employeeId: string, isTerminatedEmployee: boolean = false) {
    // For active employees: only select active contracts
    // For terminated employees: include their terminated contract (needed for final pay calculation)
    return db.query.employmentContracts.findFirst({
      where: and(
        eq(employmentContracts.employeeId, employeeId),
        // For terminated employees, include inactive contracts (they were terminated with the employee)
        // For active employees, only active contracts
        isTerminatedEmployee ? undefined : eq(employmentContracts.isActive, true),
        or(
          isNull(employmentContracts.endDate),
          sql`${employmentContracts.endDate} >= ${this.periodStart}`
        )
      ),
      orderBy: desc(employmentContracts.startDate),
    });
  }

  private async fetchDependentData(employeeId: string): Promise<RawDependentData> {
    const [fiscalParts, cmuDependents] = await Promise.all([
      calculateFiscalPartsFromDependents(
        employeeId,
        this.tenantId,
        new Date(this.periodEnd)
      ),
      getVerifiedDependentsCount(
        employeeId,
        this.tenantId,
        'cmu',
        new Date(this.periodEnd)
      ),
    ]);

    return { fiscalParts, cmuDependents };
  }

  private async fetchTimeData(
    employeeId: string,
    rateType: 'MONTHLY' | 'DAILY' | 'HOURLY',
    contractType?: string
  ): Promise<RawTimeData | null> {
    // Only fetch time data for daily/hourly workers or CDDTI contracts
    if (rateType !== 'DAILY' && rateType !== 'HOURLY' && contractType !== 'CDDTI') {
      return null;
    }

    if (contractType === 'CDDTI') {
      // Use aggregation service for CDDTI (extracts overtime breakdown)
      const aggregated = await aggregateTimeEntriesForPayroll(
        employeeId,
        this.tenantId,
        this.periodStart,
        this.periodEnd
      );

      return {
        daysWorked: aggregated.daysWorked,
        totalHours: aggregated.totalHours,
        sundayHours: aggregated.sundayHours,
        nightHours: aggregated.nightHours,
        nightSundayHours: aggregated.nightSundayHours || 0,
      };
    }

    // For daily workers, count unique days
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.employeeId, employeeId),
          eq(timeEntries.tenantId, this.tenantId),
          eq(timeEntries.status, 'approved'),
          sql`${timeEntries.clockIn} >= ${this.periodStart}`,
          sql`${timeEntries.clockIn} < ${this.periodEnd}`
        )
      );

    const uniqueDays = new Set(
      entries.map(entry => {
        const date = new Date(entry.clockIn);
        return date.toISOString().split('T')[0];
      })
    );

    return {
      daysWorked: uniqueDays.size,
      totalHours: 0,
      sundayHours: 0,
      nightHours: 0,
      nightSundayHours: 0,
    };
  }

  private async fetchAdvances(employeeId: string): Promise<RawAdvanceData> {
    const payrollMonth = getPayrollMonth(
      new Date(this.periodStart),
      new Date(this.periodEnd)
    );

    const result = await processEmployeeAdvances(
      employeeId,
      this.tenantId,
      this.payrollRunId,
      payrollMonth
    );

    return {
      disbursements: result.disbursedAdvanceIds.map((id, i) => ({
        id,
        amount: i === 0 ? result.disbursementAmount : 0, // Simplify - full amount on first
      })),
      repayments: result.repaymentDetails.map((r: any) => ({
        advanceId: r.advanceId || '',
        installmentNumber: r.installmentNumber || 0,
        amount: r.amount || 0,
      })),
      netEffect: result.netEffect,
    };
  }

  private async processSalaryComponents(
    salary: any,
    employee: any,
    contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'
  ): Promise<{
    breakdown: SalaryBreakdown;
    baseAmounts: BaseSalaryAmounts;
    effectiveSeniorityBonus: number;
  }> {
    // Get components breakdown (date-range mode for multi-frequency payroll)
    const { getEmployeeSalaryComponentsForPeriod } = await import('@/lib/salary-components/component-reader');
    const breakdown = await getEmployeeSalaryComponentsForPeriod(
      salary,
      employee.id,
      this.periodStart,
      this.tenantId,
      this.periodEnd
    );

    // Extract base salary components
    const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } =
      await import('@/lib/salary-components/base-salary-loader');

    const salaryComponents = (salary.components || []) as SalaryComponentInstance[];
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

      if (effectiveSeniorityBonus > 0) {
        console.log(`[ON-DEMAND PROVIDER] Auto-calculated seniority bonus: ${effectiveSeniorityBonus} FCFA`);
      }
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
