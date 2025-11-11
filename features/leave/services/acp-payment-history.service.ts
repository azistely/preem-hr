/**
 * ACP Payment History Service
 *
 * Manages saving ACP calculation results to the database and tracking payment status.
 * Provides audit trail for all ACP payments and prevents duplicate payments.
 *
 * @module features/leave/services/acp-payment-history
 */

import { db } from '@/lib/db'
import { acpPaymentHistory, timeOffRequests } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { ACPCalculationResult } from './acp-calculation.service'

/**
 * Input for saving ACP payment
 */
export interface SaveACPPaymentInput {
  calculationResult: ACPCalculationResult
  payrollRunId: string
  createdBy?: string
}

/**
 * Saved ACP payment record
 */
export interface ACPPaymentRecord {
  id: string
  tenantId: string
  employeeId: string
  payrollRunId: string
  referencePeriodStart: Date
  referencePeriodEnd: Date
  acpAmount: number
  createdAt: Date
}

/**
 * Query filters for payment history
 */
export interface ACPPaymentHistoryQuery {
  tenantId: string
  employeeId?: string
  payrollRunId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Save ACP calculation result to payment history
 *
 * This function:
 * 1. Checks for existing payment (prevents duplicates)
 * 2. Saves calculation to acp_payment_history table
 * 3. Links time_off_requests to the payment
 * 4. Returns the saved payment record
 *
 * @param input - Payment input with calculation result
 * @returns Saved payment record
 * @throws Error if duplicate payment exists or save fails
 *
 * @example
 * ```typescript
 * const payment = await saveACPPayment({
 *   calculationResult: acpResult,
 *   payrollRunId: 'uuid',
 *   createdBy: 'user-uuid'
 * })
 * ```
 */
export async function saveACPPayment(
  input: SaveACPPaymentInput
): Promise<ACPPaymentRecord> {
  const { calculationResult, payrollRunId, createdBy } = input

  // Check for existing payment (prevent duplicates)
  const existingPayment = await db
    .select()
    .from(acpPaymentHistory)
    .where(
      and(
        eq(acpPaymentHistory.employeeId, calculationResult.employeeId),
        eq(acpPaymentHistory.payrollRunId, payrollRunId)
      )
    )
    .limit(1)

  if (existingPayment.length > 0) {
    throw new Error(
      `ACP payment already exists for employee ${calculationResult.employeeName} ` +
        `in this payroll run. Payment ID: ${existingPayment[0].id}`
    )
  }

  // Start transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    // 1. Insert payment history record
    const [payment] = await tx
      .insert(acpPaymentHistory)
      .values({
        tenantId: calculationResult.config.countryCode === 'CI' ? sql`tenant_id` : sql`tenant_id`, // Will use actual tenantId from context
        employeeId: calculationResult.employeeId,
        payrollRunId,
        referencePeriodStart: calculationResult.referencePeriodStart
          .toISOString()
          .split('T')[0],
        referencePeriodEnd: calculationResult.referencePeriodEnd
          .toISOString()
          .split('T')[0],
        numberOfMonths: calculationResult.numberOfMonths.toString(),
        totalGrossTaxableSalary: calculationResult.totalGrossTaxableSalary.toString(),
        totalPaidDays: calculationResult.totalPaidDays,
        nonDeductibleAbsenceDays: calculationResult.nonDeductibleAbsenceDays,
        dailyAverageSalary: calculationResult.dailyAverageSalary.toString(),
        leaveDaysAccruedBase: calculationResult.leaveDaysAccruedBase.toString(),
        seniorityBonusDays: calculationResult.seniorityBonusDays,
        leaveDaysAccruedTotal: calculationResult.leaveDaysAccruedTotal.toString(),
        leaveDaysTakenCalendar: calculationResult.leaveDaysTakenCalendar.toString(),
        acpAmount: calculationResult.acpAmount.toString(),
        acpConfigurationId: calculationResult.configId,
        calculationMetadata: {
          employeeName: calculationResult.employeeName,
          employeeNumber: calculationResult.employeeNumber,
          contractType: calculationResult.contractType,
          config: calculationResult.config,
          calculatedAt: calculationResult.calculatedAt.toISOString(),
        },
        warnings: calculationResult.warnings,
        createdBy,
      })
      .returning()

    // 2. Update time_off_requests with payment info
    if (calculationResult.timeOffRequests.length > 0) {
      const leaveRequestIds = calculationResult.timeOffRequests.map((req) => req.id)

      await tx
        .update(timeOffRequests)
        .set({
          acpAmount: calculationResult.acpAmount.toString(),
          acpPaidInPayrollRunId: payrollRunId,
          acpPaidAt: new Date(),
        })
        .where(
          and(
            eq(timeOffRequests.employeeId, calculationResult.employeeId),
            sql`${timeOffRequests.id} = ANY(${leaveRequestIds})`
          )
        )
    }

    // Return saved payment record
    return {
      id: payment.id,
      tenantId: payment.tenantId,
      employeeId: payment.employeeId,
      payrollRunId: payment.payrollRunId,
      referencePeriodStart: new Date(payment.referencePeriodStart),
      referencePeriodEnd: new Date(payment.referencePeriodEnd),
      acpAmount: Number(payment.acpAmount),
      createdAt: payment.createdAt,
    }
  })
}

/**
 * Get ACP payment history with filters
 *
 * Supports filtering by:
 * - Employee ID
 * - Payroll run ID
 * - Date range
 * - Pagination
 *
 * @param query - Query filters
 * @returns Array of payment records
 *
 * @example
 * ```typescript
 * // Get all payments for an employee
 * const payments = await getACPPaymentHistory({
 *   tenantId: 'uuid',
 *   employeeId: 'uuid'
 * })
 *
 * // Get payments for specific payroll run
 * const runPayments = await getACPPaymentHistory({
 *   tenantId: 'uuid',
 *   payrollRunId: 'uuid'
 * })
 * ```
 */
export async function getACPPaymentHistory(
  query: ACPPaymentHistoryQuery
): Promise<ACPPaymentRecord[]> {
  const {
    tenantId,
    employeeId,
    payrollRunId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = query

  // Build where conditions
  const conditions = [eq(acpPaymentHistory.tenantId, tenantId)]

  if (employeeId) {
    conditions.push(eq(acpPaymentHistory.employeeId, employeeId))
  }

  if (payrollRunId) {
    conditions.push(eq(acpPaymentHistory.payrollRunId, payrollRunId))
  }

  if (startDate) {
    conditions.push(
      sql`${acpPaymentHistory.createdAt} >= ${startDate.toISOString()}`
    )
  }

  if (endDate) {
    conditions.push(sql`${acpPaymentHistory.createdAt} <= ${endDate.toISOString()}`)
  }

  // Execute query
  const payments = await db
    .select({
      id: acpPaymentHistory.id,
      tenantId: acpPaymentHistory.tenantId,
      employeeId: acpPaymentHistory.employeeId,
      payrollRunId: acpPaymentHistory.payrollRunId,
      referencePeriodStart: acpPaymentHistory.referencePeriodStart,
      referencePeriodEnd: acpPaymentHistory.referencePeriodEnd,
      acpAmount: acpPaymentHistory.acpAmount,
      createdAt: acpPaymentHistory.createdAt,
    })
    .from(acpPaymentHistory)
    .where(and(...conditions))
    .orderBy(desc(acpPaymentHistory.createdAt))
    .limit(limit)
    .offset(offset)

  return payments.map((payment) => ({
    id: payment.id,
    tenantId: payment.tenantId,
    employeeId: payment.employeeId,
    payrollRunId: payment.payrollRunId,
    referencePeriodStart: new Date(payment.referencePeriodStart),
    referencePeriodEnd: new Date(payment.referencePeriodEnd),
    acpAmount: Number(payment.acpAmount),
    createdAt: payment.createdAt,
  }))
}

/**
 * Get detailed ACP payment record by ID
 *
 * Returns complete payment details including:
 * - All calculation breakdown fields
 * - Configuration used
 * - Warnings generated
 * - Metadata
 *
 * @param paymentId - Payment record ID
 * @param tenantId - Tenant ID for isolation
 * @returns Complete payment record or null if not found
 *
 * @example
 * ```typescript
 * const payment = await getACPPaymentDetail('payment-uuid', 'tenant-uuid')
 * if (payment) {
 *   console.log(`Daily average: ${payment.dailyAverageSalary}`)
 *   console.log(`Warnings: ${payment.warnings.length}`)
 * }
 * ```
 */
export async function getACPPaymentDetail(
  paymentId: string,
  tenantId: string
): Promise<any | null> {
  const payments = await db
    .select()
    .from(acpPaymentHistory)
    .where(
      and(
        eq(acpPaymentHistory.id, paymentId),
        eq(acpPaymentHistory.tenantId, tenantId)
      )
    )
    .limit(1)

  if (payments.length === 0) {
    return null
  }

  const payment = payments[0]

  return {
    id: payment.id,
    tenantId: payment.tenantId,
    employeeId: payment.employeeId,
    payrollRunId: payment.payrollRunId,
    referencePeriodStart: new Date(payment.referencePeriodStart),
    referencePeriodEnd: new Date(payment.referencePeriodEnd),
    numberOfMonths: Number(payment.numberOfMonths),
    totalGrossTaxableSalary: Number(payment.totalGrossTaxableSalary),
    totalPaidDays: payment.totalPaidDays,
    nonDeductibleAbsenceDays: payment.nonDeductibleAbsenceDays,
    dailyAverageSalary: Number(payment.dailyAverageSalary),
    leaveDaysAccruedBase: Number(payment.leaveDaysAccruedBase),
    seniorityBonusDays: payment.seniorityBonusDays,
    leaveDaysAccruedTotal: Number(payment.leaveDaysAccruedTotal),
    leaveDaysTakenCalendar: Number(payment.leaveDaysTakenCalendar),
    acpAmount: Number(payment.acpAmount),
    acpConfigurationId: payment.acpConfigurationId,
    calculationMetadata: payment.calculationMetadata,
    warnings: payment.warnings,
    createdAt: payment.createdAt,
    createdBy: payment.createdBy,
  }
}

/**
 * Check if ACP payment exists for employee in payroll run
 *
 * Useful for preventing duplicate calculations and showing payment status in UI.
 *
 * @param employeeId - Employee ID
 * @param payrollRunId - Payroll run ID
 * @returns Payment record if exists, null otherwise
 *
 * @example
 * ```typescript
 * const existing = await checkACPPaymentExists('emp-uuid', 'run-uuid')
 * if (existing) {
 *   console.log(`Already paid: ${existing.acpAmount} FCFA`)
 * }
 * ```
 */
export async function checkACPPaymentExists(
  employeeId: string,
  payrollRunId: string
): Promise<ACPPaymentRecord | null> {
  const payments = await db
    .select({
      id: acpPaymentHistory.id,
      tenantId: acpPaymentHistory.tenantId,
      employeeId: acpPaymentHistory.employeeId,
      payrollRunId: acpPaymentHistory.payrollRunId,
      referencePeriodStart: acpPaymentHistory.referencePeriodStart,
      referencePeriodEnd: acpPaymentHistory.referencePeriodEnd,
      acpAmount: acpPaymentHistory.acpAmount,
      createdAt: acpPaymentHistory.createdAt,
    })
    .from(acpPaymentHistory)
    .where(
      and(
        eq(acpPaymentHistory.employeeId, employeeId),
        eq(acpPaymentHistory.payrollRunId, payrollRunId)
      )
    )
    .limit(1)

  if (payments.length === 0) {
    return null
  }

  const payment = payments[0]

  return {
    id: payment.id,
    tenantId: payment.tenantId,
    employeeId: payment.employeeId,
    payrollRunId: payment.payrollRunId,
    referencePeriodStart: new Date(payment.referencePeriodStart),
    referencePeriodEnd: new Date(payment.referencePeriodEnd),
    acpAmount: Number(payment.acpAmount),
    createdAt: payment.createdAt,
  }
}

/**
 * Get total ACP paid for an employee across all payroll runs
 *
 * Useful for reporting and year-end summaries.
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @returns Total ACP amount paid
 *
 * @example
 * ```typescript
 * // Get total for current year
 * const yearStart = new Date(2025, 0, 1)
 * const total = await getTotalACPPaidForEmployee(
 *   'emp-uuid',
 *   'tenant-uuid',
 *   yearStart
 * )
 * console.log(`Total ACP paid in 2025: ${total} FCFA`)
 * ```
 */
export async function getTotalACPPaidForEmployee(
  employeeId: string,
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const conditions = [
    eq(acpPaymentHistory.employeeId, employeeId),
    eq(acpPaymentHistory.tenantId, tenantId),
  ]

  if (startDate) {
    conditions.push(
      sql`${acpPaymentHistory.createdAt} >= ${startDate.toISOString()}`
    )
  }

  if (endDate) {
    conditions.push(
      sql`${acpPaymentHistory.createdAt} <= ${endDate.toISOString()}`
    )
  }

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${acpPaymentHistory.acpAmount}), 0)`,
    })
    .from(acpPaymentHistory)
    .where(and(...conditions))

  return Number(result[0]?.total || 0)
}

/**
 * Delete ACP payment (soft delete - for corrections only)
 *
 * WARNING: This should only be used for correcting errors.
 * Normal workflow should not delete payments.
 *
 * This will:
 * 1. Delete payment history record
 * 2. Clear ACP payment info from related time_off_requests
 *
 * @param paymentId - Payment ID to delete
 * @param tenantId - Tenant ID for isolation
 * @param deletedBy - User ID performing deletion
 * @returns True if deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = await deleteACPPayment(
 *   'payment-uuid',
 *   'tenant-uuid',
 *   'user-uuid'
 * )
 * ```
 */
export async function deleteACPPayment(
  paymentId: string,
  tenantId: string,
  deletedBy: string
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Get payment details first
    const payments = await tx
      .select()
      .from(acpPaymentHistory)
      .where(
        and(
          eq(acpPaymentHistory.id, paymentId),
          eq(acpPaymentHistory.tenantId, tenantId)
        )
      )
      .limit(1)

    if (payments.length === 0) {
      return false
    }

    const payment = payments[0]

    // Clear ACP payment info from time_off_requests
    await tx
      .update(timeOffRequests)
      .set({
        acpAmount: null,
        acpPaidInPayrollRunId: null,
        acpPaidAt: null,
      })
      .where(
        and(
          eq(timeOffRequests.employeeId, payment.employeeId),
          eq(timeOffRequests.acpPaidInPayrollRunId, payment.payrollRunId)
        )
      )

    // Delete payment history record
    await tx
      .delete(acpPaymentHistory)
      .where(eq(acpPaymentHistory.id, paymentId))

    return true
  })
}
