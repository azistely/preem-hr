/**
 * Registre du Personnel tRPC Router
 *
 * Handles digital employee register operations:
 * - Create hire/exit entries
 * - Search and filter entries
 * - Export to PDF for labor inspection
 * - View register statistics
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, hrManagerProcedure } from '../api/trpc';
import {
  createHireEntry,
  createExitEntry,
  exportToPDF,
  searchEntries,
  getRegisterStats,
} from '@/lib/compliance/registre-personnel.service';
import { TRPCError } from '@trpc/server';

// Zod Schemas
const createHireEntrySchema = z.object({
  employeeId: z.string().uuid('ID employé invalide'),
});

const createExitEntrySchema = z.object({
  employeeId: z.string().uuid('ID employé invalide'),
  exitDate: z.date({ required_error: 'La date de sortie est requise' }),
  exitReason: z.string().min(1, 'La raison de sortie est requise'),
});

const searchEntriesSchema = z.object({
  employeeName: z.string().optional(),
  department: z.string().optional(),
  entryType: z.enum(['hire', 'exit', 'modification']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const exportToPDFSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  activeOnly: z.boolean().default(false),
});

// Router
export const registreRouter = createTRPCRouter({
  /**
   * Create hire entry
   * Automatically called when employee is hired
   * Requires: HR Manager role
   */
  createHireEntry: hrManagerProcedure
    .input(createHireEntrySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createHireEntry({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
        });

        return {
          success: true,
          message: `Entrée n°${result.entryNumber} créée avec succès`,
          data: result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || "Erreur lors de la création de l'entrée d'embauche",
        });
      }
    }),

  /**
   * Create exit entry
   * Automatically called when employee is terminated
   * Requires: HR Manager role
   */
  createExitEntry: hrManagerProcedure
    .input(createExitEntrySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createExitEntry({
          employeeId: input.employeeId,
          exitDate: input.exitDate,
          exitReason: input.exitReason,
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
        });

        return {
          success: true,
          message: `Sortie n°${result.entryNumber} enregistrée avec succès`,
          data: result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || "Erreur lors de l'enregistrement de la sortie",
        });
      }
    }),

  /**
   * Search register entries with filters
   */
  searchEntries: publicProcedure
    .input(searchEntriesSchema)
    .query(async ({ input, ctx }) => {
      try {
        const entries = await searchEntries(ctx.user.tenantId, input);

        return {
          success: true,
          data: entries,
          totalEntries: entries.length,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la recherche des entrées',
        });
      }
    }),

  /**
   * Get register statistics
   */
  getStats: publicProcedure.query(async ({ ctx }) => {
    try {
      const stats = await getRegisterStats(ctx.user.tenantId);

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Erreur lors de la récupération des statistiques',
      });
    }
  }),

  /**
   * Export register to PDF
   * Generates legally compliant PDF for labor inspection
   * Requires: HR Manager role
   */
  exportToPDF: hrManagerProcedure
    .input(exportToPDFSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await exportToPDF(ctx.user.tenantId, input, ctx.user.id);

        return {
          success: true,
          message: `PDF généré avec succès (${result.totalEntries} entrée(s))`,
          data: {
            fileUrl: result.fileUrl,
            totalEntries: result.totalEntries,
          },
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du PDF',
        });
      }
    }),

  /**
   * List all entries (paginated)
   */
  listEntries: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        entryType: z.enum(['hire', 'exit', 'modification']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const entries = await searchEntries(ctx.user.tenantId, {
          entryType: input.entryType,
        });

        // Simple pagination
        const paginatedEntries = entries.slice(input.offset, input.offset + input.limit);

        return {
          success: true,
          data: paginatedEntries,
          total: entries.length,
          hasMore: input.offset + input.limit < entries.length,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des entrées',
        });
      }
    }),
});
