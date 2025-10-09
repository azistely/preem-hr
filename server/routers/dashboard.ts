/**
 * Dashboard Router (tRPC v11)
 *
 * Provides dashboard data for all user roles:
 * - Employee Dashboard
 * - Manager Dashboard
 * - HR Manager Dashboard
 * - Tenant Admin Dashboard
 */

import { z } from 'zod';
import {
  employeeProcedure,
  managerProcedure,
  hrManagerProcedure,
  adminProcedure,
  router,
} from '@/server/api/trpc';
import { db } from '@/lib/db';
import {
  employees,
  payrollRuns,
  payrollLineItems,
  timeOffRequests,
  timeEntries,
  tenants,
} from '@/drizzle/schema';
import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm';

export const dashboardRouter = router({
  /**
   * Employee Dashboard
   */
  getEmployeeDashboard: employeeProcedure.query(async ({ ctx }) => {
    const employeeId = ctx.user.employeeId;

    // If user doesn't have an employee record (e.g., tenant_admin without employee profile)
    // Return placeholder data instead of throwing error
    if (!employeeId) {
      return {
        employee: {
          firstName: ctx.user.email?.split('@')[0] || 'Utilisateur',
          lastName: '',
          position: 'Administrateur',
        },
        salary: {
          netSalary: 0,
          month: new Date(),
        },
        leaveBalance: {
          used: 0,
          total: 0,
          remaining: 0,
        },
        recentPayslips: [],
        recentTimeEntries: [],
      };
    }

    // Get employee record
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
    });

    if (!employee) {
      // Employee ID exists in user table but not in employees table
      // Return placeholder data
      return {
        employee: {
          firstName: ctx.user.email?.split('@')[0] || 'Utilisateur',
          lastName: '',
          position: 'Non configuré',
        },
        salary: {
          netSalary: 0,
          month: new Date(),
        },
        leaveBalance: {
          used: 0,
          total: 0,
          remaining: 0,
        },
        recentPayslips: [],
        recentTimeEntries: [],
      };
    }

    // Get latest payslip
    const latestPayslip = await db.query.payrollLineItems.findFirst({
      where: eq(payrollLineItems.employeeId, employee.id),
      orderBy: [desc(payrollLineItems.createdAt)],
      with: {
        payrollRun: true,
      },
    });

    // Get leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await db
      .select({
        total: sql<number>`sum(${timeOffRequests.numberOfDays})`,
      })
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.employeeId, employee.id),
          eq(timeOffRequests.status, 'approved'),
          gte(timeOffRequests.startDate, new Date(`${currentYear}-01-01`)),
          lte(timeOffRequests.startDate, new Date(`${currentYear}-12-31`))
        )
      );

    // Get recent time entries (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTimeEntries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.employeeId, employee.id),
        gte(timeEntries.date, thirtyDaysAgo)
      ),
      orderBy: [desc(timeEntries.date)],
      limit: 10,
    });

    return {
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.position,
      },
      salary: {
        netSalary: latestPayslip?.netSalary || 0,
        month: latestPayslip?.payrollRun?.periodEnd || new Date(),
      },
      leaveBalance: {
        used: leaveBalance[0]?.total || 0,
        total: 30, // TODO: Get from policy
        remaining: 30 - (leaveBalance[0]?.total || 0),
      },
      recentPayslips: latestPayslip ? [latestPayslip] : [],
      recentTimeEntries,
    };
  }),

  /**
   * Manager Dashboard
   */
  getManagerDashboard: managerProcedure.query(async ({ ctx }) => {
    const employeeId = ctx.user.employeeId;

    // If user doesn't have an employee record, return empty data
    if (!employeeId) {
      return {
        team: {
          total: 0,
          present: 0,
          absent: 0,
        },
        pendingApprovals: {
          leave: 0,
          total: 0,
          items: [],
        },
        costs: {
          monthly: 0,
        },
        recentActivity: [],
      };
    }

    // Get manager's employee record
    const manager = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
    });

    if (!manager) {
      // Return empty data if employee record not found
      return {
        team: {
          total: 0,
          present: 0,
          absent: 0,
        },
        pendingApprovals: {
          leave: 0,
          total: 0,
          items: [],
        },
        costs: {
          monthly: 0,
        },
        recentActivity: [],
      };
    }

    // Get team members
    const teamMembers = await db.query.employees.findMany({
      where: eq(employees.managerId, manager.id),
    });

    const teamMemberIds = teamMembers.map((e) => e.id);

    // Get pending approvals (leave requests)
    const pendingLeaveRequests = await db.query.timeOffRequests.findMany({
      where: and(
        sql`${timeOffRequests.employeeId} = ANY(${teamMemberIds})`,
        eq(timeOffRequests.status, 'pending')
      ),
      with: {
        employee: true,
      },
      limit: 10,
    });

    // Get team attendance today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teamAttendance = await db.query.timeEntries.findMany({
      where: and(
        sql`${timeEntries.employeeId} = ANY(${teamMemberIds})`,
        eq(timeEntries.date, today)
      ),
    });

    // Calculate team costs (last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const teamCosts = await db
      .select({
        total: sql<number>`sum(${payrollLineItems.netSalary})`,
      })
      .from(payrollLineItems)
      .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
      .where(
        and(
          sql`${payrollLineItems.employeeId} = ANY(${teamMemberIds})`,
          gte(payrollRuns.periodEnd, lastMonth)
        )
      );

    return {
      team: {
        total: teamMembers.length,
        present: teamAttendance.length,
        absent: teamMembers.length - teamAttendance.length,
      },
      pendingApprovals: {
        leave: pendingLeaveRequests.length,
        total: pendingLeaveRequests.length,
        items: pendingLeaveRequests,
      },
      costs: {
        monthly: teamCosts[0]?.total || 0,
      },
      recentActivity: pendingLeaveRequests.slice(0, 5),
    };
  }),

  /**
   * HR Manager Dashboard
   */
  getHRDashboard: hrManagerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Get total employee count
    const employeeCount = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));

    // Get latest payroll run
    const latestPayrollRun = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.tenantId, tenantId),
      orderBy: [desc(payrollRuns.createdAt)],
    });

    // Get pending actions count
    const pendingLeaveRequests = await db
      .select({ count: count() })
      .from(timeOffRequests)
      .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(timeOffRequests.status, 'pending')
        )
      );

    // Calculate total payroll cost (last month)
    // Wrap in try-catch since there may be no payroll data yet
    let payrollCosts: { netSalary: number | null; grossSalary: number | null }[] = [];
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthISO = lastMonth.toISOString();

      payrollCosts = await db
        .select({
          netSalary: sql<number>`coalesce(sum(${payrollLineItems.netSalary}), 0)`,
          grossSalary: sql<number>`coalesce(sum(${payrollLineItems.grossSalary}), 0)`,
        })
        .from(payrollLineItems)
        .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
        .where(
          and(
            eq(payrollRuns.tenantId, tenantId),
            gte(payrollRuns.periodEnd, lastMonthISO)
          )
        );
    } catch (error) {
      // If query fails (e.g., no payroll data), use default values
      console.error('[Dashboard] Failed to fetch HR payroll costs:', error);
      payrollCosts = [{ netSalary: 0, grossSalary: 0 }];
    }

    // Get critical actions
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Check if payroll needs to be run
    const nextPayrollDate = new Date();
    nextPayrollDate.setDate(25); // Typical payroll date
    const needsPayroll = today >= nextPayrollDate && !latestPayrollRun;

    return {
      metrics: {
        employeeCount: employeeCount[0]?.count || 0,
        payrollCost: Number(payrollCosts[0]?.netSalary) || 0,
        grossPayroll: Number(payrollCosts[0]?.grossSalary) || 0,
      },
      criticalActions: {
        payrollDue: needsPayroll,
        pendingLeave: pendingLeaveRequests[0]?.count || 0,
        total: (needsPayroll ? 1 : 0) + (pendingLeaveRequests[0]?.count || 0),
      },
      latestPayrollRun,
    };
  }),

  /**
   * Tenant Admin Dashboard
   */
  getAdminDashboard: adminProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Get organization info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    // Get user count
    const userCount = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));

    // Get total costs (last month)
    // Wrap in try-catch since there may be no payroll data yet
    let costs: { netSalary: number | null; grossSalary: number | null; employerCosts: number | null }[] = [];
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthISO = lastMonth.toISOString();

      costs = await db
        .select({
          netSalary: sql<number>`coalesce(sum(${payrollLineItems.netSalary}), 0)`,
          grossSalary: sql<number>`coalesce(sum(${payrollLineItems.grossSalary}), 0)`,
          employerCosts: sql<number>`coalesce(sum(${payrollLineItems.totalEmployerCost}), 0)`,
        })
        .from(payrollLineItems)
        .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
        .where(
          and(
            eq(payrollRuns.tenantId, tenantId),
            gte(payrollRuns.periodEnd, lastMonthISO)
          )
        );
    } catch (error) {
      // If query fails (e.g., no payroll data), use default values
      console.error('[Dashboard] Failed to fetch payroll costs:', error);
      costs = [{ netSalary: 0, grossSalary: 0, employerCosts: 0 }];
    }

    return {
      organization: {
        name: tenant?.name || '',
        plan: 'Professional', // TODO: Get from subscription
        expiryDate: new Date('2026-01-15'), // TODO: Get from subscription
      },
      costs: {
        payroll: Number(costs[0]?.netSalary) || 0,
        charges: Number(costs[0]?.employerCosts) || 0,
        total: (Number(costs[0]?.netSalary) || 0) + (Number(costs[0]?.employerCosts) || 0),
      },
      users: {
        total: userCount[0]?.count || 0,
        admins: 3, // TODO: Count actual admins
        active: userCount[0]?.count || 0,
      },
      security: {
        twoFactorEnabled: true, // TODO: Get from settings
        inactiveAccounts: 0, // TODO: Calculate
      },
    };
  }),

  /**
   * Get recent payslips for employee
   */
  getMyRecentPayslips: employeeProcedure
    .input(
      z.object({
        limit: z.number().optional().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const employeeId = ctx.user.employeeId;

      if (!employeeId) {
        return []; // Return empty array if no employee ID
      }

      const employee = await db.query.employees.findFirst({
        where: eq(employees.id, employeeId),
      });

      if (!employee) {
        return []; // Return empty array if employee not found
      }

      return db.query.payrollLineItems.findMany({
        where: eq(payrollLineItems.employeeId, employee.id),
        orderBy: [desc(payrollLineItems.createdAt)],
        limit: input.limit,
        with: {
          payrollRun: true,
        },
      });
    }),

  /**
   * Get pending approvals for manager
   */
  getPendingApprovals: managerProcedure.query(async ({ ctx }) => {
    const employeeId = ctx.user.employeeId;

    if (!employeeId) {
      return []; // Return empty array if no employee ID
    }

    const manager = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
    });

    if (!manager) {
      return []; // Return empty array if manager not found
    }

    const teamMembers = await db.query.employees.findMany({
      where: eq(employees.managerId, manager.id),
    });

    const teamMemberIds = teamMembers.map((e) => e.id);

    const pendingRequests = await db.query.timeOffRequests.findMany({
      where: and(
        sql`${timeOffRequests.employeeId} = ANY(${teamMemberIds})`,
        eq(timeOffRequests.status, 'pending')
      ),
      with: {
        employee: true,
      },
      orderBy: [desc(timeOffRequests.createdAt)],
    });

    return pendingRequests;
  }),
});
