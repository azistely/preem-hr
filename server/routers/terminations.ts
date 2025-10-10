/**
 * Terminations tRPC Router
 *
 * Handles employee termination operations with:
 * - Terminal calculations (severance, vacation payout)
 * - Document generation tracking
 * - Workflow status management
 * - Convention Collective compliance
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
});
