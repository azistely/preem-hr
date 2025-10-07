/**
 * Job Search Days tRPC Router
 *
 * API endpoints for tracking job search days during notice period
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createJobSearchDay,
  updateJobSearchDay,
  listJobSearchDays,
  getJobSearchDayById,
  deleteJobSearchDay,
  getJobSearchStats,
} from '@/features/employees/services/job-search-tracking.service';
import { TRPCError } from '@trpc/server';

// Input validation schemas
const createJobSearchDaySchema = z.object({
  terminationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  searchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  dayType: z.enum(['full_day', 'half_day']),
  notes: z.string().optional(),
});

const updateJobSearchDaySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

const listJobSearchDaysSchema = z.object({
  terminationId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const jobSearchDaysRouter = createTRPCRouter({
  /**
   * Create a job search day request
   */
  create: publicProcedure
    .input(createJobSearchDaySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const jobSearchDay = await createJobSearchDay({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        });

        return jobSearchDay;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de créer le jour de recherche d\'emploi',
        });
      }
    }),

  /**
   * Update job search day (approve/reject)
   */
  update: publicProcedure
    .input(updateJobSearchDaySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const updated = await updateJobSearchDay({
          ...input,
          tenantId: ctx.tenantId,
          updatedBy: ctx.userId,
          approvedBy: input.status === 'approved' ? ctx.userId : undefined,
        });

        return updated;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de mettre à jour le jour de recherche d\'emploi',
        });
      }
    }),

  /**
   * List job search days with filters
   */
  list: publicProcedure
    .input(listJobSearchDaysSchema)
    .query(async ({ input, ctx }) => {
      try {
        const days = await listJobSearchDays({
          ...input,
          tenantId: ctx.tenantId,
        });

        return days;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de récupérer les jours de recherche d\'emploi',
        });
      }
    }),

  /**
   * Get job search day by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const day = await getJobSearchDayById(input.id, ctx.tenantId);

      if (!day) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Jour de recherche d\'emploi introuvable',
        });
      }

      return day;
    }),

  /**
   * Delete job search day
   */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const deleted = await deleteJobSearchDay(input.id, ctx.tenantId);
        return deleted;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de supprimer le jour de recherche d\'emploi',
        });
      }
    }),

  /**
   * Get job search statistics for a termination
   */
  getStats: publicProcedure
    .input(z.object({ terminationId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const stats = await getJobSearchStats(input.terminationId, ctx.tenantId);
        return stats;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de récupérer les statistiques',
        });
      }
    }),
});
