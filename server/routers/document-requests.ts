/**
 * Document Requests Router - Administrative Document Request Management
 *
 * Provides endpoints for:
 * - Employee document requests (self-service)
 * - Manager requests on behalf of team
 * - HR approval/rejection workflow
 * - Document generation integration
 * - Statistics and reporting
 *
 * Security: All endpoints use tenant isolation via ctx.user.tenantId
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  documentRequests,
  DocumentRequestStatus,
  DocumentRequestType,
  DocumentRequestTypeLabels,
  DocumentRequestStatusLabels,
} from '@/lib/db/schema/document-requests';
import { employees } from '@/lib/db/schema/employees';
import { users } from '@/lib/db/schema/users';
import { uploadedDocuments } from '@/lib/db/schema/documents';

/**
 * Zod schemas for input validation
 */

const createRequestSchema = z.object({
  employeeId: z.string().uuid(),
  documentType: z.enum([
    'attestation_travail',
    'attestation_emploi',
    'attestation_salaire',
    'declaration_fiscale',
    'attestation_cnps',
    'domiciliation_bancaire',
    'copie_contrat',
  ]),
  requestNotes: z.string().max(500).optional(),
  requestedOnBehalfOf: z.boolean().default(false),
});

const listRequestsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['pending', 'processing', 'ready', 'rejected', 'cancelled']),
      z.array(z.enum(['pending', 'processing', 'ready', 'rejected', 'cancelled'])),
    ])
    .nullable()
    .optional(),
  documentType: z.enum([
    'attestation_travail',
    'attestation_emploi',
    'attestation_salaire',
    'declaration_fiscale',
    'attestation_cnps',
    'domiciliation_bancaire',
    'copie_contrat',
  ]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
});

const rejectRequestSchema = z.object({
  requestId: z.string().uuid(),
  rejectionReason: z.string().min(10).max(500),
});

export const documentRequestsRouter = createTRPCRouter({
  /**
   * Get document type options for the request form
   */
  getDocumentTypes: protectedProcedure.query(() => {
    const types = Object.entries(DocumentRequestType).map(([key, value]) => ({
      value,
      label: DocumentRequestTypeLabels[value],
    }));
    return types;
  }),

  /**
   * List document requests with filtering
   */
  list: protectedProcedure
    .input(listRequestsSchema)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Build where conditions
      const conditions = [eq(documentRequests.tenantId, tenantId)];

      if (input.employeeId) {
        conditions.push(eq(documentRequests.employeeId, input.employeeId));
      }

      if (input.status) {
        const statuses = Array.isArray(input.status) ? input.status : [input.status];
        conditions.push(inArray(documentRequests.status, statuses));
      }

      if (input.documentType) {
        conditions.push(eq(documentRequests.documentType, input.documentType));
      }

      const [requests, countResult] = await Promise.all([
        db
          .select({
            id: documentRequests.id,
            employeeId: documentRequests.employeeId,
            documentType: documentRequests.documentType,
            requestNotes: documentRequests.requestNotes,
            requestedBy: documentRequests.requestedBy,
            requestedOnBehalfOf: documentRequests.requestedOnBehalfOf,
            status: documentRequests.status,
            submittedAt: documentRequests.submittedAt,
            reviewedBy: documentRequests.reviewedBy,
            reviewedAt: documentRequests.reviewedAt,
            rejectionReason: documentRequests.rejectionReason,
            generatedDocumentId: documentRequests.generatedDocumentId,
            documentReadyAt: documentRequests.documentReadyAt,
            employeeName: documentRequests.employeeName,
            employeeNumber: documentRequests.employeeNumber,
            createdAt: documentRequests.createdAt,
          })
          .from(documentRequests)
          .where(and(...conditions))
          .orderBy(desc(documentRequests.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(documentRequests)
          .where(and(...conditions)),
      ]);

      return {
        requests: requests.map((r) => ({
          ...r,
          documentTypeLabel: DocumentRequestTypeLabels[r.documentType as keyof typeof DocumentRequestTypeLabels] ?? r.documentType,
          statusLabel: DocumentRequestStatusLabels[r.status as keyof typeof DocumentRequestStatusLabels] ?? r.status,
        })),
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  /**
   * Get single request by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const request = await db
        .select()
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.id, input.id),
            eq(documentRequests.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!request[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande introuvable',
        });
      }

      // Get generated document URL if exists
      let documentUrl: string | null = null;
      if (request[0].generatedDocumentId) {
        const doc = await db
          .select({ fileUrl: uploadedDocuments.fileUrl })
          .from(uploadedDocuments)
          .where(eq(uploadedDocuments.id, request[0].generatedDocumentId))
          .limit(1);
        documentUrl = doc[0]?.fileUrl ?? null;
      }

      return {
        ...request[0],
        documentTypeLabel: DocumentRequestTypeLabels[request[0].documentType as keyof typeof DocumentRequestTypeLabels],
        statusLabel: DocumentRequestStatusLabels[request[0].status as keyof typeof DocumentRequestStatusLabels],
        documentUrl,
      };
    }),

  /**
   * Create new document request (Employee-facing)
   */
  create: protectedProcedure
    .input(createRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      // Get employee details for snapshot
      const employee = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!employee[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employé introuvable',
        });
      }

      // Check for duplicate pending request
      const existingPending = await db
        .select({ id: documentRequests.id })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            eq(documentRequests.employeeId, input.employeeId),
            eq(documentRequests.documentType, input.documentType),
            eq(documentRequests.status, DocumentRequestStatus.PENDING)
          )
        )
        .limit(1);

      if (existingPending[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Une demande pour ce type de document est déjà en attente',
        });
      }

      // Create the request
      const [newRequest] = await db
        .insert(documentRequests)
        .values({
          tenantId,
          employeeId: input.employeeId,
          documentType: input.documentType,
          requestNotes: input.requestNotes,
          requestedBy: userId,
          requestedOnBehalfOf: input.requestedOnBehalfOf,
          status: DocumentRequestStatus.PENDING,
          employeeName: `${employee[0].firstName} ${employee[0].lastName}`,
          employeeNumber: employee[0].employeeNumber,
        })
        .returning();

      // TODO: Notify HR users about new request

      return {
        ...newRequest,
        documentTypeLabel: DocumentRequestTypeLabels[newRequest.documentType as keyof typeof DocumentRequestTypeLabels],
        statusLabel: DocumentRequestStatusLabels[newRequest.status as keyof typeof DocumentRequestStatusLabels],
      };
    }),

  /**
   * Cancel a pending request (Employee-facing)
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get current request
      const request = await db
        .select()
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.id, input.id),
            eq(documentRequests.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!request[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande introuvable',
        });
      }

      if (request[0].status !== DocumentRequestStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seules les demandes en attente peuvent être annulées',
        });
      }

      const [updated] = await db
        .update(documentRequests)
        .set({
          status: DocumentRequestStatus.CANCELLED,
          updatedAt: new Date(),
        })
        .where(eq(documentRequests.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Get pending approvals for HR dashboard
   */
  getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const pending = await db
      .select({
        id: documentRequests.id,
        employeeId: documentRequests.employeeId,
        documentType: documentRequests.documentType,
        requestNotes: documentRequests.requestNotes,
        requestedOnBehalfOf: documentRequests.requestedOnBehalfOf,
        status: documentRequests.status,
        submittedAt: documentRequests.submittedAt,
        employeeName: documentRequests.employeeName,
        employeeNumber: documentRequests.employeeNumber,
        createdAt: documentRequests.createdAt,
      })
      .from(documentRequests)
      .where(
        and(
          eq(documentRequests.tenantId, tenantId),
          eq(documentRequests.status, DocumentRequestStatus.PENDING)
        )
      )
      .orderBy(documentRequests.createdAt);

    return pending.map((r) => ({
      ...r,
      documentTypeLabel: DocumentRequestTypeLabels[r.documentType as keyof typeof DocumentRequestTypeLabels] ?? r.documentType,
      statusLabel: DocumentRequestStatusLabels[r.status as keyof typeof DocumentRequestStatusLabels] ?? r.status,
    }));
  }),

  /**
   * Get pending count for navigation badge
   */
  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentRequests)
      .where(
        and(
          eq(documentRequests.tenantId, tenantId),
          eq(documentRequests.status, DocumentRequestStatus.PENDING)
        )
      );

    return { count: Number(result[0]?.count ?? 0) };
  }),

  /**
   * Approve a document request (HR-facing)
   * This will generate the document
   */
  approve: protectedProcedure
    .input(approveRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      // Get current request
      const request = await db
        .select()
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.id, input.requestId),
            eq(documentRequests.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!request[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande introuvable',
        });
      }

      if (request[0].status !== DocumentRequestStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette demande a déjà été traitée',
        });
      }

      // Mark as processing
      await db
        .update(documentRequests)
        .set({
          status: DocumentRequestStatus.PROCESSING,
          reviewedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(documentRequests.id, input.requestId));

      try {
        // TODO: Generate the document based on type
        // const generatedDoc = await generateRequestedDocument(
        //   request[0].documentType,
        //   request[0].employeeId,
        //   tenantId,
        //   userId
        // );

        // For now, mark as ready without actual document generation
        const [updated] = await db
          .update(documentRequests)
          .set({
            status: DocumentRequestStatus.READY,
            reviewedAt: new Date(),
            documentReadyAt: new Date(),
            // generatedDocumentId: generatedDoc.documentId,
            updatedAt: new Date(),
          })
          .where(eq(documentRequests.id, input.requestId))
          .returning();

        // TODO: Notify employee that document is ready

        return {
          ...updated,
          documentTypeLabel: DocumentRequestTypeLabels[updated.documentType as keyof typeof DocumentRequestTypeLabels],
          statusLabel: DocumentRequestStatusLabels[updated.status as keyof typeof DocumentRequestStatusLabels],
        };
      } catch (error: any) {
        // If generation fails, revert to pending
        await db
          .update(documentRequests)
          .set({
            status: DocumentRequestStatus.PENDING,
            reviewedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(documentRequests.id, input.requestId));

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message ?? 'Échec de génération du document',
        });
      }
    }),

  /**
   * Reject a document request (HR-facing)
   */
  reject: protectedProcedure
    .input(rejectRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const userId = ctx.user.id;

      // Get current request
      const request = await db
        .select()
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.id, input.requestId),
            eq(documentRequests.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!request[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande introuvable',
        });
      }

      if (request[0].status !== DocumentRequestStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette demande a déjà été traitée',
        });
      }

      const [updated] = await db
        .update(documentRequests)
        .set({
          status: DocumentRequestStatus.REJECTED,
          reviewedBy: userId,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(documentRequests.id, input.requestId))
        .returning();

      // TODO: Notify employee about rejection

      return {
        ...updated,
        documentTypeLabel: DocumentRequestTypeLabels[updated.documentType as keyof typeof DocumentRequestTypeLabels],
        statusLabel: DocumentRequestStatusLabels[updated.status as keyof typeof DocumentRequestStatusLabels],
      };
    }),

  /**
   * Get statistics for HR dashboard
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const [pendingResult, processingResult, readyThisMonthResult, rejectedThisMonthResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            eq(documentRequests.status, DocumentRequestStatus.PENDING)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            eq(documentRequests.status, DocumentRequestStatus.PROCESSING)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            eq(documentRequests.status, DocumentRequestStatus.READY),
            sql`${documentRequests.documentReadyAt} >= date_trunc('month', CURRENT_DATE)`
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            eq(documentRequests.status, DocumentRequestStatus.REJECTED),
            sql`${documentRequests.reviewedAt} >= date_trunc('month', CURRENT_DATE)`
          )
        ),
    ]);

    return {
      pendingCount: Number(pendingResult[0]?.count ?? 0),
      processingCount: Number(processingResult[0]?.count ?? 0),
      readyThisMonth: Number(readyThisMonthResult[0]?.count ?? 0),
      rejectedThisMonth: Number(rejectedThisMonthResult[0]?.count ?? 0),
    };
  }),

  /**
   * Get my requests (for employee portal)
   */
  getMyRequests: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    const employeeId = ctx.user.employeeId;

    if (!employeeId) {
      return { requests: [] };
    }

    const requests = await db
      .select({
        id: documentRequests.id,
        documentType: documentRequests.documentType,
        requestNotes: documentRequests.requestNotes,
        status: documentRequests.status,
        submittedAt: documentRequests.submittedAt,
        reviewedAt: documentRequests.reviewedAt,
        rejectionReason: documentRequests.rejectionReason,
        generatedDocumentId: documentRequests.generatedDocumentId,
        documentReadyAt: documentRequests.documentReadyAt,
      })
      .from(documentRequests)
      .where(
        and(
          eq(documentRequests.tenantId, tenantId),
          eq(documentRequests.employeeId, employeeId)
        )
      )
      .orderBy(desc(documentRequests.createdAt))
      .limit(50);

    return {
      requests: requests.map((r) => ({
        ...r,
        documentTypeLabel: DocumentRequestTypeLabels[r.documentType as keyof typeof DocumentRequestTypeLabels] ?? r.documentType,
        statusLabel: DocumentRequestStatusLabels[r.status as keyof typeof DocumentRequestStatusLabels] ?? r.status,
      })),
    };
  }),

  /**
   * Get team requests (for manager portal)
   */
  getTeamRequests: protectedProcedure
    .input(z.object({
      managerId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, tenantId),
            input.managerId
              ? eq(employees.reportingManagerId, input.managerId)
              : eq(employees.reportingManagerId, ctx.user.employeeId ?? '')
          )
        );

      if (teamMembers.length === 0) {
        return { requests: [] };
      }

      const teamMemberIds = teamMembers.map((m) => m.id);

      const requests = await db
        .select({
          id: documentRequests.id,
          employeeId: documentRequests.employeeId,
          documentType: documentRequests.documentType,
          requestNotes: documentRequests.requestNotes,
          requestedOnBehalfOf: documentRequests.requestedOnBehalfOf,
          status: documentRequests.status,
          submittedAt: documentRequests.submittedAt,
          reviewedAt: documentRequests.reviewedAt,
          rejectionReason: documentRequests.rejectionReason,
          employeeName: documentRequests.employeeName,
          employeeNumber: documentRequests.employeeNumber,
          generatedDocumentId: documentRequests.generatedDocumentId,
          documentReadyAt: documentRequests.documentReadyAt,
        })
        .from(documentRequests)
        .where(
          and(
            eq(documentRequests.tenantId, tenantId),
            inArray(documentRequests.employeeId, teamMemberIds)
          )
        )
        .orderBy(desc(documentRequests.createdAt))
        .limit(100);

      return {
        requests: requests.map((r) => ({
          ...r,
          documentTypeLabel: DocumentRequestTypeLabels[r.documentType as keyof typeof DocumentRequestTypeLabels] ?? r.documentType,
          statusLabel: DocumentRequestStatusLabels[r.status as keyof typeof DocumentRequestStatusLabels] ?? r.status,
        })),
      };
    }),
});
