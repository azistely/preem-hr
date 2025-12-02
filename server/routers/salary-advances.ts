/**
 * Salary Advances Router - Short-term Employee Cash Advance Management
 *
 * Provides endpoints for:
 * - Employee advance requests (self-service)
 * - HR approval workflow
 * - Policy validation
 * - Repayment tracking
 * - Statistics and reporting
 *
 * Security: All endpoints use tenant isolation via ctx.user.tenantId
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import {
  createAdvanceRequest,
  approveAdvance,
  disburseAdvance,
  processRepayment,
  cancelAdvance,
  getAdvanceById,
  listAdvances,
  getAdvanceStatistics,
} from '../services/salary-advances/salary-advance.service';
import {
  validateAdvanceRequest,
  quickValidateAmount,
  getActivePolicy,
  calculateMaxAllowedAmount,
} from '../services/salary-advances/salary-advance-validator';
import { calculateEmployeeNetSalaryWithFallback } from '../services/salary-advances/net-salary-calculator';
import { AdvanceStatus } from '@/lib/db/schema/salary-advances';

/**
 * Zod schemas for input validation
 */

const createAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  requestedAmount: z.number().positive().multipleOf(0.01),
  repaymentMonths: z.number().int().min(1).max(12),
  requestReason: z.string().min(10).max(500),
  requestNotes: z.string().max(1000).optional(),
});

const approveAdvanceSchema = z.object({
  advanceId: z.string().uuid(),
  approved: z.boolean(),
  approvedAmount: z.number().positive().multipleOf(0.01).optional(),
  rejectedReason: z.string().min(10).max(500).optional(),
});

const disburseAdvanceSchema = z.object({
  advanceId: z.string().uuid(),
  payrollRunId: z.string().uuid(),
  disbursementDate: z.date().optional(),
});

const processRepaymentSchema = z.object({
  advanceId: z.string().uuid(),
  installmentNumber: z.number().int().positive(),
  actualAmount: z.number().positive().multipleOf(0.01),
  payrollRunId: z.string().uuid(),
});

const listAdvancesSchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['pending', 'approved', 'disbursed', 'active', 'completed', 'rejected', 'cancelled']),
      z.array(z.enum(['pending', 'approved', 'disbursed', 'active', 'completed', 'rejected', 'cancelled'])),
    ])
    .nullable()
    .optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const quickValidateSchema = z.object({
  employeeId: z.string().uuid().optional(),
  requestedAmount: z.number().positive(),
  repaymentMonths: z.number().int().min(1).max(12),
});

const validateRequestSchema = z.object({
  employeeId: z.string().uuid(),
  requestedAmount: z.number().positive(),
  repaymentMonths: z.number().int().min(1).max(12),
});

export const salaryAdvancesRouter = createTRPCRouter({
  /**
   * List salary advances with filtering
   *
   * Supports filtering by:
   * - Employee
   * - Status (single or multiple)
   * - Date range
   * - Pagination
   */
  list: protectedProcedure
    .input(listAdvancesSchema)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const result = await listAdvances(tenantId, {
        employeeId: input.employeeId,
        status: input.status ?? undefined,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
      });

      return result;
    }),

  /**
   * Get single salary advance by ID
   *
   * Returns complete details including:
   * - Employee information
   * - Approval/rejection details
   * - Repayment schedule
   * - Policy information
   * - Action permissions
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const advance = await getAdvanceById(input.id, tenantId);

      if (!advance) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Avance introuvable',
        });
      }

      return advance;
    }),

  /**
   * Create new salary advance request (Employee-facing)
   *
   * Workflow:
   * 1. Validate against policy (amount limits, eligibility)
   * 2. Check SMIG protection
   * 3. Create request with status='pending'
   * 4. Return created advance
   */
  create: protectedProcedure
    .input(createAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      try {
        const advance = await createAdvanceRequest(
          tenantId,
          input.employeeId,
          userId,
          {
            requestedAmount: input.requestedAmount,
            repaymentMonths: input.repaymentMonths,
            requestReason: input.requestReason,
            requestNotes: input.requestNotes,
          }
        );

        return advance;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message ?? 'Échec de création de la demande',
          cause: error,
        });
      }
    }),

  /**
   * Approve or reject a salary advance (HR-facing)
   *
   * Approval workflow:
   * - Can adjust approved amount (must be ≤ requested)
   * - Re-validates with approved amount
   * - Records approver and timestamp
   *
   * Rejection workflow:
   * - Requires rejection reason
   * - Records rejector and timestamp
   */
  approve: protectedProcedure
    .input(approveAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      try {
        const advance = await approveAdvance(
          input.advanceId,
          tenantId,
          userId,
          {
            advanceId: input.advanceId,
            approved: input.approved,
            approvedAmount: input.approvedAmount,
            rejectedReason: input.rejectedReason,
          }
        );

        return advance;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message ?? 'Échec de traitement de la demande',
          cause: error,
        });
      }
    }),

  /**
   * Disburse an approved advance
   *
   * Called by payroll system when advance is included in payroll run.
   * Generates repayment schedule and creates installment records.
   */
  disburse: protectedProcedure
    .input(disburseAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      try {
        const advance = await disburseAdvance(
          input.advanceId,
          tenantId,
          input.payrollRunId,
          input.disbursementDate
        );

        return advance;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message ?? 'Échec de débours de l\'avance',
          cause: error,
        });
      }
    }),

  /**
   * Process a repayment installment
   *
   * Called by payroll system when deducting advance repayment.
   * Updates installment status and advance totals.
   */
  processRepayment: protectedProcedure
    .input(processRepaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      try {
        const repayment = await processRepayment(
          input.advanceId,
          tenantId,
          input.installmentNumber,
          input.actualAmount,
          input.payrollRunId
        );

        return repayment;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message ?? 'Échec de traitement du remboursement',
          cause: error,
        });
      }
    }),

  /**
   * Cancel a pending advance
   *
   * Employee or HR can cancel pending advances.
   * Cannot cancel approved/disbursed advances.
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      try {
        const advance = await cancelAdvance(input.id, tenantId);
        return advance;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message ?? 'Échec d\'annulation',
          cause: error,
        });
      }
    }),

  /**
   * Validate advance request (Full validation)
   *
   * Runs complete policy validation including:
   * - Employment duration check
   * - Outstanding advances check
   * - Monthly request limit check
   * - Amount limits (percentage + absolute)
   * - SMIG protection
   * - Repayment period validation
   *
   * Returns detailed validation result with errors and warnings.
   */
  validate: protectedProcedure
    .input(validateRequestSchema)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const validation = await validateAdvanceRequest(
        tenantId,
        input.employeeId,
        input.requestedAmount,
        input.repaymentMonths
      );

      return validation;
    }),

  /**
   * Quick validate amount (Lightweight validation for UI)
   *
   * Used for real-time form validation.
   * Only checks basic amount limits without full policy validation.
   */
  quickValidate: protectedProcedure
    .input(quickValidateSchema)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const result = await quickValidateAmount(
        {
          employeeId: input.employeeId,
          requestedAmount: input.requestedAmount,
          repaymentMonths: input.repaymentMonths,
        },
        tenantId
      );

      return result;
    }),

  /**
   * Get active salary advance policy
   *
   * Returns current policy configuration for the tenant.
   * Used by UI to show limits and rules.
   */
  getPolicy: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    const policy = await getActivePolicy(tenantId);

    if (!policy) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Aucune politique d\'avance configurée',
      });
    }

    return policy;
  }),

  /**
   * Get maximum allowed advance amount for an employee
   *
   * Calculates max based on:
   * - Policy percentage limit (e.g., 30% of net salary)
   * - Policy absolute limit (if configured)
   * - Returns the lower of the two
   */
  getMaxAllowedAmount: protectedProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get policy
      const policy = await getActivePolicy(tenantId);
      if (!policy) {
        return { maxAmount: 0 };
      }

      // Calculate employee's net salary using payroll engine
      const employeeNetSalary = await calculateEmployeeNetSalaryWithFallback(
        input.employeeId,
        tenantId
      );

      if (employeeNetSalary === 0) {
        return { maxAmount: 0 };
      }

      const maxAmount = calculateMaxAllowedAmount(policy, employeeNetSalary);

      return { maxAmount };
    }),

  /**
   * Get advance statistics for dashboard
   *
   * Returns tenant-wide statistics:
   * - Pending approvals count/amount
   * - Active advances count/balance
   * - This month's deductions
   * - Recently completed/rejected
   * - Breakdown by status
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    const stats = await getAdvanceStatistics(tenantId);
    return stats;
  }),

  /**
   * Get employee-specific advance statistics
   *
   * Returns:
   * - Current active advance (if any)
   * - Next deduction amount/month
   * - Policy limits for employee
   * - Request eligibility
   * - Advance history
   */
  getEmployeeStats: protectedProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get employee's active advance
      const activeAdvances = await listAdvances(tenantId, {
        employeeId: input.employeeId,
        status: [AdvanceStatus.ACTIVE, AdvanceStatus.DISBURSED],
        limit: 1,
      });

      const hasActiveAdvance = activeAdvances.advances.length > 0;
      const activeAdvance = activeAdvances.advances[0];

      // Get max allowed amount
      const policy = await getActivePolicy(tenantId);

      // Calculate employee's net salary using payroll engine
      const employeeNetSalary = await calculateEmployeeNetSalaryWithFallback(
        input.employeeId,
        tenantId
      );

      const maxAllowedAmount = policy
        ? calculateMaxAllowedAmount(policy, employeeNetSalary)
        : 0;

      // Check if can request new advance
      const canRequestNewAdvance = !hasActiveAdvance && maxAllowedAmount > 0;

      // Get history counts
      const allAdvances = await listAdvances(tenantId, {
        employeeId: input.employeeId,
        limit: 100,
      });

      const totalAdvancesReceived = allAdvances.advances.filter(
        (a) => a.status === AdvanceStatus.COMPLETED
      ).length;

      return {
        employeeId: input.employeeId,
        employeeName: activeAdvance?.employeeName ?? '',
        employeeNumber: activeAdvance?.employeeNumber ?? '',
        hasActiveAdvance,
        activeAdvanceBalance: activeAdvance?.remainingBalance
          ? Number(activeAdvance.remainingBalance)
          : 0,
        nextDeductionAmount: activeAdvance?.monthlyDeduction
          ? Number(activeAdvance.monthlyDeduction)
          : 0,
        nextDeductionMonth: activeAdvance?.firstDeductionMonth ?? null,
        maxAllowedAmount,
        canRequestNewAdvance,
        requestsThisMonth: 0, // TODO: Calculate from validation
        totalAdvancesReceived,
        totalAmountBorrowed: 0, // TODO: Calculate
        totalAmountRepaid: 0, // TODO: Calculate
      };
    }),

  /**
   * Get pending advances for approval (HR dashboard)
   *
   * Returns all pending advances requiring approval
   */
  getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const result = await listAdvances(tenantId, {
      status: AdvanceStatus.PENDING,
      limit: 100,
    });

    return result.advances;
  }),

  /**
   * Get advances requiring disbursement
   *
   * Returns approved advances ready to be included in payroll
   */
  getForDisbursement: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const result = await listAdvances(tenantId, {
      status: AdvanceStatus.APPROVED,
      limit: 100,
    });

    return result.advances;
  }),
});
