/**
 * Positions tRPC Router
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createPosition,
  getPositionHierarchy,
  listPositions,
} from '@/features/employees/services/position.service';
import { TRPCError } from '@trpc/server';

const createPositionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  code: z.string().optional(),
  description: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  reportsToPositionId: z.string().uuid().optional(),
  minSalary: z.number().min(75000).optional(),
  maxSalary: z.number().optional(),
  jobLevel: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).default('full_time'),
  weeklyHours: z.number().min(1).max(80).default(40),
  workSchedule: z.record(z.any()).optional(),
  headcount: z.number().int().min(1).default(1),
});

const getHierarchySchema = z.object({
  positionId: z.string().uuid(),
});

const listPositionsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
});

export const positionsRouter = createTRPCRouter({
  create: publicProcedure
    .input(createPositionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await createPosition({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.user.id,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création du poste',
        });
      }
    }),

  getHierarchy: publicProcedure
    .input(getHierarchySchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getPositionHierarchy(input.positionId, ctx.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message || 'Poste non trouvé',
        });
      }
    }),

  list: publicProcedure
    .input(listPositionsSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await listPositions(ctx.tenantId, input.status);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des postes',
        });
      }
    }),
});
