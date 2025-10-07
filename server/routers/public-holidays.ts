/**
 * Public Holidays tRPC Router
 *
 * Handles all public holiday operations with:
 * - Admin-only CRUD operations
 * - Public read access for calendar/payroll calculations
 * - Country-specific filtering
 * - French error messages
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, hrManagerProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { publicHolidays } from '@/drizzle/schema';
import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';

// Zod Schemas
const createPublicHolidaySchema = z.object({
  countryCode: z.string().length(2, 'Code pays invalide (2 lettres)'),
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format YYYY-MM-DD)'),
  name: z.object({
    fr: z.string().min(1, 'Nom en français requis'),
    en: z.string().optional(),
  }),
  description: z.object({
    fr: z.string().optional(),
    en: z.string().optional(),
  }).optional(),
  isRecurring: z.boolean().default(true),
  isPaid: z.boolean().default(true),
});

const updatePublicHolidaySchema = z.object({
  id: z.string().uuid(),
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format YYYY-MM-DD)').optional(),
  name: z.object({
    fr: z.string().min(1),
    en: z.string().optional(),
  }).optional(),
  description: z.object({
    fr: z.string().optional(),
    en: z.string().optional(),
  }).optional(),
  isRecurring: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

const listPublicHolidaysSchema = z.object({
  countryCode: z.string().length(2).optional(),
  year: z.number().int().min(2020).max(2050).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const deletePublicHolidaySchema = z.object({
  id: z.string().uuid(),
});

// Router
export const publicHolidaysRouter = createTRPCRouter({
  /**
   * List public holidays with optional filtering
   * Public access - used by payroll calculations and employee calendars
   */
  list: publicProcedure
    .input(listPublicHolidaysSchema)
    .query(async ({ input }) => {
      try {
        const conditions = [];

        // Filter by country
        if (input.countryCode) {
          conditions.push(eq(publicHolidays.countryCode, input.countryCode));
        }

        // Filter by year (if provided)
        if (input.year) {
          const startOfYear = `${input.year}-01-01`;
          const endOfYear = `${input.year}-12-31`;
          conditions.push(gte(publicHolidays.holidayDate, startOfYear));
          conditions.push(lte(publicHolidays.holidayDate, endOfYear));
        }

        // Filter by date range (if provided)
        if (input.startDate) {
          conditions.push(gte(publicHolidays.holidayDate, input.startDate));
        }
        if (input.endDate) {
          conditions.push(lte(publicHolidays.holidayDate, input.endDate));
        }

        const holidays = await db.query.publicHolidays.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [asc(publicHolidays.holidayDate)],
        });

        return holidays;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des jours fériés',
        });
      }
    }),

  /**
   * Get a single public holiday by ID
   * Public access
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const holiday = await db.query.publicHolidays.findFirst({
          where: eq(publicHolidays.id, input.id),
        });

        if (!holiday) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jour férié introuvable',
          });
        }

        return holiday;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération du jour férié',
        });
      }
    }),

  /**
   * Create a new public holiday
   * Requires: HR Manager role or higher
   */
  create: hrManagerProcedure
    .input(createPublicHolidaySchema)
    .mutation(async ({ input }) => {
      try {
        const [newHoliday] = await db
          .insert(publicHolidays)
          .values({
            countryCode: input.countryCode,
            holidayDate: input.holidayDate,
            name: input.name,
            description: input.description,
            isRecurring: input.isRecurring,
            isPaid: input.isPaid,
          })
          .returning();

        return newHoliday;
      } catch (error: any) {
        // Handle unique constraint violation (duplicate country + date)
        if (error.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un jour férié existe déjà pour ce pays à cette date',
          });
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création du jour férié',
        });
      }
    }),

  /**
   * Update an existing public holiday
   * Requires: HR Manager role or higher
   */
  update: hrManagerProcedure
    .input(updatePublicHolidaySchema)
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input;

        const [updatedHoliday] = await db
          .update(publicHolidays)
          .set({
            ...updateData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(publicHolidays.id, id))
          .returning();

        if (!updatedHoliday) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jour férié introuvable',
          });
        }

        return updatedHoliday;
      } catch (error: any) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un jour férié existe déjà pour ce pays à cette date',
          });
        }

        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour du jour férié',
        });
      }
    }),

  /**
   * Delete a public holiday
   * Requires: HR Manager role or higher
   */
  delete: hrManagerProcedure
    .input(deletePublicHolidaySchema)
    .mutation(async ({ input }) => {
      try {
        const [deletedHoliday] = await db
          .delete(publicHolidays)
          .where(eq(publicHolidays.id, input.id))
          .returning();

        if (!deletedHoliday) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jour férié introuvable',
          });
        }

        return { success: true, id: deletedHoliday.id };
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suppression du jour férié',
        });
      }
    }),
});
