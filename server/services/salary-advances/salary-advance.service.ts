/**
 * Salary Advance Core Service
 *
 * Purpose: Main business logic for salary advance management
 * Features:
 * - Create advance requests with policy validation
 * - Approve/reject advances with workflow management
 * - Disburse advances and generate repayment schedules
 * - Process repayment installments through payroll
 * - Track advance lifecycle (pending → approved → disbursed → active → completed)
 * - Generate statistics and reports
 *
 * Integration:
 * - Uses salary-advance-validator for policy checks
 * - Uses repayment-calculator for schedule generation
 * - Integrates with payroll system for disbursement/deductions
 */

import { and, eq, inArray, gte, lte, sql, desc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  salaryAdvances,
  salaryAdvanceRepayments,
  AdvanceStatus,
  RepaymentStatus,
  type SalaryAdvance,
  type NewSalaryAdvance,
  type SalaryAdvanceRepayment,
  type NewSalaryAdvanceRepayment,
} from '@/lib/db/schema/salary-advances';
import { employees } from '@/lib/db/schema/employees';
import { employeeSalaries } from '@/lib/db/schema/salaries';
import { users } from '@/lib/db/schema/users';
import type {
  AdvanceRequestInput,
  AdvanceApprovalInput,
  AdvanceUpdateInput,
  AdvanceListFilters,
  SalaryAdvanceWithEmployee,
  AdvanceStatistics,
  EmployeeAdvanceStats,
  AdvanceDetailResponse,
  AdvanceListResponse,
  RepaymentInstallment,
} from '@/features/salary-advances/types/salary-advance.types';
import {
  AdvanceOperationError,
  AdvanceErrorCodes,
} from '@/features/salary-advances/types/salary-advance.types';
import { validateAdvanceRequest, getActivePolicy } from './salary-advance-validator';
import {
  calculateRepaymentSchedule,
  calculateRemainingBalance,
  isRepaymentComplete,
} from './repayment-calculator';

/**
 * Create a new salary advance request
 *
 * Workflow:
 * 1. Validate request against policy
 * 2. Snapshot employee data (salary, name, number)
 * 3. Create advance record with status='pending'
 * 4. Return created advance
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee requesting advance
 * @param userId - User ID creating the request (for audit)
 * @param input - Advance request details
 * @returns Created salary advance
 * @throws AdvanceOperationError if validation fails
 */
export async function createAdvanceRequest(
  tenantId: string,
  employeeId: string,
  userId: string,
  input: AdvanceRequestInput
): Promise<SalaryAdvance> {
  const { requestedAmount, repaymentMonths, requestReason, requestNotes } = input;

  // Validate request against policy
  const validation = await validateAdvanceRequest(
    tenantId,
    employeeId,
    requestedAmount,
    repaymentMonths
  );

  if (!validation.isValid) {
    throw new AdvanceOperationError(
      validation.errors[0]?.message ?? 'Validation échouée',
      validation.errors[0]?.code ?? AdvanceErrorCodes.NOT_ALLOWED,
      { errors: validation.errors }
    );
  }

  // Get employee data for snapshot
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  if (!employee) {
    throw new AdvanceOperationError(
      'Employé introuvable',
      AdvanceErrorCodes.EMPLOYEE_NOT_FOUND
    );
  }

  // Create advance record
  const newAdvance: NewSalaryAdvance = {
    tenantId,
    employeeId,
    requestedAmount: requestedAmount.toString(),
    repaymentMonths,
    requestReason,
    requestNotes: requestNotes ?? null,
    status: AdvanceStatus.PENDING,
    employeeNetSalaryAtRequest: validation.employeeNetSalary.toString(),
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeNumber: employee.employeeNumber,
    createdBy: userId,
  };

  const [created] = await db.insert(salaryAdvances).values(newAdvance).returning();

  if (!created) {
    throw new AdvanceOperationError(
      'Échec de création de la demande',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  return created;
}

/**
 * Approve a salary advance request
 *
 * Workflow:
 * 1. Verify advance is pending
 * 2. Optionally adjust approved amount (must be ≤ requested)
 * 3. Update status to 'approved'
 * 4. Record approver and timestamp
 *
 * @param advanceId - Advance ID to approve
 * @param tenantId - Tenant ID (for security)
 * @param userId - User ID approving (for audit)
 * @param input - Approval details
 * @returns Updated salary advance
 * @throws AdvanceOperationError if advance cannot be approved
 */
export async function approveAdvance(
  advanceId: string,
  tenantId: string,
  userId: string,
  input: AdvanceApprovalInput
): Promise<SalaryAdvance> {
  const { approved, approvedAmount, rejectedReason } = input;

  // Get current advance
  const [advance] = await db
    .select()
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!advance) {
    throw new AdvanceOperationError(
      'Avance introuvable',
      AdvanceErrorCodes.ADVANCE_NOT_FOUND
    );
  }

  // Verify current status
  if (advance.status !== AdvanceStatus.PENDING) {
    throw new AdvanceOperationError(
      `Cette avance ne peut pas être ${approved ? 'approuvée' : 'rejetée'} (statut: ${advance.status})`,
      AdvanceErrorCodes.INVALID_STATUS_TRANSITION
    );
  }

  if (approved) {
    // Approval path
    const finalAmount = approvedAmount ?? Number(advance.requestedAmount);

    // Validate approved amount
    if (finalAmount > Number(advance.requestedAmount)) {
      throw new AdvanceOperationError(
        'Le montant approuvé ne peut pas dépasser le montant demandé',
        AdvanceErrorCodes.AMOUNT_TOO_HIGH
      );
    }

    // Re-validate with approved amount
    const validation = await validateAdvanceRequest(
      tenantId,
      advance.employeeId,
      finalAmount,
      advance.repaymentMonths
    );

    if (!validation.isValid) {
      throw new AdvanceOperationError(
        `Le montant approuvé ne respecte pas les règles: ${validation.errors[0]?.message}`,
        validation.errors[0]?.code ?? AdvanceErrorCodes.NOT_ALLOWED
      );
    }

    // Calculate monthly deduction
    const monthlyDeduction = Math.ceil(finalAmount / advance.repaymentMonths);

    // Update advance to approved
    const [updated] = await db
      .update(salaryAdvances)
      .set({
        status: AdvanceStatus.APPROVED,
        approvedAmount: finalAmount.toString(),
        monthlyDeduction: monthlyDeduction.toString(),
        remainingBalance: finalAmount.toString(),
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(eq(salaryAdvances.id, advanceId))
      .returning();

    if (!updated) {
      throw new AdvanceOperationError(
        'Échec de mise à jour',
        AdvanceErrorCodes.NOT_ALLOWED
      );
    }

    return updated;
  } else {
    // Rejection path
    if (!rejectedReason) {
      throw new AdvanceOperationError(
        'Une raison de rejet est requise',
        AdvanceErrorCodes.NOT_ALLOWED
      );
    }

    const [updated] = await db
      .update(salaryAdvances)
      .set({
        status: AdvanceStatus.REJECTED,
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectedReason,
      })
      .where(eq(salaryAdvances.id, advanceId))
      .returning();

    if (!updated) {
      throw new AdvanceOperationError(
        'Échec de mise à jour',
        AdvanceErrorCodes.NOT_ALLOWED
      );
    }

    return updated;
  }
}

/**
 * Disburse an approved advance
 *
 * Workflow:
 * 1. Verify advance is approved
 * 2. Generate repayment schedule
 * 3. Create repayment installment records
 * 4. Update status to 'disbursed'
 * 5. Record disbursement date and payroll run ID
 *
 * Called by payroll system when advance payment is included in payroll
 *
 * @param advanceId - Advance ID to disburse
 * @param tenantId - Tenant ID (for security)
 * @param payrollRunId - Payroll run ID that included this disbursement
 * @param disbursementDate - Date of disbursement (optional, defaults to now)
 * @returns Updated salary advance with repayment schedule
 */
export async function disburseAdvance(
  advanceId: string,
  tenantId: string,
  payrollRunId: string,
  disbursementDate?: Date
): Promise<SalaryAdvance> {
  const [advance] = await db
    .select()
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!advance) {
    throw new AdvanceOperationError(
      'Avance introuvable',
      AdvanceErrorCodes.ADVANCE_NOT_FOUND
    );
  }

  if (advance.status !== AdvanceStatus.APPROVED) {
    throw new AdvanceOperationError(
      'Seules les avances approuvées peuvent être déboursées',
      AdvanceErrorCodes.INVALID_STATUS_TRANSITION
    );
  }

  if (!advance.approvedAmount) {
    throw new AdvanceOperationError(
      'Montant approuvé manquant',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  const approvedAmount = Number(advance.approvedAmount);
  const disbursedDate = disbursementDate ?? new Date();

  // Generate repayment schedule
  const schedule = calculateRepaymentSchedule({
    amount: approvedAmount,
    repaymentMonths: advance.repaymentMonths,
    disbursementDate: disbursedDate,
  });

  // Create repayment installment records
  const installmentRecords: NewSalaryAdvanceRepayment[] = schedule.installments.map(
    (inst) => ({
      tenantId,
      salaryAdvanceId: advanceId,
      installmentNumber: inst.installmentNumber,
      dueMonth: inst.dueMonth,
      plannedAmount: inst.amount.toString(),
      status: RepaymentStatus.PENDING,
    })
  );

  await db.insert(salaryAdvanceRepayments).values(installmentRecords);

  // Update advance to disbursed
  const [updated] = await db
    .update(salaryAdvances)
    .set({
      status: AdvanceStatus.DISBURSED,
      disbursementDate: disbursedDate,
      disbursementPayrollRunId: payrollRunId,
      firstDeductionMonth: schedule.firstDeductionMonth,
    })
    .where(eq(salaryAdvances.id, advanceId))
    .returning();

  if (!updated) {
    throw new AdvanceOperationError(
      'Échec de mise à jour',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  return updated;
}

/**
 * Process a repayment installment
 *
 * Called by payroll system when deducting advance repayment from payroll
 *
 * Workflow:
 * 1. Find pending installment for this month
 * 2. Mark as paid with actual amount and payroll run
 * 3. Update advance total_repaid and remaining_balance
 * 4. If all installments paid, mark advance as completed
 *
 * @param advanceId - Advance ID
 * @param tenantId - Tenant ID
 * @param installmentNumber - Installment number to process
 * @param actualAmount - Amount actually deducted
 * @param payrollRunId - Payroll run ID
 * @returns Updated repayment record
 */
export async function processRepayment(
  advanceId: string,
  tenantId: string,
  installmentNumber: number,
  actualAmount: number,
  payrollRunId: string
): Promise<SalaryAdvanceRepayment> {
  // Get installment
  const [installment] = await db
    .select()
    .from(salaryAdvanceRepayments)
    .where(
      and(
        eq(salaryAdvanceRepayments.salaryAdvanceId, advanceId),
        eq(salaryAdvanceRepayments.tenantId, tenantId),
        eq(salaryAdvanceRepayments.installmentNumber, installmentNumber)
      )
    )
    .limit(1);

  if (!installment) {
    throw new AdvanceOperationError(
      'Échéance introuvable',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  // Mark installment as paid
  const [updatedInstallment] = await db
    .update(salaryAdvanceRepayments)
    .set({
      status: RepaymentStatus.PAID,
      actualAmount: actualAmount.toString(),
      paidDate: new Date(),
      payrollRunId,
    })
    .where(eq(salaryAdvanceRepayments.id, installment.id))
    .returning();

  if (!updatedInstallment) {
    throw new AdvanceOperationError(
      'Échec de mise à jour',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  // Update advance totals
  await updateAdvanceTotals(advanceId, tenantId);

  return updatedInstallment;
}

/**
 * Update advance total_repaid and remaining_balance
 *
 * Also updates status to ACTIVE (first payment) or COMPLETED (all paid)
 */
async function updateAdvanceTotals(
  advanceId: string,
  tenantId: string
): Promise<void> {
  // Get advance
  const [advance] = await db
    .select()
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!advance || !advance.approvedAmount) {
    return;
  }

  // Get all repayments
  const repayments = await db
    .select()
    .from(salaryAdvanceRepayments)
    .where(
      and(
        eq(salaryAdvanceRepayments.salaryAdvanceId, advanceId),
        eq(salaryAdvanceRepayments.tenantId, tenantId)
      )
    );

  // Calculate totals
  const totalRepaid = repayments
    .filter((r: SalaryAdvanceRepayment) => r.status === RepaymentStatus.PAID && r.actualAmount)
    .reduce((sum: number, r: SalaryAdvanceRepayment) => sum + Number(r.actualAmount), 0);

  const approvedAmount = Number(advance.approvedAmount);
  const remainingBalance = Math.max(0, approvedAmount - totalRepaid);

  // Determine new status
  let newStatus = advance.status;
  if (totalRepaid > 0 && advance.status === AdvanceStatus.DISBURSED) {
    newStatus = AdvanceStatus.ACTIVE;
  }
  if (remainingBalance === 0 && isRepaymentComplete(repayments as unknown as RepaymentInstallment[])) {
    newStatus = AdvanceStatus.COMPLETED;
  }

  // Update advance
  await db
    .update(salaryAdvances)
    .set({
      totalRepaid: totalRepaid.toString(),
      remainingBalance: remainingBalance.toString(),
      status: newStatus,
    })
    .where(eq(salaryAdvances.id, advanceId));
}

/**
 * Cancel a pending advance
 *
 * @param advanceId - Advance ID to cancel
 * @param tenantId - Tenant ID
 * @returns Updated advance
 */
export async function cancelAdvance(
  advanceId: string,
  tenantId: string
): Promise<SalaryAdvance> {
  const [advance] = await db
    .select()
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!advance) {
    throw new AdvanceOperationError(
      'Avance introuvable',
      AdvanceErrorCodes.ADVANCE_NOT_FOUND
    );
  }

  if (advance.status !== AdvanceStatus.PENDING) {
    throw new AdvanceOperationError(
      'Seules les avances en attente peuvent être annulées',
      AdvanceErrorCodes.CANNOT_CANCEL
    );
  }

  const [updated] = await db
    .update(salaryAdvances)
    .set({ status: AdvanceStatus.CANCELLED })
    .where(eq(salaryAdvances.id, advanceId))
    .returning();

  if (!updated) {
    throw new AdvanceOperationError(
      'Échec de mise à jour',
      AdvanceErrorCodes.NOT_ALLOWED
    );
  }

  return updated;
}

/**
 * Get advance by ID with full details
 *
 * @param advanceId - Advance ID
 * @param tenantId - Tenant ID
 * @returns Advance with employee details and repayment schedule
 */
export async function getAdvanceById(
  advanceId: string,
  tenantId: string
): Promise<AdvanceDetailResponse | null> {
  const [advance] = await db
    .select()
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.id, advanceId),
        eq(salaryAdvances.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!advance) {
    return null;
  }

  // Get employee
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, advance.employeeId))
    .limit(1);

  // Get approver
  const approverResult = advance.approvedBy
    ? await db
        .select()
        .from(users)
        .where(eq(users.id, advance.approvedBy))
        .limit(1)
    : null;
  const approver = approverResult ? approverResult[0] : null;

  // Get repayments
  const repayments = await db
    .select()
    .from(salaryAdvanceRepayments)
    .where(eq(salaryAdvanceRepayments.salaryAdvanceId, advanceId))
    .orderBy(salaryAdvanceRepayments.installmentNumber);

  // Get policy
  const policy = await getActivePolicy(tenantId);

  // Build response
  const response: AdvanceDetailResponse = {
    ...advance,
    employee: employee
      ? {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email ?? undefined,
          position: employee.jobTitle ?? undefined,
        }
      : undefined,
    approver: approver
      ? {
          id: approver.id,
          name: `${approver.firstName} ${approver.lastName}`,
          email: approver.email ?? undefined,
        }
      : undefined,
    repayments,
    repaymentSchedule: advance.approvedAmount
      ? {
          advanceId: advance.id,
          totalAmount: Number(advance.approvedAmount),
          repaymentMonths: advance.repaymentMonths,
          monthlyDeduction: Number(advance.monthlyDeduction ?? 0),
          firstDeductionMonth: advance.firstDeductionMonth ?? '',
          installments: repayments.map((r: SalaryAdvanceRepayment) => ({
            installmentNumber: r.installmentNumber,
            dueMonth: r.dueMonth,
            amount: Number(r.plannedAmount),
            status: r.status,
          })),
        }
      : undefined as any,
    policy: policy ?? undefined as any,
    canEdit: advance.status === AdvanceStatus.PENDING,
    canCancel: advance.status === AdvanceStatus.PENDING,
    canApprove: advance.status === AdvanceStatus.PENDING,
  };

  return response;
}

/**
 * List advances with filters
 *
 * @param tenantId - Tenant ID
 * @param filters - List filters
 * @returns Paginated list of advances
 */
export async function listAdvances(
  tenantId: string,
  filters: AdvanceListFilters
): Promise<AdvanceListResponse> {
  const {
    employeeId,
    status,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  // Build where conditions
  const conditions = [eq(salaryAdvances.tenantId, tenantId)];

  if (employeeId) {
    conditions.push(eq(salaryAdvances.employeeId, employeeId));
  }

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    conditions.push(inArray(salaryAdvances.status, statuses));
  }

  if (dateFrom) {
    conditions.push(gte(salaryAdvances.requestDate, new Date(dateFrom)));
  }

  if (dateTo) {
    conditions.push(lte(salaryAdvances.requestDate, new Date(dateTo)));
  }

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(salaryAdvances)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;

  // Get advances
  const advances = await db
    .select()
    .from(salaryAdvances)
    .where(and(...conditions))
    .orderBy(desc(salaryAdvances.requestDate))
    .limit(limit)
    .offset(offset);

  return {
    advances: advances as SalaryAdvanceWithEmployee[],
    total,
    hasMore: offset + advances.length < total,
    offset,
    limit,
  };
}

/**
 * Get advance statistics for dashboard
 *
 * @param tenantId - Tenant ID
 * @returns Aggregate statistics
 */
export async function getAdvanceStatistics(
  tenantId: string
): Promise<AdvanceStatistics> {
  // This would contain complex aggregation queries
  // For now, returning a basic structure
  const stats: AdvanceStatistics = {
    pendingCount: 0,
    pendingTotalAmount: 0,
    activeCount: 0,
    activeTotalBalance: 0,
    thisMonthDeductionsCount: 0,
    thisMonthDeductionsAmount: 0,
    recentlyCompletedCount: 0,
    recentlyRejectedCount: 0,
    byStatus: {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      disbursed: { count: 0, totalAmount: 0 },
      active: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      rejected: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 },
    },
  };

  // TODO: Implement actual aggregation queries

  return stats;
}
