/**
 * Salary Advance Repayment Calculator Service
 *
 * Purpose: Calculate repayment schedules for salary advances
 * Features:
 * - Monthly installment calculation with proper rounding
 * - Complete repayment schedule generation
 * - First deduction month calculation
 * - Last installment adjustment for exact repayment
 *
 * Business Rules:
 * - Repayment starts the month AFTER disbursement
 * - Monthly deduction is amount ÷ months (rounded up)
 * - Last installment is adjusted to ensure exact total
 * - All amounts in currency minor units (e.g., FCFA)
 */

import type {
  RepaymentSchedule,
  RepaymentInstallment,
  RepaymentCalculationInput,
} from '@/features/salary-advances/types/salary-advance.types';
import { RepaymentStatus } from '@/lib/db/schema/salary-advances';

/**
 * Calculate complete repayment schedule for a salary advance
 *
 * @param input - Calculation parameters
 * @returns Complete repayment schedule with all installments
 *
 * @example
 * ```typescript
 * const schedule = calculateRepaymentSchedule({
 *   amount: 100000,
 *   repaymentMonths: 3,
 *   disbursementDate: new Date('2025-01-15')
 * });
 * // Returns:
 * // {
 * //   totalAmount: 100000,
 * //   repaymentMonths: 3,
 * //   monthlyDeduction: 33334,
 * //   firstDeductionMonth: '2025-02-01',
 * //   installments: [
 * //     { installmentNumber: 1, dueMonth: '2025-02-01', amount: 33334, status: 'pending' },
 * //     { installmentNumber: 2, dueMonth: '2025-03-01', amount: 33334, status: 'pending' },
 * //     { installmentNumber: 3, dueMonth: '2025-04-01', amount: 33332, status: 'pending' }
 * //   ]
 * // }
 * ```
 */
export function calculateRepaymentSchedule(
  input: RepaymentCalculationInput
): RepaymentSchedule {
  const { amount, repaymentMonths, disbursementDate } = input;

  // Validate inputs
  if (amount <= 0) {
    throw new Error('Repayment amount must be positive');
  }
  if (repaymentMonths < 1 || repaymentMonths > 12) {
    throw new Error('Repayment months must be between 1 and 12');
  }

  // Calculate monthly deduction (rounded up to avoid fractional cents)
  const monthlyDeduction = Math.ceil(amount / repaymentMonths);

  // Calculate first deduction month (month after disbursement)
  const firstDeductionMonth = calculateFirstDeductionMonth(disbursementDate);

  // Generate installments
  const installments = generateInstallments(
    amount,
    repaymentMonths,
    monthlyDeduction,
    firstDeductionMonth
  );

  return {
    totalAmount: amount,
    repaymentMonths,
    monthlyDeduction,
    firstDeductionMonth,
    installments,
  };
}

/**
 * Calculate the first month when repayment deductions should start
 *
 * Business Rule: Deductions start the month AFTER disbursement
 * - If disbursed on 2025-01-15, first deduction is 2025-02-01
 * - If no disbursement date, assume next month from today
 *
 * @param disbursementDate - Date when advance was disbursed (optional)
 * @returns First deduction month in YYYY-MM-01 format
 */
export function calculateFirstDeductionMonth(
  disbursementDate?: Date | string
): string {
  const baseDate = disbursementDate ? new Date(disbursementDate) : new Date();

  // Move to next month
  const firstDeduction = new Date(baseDate);
  firstDeduction.setMonth(firstDeduction.getMonth() + 1);

  // Always use the 1st of the month
  firstDeduction.setDate(1);

  // Format as YYYY-MM-01
  return formatMonthDate(firstDeduction);
}

/**
 * Generate array of repayment installments
 *
 * Key Logic:
 * - All installments use monthlyDeduction amount
 * - EXCEPT last installment which is adjusted to ensure exact total
 * - This handles rounding differences
 *
 * @example
 * Amount: 100,000 FCFA over 3 months
 * - Monthly deduction: ceil(100000/3) = 33,334
 * - Installment 1: 33,334
 * - Installment 2: 33,334
 * - Installment 3: 33,332 (adjusted: 100000 - 66668 = 33,332)
 * - Total: 100,000 (exact)
 */
function generateInstallments(
  totalAmount: number,
  repaymentMonths: number,
  monthlyDeduction: number,
  firstDeductionMonth: string
): RepaymentInstallment[] {
  const installments: RepaymentInstallment[] = [];
  const firstMonth = new Date(firstDeductionMonth);

  for (let i = 0; i < repaymentMonths; i++) {
    const isLastInstallment = i === repaymentMonths - 1;

    // Calculate due month
    const dueMonth = new Date(firstMonth);
    dueMonth.setMonth(dueMonth.getMonth() + i);

    // Determine installment amount
    let installmentAmount: number;
    if (isLastInstallment) {
      // Last installment: adjust to ensure exact total repayment
      const previousTotal = monthlyDeduction * (repaymentMonths - 1);
      installmentAmount = totalAmount - previousTotal;
    } else {
      // Regular installment: use standard monthly deduction
      installmentAmount = monthlyDeduction;
    }

    installments.push({
      installmentNumber: i + 1,
      dueMonth: formatMonthDate(dueMonth),
      amount: installmentAmount,
      status: RepaymentStatus.PENDING,
    });
  }

  return installments;
}

/**
 * Format date as YYYY-MM-01 string
 *
 * @param date - Date to format
 * @returns Formatted date string (always 1st of month)
 */
function formatMonthDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Recalculate remaining installments after a partial payment
 *
 * Use case: Employee leaves mid-repayment, need to recalculate schedule
 *
 * @param remainingBalance - Unpaid balance on the advance
 * @param remainingMonths - Number of months left for repayment
 * @param nextDeductionMonth - Next month when deduction is due
 * @returns Updated repayment schedule
 */
export function recalculateRemainingSchedule(
  remainingBalance: number,
  remainingMonths: number,
  nextDeductionMonth: string
): RepaymentSchedule {
  return calculateRepaymentSchedule({
    amount: remainingBalance,
    repaymentMonths: remainingMonths,
    disbursementDate: new Date(nextDeductionMonth),
  });
}

/**
 * Calculate total amount repaid from installments
 *
 * @param installments - Array of repayment installments
 * @returns Sum of all paid/partial installment amounts
 */
export function calculateTotalRepaid(
  installments: RepaymentInstallment[]
): number {
  return installments
    .filter(
      (inst) =>
        inst.status === RepaymentStatus.PAID ||
        inst.status === RepaymentStatus.PARTIAL
    )
    .reduce((sum, inst) => sum + inst.amount, 0);
}

/**
 * Calculate remaining balance on an advance
 *
 * @param approvedAmount - Total amount approved for the advance
 * @param installments - Array of repayment installments
 * @returns Remaining unpaid balance
 */
export function calculateRemainingBalance(
  approvedAmount: number,
  installments: RepaymentInstallment[]
): number {
  const totalRepaid = calculateTotalRepaid(installments);
  return Math.max(0, approvedAmount - totalRepaid);
}

/**
 * Get next pending installment
 *
 * @param installments - Array of repayment installments
 * @returns Next installment with pending status, or undefined if none
 */
export function getNextPendingInstallment(
  installments: RepaymentInstallment[]
): RepaymentInstallment | undefined {
  return installments
    .filter((inst) => inst.status === RepaymentStatus.PENDING)
    .sort((a, b) => a.installmentNumber - b.installmentNumber)[0];
}

/**
 * Check if repayment schedule is complete
 *
 * @param installments - Array of repayment installments
 * @returns True if all installments are paid or waived
 */
export function isRepaymentComplete(
  installments: RepaymentInstallment[]
): boolean {
  return installments.every(
    (inst) =>
      inst.status === RepaymentStatus.PAID ||
      inst.status === RepaymentStatus.WAIVED
  );
}

/**
 * Get installments due in a specific month
 *
 * @param installments - Array of repayment installments
 * @param month - Month to check (YYYY-MM-01 format)
 * @returns Installments due in the specified month
 */
export function getInstallmentsDueInMonth(
  installments: RepaymentInstallment[],
  month: string
): RepaymentInstallment[] {
  return installments.filter((inst) => inst.dueMonth === month);
}

/**
 * Validate repayment schedule integrity
 *
 * Checks:
 * - Sum of installments equals total amount
 * - No gaps in installment numbers
 * - Due months are sequential
 *
 * @param schedule - Repayment schedule to validate
 * @returns Validation result with any errors found
 */
export function validateRepaymentSchedule(schedule: RepaymentSchedule): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check: Sum of installments equals total amount
  const sumOfInstallments = schedule.installments.reduce(
    (sum, inst) => sum + inst.amount,
    0
  );
  if (sumOfInstallments !== schedule.totalAmount) {
    errors.push(
      `Sum of installments (${sumOfInstallments}) does not equal total amount (${schedule.totalAmount})`
    );
  }

  // Check: Installment count matches repayment months
  if (schedule.installments.length !== schedule.repaymentMonths) {
    errors.push(
      `Installment count (${schedule.installments.length}) does not match repayment months (${schedule.repaymentMonths})`
    );
  }

  // Check: No gaps in installment numbers
  const installmentNumbers = schedule.installments.map(
    (inst) => inst.installmentNumber
  );
  const expectedNumbers = Array.from(
    { length: schedule.repaymentMonths },
    (_, i) => i + 1
  );
  const missingNumbers = expectedNumbers.filter(
    (num) => !installmentNumbers.includes(num)
  );
  if (missingNumbers.length > 0) {
    errors.push(`Missing installment numbers: ${missingNumbers.join(', ')}`);
  }

  // Check: Due months are sequential
  const sortedInstallments = [...schedule.installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );
  for (let i = 1; i < sortedInstallments.length; i++) {
    const prevMonth = new Date(sortedInstallments[i - 1]!.dueMonth);
    const currMonth = new Date(sortedInstallments[i]!.dueMonth);
    const monthDiff =
      (currMonth.getFullYear() - prevMonth.getFullYear()) * 12 +
      currMonth.getMonth() -
      prevMonth.getMonth();

    if (monthDiff !== 1) {
      errors.push(
        `Non-sequential months between installment ${i} and ${i + 1}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
