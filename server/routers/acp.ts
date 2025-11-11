/**
 * ACP (Allocations de Congés Payés) tRPC Router
 *
 * Provides API endpoints for:
 * - Previewing ACP calculations
 * - Querying payment history
 * - Managing ACP configuration
 *
 * @module server/routers/acp
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../api/trpc'
import { TRPCError } from '@trpc/server'
import {
  calculateACP,
  type ACPCalculationInput,
} from '@/features/leave/services/acp-calculation.service'
import {
  getACPPaymentHistory,
  getACPPaymentDetail,
  checkACPPaymentExists,
  getTotalACPPaidForEmployee,
} from '@/features/leave/services/acp-payment-history.service'
import { loadACPConfig, getAllACPConfigs } from '@/features/leave/services/acp-config.loader'

export const acpRouter = createTRPCRouter({
  /**
   * Preview ACP calculation for an employee
   *
   * Calculates what the ACP would be if the employee took leave
   * on the specified date. Does not save to database.
   *
   * Permissions: payroll:read
   */
  previewCalculation: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        acpPaymentDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify tenant isolation
      if (!ctx.user?.tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID required',
        })
      }

      // Default to Côte d'Ivoire (CI) - can be made dynamic in future
      const countryCode = 'CI'

      const calculationInput: ACPCalculationInput = {
        employeeId: input.employeeId,
        tenantId: ctx.user.tenantId,
        countryCode,
        acpPaymentDate: input.acpPaymentDate,
      }

      try {
        const result = await calculateACP(calculationInput)
        return result
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'ACP calculation failed',
        })
      }
    }),

  /**
   * Get ACP payment history for an employee
   *
   * Returns paginated list of past ACP payments.
   *
   * Permissions: payroll:read
   */
  getPaymentHistory: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid().optional(),
        payrollRunId: z.string().uuid().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID required',
        })
      }

      try {
        const payments = await getACPPaymentHistory({
          tenantId: ctx.user.tenantId,
          employeeId: input.employeeId,
          payrollRunId: input.payrollRunId,
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit,
          offset: input.offset,
        })

        return payments
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch payment history',
        })
      }
    }),

  /**
   * Get detailed ACP payment record by ID
   *
   * Returns complete payment details including calculation breakdown.
   *
   * Permissions: payroll:read
   */
  getPaymentDetail: protectedProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID required',
        })
      }

      try {
        const payment = await getACPPaymentDetail(input.paymentId, ctx.user.tenantId)

        if (!payment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment record not found',
          })
        }

        return payment
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch payment detail',
        })
      }
    }),

  /**
   * Check if ACP payment exists for employee in payroll run
   *
   * Used to prevent duplicate payments and show payment status in UI.
   *
   * Permissions: payroll:read
   */
  checkPaymentExists: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        payrollRunId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      try {
        const existing = await checkACPPaymentExists(
          input.employeeId,
          input.payrollRunId
        )

        return {
          exists: !!existing,
          payment: existing,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to check payment status',
        })
      }
    }),

  /**
   * Get total ACP paid for employee in date range
   *
   * Useful for year-end summaries and reporting.
   *
   * Permissions: payroll:read
   */
  getTotalPaid: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID required',
        })
      }

      try {
        const total = await getTotalACPPaidForEmployee(
          input.employeeId,
          ctx.user.tenantId,
          input.startDate,
          input.endDate
        )

        return {
          employeeId: input.employeeId,
          total,
          startDate: input.startDate,
          endDate: input.endDate,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to calculate total',
        })
      }
    }),

  /**
   * Get ACP configuration for tenant's country
   *
   * Returns active configuration including calculation parameters.
   *
   * Permissions: any authenticated user
   */
  getConfiguration: protectedProcedure.query(async ({ ctx }) => {
    // Default to Côte d'Ivoire (CI) - can be made dynamic in future
    const countryCode = 'CI'

    try {
      const config = await loadACPConfig(countryCode, new Date())
      return config
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to load configuration',
      })
    }
  }),

  /**
   * Get all ACP configurations (admin only)
   *
   * Returns all configurations for all countries.
   *
   * Permissions: super_admin
   */
  getAllConfigurations: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is super admin
    const isSuperAdmin = ctx.user?.role === 'super_admin'

    if (!isSuperAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only super admins can view all configurations',
      })
    }

    try {
      const configs = await getAllACPConfigs()
      return configs
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to load configurations',
      })
    }
  }),
})
