/**
 * Unified Employee Payroll Processor
 *
 * CRITICAL: This is the SINGLE function that processes one employee's payroll.
 * It is used by BOTH single-employee recalculation AND batch calculation.
 *
 * Any changes to calculation logic go HERE - applied everywhere automatically.
 *
 * Architecture:
 * 1. Data providers (on-demand or batch) produce EmployeePayrollData
 * 2. This function processes EmployeePayrollData → PayrollLineItemData
 * 3. Entry points save PayrollLineItemData to database
 */

import type {
  EmployeePayrollData,
  PayrollRunContext,
  TenantContext,
  PayrollLineItemData,
} from './employee-payroll-data';
import { calculatePayrollV2 } from './payroll-calculation-v2';
import { buildCalculationContext } from '../types/calculation-context';
import { calculateACP, type ACPCalculationResult } from '@/features/leave/services/acp-calculation.service';

/**
 * SINGLE function that processes one employee's payroll.
 * Used by BOTH single-employee recalculation AND batch calculation.
 *
 * @param data - Unified employee payroll data (from any provider)
 * @param run - Payroll run context
 * @param tenant - Tenant context
 * @returns PayrollLineItemData ready for database insertion
 */
export async function processEmployeePayroll(
  data: EmployeePayrollData,
  run: PayrollRunContext,
  tenant: TenantContext
): Promise<PayrollLineItemData> {
  const { employee, salary, dependents, timeData, advances } = data;

  // Determine if this is a component-based calculation (CDDTI workers)
  // IMPORTANT: For CDDTI workers with component-based salary, pass baseSalary: 0
  // to trigger component-based calculation path (not legacy field-based path)
  // Component-based path correctly multiplies hourly rates by hours worked
  const useComponentBasedCalculation =
    employee.contractType === 'CDDTI' && salary.components.length > 0;

  // Prepare calculation input
  const calculationInput = {
    employeeId: employee.id,
    tenantId: run.tenantId,
    countryCode: tenant.countryCode,
    sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',
    workAccidentRate: tenant.workAccidentRate ?? undefined,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,

    // Salary - use 0 for CDDTI to trigger component-based path
    baseSalary: useComponentBasedCalculation ? 0 : salary.baseSalary,
    salaireCategoriel: salary.salaireCategoriel,
    sursalaire: salary.sursalaire,

    // Allowances - use 0 for CDDTI to avoid duplication
    housingAllowance: useComponentBasedCalculation ? 0 : salary.breakdown.housingAllowance,
    transportAllowance: useComponentBasedCalculation ? 0 : salary.breakdown.transportAllowance,
    mealAllowance: useComponentBasedCalculation ? 0 : salary.breakdown.mealAllowance,
    seniorityBonus: useComponentBasedCalculation ? 0 : salary.breakdown.seniorityBonus,
    familyAllowance: useComponentBasedCalculation ? 0 : salary.breakdown.familyAllowance,
    otherAllowances: useComponentBasedCalculation ? [] : salary.breakdown.otherAllowances,

    // For CDDTI: Pass ALL salary components so they can be multiplied by hours
    customComponents: useComponentBasedCalculation
      ? salary.components.map(c => ({
          ...c,
          name: c.name || 'Component',
          sourceType: 'standard' as const,
        }))
      : salary.breakdown.customComponents,

    // Family/dependents
    fiscalParts: dependents.fiscalParts,
    hasFamily: dependents.hasFamily,
    maritalStatus: employee.maritalStatus ?? undefined,
    dependentChildren: dependents.cmuBeneficiaryCount,

    // Employment details
    hireDate: employee.hireDate,
    terminationDate: employee.terminationDate ?? undefined,
    rateType: employee.rateType,
    contractType: employee.contractType ?? undefined,
    paymentFrequency: employee.paymentFrequency ?? undefined,
    weeklyHoursRegime: employee.weeklyHoursRegime ?? undefined,

    // Time data (for DAILY/CDDTI workers)
    daysWorkedThisMonth: timeData?.daysWorked,
    hoursWorkedThisMonth: timeData?.totalHours,
    sundayHours: timeData?.sundayHours || 0,
    nightHours: timeData?.nightHours || 0,
    nightSundayHours: timeData?.nightSundayHours || 0,
  };

  // ============================================
  // ACP (Allocations de Congés Payés) Auto-Calculation
  // ============================================
  // Check if employee should receive ACP this payroll period
  // Only CDI/CDD contracts are eligible (checked in data provider transform)
  let acpAmount = 0;
  let acpResult: ACPCalculationResult | null = null;

  if (data.acpPaymentInfo?.shouldCalculate) {
    try {
      acpResult = await calculateACP({
        employeeId: employee.id,
        tenantId: run.tenantId,
        countryCode: tenant.countryCode,
        acpPaymentDate: new Date(data.acpPaymentInfo.acpPaymentDate),
        payrollPeriodStart: run.periodStart,
        payrollPeriodEnd: run.periodEnd,
      });

      if (acpResult.isEligible) {
        acpAmount = acpResult.acpAmount;
        console.log(`[ACP AUTO-CALC] Employee ${employee.id} (${employee.firstName} ${employee.lastName}): ACP = ${acpAmount.toLocaleString('fr-FR')} FCFA (${acpResult.leaveDaysTakenCalendar} days leave)`);
      } else {
        console.log(`[ACP AUTO-CALC] Employee ${employee.id}: Not eligible - ${acpResult.skipReason}`);
      }
    } catch (error) {
      // Log warning but continue payroll without ACP - don't block employee payment
      console.warn(`[ACP AUTO-CALC] Failed for employee ${employee.id}:`, error instanceof Error ? error.message : error);
    }
  }

  // Add ACP to calculation input if applicable
  const calculationInputWithACP = {
    ...calculationInput,
    acpAmount: acpAmount > 0 ? acpAmount : undefined,
  };

  // Call core calculation engine (already shared)
  const calculation = await calculatePayrollV2(calculationInputWithACP);

  // Process salary advances
  const disbursementAmount = advances.disbursements.reduce((sum, d) => sum + d.amount, 0);
  const repaymentAmount = advances.repayments.reduce((sum, r) => sum + r.amount, 0);
  const finalNetSalary = calculation.netSalary + advances.netEffect;

  // Build calculation context for auditability
  const calculationContext = buildCalculationContext({
    // Employee context
    fiscalParts: dependents.fiscalParts,
    maritalStatus: employee.maritalStatus ?? undefined,
    dependentChildren: dependents.cmuBeneficiaryCount,
    hasFamily: dependents.hasFamily,

    // Employment context
    rateType: employee.rateType,
    contractType: employee.contractType ?? undefined,
    weeklyHoursRegime: employee.weeklyHoursRegime ?? undefined,
    paymentFrequency: employee.paymentFrequency ?? undefined,
    sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',

    // Salary context
    salaireCategoriel: salary.salaireCategoriel,
    sursalaire: salary.sursalaire,
    components: salary.components,
    allowances: {
      housing: salary.breakdown.housingAllowance,
      transport: salary.breakdown.transportAllowance,
      meal: salary.breakdown.mealAllowance,
      seniority: salary.breakdown.seniorityBonus,
      family: salary.breakdown.familyAllowance,
    },

    // Time context
    hireDate: employee.hireDate,
    terminationDate: employee.terminationDate ?? undefined,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    daysWorkedThisMonth: timeData?.daysWorked,
    hoursWorkedThisMonth: timeData?.totalHours,

    // Calculation meta
    countryCode: tenant.countryCode,
  });

  // Return line item data
  return {
    tenantId: run.tenantId,
    payrollRunId: run.id,
    employeeId: employee.id,

    // Denormalized employee info (for historical accuracy and exports)
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeNumber: employee.employeeNumber,
    positionTitle: employee.jobTitle || null,

    // Salary information
    baseSalary: String(calculation.baseSalary),
    allowances: {
      housing: salary.breakdown.housingAllowance,
      transport: salary.breakdown.transportAllowance,
      meal: salary.breakdown.mealAllowance,
      seniority: salary.breakdown.seniorityBonus,
      family: salary.breakdown.familyAllowance,
    },

    // Time tracking
    daysWorked: String(calculation.daysWorked),
    daysAbsent: '0',
    hoursWorked: timeData?.totalHours ? String(timeData.totalHours) : '0',
    overtimeHours: {},

    // Gross calculation
    grossSalary: String(calculation.grossSalary),
    brutImposable: String(calculation.brutImposable),

    // Detailed breakdowns (for CDDTI components like gratification, congés payés, précarité)
    // Add ACP to earnings details if it was calculated
    earningsDetails: acpAmount > 0
      ? [
          ...(calculation.earningsDetails || []),
          {
            code: 'ACP',
            name: 'Allocations de Congés Payés',
            amount: acpAmount,
            isTaxable: true,
            isContributable: true,
            details: acpResult ? {
              leaveDaysTaken: acpResult.leaveDaysTakenCalendar,
              dailyAverageSalary: acpResult.dailyAverageSalary,
              referencePeriodStart: acpResult.referencePeriodStart.toISOString(),
              referencePeriodEnd: acpResult.referencePeriodEnd.toISOString(),
            } : undefined,
          },
        ]
      : (calculation.earningsDetails || []),
    deductionsDetails: calculation.deductionsDetails || [],

    // Deductions (both JSONB and dedicated columns for exports)
    taxDeductions: { its: calculation.its },
    employeeContributions: {
      cnps: calculation.cnpsEmployee,
      cmu: calculation.cmuEmployee,
    },
    otherDeductions: {
      salaryAdvances: {
        disbursements: disbursementAmount,
        repayments: repaymentAmount,
        repaymentDetails: advances.repayments,
        disbursedAdvanceIds: advances.disbursements.map(d => d.id),
      },
    },

    // Individual deduction columns (for easy export access)
    cnpsEmployee: String(calculation.cnpsEmployee),
    cmuEmployee: String(calculation.cmuEmployee),
    its: String(calculation.its),

    // Net calculation
    totalDeductions: String(calculation.totalDeductions + repaymentAmount),
    netSalary: String(finalNetSalary),

    // Employer costs (both JSONB and dedicated columns)
    employerContributions: {
      cnps: calculation.cnpsEmployer,
      cmu: calculation.cmuEmployer,
    },
    cnpsEmployer: String(calculation.cnpsEmployer),
    cmuEmployer: String(calculation.cmuEmployer),
    totalEmployerCost: String(calculation.employerCost),

    // Other taxes
    totalOtherTaxes: String(calculation.otherTaxesEmployer || 0),
    otherTaxesDetails: calculation.otherTaxesDetails || [],

    // Contribution details (Pension, AT, PF breakdown for UI display)
    contributionDetails: calculation.contributionDetails || [],

    // Calculation context (for auditability and exact reproduction)
    calculationContext,

    // Payment details
    paymentMethod: 'bank_transfer',
    bankAccount: employee.bankAccount,
    status: 'pending',

    // ACP payment tracking (for updating employee record after payroll)
    acpPaymentApplied: acpAmount > 0 && acpResult ? {
      amount: acpAmount,
      employeeId: employee.id,
      leaveDaysTaken: acpResult.leaveDaysTakenCalendar,
    } : undefined,
  };
}
