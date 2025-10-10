import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createSalaryBand,
  getSalaryBandByPosition,
  validateSalaryAgainstBand,
  getSalaryCompaRatio,
  listSalaryBands,
  updateSalaryBand,
  deleteSalaryBand,
} from '@/features/employees/services/salary-band.service';
import { TRPCError } from '@trpc/server';

const createBandSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis'),
  jobLevel: z.string().min(1, 'Le niveau est requis'),
  minSalary: z.number().min(0, 'Salaire minimum >= 0'),
  midSalary: z.number().min(0, 'Salaire milieu >= 0'),
  maxSalary: z.number().min(0, 'Salaire maximum >= 0'),
  currency: z.string().default('XOF'),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().optional(),
});

const updateBandSchema = z.object({
  bandId: z.string().uuid(),
  name: z.string().optional(),
  jobLevel: z.string().optional(),
  minSalary: z.number().min(0).optional(),
  midSalary: z.number().min(0).optional(),
  maxSalary: z.number().min(0).optional(),
});

const validateSalarySchema = z.object({
  salary: z.number().min(0),
  positionId: z.string().uuid(),
});

const getByPositionSchema = z.object({
  positionId: z.string().uuid(),
});

const listSchema = z.object({
  activeOnly: z.boolean().default(true),
}).optional().default({ activeOnly: true });

const deleteBandSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export const salaryBandsRouter = createTRPCRouter({
  create: publicProcedure
    .input(createBandSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await createSalaryBand({
          ...input,
          tenantId: ctx.user.tenantId,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de la bande',
        });
      }
    }),

  update: publicProcedure
    .input(updateBandSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { bandId, ...updates } = input;
        return await updateSalaryBand(bandId, ctx.user.tenantId, updates);
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour',
        });
      }
    }),

  list: publicProcedure
    .input(listSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await listSalaryBands(ctx.user.tenantId, input?.activeOnly ?? true);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération',
        });
      }
    }),

  getByPosition: publicProcedure
    .input(getByPositionSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getSalaryBandByPosition(input.positionId, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message || 'Bande non trouvée',
        });
      }
    }),

  validateSalary: publicProcedure
    .input(validateSalarySchema)
    .query(async ({ input, ctx }) => {
      try {
        const result = await validateSalaryAgainstBand({
          ...input,
          tenantId: ctx.user.tenantId,
        });

        // Calculate compa-ratio if band exists
        if (result.band) {
          const midpoint = parseFloat(result.band.midSalary || '0');
          const compaRatio = getSalaryCompaRatio(input.salary, midpoint);

          return {
            ...result,
            compaRatio,
            compaRatioDescription:
              compaRatio < 80
                ? 'Sous le marché'
                : compaRatio > 120
                ? 'Au-dessus du marché'
                : 'Compétitif',
          };
        }

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la validation',
        });
      }
    }),

  delete: publicProcedure
    .input(deleteBandSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await deleteSalaryBand(input.id, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suppression',
        });
      }
    }),
});
