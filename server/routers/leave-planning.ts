import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { importLeavePlan } from '@/features/time-off/services/leave-planning-import.service';
import { generateLeavePlanningTemplate } from '@/scripts/generate-leave-planning-template';
import { db } from '@/lib/db';
import { leavePlanningPeriods, timeOffRequests, tenants, employees, timeOffPolicies } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import * as XLSX from 'xlsx';

export const leavePlanningRouter = createTRPCRouter({
  // List employees (for dropdowns)
  listEmployees: protectedProcedure.query(async ({ ctx }) => {
    const employeeList = await db.query.employees.findMany({
      where: eq(employees.tenantId, ctx.user.tenantId),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
      },
      orderBy: [employees.lastName, employees.firstName],
    });

    return employeeList;
  }),

  // List time-off policies (for dropdowns)
  listPolicies: protectedProcedure.query(async ({ ctx }) => {
    const policies = await db.query.timeOffPolicies.findMany({
      where: eq(timeOffPolicies.tenantId, ctx.user.tenantId),
      columns: {
        id: true,
        name: true,
      },
      orderBy: [timeOffPolicies.name],
    });

    return policies;
  }),

  // Get all requests for inline editing
  getRequestsForPeriod: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .query(async ({ input, ctx }) => {
      const results = await db
        .select({
          request: timeOffRequests,
          employee: employees,
          policy: timeOffPolicies,
        })
        .from(timeOffRequests)
        .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
        .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
        .where(
          and(
            eq(timeOffRequests.planningPeriodId, input.periodId),
            eq(timeOffRequests.tenantId, ctx.user.tenantId)
          )
        )
        .orderBy(timeOffRequests.startDate);

      return results.map(({ request, employee, policy }) => ({
        id: request.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        policyId: policy.id,
        policyName: policy.name,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: Number(request.totalDays),
        notes: request.handoverNotes || '',
        status: request.status,
      }));
    }),

  // Upsert single request (inline edit)
  upsertRequest: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        periodId: z.string(),
        employeeId: z.string(),
        policyId: z.string(),
        startDate: z.string(), // YYYY-MM-DD format
        endDate: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate employee exists
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(employees.id, input.employeeId),
          eq(employees.tenantId, ctx.user.tenantId)
        ),
      });

      if (!employee) {
        throw new Error('Employé introuvable');
      }

      // Validate policy exists
      const policy = await db.query.timeOffPolicies.findFirst({
        where: and(
          eq(timeOffPolicies.id, input.policyId),
          eq(timeOffPolicies.tenantId, ctx.user.tenantId)
        ),
      });

      if (!policy) {
        throw new Error('Type de congé introuvable');
      }

      // Parse dates
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      if (endDate < startDate) {
        throw new Error('La date de fin doit être après la date de début');
      }

      // Calculate business days
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const businessDays = days.filter(day => !isWeekend(day)).length;

      // Check for overlaps (conflicts)
      const overlaps = await db
        .select()
        .from(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.employeeId, input.employeeId),
            eq(timeOffRequests.tenantId, ctx.user.tenantId)
          )
        );

      const conflicts = overlaps.filter((req) => {
        if (input.id && req.id === input.id) return false; // Skip self
        if (req.status === 'rejected' || req.status === 'cancelled') return false;

        const reqStart = new Date(req.startDate);
        const reqEnd = new Date(req.endDate);
        return (startDate <= reqEnd && endDate >= reqStart);
      });

      // Insert or update
      if (input.id) {
        // Update existing
        await db.update(timeOffRequests)
          .set({
            employeeId: input.employeeId,
            policyId: input.policyId,
            startDate: input.startDate,
            endDate: input.endDate,
            totalDays: businessDays.toString(),
            handoverNotes: input.notes || null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(timeOffRequests.id, input.id));
      } else {
        // Create new
        const [newRequest] = await db.insert(timeOffRequests).values({
          tenantId: ctx.user.tenantId,
          employeeId: input.employeeId,
          policyId: input.policyId,
          startDate: input.startDate,
          endDate: input.endDate,
          totalDays: businessDays.toString(),
          status: 'planned',
          planningPeriodId: input.periodId,
          handoverNotes: input.notes || null,
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning();

        return {
          request: newRequest,
          conflicts: conflicts.map(c => ({
            type: 'overlap' as const,
            message: `Chevauchement avec congé du ${c.startDate} au ${c.endDate}`,
            conflictingRequestId: c.id,
          })),
        };
      }

      return {
        request: null, // Updated request
        conflicts: conflicts.map(c => ({
          type: 'overlap' as const,
          message: `Chevauchement avec congé du ${c.startDate} au ${c.endDate}`,
          conflictingRequestId: c.id,
        })),
      };
    }),

  // Delete request
  deleteRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.delete(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.id, input.requestId),
            eq(timeOffRequests.tenantId, ctx.user.tenantId)
          )
        );

      return { success: true };
    }),

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
