/**
 * Work Schedules tRPC Router
 *
 * Provides endpoints for variable schedule tracking (GAP-JOUR-002):
 * - Record daily/weekly schedules
 * - Submit for approval
 * - Manager approval/rejection
 * - Monthly totals for payroll
 */

import { z } from 'zod';
import {
  createTRPCRouter,
  publicProcedure,
  employeeProcedure,
  managerProcedure,
} from '../api/trpc';
import * as workScheduleService from '@/features/work-schedules/services/work-schedule.service';
import { TRPCError } from '@trpc/server';

// ========================================
// Validation Schemas
// ========================================

const scheduleTypeSchema = z.enum(['FULL_DAY', 'PARTIAL_DAY', 'ABSENT']);

const recordDaySchema = z.object({
  employeeId: z.string().uuid(),
  workDate: z.date(),
  scheduleType: scheduleTypeSchema.optional(),
  hoursWorked: z.number().min(0).max(24).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
  isPresent: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['draft', 'pending']).optional(),
});

const recordWeekSchema = z.object({
  employeeId: z.string().uuid(),
  weekSchedules: z.array(
    z.object({
      workDate: z.date(),
      isPresent: z.boolean(),
      hoursWorked: z.number().min(0).max(24).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      scheduleType: scheduleTypeSchema.optional(),
      notes: z.string().max(500).optional(),
    })
  ).min(1).max(7), // Max 7 days per week
});

const dateRangeSchema = z.object({
  employeeId: z.string().uuid(),
  startDate: z.date(),
  endDate: z.date(),
});

const monthSchema = z.object({
  employeeId: z.string().uuid(),
  month: z.date(), // Any date in the target month
});

const submitWeekSchema = z.object({
  employeeId: z.string().uuid(),
  weekStartDate: z.date(), // Monday of the week
});

const approveSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1).max(100), // Batch up to 100
});

const rejectSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1).max(100),
  rejectedReason: z.string().min(5).max(500),
});

const pendingSchedulesSchema = z.object({
  employeeId: z.string().uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// ========================================
// Router Definition
// ========================================

export const workSchedulesRouter = createTRPCRouter({
  /**
   * Record a single work day
   * Requires: Employee role (employees record their own schedules)
   */
  recordDay: employeeProcedure
    .input(recordDaySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await workScheduleService.recordWorkDay(
          input.employeeId,
          ctx.user.tenantId,
          input.workDate,
          {
            scheduleType: input.scheduleType,
            hoursWorked: input.hoursWorked,
            startTime: input.startTime,
            endTime: input.endTime,
            isPresent: input.isPresent,
            notes: input.notes,
            status: input.status,
            createdBy: ctx.user.id,
          }
        );
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Record a full week of schedules (bulk)
   * Requires: Employee role (employees record their own schedules)
   */
  recordWeek: employeeProcedure
    .input(recordWeekSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await workScheduleService.recordWeek(
          input.employeeId,
          ctx.user.tenantId,
          input.weekSchedules,
          ctx.user.id
        );
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Get schedules for date range
   * Requires: Employee role (employees view their own schedules)
   */
  getSchedules: employeeProcedure
    .input(dateRangeSchema)
    .query(async ({ input, ctx }) => {
      return await workScheduleService.getSchedules(
        input.employeeId,
        ctx.user.tenantId,
        input.startDate,
        input.endDate
      );
    }),

  /**
   * Get monthly schedule
   * Requires: Employee role (employees view their own schedules)
   */
  getMonthSchedule: employeeProcedure
    .input(monthSchema)
    .query(async ({ input, ctx }) => {
      return await workScheduleService.getMonthSchedule(
        input.employeeId,
        ctx.user.tenantId,
        input.month
      );
    }),

  /**
   * Calculate monthly totals for payroll
   * Requires: Public (used by payroll service)
   */
  getMonthTotals: publicProcedure
    .input(monthSchema)
    .query(async ({ input, ctx }) => {
      return await workScheduleService.calculateMonthTotals(
        input.employeeId,
        ctx.user.tenantId,
        input.month
      );
    }),

  /**
   * Submit week for approval
   * Requires: Employee role (employees submit their own schedules)
   */
  submitForApproval: employeeProcedure
    .input(submitWeekSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await workScheduleService.submitWeekForApproval(
          input.employeeId,
          ctx.user.tenantId,
          input.weekStartDate
        );
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Approve schedules (single or batch)
   * Requires: Manager role (managers approve team schedules)
   */
  approve: managerProcedure
    .input(approveSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await workScheduleService.approveSchedules(
          input.scheduleIds,
          ctx.user.id
        );
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Reject schedules
   * Requires: Manager role (managers reject schedules)
   */
  reject: managerProcedure
    .input(rejectSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await workScheduleService.rejectSchedules(
          input.scheduleIds,
          ctx.user.id,
          input.rejectedReason
        );
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Get pending schedules for approval
   * Requires: Manager role (managers view pending schedules)
   */
  getPending: managerProcedure
    .input(pendingSchedulesSchema)
    .query(async ({ input, ctx }) => {
      return await workScheduleService.getPendingSchedules(
        ctx.user.tenantId,
        {
          employeeId: input.employeeId,
          startDate: input.startDate,
          endDate: input.endDate,
        }
      );
    }),

  /**
   * Validate schedules for payroll
   * Requires: Public (used by payroll service)
   */
  validateForPayroll: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        periodStart: z.date(),
        periodEnd: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await workScheduleService.validateSchedulesForPayroll(
        input.employeeId,
        ctx.user.tenantId,
        input.periodStart,
        input.periodEnd
      );
    }),

  /**
   * Get summary statistics (for dashboard)
   * Requires: Manager role (managers view team statistics)
   */
  getSummary: managerProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = await import('@/db');
      const { workSchedules } = await import('@/lib/db/schema/work-schedules');
      const { and, eq, gte, lte, sql } = await import('drizzle-orm');

      const conditions = [eq(workSchedules.tenantId, ctx.user.tenantId)];

      if (input.startDate) {
        conditions.push(gte(workSchedules.workDate, input.startDate.toISOString().split('T')[0]));
      }
      if (input.endDate) {
        conditions.push(lte(workSchedules.workDate, input.endDate.toISOString().split('T')[0]));
      }

      const result = await db
        .select({
          totalDays: sql<number>`COUNT(*)`,
          totalHours: sql<number>`SUM(COALESCE(${workSchedules.hoursWorked}::numeric, 0))`,
          pendingDays: sql<number>`COUNT(*) FILTER (WHERE ${workSchedules.status} = 'pending')`,
          approvedDays: sql<number>`COUNT(*) FILTER (WHERE ${workSchedules.status} = 'approved')`,
          rejectedDays: sql<number>`COUNT(*) FILTER (WHERE ${workSchedules.status} = 'rejected')`,
          presentDays: sql<number>`COUNT(*) FILTER (WHERE ${workSchedules.isPresent} = true)`,
        })
        .from(workSchedules)
        .where(and(...conditions));

      return {
        totalDays: Number(result[0]?.totalDays || 0),
        totalHours: Number(result[0]?.totalHours || 0),
        pendingDays: Number(result[0]?.pendingDays || 0),
        approvedDays: Number(result[0]?.approvedDays || 0),
        rejectedDays: Number(result[0]?.rejectedDays || 0),
        presentDays: Number(result[0]?.presentDays || 0),
      };
    }),

  /**
   * Bulk approve all pending schedules for a week
   * Requires: Manager role (managers bulk approve)
   */
  bulkApproveWeek: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        weekStartDate: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { db } = await import('@/db');
        const { workSchedules } = await import('@/lib/db/schema/work-schedules');
        const { and, eq } = await import('drizzle-orm');
        const { format } = await import('date-fns');

        // Get all pending schedules for this week
        const pending = await db
          .select()
          .from(workSchedules)
          .where(
            and(
              eq(workSchedules.tenantId, ctx.user.tenantId),
              eq(workSchedules.employeeId, input.employeeId),
              eq(workSchedules.weekStartDate, format(input.weekStartDate, 'yyyy-MM-dd')),
              eq(workSchedules.status, 'pending')
            )
          );

        if (pending.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Aucun horaire en attente pour cette semaine',
          });
        }

        const scheduleIds = pending.map((s) => s.id);

        return await workScheduleService.approveSchedules(scheduleIds, ctx.user.id);
      } catch (error) {
        if (error instanceof workScheduleService.WorkScheduleError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
});
