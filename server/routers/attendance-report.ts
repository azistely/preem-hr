/**
 * Attendance Report tRPC Router
 *
 * Provides endpoints for:
 * - Team attendance report (manager view - direct reports)
 * - All employees attendance report (admin view)
 * - Export to PDF/Excel
 */

import { z } from 'zod';
import {
  createTRPCRouter,
  managerProcedure,
  hrManagerProcedure,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { tenants, employees } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

import {
  getAttendanceReport,
  getDirectReportIds,
  calculatePeriodDates,
  generatePeriodLabel,
} from '@/features/attendance/services/attendance-report.service';

import type {
  AttendanceViewMode,
  AttendanceReportOutput,
} from '@/features/attendance/types/attendance.types';

// Input schema for attendance report
const attendanceReportInputSchema = z.object({
  viewMode: z.enum(['weekly', 'monthly']),
  referenceDate: z.date(),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

// Export input schema
const exportAttendanceInputSchema = z.object({
  viewMode: z.enum(['weekly', 'monthly']),
  referenceDate: z.date(),
  format: z.enum(['pdf', 'xlsx']),
  scope: z.enum(['team', 'all']),
  departmentId: z.string().uuid().optional(),
});

/**
 * Get tenant's country code
 */
async function getTenantCountryCode(tenantId: string): Promise<string> {
  const [tenant] = await db
    .select({ countryCode: tenants.countryCode })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant?.countryCode || 'CI';
}

/**
 * Get manager's employee ID from user record
 */
async function getManagerEmployeeId(
  tenantId: string,
  userId: string
): Promise<string | null> {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, tenantId),
        eq(employees.userId, userId)
      )
    )
    .limit(1);

  return employee?.id || null;
}

export const attendanceReportRouter = createTRPCRouter({
  /**
   * Get attendance report for manager's direct reports
   * Requires: Manager role
   */
  getTeamReport: managerProcedure
    .input(attendanceReportInputSchema)
    .query(async ({ ctx, input }): Promise<AttendanceReportOutput> => {
      const tenantId = ctx.user.tenantId;
      const countryCode = await getTenantCountryCode(tenantId);

      // Get manager's employee ID
      const managerEmployeeId = await getManagerEmployeeId(tenantId, ctx.user.id);

      if (!managerEmployeeId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil employé non trouvé pour ce manager',
        });
      }

      // Get direct report IDs
      const directReportIds = await getDirectReportIds(tenantId, managerEmployeeId);

      if (directReportIds.length === 0) {
        // Return empty report if no direct reports
        const { start, end, dates } = calculatePeriodDates(
          input.viewMode,
          input.referenceDate
        );

        return {
          period: {
            start,
            end,
            viewMode: input.viewMode,
            label: generatePeriodLabel(input.viewMode, start, end),
            dates,
          },
          summary: {
            totalEmployees: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalOnLeave: 0,
            totalWorkingDays: 0,
            averageHoursWorked: 0,
            averageAttendanceRate: 0,
            totalOvertimeHours: 0,
            totalNightHours: 0,
          },
          employees: [],
          pagination: {
            page: input.page,
            limit: input.limit,
            total: 0,
            hasMore: false,
          },
        };
      }

      // Calculate date range
      const { start, end } = calculatePeriodDates(
        input.viewMode,
        input.referenceDate
      );

      // Get attendance report for direct reports only
      return await getAttendanceReport({
        tenantId,
        startDate: start,
        endDate: end,
        countryCode,
        employeeIds: directReportIds,
        departmentId: input.departmentId,
        page: input.page,
        limit: input.limit,
      });
    }),

  /**
   * Get attendance report for all employees
   * Requires: HR Manager role
   */
  getAllReport: hrManagerProcedure
    .input(attendanceReportInputSchema)
    .query(async ({ ctx, input }): Promise<AttendanceReportOutput> => {
      const tenantId = ctx.user.tenantId;
      const countryCode = await getTenantCountryCode(tenantId);

      // Calculate date range
      const { start, end } = calculatePeriodDates(
        input.viewMode,
        input.referenceDate
      );

      // Filter by specific employee if provided
      const employeeIds = input.employeeId ? [input.employeeId] : undefined;

      // Get attendance report for all employees
      return await getAttendanceReport({
        tenantId,
        startDate: start,
        endDate: end,
        countryCode,
        employeeIds,
        departmentId: input.departmentId,
        page: input.page,
        limit: input.limit,
      });
    }),

  /**
   * Export attendance report to PDF or Excel
   * Requires: Manager role (team) or HR Manager role (all)
   */
  exportReport: managerProcedure
    .input(exportAttendanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const countryCode = await getTenantCountryCode(tenantId);

      // Calculate date range
      const { start, end } = calculatePeriodDates(
        input.viewMode,
        input.referenceDate
      );

      // Determine employee scope
      let employeeIds: string[] | undefined;

      if (input.scope === 'team') {
        // Get manager's direct reports
        const managerEmployeeId = await getManagerEmployeeId(tenantId, ctx.user.id);
        if (managerEmployeeId) {
          employeeIds = await getDirectReportIds(tenantId, managerEmployeeId);
        } else {
          employeeIds = [];
        }
      }
      // For 'all' scope, leave employeeIds undefined to get all employees

      // Get attendance data
      const report = await getAttendanceReport({
        tenantId,
        startDate: start,
        endDate: end,
        countryCode,
        employeeIds,
        departmentId: input.departmentId,
        page: 1,
        limit: 500, // Get all for export
      });

      // Generate export based on format
      if (input.format === 'pdf') {
        // Import PDF service dynamically to avoid bundling issues
        const { generateAttendancePDF } = await import(
          '@/features/attendance/services/attendance-pdf.service'
        );
        return await generateAttendancePDF(report);
      } else {
        // Import Excel service dynamically
        const { generateAttendanceExcel } = await import(
          '@/features/attendance/services/attendance-excel.service'
        );
        return await generateAttendanceExcel(report);
      }
    }),

  /**
   * Get available departments for filtering
   * Requires: Manager role
   */
  getDepartments: managerProcedure.query(async ({ ctx }) => {
    const { departments } = await import('@/drizzle/schema');

    const results = await db
      .select({
        id: departments.id,
        name: departments.name,
      })
      .from(departments)
      .where(eq(departments.tenantId, ctx.user.tenantId))
      .orderBy(departments.name);

    return results;
  }),

  /**
   * Get period options for dropdown
   * Returns last 12 weeks or 12 months based on view mode
   */
  getPeriodOptions: managerProcedure
    .input(z.object({ viewMode: z.enum(['weekly', 'monthly']) }))
    .query(({ input }) => {
      const options: Array<{ value: string; label: string }> = [];
      const now = new Date();

      for (let i = 0; i < 12; i++) {
        let refDate: Date;
        let start: Date;
        let end: Date;

        if (input.viewMode === 'weekly') {
          // Go back i weeks
          refDate = new Date(now);
          refDate.setDate(refDate.getDate() - i * 7);
          start = startOfWeek(refDate, { weekStartsOn: 1 });
          end = endOfWeek(refDate, { weekStartsOn: 1 });
        } else {
          // Go back i months
          refDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          start = startOfMonth(refDate);
          end = endOfMonth(refDate);
        }

        const label = generatePeriodLabel(input.viewMode, start, end);
        const value = start.toISOString();

        options.push({ value, label });
      }

      return options;
    }),
});
