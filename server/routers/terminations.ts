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
});
