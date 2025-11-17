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
import * as approvalValidationService from '@/features/time-tracking/services/approval-validation.service';
import * as employeeProtectionService from '@/features/time-tracking/services/employee-protection.service';
import { TRPCError } from '@trpc/server';
import type { TimeEntryWithEmployee } from '@/lib/types/extended-models';
import { getShiftLengthHelper } from '@/lib/compliance/shift-validation.service';
import { db } from '@/db';
import { timeEntries, employees, assignments, positions } from '@/drizzle/schema';
import { and, eq, desc, sql, isNull, gte, lt, lte, inArray } from 'drizzle-orm';

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
   * Get time entries for employee (payroll review)
   * Returns detailed time entries with status for draft review
   * Requires: Manager role
   */
  getEmployeeEntries: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(timeEntries.tenantId, ctx.user.tenantId),
        eq(timeEntries.employeeId, input.employeeId),
        gte(timeEntries.clockIn, input.startDate.toISOString()),
        lte(timeEntries.clockIn, input.endDate.toISOString()),
      ];

      // Use manual join (TypeScript best practice)
      const result = await db
        .select({
          id: timeEntries.id,
          clockIn: timeEntries.clockIn,
          clockOut: timeEntries.clockOut,
          totalHours: timeEntries.totalHours,
          status: timeEntries.status,
          entrySource: timeEntries.entrySource,
          entryType: timeEntries.entryType,
          geofenceVerified: timeEntries.geofenceVerified,
          clockInPhotoUrl: timeEntries.clockInPhotoUrl,
          clockOutPhotoUrl: timeEntries.clockOutPhotoUrl,
          overtimeBreakdown: timeEntries.overtimeBreakdown,
          notes: timeEntries.notes,
          approvedBy: timeEntries.approvedBy,
          approvedAt: timeEntries.approvedAt,
          rejectionReason: timeEntries.rejectionReason,
          createdAt: timeEntries.createdAt,
        })
        .from(timeEntries)
        .where(and(...conditions))
        .orderBy(desc(timeEntries.clockIn));

      return result;
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
      console.log('[getPendingEntries] Query with filters:', {
        tenantId: ctx.user.tenantId,
        startDate: input.startDate?.toISOString(),
        endDate: input.endDate?.toISOString(),
      });

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

      // Use manual join (TypeScript best practice)
      const result = await db
        .select({
          // Time entry fields
          id: timeEntries.id,
          clockIn: timeEntries.clockIn,
          clockOut: timeEntries.clockOut,
          totalHours: timeEntries.totalHours,
          status: timeEntries.status,
          geofenceVerified: timeEntries.geofenceVerified,
          clockInPhotoUrl: timeEntries.clockInPhotoUrl,
          clockOutPhotoUrl: timeEntries.clockOutPhotoUrl,
          overtimeBreakdown: timeEntries.overtimeBreakdown,
          notes: timeEntries.notes,
          // Employee fields (flattened)
          employeeId: employees.id,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
        })
        .from(timeEntries)
        .innerJoin(employees, eq(timeEntries.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(desc(timeEntries.clockIn));

      // Reshape to match expected format
      const entries = result.map(entry => ({
        id: entry.id,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        totalHours: entry.totalHours,
        status: entry.status,
        geofenceVerified: entry.geofenceVerified,
        clockInPhotoUrl: entry.clockInPhotoUrl,
        clockOutPhotoUrl: entry.clockOutPhotoUrl,
        overtimeBreakdown: entry.overtimeBreakdown,
        notes: entry.notes,
        employee: {
          id: entry.employeeId,
          firstName: entry.employeeFirstName,
          lastName: entry.employeeLastName,
        },
      }));

      console.log('[getPendingEntries] Found entries:', {
        count: entries.length,
        entries: entries.map(e => ({
          id: e.id,
          employee: e.employee,
          clockIn: e.clockIn,
        })),
      });

      return entries;
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
   * Get all time entries with optional status filter
   * Requires: Manager role
   */
  getAllEntries: managerProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all'),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(timeEntries.tenantId, ctx.user.tenantId)];

      // Filter by status
      if (input.status !== 'all') {
        conditions.push(eq(timeEntries.status, input.status));
      }

      // Filter by date range
      if (input.startDate) {
        conditions.push(sql`${timeEntries.clockIn} >= ${input.startDate.toISOString()}`);
      }
      if (input.endDate) {
        conditions.push(sql`${timeEntries.clockIn} < ${input.endDate.toISOString()}`);
      }

      // Use manual join (TypeScript best practice)
      // Note: overtimeBreakdown is excluded from select to avoid Drizzle JSONB conversion error
      const result = await db
        .select({
          // Time entry fields
          id: timeEntries.id,
          clockIn: timeEntries.clockIn,
          clockOut: timeEntries.clockOut,
          totalHours: timeEntries.totalHours,
          status: timeEntries.status,
          entrySource: timeEntries.entrySource,
          entryType: timeEntries.entryType,
          geofenceVerified: timeEntries.geofenceVerified,
          clockInPhotoUrl: timeEntries.clockInPhotoUrl,
          clockOutPhotoUrl: timeEntries.clockOutPhotoUrl,
          notes: timeEntries.notes,
          approvedBy: timeEntries.approvedBy,
          approvedAt: timeEntries.approvedAt,
          rejectionReason: timeEntries.rejectionReason,
          createdAt: timeEntries.createdAt,
          // Employee fields (flattened)
          employeeId: employees.id,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        })
        .from(timeEntries)
        .innerJoin(employees, eq(timeEntries.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(desc(timeEntries.clockIn));

      // Fetch overtime breakdown separately to avoid JSONB conversion issues
      const entryIds = result.map((r) => r.id);
      let overtimeData: Record<string, any> = {};

      if (entryIds.length > 0) {
        const overtimeResult = await db
          .select({
            id: timeEntries.id,
            overtimeBreakdown: timeEntries.overtimeBreakdown,
          })
          .from(timeEntries)
          .where(inArray(timeEntries.id, entryIds));

        overtimeData = overtimeResult.reduce((acc, row) => {
          acc[row.id] = row.overtimeBreakdown;
          return acc;
        }, {} as Record<string, any>);
      }

      // Reshape to match expected format
      const entries = result.map((entry) => ({
        id: entry.id,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        totalHours: entry.totalHours,
        status: entry.status,
        entrySource: entry.entrySource,
        entryType: entry.entryType,
        geofenceVerified: entry.geofenceVerified,
        clockInPhotoUrl: entry.clockInPhotoUrl,
        clockOutPhotoUrl: entry.clockOutPhotoUrl,
        overtimeBreakdown: overtimeData[entry.id] || null,
        notes: entry.notes,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
        rejectionReason: entry.rejectionReason,
        createdAt: entry.createdAt,
        employee: {
          id: entry.employeeId,
          firstName: entry.employeeFirstName,
          lastName: entry.employeeLastName,
          employeeNumber: entry.employeeNumber,
        },
      }));

      return entries;
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

  /**
   * Manual Time Entry Endpoints
   * These allow managers/HR to manually enter hours for employees
   */

  /**
   * Create manual time entry
   * Requires: Manager role (managers/HR can manually enter hours)
   */
  createManualEntry: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        clockIn: z.string().datetime(),
        clockOut: z.string().datetime(),
        totalHours: z.number().min(0).max(24),
        locationId: z.string().uuid().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await timeEntryService.createManualTimeEntry({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          workDate: input.workDate,
          clockIn: input.clockIn,
          clockOut: input.clockOut,
          totalHours: input.totalHours,
          locationId: input.locationId,
          notes: input.notes,
        });

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
   * Update manual time entry
   * Requires: Manager role (managers/HR can update manual entries)
   */
  updateManualEntry: managerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
        clockIn: z.string().datetime().optional(),
        clockOut: z.string().datetime().optional(),
        totalHours: z.number().min(0).max(24).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await timeEntryService.updateManualTimeEntry(
          input.entryId,
          ctx.user.tenantId,
          {
            clockIn: input.clockIn,
            clockOut: input.clockOut,
            totalHours: input.totalHours,
            notes: input.notes,
          }
        );

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
   * Delete manual time entry
   * Requires: Manager role (managers/HR can delete manual entries)
   */
  deleteManualEntry: managerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const entry = await timeEntryService.deleteManualTimeEntry(
          input.entryId,
          ctx.user.tenantId
        );

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
   * Get manual time entries for period
   * Requires: Manager role (managers/HR view manual entries)
   */
  getManualEntries: managerProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      console.log('[getManualEntries] Query params:', {
        tenantId: ctx.user.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      const result = await timeEntryService.getManualTimeEntriesForPeriod(
        ctx.user.tenantId,
        input.startDate,
        input.endDate
      );

      console.log('[getManualEntries] Result from service:', {
        count: result.length,
        entries: result,
      });

      return result;
    }),

  /**
   * Bulk create/update manual time entries
   * Requires: Manager role (managers/HR can bulk enter hours)
   * Useful for monthly hour entry workflows
   */
  bulkUpsertManualEntries: managerProcedure
    .input(
      z.object({
        entries: z.array(
          z.object({
            entryId: z.string().uuid().optional(), // If provided, updates existing entry
            employeeId: z.string().uuid(),
            workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            clockIn: z.string().datetime(),
            clockOut: z.string().datetime(),
            totalHours: z.number().min(0).max(24),
            locationId: z.string().uuid().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log('[bulkUpsertManualEntries] Mutation called with:', {
        tenantId: ctx.user.tenantId,
        entriesCount: input.entries.length,
        entries: input.entries,
      });

      const results = [];
      const errors = [];

      for (const entry of input.entries) {
        try {
          if (entry.entryId) {
            console.log('[bulkUpsertManualEntries] Updating entry:', entry.entryId);
            // Update existing entry
            const updated = await timeEntryService.updateManualTimeEntry(
              entry.entryId,
              ctx.user.tenantId,
              {
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                totalHours: entry.totalHours,
                notes: entry.notes,
              }
            );
            results.push(updated);
          } else {
            console.log('[bulkUpsertManualEntries] Creating new entry for employee:', entry.employeeId);

            // HR managers and tenant admins auto-approve entries they create
            const shouldAutoApprove = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);

            // Create new entry
            const created = await timeEntryService.createManualTimeEntry({
              employeeId: entry.employeeId,
              tenantId: ctx.user.tenantId,
              workDate: entry.workDate,
              clockIn: entry.clockIn,
              clockOut: entry.clockOut,
              totalHours: entry.totalHours,
              locationId: entry.locationId,
              notes: entry.notes,
              approvedBy: shouldAutoApprove ? ctx.user.id : undefined,
            });
            console.log('[bulkUpsertManualEntries] Created entry:', {
              ...created,
              autoApproved: shouldAutoApprove,
            });
            results.push(created);
          }
        } catch (error) {
          console.error('[bulkUpsertManualEntries] Error creating entry:', error);
          if (error instanceof timeEntryService.TimeEntryError) {
            errors.push({
              employeeId: entry.employeeId,
              workDate: entry.workDate,
              error: error.message,
            });
          } else {
            throw error;
          }
        }
      }

      console.log('[bulkUpsertManualEntries] Mutation complete:', {
        success: results.length,
        errors: errors.length,
        results,
        errorDetails: errors,
      });

      return {
        success: results.length,
        errors: errors.length,
        results,
        errorDetails: errors,
      };
    }),

  /**
   * Get employees who need time entries for a specific date
   * Useful for daily worker fast entry flow
   * Requires: Manager role
   */
  getEmployeesNeedingHours: managerProcedure
    .input(
      z.object({
        date: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Calculate date range for the given date (start of day to end of day)
      const startOfDay = new Date(input.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(input.date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all active employees
      const activeEmployees = await db
        .select({
          employeeId: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          positionTitle: positions.title,
          positionId: positions.id,
        })
        .from(employees)
        .leftJoin(
          assignments,
          and(
            eq(assignments.employeeId, employees.id),
            isNull(assignments.effectiveTo) // Current assignment
          )
        )
        .leftJoin(positions, eq(positions.id, assignments.positionId))
        .where(
          and(
            eq(employees.tenantId, ctx.user.tenantId),
            eq(employees.status, 'active')
          )
        );

      // Get existing time entries for this date
      const existingEntries = await db
        .select({
          employeeId: timeEntries.employeeId,
        })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.tenantId, ctx.user.tenantId),
            gte(timeEntries.clockIn, startOfDay.toISOString()),
            lt(timeEntries.clockIn, endOfDay.toISOString())
          )
        );

      // Create a set of employee IDs who already have entries
      const employeeIdsWithEntries = new Set(existingEntries.map((e) => e.employeeId));

      // Filter out employees who already have entries
      const employeesNeedingHours = activeEmployees
        .filter((emp) => !employeeIdsWithEntries.has(emp.employeeId))
        .map((emp) => ({
          id: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          position: emp.positionTitle || 'Sans poste',
        }));

      return employeesNeedingHours;
    }),

  /**
   * Get employees approaching overtime limits (≥80% of 75h/year)
   * Used by compliance dashboard
   */
  getEmployeesApproachingLimits: hrManagerProcedure
    .input(
      z.object({
        warningThreshold: z.number().min(0).max(1).default(0.8),
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ ctx, input }) => {
      return await approvalValidationService.getEmployeesApproachingLimits(
        ctx.user.tenantId,
        input.warningThreshold,
        input.countryCode
      );
    }),

  /**
   * Get protected employees (minors, pregnant women)
   * Used by compliance dashboard
   */
  getProtectedEmployees: hrManagerProcedure.query(async ({ ctx }) => {
    return await employeeProtectionService.getProtectedEmployees(ctx.user.tenantId);
  }),

  /**
   * Validate time entry approval (check all compliance rules)
   * Returns warnings/errors for HR before approval
   */
  validateTimeEntryApproval: hrManagerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      return await approvalValidationService.validateTimeEntryApproval(
        input.entryId,
        input.countryCode
      );
    }),
});
