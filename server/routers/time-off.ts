/**
 * Time-Off tRPC Router
 *
 * Provides endpoints for:
 * - Time-off requests
 * - Approvals/rejections
 * - Balance management
 * - Policy configuration
 *
 * TODO: Fix Drizzle relations typing - relations exist in schema but TypeScript doesn't recognize them
 */

// @ts-nocheck - Temporary: Drizzle relations not properly typed yet
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, managerProcedure } from '../api/trpc';
import * as timeOffService from '@/features/time-off/services/time-off.service';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { timeOffPolicies, timeOffRequests, timeOffBalances, employees } from '@/drizzle/schema';
import { eq, and, sql, like, or, gte, lte, inArray, ne, desc } from 'drizzle-orm';
import type {
  TimeOffBalanceWithPolicy,
  TimeOffRequestWithPolicy,
  TimeOffRequestWithRelations,
  TimeOffRequestWithBalanceAndRelations,
} from '@/lib/types/extended-models';

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
        handoverNotes: z.string().optional(),
        isDeductibleForACP: z.boolean().default(true),
        justificationDocumentUrl: z.string().optional(),
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
          handoverNotes: input.handoverNotes,
          isDeductibleForAcp: input.isDeductibleForACP,
        });

        // Update justification document if provided
        if (input.justificationDocumentUrl && request.id) {
          await db
            .update(timeOffRequests)
            .set({
              justificationDocumentUrl: input.justificationDocumentUrl,
              justificationDocumentUploadedAt: new Date(),
            })
            .where(eq(timeOffRequests.id, request.id));
        }

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
   * Update justification document for leave request
   * Allows uploading/updating justification document after leave is created or approved
   */
  updateJustificationDocument: protectedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        justificationDocumentUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Verify the request belongs to the user's tenant
      const [existingRequest] = await db
        .select()
        .from(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.id, input.requestId),
            eq(timeOffRequests.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!existingRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Demande de congé non trouvée',
        });
      }

      // Update the justification document
      const [updated] = await db
        .update(timeOffRequests)
        .set({
          justificationDocumentUrl: input.justificationDocumentUrl,
          justificationDocumentUploadedAt: new Date(),
        })
        .where(
          and(
            eq(timeOffRequests.id, input.requestId),
            eq(timeOffRequests.tenantId, user.tenantId)
          )
        )
        .returning();

      return updated;
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
    .query(async ({ input, ctx }): Promise<TimeOffBalanceWithPolicy[]> => {
      // Fetch balances without using db.query API (since relations aren't defined)
      const balances = await db
        .select()
        .from(timeOffBalances)
        .where(
          and(
            eq(timeOffBalances.employeeId, input.employeeId),
            eq(timeOffBalances.tenantId, ctx.user.tenantId)
          )
        );

      // Fetch associated policies
      const policyIds = balances.map((b) => b.policyId);
      if (policyIds.length === 0) {
        return [];
      }

      const policies = await db
        .select()
        .from(timeOffPolicies)
        .where(inArray(timeOffPolicies.id, policyIds));

      // Create a map for quick lookup
      const policyMap = new Map(policies.map((p) => [p.id, p]));

      // Combine balances with policies
      return balances.map((balance) => ({
        ...balance,
        timeOffPolicy: policyMap.get(balance.policyId) || null,
      })) as TimeOffBalanceWithPolicy[];
    }),

  /**
   * Get pending requests for approval (manager view)
   */
  getPendingRequests: publicProcedure.query(async ({ ctx }): Promise<TimeOffRequestWithRelations[]> => {
    return await db.query.timeOffRequests.findMany({
      where: and(
        eq(timeOffRequests.tenantId, ctx.user.tenantId),
        eq(timeOffRequests.status, 'pending')
      ),
      with: {
        // @ts-ignore - Drizzle relations not fully typed yet
        employee: true,
        // @ts-ignore - Drizzle relations not fully typed yet
        timeOffPolicy: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
    }) as TimeOffRequestWithRelations[];
  }),

  /**
   * Get pending requests for manager's team (P1-9: Manager Time-Off Approval)
   * Filters by reporting_manager_id to show only team members' requests
   * Requires: Manager role
   */
  getPendingRequestsForTeam: managerProcedure
    .query(async ({ ctx }) => {
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
      return await db.query.timeOffRequests.findMany({
        where: (requests, { and, eq, inArray }) =>
          and(
            eq(requests.tenantId, ctx.user.tenantId),
            eq(requests.status, 'pending'),
            inArray(requests.employeeId, teamMemberIds)
          ),
        with: {
          employee: true,
          timeOffPolicy: true,
        },
        orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
      }) as TimeOffRequestWithRelations[];
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
    .query(async ({ input, ctx }): Promise<TimeOffRequestWithPolicy[]> => {
      return await db.query.timeOffRequests.findMany({
        where: and(
          eq(timeOffRequests.employeeId, input.employeeId),
          eq(timeOffRequests.tenantId, ctx.user.tenantId)
        ),
        with: {
          timeOffPolicy: true,
        },
        orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
      }) as TimeOffRequestWithPolicy[];
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
  getPendingRequestsWithBalances: protectedProcedure.query(async ({ ctx }): Promise<TimeOffRequestWithBalanceAndRelations[]> => {
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
        timeOffPolicy: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.submittedAt)],
    }) as TimeOffRequestWithRelations[];

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
          timeOffPolicy: true,
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
        timeOffPolicy: {
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

  /**
   * Set deductibility for ACP calculation
   *
   * Mark leave as non-deductible for ACP (Allocations de Congés Payés) calculation.
   * Used for unpaid leave, permissions, and other absence types that should not
   * reduce the number of paid days in ACP reference period.
   *
   * Permissions: HR only
   */
  setDeductibleForACP: publicProcedure
    .input(
      z.object({
        timeOffRequestId: z.string().uuid('ID de demande invalide'),
        isDeductible: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user has HR role
      const userRoles = ctx.user?.roles || [];
      const isHR = userRoles.includes('hr') || userRoles.includes('hr_manager') || userRoles.includes('super_admin');

      if (!isHR) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Seuls les RH peuvent modifier la déductibilité ACP',
        });
      }

      try {
        // Update time_off_request
        const [updated] = await db
          .update(timeOffRequests)
          .set({
            isDeductibleForAcp: input.isDeductible,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(timeOffRequests.id, input.timeOffRequestId),
              eq(timeOffRequests.tenantId, ctx.user.tenantId)
            )
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Demande de congé introuvable',
          });
        }

        return updated;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour de la déductibilité ACP',
        });
      }
    }),

  /**
   * Get filtered time-off requests with advanced filtering
   * Supports: date range, employee search, department, status, policy type
   * Used by admin time-off page for bulk management
   */
  getFilteredRequests: protectedProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).default('all'),
        policyType: z.enum(['all', 'annual_leave', 'sick_leave', 'maternity', 'paternity', 'unpaid']).default('all'),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        employeeSearch: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<TimeOffRequestWithBalanceAndRelations[]> => {
      // Build where conditions
      const conditions: any[] = [eq(timeOffRequests.tenantId, ctx.user.tenantId)];

      // Status filter
      if (input.status !== 'all') {
        conditions.push(eq(timeOffRequests.status, input.status));
      }

      // Date range filter
      if (input.startDate) {
        conditions.push(gte(timeOffRequests.endDate, input.startDate.toISOString().split('T')[0]));
      }
      if (input.endDate) {
        conditions.push(lte(timeOffRequests.startDate, input.endDate.toISOString().split('T')[0]));
      }

      // Get all requests without relations (since relations aren't defined)
      const baseRequests = await db
        .select()
        .from(timeOffRequests)
        .where(and(...conditions))
        .orderBy(desc(timeOffRequests.submittedAt));

      // Fetch related data separately
      const requestsWithRelations = await Promise.all(
        baseRequests.map(async (request) => {
          // Fetch employee
          const [employee] = await db
            .select({
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              email: employees.email,
            })
            .from(employees)
            .where(eq(employees.id, request.employeeId))
            .limit(1);

          // Fetch policy
          const [policy] = await db
            .select({
              id: timeOffPolicies.id,
              name: timeOffPolicies.name,
              policyType: timeOffPolicies.policyType,
              tenantId: timeOffPolicies.tenantId,
            })
            .from(timeOffPolicies)
            .where(eq(timeOffPolicies.id, request.policyId))
            .limit(1);

          return {
            ...request,
            employee,
            policy,
          };
        })
      );

      // Apply filters
      let filteredRequests = requestsWithRelations;

      // Employee search filter
      if (input.employeeSearch) {
        const searchLower = input.employeeSearch.toLowerCase();
        filteredRequests = filteredRequests.filter(req =>
          req.employee.firstName.toLowerCase().includes(searchLower) ||
          req.employee.lastName.toLowerCase().includes(searchLower)
        );
      }

      // Policy type filter
      if (input.policyType !== 'all') {
        filteredRequests = filteredRequests.filter(req =>
          req.policy.policyType === input.policyType
        );
      }

      // Get balances for each request
      const requestsWithBalances = await Promise.all(
        filteredRequests.map(async (request) => {
          const [balance] = await db
            .select()
            .from(timeOffBalances)
            .where(and(
              eq(timeOffBalances.employeeId, request.employeeId),
              eq(timeOffBalances.policyId, request.policyId)
            ))
            .limit(1);

          return {
            ...request,
            balance: balance || null,
          };
        })
      );

      return requestsWithBalances as TimeOffRequestWithBalanceAndRelations[];
    }),

  /**
   * Detect conflicts for a date range
   * Returns employees who have overlapping approved leave
   */
  detectConflictsByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        excludeRequestId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions: any[] = [
        eq(timeOffRequests.tenantId, ctx.user.tenantId),
        eq(timeOffRequests.status, 'approved'),
        // Overlapping logic: request.startDate <= input.endDate AND request.endDate >= input.startDate
        lte(timeOffRequests.startDate, input.endDate.toISOString().split('T')[0]),
        gte(timeOffRequests.endDate, input.startDate.toISOString().split('T')[0]),
      ];

      // Exclude specific request (when editing)
      if (input.excludeRequestId) {
        conditions.push(ne(timeOffRequests.id, input.excludeRequestId));
      }

      // Fetch conflicts using manual joins
      const conflictsRaw = await db
        .select({
          id: timeOffRequests.id,
          employeeId: timeOffRequests.employeeId,
          policyId: timeOffRequests.policyId,
          startDate: timeOffRequests.startDate,
          endDate: timeOffRequests.endDate,
          status: timeOffRequests.status,
          totalDays: timeOffRequests.totalDays,
          // Employee fields (aliased)
          employeeIdField: employees.id,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          // Policy fields (aliased)
          policyIdField: timeOffPolicies.id,
          policyName: timeOffPolicies.name,
        })
        .from(timeOffRequests)
        .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
        .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
        .where(and(...conditions));

      // Transform flat results to nested structure
      const conflicts = conflictsRaw.map(row => ({
        id: row.id,
        employeeId: row.employeeId,
        policyId: row.policyId,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        totalDays: row.totalDays,
        employee: {
          id: row.employeeIdField,
          firstName: row.employeeFirstName,
          lastName: row.employeeLastName,
        },
        policy: {
          id: row.policyIdField,
          name: row.policyName,
        },
      }));

      return conflicts;
    }),

  /**
   * Detect conflicts for multiple requests at once
   * Returns a map of requestId -> conflicts[]
   * This allows checking conflicts for all pending requests in a single query
   */
  detectConflictsForRequests: protectedProcedure
    .input(
      z.object({
        requests: z.array(
          z.object({
            id: z.string().uuid(),
            startDate: z.string(), // ISO date string
            endDate: z.string(),   // ISO date string
          })
        ),
      })
    )
    .query(async ({ input, ctx }) => {
      // If no requests, return empty map
      if (input.requests.length === 0) {
        return {};
      }

      // Build OR conditions for all date ranges
      // For each request, we want to find approved leaves that overlap
      const dateRangeConditions = input.requests.map(req =>
        and(
          // Overlapping logic: approved.startDate <= req.endDate AND approved.endDate >= req.startDate
          lte(timeOffRequests.startDate, req.endDate),
          gte(timeOffRequests.endDate, req.startDate),
          // Exclude the request itself
          ne(timeOffRequests.id, req.id)
        )
      );

      // Fetch all potentially conflicting approved leaves
      const conflictsRaw = await db
        .select({
          id: timeOffRequests.id,
          employeeId: timeOffRequests.employeeId,
          policyId: timeOffRequests.policyId,
          startDate: timeOffRequests.startDate,
          endDate: timeOffRequests.endDate,
          status: timeOffRequests.status,
          totalDays: timeOffRequests.totalDays,
          // Employee fields
          employeeIdField: employees.id,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          // Policy fields
          policyIdField: timeOffPolicies.id,
          policyName: timeOffPolicies.name,
        })
        .from(timeOffRequests)
        .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
        .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
        .where(
          and(
            eq(timeOffRequests.tenantId, ctx.user.tenantId),
            eq(timeOffRequests.status, 'approved'),
            or(...dateRangeConditions)
          )
        );

      // Transform to structured format
      const allConflicts = conflictsRaw.map(row => ({
        id: row.id,
        employeeId: row.employeeId,
        policyId: row.policyId,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        totalDays: row.totalDays,
        employee: {
          id: row.employeeIdField,
          firstName: row.employeeFirstName,
          lastName: row.employeeLastName,
        },
        policy: {
          id: row.policyIdField,
          name: row.policyName,
        },
      }));

      // Map conflicts to each request
      const conflictsByRequestId: Record<string, typeof allConflicts> = {};

      for (const req of input.requests) {
        // Filter conflicts that actually overlap with this specific request
        conflictsByRequestId[req.id] = allConflicts.filter(conflict => {
          // Check if conflict overlaps with request dates
          return (
            conflict.startDate <= req.endDate &&
            conflict.endDate >= req.startDate &&
            conflict.id !== req.id
          );
        });
      }

      return conflictsByRequestId;
    }),

  /**
   * Get absence summary by employee, type, and reason
   * Used for HR reporting and tracking
   */
  getAbsenceSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        employeeId: z.string().uuid().optional(), // Filter by specific employee
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Build where conditions
      const whereConditions = [
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'), // Only count approved absences
      ];

      // Add date range filters
      if (input.startDate) {
        whereConditions.push(gte(timeOffRequests.startDate, input.startDate.toISOString().split('T')[0]));
      }
      if (input.endDate) {
        whereConditions.push(lte(timeOffRequests.endDate, input.endDate.toISOString().split('T')[0]));
      }

      // Add employee filter
      if (input.employeeId) {
        whereConditions.push(eq(timeOffRequests.employeeId, input.employeeId));
      }

      // Get all approved time-off requests with employee and policy info
      const requests = await db
        .select({
          id: timeOffRequests.id,
          employeeId: timeOffRequests.employeeId,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          policyId: timeOffRequests.policyId,
          policyName: timeOffPolicies.name,
          policyType: timeOffPolicies.policyType,
          totalDays: timeOffRequests.totalDays,
          reason: timeOffRequests.reason,
          startDate: timeOffRequests.startDate,
          endDate: timeOffRequests.endDate,
        })
        .from(timeOffRequests)
        .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
        .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
        .where(and(...whereConditions))
        .orderBy(employees.lastName, employees.firstName);

      // Group by employee
      const employeeSummaries = new Map<string, {
        employeeId: string;
        employeeFirstName: string;
        employeeLastName: string;
        employeeNumber: string;
        totalDays: number;
        byPolicyType: Map<string, {
          policyType: string;
          policyName: string;
          totalDays: number;
          byReason: Map<string, {
            reason: string;
            totalDays: number;
            count: number;
          }>;
        }>;
      }>();

      for (const req of requests) {
        const empKey = req.employeeId;

        if (!employeeSummaries.has(empKey)) {
          employeeSummaries.set(empKey, {
            employeeId: req.employeeId,
            employeeFirstName: req.employeeFirstName,
            employeeLastName: req.employeeLastName,
            employeeNumber: req.employeeNumber,
            totalDays: 0,
            byPolicyType: new Map(),
          });
        }

        const empSummary = employeeSummaries.get(empKey)!;
        const days = Number(req.totalDays);
        empSummary.totalDays += days;

        // Group by policy type
        if (!empSummary.byPolicyType.has(req.policyType)) {
          empSummary.byPolicyType.set(req.policyType, {
            policyType: req.policyType,
            policyName: req.policyName,
            totalDays: 0,
            byReason: new Map(),
          });
        }

        const policyTypeSummary = empSummary.byPolicyType.get(req.policyType)!;
        policyTypeSummary.totalDays += days;

        // Group by reason within policy type
        const reasonKey = req.reason || 'Non spécifié';
        if (!policyTypeSummary.byReason.has(reasonKey)) {
          policyTypeSummary.byReason.set(reasonKey, {
            reason: reasonKey,
            totalDays: 0,
            count: 0,
          });
        }

        const reasonSummary = policyTypeSummary.byReason.get(reasonKey)!;
        reasonSummary.totalDays += days;
        reasonSummary.count += 1;
      }

      // Convert Maps to arrays for JSON serialization
      const result = Array.from(employeeSummaries.values()).map((emp) => ({
        employeeId: emp.employeeId,
        employeeFirstName: emp.employeeFirstName,
        employeeLastName: emp.employeeLastName,
        employeeNumber: emp.employeeNumber,
        totalDays: emp.totalDays,
        byPolicyType: Array.from(emp.byPolicyType.values()).map((policy) => ({
          policyType: policy.policyType,
          policyName: policy.policyName,
          totalDays: policy.totalDays,
          byReason: Array.from(policy.byReason.values()),
        })),
      }));

      return result;
    }),
});
