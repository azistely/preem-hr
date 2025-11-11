/**
 * ACP (Allocations de Congés Payés) Calculation Service
 *
 * Implements complete ACP calculation logic according to
 * Convention Collective Interprofessionnelle (Côte d'Ivoire)
 *
 * Formula:
 * ACP = Daily Average Salary × Leave Days Taken (calendar days)
 *
 * Where:
 * - Daily Average Salary = Total Gross Taxable Salary / Total Paid Days
 * - Total Paid Days = (Number of Months × 30) - Non-Deductible Absences
 *
 * @module features/leave/services/acp-calculation
 */

import { db } from '@/lib/db'
import { employees, payrollLineItems, payrollRuns, timeOffRequests } from '@/lib/db/schema'
import { and, eq, gte, lte, isNull, between, sql, desc } from 'drizzle-orm'
import { loadACPConfig, type ACPConfiguration } from './acp-config.loader'
import { calculateSeniorityBonusDays } from './seniority-bonus.service'

/**
 * Input for ACP calculation
 */
export interface ACPCalculationInput {
  employeeId: string
  tenantId: string
  countryCode: string
  // Date on which ACP should be calculated (typically when employee departs for leave)
  acpPaymentDate: Date
  // Optional: Payroll period (for validation)
  payrollPeriodStart?: Date
  payrollPeriodEnd?: Date
}

/**
 * Complete ACP calculation result
 */
export interface ACPCalculationResult {
  // Employee info
  employeeId: string
  employeeName: string
  employeeNumber: string
  contractType: string

  // Eligibility
  isEligible: boolean
  skipReason?: string

  // Reference period
  referencePeriodStart: Date
  referencePeriodEnd: Date
  numberOfMonths: number

  // Salary calculation
  totalGrossTaxableSalary: number
  totalPaidDays: number
  nonDeductibleAbsenceDays: number
  dailyAverageSalary: number

  // Leave calculation
  leaveDaysAccruedBase: number
  seniorityBonusDays: number
  leaveDaysAccruedTotal: number
  leaveDaysTakenCalendar: number

  // Final ACP amount
  acpAmount: number

  // Metadata
  timeOffRequests: Array<{
    id: string
    startDate: Date
    endDate: Date
    totalDays: number
  }>
  warnings: Array<{
    type: string
    message: string
  }>

  // Config used
  configId: string
  config: ACPConfiguration
  calculatedAt: Date
}

/**
 * Reference period information
 */
interface ReferencePeriod {
  start: Date
  end: Date
  numberOfMonths: number
}

/**
 * Salary history entry
 */
interface SalaryHistoryEntry {
  month: Date
  grossTaxableSalary: number
}

/**
 * Calculate ACP for an employee
 *
 * @param input - Calculation input parameters
 * @returns Complete calculation result with breakdown
 *
 * @example
 * ```typescript
 * const result = await calculateACP({
 *   employeeId: 'uuid',
 *   tenantId: 'uuid',
 *   countryCode: 'CI',
 *   acpPaymentDate: new Date('2025-10-05')
 * })
 *
 * console.log(`ACP Amount: ${result.acpAmount} FCFA`)
 * ```
 */
export async function calculateACP(
  input: ACPCalculationInput
): Promise<ACPCalculationResult> {
  const warnings: Array<{ type: string; message: string }> = []

  // Step 1: Load employee data
  const employee = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (employee.length === 0) {
    throw new Error(`Employee not found: ${input.employeeId}`)
  }

  const emp = employee[0]
  const employeeName = `${emp.firstName} ${emp.lastName}`

  // Step 2: Check eligibility (CDI/CDD only)
  if (!['CDI', 'CDD'].includes(emp.contractType || '')) {
    return {
      employeeId: input.employeeId,
      employeeName,
      employeeNumber: emp.employeeNumber,
      contractType: emp.contractType || '',
      isEligible: false,
      skipReason: 'ACP applicable uniquement aux CDI/CDD',
      referencePeriodStart: new Date(),
      referencePeriodEnd: new Date(),
      numberOfMonths: 0,
      totalGrossTaxableSalary: 0,
      totalPaidDays: 0,
      nonDeductibleAbsenceDays: 0,
      dailyAverageSalary: 0,
      leaveDaysAccruedBase: 0,
      seniorityBonusDays: 0,
      leaveDaysAccruedTotal: 0,
      leaveDaysTakenCalendar: 0,
      acpAmount: 0,
      timeOffRequests: [],
      warnings: [],
      configId: '',
      config: {} as ACPConfiguration,
      calculatedAt: new Date(),
    }
  }

  // Step 3: Load ACP configuration
  const config = await loadACPConfig(input.countryCode, input.acpPaymentDate)

  // Step 4: Determine reference period
  const referencePeriod = await determineReferencePeriod(
    input.employeeId,
    input.acpPaymentDate,
    emp.hireDate,
    config.referencePeriodType
  )

  // Step 5: Load salary history
  const salaryHistory = await loadSalaryHistory(
    input.employeeId,
    input.tenantId,
    referencePeriod.start,
    referencePeriod.end
  )

  // Handle no payroll history
  if (salaryHistory.length === 0) {
    warnings.push({
      type: 'NO_PAYROLL_HISTORY',
      message: 'Calcul basé sur le salaire actuel (pas d\'historique de paie)',
    })

    // Use current categorical salary as fallback
    const currentSalary = emp.categoricalSalary ? Number(emp.categoricalSalary) : 0
    salaryHistory.push({
      month: new Date(),
      grossTaxableSalary: currentSalary,
    })
  }

  // Calculate total gross taxable salary
  const totalGrossTaxableSalary = salaryHistory.reduce(
    (sum, entry) => sum + entry.grossTaxableSalary,
    0
  )

  // Step 6: Calculate paid days
  const paidDaysResult = await calculatePaidDays(
    input.employeeId,
    input.tenantId,
    referencePeriod.start,
    referencePeriod.end,
    referencePeriod.numberOfMonths,
    config.defaultPaidDaysPerMonth
  )

  // Handle zero paid days edge case
  let dailyAverageSalary: number
  if (paidDaysResult.totalPaidDays === 0) {
    warnings.push({
      type: 'ZERO_PAID_DAYS',
      message: 'Aucun jour payé dans la période de référence',
    })
    // Fallback: use current monthly salary / 30
    const currentSalary = emp.categoricalSalary ? Number(emp.categoricalSalary) : 0
    dailyAverageSalary = currentSalary / 30
  } else {
    dailyAverageSalary = totalGrossTaxableSalary / paidDaysResult.totalPaidDays
  }

  // Step 7: Calculate seniority bonus
  const seniorityResult = calculateSeniorityBonusDays(
    new Date(emp.hireDate),
    input.acpPaymentDate,
    input.countryCode
  )

  // Step 8: Calculate accrued leave days (calendar)
  const leaveDaysAccruedBase =
    (paidDaysResult.totalPaidDays / referencePeriod.numberOfMonths) *
    Number(config.daysPerMonthFactor)

  const leaveDaysAccruedTotal =
    leaveDaysAccruedBase +
    seniorityResult.bonusDays * Number(config.calendarDayMultiplier)

  // Step 9: Get leave days taken in this period
  const leaveTaken = await getApprovedLeaveDays(
    input.employeeId,
    input.tenantId,
    referencePeriod.start,
    referencePeriod.end
  )

  const leaveDaysTakenCalendar = leaveTaken.totalDays

  // Check if leave exceeds accrual
  if (leaveDaysTakenCalendar > leaveDaysAccruedTotal * 1.1) {
    warnings.push({
      type: 'LEAVE_EXCEEDS_ACCRUAL',
      message: `${leaveDaysTakenCalendar.toFixed(1)} jours pris mais seulement ${leaveDaysAccruedTotal.toFixed(1)} jours acquis`,
    })
  }

  // Step 10: Calculate final ACP amount
  const acpAmount = Math.round(dailyAverageSalary * leaveDaysTakenCalendar)

  // Validate result
  if (acpAmount < 0) {
    throw new Error('Erreur: montant ACP négatif détecté')
  }

  return {
    employeeId: input.employeeId,
    employeeName,
    employeeNumber: emp.employeeNumber,
    contractType: emp.contractType || '',
    isEligible: true,
    referencePeriodStart: referencePeriod.start,
    referencePeriodEnd: referencePeriod.end,
    numberOfMonths: referencePeriod.numberOfMonths,
    totalGrossTaxableSalary,
    totalPaidDays: paidDaysResult.totalPaidDays,
    nonDeductibleAbsenceDays: paidDaysResult.nonDeductibleDays,
    dailyAverageSalary: Math.round(dailyAverageSalary * 100) / 100,
    leaveDaysAccruedBase: Math.round(leaveDaysAccruedBase * 100) / 100,
    seniorityBonusDays: seniorityResult.bonusDays,
    leaveDaysAccruedTotal: Math.round(leaveDaysAccruedTotal * 100) / 100,
    leaveDaysTakenCalendar: Math.round(leaveDaysTakenCalendar * 100) / 100,
    acpAmount,
    timeOffRequests: leaveTaken.requests,
    warnings,
    configId: config.id,
    config,
    calculatedAt: new Date(),
  }
}

/**
 * Determine reference period for ACP calculation
 *
 * Convention: Period starts from last leave return date (or hire date)
 * and ends the day before leave departure
 */
async function determineReferencePeriod(
  employeeId: string,
  acpPaymentDate: Date,
  hireDate: string,
  referencePeriodType: string
): Promise<ReferencePeriod> {
  let start: Date
  const end = new Date(acpPaymentDate)
  end.setDate(end.getDate() - 1) // Day before departure

  if (referencePeriodType === 'since_last_leave') {
    // Find most recent approved leave that ended before this payment date
    const lastLeave = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.employeeId, employeeId),
          eq(timeOffRequests.status, 'approved'),
          lte(timeOffRequests.endDate, end.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(timeOffRequests.endDate))
      .limit(1)

    if (lastLeave.length > 0) {
      // Start from day after last leave ended
      start = new Date(lastLeave[0].endDate)
      start.setDate(start.getDate() + 1)
    } else {
      // No previous leave, start from hire date
      start = new Date(hireDate)
    }
  } else {
    // Default: use hire date
    start = new Date(hireDate)
  }

  // Ensure start is not before hire date
  const hireDateObj = new Date(hireDate)
  if (start < hireDateObj) {
    start = hireDateObj
  }

  // Calculate number of months
  const diffMs = end.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const numberOfMonths = diffDays / 30.4167 // Average days per month

  return {
    start,
    end,
    numberOfMonths: Math.round(numberOfMonths * 10) / 10, // Round to 1 decimal
  }
}

/**
 * Load salary history from payroll line items
 */
async function loadSalaryHistory(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SalaryHistoryEntry[]> {
  const startStr = periodStart.toISOString().split('T')[0]
  const endStr = periodEnd.toISOString().split('T')[0]

  // Load payroll line items with gross taxable salary
  // Join with payroll_runs to get period dates
  const items = await db
    .select({
      periodEnd: payrollRuns.periodEnd,
      brutImposable: payrollLineItems.brutImposable,
      grossSalary: payrollLineItems.grossSalary,
    })
    .from(payrollLineItems)
    .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollLineItems.employeeId, employeeId),
        eq(payrollLineItems.tenantId, tenantId),
        gte(payrollRuns.periodEnd, startStr),
        lte(payrollRuns.periodEnd, endStr)
      )
    )
    .orderBy(payrollRuns.periodEnd)

  return items.map((item) => ({
    month: new Date(item.periodEnd),
    // Use brutImposable (taxable gross) if available, otherwise grossSalary
    grossTaxableSalary: Number(item.brutImposable || item.grossSalary || 0),
  }))
}

/**
 * Calculate total paid days in reference period
 */
async function calculatePaidDays(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  numberOfMonths: number,
  defaultDaysPerMonth: number
): Promise<{
  totalPaidDays: number
  nonDeductibleDays: number
}> {
  // Calculate base days (months × 30)
  const baseDays = numberOfMonths * defaultDaysPerMonth

  // Get non-deductible absences (unpaid leave, permissions, etc.)
  const startStr = periodStart.toISOString().split('T')[0]
  const endStr = periodEnd.toISOString().split('T')[0]

  const nonDeductibleLeave = await db
    .select()
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'),
        // is_deductible_for_acp column will be added by migration
        // For now, we'll add it manually or default to true
        gte(timeOffRequests.startDate, startStr),
        lte(timeOffRequests.endDate, endStr)
      )
    )

  // Sum non-deductible days
  // TODO: Filter by is_deductible_for_acp = FALSE once migration is applied
  const nonDeductibleDays = 0 // Will be calculated once field is available

  const totalPaidDays = baseDays - nonDeductibleDays

  return {
    totalPaidDays: Math.max(0, totalPaidDays),
    nonDeductibleDays,
  }
}

/**
 * Get approved leave days in reference period
 */
async function getApprovedLeaveDays(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  totalDays: number
  requests: Array<{
    id: string
    startDate: Date
    endDate: Date
    totalDays: number
  }>
}> {
  const startStr = periodStart.toISOString().split('T')[0]
  const endStr = periodEnd.toISOString().split('T')[0]

  const requests = await db
    .select()
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'),
        gte(timeOffRequests.startDate, startStr),
        lte(timeOffRequests.endDate, endStr)
      )
    )

  const totalDays = requests.reduce(
    (sum, req) => sum + Number(req.totalDays),
    0
  )

  return {
    totalDays,
    requests: requests.map((req) => ({
      id: req.id,
      startDate: new Date(req.startDate),
      endDate: new Date(req.endDate),
      totalDays: Number(req.totalDays),
    })),
  }
}
