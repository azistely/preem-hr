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

// Export services
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PayslipDocument, PayslipData, generatePayslipFilename } from '@/features/payroll/services/payslip-generator.tsx';
import { generateCNPSExcel, generateCNPSFilename, CNPSExportData } from '@/features/payroll/services/cnps-export';
import { generateCMUExcel, generateCMUFilename, CMUExportData } from '@/features/payroll/services/cmu-export';
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

      // Prepare payslip data
      const payslipData: PayslipData = {
        companyName: tenant?.name || 'Company',
        companyTaxId: tenant?.taxId || undefined,
        employeeName: lineItem.employeeName || employee?.firstName + ' ' + employee?.lastName || 'Unknown',
        employeeNumber: lineItem.employeeNumber || employee?.employeeNumber || '',
        employeeCNPS: employee?.cnpsNumber || undefined,
        employeePosition: lineItem.positionTitle || undefined,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        payDate: new Date(run.payDate),
        baseSalary: parseFloat(lineItem.baseSalary?.toString() || '0'),
        overtimePay: parseFloat(lineItem.overtimePay?.toString() || '0'),
        bonuses: parseFloat(lineItem.bonuses?.toString() || '0'),
        grossSalary: parseFloat(lineItem.grossSalary?.toString() || '0'),
        cnpsEmployee: parseFloat(lineItem.cnpsEmployee?.toString() || '0'),
        cmuEmployee: parseFloat(lineItem.cmuEmployee?.toString() || '0'),
        its: parseFloat(lineItem.its?.toString() || '0'),
        totalDeductions: parseFloat(lineItem.totalDeductions?.toString() || '0'),
        cnpsEmployer: parseFloat(lineItem.cnpsEmployer?.toString() || '0'),
        cmuEmployer: parseFloat(lineItem.cmuEmployer?.toString() || '0'),
        netSalary: parseFloat(lineItem.netSalary?.toString() || '0'),
        paymentMethod: lineItem.paymentMethod,
        bankAccount: lineItem.bankAccount || undefined,
        daysWorked: parseFloat(lineItem.daysWorked?.toString() || '0'),
      };

      // Generate PDF
      const pdfBuffer = await renderToBuffer(
        React.createElement(PayslipDocument, { data: payslipData })
      );
      const filename = generatePayslipFilename(payslipData.employeeName, new Date(run.periodStart));

      return {
        data: Buffer.from(pdfBuffer).toString('base64'),
        filename,
        contentType: 'application/pdf',
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

      // Get employees for CNPS numbers
      const employeeIds = lineItems.map((item) => item.employeeId);
      const employees = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, employeeIds),
      });

      const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

      // Prepare export data
      const exportData: CNPSExportData = {
        companyName: tenant?.name || 'Company',
        companyCNPS: tenant?.taxId,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        employees: lineItems.map((item) => {
          const employee = employeeMap.get(item.employeeId);
          return {
            employeeName: item.employeeName || '',
            employeeCNPS: employee?.cnpsNumber || null,
            grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
            cnpsEmployee: parseFloat(item.cnpsEmployee?.toString() || '0'),
            cnpsEmployer: parseFloat(item.cnpsEmployer?.toString() || '0'),
          };
        }),
      };

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
   * Export CMU declaration file
   *
   * Generates CSV/Excel file for CMU portal submission.
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
      const exportData: CMUExportData = {
        companyName: tenant?.name || 'Company',
        companyTaxId: tenant?.taxId,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        employees: lineItems.map((item) => ({
          employeeName: item.employeeName || '',
          employeeNumber: item.employeeNumber || '',
          cmuEmployee: parseFloat(item.cmuEmployee?.toString() || '0'),
          cmuEmployer: parseFloat(item.cmuEmployer?.toString() || '0'),
        })),
      };

      // Generate Excel
      const excelBuffer = generateCMUExcel(exportData);
      const filename = generateCMUFilename(new Date(run.periodStart), 'xlsx');

      return {
        data: Buffer.from(excelBuffer).toString('base64'),
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        companyTaxId: tenant?.taxId,
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

      // Prepare export data
      const exportData: BankTransferExportData = {
        companyName: tenant?.name || 'Company',
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        payDate: new Date(run.payDate),
        employees: lineItems.map((item) => ({
          employeeName: item.employeeName || '',
          employeeNumber: item.employeeNumber || '',
          bankAccount: item.bankAccount,
          netSalary: parseFloat(item.netSalary?.toString() || '0'),
          paymentReference: item.paymentReference || undefined,
        })),
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
});
