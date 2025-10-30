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
import { createTRPCRouter, publicProcedure, protectedProcedure, employeeProcedure, hrManagerProcedure } from '../api/trpc';
import { calculateGrossSalary } from '@/features/payroll/services/gross-calculation';
import { calculatePayroll } from '@/features/payroll/services/payroll-calculation';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';
import {
  createPayrollRun,
  calculatePayrollRun,
} from '@/features/payroll/services/run-calculation';
import { db } from '@/lib/db';
import { payrollRuns, payrollLineItems, employees, timeEntries, tenants, employeeDependents, salaryComponentDefinitions } from '@/lib/db/schema';
import { salaryComponentTemplates } from '@/drizzle/schema';
import { eq, and, lte, gte, or, isNull, asc, desc, sql } from 'drizzle-orm';
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
              sourceType: z.enum(['standard', 'template']).default('template'),
            })
          )
          .optional(),

        // Employee details (required for hiring, optional for salary_edit/what_if)
        rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
        contractType: z.enum(['CDI', 'CDD', 'STAGE']).optional(),
        maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
        dependentChildren: z.number().min(0).max(10).optional(),
        hireDate: z.date().optional(),
        isExpat: z.boolean().optional(), // For ITS employer tax calculation (1.2% local, 10.4% expat)
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

      if (input.employeeId) {
        [existingEmployee] = await db
          .select()
          .from(employeesSchema)
          .where(andOp(eqOp(employeesSchema.id, input.employeeId), eqOp(employeesSchema.tenantId, ctx.user.tenantId)))
          .limit(1);

        if (!existingEmployee) {
          throw new Error('Employé non trouvé');
        }

        // Load verified dependents for family calculations
        verifiedDependents = await db
          .select()
          .from(employeeDependentsSchema)
          .where(andOp(eqOp(employeeDependentsSchema.employeeId, input.employeeId), eqOp(employeeDependentsSchema.isVerified, true)));
      }

      // Determine values based on context
      const rateType = input.rateType || existingEmployee?.rateType || 'MONTHLY';
      const contractType = input.contractType || existingEmployee?.contractType;
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
              // Use the rate from metadata instead of the user-provided amount
              const rate = calculationRule.rate; // e.g., 0.02 for 2%
              calculatedAmount = Math.round(salaireCategoriel * rate);
              console.log(`[Salary Preview] Auto-calculated ${template.name} using ${rate * 100}% of ${salaireCategoriel}: ${calculatedAmount} FCFA`);
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

      const allComponentsWithMetadata = Array.from(componentMap.values());

      // Calculate preview for a full month
      const previewDate = hireDate >= new Date() ? hireDate : new Date();
      const periodStart = new Date(previewDate.getFullYear(), previewDate.getMonth(), 1);
      const periodEnd = new Date(previewDate.getFullYear(), previewDate.getMonth() + 1, 0);

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
        daysWorkedThisMonth: rateType === 'DAILY' ? 30 : undefined,
        hoursWorkedThisMonth: rateType === 'HOURLY' ? 30 * 8 : undefined,
        maritalStatus,
        dependentChildren,
        isExpat, // For ITS employer tax calculation (resolved above)
      });

      // Format response to match SalaryPreviewData type
      const previewData: any = {
        grossSalary: payrollResult.grossSalary,
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

        components: allComponentsWithMetadata.map((c: any) => ({
          code: c.code,
          name: c.name,
          amount: c.amount,
        })),
        fiscalParts,
        maritalStatus,
        dependentChildren,
        rateType,
        contractType,
        countryCode,
        currencySymbol: 'FCFA',
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
      })
    )
    .query(async ({ input, ctx }) => {
      // Get all active employees for this tenant
      const allEmployees = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          rateType: employees.rateType,
          status: employees.status,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, ctx.user.tenantId),
            eq(employees.status, 'active')
          )
        );

      // Separate monthly and daily workers
      const monthlyWorkers = allEmployees.filter(e => e.rateType !== 'DAILY');
      const dailyWorkers = allEmployees.filter(e => e.rateType === 'DAILY');

      // Check time entries for daily workers
      const missingTimeEntries: Array<{
        id: string;
        firstName: string;
        lastName: string;
        employeeNumber: string;
      }> = [];

      for (const worker of dailyWorkers) {
        const entries = await db
          .select({ id: timeEntries.id })
          .from(timeEntries)
          .where(
            and(
              eq(timeEntries.employeeId, worker.id),
              eq(timeEntries.status, 'approved'),
              sql`${timeEntries.clockIn} >= ${input.periodStart.toISOString()}`,
              sql`${timeEntries.clockIn} < ${input.periodEnd.toISOString()}`
            )
          )
          .limit(1); // We only need to know if at least one exists

        if (entries.length === 0) {
          missingTimeEntries.push({
            id: worker.id,
            firstName: worker.firstName,
            lastName: worker.lastName,
            employeeNumber: worker.employeeNumber,
          });
        }
      }

      return {
        monthlyWorkers: {
          count: monthlyWorkers.length,
          employees: monthlyWorkers,
        },
        dailyWorkers: {
          count: dailyWorkers.length,
          employees: dailyWorkers,
          missingTimeEntries,
        },
        totalEmployees: allEmployees.length,
      };
    }),

  /**
   * Check if a payroll run exists for the given period
   *
   * Returns existing run details if found, null otherwise.
   * Used to prevent duplicates and guide users to existing runs.
   */
  checkExistingRun: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        periodStart: z.date(),
        periodEnd: z.date(),
      })
    )
    .query(async ({ input }) => {
      const periodStartStr = input.periodStart.toISOString().split('T')[0];
      const periodEndStr = input.periodEnd.toISOString().split('T')[0];

      const existing = await db.query.payrollRuns.findFirst({
        where: and(
          eq(payrollRuns.tenantId, input.tenantId),
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
