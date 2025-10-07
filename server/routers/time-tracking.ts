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
import { router, publicProcedure } from '../trpc';
import * as timeEntryService from '@/features/time-tracking/services/time-entry.service';
import * as geofenceService from '@/features/time-tracking/services/geofence.service';
import * as overtimeService from '@/features/time-tracking/services/overtime.service';
import { TRPCError } from '@trpc/server';

const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const timeTrackingRouter = router({
  /**
   * Clock in employee
   */
  clockIn: publicProcedure
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
   */
  clockOut: publicProcedure
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
   */
  getCurrentEntry: publicProcedure
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
   */
  approveEntry: publicProcedure
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
   */
  rejectEntry: publicProcedure
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
   */
  getOvertimeSummary: publicProcedure
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
});
