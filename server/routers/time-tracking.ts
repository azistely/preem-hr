/**
 * Time Tracking tRPC Router
 *
 * Provides endpoints for:
 * - Clock in/out
 * - Time entry management
 * - Overtime calculation
 * - Geofence configuration
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, employeeProcedure, managerProcedure, hrManagerProcedure } from '../api/trpc';
import * as timeEntryService from '@/features/time-tracking/services/time-entry.service';
import * as geofenceService from '@/features/time-tracking/services/geofence.service';
import * as overtimeService from '@/features/time-tracking/services/overtime.service';
import { TRPCError } from '@trpc/server';
import type { TimeEntryWithEmployee } from '@/lib/types/extended-models';
import { getShiftLengthHelper } from '@/lib/compliance/shift-validation.service';

const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const timeTrackingRouter = createTRPCRouter({
  /**
   * Clock in employee
   * Requires: Employee role (employees clock themselves in)
   */
  clockIn: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        location: geoLocationSchema.optional(),
        photoUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await timeEntryService.clockIn({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          location: input.location,
          photoUrl: input.photoUrl,
        });

        // Emit event
        // await eventBus.publish('time_tracking.clock_in', { entryId: entry.id });

        return entry;
      } catch (error) {
        if (error instanceof timeEntryService.TimeEntryError) {
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
   * Clock out employee
   * Requires: Employee role (employees clock themselves out)
   */
  clockOut: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        location: geoLocationSchema.optional(),
        photoUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await timeEntryService.clockOut({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          location: input.location,
          photoUrl: input.photoUrl,
        });

        // Emit event
        // await eventBus.publish('time_tracking.clock_out', { entryId: entry.id });

        return entry;
      } catch (error) {
        if (error instanceof timeEntryService.TimeEntryError) {
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
   * Get current time entry for employee
   * Requires: Employee role (employees view their own entries)
   */
  getCurrentEntry: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await timeEntryService.getCurrentTimeEntry(
        input.employeeId,
        ctx.user.tenantId
      );
    }),

  /**
   * Get time entries for employee in date range
   */
  getEntries: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await timeEntryService.getTimeEntries(
        input.employeeId,
        ctx.user.tenantId,
        input.startDate,
        input.endDate
      );
    }),

  /**
   * Approve time entry
   * Requires: Manager role (managers approve team entries)
   */
  approveEntry: managerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await timeEntryService.approveTimeEntry(
        input.entryId,
        ctx.user.id
      );
    }),

  /**
   * Reject time entry
   * Requires: Manager role (managers can reject entries)
   */
  rejectEntry: managerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
        rejectionReason: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await timeEntryService.rejectTimeEntry(
        input.entryId,
        ctx.user.id,
        input.rejectionReason
      );
    }),

  /**
   * Get overtime summary for payroll period
   * Requires: Employee role (employees view their own overtime, managers/HR view all)
   */
  getOvertimeSummary: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        periodStart: z.date(),
        periodEnd: z.date(),
      })
    )
    .query(async ({ input }) => {
      return await overtimeService.getOvertimeSummary(
        input.employeeId,
        input.periodStart,
        input.periodEnd
      );
    }),

  /**
   * Get overtime rules for country
   */
  getOvertimeRules: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Get country from tenant if not provided
      const countryCode = input.countryCode || 'CI'; // Default to Côte d'Ivoire
      return await overtimeService.getOvertimeRules(countryCode);
    }),

  /**
   * Get shift length helper text for sector (GAP-SEC-003)
   * Returns warning message if sector has shift length restrictions
   * Used in time tracking UI to guide users
   */
  getShiftLengthHelper: publicProcedure
    .input(
      z.object({
        sectorCode: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const helper = getShiftLengthHelper(input.sectorCode);
      return { helper };
    }),

  /**
   * Validate geofence
   */
  validateGeofence: publicProcedure
    .input(
      z.object({
        location: geoLocationSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      return await geofenceService.validateGeofence(
        ctx.user.tenantId,
        input.location
      );
    }),

  /**
   * Get geofence configuration
   */
  getGeofenceConfig: publicProcedure.query(async ({ ctx }) => {
    return await geofenceService.getGeofenceConfig(ctx.user.tenantId);
  }),

  /**
   * Get pending time entries for admin approval
   * Requires: Manager role (managers review pending entries)
   */
  getPendingEntries: managerProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = await import('@/db');
      const { timeEntries } = await import('@/drizzle/schema');
      const { and, eq, gte, lte, desc } = await import('drizzle-orm');

      const conditions = [
        eq(timeEntries.tenantId, ctx.user.tenantId),
        eq(timeEntries.status, 'pending'),
      ];

      if (input.startDate) {
        conditions.push(gte(timeEntries.clockIn, input.startDate.toISOString()));
      }
      if (input.endDate) {
        conditions.push(lte(timeEntries.clockIn, input.endDate.toISOString()));
      }

      return await db.query.timeEntries.findMany({
        where: and(...conditions),
        orderBy: [desc(timeEntries.clockIn)],
      }) as TimeEntryWithEmployee[];
    }),

  /**
   * Bulk approve time entries
   * Requires: Manager role (managers bulk approve team entries)
   */
  bulkApprove: managerProcedure
    .input(
      z.object({
        entryIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await Promise.all(
        input.entryIds.map((id) => timeEntryService.approveTimeEntry(id, ctx.user.id))
      );
    }),

  /**
   * Get overtime by employee for admin view
   */
  getOvertimeByEmployee: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        periodStart: z.date(),
        periodEnd: z.date(),
      })
    )
    .query(async ({ input }) => {
      return await overtimeService.getOvertimeSummary(
        input.employeeId,
        input.periodStart,
        input.periodEnd
      );
    }),

  /**
   * Get all pending entries summary
   */
  getPendingSummary: publicProcedure.query(async ({ ctx }) => {
    const { db } = await import('@/db');
    const { timeEntries } = await import('@/drizzle/schema');
    const { and, eq, sql } = await import('drizzle-orm');

    const result = await db
      .select({
        count: sql<number>`count(*)`,
        totalOvertime: sql<number>`sum(COALESCE((overtime_breakdown->>'hours_41_to_46')::numeric, 0) + COALESCE((overtime_breakdown->>'hours_above_46')::numeric, 0) + COALESCE((overtime_breakdown->>'weekend')::numeric, 0) + COALESCE((overtime_breakdown->>'night_work')::numeric, 0) + COALESCE((overtime_breakdown->>'holiday')::numeric, 0))`,
      })
      .from(timeEntries)
      .where(and(eq(timeEntries.tenantId, ctx.user.tenantId), eq(timeEntries.status, 'pending')));

    return {
      pendingCount: Number(result[0]?.count || 0),
      totalOvertimeHours: Number(result[0]?.totalOvertime || 0),
    };
  }),

  /**
   * Get monthly overtime report for all employees
   * Aggregated endpoint to avoid React Hooks violations
   * Requires: Manager role (managers view team overtime reports)
   */
  getMonthlyOvertimeReport: managerProcedure
    .input(
      z.object({
        periodStart: z.date(),
        periodEnd: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { listEmployees } = await import('@/features/employees/services/employee.service');

      // Fetch all active employees
      const { employees: activeEmployees } = await listEmployees({
        tenantId: ctx.user.tenantId,
        status: 'active',
        limit: 100,
      });

      // Fetch overtime for each employee in parallel
      const overtimeData = await Promise.all(
        activeEmployees.map(async (employee: any) => {
          const summary = await overtimeService.getOvertimeSummary(
            employee.id as string,
            input.periodStart,
            input.periodEnd
          );
          return { employee, summary };
        })
      );

      // Calculate totals
      const totals = overtimeData.reduce(
        (acc, { summary }) => {
          if (summary && summary.totalOvertimeHours > 0) {
            acc.totalHours += summary.totalOvertimeHours;
            acc.totalPay += summary.overtimePay || 0;
            acc.employeesWithOvertime++;
          }
          return acc;
        },
        { totalHours: 0, totalPay: 0, employeesWithOvertime: 0 }
      );

      return {
        overtimeData: overtimeData.filter(d => d.summary && d.summary.totalOvertimeHours > 0),
        totals,
        totalEmployees: activeEmployees.length,
      };
    }),
});
