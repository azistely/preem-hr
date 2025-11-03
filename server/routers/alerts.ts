/**
 * Alerts tRPC Router
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Handles proactive alerts for HR managers:
 * - Contract expiry notifications
 * - Leave notifications
 * - Document expiry warnings
 * - Payroll reminders
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import { alerts } from '@/lib/db/schema';
import { and, eq, desc, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const alertsRouter = createTRPCRouter({
  /**
   * List alerts for the current user
   * Filtered by status, severity, and pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'dismissed', 'completed']).optional(),
        severity: z.enum(['info', 'warning', 'urgent']).optional(),
        type: z
          .enum(['contract_expiry', 'leave_request_pending', 'leave_upcoming', 'document_expiry', 'payroll_reminder'])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { status, severity, type, limit, offset } = input;
      const userId = ctx.user.id;

      // Build where conditions
      const conditions = [eq(alerts.assigneeId, userId)];

      if (status) {
        conditions.push(eq(alerts.status, status));
      }

      if (severity) {
        conditions.push(eq(alerts.severity, severity));
      }

      if (type) {
        conditions.push(eq(alerts.type, type));
      }

      // Fetch alerts
      const alertsList = await ctx.db.query.alerts.findMany({
        where: and(...conditions),
        orderBy: [desc(alerts.dueDate), desc(alerts.createdAt)],
        limit,
        offset,
        with: {
          employee: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(and(...conditions));

      return {
        alerts: alertsList,
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get urgent alert count for badge display
   */
  getUrgentCount: protectedProcedure.query(async ({ ctx }) => {
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(
        and(
          eq(alerts.assigneeId, ctx.user.id),
          eq(alerts.status, 'active'),
          eq(alerts.severity, 'urgent')
        )
      );

    return count;
  }),

  /**
   * Get a single alert by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const alert = await ctx.db.query.alerts.findFirst({
        where: and(eq(alerts.id, input.id), eq(alerts.assigneeId, ctx.user.id)),
        with: {
          employee: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerte non trouvée',
        });
      }

      return alert;
    }),

  /**
   * Dismiss an alert (user postpones action)
   */
  dismiss: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify alert belongs to user
      const alert = await ctx.db.query.alerts.findFirst({
        where: and(eq(alerts.id, input.id), eq(alerts.assigneeId, ctx.user.id)),
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerte non trouvée',
        });
      }

      // Update alert status
      const [updatedAlert] = await ctx.db
        .update(alerts)
        .set({
          status: 'dismissed',
          dismissedAt: new Date(),
          dismissedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(alerts.id, input.id))
        .returning();

      return updatedAlert;
    }),

  /**
   * Complete an alert (action taken)
   */
  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify alert belongs to user
      const alert = await ctx.db.query.alerts.findFirst({
        where: and(eq(alerts.id, input.id), eq(alerts.assigneeId, ctx.user.id)),
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerte non trouvée',
        });
      }

      // Update alert status
      const [updatedAlert] = await ctx.db
        .update(alerts)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(alerts.id, input.id))
        .returning();

      return updatedAlert;
    }),

  /**
   * Bulk dismiss multiple alerts
   */
  bulkDismiss: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      // Verify all alerts belong to user
      const userAlerts = await ctx.db.query.alerts.findMany({
        where: and(inArray(alerts.id, input.ids), eq(alerts.assigneeId, ctx.user.id)),
      });

      if (userAlerts.length !== input.ids.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Certaines alertes ne vous appartiennent pas',
        });
      }

      // Bulk update
      await ctx.db
        .update(alerts)
        .set({
          status: 'dismissed',
          dismissedAt: new Date(),
          dismissedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(inArray(alerts.id, input.ids));

      return { success: true, count: input.ids.length };
    }),

  /**
   * Mark all active alerts as read (completed)
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Find all active alerts for user
    const activeAlerts = await ctx.db.query.alerts.findMany({
      where: and(eq(alerts.assigneeId, userId), eq(alerts.status, 'active')),
      columns: { id: true },
    });

    if (activeAlerts.length === 0) {
      return { success: true, count: 0 };
    }

    // Mark all as completed
    await ctx.db
      .update(alerts)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(alerts.assigneeId, userId), eq(alerts.status, 'active'))
      );

    return { success: true, count: activeAlerts.length };
  }),

  /**
   * Delete an alert (admin only)
   */
  delete: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const alert = await ctx.db.query.alerts.findFirst({
        where: eq(alerts.id, input.id),
      });

      if (!alert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerte non trouvée',
        });
      }

      await ctx.db.delete(alerts).where(eq(alerts.id, input.id));

      return { success: true };
    }),

  /**
   * Get alerts summary for dashboard widget
   */
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get counts by severity
    const summaryData = await ctx.db
      .select({
        severity: alerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .where(and(eq(alerts.assigneeId, userId), eq(alerts.status, 'active')))
      .groupBy(alerts.severity);

    // Get top 5 urgent alerts
    const urgentAlerts = await ctx.db.query.alerts.findMany({
      where: and(
        eq(alerts.assigneeId, userId),
        eq(alerts.status, 'active'),
        eq(alerts.severity, 'urgent')
      ),
      orderBy: [desc(alerts.dueDate)],
      limit: 5,
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Transform summary data
    const summary = {
      info: summaryData.find((s) => s.severity === 'info')?.count || 0,
      warning: summaryData.find((s) => s.severity === 'warning')?.count || 0,
      urgent: summaryData.find((s) => s.severity === 'urgent')?.count || 0,
      total:
        summaryData.reduce((acc, s) => acc + s.count, 0) || 0,
    };

    return {
      summary,
      urgentAlerts,
    };
  }),
});
