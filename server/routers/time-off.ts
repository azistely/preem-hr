/**
 * Time-Off tRPC Router
 *
 * Provides endpoints for:
 * - Time-off requests
 * - Approvals/rejections
 * - Balance management
 * - Policy configuration
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, managerProcedure } from '../api/trpc';
import * as timeOffService from '@/features/time-off/services/time-off.service';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { timeOffPolicies, timeOffRequests, timeOffBalances } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

export const timeOffRouter = createTRPCRouter({
  /**
   * Request time off
   */
  request: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        policyId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const request = await timeOffService.requestTimeOff({
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          policyId: input.policyId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
        });

        // Emit event for workflow automation
        // await eventBus.publish('timeoff.requested', {
        //   requestId: request.id,
        //   employeeId: request.employeeId,
        // });

        return request;
      } catch (error) {
        if (error instanceof timeOffService.TimeOffError) {
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
   * Approve time-off request
   */
  approve: publicProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const approved = await timeOffService.approveTimeOff({
          requestId: input.requestId,
          reviewedBy: ctx.user.id,
          notes: input.notes,
        });

        // Emit event
        // await eventBus.publish('timeoff.approved', {
        //   requestId: approved.id,
        //   employeeId: approved.employeeId,
        // });

        return approved;
      } catch (error) {
        if (error instanceof timeOffService.TimeOffError) {
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
   * Reject time-off request
   */
  reject: publicProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        reviewNotes: z.string().min(1, 'Raison du refus requise'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const rejected = await timeOffService.rejectTimeOff({
          requestId: input.requestId,
          reviewedBy: ctx.user.id,
          reviewNotes: input.reviewNotes,
        });

        // Emit event
        // await eventBus.publish('timeoff.rejected', {
        //   requestId: rejected.id,
        //   employeeId: rejected.employeeId,
        // });

        return rejected;
      } catch (error) {
        if (error instanceof timeOffService.TimeOffError) {
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
   * Get balance for employee
   */
  getBalance: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        policyId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      return await timeOffService.getBalance(input.employeeId, input.policyId);
    }),

  /**
   * Get all balances for employee
   */
  getAllBalances: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await db.query.timeOffBalances.findMany({
        where: and(
          eq(timeOffBalances.employeeId, input.employeeId),
          eq(timeOffBalances.tenantId, ctx.user.tenantId)
        ),
        with: {
          policy: true,
        },
      });
    }),

  /**
   * Get pending requests for approval (manager view)
   */
  getPendingRequests: publicProcedure.query(async ({ ctx }) => {
    return await db.query.timeOffRequests.findMany({
      where: and(
        eq(timeOffRequests.tenantId, ctx.user.tenantId),
        eq(timeOffRequests.status, 'pending')
      ),
      with: {
        employee: true,
        policy: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
    });
  }),

  /**
   * Get pending requests for manager's team (P1-9: Manager Time-Off Approval)
   * Filters by reporting_manager_id to show only team members' requests
   * Requires: Manager role
   */
  getPendingRequestsForTeam: managerProcedure
    .query(async ({ ctx }) => {
      const { employees } = await import('@/drizzle/schema');
      const { eq } = await import('drizzle-orm');

      if (!ctx.user.employeeId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Aucun profil employé associé',
        });
      }

      // Get all team members reporting to this manager
      const teamMembers = await db.query.employees.findMany({
        where: (employees, { and, eq }) =>
          and(
            eq(employees.reportingManagerId, ctx.user.employeeId),
            eq(employees.tenantId, ctx.user.tenantId)
          ),
        columns: { id: true },
      });

      const teamMemberIds = teamMembers.map((e) => e.id);

      if (teamMemberIds.length === 0) {
        return [];
      }

      // Fetch pending requests from team members
      const { inArray } = await import('drizzle-orm');
      return await db.query.timeOffRequests.findMany({
        where: (requests, { and, eq, inArray }) =>
          and(
            eq(requests.tenantId, ctx.user.tenantId),
            eq(requests.status, 'pending'),
            inArray(requests.employeeId, teamMemberIds)
          ),
        with: {
          employee: true,
          policy: true,
        },
        orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
      });
    }),

  /**
   * Get employee requests
   */
  getEmployeeRequests: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await db.query.timeOffRequests.findMany({
        where: and(
          eq(timeOffRequests.employeeId, input.employeeId),
          eq(timeOffRequests.tenantId, ctx.user.tenantId)
        ),
        with: {
          policy: true,
        },
        orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
      });
    }),

  /**
   * Get time-off policies
   */
  getPolicies: publicProcedure.query(async ({ ctx }) => {
    return await db.query.timeOffPolicies.findMany({
      where: eq(timeOffPolicies.tenantId, ctx.user.tenantId),
    });
  }),

  /**
   * Create time-off policy
   */
  createPolicy: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        policyType: z.enum(['annual_leave', 'sick_leave', 'maternity', 'paternity', 'unpaid']),
        accrualMethod: z.enum(['fixed', 'accrued_monthly', 'accrued_hourly']),
        accrualRate: z.number().positive(),
        maxBalance: z.number().positive().optional(),
        requiresApproval: z.boolean().default(true),
        advanceNoticeDays: z.number().int().min(0).default(0),
        minDaysPerRequest: z.number().positive().default(0.5),
        maxDaysPerRequest: z.number().positive().optional(),
        blackoutPeriods: z.array(
          z.object({
            start: z.string(),
            end: z.string(),
            reason: z.string(),
          })
        ).optional(),
        isPaid: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [policy] = await db
        .insert(timeOffPolicies)
        .values({
          tenantId: ctx.user.tenantId,
          name: input.name,
          policyType: input.policyType,
          accrualMethod: input.accrualMethod,
          accrualRate: input.accrualRate.toString(),
          maxBalance: input.maxBalance?.toString(),
          requiresApproval: input.requiresApproval,
          advanceNoticeDays: input.advanceNoticeDays,
          minDaysPerRequest: input.minDaysPerRequest.toString(),
          maxDaysPerRequest: input.maxDaysPerRequest?.toString(),
          blackoutPeriods: input.blackoutPeriods as any,
          isPaid: input.isPaid,
          createdBy: ctx.user.id,
        })
        .returning();

      return policy;
    }),

  /**
   * Manually accrue leave balance (admin only)
   */
  accrueBalance: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        policyId: z.string().uuid(),
        accrualDate: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const accrualDate = input.accrualDate || new Date();
      return await timeOffService.accrueLeaveBalance(
        input.employeeId,
        input.policyId,
        accrualDate
      );
    }),

  /**
   * Get pending requests with employee balances
   */
  getPendingRequestsWithBalances: publicProcedure.query(async ({ ctx }) => {
    const requests = await db.query.timeOffRequests.findMany({
      where: and(
        eq(timeOffRequests.tenantId, ctx.user.tenantId),
        eq(timeOffRequests.status, 'pending')
      ),
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        policy: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
    });

    // Fetch balances for each request
    const requestsWithBalances = await Promise.all(
      requests.map(async (request) => {
        const balance = await db.query.timeOffBalances.findFirst({
          where: and(
            eq(timeOffBalances.employeeId, request.employeeId),
            eq(timeOffBalances.policyId, request.policyId)
          ),
        });

        return {
          ...request,
          balance: balance || null,
        };
      })
    );

    return requestsWithBalances;
  }),

  /**
   * Detect conflicting time-off requests
   */
  detectConflicts: publicProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const request = await db.query.timeOffRequests.findFirst({
        where: eq(timeOffRequests.id, input.requestId),
      });

      if (!request) {
        return [];
      }

      // Find overlapping approved requests from other employees
      const conflicts = await db.query.timeOffRequests.findMany({
        where: and(
          eq(timeOffRequests.tenantId, ctx.user.tenantId),
          eq(timeOffRequests.status, 'approved'),
          sql`${timeOffRequests.startDate} <= ${request.endDate}`,
          sql`${timeOffRequests.endDate} >= ${request.startDate}`
        ),
        with: {
          employee: {
            columns: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return conflicts;
    }),

  /**
   * Bulk approve requests
   */
  bulkApprove: publicProcedure
    .input(
      z.object({
        requestIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await Promise.all(
        input.requestIds.map((requestId) =>
          timeOffService.approveTimeOff({
            requestId,
            reviewedBy: ctx.user.id,
          })
        )
      );
    }),

  /**
   * Get all balances summary (admin view)
   */
  getAllBalancesSummary: publicProcedure.query(async ({ ctx }) => {
    const balances = await db.query.timeOffBalances.findMany({
      where: eq(timeOffBalances.tenantId, ctx.user.tenantId),
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        policy: {
          columns: {
            id: true,
            name: true,
            policyType: true,
          },
        },
      },
    });

    return balances;
  }),

  /**
   * Get pending requests summary
   */
  getPendingSummary: publicProcedure.query(async ({ ctx }) => {
    const { sql } = await import('drizzle-orm');

    const result = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(timeOffRequests)
      .where(and(eq(timeOffRequests.tenantId, ctx.user.tenantId), eq(timeOffRequests.status, 'pending')));

    return {
      pendingCount: Number(result[0]?.count || 0),
    };
  }),
});
