import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { importLeavePlan } from '@/features/time-off/services/leave-planning-import.service';
import { generateLeavePlanningTemplate } from '@/scripts/generate-leave-planning-template';
import { db } from '@/db';
import { leavePlanningPeriods, timeOffRequests, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

export const leavePlanningRouter = createTRPCRouter({
  // Créer période
  createPeriod: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        year: z.number(),
        quarter: z.number().min(1).max(4).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const period = await db.insert(leavePlanningPeriods).values({
        tenantId: ctx.user.tenantId,
        name: input.name,
        year: input.year,
        quarter: input.quarter || null,
        status: 'draft',
      }).returning();

      return period[0];
    }),

  // Lister périodes
  listPeriods: protectedProcedure.query(async ({ ctx }) => {
    const { desc: descFn } = await import('drizzle-orm');
    const periods = await db.query.leavePlanningPeriods.findMany({
      where: eq(leavePlanningPeriods.tenantId, ctx.user.tenantId),
      orderBy: [descFn(leavePlanningPeriods.year), descFn(leavePlanningPeriods.quarter)],
    });

    return periods;
  }),

  // Stats période
  getPeriodStats: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ input }) => {
      const requests = await db.query.timeOffRequests.findMany({
        where: eq(timeOffRequests.planningPeriodId, input.periodId),
      });

      return {
        totalRequests: requests.length,
        pendingRequests: requests.filter((r) => r.status === 'pending' || r.status === 'planned').length,
        approvedRequests: requests.filter((r) => r.status === 'approved').length,
        conflictsCount: 0, // TODO: calculate from conflicts
      };
    }),

  // Télécharger template
  downloadTemplate: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const period = await db.query.leavePlanningPeriods.findFirst({
        where: eq(leavePlanningPeriods.id, input.periodId),
      });

      if (!period) throw new Error('Période introuvable');

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user.tenantId),
      });

      const workbook = generateLeavePlanningTemplate(
        tenant?.name || 'Mon Entreprise',
        period.name
      );

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64 = buffer.toString('base64');
      const filename = `template-conges-${period.name.replace(/\s/g, '-')}.xlsx`;

      return { base64, filename };
    }),

  // Importer plan
  importPlan: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
        periodId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await importLeavePlan(
        input.fileData,
        input.periodId,
        ctx.user.tenantId
      );

      return result;
    }),

  // Exporter plan
  exportPlan: protectedProcedure
    .input(
      z.object({
        periodId: z.string().optional(),
        filters: z.object({
          departmentId: z.string().optional(),
          status: z.string().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement export functionality
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([['Export à implémenter']]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64 = buffer.toString('base64');
      const filename = `export-conges-${new Date().toISOString().split('T')[0]}.xlsx`;

      return { base64, filename };
    }),

  // Couverture d'équipe
  getTeamCoverage: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        departmentId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Query leave_team_coverage view
      // TODO: implement view query
      return {};
    }),

  // Approuver en masse
  bulkApprovePlanned: protectedProcedure
    .input(z.object({ requestIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      // Change status from 'planned' to 'approved'
      for (const requestId of input.requestIds) {
        await db.update(timeOffRequests)
          .set({
            status: 'approved',
            reviewedAt: new Date().toISOString(),
            reviewedBy: ctx.user.id,
          })
          .where(eq(timeOffRequests.id, requestId));
      }

      return { success: true, count: input.requestIds.length };
    }),
});
