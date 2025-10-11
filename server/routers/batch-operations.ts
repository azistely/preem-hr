/**
 * Batch Operations tRPC Router
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Handles bulk operations with progress tracking:
 * - Bulk salary updates
 * - Mass document generation
 * - Batch notifications
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { batchOperations } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { sendEvent } from '@/lib/inngest/client';

export const batchOperationsRouter = createTRPCRouter({
  /**
   * List batch operations for the tenant
   */
  list: hrManagerProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
        operationType: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { status, operationType, limit, offset } = input;

      // Build where conditions
      const conditions = [eq(batchOperations.tenantId, ctx.user.tenantId)];

      if (status) {
        conditions.push(eq(batchOperations.status, status));
      }

      if (operationType) {
        conditions.push(eq(batchOperations.operationType, operationType));
      }

      // Fetch operations
      const operations = await ctx.db.query.batchOperations.findMany({
        where: and(...conditions),
        orderBy: [desc(batchOperations.createdAt)],
        limit,
        offset,
        with: {
          // @ts-expect-error - Relations not yet defined in schema
          startedBy: {
            columns: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(batchOperations)
        .where(and(...conditions));

      return {
        operations,
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get a single batch operation by ID
   */
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const operation = await ctx.db.query.batchOperations.findFirst({
        where: and(
          eq(batchOperations.id, input.id),
          eq(batchOperations.tenantId, ctx.user.tenantId)
        ),
        with: {
          // @ts-expect-error - Relations not yet defined in schema
          startedBy: {
            columns: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!operation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opération groupée non trouvée',
        });
      }

      return operation;
    }),

  /**
   * Get real-time status of a batch operation
   * Used for polling progress updates
   */
  getStatus: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const operation = await ctx.db.query.batchOperations.findFirst({
        where: and(
          eq(batchOperations.id, input.id),
          eq(batchOperations.tenantId, ctx.user.tenantId)
        ),
        columns: {
          id: true,
          status: true,
          totalCount: true,
          processedCount: true,
          successCount: true,
          errorCount: true,
          estimatedCompletionAt: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      if (!operation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opération groupée non trouvée',
        });
      }

      // Calculate progress percentage
      const progressPercentage =
        operation.totalCount > 0
          ? Math.round((operation.processedCount || 0 / operation.totalCount) * 100)
          : 0;

      return {
        ...operation,
        progressPercentage,
      };
    }),

  /**
   * Create a batch salary update operation
   * This queues the operation for background processing
   */
  updateSalaries: hrManagerProcedure
    .input(
      z.object({
        employeeIds: z.array(z.string().uuid()).min(1).max(500),
        updateType: z.enum(['absolute', 'percentage']),
        value: z.number().positive(),
        effectiveDate: z.date(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { employeeIds, updateType, value, effectiveDate, reason } = input;

      // Create batch operation record
      const [operation] = await ctx.db
        .insert(batchOperations)
        .values({
          tenantId: ctx.user.tenantId,
          operationType: 'salary_update',
          entityType: 'employees',
          entityIds: employeeIds,
          params: {
            updateType,
            value,
            effectiveDate: effectiveDate.toISOString(),
            reason,
          },
          status: 'pending',
          totalCount: employeeIds.length,
          processedCount: 0,
          successCount: 0,
          errorCount: 0,
          startedBy: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Trigger background job to process batch operation
      await sendEvent({
        name: 'batch.operation.created',
        data: {
          operationId: operation.id,
          operationType: 'salary_update',
          tenantId: ctx.user.tenantId,
          metadata: {
            userId: ctx.user.id,
            entityCount: employeeIds.length,
          },
        },
      });

      return {
        operation,
        message: 'Opération groupée créée avec succès et en cours de traitement',
      };
    }),

  /**
   * Cancel a pending or running batch operation
   */
  cancel: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const operation = await ctx.db.query.batchOperations.findFirst({
        where: and(
          eq(batchOperations.id, input.id),
          eq(batchOperations.tenantId, ctx.user.tenantId)
        ),
      });

      if (!operation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opération groupée non trouvée',
        });
      }

      if (operation.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible d\'annuler une opération terminée',
        });
      }

      if (operation.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Opération déjà annulée',
        });
      }

      // Update status
      const [updated] = await ctx.db
        .update(batchOperations)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(batchOperations.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Retry failed items in a batch operation
   */
  retryFailed: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const operation = await ctx.db.query.batchOperations.findFirst({
        where: and(
          eq(batchOperations.id, input.id),
          eq(batchOperations.tenantId, ctx.user.tenantId)
        ),
      });

      if (!operation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opération groupée non trouvée',
        });
      }

      if (operation.errorCount === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Aucune erreur à réessayer',
        });
      }

      // Extract failed entity IDs from errors
      const errors = operation.errors as Array<{ entityId: string; error: string }>;
      const failedIds = errors.map((e) => e.entityId);

      // Create new batch operation for retry
      const [retryOperation] = await ctx.db
        .insert(batchOperations)
        .values({
          tenantId: ctx.user.tenantId,
          operationType: operation.operationType,
          entityType: operation.entityType,
          entityIds: failedIds,
          params: {
            ...(operation.params as object || {}),
            retryOf: operation.id,
          },
          status: 'pending',
          totalCount: failedIds.length,
          processedCount: 0,
          successCount: 0,
          errorCount: 0,
          startedBy: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Trigger background job for retry operation
      await sendEvent({
        name: 'batch.operation.created',
        data: {
          operationId: retryOperation.id,
          operationType: retryOperation.operationType,
          tenantId: ctx.user.tenantId,
          metadata: {
            userId: ctx.user.id,
            entityCount: failedIds.length,
            retryOf: operation.id,
          },
        },
      });

      return {
        operation: retryOperation,
        message: `Nouvelle tentative créée pour ${failedIds.length} élément(s) et en cours de traitement`,
      };
    }),

  /**
   * Delete a batch operation (cleanup old records)
   */
  delete: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const operation = await ctx.db.query.batchOperations.findFirst({
        where: and(
          eq(batchOperations.id, input.id),
          eq(batchOperations.tenantId, ctx.user.tenantId)
        ),
      });

      if (!operation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opération groupée non trouvée',
        });
      }

      // Only allow deletion of completed or failed operations
      if (!['completed', 'failed', 'cancelled'].includes(operation.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de supprimer une opération en cours',
        });
      }

      await ctx.db.delete(batchOperations).where(eq(batchOperations.id, input.id));

      return { success: true };
    }),

  /**
   * Get statistics for batch operations
   */
  getStats: hrManagerProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db
      .select({
        status: batchOperations.status,
        count: sql<number>`count(*)::int`,
        totalEntities: sql<number>`sum(${batchOperations.totalCount})::int`,
      })
      .from(batchOperations)
      .where(eq(batchOperations.tenantId, ctx.user.tenantId))
      .groupBy(batchOperations.status);

    return {
      byStatus: stats,
      total: stats.reduce((acc, s) => acc + s.count, 0),
      totalEntitiesProcessed: stats.reduce((acc, s) => acc + (s.totalEntities || 0), 0),
    };
  }),
});
