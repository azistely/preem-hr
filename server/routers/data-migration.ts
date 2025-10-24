/**
 * Data Migration tRPC Router
 *
 * Handles SAGE/CIEL data import operations:
 * - Employee import with field mapping
 * - Historical payroll import
 * - Migration status tracking
 * - Validation and error reporting
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { sageImportService, type SAGEImportConfig } from '@/lib/data-migration/sage-import.service';
import { db } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { dataMigrations, employeeImportStaging, historicalPayrollData } from '@/lib/db/schema';

// ============================================================================
// Zod Schemas
// ============================================================================

const fieldMappingSchema = z.object({
  sageField: z.string().min(1, 'Le champ SAGE est requis'),
  preemField: z.string().min(1, 'Le champ Preem est requis'),
  transformation: z.enum(['uppercase', 'lowercase', 'trim', 'date_parse']).optional(),
  defaultValue: z.union([z.string(), z.number()]).optional(),
});

const importConfigSchema = z.object({
  employeeFields: z.array(fieldMappingSchema).default([]),
  payrollFields: z.array(fieldMappingSchema).default([]),
  dateFormat: z.string().default('DD/MM/YYYY'),
  encoding: z.string().default('ISO-8859-1'),
  delimiter: z.string().default(';'),
});

const importEmployeesSchema = z.object({
  file: z.instanceof(File, { message: 'Fichier requis' }),
  mapping: importConfigSchema,
});

const importPayrollSchema = z.object({
  file: z.instanceof(File, { message: 'Fichier requis' }),
  mapping: importConfigSchema,
});

const getMigrationSchema = z.object({
  migrationId: z.string().uuid('ID de migration invalide'),
});

const listMigrationsSchema = z.object({
  migrationType: z.enum(['sage_employees', 'sage_payroll', 'sage_accounts']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const getStagingRecordsSchema = z.object({
  migrationId: z.string().uuid('ID de migration invalide'),
  validationStatus: z.enum(['pending', 'valid', 'invalid', 'warning']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const getHistoricalPayrollSchema = z.object({
  employeeNumber: z.string().min(1, 'Matricule requis'),
  limit: z.number().int().min(1).max(24).default(12),
});

// ============================================================================
// Router
// ============================================================================

export const dataMigrationRouter = createTRPCRouter({
  /**
   * Import employees from SAGE export file
   */
  importEmployees: hrManagerProcedure
    .input(importEmployeesSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;

        // Validate file type
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const hasValidExtension = validExtensions.some((ext) =>
          input.file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format de fichier invalide. Utilisez CSV ou Excel (.xlsx, .xls)',
          });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (input.file.size > maxSize) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fichier trop volumineux. Taille maximale: 10 MB',
          });
        }

        const result = await sageImportService.importEmployees(
          tenantId,
          input.file,
          input.mapping,
          ctx.user.id
        );

        return {
          success: true,
          migrationId: result.migrationId,
          totalRecords: result.totalRecords,
          imported: result.imported,
          failed: result.failed,
          errors: result.errors,
          message: `Import terminé: ${result.imported} employés importés sur ${result.totalRecords}`,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? `Erreur lors de l'import: ${error.message}`
              : 'Erreur inconnue lors de l\'import',
        });
      }
    }),

  /**
   * Import historical payroll data from SAGE
   */
  importHistoricalPayroll: hrManagerProcedure
    .input(importPayrollSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;

        // Validate file type
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const hasValidExtension = validExtensions.some((ext) =>
          input.file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format de fichier invalide. Utilisez CSV ou Excel (.xlsx, .xls)',
          });
        }

        // Validate file size (max 20MB for payroll data)
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (input.file.size > maxSize) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fichier trop volumineux. Taille maximale: 20 MB',
          });
        }

        const result = await sageImportService.importHistoricalPayroll(
          tenantId,
          input.file,
          input.mapping,
          ctx.user.id
        );

        return {
          success: true,
          migrationId: result.migrationId,
          totalRecords: result.totalRecords,
          imported: result.imported,
          failed: result.failed,
          errors: result.errors,
          message: `Import terminé: ${result.imported} lignes de paie importées sur ${result.totalRecords}`,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? `Erreur lors de l'import: ${error.message}`
              : 'Erreur inconnue lors de l\'import',
        });
      }
    }),

  /**
   * Get migration details by ID
   */
  getMigration: hrManagerProcedure
    .input(getMigrationSchema)
    .query(async ({ ctx, input }) => {
      const [migration] = await db
        .select()
        .from(dataMigrations)
        .where(
          and(
            eq(dataMigrations.id, input.migrationId),
            eq(dataMigrations.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!migration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Migration introuvable',
        });
      }

      return migration;
    }),

  /**
   * List all migrations for the tenant
   */
  listMigrations: hrManagerProcedure
    .input(listMigrationsSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(dataMigrations.tenantId, ctx.user.tenantId)];

      if (input.migrationType) {
        conditions.push(eq(dataMigrations.migrationType, input.migrationType));
      }

      const migrations = await db
        .select()
        .from(dataMigrations)
        .where(and(...conditions))
        .orderBy(desc(dataMigrations.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        migrations,
        total: migrations.length,
        hasMore: migrations.length === input.limit,
      };
    }),

  /**
   * Get staging records for a migration (for validation review)
   */
  getStagingRecords: hrManagerProcedure
    .input(getStagingRecordsSchema)
    .query(async ({ ctx, input }) => {
      // First verify migration belongs to tenant
      const [migration] = await db
        .select()
        .from(dataMigrations)
        .where(
          and(
            eq(dataMigrations.id, input.migrationId),
            eq(dataMigrations.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!migration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Migration introuvable',
        });
      }

      const conditions = [eq(employeeImportStaging.migrationId, input.migrationId)];

      if (input.validationStatus) {
        conditions.push(eq(employeeImportStaging.validationStatus, input.validationStatus));
      }

      const records = await db
        .select()
        .from(employeeImportStaging)
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset);

      return {
        records,
        total: records.length,
        hasMore: records.length === input.limit,
      };
    }),

  /**
   * Get historical payroll data for an employee
   */
  getEmployeePayrollHistory: hrManagerProcedure
    .input(getHistoricalPayrollSchema)
    .query(async ({ ctx, input }) => {
      const history = await db
        .select()
        .from(historicalPayrollData)
        .where(
          and(
            eq(historicalPayrollData.tenantId, ctx.user.tenantId),
            eq(historicalPayrollData.employeeNumber, input.employeeNumber)
          )
        )
        .orderBy(desc(historicalPayrollData.payrollPeriod))
        .limit(input.limit);

      return {
        history,
        employeeNumber: input.employeeNumber,
        total: history.length,
      };
    }),

  /**
   * Get migration summary statistics
   */
  getMigrationStats: hrManagerProcedure.query(async ({ ctx }) => {
    const allMigrations = await db
      .select()
      .from(dataMigrations)
      .where(eq(dataMigrations.tenantId, ctx.user.tenantId));

    type Migration = typeof allMigrations[0];

    const stats = {
      totalMigrations: allMigrations.length,
      byType: {
        employees: allMigrations.filter((m: Migration) => m.migrationType === 'sage_employees').length,
        payroll: allMigrations.filter((m: Migration) => m.migrationType === 'sage_payroll').length,
        accounts: allMigrations.filter((m: Migration) => m.migrationType === 'sage_accounts').length,
      },
      byStatus: {
        pending: allMigrations.filter((m: Migration) => m.migrationStatus === 'pending').length,
        processing: allMigrations.filter((m: Migration) => m.migrationStatus === 'processing').length,
        completed: allMigrations.filter((m: Migration) => m.migrationStatus === 'completed').length,
        failed: allMigrations.filter((m: Migration) => m.migrationStatus === 'failed').length,
        cancelled: allMigrations.filter((m: Migration) => m.migrationStatus === 'cancelled').length,
      },
      totalRecordsImported: allMigrations.reduce(
        (sum: number, m: Migration) => sum + (m.importedRecords || 0),
        0
      ),
      totalRecordsFailed: allMigrations.reduce(
        (sum: number, m: Migration) => sum + (m.failedRecords || 0),
        0
      ),
    };

    return stats;
  }),

  /**
   * Cancel a pending or processing migration
   */
  cancelMigration: hrManagerProcedure
    .input(getMigrationSchema)
    .mutation(async ({ ctx, input }) => {
      const [migration] = await db
        .select()
        .from(dataMigrations)
        .where(
          and(
            eq(dataMigrations.id, input.migrationId),
            eq(dataMigrations.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!migration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Migration introuvable',
        });
      }

      if (!['pending', 'processing'].includes(migration.migrationStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible d\'annuler une migration terminée ou échouée',
        });
      }

      await db
        .update(dataMigrations)
        .set({
          migrationStatus: 'cancelled',
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataMigrations.id, input.migrationId));

      return {
        success: true,
        message: 'Migration annulée avec succès',
      };
    }),
});
