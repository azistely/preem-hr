/**
 * Time Tracking Import Router
 *
 * Three-phase workflow for importing time entries from biometric devices:
 * 1. uploadFile - Upload CSV/Excel to Supabase Storage
 * 2. validateFile - Parse, validate, preview data
 * 3. executeImport - Create time entries in database
 *
 * Supports: ZKTeco, Anviz, Generic CSV
 * Access: HR Manager, Tenant Admin, Super Admin only
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { parseBiometricFile } from '@/lib/time-tracking-import/biometric-parser';
import { DeviceType } from '@/lib/time-tracking-import/device-formats';
import { createClient } from '@/lib/supabase/server';
import { employees, timeEntries } from '@/drizzle/schema';
import { db } from '@/db';
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { differenceInMinutes } from 'date-fns';

/**
 * Validation schemas
 */
const uploadFileSchema = z.object({
  file: z.string().describe('Base64 encoded file'),
  filename: z.string(),
  deviceType: z.enum(['zkteco', 'anviz', 'generic']).optional(),
});

const validateFileSchema = z.object({
  fileId: z.string(),
  deviceType: z.enum(['zkteco', 'anviz', 'generic']).optional(),
  columnMapping: z.record(z.string()).optional(),
  timezoneOffset: z.number().optional().describe('Timezone offset in minutes (e.g., GMT+1 = 60)'),
});

const executeImportSchema = z.object({
  fileId: z.string(),
  deviceType: z.enum(['zkteco', 'anviz', 'generic']),
  employeeMapping: z.record(z.string()).describe('Map device employee ID → system employee ID'),
  columnMapping: z.record(z.string()).optional(),
  timezoneOffset: z.number().optional(),
  skipErrors: z.boolean().default(false),
  autoApprove: z.boolean().optional().describe('Auto-approve if user is HR/admin'),
});

export const timeTrackingImportRouter = createTRPCRouter({
  /**
   * Phase 1: Upload file to Supabase Storage
   */
  uploadFile: hrManagerProcedure
    .input(uploadFileSchema)
    .mutation(async ({ input, ctx }) => {
      const { file, filename, deviceType } = input;

      try {
        // Validate file size (max 10MB)
        const fileSizeBytes = Buffer.from(file, 'base64').length;
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB

        if (fileSizeBytes > maxSizeBytes) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fichier trop volumineux. Taille maximum: 10MB',
          });
        }

        // Validate file extension
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const hasValidExtension = validExtensions.some(ext =>
          filename.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format de fichier invalide. Formats acceptés: CSV, Excel (.csv, .xlsx, .xls)',
          });
        }

        // Create Supabase client
        const supabase = await createClient();

        // Generate file path
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${ctx.user.tenantId}/time-entries/${timestamp}-${sanitizedFilename}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('time-tracking-imports')
          .upload(filePath, Buffer.from(file, 'base64'), {
            contentType: filename.endsWith('.csv')
              ? 'text/csv'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upsert: false,
          });

        if (error) {
          console.error('[Time Tracking Import] Upload error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erreur lors du téléchargement: ${error.message}`,
          });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('time-tracking-imports')
          .getPublicUrl(filePath);

        return {
          fileId: filePath,
          url: urlData.publicUrl,
          filename: sanitizedFilename,
          deviceType: deviceType || null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[Time Tracking Import] Upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du téléchargement du fichier',
        });
      }
    }),

  /**
   * Phase 2: Validate file and return preview
   */
  validateFile: hrManagerProcedure
    .input(validateFileSchema)
    .mutation(async ({ input, ctx }) => {
      const { fileId, deviceType, columnMapping, timezoneOffset } = input;

      try {
        // Download file from Supabase Storage
        const supabase = await createClient();
        const { data, error } = await supabase.storage
          .from('time-tracking-imports')
          .download(fileId);

        if (error || !data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Fichier introuvable',
          });
        }

        // Convert blob to buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse file
        const parseResult = await parseBiometricFile(buffer, fileId, {
          deviceType,
          columnMapping,
          timezoneOffset,
          tenantId: ctx.user.tenantId,
        });

        // Resolve employee mappings
        const deviceEmployeeIds = parseResult.employeeMappings.map(m => m.deviceEmployeeId);

        // Fetch all active employees for this tenant
        const activeEmployees = await db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
            email: employees.email,
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, ctx.user.tenantId),
              eq(employees.status, 'active')
            )
          );

        // Match device employees to system employees
        const resolvedMappings = parseResult.employeeMappings.map(mapping => {
          // Try exact match by employee number
          const exactMatch = activeEmployees.find(
            emp => emp.employeeNumber.toLowerCase() === mapping.deviceEmployeeId.toLowerCase()
          );

          if (exactMatch) {
            return {
              ...mapping,
              employeeId: exactMatch.id,
              employeeNumber: exactMatch.employeeNumber,
              employeeName: `${exactMatch.firstName} ${exactMatch.lastName}`,
              matchType: 'exact' as const,
            };
          }

          // Try fuzzy match by name (if device has name)
          if (mapping.deviceEmployeeName) {
            const fuzzyMatch = activeEmployees.find(emp => {
              const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
              const deviceName = mapping.deviceEmployeeName!.toLowerCase();
              return fullName.includes(deviceName) || deviceName.includes(fullName);
            });

            if (fuzzyMatch) {
              return {
                ...mapping,
                employeeId: fuzzyMatch.id,
                employeeNumber: fuzzyMatch.employeeNumber,
                employeeName: `${fuzzyMatch.firstName} ${fuzzyMatch.lastName}`,
                matchType: 'fuzzy' as const,
              };
            }
          }

          // No match found
          return mapping;
        });

        // Check for duplicates in database
        if (parseResult.pairedEntries.length > 0) {
          const employeeIds = resolvedMappings
            .filter(m => m.employeeId)
            .map(m => m.employeeId!);

          const dateRange = parseResult.stats.dateRange;
          if (employeeIds.length > 0 && dateRange) {
            // Query existing time entries in this date range
            const existingEntries = await db.query.timeEntries.findMany({
              where: and(
                eq(timeEntries.tenantId, ctx.user.tenantId),
                inArray(timeEntries.employeeId, employeeIds),
                gte(timeEntries.clockIn, dateRange.start.toISOString()),
                lte(timeEntries.clockIn, dateRange.end.toISOString())
              ),
              columns: {
                employeeId: true,
                clockIn: true,
              },
            });

            // Flag potential duplicates (same employee, clockIn within 5 minutes)
            for (const pair of parseResult.pairedEntries) {
              const mapping = resolvedMappings.find(m => m.deviceEmployeeId === pair.deviceEmployeeId);
              if (!mapping?.employeeId) continue;

              const isDuplicate = existingEntries.some(existing => {
                if (existing.employeeId !== mapping.employeeId) return false;

                const existingClockIn = new Date(existing.clockIn);
                const minutesDiff = Math.abs(differenceInMinutes(pair.clockIn, existingClockIn));
                return minutesDiff < 5; // Same punch within 5 minutes
              });

              if (isDuplicate) {
                parseResult.errors.push({
                  row: pair.inRowNumber,
                  message: `Doublon potentiel: Cette entrée existe déjà pour ${mapping.deviceEmployeeName || mapping.deviceEmployeeId}`,
                  severity: 'warning',
                  code: 'POTENTIAL_DUPLICATE',
                });
              }
            }
          }
        }

        // Flag overtime (>8h/day or >40h/week based on country rules)
        for (const pair of parseResult.pairedEntries) {
          if (pair.totalHours > 8) {
            parseResult.errors.push({
              row: pair.inRowNumber,
              message: `Heures supplémentaires détectées: ${pair.totalHours.toFixed(1)}h (${pair.deviceEmployeeName || pair.deviceEmployeeId})`,
              severity: 'warning',
              code: 'OVERTIME_DETECTED',
            });
          }
        }

        // Flag missing pairs
        for (const unpaired of parseResult.unpairedPunches) {
          parseResult.errors.push({
            row: unpaired.rowNumber,
            message: `Pointage ${unpaired.direction === 'in' ? 'entrée' : 'sortie'} sans correspondance pour ${unpaired.deviceEmployeeName || unpaired.deviceEmployeeId}`,
            severity: 'warning',
            code: 'MISSING_PAIR',
          });
        }

        return {
          deviceType: parseResult.deviceType,
          stats: parseResult.stats,
          pairedEntries: parseResult.pairedEntries,
          unpairedPunches: parseResult.unpairedPunches,
          employeeMappings: resolvedMappings,
          errors: parseResult.errors,
          preview: parseResult.rows.slice(0, 10), // First 10 rows
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[Time Tracking Import] Validation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erreur lors de la validation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        });
      }
    }),

  /**
   * Phase 3: Execute import (create time entries)
   */
  executeImport: hrManagerProcedure
    .input(executeImportSchema)
    .mutation(async ({ input, ctx }) => {
      const { fileId, deviceType, employeeMapping, columnMapping, timezoneOffset, skipErrors, autoApprove } = input;

      try {
        // Re-parse file with latest settings
        const supabase = await createClient();
        const { data, error } = await supabase.storage
          .from('time-tracking-imports')
          .download(fileId);

        if (error || !data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Fichier introuvable',
          });
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parseResult = await parseBiometricFile(buffer, fileId, {
          deviceType,
          columnMapping,
          timezoneOffset,
          tenantId: ctx.user.tenantId,
        });

        // Apply employee mapping
        const allPairs = parseResult.pairedEntries.map(pair => ({
          ...pair,
          employeeId: employeeMapping[pair.deviceEmployeeId],
        }));

        const mappedPairs = allPairs.filter(pair => pair.employeeId); // Only import mapped employees
        const unmappedPairs = allPairs.filter(pair => !pair.employeeId);
        const unmappedEntriesCount = unmappedPairs.length;
        const unmappedEmployeesCount = new Set(unmappedPairs.map(p => p.deviceEmployeeId)).size;

        if (mappedPairs.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Aucune entrée valide à importer. Vérifiez le mapping des employés.',
          });
        }

        // Determine approval status
        const isHROrAdmin = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        const shouldAutoApprove = autoApprove !== undefined ? autoApprove : isHROrAdmin;
        const entryStatus = shouldAutoApprove ? 'approved' : 'pending';

        // Create time entries
        const results = [];
        const errors = [];
        const batchId = `import-${Date.now()}`;

        for (const pair of mappedPairs) {
          try {
            const [createdEntry] = await db
              .insert(timeEntries)
              .values({
                tenantId: ctx.user.tenantId,
                employeeId: pair.employeeId,
                clockIn: pair.clockIn.toISOString(),
                clockOut: pair.clockOut.toISOString(),
                totalHours: pair.totalHours.toString(),
                entrySource: 'biometric',
                status: entryStatus,
                approvedBy: shouldAutoApprove ? ctx.user.id : null,
                approvedAt: shouldAutoApprove ? new Date().toISOString() : null,
                importMetadata: {
                  batch_id: batchId,
                  device_type: deviceType,
                  device_id: pair.deviceId,
                  device_location: pair.deviceLocation,
                  in_row_number: pair.inRowNumber,
                  out_row_number: pair.outRowNumber,
                  device_employee_id: pair.deviceEmployeeId,
                  device_employee_name: pair.deviceEmployeeName,
                },
                entryType: 'regular',
              })
              .returning();

            results.push({
              employeeId: pair.employeeId,
              workDate: pair.workDate,
              totalHours: pair.totalHours,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
            errors.push({
              employeeId: pair.deviceEmployeeId,
              workDate: pair.workDate,
              error: errorMessage,
            });

            if (!skipErrors) {
              // Rollback and throw
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Erreur lors de l'import: ${errorMessage}`,
              });
            }
          }
        }

        return {
          imported: results.length,
          skipped: errors.length,
          unmappedEmployees: unmappedEmployeesCount,
          unmappedEntries: unmappedEntriesCount,
          batchId,
          status: entryStatus,
          results,
          errors,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[Time Tracking Import] Execute error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erreur lors de l'import: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        });
      }
    }),
});
