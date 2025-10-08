import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createBulkAdjustment,
  calculateAffectedEmployees,
  processBulkAdjustment,
  getBulkAdjustmentStatus,
  listBulkAdjustments,
} from '@/features/employees/services/bulk-adjustment.service';
import { eventBus } from '@/lib/event-bus';
import { TRPCError } from '@trpc/server';

const filtersSchema = z.object({
  departmentIds: z.array(z.string().uuid()).optional(),
  positionIds: z.array(z.string().uuid()).optional(),
  minSalary: z.number().min(0).optional(),
  maxSalary: z.number().min(0).optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
});

const createAdjustmentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  adjustmentType: z.enum(['percentage', 'fixed_amount', 'custom']),
  adjustmentValue: z.number().optional(),
  effectiveFrom: z.date(),
  filters: filtersSchema.optional(),
});

const previewAdjustmentSchema = z.object({
  adjustmentId: z.string().uuid(),
});

const processAdjustmentSchema = z.object({
  adjustmentId: z.string().uuid(),
});

const getStatusSchema = z.object({
  adjustmentId: z.string().uuid(),
});

export const bulkAdjustmentsRouter = createTRPCRouter({
  create: publicProcedure
    .input(createAdjustmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const adjustment = await createBulkAdjustment({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });

        await eventBus.publish('bulk_adjustment.created', {
          adjustmentId: adjustment.id,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });

        return adjustment;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de l\'ajustement',
        });
      }
    }),

  preview: publicProcedure
    .input(previewAdjustmentSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await calculateAffectedEmployees(input.adjustmentId, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors du calcul de l\'aperçu',
        });
      }
    }),

  execute: publicProcedure
    .input(processAdjustmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await processBulkAdjustment({
          adjustmentId: input.adjustmentId,
          tenantId: ctx.user.tenantId,
          processedBy: ctx.user.id,
        });

        await eventBus.publish('bulk_adjustment.processed', {
          adjustmentId: input.adjustmentId,
          tenantId: ctx.user.tenantId,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors du traitement',
        });
      }
    }),

  getStatus: publicProcedure
    .input(getStatusSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getBulkAdjustmentStatus(input.adjustmentId, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message || 'Ajustement non trouvé',
        });
      }
    }),

  list: publicProcedure
    .query(async ({ ctx }) => {
      try {
        return await listBulkAdjustments(ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération',
        });
      }
    }),
});
