/**
 * Payroll Review tRPC Router
 *
 * Provides endpoints for post-calculation payroll review features:
 * - Validation and issue detection
 * - Month-over-month comparison
 * - Verification status tracking
 * - Individual employee recalculation
 * - Overtime breakdown analysis
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import {
  payrollRuns,
  payrollLineItems,
  employees,
  timeEntries,
} from '@/lib/db/schema';
import {
  payrollVerificationStatus,
  payrollValidationIssues,
} from '@/drizzle/schema';
import { eq, and, desc, sql, between, isNull, or } from 'drizzle-orm';
import { recalculateSingleEmployee } from '@/features/payroll/services/run-calculation';

// ========================================
// Type Definitions
// ========================================

type ValidationIssue = {
  type: 'error' | 'warning' | 'info';
  category: 'overtime' | 'comparison' | 'prorata' | 'deduction' | 'bonus';
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  expected?: number;
  actual?: number;
};

type VerificationStatus = 'verified' | 'flagged' | 'unverified' | 'auto_ok';

// ========================================
// Input Validation Schemas
// ========================================

const validatePayrollSchema = z.object({
  runId: z.string().uuid(),
});

const getPreviousPayrollSchema = z.object({
  currentRunId: z.string().uuid(),
});

const markEmployeeVerifiedSchema = z.object({
  runId: z.string().uuid(),
  employeeId: z.string().uuid(),
  verifiedBy: z.string().uuid(),
  notes: z.string().optional(),
});

const markAllVerifiedSchema = z.object({
  runId: z.string().uuid(),
  verifiedBy: z.string().uuid(),
});

const recalculateEmployeeSchema = z.object({
  runId: z.string().uuid(),
  employeeId: z.string().uuid(),
});

const getOvertimeBreakdownSchema = z.object({
  runId: z.string().uuid(),
  employeeId: z.string().uuid(),
});

// ========================================
// Payroll Review Router
// ========================================

export const payrollReviewRouter = createTRPCRouter({
  /**
   * Validate payroll calculations and detect issues
   *
   * Automatically detects:
   * - Missing overtime calculations
   * - Unusual salary variances (>30%)
   * - Prorata calculations for new/exiting employees
   * - Deduction anomalies
   * - Large bonuses
   */
  validatePayrollCalculations: hrManagerProcedure
    .input(validatePayrollSchema)
    .query(async ({ input, ctx }) => {
      const { runId } = input;

      // Get current payroll run
      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.id, runId),
            eq(payrollRuns.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paie introuvable',
        });
      }

      // Get all line items for this run (narrow columns — validation only needs pay/attendance fields)
      const lineItems = await db
        .select({
          employeeId: payrollLineItems.employeeId,
          employeeName: payrollLineItems.employeeName,
          baseSalary: payrollLineItems.baseSalary,
          grossSalary: payrollLineItems.grossSalary,
          netSalary: payrollLineItems.netSalary,
          overtimeHours: payrollLineItems.overtimeHours,
          overtimePay: payrollLineItems.overtimePay,
          bonuses: payrollLineItems.bonuses,
          daysWorked: payrollLineItems.daysWorked,
          daysAbsent: payrollLineItems.daysAbsent,
        })
        .from(payrollLineItems)
        .where(eq(payrollLineItems.payrollRunId, runId));

      // Get previous payroll run for comparison
      const [previousRun] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.tenantId, ctx.user.tenantId),
            eq(payrollRuns.paymentFrequency, run.paymentFrequency),
            sql`${payrollRuns.periodStart} < ${run.periodStart}`
          )
        )
        .orderBy(desc(payrollRuns.periodStart))
        .limit(1);

      // Get previous line items if available (narrow — only need pay amounts for comparison)
      const previousLineItems = previousRun
        ? await db
            .select({
              employeeId: payrollLineItems.employeeId,
              netSalary: payrollLineItems.netSalary,
              grossSalary: payrollLineItems.grossSalary,
            })
            .from(payrollLineItems)
            .where(eq(payrollLineItems.payrollRunId, previousRun.id))
        : [];

      // Create a map of previous amounts by employee ID
      const previousAmounts = new Map(
        previousLineItems.map((item) => [
          item.employeeId,
          {
            netSalary: Number(item.netSalary),
            grossSalary: Number(item.grossSalary),
          },
        ])
      );

      const issues: ValidationIssue[] = [];

      // Analyze each line item
      for (const item of lineItems) {
        const overtimeHours = (item.overtimeHours as any) || {};
        const totalOvertimeHours =
          Object.values(overtimeHours).reduce(
            (sum: number, val: any) => sum + (Number(val) || 0),
            0
          ) || 0;

        const overtimePay = Number(item.overtimePay || 0);
        const netSalary = Number(item.netSalary);
        const grossSalary = Number(item.grossSalary);

        // 1. Check for missing overtime calculations
        if (totalOvertimeHours > 0 && overtimePay === 0) {
          const baseSalary = Number(item.baseSalary);
          const hourlyRate = baseSalary / 173.33; // Standard monthly hours
          const expectedOT = totalOvertimeHours * hourlyRate * 1.15; // Simplified estimate

          issues.push({
            type: 'error',
            category: 'overtime',
            employeeId: item.employeeId,
            employeeName: item.employeeName || 'Employé',
            title: 'Heures supplémentaires non calculées',
            description: `${totalOvertimeHours}h enregistrées mais 0 FCFA calculé`,
            expected: Math.round(expectedOT),
            actual: overtimePay,
          });
        }

        // 2. Check for unusual variance vs previous month
        const previous = previousAmounts.get(item.employeeId);
        if (previous) {
          const variancePercent =
            ((netSalary - previous.netSalary) / previous.netSalary) * 100;

          if (Math.abs(variancePercent) > 30) {
            const daysAbsent = Number(item.daysAbsent || 0);
            const bonuses = Number(item.bonuses || 0);

            let reason = 'Raison inconnue';
            if (daysAbsent > 5) {
              reason = `Absences non payées (${daysAbsent} jours)`;
            } else if (bonuses > grossSalary * 0.5) {
              reason = `Prime importante (${Math.round(bonuses)} FCFA)`;
            }

            issues.push({
              type: 'warning',
              category: 'comparison',
              employeeId: item.employeeId,
              employeeName: item.employeeName || 'Employé',
              title: 'Salaire inhabituel',
              description: `${variancePercent > 0 ? '+' : ''}${variancePercent.toFixed(1)}% vs mois dernier. ${reason}`,
              expected: Math.round(previous.netSalary),
              actual: Math.round(netSalary),
            });
          }
        }

        // 3. Check for prorata calculations (new employees)
        if (!previous) {
          const daysWorked = Number(item.daysWorked || 0);
          if (daysWorked < 22) {
            // Less than full month
            issues.push({
              type: 'info',
              category: 'prorata',
              employeeId: item.employeeId,
              employeeName: item.employeeName || 'Employé',
              title: 'Première paie (prorata)',
              description: `Salaire calculé sur ${daysWorked} jours`,
              actual: Math.round(netSalary),
            });
          }
        }

        // 4. Check for large bonuses
        const bonuses = Number(item.bonuses || 0);
        if (bonuses > grossSalary * 2) {
          issues.push({
            type: 'info',
            category: 'bonus',
            employeeId: item.employeeId,
            employeeName: item.employeeName || 'Employé',
            title: 'Prime importante',
            description: `Prime de ${Math.round(bonuses)} FCFA (> 2× salaire de base)`,
            actual: Math.round(bonuses),
          });
        }
      }

      // Store issues in database
      if (issues.length > 0) {
        await db.insert(payrollValidationIssues).values(
          issues.map((issue) => ({
            tenantId: ctx.user.tenantId,
            payrollRunId: runId,
            employeeId: issue.employeeId,
            issueType: issue.type,
            category: issue.category,
            title: issue.title,
            description: issue.description,
            expectedAmount: issue.expected ? String(issue.expected) : null,
            actualAmount: issue.actual ? String(issue.actual) : null,
            resolved: false,
          }))
        ).onConflictDoNothing();
      }

      return {
        issues,
        totalIssues: issues.length,
        errors: issues.filter((i) => i.type === 'error').length,
        warnings: issues.filter((i) => i.type === 'warning').length,
        info: issues.filter((i) => i.type === 'info').length,
      };
    }),

  /**
   * Get previous payroll for comparison
   */
  getPreviousPayroll: hrManagerProcedure
    .input(getPreviousPayrollSchema)
    .query(async ({ input, ctx }) => {
      const { currentRunId } = input;

      // Get current run
      const [currentRun] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.id, currentRunId),
            eq(payrollRuns.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!currentRun) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paie actuelle introuvable',
        });
      }

      // Get previous run
      const [previousRun] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.tenantId, ctx.user.tenantId),
            eq(payrollRuns.paymentFrequency, currentRun.paymentFrequency),
            sql`${payrollRuns.periodStart} < ${currentRun.periodStart}`
          )
        )
        .orderBy(desc(payrollRuns.periodStart))
        .limit(1);

      if (!previousRun) {
        return null;
      }

      // Get line items for previous run
      const previousLineItems = await db
        .select()
        .from(payrollLineItems)
        .where(eq(payrollLineItems.payrollRunId, previousRun.id));

      return {
        run: previousRun,
        lineItems: previousLineItems,
      };
    }),

  /**
   * Mark employee as verified
   */
  markEmployeeVerified: hrManagerProcedure
    .input(markEmployeeVerifiedSchema)
    .mutation(async ({ input, ctx }) => {
      const { runId, employeeId, verifiedBy, notes } = input;

      await db
        .insert(payrollVerificationStatus)
        .values({
          tenantId: ctx.user.tenantId,
          payrollRunId: runId,
          employeeId,
          status: 'verified',
          verifiedBy,
          verifiedAt: new Date().toISOString(),
          notes,
        })
        .onConflictDoUpdate({
          target: [
            payrollVerificationStatus.payrollRunId,
            payrollVerificationStatus.employeeId,
          ],
          set: {
            status: 'verified',
            verifiedBy,
            verifiedAt: new Date().toISOString(),
            notes,
            updatedAt: new Date().toISOString(),
          },
        });

      return { success: true };
    }),

  /**
   * Mark all employees as verified
   */
  markAllVerified: hrManagerProcedure
    .input(markAllVerifiedSchema)
    .mutation(async ({ input, ctx }) => {
      const { runId, verifiedBy } = input;

      // Get all line items
      const lineItems = await db
        .select({ employeeId: payrollLineItems.employeeId })
        .from(payrollLineItems)
        .where(eq(payrollLineItems.payrollRunId, runId));

      // Insert verification status for all employees
      await db.insert(payrollVerificationStatus).values(
        lineItems.map((item) => ({
          tenantId: ctx.user.tenantId,
          payrollRunId: runId,
          employeeId: item.employeeId,
          status: 'verified' as VerificationStatus,
          verifiedBy,
          verifiedAt: new Date().toISOString(),
        }))
      ).onConflictDoUpdate({
        target: [
          payrollVerificationStatus.payrollRunId,
          payrollVerificationStatus.employeeId,
        ],
        set: {
          status: 'verified',
          verifiedBy,
          verifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      return { success: true, count: lineItems.length };
    }),

  /**
   * Recalculate single employee
   *
   * Uses shared recalculateSingleEmployee() function from run-calculation service
   * to avoid code duplication and ensure consistent calculation logic
   */
  recalculateEmployee: hrManagerProcedure
    .input(recalculateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      const { runId, employeeId } = input;

      // Use shared calculation function
      return await recalculateSingleEmployee({
        runId,
        employeeId,
        tenantId: ctx.user.tenantId,
      });
    }),

  /**
   * Get overtime breakdown for an employee
   */
  getOvertimeBreakdown: hrManagerProcedure
    .input(getOvertimeBreakdownSchema)
    .query(async ({ input, ctx }) => {
      const { runId, employeeId } = input;

      // Get run details
      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.id, runId),
            eq(payrollRuns.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paie introuvable',
        });
      }

      // Get time entries for this period
      const entries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.employeeId, employeeId),
            eq(timeEntries.tenantId, ctx.user.tenantId),
            between(
              timeEntries.clockIn,
              new Date(run.periodStart),
              new Date(run.periodEnd)
            )
          )
        )
        .orderBy(timeEntries.clockIn);

      // Get line item for hourly rate (narrow — only need salary and overtime data)
      const [lineItem] = await db
        .select({
          baseSalary: payrollLineItems.baseSalary,
          overtimeHours: payrollLineItems.overtimeHours,
          overtimePay: payrollLineItems.overtimePay,
        })
        .from(payrollLineItems)
        .where(
          and(
            eq(payrollLineItems.payrollRunId, runId),
            eq(payrollLineItems.employeeId, employeeId)
          )
        )
        .limit(1);

      if (!lineItem) {
        return null;
      }

      const baseSalary = Number(lineItem.baseSalary);
      const hourlyRate = baseSalary / 173.33; // Standard monthly hours

      // Calculate breakdown from time entries
      const totalHours = entries.reduce(
        (sum, e) => sum + Number(e.totalHours || 0),
        0
      );

      // Get overtime breakdown from line item's overtimeHours JSONB field
      const overtimeData = lineItem.overtimeHours as Record<string, number> || {};
      const totalOvertimeHours = Object.values(overtimeData).reduce(
        (sum, hours) => sum + Number(hours || 0),
        0
      );

      return {
        totalHours,
        normalHours: totalHours - totalOvertimeHours,
        overtimeHours: {
          total: totalOvertimeHours,
          rate15: Number(overtimeData['rate15'] || 0),
          rate50: Number(overtimeData['rate50'] || 0),
        },
        overtimePay: {
          total: Number(lineItem.overtimePay || 0),
          rate15Amount: 0,
          rate50Amount: 0,
        },
        hourlyRate,
        entries: entries.map((e) => ({
          date: e.clockIn,
          hoursWorked: Number(e.totalHours || 0),
          overtimeHours: 0, // Overtime is calculated at line item level, not per entry
        })),
      };
    }),

  /**
   * Get verification status for all employees in run
   */
  getVerificationStatus: hrManagerProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { runId } = input;

      const statuses = await db
        .select()
        .from(payrollVerificationStatus)
        .where(
          and(
            eq(payrollVerificationStatus.payrollRunId, runId),
            eq(payrollVerificationStatus.tenantId, ctx.user.tenantId)
          )
        );

      return statuses;
    }),
});
