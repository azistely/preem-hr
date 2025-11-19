/**
 * Documents tRPC Router
 *
 * Handles document generation AND document upload management:
 * - Document Generation: Pay slips, Work certificates, Final settlements, CNPS attestations
 * - Document Upload: File uploads, approval workflow, expiry tracking
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import { generateWorkCertificate } from '@/features/documents/services/work-certificate.service';
import { generateCNPSAttestation } from '@/features/documents/services/cnps-attestation.service';
import { generateFinalPayslip } from '@/features/documents/services/final-payslip.service';
import { generateLeaveCertificate } from '@/lib/documents/leave-certificate-service';
import { generateContractDocument, getContractPreviewData } from '@/lib/contracts/contract-document.service';
import { bulletinService } from '@/lib/documents/bulletin-service';
import { certificatService } from '@/lib/documents/certificat-travail-service';
import { soldeService } from '@/lib/documents/solde-de-tout-compte-service';
import { uploadDocument, deleteDocument, updateDocumentMetadata, validateFile, uploadTemporaryFile } from '@/lib/documents/upload-service';
import {
  createSignatureRequest,
  getSignatureStatus,
  cancelSignatureRequest,
  sendSignatureReminder,
  type Signer
} from '@/lib/documents/signing-service';
import {
  createNewVersion,
  getVersionHistory,
  getVersionStats,
  rollbackToVersion,
  compareVersions,
  deleteVersion,
} from '@/lib/documents/version-service';
import { sendEvent } from '@/lib/inngest/client';
import { db } from '@/lib/db';
import { generatedDocuments, documentAccessLog, bulkGenerationJobs, uploadedDocuments, documentCategories, users } from '@/lib/db/schema';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const generateWorkCertificateSchema = z.object({
  terminationId: z.string().uuid(),
  issuedBy: z.string().min(1, 'Le nom du signataire est requis'),
});

const generateCNPSAttestationSchema = z.object({
  terminationId: z.string().uuid(),
  issuedBy: z.string().min(1, 'Le nom du signataire est requis'),
});

const generateFinalPayslipSchema = z.object({
  terminationId: z.string().uuid(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
});

const generateContractDocumentSchema = z.object({
  contractId: z.string().uuid(),
  companyRepresentative: z.string().min(1, 'Le nom du représentant est requis'),
  companyRepresentativeTitle: z.string().min(1, 'Le titre du représentant est requis'),
  versionNotes: z.string().optional(),
});

const getContractPreviewSchema = z.object({
  contractId: z.string().uuid(),
});

export const documentsRouter = createTRPCRouter({
  /**
   * Generate work certificate (Certificat de Travail)
   * Must be issued within 48 hours of termination per Convention Collective Article 40
   */
  generateWorkCertificate: publicProcedure
    .input(generateWorkCertificateSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateWorkCertificate called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateWorkCertificate service');
        const result = await generateWorkCertificate({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          issuedBy: input.issuedBy,
          uploadedByUserId: ctx.user.id,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[Work Certificate] Generation error:', error);
        console.error('[Work Certificate] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du certificat de travail',
        });
      }
    }),

  /**
   * Generate CNPS attestation
   * Must be issued within 15 days of termination per Convention Collective Article 40
   */
  generateCNPSAttestation: publicProcedure
    .input(generateCNPSAttestationSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateCNPSAttestation called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateCNPSAttestation service');
        const result = await generateCNPSAttestation({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          issuedBy: input.issuedBy,
          uploadedByUserId: ctx.user.id,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[CNPS Attestation] Generation error:', error);
        console.error('[CNPS Attestation] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération de l\'attestation CNPS',
        });
      }
    }),

  /**
   * Generate final payslip with terminal payments
   * Includes severance pay, vacation payout, and prorated salary
   */
  generateFinalPayslip: publicProcedure
    .input(generateFinalPayslipSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateFinalPayslip called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateFinalPayslip service');
        const result = await generateFinalPayslip({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          payDate: input.payDate,
          uploadedByUserId: ctx.user.id,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[Final Payslip] Generation error:', error);
        console.error('[Final Payslip] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du bulletin de paie final',
        });
      }
    }),

  /**
   * Generate leave certificate (Attestation de départ en congés annuels)
   * Required by law to be delivered 15 days before leave starts
   */
  generateLeaveCertificate: publicProcedure
    .input(z.object({
      requestId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateLeaveCertificate called with requestId:', input.requestId);
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateLeaveCertificate service');
        const blob = await generateLeaveCertificate(
          input.requestId,
          ctx.user.tenantId,
          ctx.user.id
        );
        console.log('[TRPC Documents] Service returned blob successfully');

        // Convert blob to base64 for transmission
        const buffer = Buffer.from(await blob.arrayBuffer());
        const base64 = buffer.toString('base64');

        return {
          base64,
          filename: `attestation-conge-${input.requestId}.pdf`,
          mimeType: 'application/pdf',
        };
      } catch (error: any) {
        console.error('[Leave Certificate] Generation error:', error);
        console.error('[Leave Certificate] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération de l\'attestation de congé',
        });
      }
    }),

  /**
   * Get contract preview data (before generating document)
   * Shows what will be included in the contract PDF
   */
  getContractPreview: protectedProcedure
    .input(getContractPreviewSchema)
    .query(async ({ input, ctx }) => {
      console.log('[TRPC Documents] getContractPreview called with contractId:', input.contractId);
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        const result = await getContractPreviewData(
          input.contractId,
          ctx.user.tenantId!
        );

        return result;
      } catch (error: any) {
        console.error('[Contract Preview] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération de l\'aperçu du contrat',
        });
      }
    }),

  /**
   * Generate contract document PDF (CDI, CDD, CDDTI)
   * Uploads to Supabase Storage and creates uploadedDocuments record
   */
  generateContractDocument: protectedProcedure
    .input(generateContractDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateContractDocument called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context user:', JSON.stringify({
        id: ctx.user.id,
        tenantId: ctx.user.tenantId,
        role: ctx.user.role,
      }));

      // Validate context has required fields
      if (!ctx.user.tenantId) {
        console.error('[TRPC Documents] Missing tenantId in context');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID is required. Please ensure you are logged in and have an active tenant.',
        });
      }

      if (!ctx.user.id) {
        console.error('[TRPC Documents] Missing user ID in context');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required. Please ensure you are logged in.',
        });
      }

      // Validate input has required fields
      if (!input.contractId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Contract ID is required',
        });
      }

      if (!input.companyRepresentative) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Company representative name is required',
        });
      }

      if (!input.companyRepresentativeTitle) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Company representative title is required',
        });
      }

      try {
        console.log('[TRPC Documents] Calling generateContractDocument service...');
        const result = await generateContractDocument({
          contractId: input.contractId,
          tenantId: ctx.user.tenantId,
          uploadedByUserId: ctx.user.id,
          companyRepresentative: input.companyRepresentative,
          companyRepresentativeTitle: input.companyRepresentativeTitle,
          versionNotes: input.versionNotes,
        });

        console.log('[TRPC Documents] Contract document generated successfully');

        return result;
      } catch (error: any) {
        console.error('[Contract Document] Generation error:', error);
        console.error('[Contract Document] Error message:', error.message);
        console.error('[Contract Document] Error stack:', error.stack);
        console.error('[Contract Document] Input data:', JSON.stringify(input));
        console.error('[Contract Document] Context data:', JSON.stringify({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
        }));
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du document de contrat',
        });
      }
    }),

  /**
   * Generate single bulletin de paie
   */
  generateSingleBulletin: hrManagerProcedure
    .input(z.object({
      payrollLineItemId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Tenant ID is required',
          });
        }

        const result = await bulletinService.generateSingleBulletin(
          input.payrollLineItemId,
          ctx.user.tenantId,
          ctx.user.id
        );

        return result;
      } catch (error: any) {
        console.error('[Single Bulletin] Generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du bulletin',
        });
      }
    }),

  /**
   * Generate bulletins for entire payroll run (bulk)
   */
  generateBulkBulletins: hrManagerProcedure
    .input(z.object({
      payrollRunId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Tenant ID is required',
          });
        }

        const result = await bulletinService.generateBulkBulletins(
          input.payrollRunId,
          ctx.user.tenantId,
          ctx.user.id
        );

        return result;
      } catch (error: any) {
        console.error('[Bulk Bulletins] Generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération en masse',
        });
      }
    }),

  /**
   * Generate corrected bulletin
   */
  generateCorrectedBulletin: hrManagerProcedure
    .input(z.object({
      originalDocumentId: z.string().uuid(),
      correctedLineItemId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Tenant ID is required',
          });
        }

        const result = await bulletinService.generateCorrectedBulletin(
          input.originalDocumentId,
          input.correctedLineItemId,
          ctx.user.tenantId,
          ctx.user.id
        );

        return result;
      } catch (error: any) {
        console.error('[Corrected Bulletin] Generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du bulletin corrigé',
        });
      }
    }),

  /**
   * Get bulk generation job status
   */
  getBulkJobStatus: hrManagerProcedure
    .input(z.object({
      jobId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const [job] = await db
          .select()
          .from(bulkGenerationJobs)
          .where(eq(bulkGenerationJobs.id, input.jobId));

        if (!job) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Job not found',
          });
        }

        return job;
      } catch (error: any) {
        console.error('[Bulk Job Status] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération du statut',
        });
      }
    }),

  /**
   * Get employee documents (for employee portal)
   * Fetches from BOTH generatedDocuments (payslips, etc.) AND uploadedDocuments (certificates, contracts, etc.)
   */
  getMyDocuments: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Employee ID is required',
          });
        }

        // Fetch generated documents (payslips, old certificates)
        const generated = await db
          .select()
          .from(generatedDocuments)
          .where(eq(generatedDocuments.employeeId, ctx.user.employeeId))
          .orderBy(desc(generatedDocuments.generationDate));

        // Fetch uploaded documents (includes system-generated certificates with advanced features)
        const uploaded = await db
          .select()
          .from(uploadedDocuments)
          .where(
            and(
              eq(uploadedDocuments.employeeId, ctx.user.employeeId),
              eq(uploadedDocuments.isArchived, false)
            )
          )
          .orderBy(desc(uploadedDocuments.createdAt));

        // Categorize documents
        const payslips = generated.filter(d => d.documentType === 'bulletin_de_paie');

        // Leave certificates from uploaded documents (new system with e-signature/versioning)
        const leaveCertificates = uploaded.filter(d => d.documentCategory === 'leave_certificates');

        // Other generated documents (work certificates, CNPS attestations, etc.)
        const otherGenerated = generated.filter(d => d.documentType !== 'bulletin_de_paie');

        // Other uploaded documents (contracts, ID cards, etc.)
        const otherUploaded = uploaded.filter(d => d.documentCategory !== 'leave_certificates');

        return {
          payslips,
          leaveCertificates, // Separate category with advanced features
          otherGenerated,
          otherUploaded,
        };
      } catch (error: any) {
        console.error('[My Documents] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des documents',
        });
      }
    }),

  /**
   * Get documents for an employee (for HR/managers)
   */
  getEmployeeDocuments: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const documents = await db
          .select()
          .from(generatedDocuments)
          .where(
            and(
              eq(generatedDocuments.employeeId, input.employeeId),
              eq(generatedDocuments.tenantId, ctx.user.tenantId!)
            )
          )
          .orderBy(desc(generatedDocuments.createdAt));

        return documents;
      } catch (error: any) {
        console.error('[Employee Documents] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des documents',
        });
      }
    }),

  /**
   * Log document access (for audit trail)
   */
  logDocumentAccess: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid(),
      accessType: z.enum(['view', 'download', 'email', 'print']),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.insert(documentAccessLog).values({
          documentId: input.documentId,
          accessedBy: ctx.user.id,
          accessType: input.accessType,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });

        return { success: true };
      } catch (error: any) {
        console.error('[Document Access Log] Error:', error);
        // Don't throw error for logging - just log it
        return { success: false };
      }
    }),

  /**
   * Generate certificat de travail
   */
  generateCertificatTravail: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
      reason: z.enum(['resignation', 'termination', 'retirement', 'end_of_contract']),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Tenant ID is required',
          });
        }

        const result = await certificatService.generateCertificat(
          input.employeeId,
          new Date(input.terminationDate),
          input.reason,
          ctx.user.tenantId,
          ctx.user.id
        );

        return result;
      } catch (error: any) {
        console.error('[Certificat Travail] Generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du certificat',
        });
      }
    }),

  /**
   * Generate solde de tout compte
   */
  generateSoldeToutCompte: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
      reason: z.enum(['resignation', 'termination', 'retirement', 'end_of_contract']),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Tenant ID is required',
          });
        }

        const result = await soldeService.generateSoldeDeToutCompte(
          input.employeeId,
          new Date(input.terminationDate),
          input.reason,
          ctx.user.tenantId,
          ctx.user.id
        );

        return result;
      } catch (error: any) {
        console.error('[Solde Tout Compte] Generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du solde',
        });
      }
    }),

  // =====================================================
  // Document Upload Management (NEW)
  // =====================================================

  /**
   * Get document categories (for dropdowns/UI)
   */
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    try {
      const categories = await db
        .select()
        .from(documentCategories)
        .orderBy(documentCategories.displayOrder);

      // Filter by employee permissions if needed
      const isEmployee = ctx.user.role.toLowerCase() === 'employee';
      if (isEmployee) {
        return categories.filter((c) => c.employeeCanUpload);
      }

      return categories;
    } catch (error: any) {
      console.error('[Document Categories] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erreur lors de la récupération des catégories',
      });
    }
  }),

  /**
   * Upload a document (file upload)
   * Note: This expects file data as base64 string (client converts File to base64)
   */
  uploadDocument: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded file
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        employeeId: z.string().uuid().nullable(),
        documentCategory: z.string(),
        documentSubcategory: z.string().optional(),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Convert base64 to File object
        const buffer = Buffer.from(input.fileData, 'base64');
        const file = new File([buffer], input.fileName, {
          type: input.mimeType,
        });

        // Call upload service
        const result = await uploadDocument({
          file,
          employeeId: input.employeeId,
          documentCategory: input.documentCategory,
          documentSubcategory: input.documentSubcategory,
          expiryDate: input.expiryDate,
          tags: input.tags,
          metadata: input.metadata,
          auth: {
            userId: ctx.user.id,
            tenantId: ctx.user.tenantId!,
            role: ctx.user.role,
          },
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Échec du téléchargement',
          });
        }

        return result;
      } catch (error: any) {
        console.error('[Document Upload] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors du téléchargement',
        });
      }
    }),

  /**
   * Upload temporary file (for hire wizard before employee exists)
   * Returns just the file URL - no database record created
   */
  uploadTemporaryFile: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // Base64 encoded file
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('[Temp Upload] Starting upload:', {
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          tenantId: ctx.user.tenantId,
          base64Length: input.fileData.length,
        });

        // Convert base64 to Buffer, then to ArrayBuffer
        const buffer = Buffer.from(input.fileData, 'base64');
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        console.log('[Temp Upload] Buffer created:', {
          bufferLength: buffer.length,
          arrayBufferLength: arrayBuffer.byteLength,
        });

        // Upload to temp storage with server-side data format
        const result = await uploadTemporaryFile(
          {
            buffer: arrayBuffer,
            name: input.fileName,
            type: input.mimeType,
            size: input.fileSize,
          },
          ctx.user.tenantId!
        );

        if (!result.success) {
          console.error('[Temp Upload] Upload failed:', result.error);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Échec du téléchargement',
          });
        }

        console.log('[Temp Upload] Upload successful:', result.fileUrl);
        return result;
      } catch (error: any) {
        console.error('[Temp Upload] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors du téléchargement',
        });
      }
    }),

  /**
   * List uploaded documents with filters
   */
  listUploaded: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid().optional(),
        documentCategory: z.string().optional(),
        approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
        uploadContext: z.string().optional(), // Filter by upload context (e.g., "company_documents_tab")
        includeArchived: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { employeeId, documentCategory, approvalStatus, uploadContext, includeArchived, limit, offset } = input;
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);

        // Build where conditions
        const conditions = [eq(uploadedDocuments.tenantId, ctx.user.tenantId!)];

        // Non-HR can only see their own documents
        if (!isHR) {
          if (!ctx.user.employeeId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Employee ID is required',
            });
          }
          conditions.push(eq(uploadedDocuments.employeeId, ctx.user.employeeId));
        } else if (employeeId) {
          // HR can filter by employee
          conditions.push(eq(uploadedDocuments.employeeId, employeeId));
        }

        if (documentCategory) {
          conditions.push(eq(uploadedDocuments.documentCategory, documentCategory));
        }

        if (approvalStatus) {
          conditions.push(eq(uploadedDocuments.approvalStatus, approvalStatus));
        }

        // Filter by upload context (stored in metadata JSONB field)
        if (uploadContext) {
          conditions.push(sql`${uploadedDocuments.metadata}->>'uploadContext' = ${uploadContext}`);
        }

        if (!includeArchived) {
          conditions.push(eq(uploadedDocuments.isArchived, false));
        }

        // Fetch documents
        const documents = await db
          .select()
          .from(uploadedDocuments)
          .where(and(...conditions))
          .orderBy(desc(uploadedDocuments.createdAt))
          .limit(limit)
          .offset(offset);

        // Get total count
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(uploadedDocuments)
          .where(and(...conditions));

        return {
          documents,
          total: count,
          hasMore: offset + limit < count,
        };
      } catch (error: any) {
        console.error('[List Uploaded Documents] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération des documents',
        });
      }
    }),

  /**
   * Get a single uploaded document by ID
   */
  getUploadedDocument: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const [document] = await db
          .select()
          .from(uploadedDocuments)
          .where(
            and(
              eq(uploadedDocuments.id, input.id),
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
            )
          )
          .limit(1);

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        // Check permissions (employees can only view their own)
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        if (!isHR && document.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès refusé',
          });
        }

        return document;
      } catch (error: any) {
        console.error('[Get Uploaded Document] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération du document',
        });
      }
    }),

  /**
   * Approve a pending document (HR only)
   */
  approveDocument: hrManagerProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get document
        const [document] = await db
          .select()
          .from(uploadedDocuments)
          .where(
            and(
              eq(uploadedDocuments.id, input.documentId),
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
            )
          )
          .limit(1);

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        if (document.approvalStatus !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Document déjà traité',
          });
        }

        // Update document
        const [updated] = await db
          .update(uploadedDocuments)
          .set({
            approvalStatus: 'approved',
            approvedBy: ctx.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(uploadedDocuments.id, input.documentId))
          .returning();

        // Get approver name from database
        const [approver] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        const approverName = approver
          ? `${approver.firstName || ''} ${approver.lastName || ''}`.trim()
          : 'Gestionnaire RH';

        // Emit Inngest event
        await sendEvent({
          name: 'document.approved',
          data: {
            documentId: input.documentId,
            approvedById: ctx.user.id,
            approvedByName: approverName || 'Gestionnaire RH',
            tenantId: ctx.user.tenantId!,
          },
        });

        console.log('[Document Approval] Document approved:', input.documentId);

        return updated;
      } catch (error: any) {
        console.error('[Approve Document] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'approbation',
        });
      }
    }),

  /**
   * Reject a pending document (HR only)
   */
  rejectDocument: hrManagerProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        rejectionReason: z.string().min(1, 'Raison requise'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get document
        const [document] = await db
          .select()
          .from(uploadedDocuments)
          .where(
            and(
              eq(uploadedDocuments.id, input.documentId),
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
            )
          )
          .limit(1);

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        if (document.approvalStatus !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Document déjà traité',
          });
        }

        // Update document
        const [updated] = await db
          .update(uploadedDocuments)
          .set({
            approvalStatus: 'rejected',
            rejectionReason: input.rejectionReason,
            updatedAt: new Date(),
          })
          .where(eq(uploadedDocuments.id, input.documentId))
          .returning();

        // Get rejector name from database
        const [rejector] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        const rejectorName = rejector
          ? `${rejector.firstName || ''} ${rejector.lastName || ''}`.trim()
          : 'Gestionnaire RH';

        // Emit Inngest event
        await sendEvent({
          name: 'document.rejected',
          data: {
            documentId: input.documentId,
            rejectedById: ctx.user.id,
            rejectedByName: rejectorName || 'Gestionnaire RH',
            rejectionReason: input.rejectionReason,
            tenantId: ctx.user.tenantId!,
          },
        });

        console.log('[Document Rejection] Document rejected:', input.documentId);

        return updated;
      } catch (error: any) {
        console.error('[Reject Document] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du rejet',
        });
      }
    }),

  /**
   * Delete (archive) an uploaded document (HR only)
   */
  deleteUploaded: hrManagerProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await deleteDocument(input.documentId, {
          userId: ctx.user.id,
          tenantId: ctx.user.tenantId!,
          role: ctx.user.role,
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Échec de la suppression',
          });
        }

        return result;
      } catch (error: any) {
        console.error('[Delete Uploaded Document] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la suppression',
        });
      }
    }),

  /**
   * Update document metadata (HR only)
   */
  updateUploadedMetadata: hrManagerProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        documentCategory: z.string().optional(),
        documentSubcategory: z.string().optional(),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, ...updates } = input;

        const result = await updateDocumentMetadata(
          documentId,
          updates,
          {
            userId: ctx.user.id,
            tenantId: ctx.user.tenantId!,
            role: ctx.user.role,
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Échec de la mise à jour',
          });
        }

        return result;
      } catch (error: any) {
        console.error('[Update Document Metadata] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la mise à jour',
        });
      }
    }),

  /**
   * Get pending document count (for HR badge)
   */
  getPendingCount: hrManagerProcedure.query(async ({ ctx }) => {
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(uploadedDocuments)
        .where(
          and(
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!),
            eq(uploadedDocuments.approvalStatus, 'pending'),
            eq(uploadedDocuments.isArchived, false)
          )
        );

      return count;
    } catch (error: any) {
      console.error('[Pending Document Count] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erreur lors de la récupération du compteur',
      });
    }
  }),

  /**
   * Bulk approve documents
   * Approve multiple documents at once (HR only)
   */
  bulkApproveDocuments: hrManagerProcedure
    .input(
      z.object({
        documentIds: z.array(z.string().uuid()).min(1, 'Au moins un document requis'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const results = {
          success: [] as string[],
          failed: [] as { id: string; reason: string }[],
        };

        for (const documentId of input.documentIds) {
          try {
            // Update document status
            await db
              .update(uploadedDocuments)
              .set({
                approvalStatus: 'approved',
                approvedBy: ctx.user.id,
                approvedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(uploadedDocuments.id, documentId),
                  eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
                )
              );

            // Emit approval event for Inngest workflow
            await sendEvent({
              name: 'document.approved',
              data: {
                documentId,
                approvedBy: ctx.user.id,
                approvedByEmail: ctx.user.email,
                tenantId: ctx.user.tenantId!,
              },
              user: {
                userId: ctx.user.id,
                tenantId: ctx.user.tenantId!,
                role: ctx.user.role,
              },
            });

            results.success.push(documentId);
          } catch (error) {
            results.failed.push({
              id: documentId,
              reason: error instanceof Error ? error.message : 'Erreur inconnue',
            });
          }
        }

        return {
          success: results.success.length === input.documentIds.length,
          approved: results.success.length,
          failed: results.failed.length,
          details: results,
        };
      } catch (error: any) {
        console.error('[Bulk Approve Documents] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'approbation en masse',
        });
      }
    }),

  /**
   * Bulk reject documents
   * Reject multiple documents at once with a reason (HR only)
   */
  bulkRejectDocuments: hrManagerProcedure
    .input(
      z.object({
        documentIds: z.array(z.string().uuid()).min(1, 'Au moins un document requis'),
        reason: z.string().min(1, 'La raison du rejet est requise'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const results = {
          success: [] as string[],
          failed: [] as { id: string; reason: string }[],
        };

        for (const documentId of input.documentIds) {
          try {
            // Update document status
            await db
              .update(uploadedDocuments)
              .set({
                approvalStatus: 'rejected',
                approvedBy: ctx.user.id,
                approvedAt: new Date(),
                rejectionReason: input.reason,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(uploadedDocuments.id, documentId),
                  eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
                )
              );

            // Emit rejection event for Inngest workflow
            await sendEvent({
              name: 'document.rejected',
              data: {
                documentId,
                rejectedBy: ctx.user.id,
                rejectedByEmail: ctx.user.email,
                reason: input.reason,
                tenantId: ctx.user.tenantId!,
              },
              user: {
                userId: ctx.user.id,
                tenantId: ctx.user.tenantId!,
                role: ctx.user.role,
              },
            });

            results.success.push(documentId);
          } catch (error) {
            results.failed.push({
              id: documentId,
              reason: error instanceof Error ? error.message : 'Erreur inconnue',
            });
          }
        }

        return {
          success: results.success.length === input.documentIds.length,
          rejected: results.success.length,
          failed: results.failed.length,
          details: results,
        };
      } catch (error: any) {
        console.error('[Bulk Reject Documents] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du rejet en masse',
        });
      }
    }),

  /**
   * Get documents for bulk download
   * Returns document URLs for ZIP download preparation
   */
  getBulkDownloadData: hrManagerProcedure
    .input(
      z.object({
        documentIds: z.array(z.string().uuid()).optional(),
        filters: z
          .object({
            category: z.string().optional(),
            approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
            employeeId: z.string().uuid().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        let query = db
          .select({
            id: uploadedDocuments.id,
            fileName: uploadedDocuments.fileName,
            fileUrl: uploadedDocuments.fileUrl,
            fileSize: uploadedDocuments.fileSize,
            mimeType: uploadedDocuments.mimeType,
            documentCategory: uploadedDocuments.documentCategory,
          })
          .from(uploadedDocuments)
          .where(
            and(
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!),
              eq(uploadedDocuments.isArchived, false)
            )
          );

        // Filter by specific document IDs if provided
        if (input.documentIds && input.documentIds.length > 0) {
          const documents = await db
            .select({
              id: uploadedDocuments.id,
              fileName: uploadedDocuments.fileName,
              fileUrl: uploadedDocuments.fileUrl,
              fileSize: uploadedDocuments.fileSize,
              mimeType: uploadedDocuments.mimeType,
              documentCategory: uploadedDocuments.documentCategory,
            })
            .from(uploadedDocuments)
            .where(
              and(
                eq(uploadedDocuments.tenantId, ctx.user.tenantId!),
                eq(uploadedDocuments.isArchived, false),
                or(...input.documentIds.map((id) => eq(uploadedDocuments.id, id)))
              )
            );

          return {
            documents,
            totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
            count: documents.length,
          };
        }

        // Apply filters if no specific IDs
        const conditions = [
          eq(uploadedDocuments.tenantId, ctx.user.tenantId!),
          eq(uploadedDocuments.isArchived, false),
        ];

        if (input.filters?.category) {
          conditions.push(eq(uploadedDocuments.documentCategory, input.filters.category));
        }

        if (input.filters?.approvalStatus) {
          conditions.push(eq(uploadedDocuments.approvalStatus, input.filters.approvalStatus));
        }

        if (input.filters?.employeeId) {
          conditions.push(eq(uploadedDocuments.employeeId, input.filters.employeeId));
        }

        const documents = await db
          .select({
            id: uploadedDocuments.id,
            fileName: uploadedDocuments.fileName,
            fileUrl: uploadedDocuments.fileUrl,
            fileSize: uploadedDocuments.fileSize,
            mimeType: uploadedDocuments.mimeType,
            documentCategory: uploadedDocuments.documentCategory,
          })
          .from(uploadedDocuments)
          .where(and(...conditions))
          .limit(100); // Safety limit

        return {
          documents,
          totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
          count: documents.length,
        };
      } catch (error: any) {
        console.error('[Get Bulk Download Data] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la préparation du téléchargement',
        });
      }
    }),

  // =====================================================
  // E-Signature Endpoints (Dropbox Sign)
  // =====================================================

  /**
   * Create a signature request for a document
   */
  createSignatureRequest: hrManagerProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        signers: z.array(
          z.object({
            name: z.string().min(1, 'Le nom du signataire est requis'),
            email: z.string().email('Email invalide'),
            order: z.number().optional(),
          })
        ).min(1, 'Au moins un signataire est requis'),
        title: z.string().min(1, 'Le titre est requis'),
        subject: z.string().optional(),
        message: z.string().optional(),
        signingOrder: z.enum(['sequential', 'parallel']).default('sequential'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify document belongs to tenant
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        // Check if document already has a pending signature request
        if (document.signatureStatus === 'pending' || document.signatureStatus === 'partially_signed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ce document a déjà une demande de signature en cours',
          });
        }

        // Create signature request
        const result = await createSignatureRequest({
          documentId: input.documentId,
          signers: input.signers as Signer[],
          title: input.title,
          subject: input.subject,
          message: input.message,
          signingOrder: input.signingOrder,
          testMode: process.env.NODE_ENV === 'development',
        });

        return {
          success: true,
          signatureRequestId: result.signatureRequestId,
          signingUrls: result.signingUrls,
        };
      } catch (error: any) {
        console.error('[Create Signature Request] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la création de la demande de signature',
        });
      }
    }),

  /**
   * Get signature status for a document
   */
  getSignatureStatus: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        // Get document
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        if (!document.signatureRequestId) {
          return {
            hasSignatureRequest: false,
            status: null,
          };
        }

        // Get status from Dropbox Sign
        const status = await getSignatureStatus(document.signatureRequestId);

        return {
          hasSignatureRequest: true,
          status,
        };
      } catch (error: any) {
        console.error('[Get Signature Status] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération du statut de signature',
        });
      }
    }),

  /**
   * Cancel a pending signature request
   */
  cancelSignatureRequest: hrManagerProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get document
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        if (!document.signatureRequestId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ce document n\'a pas de demande de signature',
          });
        }

        // Cancel request
        await cancelSignatureRequest(document.signatureRequestId);

        return { success: true };
      } catch (error: any) {
        console.error('[Cancel Signature Request] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'annulation de la demande de signature',
        });
      }
    }),

  /**
   * Send reminder to signers
   */
  sendSignatureReminder: hrManagerProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        emailAddress: z.string().email().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get document
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        if (!document.signatureRequestId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ce document n\'a pas de demande de signature',
          });
        }

        // Send reminder
        await sendSignatureReminder(document.signatureRequestId, input.emailAddress);

        return { success: true };
      } catch (error: any) {
        console.error('[Send Signature Reminder] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'envoi du rappel',
        });
      }
    }),

  // =====================================================
  // Document Versioning Endpoints
  // =====================================================

  /**
   * Create a new version of an existing document
   * Creates version chain: v1 → v2 → v3
   */
  createDocumentVersion: protectedProcedure
    .input(
      z.object({
        originalDocumentId: z.string().uuid(),
        fileUrl: z.string().url(),
        fileName: z.string().min(1),
        fileSize: z.number().positive(),
        mimeType: z.string(),
        versionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify user has access to original document
        const originalDoc = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.originalDocumentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!originalDoc) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document original introuvable',
          });
        }

        // Check permissions (employees can only version their own documents)
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        if (!isHR && originalDoc.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez pas créer de version pour ce document',
          });
        }

        // Create new version
        const result = await createNewVersion({
          originalDocumentId: input.originalDocumentId,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          versionNotes: input.versionNotes,
          uploadedBy: ctx.user.id,
          tenantId: ctx.user.tenantId!,
        });

        return {
          success: true,
          newVersionId: result.newVersionId,
          versionNumber: result.versionNumber,
        };
      } catch (error: any) {
        console.error('[Create Document Version] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la création de la version',
        });
      }
    }),

  /**
   * Get version history for a document
   * Returns all versions in chronological order
   */
  getDocumentVersionHistory: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        // Verify user has access to document
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        // Check permissions
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        if (!isHR && document.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès refusé',
          });
        }

        // Get version history
        const history = await getVersionHistory(input.documentId);

        return history;
      } catch (error: any) {
        console.error('[Get Document Version History] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération de l\'historique',
        });
      }
    }),

  /**
   * Get version statistics for a document
   */
  getDocumentVersionStats: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        // Verify user has access to document
        const document = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.documentId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document introuvable',
          });
        }

        // Check permissions
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        if (!isHR && document.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès refusé',
          });
        }

        // Get version stats
        const stats = await getVersionStats(input.documentId);

        return stats;
      } catch (error: any) {
        console.error('[Get Document Version Stats] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération des statistiques',
        });
      }
    }),

  /**
   * Rollback to a previous version
   * Marks selected version as "latest"
   */
  rollbackDocumentVersion: hrManagerProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify version belongs to tenant
        const version = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.versionId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!version) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Version introuvable',
          });
        }

        // Rollback
        const result = await rollbackToVersion(input.versionId, ctx.user.id);

        return result;
      } catch (error: any) {
        console.error('[Rollback Document Version] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors du retour à la version précédente',
        });
      }
    }),

  /**
   * Compare two versions of a document
   */
  compareDocumentVersions: protectedProcedure
    .input(
      z.object({
        versionId1: z.string().uuid(),
        versionId2: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Verify both versions belong to tenant
        const [v1, v2] = await Promise.all([
          db.query.uploadedDocuments.findFirst({
            where: and(
              eq(uploadedDocuments.id, input.versionId1),
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
            ),
          }),
          db.query.uploadedDocuments.findFirst({
            where: and(
              eq(uploadedDocuments.id, input.versionId2),
              eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
            ),
          }),
        ]);

        if (!v1 || !v2) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Une ou plusieurs versions introuvables',
          });
        }

        // Check permissions
        const isHR = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);
        if (!isHR && (v1.employeeId !== ctx.user.employeeId || v2.employeeId !== ctx.user.employeeId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès refusé',
          });
        }

        // Compare versions
        const comparison = await compareVersions(input.versionId1, input.versionId2);

        return comparison;
      } catch (error: any) {
        console.error('[Compare Document Versions] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la comparaison des versions',
        });
      }
    }),

  /**
   * Delete a specific version (HR only)
   * Cannot delete v1 if it has children, cannot delete the only version
   */
  deleteDocumentVersion: hrManagerProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify version belongs to tenant
        const version = await db.query.uploadedDocuments.findFirst({
          where: and(
            eq(uploadedDocuments.id, input.versionId),
            eq(uploadedDocuments.tenantId, ctx.user.tenantId!)
          ),
        });

        if (!version) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Version introuvable',
          });
        }

        // Delete version
        const result = await deleteVersion(input.versionId);

        return result;
      } catch (error: any) {
        console.error('[Delete Document Version] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la suppression de la version',
        });
      }
    }),

  /**
   * ==========================================
   * DOCUMENT CATEGORY MANAGEMENT
   * ==========================================
   */

  /**
   * List all document categories with their configuration
   * Access: HR Manager, Tenant Admin, Super Admin
   */
  listCategories: hrManagerProcedure
    .query(async () => {
      try {
        const categories = await db
          .select()
          .from(documentCategories)
          .orderBy(documentCategories.displayOrder);

        return categories;
      } catch (error: any) {
        console.error('[List Categories] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération des catégories',
        });
      }
    }),

  /**
   * Update document category settings
   * Access: HR Manager, Tenant Admin, Super Admin
   */
  updateCategory: hrManagerProcedure
    .input(z.object({
      categoryId: z.string().uuid(),
      data: z.object({
        labelFr: z.string().optional(),
        icon: z.string().optional(),
        allowsUpload: z.boolean().optional(),
        allowsGeneration: z.boolean().optional(),
        requiresHrApproval: z.boolean().optional(),
        employeeCanUpload: z.boolean().optional(),
        displayOrder: z.number().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      try {
        const [updated] = await db
          .update(documentCategories)
          .set(input.data)
          .where(eq(documentCategories.id, input.categoryId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Catégorie introuvable',
          });
        }

        return updated;
      } catch (error: any) {
        console.error('[Update Category] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la mise à jour de la catégorie',
        });
      }
    }),

  /**
   * Send document for electronic signature
   * Creates signature request via Dropbox Sign for contract documents
   * Access: HR Manager, Tenant Admin, Super Admin
   */
  sendForSignature: hrManagerProcedure
    .input(z.object({
      documentId: z.string().uuid(),
      signers: z.array(z.object({
        name: z.string().min(1, 'Le nom du signataire est requis'),
        email: z.string().email('Email invalide'),
        order: z.number().int().min(0).optional(),
      })).min(1, 'Au moins un signataire est requis'),
      title: z.string().min(1, 'Le titre est requis'),
      subject: z.string().optional(),
      message: z.string().optional(),
      signingOrder: z.enum(['sequential', 'parallel']).default('sequential'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Create signature request
        const result = await createSignatureRequest({
          documentId: input.documentId,
          signers: input.signers,
          title: input.title,
          subject: input.subject,
          message: input.message,
          signingOrder: input.signingOrder,
          testMode: process.env.NODE_ENV !== 'production',
        });

        return {
          success: true,
          signatureRequestId: result.signatureRequestId,
          message: 'Demande de signature envoyée avec succès',
        };
      } catch (error: any) {
        console.error('[Send For Signature] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de l\'envoi de la demande de signature',
        });
      }
    }),
});
