/**
 * Salary Reviews tRPC Router
 *
 * Handles salary review approval workflows.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createSalaryReview,
  reviewSalaryChange,
  getPendingReviews,
  getEmployeeReviewHistory,
  cancelSalaryReview,
} from '@/features/employees/services/salary-review.service';
import { eventBus } from '@/lib/event-bus';
import { TRPCError } from '@trpc/server';

const allowancesSchema = z.object({
  housingAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  mealAllowance: z.number().min(0).optional(),
  otherAllowances: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    taxable: z.boolean(),
  })).optional(),
});

const createReviewSchema = z.object({
  employeeId: z.string().uuid(),
  proposedSalary: z.number().min(0),
  proposedAllowances: allowancesSchema.optional(),
  effectiveFrom: z.date(),
  reason: z.string().min(1),
  justification: z.string().optional(),
});

const reviewDecisionSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
});

export const salaryReviewsRouter = createTRPCRouter({
  /**
   * Create a new salary review request
   */
  create: publicProcedure
    .input(createReviewSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const review = await createSalaryReview({
          ...input,
          tenantId: ctx.user.tenantId,
          requestedBy: ctx.user.id,
        });

        await eventBus.publish('salary_review.created', {
          reviewId: review.id,
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          requestedBy: ctx.user.id,
        });

        return review;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de la demande',
        });
      }
    }),

  /**
   * Approve or reject a salary review
   */
  review: publicProcedure
    .input(reviewDecisionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const review = await reviewSalaryChange({
          ...input,
          tenantId: ctx.user.tenantId,
          reviewedBy: ctx.user.id,
        });

        await eventBus.publish('salary_review.decided', {
          reviewId: review.id,
          employeeId: review.employeeId,
          tenantId: ctx.user.tenantId,
          decision: input.decision,
          reviewedBy: ctx.user.id,
        });

        return review;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la révision',
        });
      }
    }),

  /**
   * Get all pending reviews for the tenant
   */
  listPending: publicProcedure
    .query(async ({ ctx }) => {
      try {
        return await getPendingReviews(ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des demandes',
        });
      }
    }),

  /**
   * Get review history for an employee
   */
  getHistory: publicProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        return await getEmployeeReviewHistory(input.employeeId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération de l\'historique',
        });
      }
    }),

  /**
   * Cancel a pending salary review
   */
  cancel: publicProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await cancelSalaryReview(input.reviewId, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de l\'annulation',
        });
      }
    }),
});
