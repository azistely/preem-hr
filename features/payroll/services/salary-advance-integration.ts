/**
 * Salary Advance Integration Service for Payroll
 *
 * Integrates salary advance disbursement and repayment with payroll processing.
 * This service is called during payroll runs to:
 * - Disburse approved advances (add to net salary)
 * - Deduct monthly repayments (subtract from net salary)
 * - Track all advance-related transactions
 */

import {
  disburseAdvance,
  processRepayment,
  listAdvances,
} from '@/server/services/salary-advances/salary-advance.service';
import { db } from '@/lib/db';
import { salaryAdvanceRepayments } from '@/lib/db/schema/salary-advances';
import { and, eq } from 'drizzle-orm';
import { AdvanceStatus, RepaymentStatus } from '@/lib/db/schema/salary-advances';

/**
 * Result of processing salary advances for an employee
 */
export interface AdvanceProcessingResult {
  // Disbursements (money paid to employee)
  disbursementAmount: number; // Total advances disbursed this payroll
  disbursedAdvanceIds: string[]; // IDs of advances disbursed

  // Repayments (money deducted from employee)
  repaymentAmount: number; // Total deductions for advance repayments
  repaymentDetails: Array<{
    advanceId: string;
    installmentNumber: number;
    amount: number;
  }>;

  // Net effect on salary
  netEffect: number; // disbursementAmount - repaymentAmount
}

/**
 * Get approved advances ready for disbursement
 *
 * Called at the start of payroll run to find all approved advances
 * that need to be disbursed.
 *
 * @param tenantId - Tenant ID
 * @returns List of advance IDs ready for disbursement
 */
export async function getAdvancesForDisbursement(
  tenantId: string
): Promise<string[]> {
  const result = await listAdvances(tenantId, {
    status: AdvanceStatus.APPROVED,
    limit: 100,
  });

  return result.advances.map((advance) => advance.id);
}

/**
 * Get pending repayment installments for an employee in a specific month
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param payrollMonth - Month in YYYY-MM format (e.g., "2025-12")
 * @returns Pending installments for this month
 */
async function getPendingRepaymentsForMonth(
  employeeId: string,
  tenantId: string,
  payrollMonth: string
): Promise<
  Array<{
    advanceId: string;
    installmentNumber: number;
    amount: number;
  }>
> {
  // Get all active advances for this employee
  const result = await listAdvances(tenantId, {
    employeeId,
    status: [AdvanceStatus.DISBURSED, AdvanceStatus.ACTIVE],
    limit: 100,
  });

  const pendingRepayments: Array<{
    advanceId: string;
    installmentNumber: number;
    amount: number;
  }> = [];

  // For each advance, find pending installments due this month
  for (const advance of result.advances) {
    const installments = await db
      .select()
      .from(salaryAdvanceRepayments)
      .where(
        and(
          eq(salaryAdvanceRepayments.salaryAdvanceId, advance.id),
          eq(salaryAdvanceRepayments.tenantId, tenantId),
          eq(salaryAdvanceRepayments.dueMonth, payrollMonth),
          eq(salaryAdvanceRepayments.status, RepaymentStatus.PENDING)
        )
      );

    for (const installment of installments) {
      pendingRepayments.push({
        advanceId: advance.id,
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.plannedAmount),
      });
    }
  }

  return pendingRepayments;
}

/**
 * Process salary advances for an employee during payroll
 *
 * This function:
 * 1. Checks for approved advances needing disbursement
 * 2. Checks for pending repayments due this month
 * 3. Returns the net effect on employee's salary
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param payrollRunId - Current payroll run ID
 * @param payrollMonth - Month in YYYY-MM format (e.g., "2025-12")
 * @returns Processing result with disbursements and repayments
 */
export async function processEmployeeAdvances(
  employeeId: string,
  tenantId: string,
  payrollRunId: string,
  payrollMonth: string
): Promise<AdvanceProcessingResult> {
  const result: AdvanceProcessingResult = {
    disbursementAmount: 0,
    disbursedAdvanceIds: [],
    repaymentAmount: 0,
    repaymentDetails: [],
    netEffect: 0,
  };

  // 1. Check for approved advances to disburse
  const approvedAdvances = await listAdvances(tenantId, {
    employeeId,
    status: AdvanceStatus.APPROVED,
    limit: 10,
  });

  for (const advance of approvedAdvances.advances) {
    try {
      // Disburse the advance
      await disburseAdvance(advance.id, tenantId, payrollRunId, new Date());

      const disbursedAmount = Number(advance.approvedAmount || 0);
      result.disbursementAmount += disbursedAmount;
      result.disbursedAdvanceIds.push(advance.id);

      console.log(
        `[ADVANCE] Disbursed ${disbursedAmount} FCFA for employee ${employeeId} (advance ${advance.id})`
      );
    } catch (error) {
      console.error(
        `[ADVANCE ERROR] Failed to disburse advance ${advance.id}:`,
        error
      );
      // Continue with other advances
    }
  }

  // 2. Check for pending repayments due this month
  const pendingRepayments = await getPendingRepaymentsForMonth(
    employeeId,
    tenantId,
    payrollMonth
  );

  for (const repayment of pendingRepayments) {
    try {
      // Process the repayment
      await processRepayment(
        repayment.advanceId,
        tenantId,
        repayment.installmentNumber,
        repayment.amount,
        payrollRunId
      );

      result.repaymentAmount += repayment.amount;
      result.repaymentDetails.push(repayment);

      console.log(
        `[ADVANCE] Deducted ${repayment.amount} FCFA from employee ${employeeId} (advance ${repayment.advanceId}, installment ${repayment.installmentNumber})`
      );
    } catch (error) {
      console.error(
        `[ADVANCE ERROR] Failed to process repayment for advance ${repayment.advanceId}:`,
        error
      );
      // Continue with other repayments
    }
  }

  // 3. Calculate net effect
  result.netEffect = result.disbursementAmount - result.repaymentAmount;

  return result;
}

/**
 * Get payroll month in YYYY-MM format from period dates
 *
 * @param periodStart - Payroll period start date
 * @param periodEnd - Payroll period end date
 * @returns Month string in YYYY-MM format
 */
export function getPayrollMonth(periodStart: Date, periodEnd: Date): string {
  // Use the period end month as the payroll month
  // (e.g., if period is Dec 1-31, month is "2025-12")
  const year = periodEnd.getFullYear();
  const month = (periodEnd.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}
