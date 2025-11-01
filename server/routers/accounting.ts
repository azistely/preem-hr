/**
 * Accounting tRPC Router
 *
 * Provides type-safe API endpoints for accounting integration:
 * - GL export (SYSCOHADA, Sage, Ciel)
 * - CMU export (1% contribution)
 * - ETAT 301 export (monthly ITS declaration)
 * - Account mapping configuration
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { exportPayrollToGL } from '@/lib/accounting/gl-export.service';
import {
  exportCMU,
  getOrCreateCMUConfig,
  updateCMUConfig,
} from '@/lib/accounting/cmu-export.service';
import {
  generateEtat301,
  getOrCreateEtat301Config,
  updateEtat301Config,
} from '@/lib/accounting/etat-301-export.service';
import {
  generatePayRegisterExcel,
  generatePayRegisterFilename,
  formatPayRegisterTitle,
  PayRegisterExportData,
  PaymentFrequency,
} from '@/features/payroll/services/pay-register-export';
import { db } from '@/lib/db';
import {
  accountingAccounts,
  payrollAccountMappings,
  glExports,
  glJournalEntries,
  cmuExportConfig,
  etat301Config,
  tenantComponentCodes,
  payrollRuns,
  payrollLineItems,
  employees,
  tenants,
} from '@/lib/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';

// ========================================
// Input Validation Schemas
// ========================================

const exportFormatSchema = z.enum(['SYSCOHADA_CSV', 'SAGE_TXT', 'CIEL_IIF', 'EXCEL']);

const exportPayrollToGLSchema = z.object({
  payrollRunId: z.string().uuid(),
  format: exportFormatSchema,
});

const exportCMUSchema = z.object({
  payrollRunId: z.string().uuid(),
});

const exportPayRegisterSchema = z.object({
  month: z.string(), // 'YYYY-MM' format
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  closureSequence: z.number().int().min(1).max(4).optional(), // 1-4 for weekly, 1-2 for biweekly
});

const generateEtat301Schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)'),
});

const getAccountsSchema = z.object({
  systemOnly: z.boolean().optional(),
});

const saveAccountMappingSchema = z.object({
  componentType: z.string(),
  debitAccountId: z.string().uuid().optional(),
  creditAccountId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  costCenter: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateCMUConfigSchema = z.object({
  cmuEmployerNumber: z.string().optional(),
  cmuRate: z.number().min(0).max(100).optional(),
  includeDependents: z.boolean().optional(),
});

const updateEtat301ConfigSchema = z.object({
  dgiTaxNumber: z.string().optional(),
  exportFormat: z.string().optional(),
  includeAttachments: z.boolean().optional(),
});

const createAccountSchema = z.object({
  accountCode: z.string().max(20),
  accountName: z.string().max(255),
  accountType: z.enum(['expense', 'liability', 'asset']).optional(),
  parentAccountCode: z.string().max(20).optional(),
  accountingSystem: z.string().max(50).optional(),
});

const saveComponentCodeSchema = z.object({
  componentDefinitionId: z.string().uuid().optional(),
  componentType: z.string().max(100),
  customCode: z.string().max(20),
  customDescription: z.string().max(255).optional(),
});

// ========================================
// Accounting Router
// ========================================

export const accountingRouter = createTRPCRouter({
  /**
   * Export payroll run to GL journal entries
   */
  exportPayrollToGL: hrManagerProcedure
    .input(exportPayrollToGLSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await exportPayrollToGL(
        input.payrollRunId,
        input.format,
        ctx.user.tenantId,
        ctx.user.id
      );

      return result;
    }),

  /**
   * Export CMU 1% contributions
   */
  exportCMU: hrManagerProcedure
    .input(exportCMUSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await exportCMU(input.payrollRunId, ctx.user.tenantId);

      return result;
    }),

  /**
   * Generate ETAT 301 monthly ITS declaration
   */
  generateEtat301: hrManagerProcedure
    .input(generateEtat301Schema)
    .mutation(async ({ input, ctx }) => {
      const result = await generateEtat301(input.month, ctx.user.tenantId);

      return result;
    }),

  /**
   * Get accounting accounts (system-wide and tenant-specific)
   */
  getAccounts: hrManagerProcedure
    .input(getAccountsSchema.optional())
    .query(async ({ input, ctx }) => {
      const systemOnly = input?.systemOnly ?? false;

      const accounts = await db
        .select()
        .from(accountingAccounts)
        .where(
          systemOnly
            ? isNull(accountingAccounts.tenantId)
            : or(
                isNull(accountingAccounts.tenantId),
                eq(accountingAccounts.tenantId, ctx.user.tenantId)
              )
        );

      return accounts;
    }),

  /**
   * Create custom accounting account
   */
  createAccount: hrManagerProcedure
    .input(createAccountSchema)
    .mutation(async ({ input, ctx }) => {
      const [account] = await db
        .insert(accountingAccounts)
        .values({
          tenantId: ctx.user.tenantId,
          accountCode: input.accountCode,
          accountName: input.accountName,
          accountType: input.accountType,
          parentAccountCode: input.parentAccountCode,
          accountingSystem: input.accountingSystem || 'SYSCOHADA',
          isActive: true,
        })
        .returning();

      return account;
    }),

  /**
   * Get account mappings for tenant
   */
  getAccountMappings: hrManagerProcedure.query(async ({ ctx }) => {
    const mappings = await db
      .select()
      .from(payrollAccountMappings)
      .where(eq(payrollAccountMappings.tenantId, ctx.user.tenantId));

    return mappings;
  }),

  /**
   * Save or update account mapping
   */
  saveAccountMapping: hrManagerProcedure
    .input(saveAccountMappingSchema)
    .mutation(async ({ input, ctx }) => {
      // Check if mapping exists
      const [existing] = await db
        .select()
        .from(payrollAccountMappings)
        .where(
          and(
            eq(payrollAccountMappings.tenantId, ctx.user.tenantId),
            eq(payrollAccountMappings.componentType, input.componentType)
          )
        );

      if (existing) {
        // Update
        const [updated] = await db
          .update(payrollAccountMappings)
          .set({
            debitAccountId: input.debitAccountId,
            creditAccountId: input.creditAccountId,
            departmentId: input.departmentId,
            costCenter: input.costCenter,
            isActive: input.isActive ?? true,
          })
          .where(eq(payrollAccountMappings.id, existing.id))
          .returning();

        return updated;
      } else {
        // Create
        const [created] = await db
          .insert(payrollAccountMappings)
          .values({
            tenantId: ctx.user.tenantId,
            componentType: input.componentType,
            debitAccountId: input.debitAccountId,
            creditAccountId: input.creditAccountId,
            departmentId: input.departmentId,
            costCenter: input.costCenter,
            isActive: input.isActive ?? true,
          })
          .returning();

        return created;
      }
    }),

  /**
   * Get GL export history
   */
  getGLExports: hrManagerProcedure.query(async ({ ctx }) => {
    const exports = await db
      .select()
      .from(glExports)
      .where(eq(glExports.tenantId, ctx.user.tenantId))
      .orderBy(glExports.exportDate);

    return exports;
  }),

  /**
   * Get GL journal entries for an export
   */
  getGLJournalEntries: hrManagerProcedure
    .input(z.object({ exportId: z.string().uuid() }))
    .query(async ({ input }) => {
      const entries = await db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.exportId, input.exportId))
        .orderBy(glJournalEntries.lineNumber);

      return entries;
    }),

  /**
   * Get CMU configuration
   */
  getCMUConfig: hrManagerProcedure.query(async ({ ctx }) => {
    const config = await getOrCreateCMUConfig(ctx.user.tenantId);
    return config;
  }),

  /**
   * Update CMU configuration
   */
  updateCMUConfig: hrManagerProcedure
    .input(updateCMUConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const config = await updateCMUConfig(ctx.user.tenantId, input);
      return config;
    }),

  /**
   * Get ETAT 301 configuration
   */
  getEtat301Config: hrManagerProcedure.query(async ({ ctx }) => {
    const config = await getOrCreateEtat301Config(ctx.user.tenantId);
    return config;
  }),

  /**
   * Update ETAT 301 configuration
   */
  updateEtat301Config: hrManagerProcedure
    .input(updateEtat301ConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const config = await updateEtat301Config(ctx.user.tenantId, input);
      return config;
    }),

  /**
   * Get component code customizations
   */
  getComponentCodes: hrManagerProcedure.query(async ({ ctx }) => {
    const codes = await db
      .select()
      .from(tenantComponentCodes)
      .where(eq(tenantComponentCodes.tenantId, ctx.user.tenantId));

    return codes;
  }),

  /**
   * Save component code customization
   */
  saveComponentCode: hrManagerProcedure
    .input(saveComponentCodeSchema)
    .mutation(async ({ input, ctx }) => {
      // Check if code exists
      const [existing] = await db
        .select()
        .from(tenantComponentCodes)
        .where(
          and(
            eq(tenantComponentCodes.tenantId, ctx.user.tenantId),
            eq(tenantComponentCodes.componentType, input.componentType)
          )
        );

      if (existing) {
        // Update
        const [updated] = await db
          .update(tenantComponentCodes)
          .set({
            customCode: input.customCode,
            customDescription: input.customDescription,
            componentDefinitionId: input.componentDefinitionId,
          })
          .where(eq(tenantComponentCodes.id, existing.id))
          .returning();

        return updated;
      } else {
        // Create
        const [created] = await db
          .insert(tenantComponentCodes)
          .values({
            tenantId: ctx.user.tenantId,
            componentDefinitionId: input.componentDefinitionId,
            componentType: input.componentType,
            customCode: input.customCode,
            customDescription: input.customDescription,
          })
          .returning();

        return created;
      }
    }),

  /**
   * Generate Pay Register (Livre de Paie) by payment frequency
   *
   * Generates separate pay registers for different payment frequencies:
   * - Monthly workers: 1 register per month
   * - Weekly workers: 4 registers per month (Semaine 1-4)
   * - Biweekly workers: 2 registers per month (Quinzaine 1-2)
   *
   * Reference: DAILY-WORKERS-ARCHITECTURE-V2.md Section 10.5
   */
  exportPayRegister: hrManagerProcedure
    .input(exportPayRegisterSchema)
    .mutation(async ({ input, ctx }) => {
      // Parse month (YYYY-MM format)
      const [yearStr, monthStr] = input.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Get period boundaries
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0); // Last day of month

      // Find payroll runs matching frequency, closure sequence, and period
      const runs = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.tenantId, ctx.user.tenantId),
            eq((payrollRuns as any).paymentFrequency, input.paymentFrequency),
            input.closureSequence
              ? eq((payrollRuns as any).closureSequence, input.closureSequence)
              : isNull((payrollRuns as any).closureSequence),
            eq(payrollRuns.status, 'approved') // Only approved runs
          )
        );

      if (runs.length === 0) {
        throw new Error(
          `Aucune paie approuvée trouvée pour ${input.paymentFrequency} ${
            input.closureSequence ? `(${input.closureSequence})` : ''
          }`
        );
      }

      // Get all payroll line items for these runs
      const runIds = runs.map((r) => r.id);
      const lineItems = await db
        .select({
          lineItem: payrollLineItems,
          employee: employees,
        })
        .from(payrollLineItems)
        .innerJoin(employees, eq(payrollLineItems.employeeId, employees.id))
        .where(eq(payrollLineItems.payrollRunId, runIds[0])); // TODO: Support multiple runs aggregation

      // Get tenant info
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.user.tenantId))
        .limit(1);

      if (!tenant) {
        throw new Error('Entreprise non trouvée');
      }

      // Transform data for pay register export
      const exportData: PayRegisterExportData = {
        companyName: tenant.name || 'N/A',
        companyCNPS: (tenant.settings as any)?.cnpsNumber || undefined,
        companyTaxId: tenant.taxId || undefined,
        periodStart,
        periodEnd,
        paymentFrequency: input.paymentFrequency as PaymentFrequency,
        closureSequence: input.closureSequence,
        employees: lineItems.map((item) => {
          const allowances = item.lineItem.allowances as Record<string, number> || {};
          const earnings = item.lineItem.earningsDetails as Record<string, number> || {};
          const deductions = item.lineItem.taxDeductions as Record<string, number> || {};
          const employeeContribs = item.lineItem.employeeContributions as Record<string, number> || {};
          const employerContribs = item.lineItem.employerContributions as Record<string, number> || {};

          return {
            employeeNumber: item.employee.employeeNumber || 'N/A',
            employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
            position: (item.employee as any).position || undefined,
            baseSalary: parseFloat(String(item.lineItem.baseSalary || '0')),
            housingAllowance: allowances.HOUSING,
            transportAllowance: allowances.TRANSPORT || earnings.TRANSP_DAY,
            mealAllowance: allowances.MEAL,
            seniorityBonus: allowances.SENIORITY,
            familyAllowance: allowances.FAMILY,
            overtimePay: earnings.OVERTIME,
            bonuses: earnings.BONUS,
            gratification: earnings.GRAT_JOUR, // CDDTI component
            congesPayes: earnings.CONGE_JOUR, // CDDTI component
            indemnitePrecarite: earnings.PREC_JOUR, // CDDTI component
            grossSalary: parseFloat(String(item.lineItem.grossSalary || '0')),
            cnpsEmployee: employeeContribs.CNPS_PENSION || 0,
            cmuEmployee: employeeContribs.CMU || 0,
            its: parseFloat(String(deductions.ITS || '0')),
            totalDeductions: parseFloat(String(item.lineItem.totalDeductions || '0')),
            netSalary: parseFloat(String(item.lineItem.netSalary || '0')),
            cnpsEmployer: employerContribs.CNPS_PENSION || 0,
            cmuEmployer: employerContribs.CMU || 0,
            fdfp: employerContribs.FDFP,
            workAccident: employerContribs.WORK_ACCIDENT,
            employerPayrollTax: employerContribs.EMPLOYER_TAX,
            totalEmployerCost: parseFloat(String(item.lineItem.totalEmployerCost || '0')),
            daysWorked: parseFloat(String(item.lineItem.daysWorked || '0')),
            hoursWorked: undefined, // TODO: Extract from time_entries_summary
            paymentMethod: item.lineItem.paymentMethod || undefined,
            bankAccount: item.lineItem.bankAccount || undefined,
          };
        }),
      };

      // Generate Excel file
      const fileBuffer = generatePayRegisterExcel(exportData);
      const fileName = generatePayRegisterFilename(
        input.paymentFrequency as PaymentFrequency,
        input.closureSequence,
        periodStart
      );

      return {
        fileContent: Buffer.from(fileBuffer).toString('base64'),
        fileName,
        employeeCount: exportData.employees.length,
        title: formatPayRegisterTitle(
          input.paymentFrequency as PaymentFrequency,
          input.closureSequence,
          periodStart
        ),
      };
    }),
});
