/**
 * Documents tRPC Router
 *
 * Handles document generation:
 * - Pay slips (Bulletins de Paie) - single and bulk
 * - Work certificates (Certificat de Travail)
 * - Final settlements (Solde de Tout Compte)
 * - CNPS attestations
 * - Final payslips
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import { generateWorkCertificate } from '@/features/documents/services/work-certificate.service';
import { generateCNPSAttestation } from '@/features/documents/services/cnps-attestation.service';
import { generateFinalPayslip } from '@/features/documents/services/final-payslip.service';
import { bulletinService } from '@/lib/documents/bulletin-service';
import { certificatService } from '@/lib/documents/certificat-travail-service';
import { soldeService } from '@/lib/documents/solde-de-tout-compte-service';
import { db } from '@/lib/db';
import { generatedDocuments, documentAccessLog, bulkGenerationJobs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

        const documents = await db
          .select()
          .from(generatedDocuments)
          .where(eq(generatedDocuments.employeeId, ctx.user.employeeId))
          .orderBy(desc(generatedDocuments.createdAt));

        // Separate by type
        const payslips = documents.filter(d => d.documentType === 'bulletin_de_paie');
        const others = documents.filter(d => d.documentType !== 'bulletin_de_paie');

        return {
          payslips,
          others,
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
});
