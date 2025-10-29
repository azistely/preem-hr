import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { employeeCategoryCoefficients } from '@/lib/db/schema/payroll-config';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { cgeciSectorList, sectorGroups, searchSectors, type CGECISector } from '@/lib/cgeci/sector-mapping';

/**
 * CGECI Router
 *
 * Handles CGECI-related operations:
 * - List available CGECI sectors
 * - Get employee categories for a specific CGECI sector
 * - Search sectors
 */
export const cgeciRouter = createTRPCRouter({
  /**
   * List all CGECI sectors (for Q1 selection)
   */
  listSectors: publicProcedure
    .query(async () => {
      return cgeciSectorList;
    }),

  /**
   * Get grouped sectors (for visual cards in Q1)
   */
  getSectorGroups: publicProcedure
    .query(async () => {
      return sectorGroups;
    }),

  /**
   * Search CGECI sectors by query
   */
  searchSectors: publicProcedure
    .input(z.object({
      query: z.string(),
    }))
    .query(async ({ input }) => {
      return searchSectors(input.query);
    }),

  /**
   * Get employee categories for a specific CGECI sector
   * Used in Q2 to dynamically populate category dropdown based on company's sector
   */
  getCategoriesBySector: publicProcedure
    .input(z.object({
      sectorCode: z.string(),
      countryCode: z.string().default('CI'),
    }))
    .query(async ({ input }) => {
      try {
        const categories = await db
          .select({
            id: employeeCategoryCoefficients.id,
            category: employeeCategoryCoefficients.category,
            labelFr: employeeCategoryCoefficients.labelFr,
            minCoefficient: employeeCategoryCoefficients.minCoefficient,
            maxCoefficient: employeeCategoryCoefficients.maxCoefficient,
            actualMinimumWage: employeeCategoryCoefficients.actualMinimumWage,
            minimumWageBase: employeeCategoryCoefficients.minimumWageBase,
            noticePeriodDays: employeeCategoryCoefficients.noticePeriodDays,
            noticeReductionPercent: employeeCategoryCoefficients.noticeReductionPercent,
            notes: employeeCategoryCoefficients.notes,
            legalReference: employeeCategoryCoefficients.legalReference,
          })
          .from(employeeCategoryCoefficients)
          .where(
            and(
              eq(employeeCategoryCoefficients.countryCode, input.countryCode),
              eq(employeeCategoryCoefficients.sectorCode, input.sectorCode)
            )
          )
          .orderBy(employeeCategoryCoefficients.minCoefficient);

        if (categories.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Aucune catégorie trouvée pour le secteur ${input.sectorCode}`,
          });
        }

        return categories;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des catégories';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get minimum wage for a specific category in a sector
   */
  getCategoryMinimumWage: publicProcedure
    .input(z.object({
      sectorCode: z.string(),
      categoryCode: z.string(),
      countryCode: z.string().default('CI'),
    }))
    .query(async ({ input }) => {
      try {
        const result = await db
          .select({
            category: employeeCategoryCoefficients.category,
            labelFr: employeeCategoryCoefficients.labelFr,
            minCoefficient: employeeCategoryCoefficients.minCoefficient,
            actualMinimumWage: employeeCategoryCoefficients.actualMinimumWage,
          })
          .from(employeeCategoryCoefficients)
          .where(
            and(
              eq(employeeCategoryCoefficients.countryCode, input.countryCode),
              eq(employeeCategoryCoefficients.sectorCode, input.sectorCode),
              eq(employeeCategoryCoefficients.category, input.categoryCode)
            )
          )
          .limit(1);

        if (!result[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Catégorie ${input.categoryCode} non trouvée dans le secteur ${input.sectorCode}`,
          });
        }

        return result[0];
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération du salaire minimum';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
