/**
 * Terminations tRPC Router
 *
 * Handles employee termination operations with:
 * - Terminal calculations (severance, vacation payout)
 * - Document generation tracking
 * - Workflow status management
 * - Convention Collective compliance
 * - Complete STC (Solde de Tout Compte) calculation and management
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createTermination,
  updateTermination,
  getTerminationById,
  getTerminationByEmployeeId,
  listTerminations,
} from '@/features/employees/services/termination.service';
import { calculateSTC, type DepartureType, type NoticePeriodStatus, type LicenciementType } from '@/features/payroll/services/stc-calculator.service';
import { bulkGenerateTerminationDocuments, regenerateTerminationDocuments } from '@/features/documents/services/bulk-termination-documents.service';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { employeeTerminations } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { sendEvent } from '@/lib/inngest/client';

const createTerminationSchema = z.object({
  employeeId: z.string().uuid(),
  terminationDate: z.date(),
  terminationReason: z.enum(['dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end', 'death', 'other']),
  notes: z.string().optional(),
  noticePeriodDays: z.number().int().min(0),
  severanceAmount: z.number().min(0),
  vacationPayoutAmount: z.number().min(0).optional(),
  averageSalary12m: z.number().positive(),
  yearsOfService: z.number().positive(),
  severanceRate: z.enum(['0', '30', '35', '40']).transform(Number),
});

const updateTerminationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'notice_period', 'documents_pending', 'completed']).optional(),
  workCertificateUrl: z.string().url().optional(),
  finalPayslipUrl: z.string().url().optional(),
  cnpsAttestationUrl: z.string().url().optional(),
});

const getTerminationSchema = z.object({
  id: z.string().uuid(),
});

const getTerminationByEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
});

const listTerminationsSchema = z.object({
  status: z.enum(['pending', 'notice_period', 'documents_pending', 'completed']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const terminationsRouter = createTRPCRouter({
  /**
   * Create a new termination record
   */
  create: publicProcedure
    .input(createTerminationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const termination = await createTermination({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
          createdByEmail: 'system', // TODO: Get from user context
        });

        return termination;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de la cessation',
        });
      }
    }),

  /**
   * Update termination (mainly for document URLs)
   */
  update: publicProcedure
    .input(updateTerminationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const termination = await updateTermination({
          ...input,
          tenantId: ctx.user.tenantId,
          updatedBy: ctx.user.id,
          updatedByEmail: 'system', // TODO: Get from user context
        });

        return termination;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour de la cessation',
        });
      }
    }),

  /**
   * Get termination by ID
   */
  getById: publicProcedure
    .input(getTerminationSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getTerminationById(input.id, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cessation non trouvée',
        });
      }
    }),

  /**
   * Get termination by employee ID
   */
  getByEmployeeId: publicProcedure
    .input(getTerminationByEmployeeSchema)
    .query(async ({ input, ctx }) => {
      return await getTerminationByEmployeeId(input.employeeId, ctx.user.tenantId);
    }),

  /**
   * List terminations
   */
  list: publicProcedure
    .input(listTerminationsSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await listTerminations(ctx.user.tenantId, {
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la récupération des cessations',
        });
      }
    }),

  // =====================================================
  // STC (Solde de Tout Compte) ENDPOINTS
  // =====================================================

  /**
   * Preview STC calculation without creating termination
   *
   * Use this endpoint to show the user what the STC will be BEFORE they confirm
   * the termination. This allows them to validate calculations and adjust parameters.
   */
  previewSTC: publicProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      departureType: z.enum([
        'FIN_CDD',
        'DEMISSION_CDI',
        'DEMISSION_CDD',
        'LICENCIEMENT',
        'RUPTURE_CONVENTIONNELLE',
        'RETRAITE',
        'DECES',
      ]),
      terminationDate: z.date(),
      noticePeriodStatus: z.enum(['worked', 'paid_by_employer', 'paid_by_employee', 'waived']),
      // Optional fields for specific departure types
      licenciementType: z.enum(['economique', 'faute_simple', 'faute_grave', 'faute_lourde', 'inaptitude']).optional(),
      ruptureNegotiatedAmount: z.number().min(0).optional(),
      beneficiaries: z.array(z.object({
        name: z.string(),
        relationship: z.enum(['spouse', 'child', 'parent', 'other']),
        identityDocument: z.string(),
        bankAccount: z.string(),
        sharePercentage: z.number().min(0).max(100),
      })).optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const stcResult = await calculateSTC({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          departureType: input.departureType as DepartureType,
          terminationDate: input.terminationDate,
          noticePeriodStatus: input.noticePeriodStatus as NoticePeriodStatus,
          licenciementType: input.licenciementType as LicenciementType | undefined,
          ruptureNegotiatedAmount: input.ruptureNegotiatedAmount,
          beneficiaries: input.beneficiaries,
        });

        return {
          success: true,
          stc: stcResult,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors du calcul du STC',
        });
      }
    }),

  /**
   * Generate termination documents
   *
   * Generates all 3 required documents:
   * - Work Certificate (Certificat de Travail)
   * - Final Payslip (Bulletin de Paie Final)
   * - CNPS Attestation
   */
  generateDocuments: publicProcedure
    .input(z.object({
      terminationId: z.string().uuid(),
      issuedBy: z.string().min(1, 'Le nom de la personne qui émet les documents est requis'),
      payDate: z.string().datetime(), // ISO date string for final payslip
      versionNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await bulkGenerateTerminationDocuments({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          uploadedByUserId: ctx.user.id,
          issuedBy: input.issuedBy,
          payDate: input.payDate,
          versionNotes: input.versionNotes,
        });

        if (!result.allDocumentsGenerated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Certains documents n'ont pas pu être générés: ${result.errors?.map(e => e.documentType).join(', ')}`,
            cause: result.errors,
          });
        }

        return {
          success: true,
          documents: result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération des documents',
        });
      }
    }),

  /**
   * Regenerate termination documents
   *
   * Creates new versions of all termination documents (for corrections/updates)
   */
  regenerateDocuments: publicProcedure
    .input(z.object({
      terminationId: z.string().uuid(),
      issuedBy: z.string().min(1),
      payDate: z.string().datetime(),
      reason: z.string().min(1, 'La raison de la régénération est requise'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await regenerateTerminationDocuments({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          uploadedByUserId: ctx.user.id,
          issuedBy: input.issuedBy,
          payDate: input.payDate,
          reason: input.reason,
        });

        if (!result.allDocumentsGenerated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Certains documents n'ont pas pu être régénérés: ${result.errors?.map(e => e.documentType).join(', ')}`,
            cause: result.errors,
          });
        }

        return {
          success: true,
          documents: result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la régénération des documents',
        });
      }
    }),

  // =====================================================
  // BACKGROUND PROCESSING ENDPOINTS (3G Resilience)
  // =====================================================

  /**
   * Start termination processing in background via Inngest
   *
   * This endpoint triggers the background processing of a termination,
   * which includes:
   * - STC (Solde de Tout Compte) calculation
   * - Work Certificate generation
   * - Final Payslip generation
   * - CNPS Attestation generation
   *
   * The client should poll getTerminationProgress for status updates.
   */
  startTerminationProcessing: publicProcedure
    .input(z.object({
      terminationId: z.string().uuid(),
      departureType: z.enum([
        'FIN_CDD',
        'DEMISSION_CDI',
        'DEMISSION_CDD',
        'LICENCIEMENT',
        'RUPTURE_CONVENTIONNELLE',
        'RETRAITE',
        'DECES',
      ]),
      terminationDate: z.string().datetime(),
      noticePeriodStatus: z.enum(['worked', 'paid_by_employer', 'paid_by_employee', 'waived']),
      issuedBy: z.string().min(1, 'Le nom de la personne qui émet les documents est requis'),
      payDate: z.string().datetime(),
      // Optional fields for specific departure types
      licenciementType: z.enum(['economique', 'faute_simple', 'faute_grave', 'faute_lourde', 'inaptitude']).optional(),
      ruptureNegotiatedAmount: z.number().min(0).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify termination exists and belongs to tenant
      const termination = await db.query.employeeTerminations.findFirst({
        where: and(
          eq(employeeTerminations.id, input.terminationId),
          eq(employeeTerminations.tenantId, tenantId)
        ),
      });

      if (!termination) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cessation non trouvée',
        });
      }

      // Check if processing is already in progress
      if (termination.processingStatus === 'processing' || termination.processingStatus === 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Le traitement est déjà en cours',
        });
      }

      // Mark as pending and send event to Inngest
      await db.update(employeeTerminations)
        .set({
          processingStatus: 'pending',
          processingProgress: 0,
          processingCurrentStep: 'En attente de traitement...',
          processingError: null,
          processingStartedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(employeeTerminations.id, input.terminationId),
          eq(employeeTerminations.tenantId, tenantId)
        ));

      // Send event to Inngest for background processing
      const { ids } = await sendEvent({
        name: 'termination.process',
        data: {
          terminationId: input.terminationId,
          tenantId,
          employeeId: termination.employeeId,
          departureType: input.departureType,
          terminationDate: input.terminationDate,
          noticePeriodStatus: input.noticePeriodStatus,
          licenciementType: input.licenciementType,
          ruptureNegotiatedAmount: input.ruptureNegotiatedAmount,
          issuedBy: input.issuedBy,
          payDate: input.payDate,
          uploadedByUserId: ctx.user.id,
        },
      });

      // Store Inngest run ID for tracking
      if (ids && ids.length > 0) {
        await db.update(employeeTerminations)
          .set({
            inngestRunId: ids[0],
            updatedAt: new Date().toISOString(),
          })
          .where(and(
            eq(employeeTerminations.id, input.terminationId),
            eq(employeeTerminations.tenantId, tenantId)
          ));
      }

      return {
        success: true,
        terminationId: input.terminationId,
        inngestRunId: ids?.[0],
        message: 'Traitement démarré en arrière-plan',
      };
    }),

  /**
   * Get termination processing progress
   *
   * Poll this endpoint to track the progress of background termination processing.
   * Designed for West African 3G connections with unreliable connectivity.
   */
  getTerminationProgress: publicProcedure
    .input(z.object({
      terminationId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      const termination = await db.query.employeeTerminations.findFirst({
        where: and(
          eq(employeeTerminations.id, input.terminationId),
          eq(employeeTerminations.tenantId, tenantId)
        ),
        columns: {
          id: true,
          employeeId: true,
          processingStatus: true,
          processingProgress: true,
          processingCurrentStep: true,
          processingStartedAt: true,
          processingCompletedAt: true,
          processingError: true,
          inngestRunId: true,
          // STC results (available after calculation completes)
          stcCalculatedAt: true,
          severanceAmount: true,
          vacationPayoutAmount: true,
          gratificationAmount: true,
          proratedSalary: true,
          noticePaymentAmount: true,
          totalGross: true,
          totalNet: true,
          yearsOfService: true,
          averageSalary12M: true,
          // Document URLs (available after generation)
          workCertificateDocumentId: true,
          finalPayslipDocumentId: true,
          cnpsAttestationDocumentId: true,
        },
      });

      if (!termination) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cessation non trouvée',
        });
      }

      return {
        id: termination.id,
        employeeId: termination.employeeId,
        status: (termination.processingStatus || 'idle') as 'idle' | 'pending' | 'processing' | 'completed' | 'failed',
        progress: termination.processingProgress || 0,
        currentStep: termination.processingCurrentStep,
        startedAt: termination.processingStartedAt,
        completedAt: termination.processingCompletedAt,
        error: termination.processingError,
        inngestRunId: termination.inngestRunId,
        // STC results (if calculated)
        stcResults: termination.stcCalculatedAt ? {
          calculatedAt: termination.stcCalculatedAt,
          severancePay: termination.severanceAmount ? parseFloat(termination.severanceAmount) : 0,
          vacationPayout: termination.vacationPayoutAmount ? parseFloat(termination.vacationPayoutAmount) : 0,
          gratification: termination.gratificationAmount ? parseFloat(termination.gratificationAmount) : 0,
          proratedSalary: termination.proratedSalary ? parseFloat(termination.proratedSalary) : 0,
          noticePayment: termination.noticePaymentAmount ? parseFloat(termination.noticePaymentAmount) : 0,
          grossTotal: termination.totalGross ? parseFloat(termination.totalGross) : 0,
          netTotal: termination.totalNet ? parseFloat(termination.totalNet) : 0,
          yearsOfService: termination.yearsOfService ? parseFloat(termination.yearsOfService) : 0,
          averageSalary12M: termination.averageSalary12M ? parseFloat(termination.averageSalary12M) : 0,
        } : null,
        // Document IDs (if generated)
        documents: {
          workCertificateId: termination.workCertificateDocumentId,
          finalPayslipId: termination.finalPayslipDocumentId,
          cnpsAttestationId: termination.cnpsAttestationDocumentId,
        },
      };
    }),
});
