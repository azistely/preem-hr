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
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { calculateGrossSalary } from '@/features/payroll/services/gross-calculation';
import { calculatePayroll } from '@/features/payroll/services/payroll-calculation';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';
import {
  createPayrollRun,
  calculatePayrollRun,
} from '@/features/payroll/services/run-calculation';
import { db } from '@/lib/db';
import { payrollRuns, payrollLineItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
  tenantId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  paymentDate: z.date(),
  name: z.string().optional(),
  createdBy: z.string().uuid(),
});

const calculatePayrollRunInputSchema = z.object({
  runId: z.string().uuid(),
});

const getPayrollRunInputSchema = z.object({
  runId: z.string().uuid(),
});

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
   * Create a new payroll run
   *
   * Initializes a payroll run for a specific period.
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
  createRun: publicProcedure
    .input(createPayrollRunInputSchema)
    .mutation(async ({ input }) => {
      return await createPayrollRun(input);
    }),

  /**
   * Calculate payroll run for all employees
   *
   * Processes payroll for all active employees in the tenant.
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
  calculateRun: publicProcedure
    .input(calculatePayrollRunInputSchema)
    .mutation(async ({ input }) => {
      return await calculatePayrollRun(input);
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
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, input.runId),
      });

      if (!run) {
        throw new Error('Payroll run not found');
      }

      const lineItems = await db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.payrollRunId, input.runId),
        orderBy: (items, { asc }) => [asc(items.employeeId)],
      });

      return {
        ...run,
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
  listRuns: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        status: z
          .enum(['draft', 'calculating', 'calculated', 'approved', 'paid', 'failed'])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const where = input.status
        ? [eq(payrollRuns.tenantId, input.tenantId), eq(payrollRuns.status, input.status)]
        : [eq(payrollRuns.tenantId, input.tenantId)];

      const runs = await db.query.payrollRuns.findMany({
        where: (table, { and }) => and(...where.map((w) => w)),
        orderBy: (table, { desc }) => [desc(table.periodStart)],
        limit: input.limit,
        offset: input.offset,
      });

      return runs;
    }),

  /**
   * Approve a payroll run
   *
   * Changes status from 'calculated' to 'approved'.
   * Only calculated runs can be approved.
   *
   * @example
   * ```typescript
   * await trpc.payroll.approveRun.mutate({
   *   runId: 'run-123',
   *   approvedBy: 'user-123',
   * });
   * ```
   */
  approveRun: publicProcedure
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
   *
   * @example
   * ```typescript
   * await trpc.payroll.deleteRun.mutate({
   *   runId: 'run-123',
   * });
   * ```
   */
  deleteRun: publicProcedure
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
});
