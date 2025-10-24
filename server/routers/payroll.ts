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
import { createTRPCRouter, publicProcedure, employeeProcedure, hrManagerProcedure } from '../api/trpc';
import { calculateGrossSalary } from '@/features/payroll/services/gross-calculation';
import { calculatePayroll } from '@/features/payroll/services/payroll-calculation';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';
import {
  createPayrollRun,
  calculatePayrollRun,
} from '@/features/payroll/services/run-calculation';
import { db } from '@/lib/db';
import { payrollRuns, payrollLineItems, employees } from '@/lib/db/schema';
import { eq, and, lte, gte, or, isNull, asc, sql } from 'drizzle-orm';
import { ruleLoader } from '@/features/payroll/services/rule-loader';

// Export services
import * as React from 'react';
// Lazy load @react-pdf/renderer to avoid loading it on module initialization
// This prevents issues with Turbopack/Next.js module resolution
import { PayslipDocument, PayslipData, generatePayslipFilename } from '@/features/payroll/services/payslip-generator';
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
  countryCode: z.string().length(2, { message: 'Code pays invalide' }),
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
    .mutation(async ({ input }) => {
      return await createPayrollRun(input);
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
      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, input.runId))
        .limit(1);

      if (!run) {
        throw new Error('Payroll run not found');
      }

      // Get line items with employee details using direct SQL for JSONB extraction
      const lineItems = await db
        .select({
          id: payrollLineItems.id,
          employeeId: payrollLineItems.employeeId,
          employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
          employeeNumber: employees.employeeNumber,
          baseSalary: payrollLineItems.baseSalary,
          grossSalary: payrollLineItems.grossSalary,
          netSalary: payrollLineItems.netSalary,
          totalDeductions: payrollLineItems.totalDeductions,
          cnpsEmployee: sql<number>`(${payrollLineItems.employeeContributions}->>'cnps')::numeric`,
          cmuEmployee: sql<number>`(${payrollLineItems.employeeContributions}->>'cmu')::numeric`,
          its: sql<number>`(${payrollLineItems.taxDeductions}->>'its')::numeric`,
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

      // Add employee count for each run
      const runsWithCount = await Promise.all(
        runs.map(async (run) => {
          const lineItems = await db
            .select({ count: sql<number>`count(*)` })
            .from(payrollLineItems)
            .where(eq(payrollLineItems.payrollRunId, run.id));

          return {
            ...run,
            employeeCount: Number(lineItems[0]?.count || 0),
          };
        })
      );

      return runsWithCount;
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
      // Load countries with active payroll configuration
      const allCountries = await db.query.countries.findMany({
        where: (countries, { eq }) => eq(countries.isActive, true),
        orderBy: (countries, { asc }) => [asc(countries.code)],
      });

      // Validate each country has payroll config
      const countriesWithConfig = [];
      for (const country of allCountries) {
        try {
          await ruleLoader.getCountryConfig(country.code);
          const countryName = country.name as { fr: string; en?: string };
          countriesWithConfig.push({
            code: country.code,
            name: countryName.fr,
            nameEn: countryName.en,
            currency: country.currencyCode,
            isActive: country.isActive,
          });
        } catch (error) {
          // Skip countries without payroll config
          console.error(`Country ${country.code} has no valid payroll config:`, error);
        }
      }

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
          providerName: 'CNPS',
          fileFormat: 'xlsx',
        },
        {
          id: 'cmu',
          templateType: 'health',
          providerCode: 'cmu_ci',
          providerName: 'CMU',
          fileFormat: 'xlsx',
        },
        {
          id: 'etat301',
          templateType: 'tax',
          providerCode: 'dgi_ci',
          providerName: 'État 301 (DGI)',
          fileFormat: 'xlsx',
        },
        {
          id: 'bank_transfer',
          templateType: 'bank_transfer',
          providerCode: 'standard',
          providerName: 'Virement Bancaire',
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

        countryConfig = {
          taxSystemName,
          socialSchemeName,
          laborCodeReference: undefined, // TODO: Add laborCodeReference to CountryConfig type
          contributions: config.socialScheme.contributionTypes.map((contrib: any) => ({
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
          otherTaxes: config.otherTaxes.map((tax: any) => ({
            code: tax.code,
            name: typeof tax.name === 'string' ? tax.name : tax.name.fr,
            paidBy: tax.paidBy,
            amount: tax.code === 'fdfp' || tax.code === 'fdfp_tap'
              ? parseFloat(lineItem.totalOtherTaxes?.toString() || '0')
              : 0,
          })),
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
        housingAllowance: allowancesData.housing || 0,
        transportAllowance: allowancesData.transport || 0,
        mealAllowance: allowancesData.meal || 0,
        seniorityBonus: allowancesData.seniority || 0,
        familyAllowance: allowancesData.family || 0,
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
        components: components.length > 0 ? components : undefined,
        countryConfig,
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

        const payslipData: PayslipData = {
          employeeName: lineItem.employeeName || '',
          employeeNumber: lineItem.employeeNumber || '',
          employeePosition: lineItem.positionTitle || '',
          companyName: tenant?.name || '',
          companyAddress: undefined, // TODO: Add address field to tenants table
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

      // Get employees for CNPS numbers
      const employeeIds = lineItems.map((item) => item.employeeId);
      const employees = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, employeeIds),
      });

      const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

      // Prepare export data
      const exportData: CNPSExportData = {
        companyName: tenant?.name || 'Company',
        companyCNPS: tenant?.taxId || undefined,
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
        companyTaxId: tenant?.taxId || undefined,
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
});
