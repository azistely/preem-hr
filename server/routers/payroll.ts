/**
 * Payroll tRPC Router
 *
 * Provides type-safe API endpoints for all payroll operations:
 * - Calculate gross salary
 * - Calculate individual payroll
 * - Create payroll run
 * - Calculate payroll run
 * - Get payroll run details
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure, employeeProcedure, hrManagerProcedure } from '../api/trpc';
import { calculateGrossSalary } from '@/features/payroll/services/gross-calculation';
import { calculatePayroll } from '@/features/payroll/services/payroll-calculation';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';
import {
  createPayrollRun,
  calculatePayrollRun,
  calculatePayrollRunOptimized,
} from '@/features/payroll/services/run-calculation';
import { db } from '@/lib/db';
import { payrollRuns, payrollLineItems, payrollRunProgress, employees, timeEntries, tenants, employeeDependents, salaryComponentDefinitions, cnpsDeclarationEdits } from '@/lib/db/schema';
import { salaryComponentTemplates, taxSystems, timeOffRequests, timeOffBalances, timeOffPolicies } from '@/drizzle/schema';
import { eq, and, lte, gte, or, isNull, asc, desc, sql, inArray } from 'drizzle-orm';
import { ruleLoader } from '@/features/payroll/services/rule-loader';
import { sendEvent } from '@/lib/inngest/client';

// Export services
import * as React from 'react';
// Lazy load @react-pdf/renderer to avoid loading it on module initialization
// This prevents issues with Turbopack/Next.js module resolution
import { PayslipDocument, PayslipData, generatePayslipFilename } from '@/features/payroll/services/payslip-generator';
import { generateCNPSExcel, generateCNPSFilename, CNPSExportData } from '@/features/payroll/services/cnps-export';
import { generateCMUBeneficiaryExport, formatCNPSDate, mapRelationshipToType, mapGenderCode, type CMUBeneficiaryRow } from '@/features/payroll/services/cmu-export';
import { generateEtat301Excel, generateEtat301Filename, Etat301ExportData } from '@/features/payroll/services/etat-301-export';
import { generateBankTransferExcel, generateBankTransferFilename, BankTransferExportData } from '@/features/payroll/services/bank-transfer-export';

// ========================================
// Input Validation Schemas
// ========================================

const overtimeHoursSchema = z.object({
  count: z.number().positive(),
  type: z.enum([
    'hours_41_to_46',
    'hours_above_46',
    'night',
    'sunday_or_holiday',
    'night_sunday_or_holiday',
  ]),
});

const calculateGrossInputSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  baseSalary: z.number().min(75000), // SMIG minimum
  hireDate: z.date().optional(),
  terminationDate: z.date().optional(),
  housingAllowance: z.number().optional(),
  transportAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
  bonuses: z.number().optional(),
  overtimeHours: z.array(overtimeHoursSchema).optional(),
});

const calculatePayrollInputSchema = calculateGrossInputSchema.extend({
  hasFamily: z.boolean().optional(),
  sector: z.enum(['services', 'construction', 'agriculture', 'other']).optional(),
});

const calculatePayrollV2InputSchema = calculateGrossInputSchema.extend({
  countryCode: z.string().length(2), // ISO 3166-1 alpha-2
  fiscalParts: z.number().min(1.0).max(5.0).optional(),
  sectorCode: z.string().optional(),
});

const createPayrollRunInputSchema = z.object({
  countryCode: z.string().length(2, { message: 'Code pays invalide' }),
  periodStart: z.date(),
  periodEnd: z.date(),
  paymentDate: z.date(),
  name: z.string().optional(),
  paymentFrequency: z.enum(['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY']).default('MONTHLY'),
  closureSequence: z.number().int().min(1).max(4).optional(),
});

const calculatePayrollRunInputSchema = z.object({
  runId: z.string().uuid(),
});

const getPayrollRunInputSchema = z.object({
  runId: z.string().uuid(),
});

// ========================================
// Helper Functions
// ========================================

/**
 * Calculate year-to-date cumulative totals for an employee
 *
 * Aggregates all finalized payroll line items from January 1st to the specified period end date.
 * Used for payslip YTD cumuls section.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID (for security filtering)
 * @param periodEnd - End of current payroll period
 * @returns YTD totals for gross, taxable net (brut imposable), and net paid
 */
async function calculateYTDCumuls(
  employeeId: string,
  tenantId: string,
  periodEnd: Date
): Promise<{ ytdGross: number; ytdTaxableNet: number; ytdNetPaid: number }> {
  // Calculate year start (January 1st of the period end year)
  const yearStart = new Date(periodEnd.getFullYear(), 0, 1);
  const yearStartStr = yearStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Query all payroll line items for this employee, joined with their runs
  // Using manual join as recommended (not Drizzle's `with` relations)
  const result = await db
    .select({
      lineItemId: payrollLineItems.id,
      grossSalary: payrollLineItems.grossSalary,
      brutImposable: payrollLineItems.brutImposable,
      netSalary: payrollLineItems.netSalary,
      runStatus: payrollRuns.status,
      runPeriodEnd: payrollRuns.periodEnd,
    })
    .from(payrollLineItems)
    .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollLineItems.employeeId, employeeId),
        eq(payrollRuns.tenantId, tenantId),
        gte(payrollRuns.periodEnd, yearStartStr),
        lte(payrollRuns.periodEnd, periodEndStr),
        or(
          eq(payrollRuns.status, 'approved'),
          eq(payrollRuns.status, 'paid')
        )
      )
    );

  // Sum up YTD totals
  const ytdGross = result.reduce(
    (sum, item) => sum + parseFloat(item.grossSalary?.toString() || '0'),
    0
  );

  const ytdTaxableNet = result.reduce(
    (sum, item) => sum + parseFloat(item.brutImposable?.toString() || '0'),
    0
  );

  const ytdNetPaid = result.reduce(
    (sum, item) => sum + parseFloat(item.netSalary?.toString() || '0'),
    0
  );

  return {
    ytdGross,
    ytdTaxableNet,
    ytdNetPaid,
  };
}

/**
 * Fetch absences/leave taken during a specific pay period
 *
 * Returns all approved time-off requests that overlap with the payroll period.
 * Used for "Absences et congés" section in the payslip.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID (for security filtering)
 * @param periodStart - Start of payroll period
 * @param periodEnd - End of payroll period
 * @returns Array of absences during the period
 */
async function fetchAbsencesDuringPeriod(
  employeeId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Array<{
  type: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  treatment: 'paid' | 'unpaid' | 'not_processed';
  impact?: string;
}>> {
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Query time-off requests that overlap with the payroll period
  // Using manual join to get policy details
  const requests = await db
    .select({
      requestId: timeOffRequests.id,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      totalDays: timeOffRequests.totalDays,
      status: timeOffRequests.status,
      policyName: timeOffPolicies.name,
      policyType: timeOffPolicies.policyType,
      isPaid: timeOffPolicies.isPaid,
    })
    .from(timeOffRequests)
    .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
    .where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'),
        // Overlap condition: request start <= period end AND request end >= period start
        lte(timeOffRequests.startDate, periodEndStr),
        gte(timeOffRequests.endDate, periodStartStr)
      )
    )
    .orderBy(asc(timeOffRequests.startDate));

  // Map to PayslipData format
  return requests.map((request) => ({
    type: request.policyName || 'Congé',
    startDate: new Date(request.startDate),
    endDate: new Date(request.endDate),
    duration: parseFloat(request.totalDays?.toString() || '0'),
    treatment: request.isPaid
      ? 'paid'
      : request.status === 'approved'
      ? 'unpaid'
      : 'not_processed',
    impact: undefined, // Can be extended later if needed
  }));
}

/**
 * Fetch current leave balances for an employee
 *
 * Returns active leave balances grouped by policy type.
 * Used for "Soldes de congés" section in the payslip.
 *
 * @param employeeId - Employee UUID
 * @param tenantId - Tenant UUID (for security filtering)
 * @returns Leave balances by policy type
 */
async function fetchLeaveBalances(
  employeeId: string,
  tenantId: string
): Promise<{
  paidLeave?: { total: number; used: number };
  sickLeave?: { total: number | 'unlimited'; used: number };
  familyEvents?: { total: number | 'by_event'; used: number };
}> {
  const today = new Date().toISOString().split('T')[0];

  // Query active balances (where period hasn't ended yet)
  const balances = await db
    .select({
      balanceId: timeOffBalances.id,
      balance: timeOffBalances.balance,
      used: timeOffBalances.used,
      pending: timeOffBalances.pending,
      policyType: timeOffPolicies.policyType,
      policyName: timeOffPolicies.name,
    })
    .from(timeOffBalances)
    .innerJoin(timeOffPolicies, eq(timeOffBalances.policyId, timeOffPolicies.id))
    .where(
      and(
        eq(timeOffBalances.employeeId, employeeId),
        eq(timeOffBalances.tenantId, tenantId),
        gte(timeOffBalances.periodEnd, today) // Active balances only
      )
    );

  // Group by policy type (West African leave types)
  const result: {
    paidLeave?: { total: number; used: number };
    sickLeave?: { total: number | 'unlimited'; used: number };
    familyEvents?: { total: number | 'by_event'; used: number };
  } = {};

  for (const balance of balances) {
    const total = parseFloat(balance.balance?.toString() || '0') + parseFloat(balance.used?.toString() || '0');
    const used = parseFloat(balance.used?.toString() || '0');

    // Map policy types to West African leave categories
    const policyType = balance.policyType?.toUpperCase() || '';

    if (policyType.includes('PAID') || policyType.includes('ANNUAL') || policyType.includes('CONGE')) {
      // Congés payés (typically 2.5 days per month = 30 days per year in CI)
      result.paidLeave = { total, used };
    } else if (policyType.includes('SICK') || policyType.includes('MALADIE')) {
      // Arrêt maladie (unlimited with medical certificate in most West African countries)
      result.sickLeave = { total: 'unlimited', used };
    } else if (policyType.includes('FAMILY') || policyType.includes('FAMILIAL') || policyType.includes('EVENT')) {
      // Congés événements familiaux (variable days: marriage, birth, death, etc.)
      result.familyEvents = { total: 'by_event', used };
    }
  }

  return result;
}

/**
 * Aggregate payroll data for all runs in a given month
 *
 * Used for monthly regulatory exports (CNPS, CMU, État 301).
 * Consolidates all approved/paid runs for the month, which is critical for
 * CDDTI employees who can have multiple payroll runs within a single month.
 *
 * IMPORTANT: CDDTI 21-day threshold must be calculated using monthly totals,
 * not individual run totals.
 *
 * @param tenantId - Tenant UUID
 * @param month - Month in YYYY-MM format (e.g., "2025-01")
 * @returns Aggregated employee data with monthly totals
 */
async function aggregateMonthlyPayrollData(
  tenantId: string,
  month: string
): Promise<{
  runs: Array<typeof payrollRuns.$inferSelect>;
  employees: Array<{
    // Employee identification
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    cnpsNumber: string | null;
    dateOfBirth: Date | null;
    hireDate: Date;
    terminationDate: Date | null;
    salaryRegime: string | null;
    contractType: string | null;
    phone: string | null;
    bankAccount: string | null;

    // Monthly aggregated totals
    grossSalary: number;
    daysWorked: number;
    hoursWorked: number;
    cnpsEmployee: number;
    cmuEmployee: number;
    taxableIncome: number;
    its: number;
    netSalary: number;

    // Tracking
    runIds: string[]; // Run IDs this employee appeared in
  }>;
  periodStart: Date;
  periodEnd: Date;
}> {
  // Parse month string (YYYY-MM)
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr || '0', 10);
  const monthNum = parseInt(monthStr || '0', 10);

  if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid month format. Expected YYYY-MM, got: ${month}`,
    });
  }

  // Calculate period bounds for this month
  const periodStart = new Date(year, monthNum - 1, 1);
  const periodEnd = new Date(year, monthNum, 0); // Last day of month

  console.log(`[Aggregate Monthly] Querying runs for ${month} (${periodStart.toISOString()} to ${periodEnd.toISOString()})`);

  // Query all approved/paid runs for this month
  // Use SQL EXTRACT to filter by year and month
  const runs = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.tenantId, tenantId),
        or(
          eq(payrollRuns.status, 'approved'),
          eq(payrollRuns.status, 'paid')
        ),
        sql`EXTRACT(YEAR FROM ${payrollRuns.periodStart}) = ${year}`,
        sql`EXTRACT(MONTH FROM ${payrollRuns.periodStart}) = ${monthNum}`
      )
    )
    .orderBy(asc(payrollRuns.periodStart));

  if (runs.length === 0) {
    console.log(`[Aggregate Monthly] No approved/paid runs found for ${month}`);
    return {
      runs: [],
      employees: [],
      periodStart,
      periodEnd,
    };
  }

  console.log(`[Aggregate Monthly] Found ${runs.length} runs for ${month}:`, runs.map(r => r.id));

  const runIds = runs.map(run => run.id);

  // Fetch all line items for these runs
  const lineItems = await db
    .select({
      lineItemId: payrollLineItems.id,
      employeeId: payrollLineItems.employeeId,
      employeeNumber: payrollLineItems.employeeNumber,
      employeeName: payrollLineItems.employeeName,
      runId: payrollLineItems.payrollRunId,
      grossSalary: payrollLineItems.grossSalary,
      daysWorked: payrollLineItems.daysWorked,
      hoursWorked: payrollLineItems.hoursWorked,
      cnpsEmployee: payrollLineItems.cnpsEmployee,
      cmuEmployee: payrollLineItems.cmuEmployee,
      brutImposable: payrollLineItems.brutImposable,
      its: payrollLineItems.its,
      netSalary: payrollLineItems.netSalary,
    })
    .from(payrollLineItems)
    .where(inArray(payrollLineItems.payrollRunId, runIds));

  console.log(`[Aggregate Monthly] Found ${lineItems.length} line items across all runs`);

  if (lineItems.length === 0) {
    return {
      runs,
      employees: [],
      periodStart,
      periodEnd,
    };
  }

  // Get unique employee IDs
  const employeeIds = [...new Set(lineItems.map(item => item.employeeId))];

  // Fetch employee details (for CNPS number, DOB, contract type, etc.)
  const employeeRecords = await db
    .select()
    .from(employees)
    .where(
      and(
        inArray(employees.id, employeeIds),
        eq(employees.tenantId, tenantId)
      )
    );

  // Create employee lookup map
  const employeeMap = new Map(employeeRecords.map(emp => [emp.id, emp]));

  // Group line items by employee and aggregate
  const employeeDataMap = new Map<string, {
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    cnpsNumber: string | null;
    dateOfBirth: Date | null;
    hireDate: Date;
    terminationDate: Date | null;
    salaryRegime: string | null;
    contractType: string | null;
    phone: string | null;
    bankAccount: string | null;
    grossSalary: number;
    daysWorked: number;
    hoursWorked: number;
    cnpsEmployee: number;
    cmuEmployee: number;
    taxableIncome: number;
    its: number;
    netSalary: number;
    runIds: string[];
  }>();

  for (const item of lineItems) {
    const employee = employeeMap.get(item.employeeId);

    if (!employee) {
      console.warn(`[Aggregate Monthly] Employee ${item.employeeId} not found in database`);
      continue;
    }

    const existing = employeeDataMap.get(item.employeeId);

    if (existing) {
      // Aggregate values
      existing.grossSalary += parseFloat(item.grossSalary?.toString() || '0');
      existing.daysWorked += parseFloat(item.daysWorked?.toString() || '0');
      existing.hoursWorked += parseFloat(item.hoursWorked?.toString() || '0');
      existing.cnpsEmployee += parseFloat(item.cnpsEmployee?.toString() || '0');
      existing.cmuEmployee += parseFloat(item.cmuEmployee?.toString() || '0');
      existing.taxableIncome += parseFloat(item.brutImposable?.toString() || '0');
      existing.its += parseFloat(item.its?.toString() || '0');
      existing.netSalary += parseFloat(item.netSalary?.toString() || '0');
      existing.runIds.push(item.runId);
    } else {
      // Initialize new employee entry
      employeeDataMap.set(item.employeeId, {
        employeeId: item.employeeId,
        employeeNumber: employee.employeeNumber || item.employeeNumber || '',
        employeeName: `${employee.firstName} ${employee.lastName}`.trim() || item.employeeName || '',
        cnpsNumber: employee.cnpsNumber,
        dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : null,
        hireDate: new Date(employee.hireDate),
        terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : null,
        salaryRegime: employee.salaryRegime,
        contractType: employee.contractType,
        phone: employee.phone,
        bankAccount: employee.bankAccount,
        grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
        daysWorked: parseFloat(item.daysWorked?.toString() || '0'),
        hoursWorked: parseFloat(item.hoursWorked?.toString() || '0'),
        cnpsEmployee: parseFloat(item.cnpsEmployee?.toString() || '0'),
        cmuEmployee: parseFloat(item.cmuEmployee?.toString() || '0'),
        taxableIncome: parseFloat(item.brutImposable?.toString() || '0'),
        its: parseFloat(item.its?.toString() || '0'),
        netSalary: parseFloat(item.netSalary?.toString() || '0'),
        runIds: [item.runId],
      });
    }
  }

  const aggregatedEmployees = Array.from(employeeDataMap.values());

  console.log(`[Aggregate Monthly] Aggregated data for ${aggregatedEmployees.length} employees`);
  console.log(`[Aggregate Monthly] CDDTI employees with multiple runs:`,
    aggregatedEmployees
      .filter(emp => emp.runIds.length > 1 && emp.contractType === 'CDDTI')
      .map(emp => `${emp.employeeName} (${emp.runIds.length} runs, ${emp.daysWorked} days total)`)
  );

  return {
    runs,
    employees: aggregatedEmployees,
    periodStart,
    periodEnd,
  };
}

// ========================================
// Payroll Router
// ========================================

export const payrollRouter = createTRPCRouter({
  /**
   * Calculate gross salary for an employee
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.calculateGross.query({
   *   employeeId: '123',
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   *   baseSalary: 300000,
   *   housingAllowance: 50000,
   * });
   * ```
   */
  calculateGross: publicProcedure
    .input(calculateGrossInputSchema)
    .query(({ input }) => {
      return calculateGrossSalary(input);
    }),

  /**
   * Calculate complete payroll for an employee (Legacy - Côte d'Ivoire only)
   *
   * Returns gross to net calculation with all deductions and employer costs.
   * Uses hardcoded constants. For multi-country support, use calculateV2.
   *
   * @deprecated Use calculateV2 for multi-country support
   * @example
   * ```typescript
   * const result = await trpc.payroll.calculate.query({
   *   employeeId: '123',
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   *   baseSalary: 300000,
   *   hasFamily: false,
   * });
   * // result.netSalary = 219,285
   * ```
   */
  calculate: publicProcedure
    .input(calculatePayrollInputSchema)
    .query(({ input }) => {
      return calculatePayroll(input);
    }),

  /**
   * Calculate complete payroll for an employee (V2 - Multi-Country)
   *
   * Database-driven payroll calculation supporting multiple countries.
   * Loads tax rates, contribution rates, and brackets from database.
   *
   * @example
   * ```typescript
   * // Côte d'Ivoire employee
   * const resultCI = await trpc.payroll.calculateV2.query({
   *   employeeId: '123',
   *   countryCode: 'CI',
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   *   baseSalary: 300000,
   *   fiscalParts: 1.0,
   *   sectorCode: 'services',
   * });
   * // resultCI.netSalary = 219,286
   *
   * // Future: Senegal employee
   * const resultSN = await trpc.payroll.calculateV2.query({
   *   employeeId: '456',
   *   countryCode: 'SN',
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   *   baseSalary: 250000,
   * });
   * ```
   */
  calculateV2: publicProcedure
    .input(calculatePayrollV2InputSchema)
    .query(async ({ input }) => {
      return await calculatePayrollV2(input);
    }),

  /**
   * Calculate Salary Preview (Unified endpoint for hiring, salary edit, what-if)
   *
   * Single source of truth for salary preview calculations.
   * Supports three contexts:
   * - 'hiring': New employee preview (no employeeId)
   * - 'salary_edit': Existing employee salary change preview
   * - 'what_if': Family status simulation for existing employee
   *
   * @example
   * ```typescript
   * // Hiring flow
   * const preview = await trpc.payroll.calculateSalaryPreview.mutation({
   *   context: 'hiring',
   *   baseComponents: { '11': 150000 },
   *   components: [{ code: 'TPT_ABIDJAN', name: 'Transport Abidjan', amount: 25000 }],
   *   maritalStatus: 'single',
   *   dependentChildren: 0,
   *   hireDate: new Date(),
   * });
   *
   * // Salary edit flow
   * const preview = await trpc.payroll.calculateSalaryPreview.mutation({
   *   context: 'salary_edit',
   *   employeeId: 'emp-123',
   *   baseComponents: { '11': 200000 }, // New base salary
   * });
   *
   * // What-if mode (simulate family status change)
   * const preview = await trpc.payroll.calculateSalaryPreview.mutation({
   *   context: 'what_if',
   *   employeeId: 'emp-123',
   *   maritalStatus: 'married',
   *   dependentChildren: 2,
   * });
   * ```
   */
  calculateSalaryPreview: protectedProcedure
    .input(
      z.object({
        context: z.enum(['hiring', 'salary_edit', 'what_if']).default('hiring'),
        employeeId: z.string().uuid().optional(), // Required for salary_edit and what_if

        // Base salary components (database-driven)
        baseComponents: z.record(z.string(), z.number()).optional(),
        baseSalary: z.number().min(1).optional(), // Deprecated fallback

        // Additional components (allowances, bonuses, etc.)
        components: z
          .array(
            z.object({
              code: z.string(),
              name: z.string(),
              amount: z.number(),
              sourceType: z.enum(['standard', 'template', 'import']).default('template'),
            })
          )
          .optional(),

        // Employee details (required for hiring, optional for salary_edit/what_if)
        rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
        contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']).optional(),
        maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
        dependentChildren: z.number().min(0).max(10).optional(),
        hireDate: z.date().optional(),
        isExpat: z.boolean().optional(), // For ITS employer tax calculation (1.2% local, 10.4% expat)

        // CDDTI-specific fields for payment frequency calculation
        paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
        weeklyHoursRegime: z.enum(['40h', '44h', '48h']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { buildBaseSalaryComponents, calculateBaseSalaryTotal } = await import(
        '@/lib/salary-components/base-salary-loader'
      );

      // Dynamic imports for schema to avoid Turbopack module resolution issues
      const { tenants: tenantsSchema, employees: employeesSchema, employeeDependents: employeeDependentsSchema } = await import('@/drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');

      // Get tenant info
      const [tenant] = await db.select().from(tenantsSchema).where(eqOp(tenantsSchema.id, ctx.user.tenantId)).limit(1);

      if (!tenant) {
        throw new Error('Entreprise non trouvée');
      }

      const countryCode = tenant.countryCode || 'CI';

      // Load existing employee data if employeeId provided
      let existingEmployee: any = null;
      let verifiedDependents: any[] = [];
      let employeeContract: any = null;

      if (input.employeeId) {
        [existingEmployee] = await db
          .select()
          .from(employeesSchema)
          .where(andOp(eqOp(employeesSchema.id, input.employeeId), eqOp(employeesSchema.tenantId, ctx.user.tenantId)))
          .limit(1);

        if (!existingEmployee) {
          throw new Error('Employé non trouvé');
        }

        // Load employee's current contract to get contract type
        if (existingEmployee.currentContractId) {
          const { employmentContracts } = await import('@/drizzle/schema');
          [employeeContract] = await db
            .select()
            .from(employmentContracts)
            .where(eqOp(employmentContracts.id, existingEmployee.currentContractId))
            .limit(1);
        }

        // Load verified dependents for family calculations
        verifiedDependents = await db
          .select()
          .from(employeeDependentsSchema)
          .where(andOp(eqOp(employeeDependentsSchema.employeeId, input.employeeId), eqOp(employeeDependentsSchema.isVerified, true)));
      }

      // Determine contract type from contract or fallback to employee
      const contractType = input.contractType || employeeContract?.contractType || existingEmployee?.contractType;

      // Determine rate type - CDDTI contracts are ALWAYS HOURLY
      let rateType: 'MONTHLY' | 'DAILY' | 'HOURLY' = input.rateType || existingEmployee?.rateType || 'MONTHLY';
      if (contractType === 'CDDTI') {
        rateType = 'HOURLY';
      }

      // Debug log to verify contract type detection
      console.log('🔍 [CDDTI DEBUG] Contract type detection:', {
        employeeId: input.employeeId,
        employeeName: existingEmployee?.firstName + ' ' + existingEmployee?.lastName,
        inputContractType: input.contractType,
        employeeContractType: employeeContract?.contractType,
        existingEmployeeContractType: existingEmployee?.contractType,
        resolvedContractType: contractType,
        inputRateType: input.rateType,
        existingRateType: existingEmployee?.rateType,
        resolvedRateType: rateType,
      });
      const maritalStatus = input.maritalStatus ?? existingEmployee?.maritalStatus ?? 'single';

      // Resolve employee type for ITS tax calculation
      // Priority: input.isExpat (boolean) → existingEmployee.employeeType (enum) → existingEmployee.isExpat (legacy boolean) → default to LOCAL
      let employeeType: 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE' = 'LOCAL';

      if (input.isExpat !== undefined) {
        // Legacy boolean input - map to enum
        employeeType = input.isExpat ? 'EXPAT' : 'LOCAL';
      } else if (existingEmployee?.employeeType) {
        // Use new employeeType enum from database
        employeeType = existingEmployee.employeeType;
      } else if (existingEmployee?.isExpat !== undefined) {
        // Fallback to legacy isExpat boolean field
        employeeType = existingEmployee.isExpat ? 'EXPAT' : 'LOCAL';
      }

      // Map to boolean for ITS calculation (EXPAT = 10.4%, others = 1.2%)
      const isExpat = employeeType === 'EXPAT';

      // DEBUG: Log expatriate status resolution
      console.log('🔍 [ITS DEBUG] Employee type resolution:', {
        inputIsExpat: input.isExpat,
        existingEmployeeType: existingEmployee?.employeeType,
        existingEmployeeIsExpat: existingEmployee?.isExpat,
        resolvedEmployeeType: employeeType,
        resolvedIsExpat: isExpat,
        employeeId: input.employeeId,
        employeeName: existingEmployee ? `${existingEmployee.firstName} ${existingEmployee.lastName}` : 'N/A'
      });

      // Count only children (not spouse) from verified dependents
      const childrenCount = verifiedDependents.filter(d =>
        d.relationship === 'child' && d.eligibleForFiscalParts
      ).length;
      const dependentChildren = input.dependentChildren ?? childrenCount ?? 0;
      const hireDate = input.hireDate || existingEmployee?.hireDate || new Date();

      // Build base salary components
      let baseSalaryComponentsList: any[];
      let totalBaseSalary = 0;

      if (input.baseComponents) {
        baseSalaryComponentsList = (await buildBaseSalaryComponents(input.baseComponents, countryCode)) as any[];
        totalBaseSalary = await calculateBaseSalaryTotal(baseSalaryComponentsList, countryCode);
      } else if (input.baseSalary) {
        // Fallback to legacy baseSalary
        baseSalaryComponentsList = (await buildBaseSalaryComponents({ '11': input.baseSalary }, countryCode)) as any[];
        totalBaseSalary = input.baseSalary;
      } else if (input.context === 'salary_edit' && input.components && input.components.length > 0) {
        // In salary_edit context with components provided, extract base components from input
        // This ensures we only use the components the user selected in the UI
        const { getBaseSalaryComponents } = await import('@/lib/salary-components/base-salary-loader');
        const baseComponentsList = await getBaseSalaryComponents(countryCode);
        const baseComponentCodes = baseComponentsList.map(bc => bc.code);

        // Filter base components from input
        baseSalaryComponentsList = input.components.filter(c => baseComponentCodes.includes(c.code));
        totalBaseSalary = await calculateBaseSalaryTotal(baseSalaryComponentsList, countryCode);

        console.log('[SALARY EDIT MODE] Using components from input only, ignoring database');
        console.log('[SALARY EDIT MODE] Input components:', JSON.stringify(input.components, null, 2));
        console.log('[SALARY EDIT MODE] Base components:', baseSalaryComponentsList.map((c: any) => c.code));
      } else if (existingEmployee) {
        // Load salary from employee_salaries table
        const { employeeSalaries: employeeSalariesSchema } = await import('@/drizzle/schema');
        const [employeeSalary] = await db
          .select()
          .from(employeeSalariesSchema)
          .where(
            andOp(
              eqOp(employeeSalariesSchema.employeeId, input.employeeId!),
              eqOp(employeeSalariesSchema.tenantId, ctx.user.tenantId)
            )
          )
          .orderBy(desc(employeeSalariesSchema.effectiveFrom))
          .limit(1);

        if (employeeSalary) {
          // Use components from salary record if available
          const components = employeeSalary.components as any[] || [];
          if (components.length > 0) {
            baseSalaryComponentsList = components;
            totalBaseSalary = await calculateBaseSalaryTotal(components, countryCode);
          } else {
            // Fallback to base_salary field
            const baseSalaryAmount = parseFloat(employeeSalary.baseSalary?.toString() || '75000');
            baseSalaryComponentsList = (await buildBaseSalaryComponents({ '11': baseSalaryAmount }, countryCode)) as any[];
            totalBaseSalary = baseSalaryAmount;
          }
        } else {
          throw new Error('Aucun salaire trouvé pour cet employé');
        }
      } else {
        throw new Error('Le salaire de base est requis');
      }

      // Calculate fiscal parts
      let fiscalParts = 1.0;
      if (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed') {
        fiscalParts += 1.0;
      }
      const countedChildren = Math.min(dependentChildren, 4);
      fiscalParts += countedChildren * 0.5;

      // Calculate hasFamily flag (for CMU employer contribution)
      const hasFamily = maritalStatus === 'married' || dependentChildren > 0;

      // Get salaire catégoriel (code 11) for percentage calculations
      const salaireCategorielComponent = baseSalaryComponentsList.find(c => c.code === '11');
      const salaireCategoriel = salaireCategorielComponent?.amount || 0;

      // Enrich template components with metadata
      const enrichedTemplateComponents = await Promise.all(
        (input.components || []).map(async (comp: any) => {
          // First try salary_component_definitions
          const [definition] = await db
            .select()
            .from(salaryComponentDefinitions)
            .where(
              and(eq(salaryComponentDefinitions.code, comp.code), eq(salaryComponentDefinitions.countryCode, countryCode))
            )
            .limit(1);

          // If not found in definitions, try salary_component_templates
          let templateFromTemplates: any = null;
          if (!definition) {
            const results = await db
              .select()
              .from(salaryComponentTemplates)
              .where(eq(salaryComponentTemplates.code, comp.code))
              .limit(1);
            templateFromTemplates = results[0] || null;
          }

          const template = definition || templateFromTemplates;

          if (template) {
            // Check if this is a percentage-based or auto-calculated component
            let calculatedAmount = comp.amount;
            const metadata = template.metadata as any;
            const calculationRule = metadata?.calculationRule;
            const calculationMethod = 'calculationMethod' in template ? template.calculationMethod : null;

            if (calculationMethod === 'percentage' && salaireCategoriel > 0) {
              // For percentage components from definitions table
              const percentageRate = comp.amount / 100;
              calculatedAmount = Math.round(salaireCategoriel * percentageRate);
              console.log(`[Salary Preview] Calculated ${template.name} as ${percentageRate * 100}% of ${salaireCategoriel}: ${calculatedAmount} FCFA`);
            } else if (calculationRule?.type === 'auto-calculated' && calculationRule?.rate && salaireCategoriel > 0) {
              // For auto-calculated components from templates table (e.g., seniority)
              // In hiring context: use the amount from the form (already calculated in salary-info-step)
              // In other contexts: recalculate based on current salaireCategoriel
              if (input.context === 'hiring') {
                calculatedAmount = comp.amount; // Use stored value from hiring form
                console.log(`[Salary Preview] Using stored ${template.name} from hiring form: ${calculatedAmount} FCFA`);
              } else {
                const rate = calculationRule.rate; // e.g., 0.02 for 2%
                calculatedAmount = Math.round(salaireCategoriel * rate);
                console.log(`[Salary Preview] Auto-calculated ${template.name} using ${rate * 100}% of ${salaireCategoriel}: ${calculatedAmount} FCFA`);
              }
            }

            return {
              code: comp.code,
              name:
                typeof template.name === 'object'
                  ? (template.name as any).fr || (template.name as any).en || comp.code
                  : String(template.name),
              amount: calculatedAmount,
              sourceType: 'template' as const,
              metadata: template.metadata,
            };
          }

          return {
            code: comp.code,
            name: comp.name || comp.code,
            amount: comp.amount,
            sourceType: 'custom' as const,
          };
        })
      );

      // Deduplicate components by code (prefer baseSalaryComponentsList over enrichedTemplateComponents)
      const componentMap = new Map<string, any>();

      // Add base salary components first (these take priority)
      baseSalaryComponentsList.forEach(comp => {
        componentMap.set(comp.code, comp);
      });

      // Add enriched template components (only if not already present)
      enrichedTemplateComponents.forEach(comp => {
        if (!componentMap.has(comp.code)) {
          componentMap.set(comp.code, comp);
        }
      });

      // Calculate preview for a full month
      const previewDate = hireDate >= new Date() ? hireDate : new Date();
      const periodStart = new Date(previewDate.getFullYear(), previewDate.getMonth(), 1);
      const periodEnd = new Date(previewDate.getFullYear(), previewDate.getMonth() + 1, 0);

      // Get weeklyHoursRegime and paymentFrequency from input (for hiring) or existing employee
      const weeklyHoursRegime = input.weeklyHoursRegime || existingEmployee?.weeklyHoursRegime || '40h';
      const paymentFrequency = input.paymentFrequency || existingEmployee?.paymentFrequency || 'MONTHLY';

      // Calculate hours/days based on payment frequency and weekly hours regime
      // Extract numeric hours from regime (e.g., '40h' → 40)
      const weeklyHours = parseInt(weeklyHoursRegime.replace('h', ''));
      const hoursPerDay = weeklyHours / 5; // Standard 5-day work week
      const monthlyHours = (weeklyHours * 52) / 12; // Annual hours ÷ 12 months

      let previewHours: number;
      let previewDays: number;

      switch (paymentFrequency) {
        case 'DAILY':
          previewHours = hoursPerDay; // e.g., 8h for 40h regime
          previewDays = 1;
          break;
        case 'WEEKLY':
          previewHours = weeklyHours; // e.g., 40h for 40h regime
          previewDays = 5;
          break;
        case 'BIWEEKLY':
          previewHours = weeklyHours * 2; // e.g., 80h for 40h regime
          previewDays = 10;
          break;
        case 'MONTHLY':
        default:
          previewHours = monthlyHours; // e.g., 173.33h for 40h regime
          previewDays = 22;
          break;
      }

      // Components remain as rates - calculatePayrollV2 will handle multiplication
      const allComponentsWithMetadata = Array.from(componentMap.values());

      console.log('[PREVIEW CALCULATION] Rate type:', rateType);
      console.log('[PREVIEW CALCULATION] Payment frequency:', paymentFrequency);
      console.log('[PREVIEW CALCULATION] Weekly regime:', weeklyHoursRegime);
      console.log('[PREVIEW CALCULATION] Preview hours:', previewHours);
      console.log('[PREVIEW CALCULATION] Preview days:', previewDays);
      console.log('[PREVIEW CALCULATION] Components (as rates):', allComponentsWithMetadata);

      // Call calculatePayrollV2
      const payrollResult = await calculatePayrollV2({
        employeeId: input.employeeId || 'preview',
        countryCode,
        tenantId: ctx.user.tenantId,
        periodStart,
        periodEnd,
        baseSalary: 0, // Set to 0 to avoid double-counting
        customComponents: allComponentsWithMetadata,
        hireDate: periodStart,
        fiscalParts,
        hasFamily,
        sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',
        isPreview: true,
        rateType,
        weeklyHoursRegime,
        paymentFrequency, // Pass payment frequency for transport calculation
        contractType, // Pass contract type for CDDTI detection
        hoursWorkedThisMonth: previewHours, // Calculated based on regime and frequency
        daysWorkedThisMonth: previewDays, // Calculated based on regime and frequency
        maritalStatus,
        dependentChildren,
        isExpat, // For ITS employer tax calculation (resolved above)
      });

      // Format response to match SalaryPreviewData type
      const previewData: any = {
        grossSalary: payrollResult.grossSalary,
        brutImposable: payrollResult.brutImposable,
        netSalary: payrollResult.netSalary,
        totalEmployerCost: payrollResult.employerCost,
        cnpsEmployee: payrollResult.cnpsEmployee,
        cnpsEmployer: payrollResult.cnpsEmployer,
        its: payrollResult.its,
        cmuEmployee: payrollResult.cmuEmployee || 0,
        cmuEmployer: payrollResult.cmuEmployer || 0,

        // Include detailed breakdowns for itemized display
        contributionDetails: payrollResult.contributionDetails || [],
        deductionsDetails: payrollResult.deductionsDetails || [],
        otherTaxesDetails: payrollResult.otherTaxesDetails || [],

        // Use calculated components from payroll result (not input components)
        // This includes all journalier-specific components (overtime, gratification, etc.)
        components: payrollResult.components || [],
        fiscalParts,
        maritalStatus,
        dependentChildren,
        rateType,
        contractType,
        countryCode,
        currencySymbol: 'FCFA',

        // Payment period context (for understanding the preview)
        paymentPeriodContext: {
          paymentFrequency,
          weeklyHoursRegime,
          hoursInPeriod: previewHours,
          daysInPeriod: previewDays,
          periodLabel: ({
            DAILY: 'jour',
            WEEKLY: 'semaine',
            BIWEEKLY: '2 semaines',
            MONTHLY: 'mois',
          } as const)[paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'] || 'période',
        },
      };

      return {
        success: true,
        preview: previewData,
      };
    }),

  /**
   * Get city transport minimum for a location
   *
   * Returns the legal minimum transport allowance based on city.
   * Used for employee transport allowance validation.
   *
   * @example
   * ```typescript
   * const minimum = await trpc.payroll.getCityTransportMinimum.query({
   *   countryCode: 'CI',
   *   city: 'Abidjan',
   * });
   * // minimum.monthlyMinimum = 30000
   * // minimum.dailyRate = 1000
   * ```
   */
  getCityTransportMinimum: publicProcedure
    .input(z.object({
      countryCode: z.string().length(2),
      city: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const minimum = await ruleLoader.getCityTransportMinimum(
        input.countryCode,
        input.city,
        new Date()
      );
      return minimum;
    }),

  /**
   * Get pay variables (bonuses/deductions) for employee in payroll run
   * Returns earnings and deductions details from payroll line item
   * Requires: HR Manager role
   */
  getEmployeePayVariables: hrManagerProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const lineItems = await db
        .select({
          earningsDetails: payrollLineItems.earningsDetails,
          deductionsDetails: payrollLineItems.deductionsDetails,
          bonuses: payrollLineItems.bonuses,
        })
        .from(payrollLineItems)
        .where(
          and(
            eq(payrollLineItems.payrollRunId, input.runId),
            eq(payrollLineItems.employeeId, input.employeeId),
            eq(payrollLineItems.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (lineItems.length === 0) {
        return {
          earningsDetails: [],
          deductionsDetails: [],
          bonuses: '0',
        };
      }

      return lineItems[0];
    }),

  /**
   * Add pay variable (bonus/deduction/allowance) to employee for payroll run
   * Updates the payroll line item with new earning or deduction
   * Requires: HR Manager role
   */
  addPayVariable: hrManagerProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        employeeId: z.string().uuid(),
        category: z.enum(['bonus', 'allowance', 'deduction']),
        description: z.string().min(1),
        amount: z.number().positive(),
        taxable: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get existing line item
      const existingLineItems = await db
        .select({
          id: payrollLineItems.id,
          earningsDetails: payrollLineItems.earningsDetails,
          deductionsDetails: payrollLineItems.deductionsDetails,
          bonuses: payrollLineItems.bonuses,
          grossSalary: payrollLineItems.grossSalary,
          totalDeductions: payrollLineItems.totalDeductions,
        })
        .from(payrollLineItems)
        .where(
          and(
            eq(payrollLineItems.payrollRunId, input.runId),
            eq(payrollLineItems.employeeId, input.employeeId),
            eq(payrollLineItems.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (existingLineItems.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payroll line item not found',
        });
      }

      const lineItem = existingLineItems[0];
      const newVariable = {
        description: input.description,
        amount: input.amount,
        taxable: input.taxable,
        category: input.category,
      };

      let updatedEarnings = (lineItem.earningsDetails as any[]) || [];
      let updatedDeductions = (lineItem.deductionsDetails as any[]) || [];
      let updatedBonuses = parseFloat(lineItem.bonuses?.toString() || '0');
      let updatedGrossSalary = parseFloat(lineItem.grossSalary?.toString() || '0');
      let updatedTotalDeductions = parseFloat(lineItem.totalDeductions?.toString() || '0');

      if (input.category === 'deduction') {
        updatedDeductions = [...updatedDeductions, newVariable];
        updatedTotalDeductions += input.amount;
      } else {
        updatedEarnings = [...updatedEarnings, newVariable];
        if (input.category === 'bonus') {
          updatedBonuses += input.amount;
        }
        updatedGrossSalary += input.amount;
      }

      // Update the line item
      await db
        .update(payrollLineItems)
        .set({
          earningsDetails: updatedEarnings,
          deductionsDetails: updatedDeductions,
          bonuses: updatedBonuses.toString(),
          grossSalary: updatedGrossSalary.toString(),
          totalDeductions: updatedTotalDeductions.toString(),
          // Note: netSalary will be recalculated when payroll is finalized
          updatedAt: new Date(),
        })
        .where(eq(payrollLineItems.id, lineItem.id));

      return {
        success: true,
        variable: newVariable,
      };
    }),

  /**
   * Get employees grouped by review status for draft mode
   *
   * Returns employees with their review status (critical/warning/ready) for pre-calculation review.
   * - Critical: Missing time entries, no salary data
   * - Warning: Unapproved hours, pending adjustments
   * - Ready: All data complete
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * const employees = await trpc.payroll.getDraftEmployeesGrouped.query({
   *   runId: 'run-123',
   * });
   * // employees = [
   * //   { id: '...', firstName: 'Kouadio', status: 'critical', statusMessage: '0 heures saisies' },
   * //   { id: '...', firstName: 'Marie', status: 'warning', statusMessage: '32h · Manque 8h validation' },
   * //   { id: '...', firstName: 'Koné', status: 'ready', statusMessage: 'Prêt' },
   * // ]
   * ```
   */
  getDraftEmployeesGrouped: hrManagerProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Get payroll run to determine period and filters
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // Get all active employees for this run's payment frequency
      const runPaymentFreq = run.paymentFrequency || 'MONTHLY';
      const paymentFrequencyFilter = runPaymentFreq === 'MONTHLY'
        ? or(
            eq(employees.paymentFrequency, 'MONTHLY'),
            isNull(employees.paymentFrequency)
          )
        : eq(employees.paymentFrequency, runPaymentFreq);

      const allEmployees = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          paymentFrequency: employees.paymentFrequency,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, ctx.user.tenantId),
            eq(employees.status, 'active'),
            paymentFrequencyFilter
          )
        );

      // For each employee, determine their review status
      const employeesWithStatus = await Promise.all(
        allEmployees.map(async (emp) => {
          const empPaymentFreq = emp.paymentFrequency || 'MONTHLY';
          let status: 'critical' | 'warning' | 'ready' = 'ready';
          let statusMessage = 'Prêt';

          // Non-monthly workers: check time entries
          if (empPaymentFreq !== 'MONTHLY') {
            // Check if employee has time entries in the period
            const entries = await db
              .select({
                id: timeEntries.id,
                status: timeEntries.status,
                totalHours: timeEntries.totalHours,
              })
              .from(timeEntries)
              .where(
                and(
                  eq(timeEntries.employeeId, emp.id),
                  sql`${timeEntries.clockIn} >= ${run.periodStart}`,
                  sql`${timeEntries.clockIn} < ${run.periodEnd}`
                )
              );

            if (entries.length === 0) {
              status = 'critical';
              statusMessage = '0 heures saisies';
            } else {
              const approvedEntries = entries.filter((e) => e.status === 'approved');
              const pendingEntries = entries.filter((e) => e.status === 'pending');
              const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.totalHours?.toString() || '0')), 0);

              if (pendingEntries.length > 0) {
                const approvedHours = approvedEntries.reduce((sum, e) => sum + (parseFloat(e.totalHours?.toString() || '0')), 0);
                const pendingHours = totalHours - approvedHours;
                status = 'warning';
                statusMessage = `${Math.round(approvedHours)}h · Manque ${Math.round(pendingHours)}h validation`;
              } else {
                statusMessage = `${Math.round(totalHours)}h approuvées`;
              }
            }
          }

          return {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeNumber: emp.employeeNumber,
            status,
            statusMessage,
            paymentFrequency: empPaymentFreq,
          };
        })
      );

      return employeesWithStatus;
    }),

  /**
   * Get employee payroll preview for a period
   *
   * Shows monthly vs daily workers and validates time entries.
   * Used during payroll run creation to prevent errors.
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * const preview = await trpc.payroll.getEmployeePayrollPreview.query({
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   * });
   * // preview.monthlyWorkers.count = 30
   * // preview.dailyWorkers.count = 12
   * // preview.dailyWorkers.missingTimeEntries = [...]
   * ```
   */
  getEmployeePayrollPreview: hrManagerProcedure
    .input(
      z.object({
        periodStart: z.date(),
        periodEnd: z.date(),
        paymentFrequency: z.enum(['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY']),
        closureSequence: z.number().int().min(1).max(4).nullable().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      console.log('🔍 [getEmployeePayrollPreview] START:', {
        tenantId: ctx.user.tenantId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        paymentFrequency: input.paymentFrequency,
      });
      // FILTER: Apply payment frequency filter using the same logic as run-calculation.ts
      // For MONTHLY runs: include employees with MONTHLY frequency OR NULL (default to MONTHLY)
      // For other frequencies: exact match only
      const paymentFrequencyFilter = input.paymentFrequency === 'MONTHLY'
        ? or(
            eq(employees.paymentFrequency, 'MONTHLY'),
            isNull(employees.paymentFrequency)
          )
        : eq(employees.paymentFrequency, input.paymentFrequency);

      // Get all active employees for this tenant FILTERED by payment frequency
      const allEmployees = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          paymentFrequency: employees.paymentFrequency,
          status: employees.status,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, ctx.user.tenantId),
            eq(employees.status, 'active'),
            paymentFrequencyFilter // CRITICAL: Filter by payment frequency
          )
        );

      // Separate by payment frequency (per architecture doc)
      const monthlyWorkers = allEmployees.filter(
        (e) => !e.paymentFrequency || e.paymentFrequency === 'MONTHLY'
      );
      const biweeklyWorkers = allEmployees.filter(
        (e) => e.paymentFrequency === 'BIWEEKLY'
      );
      const weeklyWorkers = allEmployees.filter(
        (e) => e.paymentFrequency === 'WEEKLY'
      );
      const dailyWorkers = allEmployees.filter(
        (e) => e.paymentFrequency === 'DAILY'
      );

      // Non-monthly workers need time entries
      const nonMonthlyWorkers = [
        ...biweeklyWorkers,
        ...weeklyWorkers,
        ...dailyWorkers,
      ];

      // Check time entries for non-monthly workers
      // OPTIMIZATION: Use a single query with GROUP BY instead of looping through each employee
      const missingTimeEntries: Array<{
        id: string;
        firstName: string;
        lastName: string;
        employeeNumber: string;
        paymentFrequency: string;
      }> = [];

      if (nonMonthlyWorkers.length > 0) {
        // Get all employee IDs that HAVE approved time entries in this period
        const employeeIdsWithEntries = await db
          .selectDistinct({ employeeId: timeEntries.employeeId })
          .from(timeEntries)
          .where(
            and(
              inArray(
                timeEntries.employeeId,
                nonMonthlyWorkers.map(w => w.id)
              ),
              eq(timeEntries.status, 'approved'),
              sql`${timeEntries.clockIn} >= ${input.periodStart.toISOString()}`,
              sql`${timeEntries.clockIn} < ${input.periodEnd.toISOString()}`
            )
          );

        const employeeIdsWithEntriesSet = new Set(
          employeeIdsWithEntries.map(e => e.employeeId)
        );

        // Workers without time entries are those NOT in the set
        for (const worker of nonMonthlyWorkers) {
          if (!employeeIdsWithEntriesSet.has(worker.id)) {
            missingTimeEntries.push({
              id: worker.id,
              firstName: worker.firstName,
              lastName: worker.lastName,
              employeeNumber: worker.employeeNumber,
              paymentFrequency: worker.paymentFrequency || 'MONTHLY',
            });
          }
        }
      }

      const response = {
        monthlyWorkers: {
          count: monthlyWorkers.length,
          employees: monthlyWorkers,
        },
        biweeklyWorkers: {
          count: biweeklyWorkers.length,
          employees: biweeklyWorkers,
        },
        weeklyWorkers: {
          count: weeklyWorkers.length,
          employees: weeklyWorkers,
        },
        dailyWorkers: {
          count: dailyWorkers.length,
          employees: dailyWorkers,
        },
        nonMonthlyWorkers: {
          count: nonMonthlyWorkers.length,
          missingTimeEntries,
        },
        totalEmployees: allEmployees.length,
      };

      console.log('✅ [getEmployeePayrollPreview] COMPLETE:', {
        totalEmployees: response.totalEmployees,
        monthlyCount: response.monthlyWorkers.count,
        nonMonthlyCount: response.nonMonthlyWorkers.count,
        missingTimeEntries: response.nonMonthlyWorkers.missingTimeEntries.length,
      });

      return response;
    }),

  /**
   * Check if a payroll run exists for the given period
   *
   * Returns existing run details if found, null otherwise.
   * Used to prevent duplicates and guide users to existing runs.
   */
  checkExistingRun: protectedProcedure
    .input(
      z.object({
        periodStart: z.date(),
        periodEnd: z.date(),
        paymentFrequency: z.enum(['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      const tenantId = ctx.user.tenantId;

      const periodStartStr = input.periodStart.toISOString().split('T')[0];
      const periodEndStr = input.periodEnd.toISOString().split('T')[0];

      const existing = await db.query.payrollRuns.findFirst({
        where: and(
          eq(payrollRuns.tenantId, tenantId),
          // Only check for conflicts with same payment frequency
          input.paymentFrequency ? eq(payrollRuns.paymentFrequency, input.paymentFrequency) : undefined,
          or(
            // Exact match
            and(
              eq(payrollRuns.periodStart, periodStartStr),
              eq(payrollRuns.periodEnd, periodEndStr)
            ),
            // Overlapping periods (new period starts during existing period)
            and(
              lte(payrollRuns.periodStart, periodStartStr),
              gte(payrollRuns.periodEnd, periodStartStr)
            ),
            // Overlapping periods (new period ends during existing period)
            and(
              lte(payrollRuns.periodStart, periodEndStr),
              gte(payrollRuns.periodEnd, periodEndStr)
            ),
            // Overlapping periods (new period contains existing period)
            and(
              gte(payrollRuns.periodStart, periodStartStr),
              lte(payrollRuns.periodEnd, periodEndStr)
            )
          )
        ),
      });

      return existing || null;
    }),

  /**
   * Create a new payroll run
   *
   * Initializes a payroll run for a specific period.
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * const run = await trpc.payroll.createRun.mutate({
   *   tenantId: 'tenant-123',
   *   periodStart: new Date('2025-01-01'),
   *   periodEnd: new Date('2025-01-31'),
   *   paymentDate: new Date('2025-02-05'),
   *   createdBy: 'user-123',
   * });
   * ```
   */
  createRun: hrManagerProcedure
    .input(createPayrollRunInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Inject tenantId and createdBy from context (automatically uses activeTenantId if set)
      return await createPayrollRun({
        ...input,
        tenantId: ctx.user.tenantId,
        createdBy: ctx.user.id,
      });
    }),

  /**
   * Calculate payroll run for all employees
   *
   * Processes payroll for all active employees in the tenant.
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * const summary = await trpc.payroll.calculateRun.mutate({
   *   runId: 'run-123',
   * });
   * // summary.employeeCount = 50
   * // summary.totalGross = 15,000,000
   * ```
   */
  calculateRun: hrManagerProcedure
    .input(calculatePayrollRunInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Get the payroll run to check employee count
      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, input.runId))
        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payroll run not found',
        });
      }

      // ALWAYS use background processing via Inngest for reliable calculations
      // This ensures payroll succeeds even with unreliable internet connections
      // The calculation runs server-side and client polls for progress
      const employeeCount = run.employeeCount || 0;

      console.log('[PAYROLL] Using background processing for reliable calculation:', {
        runId: input.runId,
        employeeCount,
      });

      // Initialize progress tracking
      // Use raw SQL for upsert to handle null timestamp values properly
      await db.execute(sql`
        INSERT INTO payroll_run_progress (
          payroll_run_id, tenant_id, status, total_employees,
          processed_count, success_count, error_count,
          current_chunk, total_chunks, errors
        ) VALUES (
          ${input.runId}, ${ctx.user.tenantId}, 'pending', ${employeeCount},
          0, 0, 0, 0, ${Math.ceil(employeeCount / 1000) || 1}, '[]'::jsonb
        )
        ON CONFLICT (payroll_run_id) DO UPDATE SET
          status = 'pending',
          total_employees = ${employeeCount},
          processed_count = 0,
          success_count = 0,
          error_count = 0,
          current_chunk = 0,
          errors = '[]'::jsonb,
          started_at = NULL,
          completed_at = NULL,
          last_error = NULL,
          updated_at = NOW()
      `);

      // In production: use Inngest for reliable background processing
      // In development: use direct calculation (Inngest dev server may not be running)
      const useInngest = process.env.NODE_ENV === 'production' || process.env.USE_INNGEST === 'true';

      if (useInngest) {
        await sendEvent({
          name: 'payroll.run.calculate',
          data: {
            payrollRunId: input.runId,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            employeeCount,
            tenantId: ctx.user.tenantId,
          },
        });
        console.log('[PAYROLL] Background calculation triggered via Inngest');
      } else {
        console.log('[PAYROLL] Development mode: running direct calculation');
        // Await calculation directly — fast for small dev datasets
        const result = await calculatePayrollRunOptimized({ runId: input.runId });
        console.log('[PAYROLL] Direct calculation completed:', result.employeeCount, 'employees');

        // Return synchronous result — frontend refetches run data immediately
        return {
          success: true,
          background: false,
          runId: input.runId,
          message: `Calcul terminé: ${result.employeeCount} employés traités.`,
          employeeCount: result.employeeCount,
        };
      }

      // Return immediately - client polls getProgress for updates (Inngest path)
      return {
        success: true,
        background: true,
        runId: input.runId,
        message: 'Calcul lancé en arrière-plan. Suivez la progression ci-dessous.',
        employeeCount,
      };
    }),

  /**
   * Get payroll calculation progress
   *
   * Returns real-time progress for long-running payroll calculations.
   * Used by frontend to display progress bar and status updates.
   *
   * @example
   * ```typescript
   * const progress = await trpc.payroll.getProgress.query({
   *   runId: 'run-123',
   * });
   * // progress.percentComplete = 45
   * // progress.processedCount = 225
   * // progress.totalEmployees = 500
   * ```
   */
  getProgress: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [progress] = await db
        .select()
        .from(payrollRunProgress)
        .where(eq(payrollRunProgress.payrollRunId, input.runId))
        .limit(1);

      if (!progress) {
        // No progress record yet - return default state
        return {
          status: 'pending' as const,
          totalEmployees: 0,
          processedCount: 0,
          successCount: 0,
          errorCount: 0,
          percentComplete: 0,
          currentChunk: 0,
          totalChunks: 0,
          errors: [] as Array<{ employeeId: string; message: string }>,
          startedAt: null as Date | null,
          estimatedCompletionAt: null as Date | null,
        };
      }

      const percentComplete = progress.totalEmployees > 0
        ? Math.round((progress.processedCount / progress.totalEmployees) * 100)
        : 0;

      return {
        status: progress.status as 'pending' | 'processing' | 'completed' | 'failed' | 'paused',
        totalEmployees: progress.totalEmployees,
        processedCount: progress.processedCount,
        successCount: progress.successCount,
        errorCount: progress.errorCount,
        percentComplete,
        currentChunk: progress.currentChunk,
        totalChunks: progress.totalChunks,
        errors: (progress.errors as Array<{ employeeId: string; message: string }>) || [],
        lastError: progress.lastError,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        estimatedCompletionAt: progress.estimatedCompletionAt,
      };
    }),

  /**
   * Get payroll run details
   *
   * Retrieves run information with all line items.
   *
   * @example
   * ```typescript
   * const run = await trpc.payroll.getRun.query({
   *   runId: 'run-123',
   * });
   * ```
   */
  getRun: publicProcedure
    .input(getPayrollRunInputSchema)
    .query(async ({ input }) => {
      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, input.runId))
        .limit(1);

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // Get line items with employee details using direct SQL for JSONB extraction
      // Include all breakdown details for expandable employee rows
      const lineItems = await db
        .select({
          id: payrollLineItems.id,
          employeeId: payrollLineItems.employeeId,
          employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
          employeeNumber: employees.employeeNumber,
          baseSalary: payrollLineItems.baseSalary,
          allowances: payrollLineItems.allowances,
          daysWorked: payrollLineItems.daysWorked,
          daysAbsent: payrollLineItems.daysAbsent,
          grossSalary: payrollLineItems.grossSalary,
          netSalary: payrollLineItems.netSalary,
          totalDeductions: payrollLineItems.totalDeductions,
          totalEmployerCost: payrollLineItems.totalEmployerCost,
          // Employee deductions
          cnpsEmployee: sql<number>`(${payrollLineItems.employeeContributions}->>'cnps')::numeric`,
          cmuEmployee: sql<number>`(${payrollLineItems.employeeContributions}->>'cmu')::numeric`,
          its: sql<number>`(${payrollLineItems.taxDeductions}->>'its')::numeric`,
          employeeContributions: payrollLineItems.employeeContributions,
          taxDeductions: payrollLineItems.taxDeductions,
          otherDeductions: payrollLineItems.otherDeductions,
          // Employer costs
          cnpsEmployer: sql<number>`(${payrollLineItems.employerContributions}->>'cnps')::numeric`,
          cmuEmployer: sql<number>`(${payrollLineItems.employerContributions}->>'cmu')::numeric`,
          employerContributions: payrollLineItems.employerContributions,
          // Detailed breakdowns
          earningsDetails: payrollLineItems.earningsDetails,
          deductionsDetails: payrollLineItems.deductionsDetails,
          contributionDetails: payrollLineItems.contributionDetails, // Social security breakdown (Pension, AT, PF)
          // Other taxes (FDFP, ITS employer)
          totalOtherTaxes: payrollLineItems.totalOtherTaxes,
          otherTaxesDetails: payrollLineItems.otherTaxesDetails,
        })
        .from(payrollLineItems)
        .innerJoin(employees, eq(payrollLineItems.employeeId, employees.id))
        .where(eq(payrollLineItems.payrollRunId, input.runId))
        .orderBy(asc(employees.employeeNumber));

      return {
        ...run,
        employeeCount: lineItems.length,
        lineItems,
      };
    }),

  /**
   * Get payroll runs for a tenant
   *
   * Lists all payroll runs with optional filtering.
   *
   * @example
   * ```typescript
   * const runs = await trpc.payroll.listRuns.query({
   *   tenantId: 'tenant-123',
   *   status: 'calculated',
   * });
   * ```
   */
  listRuns: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(['draft', 'calculating', 'calculated', 'approved', 'paid', 'failed'])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      const tenantId = ctx.user.tenantId;

      const where = input.status
        ? [eq(payrollRuns.tenantId, tenantId), eq(payrollRuns.status, input.status)]
        : [eq(payrollRuns.tenantId, tenantId)];

      const runs = await db.query.payrollRuns.findMany({
        where: (table, { and }) => and(...where.map((w) => w)),
        orderBy: (table, { desc }) => [desc(table.periodStart)],
        limit: input.limit,
        offset: input.offset,
      });

      if (runs.length === 0) return [];

      // Single query to get employee counts for all runs at once (avoids N+1)
      const runIds = runs.map(r => r.id);
      const counts = await db
        .select({
          payrollRunId: payrollLineItems.payrollRunId,
          count: sql<number>`count(*)::int`,
        })
        .from(payrollLineItems)
        .where(inArray(payrollLineItems.payrollRunId, runIds))
        .groupBy(payrollLineItems.payrollRunId);

      const countMap = new Map(counts.map(c => [c.payrollRunId, c.count]));

      return runs.map(run => ({
        ...run,
        employeeCount: countMap.get(run.id) ?? 0,
      }));
    }),

  /**
   * Approve a payroll run
   *
   * Changes status from 'calculated' to 'approved'.
   * Only calculated runs can be approved.
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * await trpc.payroll.approveRun.mutate({
   *   runId: 'run-123',
   *   approvedBy: 'user-123',
   * });
   * ```
   */
  approveRun: hrManagerProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        approvedBy: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'processing' && run.status !== 'calculated') {
        throw new Error('Seules les paies calculées peuvent être approuvées');
      }

      const [updatedRun] = await db
        .update(payrollRuns)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: input.approvedBy,
        } as any)
        .where(eq(payrollRuns.id, input.runId))
        .returning();

      return updatedRun;
    }),

  /**
   * Delete a payroll run
   *
   * Soft deletes a payroll run (draft only).
   * Only draft runs can be deleted.
   * Requires: HR Manager role
   *
   * @example
   * ```typescript
   * await trpc.payroll.deleteRun.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  deleteRun: hrManagerProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'draft') {
        throw new Error('Seules les paies en brouillon peuvent être supprimées');
      }

      // Delete associated line items first
      await db
        .delete(payrollLineItems)
        .where(eq(payrollLineItems.payrollRunId, input.runId));

      // Delete the run
      await db
        .delete(payrollRuns)
        .where(eq(payrollRuns.id, input.runId));

      return { success: true };
    }),

  // ========================================
  // Multi-Country Configuration Procedures
  // ========================================

  /**
   * Get available countries for payroll
   *
   * Returns countries with active payroll configuration.
   * Used in payroll run creation form to show country selector.
   *
   * @example
   * ```typescript
   * const countries = await trpc.payroll.getAvailableCountries.query();
   * // countries = [
   * //   { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮', isActive: true },
   * //   { code: 'SN', name: 'Sénégal', flag: '🇸🇳', isActive: true },
   * //   ...
   * // ]
   * ```
   */
  getAvailableCountries: publicProcedure
    .query(async () => {
      // Query only countries that have tax systems configured
      // This avoids errors for countries without complete payroll config
      const countriesWithTaxSystems = await db
        .selectDistinct({ countryCode: taxSystems.countryCode })
        .from(taxSystems);

      const configuredCountryCodes = countriesWithTaxSystems.map(c => c.countryCode);

      // If no countries configured, return empty array
      if (configuredCountryCodes.length === 0) {
        return [];
      }

      // Load country details for countries with payroll config
      const allCountries = await db.query.countries.findMany({
        where: (countries, { eq, inArray: inArrayFn, and }) => and(
          eq(countries.isActive, true),
          inArrayFn(countries.code, configuredCountryCodes)
        ),
        orderBy: (countries, { asc }) => [asc(countries.code)],
      });

      // Map to response format
      const countriesWithConfig = allCountries.map(country => {
        const countryName = country.name as { fr: string; en?: string };
        return {
          code: country.code,
          name: countryName.fr,
          nameEn: countryName.en,
          currency: country.currencyCode,
          isActive: country.isActive,
        };
      });

      return countriesWithConfig;
    }),

  /**
   * Get family deduction rules for a country
   *
   * Returns available family deductions (fiscal parts) from database.
   * Used to populate calculator dropdowns dynamically.
   *
   * @example
   * ```typescript
   * const deductions = await trpc.payroll.getFamilyDeductions.query({
   *   countryCode: 'CI',
   * });
   * // deductions = [
   * //   { fiscalParts: 1.0, deductionAmount: 0, description: { fr: "1.0 - Célibataire" } },
   * //   { fiscalParts: 1.5, deductionAmount: 5500, description: { fr: "1.5 - Marié(e), 1 enfant" } },
   * //   ...
   * // ]
   * ```
   */
  getFamilyDeductions: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
        effectiveDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const effectiveDate = input.effectiveDate || new Date();

      try {
        const config = await ruleLoader.getCountryConfig(input.countryCode, effectiveDate);

        // Return family deductions if supported, empty array otherwise
        if (!config.taxSystem.supportsFamilyDeductions) {
          return [];
        }

        return config.taxSystem.familyDeductions.map((fd) => ({
          fiscalParts: fd.fiscalParts,
          deductionAmount: fd.deductionAmount,
          description: fd.description,
        }));
      } catch (error) {
        // Country not configured yet or no tax system
        return [];
      }
    }),

  /**
   * Get available export templates for a country
   *
   * Returns export templates (CNPS, CMU, bank transfers, etc.) from database.
   * Used to render export buttons dynamically in payroll run detail page.
   *
   * @example
   * ```typescript
   * const templates = await trpc.payroll.getAvailableExports.query({
   *   runId: 'run-123',
   * });
   * // templates = [
   * //   { id: '...', templateType: 'social_security', providerCode: 'cnps', providerName: 'CNPS' },
   * //   { id: '...', templateType: 'health', providerCode: 'cmu', providerName: 'CMU' },
   * //   ...
   * // ]
   * ```
   */
  getAvailableExports: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      // Get payroll run to determine country
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // For now, return hardcoded CI exports
      // TODO: Load from export_templates table when it's created
      const countryCode = 'CI'; // run.countryCode when field is added

      // Hardcoded CI exports (temporary until export_templates table exists)
      const ciExports = [
        {
          id: 'cnps',
          templateType: 'social_security',
          providerCode: 'cnps_ci',
          providerName: 'Appel à cotisation mensuel CNPS',
          fileFormat: 'xlsx',
        },
        {
          id: 'cmu',
          templateType: 'health',
          providerCode: 'cmu_ci',
          providerName: 'Déclaration cotisation mensuel CMU',
          fileFormat: 'xlsx',
        },
        {
          id: 'etat301',
          templateType: 'tax',
          providerCode: 'dgi_ci',
          providerName: 'Déclaration des impots sur les salaires mensuels',
          fileFormat: 'xlsx',
        },
        {
          id: 'bank_transfer',
          templateType: 'bank_transfer',
          providerCode: 'standard',
          providerName: 'Extraction pour paiement',
          fileFormat: 'xlsx',
        },
      ];

      return ciExports;
    }),

  // ========================================
  // Export Procedures
  // ========================================

  /**
   * Generate pay slip PDF for a single employee
   *
   * Generates a French-language bulletin de paie (pay slip) PDF.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.generatePayslip.mutate({
   *   runId: 'run-123',
   *   employeeId: 'emp-123',
   * });
   * // result.data = ArrayBuffer (PDF)
   * // result.filename = 'Bulletin_Paie_John_Doe_01_2025.pdf'
   * ```
   */
  generatePayslip: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        employeeId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      // Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // Get line item for employee
      const lineItem = await db.query.payrollLineItems.findFirst({
        where: (items, { and }) =>
          and(
            eq(items.payrollRunId, input.runId),
            eq(items.employeeId, input.employeeId)
          ),
      });

      if (!lineItem) {
        throw new Error('Employee not found in this payroll run');
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
      });

      // Get employee details
      const employee = await db.query.employees.findFirst({
        where: (employees, { eq }) => eq(employees.id, input.employeeId),
      });

      // Load country config for dynamic labels
      let countryConfig;
      try {
        const config = await ruleLoader.getCountryConfig(run.countryCode);

        // Map country config to payslip format
        const taxSystemName = typeof config.taxSystem.name === 'string' ? config.taxSystem.name : (config.taxSystem.name as any).fr;
        const socialSchemeName = typeof config.socialScheme.name === 'string' ? config.socialScheme.name : (config.socialScheme.name as any).fr;

        // Use stored contributionDetails if available, otherwise fall back to config
        const contributionDetails = lineItem.contributionDetails as any[] || [];
        const hasContributionDetails = contributionDetails.length > 0;

        // Group contributions by code to merge employee and employer into single rows
        const groupedContributions: Array<{
          code: string;
          name: string;
          employeeRate: number;
          employerRate: number;
          employeeAmount: number;
          employerAmount: number;
          base: number;
        }> = hasContributionDetails
          ? Object.values(
              contributionDetails.reduce((acc: any, contrib: any) => {
                const key = contrib.code;
                if (!acc[key]) {
                  acc[key] = {
                    code: contrib.code,
                    name: contrib.name,
                    employeeRate: 0,
                    employerRate: 0,
                    employeeAmount: 0,
                    employerAmount: 0,
                    base: contrib.base || parseFloat(lineItem.grossSalary?.toString() || '0'),
                  };
                }
                if (contrib.paidBy === 'employee') {
                  acc[key].employeeRate = contrib.rate || 0;
                  acc[key].employeeAmount = contrib.amount || 0;
                } else if (contrib.paidBy === 'employer') {
                  acc[key].employerRate = contrib.rate || 0;
                  acc[key].employerAmount = contrib.amount || 0;
                }
                return acc;
              }, {})
            )
          : [];

        countryConfig = {
          taxSystemName,
          socialSchemeName,
          laborCodeReference: undefined, // TODO: Add laborCodeReference to CountryConfig type
          contributions: hasContributionDetails
            ? groupedContributions
            : config.socialScheme.contributionTypes.map((contrib: any) => ({
                code: contrib.code,
                name: typeof contrib.name === 'string' ? contrib.name : contrib.name.fr,
                employeeRate: contrib.employeeRate,
                employerRate: contrib.employerRate,
                employeeAmount: contrib.code === 'pension'
                  ? parseFloat(lineItem.cnpsEmployee?.toString() || '0')
                  : contrib.code === 'health'
                  ? parseFloat(lineItem.cmuEmployee?.toString() || '0')
                  : 0,
                employerAmount: contrib.code === 'pension'
                  ? parseFloat(lineItem.cnpsEmployer?.toString() || '0')
                  : contrib.code === 'health'
                  ? parseFloat(lineItem.cmuEmployer?.toString() || '0')
                  : 0,
              })),
          otherTaxes: (() => {
            // Use stored other_taxes_details if available
            const otherTaxesDetails = lineItem.otherTaxesDetails as any[] || [];
            if (otherTaxesDetails.length > 0) {
              return otherTaxesDetails.map((tax: any) => ({
                code: tax.code,
                name: tax.name,
                paidBy: tax.paidBy || 'employer',
                amount: tax.amount || 0,
                rate: tax.rate,
              }));
            }
            // Fallback to config
            return config.otherTaxes.map((tax: any) => ({
              code: tax.code,
              name: typeof tax.name === 'string' ? tax.name : tax.name.fr,
              paidBy: tax.paidBy,
              amount: 0,
              rate: undefined,
            }));
          })(),
        };
      } catch (error) {
        // If country config not found, payslip will use fallback labels
        console.warn(`Country config not found for ${run.countryCode}, using fallback labels`);
      }

      // Extract allowances from JSONB field
      const allowancesData = lineItem.allowances as any || {};

      // Build components array from allowances breakdown
      const components = [];
      components.push({
        code: '11',
        name: 'Salaire de base',
        amount: parseFloat(lineItem.baseSalary?.toString() || '0'),
      });

      if (allowancesData.housing && allowancesData.housing > 0) {
        components.push({
          code: '23',
          name: 'Prime de logement',
          amount: allowancesData.housing,
        });
      }

      if (allowancesData.transport && allowancesData.transport > 0) {
        components.push({
          code: '22',
          name: 'Prime de transport',
          amount: allowancesData.transport,
        });
      }

      if (allowancesData.meal && allowancesData.meal > 0) {
        components.push({
          code: '24',
          name: 'Prime de panier',
          amount: allowancesData.meal,
        });
      }

      if (allowancesData.seniority && allowancesData.seniority > 0) {
        components.push({
          code: '21',
          name: 'Prime d\'ancienneté',
          amount: allowancesData.seniority,
        });
      }

      if (allowancesData.family && allowancesData.family > 0) {
        components.push({
          code: '41',
          name: 'Allocations familiales',
          amount: allowancesData.family,
        });
      }

      // Calculate YTD cumuls
      const ytdCumuls = await calculateYTDCumuls(
        input.employeeId,
        run.tenantId,
        new Date(run.periodEnd)
      );

      // Fetch leave data
      const absencesDuringPeriod = await fetchAbsencesDuringPeriod(
        input.employeeId,
        run.tenantId,
        new Date(run.periodStart),
        new Date(run.periodEnd)
      );

      const leaveBalances = await fetchLeaveBalances(
        input.employeeId,
        run.tenantId
      );

      // Extract company info from tenant settings
      const tenantSettings = tenant?.settings as any;
      const companyInfo = tenantSettings?.company || {};
      const legalInfo = tenantSettings?.legal || {};

      // Prepare payslip data
      const payslipData: PayslipData = {
        companyName: companyInfo?.legalName || tenant?.name || 'Company',
        companyAddress: companyInfo?.address || undefined,
        companyCNPS: legalInfo?.socialSecurityNumber || undefined,
        companyTaxId: legalInfo?.taxId || tenant?.taxId || undefined,
        employeeName: lineItem.employeeName || employee?.firstName + ' ' + employee?.lastName || 'Unknown',
        employeeNumber: lineItem.employeeNumber || employee?.employeeNumber || '',
        employeeCNPS: employee?.cnpsNumber || undefined,
        employeePosition: lineItem.positionTitle || undefined,
        employeeDepartment: employee?.division || employee?.section || employee?.service || undefined,
        employeeHireDate: employee?.hireDate ? new Date(employee.hireDate) : undefined,
        employeeContractType: employee?.contractType || undefined,

        // Bank and administrative details
        socialSecurityNumber: employee?.nationalId || undefined,
        iban: employee?.bankAccount || undefined,
        healthInsurance: undefined, // TODO: Add healthInsurance field to employees table
        pensionScheme: undefined, // TODO: Add pensionScheme field to employees table
        email: employee?.email || undefined,
        phone: employee?.phone || undefined,

        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        payDate: new Date(run.payDate),
        baseSalary: parseFloat(lineItem.baseSalary?.toString() || '0'),
        housingAllowance: allowancesData.housing || 0,
        transportAllowance: allowancesData.transport || 0,
        mealAllowance: allowancesData.meal || 0,
        seniorityBonus: allowancesData.seniority || 0,
        familyAllowance: allowancesData.family || 0,
        overtimePay: parseFloat(lineItem.overtimePay?.toString() || '0'),
        bonuses: parseFloat(lineItem.bonuses?.toString() || '0'),
        grossSalary: parseFloat(lineItem.grossSalary?.toString() || '0'),
        brutImposable: parseFloat(lineItem.brutImposable?.toString() || '0'),
        cnpsEmployee: parseFloat(lineItem.cnpsEmployee?.toString() || '0'),
        cmuEmployee: parseFloat(lineItem.cmuEmployee?.toString() || '0'),
        its: parseFloat(lineItem.its?.toString() || '0'),
        totalDeductions: parseFloat(lineItem.totalDeductions?.toString() || '0'),
        cnpsEmployer: parseFloat(lineItem.cnpsEmployer?.toString() || '0'),
        cmuEmployer: parseFloat(lineItem.cmuEmployer?.toString() || '0'),
        fdfp: parseFloat(lineItem.totalOtherTaxes?.toString() || '0'),
        totalEmployerContributions:
          parseFloat(lineItem.cnpsEmployer?.toString() || '0') +
          parseFloat(lineItem.cmuEmployer?.toString() || '0') +
          parseFloat(lineItem.totalOtherTaxes?.toString() || '0'),
        netSalary: parseFloat(lineItem.netSalary?.toString() || '0'),
        paymentMethod: lineItem.paymentMethod,
        bankAccount: lineItem.bankAccount || undefined,
        daysWorked: parseFloat(lineItem.daysWorked?.toString() || '0'),
        components: components.length > 0 ? components : undefined,
        countryConfig,
        ytdGross: ytdCumuls.ytdGross,
        ytdTaxableNet: ytdCumuls.ytdTaxableNet,
        ytdNetPaid: ytdCumuls.ytdNetPaid,

        // Leave data
        absencesDuringPeriod: absencesDuringPeriod.length > 0 ? absencesDuringPeriod : undefined,
        leaveBalances: Object.keys(leaveBalances).length > 0 ? leaveBalances : undefined,
      };

      // Generate PDF (lazy load renderer)
      const { renderToBuffer } = await import('@react-pdf/renderer');
      const pdfBuffer = await renderToBuffer(
        React.createElement(PayslipDocument, { data: payslipData }) as any
      );
      const filename = generatePayslipFilename(payslipData.employeeName, new Date(run.periodStart));

      return {
        data: Buffer.from(pdfBuffer).toString('base64'),
        filename,
        contentType: 'application/pdf',
      };
    }),

  /**
   * Generate bulk payslips for all employees in a payroll run
   *
   * Generates a ZIP file containing individual PDF payslips for all employees
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.generateBulkPayslips.mutate({
   *   runId: 'run-123',
   * });
   * // result.data = ArrayBuffer (ZIP file)
   * // result.filename = 'Bulletins_Paie_01_2025.zip'
   * ```
   */
  generateBulkPayslips: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      const JSZip = (await import('jszip')).default;

      // Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // Get all line items
      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
      });

      if (lineItems.length === 0) {
        throw new Error('Aucun employé trouvé dans cette paie');
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
      });

      // Extract company info from tenant settings
      const tenantSettings = tenant?.settings as any;
      const companyInfo = tenantSettings?.company || {};
      const legalInfo = tenantSettings?.legal || {};

      // Get all employees
      const employeeIds = lineItems.map(item => item.employeeId);
      const employeesList = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, employeeIds),
      });
      const employeeMap = new Map(employeesList.map(emp => [emp.id, emp]));

      // Load country config for dynamic labels
      let countryConfig;
      try {
        const config = await ruleLoader.getCountryConfig(run.countryCode);

        // Map country config to payslip format
        const taxSystemName = typeof config.taxSystem.name === 'string' ? config.taxSystem.name : (config.taxSystem.name as any).fr;
        const socialSchemeName = typeof config.socialScheme.name === 'string' ? config.socialScheme.name : (config.socialScheme.name as any).fr;

        countryConfig = {
          taxSystemName,
          socialSchemeName,
          laborCodeReference: undefined, // TODO: Add laborCodeReference to CountryConfig type
          contributions: config.socialScheme.contributionTypes.map((contrib: any) => ({
            code: contrib.code,
            name: typeof contrib.name === 'string' ? contrib.name : contrib.name.fr,
            employeeRate: contrib.employeeRate,
            employerRate: contrib.employerRate,
          })),
          otherTaxes: config.otherTaxes.map((tax: any) => ({
            code: tax.code,
            name: typeof tax.name === 'string' ? tax.name : tax.name.fr,
            paidBy: tax.paidBy,
          })),
        };
      } catch (error) {
        // If country config not found, payslip will use fallback labels
        console.warn(`Country config not found for ${run.countryCode}, using fallback labels`);
      }

      // Create ZIP
      const zip = new JSZip();

      // Generate payslip for each employee
      for (const lineItem of lineItems) {
        const employee = employeeMap.get(lineItem.employeeId);

        if (!employee) continue;

        // Extract allowances from JSONB field
        const allowancesData = lineItem.allowances as any || {};

        // Build components array from allowances breakdown
        const components = [];
        components.push({
          code: '11',
          name: 'Salaire de base',
          amount: parseFloat(lineItem.baseSalary?.toString() || '0'),
        });

        if (allowancesData.housing && allowancesData.housing > 0) {
          components.push({
            code: '23',
            name: 'Prime de logement',
            amount: allowancesData.housing,
          });
        }

        if (allowancesData.transport && allowancesData.transport > 0) {
          components.push({
            code: '22',
            name: 'Prime de transport',
            amount: allowancesData.transport,
          });
        }

        if (allowancesData.meal && allowancesData.meal > 0) {
          components.push({
            code: '24',
            name: 'Prime de panier',
            amount: allowancesData.meal,
          });
        }

        if (allowancesData.seniority && allowancesData.seniority > 0) {
          components.push({
            code: '21',
            name: 'Prime d\'ancienneté',
            amount: allowancesData.seniority,
          });
        }

        if (allowancesData.family && allowancesData.family > 0) {
          components.push({
            code: '41',
            name: 'Allocations familiales',
            amount: allowancesData.family,
          });
        }

        // Fetch leave data
        const absencesDuringPeriod = await fetchAbsencesDuringPeriod(
          lineItem.employeeId,
          run.tenantId,
          new Date(run.periodStart),
          new Date(run.periodEnd)
        );

        const leaveBalances = await fetchLeaveBalances(
          lineItem.employeeId,
          run.tenantId
        );

        const payslipData: PayslipData = {
          employeeName: lineItem.employeeName || '',
          employeeNumber: lineItem.employeeNumber || '',
          employeePosition: lineItem.positionTitle || '',
          employeeDepartment: employee?.division || employee?.section || employee?.service || undefined,
          employeeHireDate: employee?.hireDate ? new Date(employee.hireDate) : undefined,
          employeeContractType: employee?.contractType || undefined,

          // Bank and administrative details
          socialSecurityNumber: employee?.nationalId || undefined,
          iban: employee?.bankAccount || undefined,
          healthInsurance: undefined, // TODO: Add healthInsurance field to employees table
          pensionScheme: undefined, // TODO: Add pensionScheme field to employees table
          email: employee?.email || undefined,
          phone: employee?.phone || undefined,

          companyName: companyInfo?.legalName || tenant?.name || '',
          companyAddress: companyInfo?.address || undefined,
          companyCNPS: legalInfo?.socialSecurityNumber || undefined,
          companyTaxId: legalInfo?.taxId || tenant?.taxId || undefined,
          employeeCNPS: employee?.cnpsNumber || undefined,
          periodStart: new Date(run.periodStart),
          periodEnd: new Date(run.periodEnd),
          payDate: new Date(run.payDate),
          baseSalary: parseFloat(lineItem.baseSalary?.toString() || '0'),
          housingAllowance: allowancesData.housing || 0,
          transportAllowance: allowancesData.transport || 0,
          mealAllowance: allowancesData.meal || 0,
          seniorityBonus: allowancesData.seniority || 0,
          familyAllowance: allowancesData.family || 0,
          overtimePay: parseFloat(lineItem.overtimePay?.toString() || '0'),
          bonuses: parseFloat(lineItem.bonuses?.toString() || '0'),
          grossSalary: parseFloat(lineItem.grossSalary?.toString() || '0'),
          netSalary: parseFloat(lineItem.netSalary?.toString() || '0'),
          cnpsEmployee: parseFloat(lineItem.cnpsEmployee?.toString() || '0'),
          cnpsEmployer: parseFloat(lineItem.cnpsEmployer?.toString() || '0'),
          cmuEmployee: parseFloat(lineItem.cmuEmployee?.toString() || '0'),
          cmuEmployer: parseFloat(lineItem.cmuEmployer?.toString() || '0'),
          its: parseFloat(lineItem.its?.toString() || '0'),
          totalDeductions: parseFloat(lineItem.totalDeductions?.toString() || '0'),
          daysWorked: parseFloat(lineItem.daysWorked?.toString() || '0'),
          paymentMethod: lineItem.paymentMethod,
          bankAccount: lineItem.bankAccount || undefined,
          components: components.length > 0 ? components : undefined,
          countryConfig,

          // Leave data
          absencesDuringPeriod: absencesDuringPeriod.length > 0 ? absencesDuringPeriod : undefined,
          leaveBalances: Object.keys(leaveBalances).length > 0 ? leaveBalances : undefined,
        };

        // Generate PDF (lazy load renderer)
        const { renderToBuffer } = await import('@react-pdf/renderer');
        const pdfBuffer = await renderToBuffer(
          React.createElement(PayslipDocument, { data: payslipData }) as any
        );
        const filename = generatePayslipFilename(payslipData.employeeName, new Date(run.periodStart));

        zip.file(filename, pdfBuffer);
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Generate filename
      const period = new Date(run.periodStart);
      const month = String(period.getMonth() + 1).padStart(2, '0');
      const year = period.getFullYear();
      const zipFilename = `Bulletins_Paie_${month}_${year}.zip`;

      return {
        data: Buffer.from(zipBuffer).toString('base64'),
        filename: zipFilename,
        contentType: 'application/zip',
      };
    }),

  /**
   * Export CNPS declaration Excel file
   *
   * Generates Excel file for CNPS portal submission.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportCNPS.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  exportCNPS: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      // Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // Get line items
      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
      });

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
      });

      // Extract company info from tenant settings
      const tenantSettings = tenant?.settings as any;
      const companyInfo = tenantSettings?.company || {};
      const legalInfo = tenantSettings?.legal || {};

      // Get employees with all required fields for CNPS export
      const employeeIds = lineItems.map((item) => item.employeeId);
      const employees = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, employeeIds),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          cnpsNumber: true,
          dateOfBirth: true,
          hireDate: true,
          terminationDate: true,
          salaryRegime: true,
          contractType: true,
        },
      });

      const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

      // Prepare export data using new CNPS declaration format
      const exportData: CNPSExportData = {
        companyName: companyInfo?.legalName || tenant?.name || 'Company',
        companyCNPS: legalInfo?.socialSecurityNumber || tenant?.taxId || undefined,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        employees: lineItems.map((item) => {
          const employee = employeeMap.get(item.employeeId);
          if (!employee) {
            throw new Error(`Employee not found for line item: ${item.id}`);
          }

          return {
            // Employee identification
            cnpsNumber: employee.cnpsNumber || '',
            firstName: employee.firstName,
            lastName: employee.lastName,

            // Personal information
            dateOfBirth: employee.dateOfBirth,

            // Employment dates
            hireDate: employee.hireDate,
            terminationDate: employee.terminationDate,

            // Employment classification
            salaryRegime: employee.salaryRegime,
            contractType: employee.contractType,

            // Payroll data
            daysWorked: item.daysWorked ? parseFloat(item.daysWorked.toString()) : null,
            hoursWorked: item.hoursWorked ? parseFloat(item.hoursWorked.toString()) : null,
            grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
          };
        }),
      };

      // Debug logging
      console.log('[CNPS Export] Total employees:', exportData.employees.length);
      console.log('[CNPS Export] Employees with CNPS numbers:', exportData.employees.filter(e => e.cnpsNumber).length);
      console.log('[CNPS Export] Sample employee:', exportData.employees[0]);

      // Generate Excel
      const excelBuffer = generateCNPSExcel(exportData);
      const filename = generateCNPSFilename(new Date(run.periodStart));

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Export CMU Beneficiary declaration file
   *
   * Generates Excel file with one row per beneficiary (spouse/child) for CMU registration.
   * Format per CNPS requirements.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportCMU.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  exportCMU: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // 2. Get line items
      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
        orderBy: [asc(payrollLineItems.employeeName)],
      });

      if (lineItems.length === 0) {
        throw new Error('No employees found in this payroll run');
      }

      // 3. Get all employees with full details
      const employeeIds = lineItems.map((item) => item.employeeId);
      const employeesList = await db.query.employees.findMany({
        where: inArray(employees.id, employeeIds),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          cnpsNumber: true,
          cmuNumber: true,
        },
      });

      // 4. Get all CMU-eligible dependents for these employees
      const allDependents = await db.query.employeeDependents.findMany({
        where: and(
          inArray(employeeDependents.employeeId, employeeIds),
          eq(employeeDependents.status, 'active'),
          eq(employeeDependents.eligibleForCmu, true)
        ),
        orderBy: [
          asc(employeeDependents.employeeId),
          asc(employeeDependents.relationship),
          asc(employeeDependents.dateOfBirth),
        ],
      });

      // 5. Build beneficiary rows — pre-index dependents by employeeId (avoids O(N²) filter)
      const beneficiaryRows: CMUBeneficiaryRow[] = [];
      const dependentsByEmployee = new Map<string, typeof allDependents>();
      for (const dep of allDependents) {
        const list = dependentsByEmployee.get(dep.employeeId) ?? [];
        list.push(dep);
        dependentsByEmployee.set(dep.employeeId, list);
      }

      for (const employee of employeesList) {
        const employeeDeps = dependentsByEmployee.get(employee.id) ?? [];

        // Employee base data (repeated on each row)
        const employeeData = {
          employeeCnpsNumber: employee.cnpsNumber || '',
          employeeSocialSecurityNumber: employee.cmuNumber || '',
          employeeLastName: employee.lastName || '',
          employeeFirstName: employee.firstName || '',
          employeeDateOfBirth: formatCNPSDate(employee.dateOfBirth),
        };

        if (employeeDeps.length === 0) {
          // Employee with no dependents - single row with empty beneficiary columns
          beneficiaryRows.push({
            ...employeeData,
            beneficiaryCnpsNumber: '',
            beneficiarySocialSecurityNumber: '',
            beneficiaryType: '',
            beneficiaryLastName: '',
            beneficiaryFirstName: '',
            beneficiaryDateOfBirth: '',
            beneficiaryGender: '',
          });
        } else {
          // Employee with dependents - one row per dependent
          for (const dep of employeeDeps) {
            beneficiaryRows.push({
              ...employeeData,
              beneficiaryCnpsNumber: dep.cnpsNumber || '',
              beneficiarySocialSecurityNumber: dep.cmuNumber || '',
              beneficiaryType: mapRelationshipToType(dep.relationship || ''),
              beneficiaryLastName: dep.lastName || '',
              beneficiaryFirstName: dep.firstName || '',
              beneficiaryDateOfBirth: formatCNPSDate(dep.dateOfBirth),
              beneficiaryGender: mapGenderCode(dep.gender),
            });
          }
        }
      }

      // 6. Get tenant/company info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, run.tenantId),
      });

      // 7. Generate Excel file
      const result = await generateCMUBeneficiaryExport({
        beneficiaryRows,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        companyName: tenant?.name || 'Entreprise',
        totalEmployees: employeesList.length,
        totalBeneficiaries: allDependents.length,
      });

      return {
        data: result.data.toString('base64'),
        filename: result.filename,
        contentType: result.contentType,
      };
    }),

  /**
   * Export État 301 (tax declaration) file
   *
   * Generates Excel file for DGI portal submission.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportEtat301.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  exportEtat301: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      // Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // Get line items
      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
      });

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
      });

      // Prepare export data
      const exportData: Etat301ExportData = {
        companyName: tenant?.name || 'Company',
        companyTaxId: tenant?.taxId || undefined,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        employees: lineItems.map((item) => ({
          employeeName: item.employeeName || '',
          employeeNumber: item.employeeNumber || '',
          grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
          cnpsEmployee: parseFloat(item.cnpsEmployee?.toString() || '0'),
          cmuEmployee: parseFloat(item.cmuEmployee?.toString() || '0'),
          taxableIncome:
            parseFloat(item.grossSalary?.toString() || '0') -
            parseFloat(item.cnpsEmployee?.toString() || '0') -
            parseFloat(item.cmuEmployee?.toString() || '0'),
          its: parseFloat(item.its?.toString() || '0'),
        })),
      };

      // Generate Excel
      const excelBuffer = generateEtat301Excel(exportData);
      const filename = generateEtat301Filename(new Date(run.periodStart));

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Export bank transfer file
   *
   * Generates bank transfer file (Excel format).
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportBankTransfer.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  exportBankTransfer: publicProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      // Get payroll run
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      if (run.status !== 'approved' && run.status !== 'paid') {
        throw new Error('Seules les paies approuvées peuvent être exportées');
      }

      // Get line items
      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
      });

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
      });

      // Get employee details (including phone numbers and bank info)
      const employeeIds = lineItems.map((item) => item.employeeId);
      const employees = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, employeeIds),
      });

      // Create a map for quick lookup
      const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

      // Prepare export data with phone numbers and bank details
      const exportData: BankTransferExportData = {
        companyName: tenant?.name || 'Company',
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        payDate: new Date(run.payDate),
        employees: lineItems.map((item) => {
          const employee = employeeMap.get(item.employeeId);

          // Construct employee name from employee record, fallback to line item
          const employeeName = employee
            ? `${employee.firstName} ${employee.lastName}`.trim()
            : (item.employeeName || '');

          // Get employee number from employee record, fallback to line item
          const employeeNumber = employee?.employeeNumber || item.employeeNumber || '';

          return {
            employeeName,
            employeeNumber,
            bankAccount: employee?.bankAccount || item.bankAccount || null,
            netSalary: parseFloat(item.netSalary?.toString() || '0'),
            paymentReference: item.paymentReference || undefined,
            phoneNumber: employee?.phone || '',
          };
        }),
      };

      // Generate Excel
      const excelBuffer = generateBankTransferExcel(exportData);
      const filename = generateBankTransferFilename(new Date(run.periodStart), 'excel');

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  // ========================================
  // Monthly Consolidation Endpoints
  // ========================================

  /**
   * Get monthly payroll summary
   *
   * Returns all approved/paid runs for a month plus aggregated employee data.
   * Used for monthly reports page.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.getMonthlyPayrollSummary.query({
   *   month: '2025-01',
   * });
   * ```
   */
  getMonthlyPayrollSummary: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format requis: YYYY-MM'),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const result = await aggregateMonthlyPayrollData(tenantId, input.month);

      // Single query to get employee counts for all runs (avoids N+1)
      const runIds = result.runs.map(r => r.id);
      const counts = runIds.length > 0
        ? await db
            .select({
              payrollRunId: payrollLineItems.payrollRunId,
              count: sql<number>`count(*)::int`,
            })
            .from(payrollLineItems)
            .where(inArray(payrollLineItems.payrollRunId, runIds))
            .groupBy(payrollLineItems.payrollRunId)
        : [];

      const countMap = new Map(counts.map(c => [c.payrollRunId, c.count]));
      const runsWithCounts = result.runs.map(run => ({
        ...run,
        employeeCount: countMap.get(run.id) ?? 0,
      }));

      return {
        month: input.month,
        runs: runsWithCounts,
        employeeCount: result.employees.length,
        totalGross: result.employees.reduce((sum, emp) => sum + emp.grossSalary, 0),
        totalNet: result.employees.reduce((sum, emp) => sum + emp.netSalary, 0),
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
      };
    }),

  /**
   * Export monthly CNPS declaration
   *
   * Consolidates all approved/paid runs for the month.
   * Critical for CDDTI employees with multiple runs per month.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportCNPSMonthly.mutate({
   *   month: '2025-01',
   * });
   * ```
   */
  exportCNPSMonthly: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format requis: YYYY-MM'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const result = await aggregateMonthlyPayrollData(tenantId, input.month);

      if (result.employees.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aucune paie approuvée trouvée pour ce mois',
        });
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, tenantId),
      });

      // Prepare export data with monthly aggregated totals
      const exportData: CNPSExportData = {
        companyName: tenant?.name || 'Company',
        companyCNPS: tenant?.taxId || undefined,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        employees: result.employees.map((emp) => ({
          cnpsNumber: emp.cnpsNumber || '',
          firstName: emp.employeeName.split(' ').slice(1).join(' ') || emp.employeeName,
          lastName: emp.employeeName.split(' ')[0] || emp.employeeName,
          dateOfBirth: emp.dateOfBirth,
          hireDate: emp.hireDate,
          terminationDate: emp.terminationDate,
          salaryRegime: emp.salaryRegime,
          contractType: emp.contractType,
          daysWorked: emp.daysWorked, // Monthly total - CRITICAL for CDDTI 21-day rule
          hoursWorked: emp.hoursWorked, // Monthly total
          grossSalary: emp.grossSalary,
        })),
      };

      // Generate Excel
      const excelBuffer = generateCNPSExcel(exportData);
      const filename = generateCNPSFilename(result.periodStart);

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Export monthly CMU beneficiary declaration
   *
   * Consolidates all approved/paid runs for the month.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportCMUMonthly.mutate({
   *   month: '2025-01',
   * });
   * ```
   */
  exportCMUMonthly: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format requis: YYYY-MM'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const result = await aggregateMonthlyPayrollData(tenantId, input.month);

      if (result.employees.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aucune paie approuvée trouvée pour ce mois',
        });
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, tenantId),
      });

      // Fetch dependents for all employees
      const employeeIds = result.employees.map(emp => emp.employeeId);
      const dependents = await db.query.employeeDependents.findMany({
        where: (employeeDependents, { inArray, and, eq }) =>
          and(
            inArray(employeeDependents.employeeId, employeeIds),
            eq(employeeDependents.tenantId, tenantId)
          ),
      });

      // Create rows (one per beneficiary) — pre-index dependents by employeeId (avoids O(N²) filter)
      const beneficiaryRows: CMUBeneficiaryRow[] = [];
      const dependentsByEmployee = new Map<string, typeof dependents>();
      for (const dep of dependents) {
        const list = dependentsByEmployee.get(dep.employeeId) ?? [];
        list.push(dep);
        dependentsByEmployee.set(dep.employeeId, list);
      }

      for (const emp of result.employees) {
        const employeeDependents = dependentsByEmployee.get(emp.employeeId) ?? [];

        if (employeeDependents.length === 0) {
          // Employee without beneficiaries - one row with empty beneficiary columns
          beneficiaryRows.push({
            employeeCnpsNumber: emp.cnpsNumber || '',
            employeeSocialSecurityNumber: emp.cnpsNumber || '', // Same as CNPS for now
            employeeLastName: emp.employeeName.split(' ')[0] || emp.employeeName,
            employeeFirstName: emp.employeeName.split(' ').slice(1).join(' ') || emp.employeeName,
            employeeDateOfBirth: formatCNPSDate(emp.dateOfBirth),
            beneficiaryCnpsNumber: '',
            beneficiarySocialSecurityNumber: '',
            beneficiaryType: '',
            beneficiaryLastName: '',
            beneficiaryFirstName: '',
            beneficiaryDateOfBirth: '',
            beneficiaryGender: '',
          });
        } else {
          // One row per beneficiary
          for (const dependent of employeeDependents) {
            beneficiaryRows.push({
              employeeCnpsNumber: emp.cnpsNumber || '',
              employeeSocialSecurityNumber: emp.cnpsNumber || '',
              employeeLastName: emp.employeeName.split(' ')[0] || emp.employeeName,
              employeeFirstName: emp.employeeName.split(' ').slice(1).join(' ') || emp.employeeName,
              employeeDateOfBirth: formatCNPSDate(emp.dateOfBirth),
              beneficiaryCnpsNumber: '',
              beneficiarySocialSecurityNumber: '',
              beneficiaryType: mapRelationshipToType(dependent.relationship || 'child'),
              beneficiaryLastName: dependent.lastName || '',
              beneficiaryFirstName: dependent.firstName || '',
              beneficiaryDateOfBirth: formatCNPSDate(dependent.dateOfBirth),
              beneficiaryGender: mapGenderCode(dependent.gender),
            });
          }
        }
      }

      const exportData = {
        beneficiaryRows,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        companyName: tenant?.name || 'Company',
        totalEmployees: result.employees.length,
        totalBeneficiaries: dependents.length,
      };

      // Generate Excel
      const exportResult = await generateCMUBeneficiaryExport(exportData);

      return {
        data: exportResult.data.toString('base64'),
        filename: exportResult.filename,
        contentType: exportResult.contentType,
      };
    }),

  /**
   * Export monthly État 301 (tax declaration)
   *
   * Consolidates all approved/paid runs for the month.
   *
   * @example
   * ```typescript
   * const result = await trpc.payroll.exportEtat301Monthly.mutate({
   *   month: '2025-01',
   * });
   * ```
   */
  exportEtat301Monthly: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Format requis: YYYY-MM'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const result = await aggregateMonthlyPayrollData(tenantId, input.month);

      if (result.employees.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aucune paie approuvée trouvée pour ce mois',
        });
      }

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: (tenants, { eq }) => eq(tenants.id, tenantId),
      });

      // Prepare export data with monthly aggregated totals
      const exportData: Etat301ExportData = {
        companyName: tenant?.name || 'Company',
        companyTaxId: tenant?.taxId || undefined,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        employees: result.employees.map((emp) => ({
          employeeName: emp.employeeName,
          employeeNumber: emp.employeeNumber,
          grossSalary: emp.grossSalary,
          cnpsEmployee: emp.cnpsEmployee,
          cmuEmployee: emp.cmuEmployee,
          taxableIncome: emp.taxableIncome,
          its: emp.its,
        })),
      };

      // Generate Excel
      const excelBuffer = generateEtat301Excel(exportData);
      const filename = generateEtat301Filename(result.periodStart);

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Get employee payslips (P0-2: Employee self-service)
   * Returns all finalized payslips for the given employee
   * Requires: Employee role (employees view their own payslips)
   */
  getEmployeePayslips: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { payslips } = await import('@/drizzle/schema');
      const { desc } = await import('drizzle-orm');

      // Employees can only view their own payslips
      // Managers/HR/Admin can view any payslips (role check handled by procedure)
      const isOwnPayslips = ctx.user.employeeId === input.employeeId;
      const canViewAnyPayslips = ['manager', 'hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);

      if (!isOwnPayslips && !canViewAnyPayslips) {
        throw new Error('Vous ne pouvez consulter que vos propres bulletins de paie');
      }

      // Fetch all finalized/paid payslips for the employee
      const employeePayslips = await db.query.payslips.findMany({
        where: (payslips, { and, eq, inArray }) =>
          and(
            eq(payslips.employeeId, input.employeeId),
            eq(payslips.tenantId, ctx.user.tenantId),
            inArray(payslips.status, ['finalized', 'paid'])
          ),
        orderBy: [desc(payslips.periodStart)],
      });

      return employeePayslips;
    }),

  /**
   * Get payroll dashboard summary (P1-7: Payroll Reports Dashboard)
   * Aggregates payroll metrics for a given date range
   * Requires: HR Manager role
   */
  getDashboardSummary: hrManagerProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { payslips } = await import('@/drizzle/schema');
      const { gte, lte, and, eq, sum, count } = await import('drizzle-orm');

      // Default to current month if no dates provided
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startDate = input.startDate || defaultStart;
      const endDate = input.endDate || defaultEnd;

      // Format dates as YYYY-MM-DD strings for comparison with date columns
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Query payslips within date range and tenant
      // Using raw SQL for aggregation since Drizzle's aggregate API is limited
      const result = await db.execute(sql`
        SELECT
          COUNT(DISTINCT employee_id)::int AS employee_count,
          COALESCE(SUM(gross_salary::numeric), 0) AS total_gross,
          COALESCE(SUM(net_salary::numeric), 0) AS total_net,
          COALESCE(SUM(employer_contributions::numeric), 0) AS total_employer_contributions
        FROM payslips
        WHERE tenant_id = ${ctx.user.tenantId}
          AND period_start >= ${startDateStr}::date
          AND period_end <= ${endDateStr}::date
          AND status IN ('finalized', 'paid')
      `);

      const row = (result as any).rows?.[0] as any;

      const employeeCount = parseInt(row.employee_count) || 0;
      const totalGross = parseFloat(row.total_gross) || 0;
      const totalNet = parseFloat(row.total_net) || 0;
      const totalEmployerContributions = parseFloat(row.total_employer_contributions) || 0;

      return {
        employeeCount,
        totalGross,
        totalNet,
        totalEmployerContributions,
        avgCostPerEmployee: employeeCount > 0 ? (totalGross + totalEmployerContributions) / employeeCount : 0,
        periodStart: startDate,
        periodEnd: endDate,
      };
    }),

  /**
   * Get CNPS Monthly Contribution Declaration Data
   *
   * Aggregates payroll data for a specified month to generate the official
   * CNPS contribution declaration form.
   *
   * @security Tenant isolated - uses ctx.user.tenantId
   */
  getCNPSDeclarationData: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
        countryCode: z.string().length(2),
        cnpsFilter: z.enum(['all', 'with_cnps', 'without_cnps']).optional().default('all'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { month, year, countryCode, cnpsFilter } = input;
      const tenantId = ctx.user.tenantId;

      // Import the calculator service
      const { generateCNPSDeclaration } = await import(
        '@/features/payroll/services/cnps-contribution-calculator'
      );

      // Generate declaration data
      const declarationData = await generateCNPSDeclaration({
        tenantId,
        month,
        year,
        countryCode,
        cnpsFilter,
      });

      // Check if user has made any edits for this period
      const existingEdit = await db.query.cnpsDeclarationEdits.findFirst({
        where: and(
          eq(cnpsDeclarationEdits.tenantId, tenantId),
          eq(cnpsDeclarationEdits.month, month),
          eq(cnpsDeclarationEdits.year, year),
          eq(cnpsDeclarationEdits.countryCode, countryCode),
        ),
        orderBy: desc(cnpsDeclarationEdits.createdAt),
      });

      return {
        data: declarationData,
        hasEdits: !!existingEdit,
        lastEdit: existingEdit
          ? {
              id: existingEdit.id,
              edits: existingEdit.edits,
              editReason: existingEdit.editReason,
              editedAt: existingEdit.editedAt,
              editedBy: existingEdit.editedBy,
            }
          : null,
      };
    }),

  /**
   * Save CNPS Declaration Edits
   *
   * Stores user modifications to the automatically calculated declaration.
   * Creates an audit trail of all changes.
   *
   * @security Tenant isolated - uses ctx.user.tenantId
   */
  saveCNPSDeclarationEdits: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
        countryCode: z.string().length(2),
        originalData: z.any(), // Complete CNPSDeclarationData
        edits: z.any(), // Modified fields only
        editReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { month, year, countryCode, originalData, edits, editReason } = input;
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      // Insert new edit record
      const [newEdit] = await db
        .insert(cnpsDeclarationEdits)
        .values({
          tenantId,
          month,
          year,
          countryCode,
          originalData,
          edits,
          editReason: editReason || null,
          editedBy: userId,
          editedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        editId: newEdit.id,
        message: 'Modifications enregistrées avec succès',
      };
    }),

  /**
   * Export CNPS Declaration as PDF
   *
   * Generates a PDF matching the official CNPS contribution form format.
   * Uses edited data if available, otherwise uses calculated data.
   *
   * @security Tenant isolated - uses ctx.user.tenantId
   * @returns Base64-encoded PDF
   */
  exportCNPSDeclarationPDF: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
        countryCode: z.string().length(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { month, year, countryCode } = input;
      const tenantId = ctx.user.tenantId;

      // Get declaration data (with edits if available)
      const { generateCNPSDeclaration } = await import(
        '@/features/payroll/services/cnps-contribution-calculator'
      );

      let declarationData = await generateCNPSDeclaration({
        tenantId,
        month,
        year,
        countryCode,
      });

      // Check for user edits
      const existingEdit = await db.query.cnpsDeclarationEdits.findFirst({
        where: and(
          eq(cnpsDeclarationEdits.tenantId, tenantId),
          eq(cnpsDeclarationEdits.month, month),
          eq(cnpsDeclarationEdits.year, year),
          eq(cnpsDeclarationEdits.countryCode, countryCode),
        ),
        orderBy: desc(cnpsDeclarationEdits.createdAt),
      });

      // Apply edits if they exist
      if (existingEdit && existingEdit.edits) {
        const edits = existingEdit.edits as any;
        // Deep merge edits into declarationData
        declarationData = {
          ...declarationData,
          ...edits,
        };
      }

      // Generate PDF
      const { generateCNPSDeclarationPDF } = await import('@/lib/pdf/cnps-declaration-pdf');
      const pdfBuffer = await generateCNPSDeclarationPDF(declarationData);

      // Convert to base64
      const pdfBase64 = pdfBuffer.toString('base64');

      return {
        filename: `declaration-cnps-${year}-${String(month).padStart(2, '0')}.pdf`,
        content: pdfBase64,
        mimeType: 'application/pdf',
      };
    }),

  /**
   * Download Historical Payroll Template
   *
   * Generates an Excel template for historical payroll import.
   * Template includes all fields needed for payroll_runs and payroll_line_items.
   *
   * @security Tenant isolated - uses ctx.user.tenantId
   * @returns Base64-encoded Excel file
   */
  downloadHistoricalTemplate: protectedProcedure.mutation(async ({ ctx }) => {
    const { generatePayrollImportTemplate } = await import('@/scripts/generate-payroll-import-template');
    const buffer = generatePayrollImportTemplate();
    const base64 = buffer.toString('base64');

    return {
      filename: 'template_import_paie_historique.xlsx',
      content: base64,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }),

  /**
   * Upload Historical Payroll File
   *
   * Parses and validates uploaded Excel file.
   * Returns preview of payroll runs and line items with warnings.
   *
   * @security Tenant isolated - validates employee IDs belong to ctx.user.tenantId
   * @returns Preview data with warnings
   */
  uploadHistoricalPayroll: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded file
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const { fileData, fileName } = input;

      // Parse Excel file
      const { parsePayrollImportFile } = await import('@/lib/payroll-import/parser');
      const parseResult = await parsePayrollImportFile(fileData);

      // Validate that all employees exist (blocking errors)
      const { validateEmployeesExist } = await import('@/lib/payroll-import/import-service');
      const validationErrors = await validateEmployeesExist(parseResult.runs, tenantId);

      // Update summary with error count
      parseResult.summary.errorCount = validationErrors.length;

      return {
        success: true,
        runs: parseResult.runs,
        warnings: parseResult.warnings,
        validationErrors,
        summary: parseResult.summary,
      };
    }),

  /**
   * Import Historical Payroll
   *
   * Executes the import of historical payroll runs and line items.
   * Creates payroll_runs with status='approved' and payment_status='paid'.
   *
   * @security Tenant isolated - uses ctx.user.tenantId
   * @returns Import result with created run IDs
   */
  importHistoricalPayroll: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded file
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;
      const { fileData } = input;

      // Parse file again (to get fresh data)
      const { parsePayrollImportFile } = await import('@/lib/payroll-import/parser');
      const parseResult = await parsePayrollImportFile(fileData);

      // Execute import
      const { importHistoricalPayroll } = await import('@/lib/payroll-import/import-service');
      const importResult = await importHistoricalPayroll(
        parseResult.runs,
        tenantId,
        userId
      );

      if (!importResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: importResult.message,
        });
      }

      return importResult;
    }),
});
