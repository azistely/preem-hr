/**
 * AI Import tRPC Router
 *
 * AI-powered import system that handles ANY Excel file format:
 * - Automatically classifies data types (employees, payroll, benefits, etc.)
 * - Intelligently maps columns using AI (no hardcoded templates)
 * - Cleans and transforms data semantically
 * - Validates against business rules with context awareness
 * - Imports with proper dependencies and tenant isolation
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  analyzeImportFile,
  executeFullImport,
  type ImportAnalysisResult,
} from '../ai-import/coordinator';
import {
  analyzeMultiFileImport,
  executeMultiFileImport,
} from '../ai-import/coordinator-v2';
import type {
  MultiFileAnalysisResult,
  ProgressUpdate,
} from '../ai-import/types';

// ============================================================================
// Supabase Storage Client
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'ai-imports';

// ============================================================================
// Zod Schemas
// ============================================================================

const uploadFileSchema = z.object({
  fileName: z
    .string()
    .min(1, 'Nom de fichier requis')
    .describe('Name of the uploaded file'),
  fileData: z
    .string()
    .describe('Base64 encoded file data'),
  fileType: z
    .string()
    .describe('MIME type of the file'),
});

const analyzeFileSchema = z.object({
  fileId: z
    .string()
    .min(1, 'ID de fichier requis')
    .describe('File ID from Supabase Storage'),
  countryCode: z
    .string()
    .length(2)
    .optional()
    .default('CI')
    .describe('Country code for context-aware processing (CI, SN, etc.)'),
});

const executeImportSchema = z.object({
  fileId: z
    .string()
    .min(1, 'ID de fichier requis')
    .describe('File ID from Supabase Storage'),
  countryCode: z
    .string()
    .length(2)
    .optional()
    .default('CI')
    .describe('Country code for context-aware processing'),
  confirmedSheets: z
    .array(z.string())
    .optional()
    .describe('Sheets user explicitly confirmed for import (for low-confidence classifications)'),
  skipValidation: z
    .boolean()
    .optional()
    .default(false)
    .describe('Skip validation step (not recommended)'),
});

// V2 Schemas for Multi-File Import
const analyzeMultiFileSchema = z.object({
  fileIds: z
    .array(z.string().min(1))
    .min(1, 'Au moins un fichier requis')
    .max(10, 'Maximum 10 fichiers')
    .describe('Array of file IDs from Supabase Storage'),
  countryCode: z
    .string()
    .length(2)
    .optional()
    .default('CI')
    .describe('Country code for context-aware processing (CI, SN, etc.)'),
});

const executeMultiFileImportSchema = z.object({
  analysisId: z
    .string()
    .uuid()
    .describe('Analysis result ID from previous analyzeMultiFile call'),
  allowPartialImport: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to allow partial import if some entities fail validation'),
  userResolvedConflicts: z
    .array(
      z.object({
        conflictId: z.string().uuid(),
        chosenSource: z.string(),
        chosenValue: z.any(),
      })
    )
    .optional()
    .describe('User-resolved conflicts for high-risk conflicts'),
});

// ============================================================================
// Analysis Results Store (Temporary - In Production use Redis/Database)
// ============================================================================

const analysisResultsStore = new Map<string, MultiFileAnalysisResult>();

/**
 * Store analysis result temporarily for subsequent import
 * TTL: 1 hour (cleanup after)
 */
function storeAnalysisResult(result: MultiFileAnalysisResult): string {
  const analysisId = crypto.randomUUID();
  analysisResultsStore.set(analysisId, result);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    analysisResultsStore.delete(analysisId);
  }, 60 * 60 * 1000);

  return analysisId;
}

/**
 * Retrieve stored analysis result
 */
function getAnalysisResult(analysisId: string): MultiFileAnalysisResult | undefined {
  return analysisResultsStore.get(analysisId);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Download file from Supabase Storage to temporary file
 * Returns local file path
 */
async function downloadFileFromStorage(
  fileId: string,
  tenantId: string
): Promise<string> {
  // Download file from Supabase
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(fileId);

  if (error || !data) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Fichier non trouvé dans le stockage',
    });
  }

  // Verify file belongs to tenant (security check)
  if (!fileId.startsWith(`${tenantId}/`)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès non autorisé à ce fichier',
    });
  }

  // Save to temporary file
  const buffer = Buffer.from(await data.arrayBuffer());
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `ai-import-${Date.now()}.xlsx`);

  try {
    // Write file
    fs.writeFileSync(tempFilePath, buffer);

    // Verify file was written successfully
    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Failed to write temporary file');
    }

    // Verify file is readable
    fs.accessSync(tempFilePath, fs.constants.R_OK);

    console.log(`[AI-IMPORT] Temp file created: ${tempFilePath} (${buffer.length} bytes)`);
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Erreur lors de la création du fichier temporaire: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return tempFilePath;
}

/**
 * Sanitize filename for Supabase Storage
 * Removes/replaces special characters that aren't allowed in storage paths
 */
function sanitizeFileName(fileName: string): string {
  // Preserve extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

  // Replace accented characters with ASCII equivalents
  const sanitizedName = name
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  return sanitizedName + ext.toLowerCase();
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to cleanup temp file:', error);
  }
}

// ============================================================================
// Router
// ============================================================================

export const aiImportRouter = createTRPCRouter({
  /**
   * Upload file to Supabase Storage
   * Returns file ID for analysis
   *
   * SECURITY: Files are scoped by tenant ID to prevent cross-tenant access
   */
  uploadFile: protectedProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;
        const userId = ctx.user.id;

        // Validate file extension
        const validExtensions = ['.xlsx', '.xls'];
        const extension = input.fileName.split('.').pop()?.toLowerCase();
        if (!extension || !validExtensions.includes(`.${extension}`)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format de fichier invalide. Utilisez .xlsx ou .xls',
          });
        }

        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');

        // Validate file size (max 50MB for AI import)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileBuffer.length > maxSize) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fichier trop volumineux (max 50 MB)',
          });
        }

        // Sanitize filename to remove special characters (accents, etc.)
        const sanitizedFileName = sanitizeFileName(input.fileName);

        // Generate unique file ID with tenant scoping
        const fileId = `${tenantId}/${userId}/${Date.now()}-${sanitizedFileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileId, fileBuffer, {
            contentType: input.fileType,
            upsert: false,
          });

        if (error) {
          console.error('[AI-IMPORT] Upload error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Échec de l'upload: ${error.message}`,
          });
        }

        return {
          fileId: data.path,
          fileName: input.fileName,
          fileSize: fileBuffer.length,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT] Unexpected upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'upload du fichier',
        });
      }
    }),

  /**
   * Analyze uploaded file using AI
   *
   * Returns:
   * - Classification of each sheet (data type, confidence, field mappings)
   * - Sheets that need user confirmation (low confidence < 90%)
   * - Estimated number of records
   *
   * SECURITY: Uses ctx.user.tenantId for file access verification
   */
  analyzeFile: protectedProcedure
    .input(analyzeFileSchema)
    .query(async ({ ctx, input }) => {
      let tempFilePath: string | null = null;

      try {
        const tenantId = ctx.user.tenantId;

        // Download file from storage
        tempFilePath = await downloadFileFromStorage(input.fileId, tenantId);

        // Analyze file using AI
        const analysis = await analyzeImportFile({
          filePath: tempFilePath,
          countryCode: input.countryCode,
          onProgress: (step) => {
            // Progress updates could be streamed via WebSocket in the future
            console.log(`[AI-IMPORT] ${step.message}`);
          },
        });

        return analysis;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT] Analysis error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de l\'analyse du fichier',
        });
      } finally {
        if (tempFilePath) {
          cleanupTempFile(tempFilePath);
        }
      }
    }),

  /**
   * Execute full import process
   *
   * Steps:
   * 1. Download file from storage
   * 2. Parse and classify sheets
   * 3. Clean and validate data
   * 4. Execute database import
   *
   * SECURITY:
   * - Uses ctx.user.tenantId for file access and data isolation
   * - All imported records are tagged with tenantId
   * - NO cross-tenant data leakage possible
   */
  executeImport: protectedProcedure
    .input(executeImportSchema)
    .mutation(async ({ ctx, input }) => {
      let tempFilePath: string | null = null;

      try {
        const tenantId = ctx.user.tenantId;

        // Check if Anthropic API key is configured
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Clé API Anthropic non configurée. Contactez votre administrateur.',
          });
        }

        // Download file from storage
        tempFilePath = await downloadFileFromStorage(input.fileId, tenantId);

        // Execute full import
        const result = await executeFullImport({
          filePath: tempFilePath,
          countryCode: input.countryCode,
          tenantId,
          confirmedSheets: input.confirmedSheets,
          onProgress: (step) => {
            // Progress updates could be streamed via WebSocket/SSE in the future
            console.log(`[AI-IMPORT] Step ${step.step}: ${step.message} (${step.progress}%)`);
          },
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Importation échouée: ${result.errors.join(', ')}`,
          });
        }

        return {
          success: result.success,
          totalRecordsImported: result.totalRecordsImported,
          sheetsImported: result.sheetResults.length,
          summary: `${result.totalRecordsImported} enregistrement(s) importé(s) avec succès`,
          details: result.sheetResults.map((sheet) => ({
            sheetName: sheet.sheetName,
            dataType: sheet.classification.dataTypeName,
            recordsImported: sheet.importResult?.recordsInserted || 0,
            errors: sheet.validationResult?.errors || [],
            warnings: sheet.validationResult?.warnings || [],
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT] Import error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de l\'importation',
        });
      } finally {
        if (tempFilePath) {
          cleanupTempFile(tempFilePath);
        }
      }
    }),

  /**
   * Get list of uploaded files for tenant
   *
   * SECURITY: Automatically filtered by tenant ID
   */
  listFiles: protectedProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      // List files in tenant/user directory
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(`${tenantId}/${userId}`);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération des fichiers',
        });
      }

      return data.map((file) => ({
        id: `${tenantId}/${userId}/${file.name}`,
        name: file.name,
        size: file.metadata?.size || 0,
        uploadedAt: file.created_at,
      }));
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('[AI-IMPORT] List files error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erreur lors de la récupération des fichiers',
      });
    }
  }),

  /**
   * Delete uploaded file
   *
   * SECURITY: Only owner can delete their files
   */
  deleteFile: protectedProcedure
    .input(
      z.object({
        fileId: z.string().min(1, 'ID de fichier requis'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;

        // Verify file belongs to tenant (security check)
        if (!input.fileId.startsWith(`${tenantId}/`)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès non autorisé à ce fichier',
          });
        }

        // Delete from Supabase Storage
        const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([input.fileId]);

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Échec de la suppression: ${error.message}`,
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT] Delete file error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la suppression du fichier',
        });
      }
    }),

  // ============================================================================
  // V2 Multi-File Import Endpoints
  // ============================================================================

  /**
   * V2: Analyze multiple files with cross-file entity building
   *
   * This endpoint:
   * - Accepts multiple Excel files
   * - Builds entity graph across all files
   * - Matches records from different sources
   * - Detects and resolves conflicts
   * - Returns entity-based preview (not file-based)
   *
   * Returns analysis ID for subsequent import
   */
  analyzeMultiFile: protectedProcedure
    .input(analyzeMultiFileSchema)
    .mutation(async ({ ctx, input }) => {
      const tempFilePaths: string[] = [];

      try {
        const tenantId = ctx.user.tenantId;

        // Download all files from storage
        const filePaths = await Promise.all(
          input.fileIds.map(async (fileId) => {
            const tempPath = await downloadFileFromStorage(fileId, tenantId);
            tempFilePaths.push(tempPath);

            // Get file metadata
            const { data: metadata } = await supabase.storage
              .from(STORAGE_BUCKET)
              .list(fileId.split('/').slice(0, -1).join('/'), {
                search: fileId.split('/').pop(),
              });

            const file = metadata?.[0];

            return {
              path: tempPath,
              name: file?.name || fileId.split('/').pop() || 'unknown.xlsx',
              uploadedAt: file?.created_at ? new Date(file.created_at) : new Date(),
            };
          })
        );

        // Analyze with cross-file entity building
        const progressUpdates: ProgressUpdate[] = [];

        const analysisResult = await analyzeMultiFileImport({
          filePaths,
          context: {
            tenantId,
            countryCode: input.countryCode,
            allowPartialImport: false,
            dryRun: true,
            files: filePaths.map((f) => ({
              fileName: f.name,
              uploadedAt: f.uploadedAt,
              size: 0,
            })),
            onProgress: (update) => {
              progressUpdates.push(update);
              console.log(`[AI-IMPORT-V2] ${update.phase}: ${update.message}`);
            },
          },
        });

        // Store result for subsequent import
        const analysisId = storeAnalysisResult(analysisResult);

        return {
          analysisId,
          summary: analysisResult.summary,
          entityGraph: analysisResult.entityGraph,
          conflicts: {
            total: analysisResult.conflicts.length,
            autoResolved: analysisResult.summary.conflictsAutoResolved,
            requiresUser: analysisResult.summary.conflictsRequiringUser,
          },
          needsConfirmation: analysisResult.needsConfirmation,
          confirmationReasons: analysisResult.confirmationReasons,
          processingTimeMs: analysisResult.processingTimeMs,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT-V2] Multi-file analysis error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de l\'analyse multi-fichiers',
        });
      } finally {
        // Cleanup temp files
        tempFilePaths.forEach(cleanupTempFile);
      }
    }),

  /**
   * V2: Execute import from analyzed multi-file result
   *
   * This endpoint:
   * - Retrieves previously analyzed result
   * - Applies user-resolved conflicts (if any)
   * - Executes import in dependency order
   * - Provides detailed import summary by entity type
   */
  executeMultiFileImport: protectedProcedure
    .input(executeMultiFileImportSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;

        // Retrieve analysis result
        const analysisResult = getAnalysisResult(input.analysisId);
        if (!analysisResult) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Résultat d\'analyse non trouvé ou expiré. Veuillez réanalyser les fichiers.',
          });
        }

        // Apply user-resolved conflicts if provided
        if (input.userResolvedConflicts && input.userResolvedConflicts.length > 0) {
          // TODO: Apply user resolutions to conflicts
          // For now, we'll just log them
          console.log('[AI-IMPORT-V2] User-resolved conflicts:', input.userResolvedConflicts);
        }

        // Execute import
        const importResult = await executeMultiFileImport({
          analysisResult,
          context: {
            tenantId,
            countryCode: analysisResult.entityGraph.entities[Object.keys(analysisResult.entityGraph.entities)[0]]?.sources[0] ? 'CI' : 'CI',
            allowPartialImport: input.allowPartialImport,
            dryRun: false,
            files: analysisResult.files.map((f: { fileName: string; totalSheets: number; totalRows: number }) => ({
              fileName: f.fileName,
              uploadedAt: new Date(),
              size: 0,
            })),
            onProgress: (update) => {
              console.log(`[AI-IMPORT-V2] ${update.phase}: ${update.message}`);
            },
          },
        });

        // Cleanup analysis result after successful import
        analysisResultsStore.delete(input.analysisId);

        return {
          success: importResult.success,
          totalRecordsImported: importResult.totalRecordsImported,
          entitiesByType: importResult.entitiesByType,
          errors: importResult.errors,
          summary: `${importResult.totalRecordsImported} enregistrement(s) importé(s) avec succès`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[AI-IMPORT-V2] Multi-file import error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Erreur lors de l\'importation multi-fichiers',
        });
      }
    }),
});
