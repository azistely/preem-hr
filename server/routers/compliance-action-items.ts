/**
 * Compliance Action Items tRPC Router
 * Manages action items (plan d'actions) linked to trackers
 *
 * HR-only access (hrManagerProcedure)
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import {
  complianceActionItems,
  complianceTrackers,
  complianceTrackerTypes,
  complianceTrackerComments,
  employees,
  alerts,
  users,
} from '@/lib/db/schema';
import { and, eq, desc, sql, gte, lte, lt, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const complianceActionItemsRouter = createTRPCRouter({
  /**
   * List action items with filters and pagination
   */
  list: hrManagerProcedure
    .input(
      z.object({
        trackerId: z.string().uuid().optional(),
        trackerTypeSlug: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigneeId: z.string().uuid().optional(),
        overdueOnly: z.boolean().default(false),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { trackerId, trackerTypeSlug, status, priority, assigneeId, overdueOnly, dateFrom, dateTo, limit, offset } = input;

      // Build conditions
      const conditions = [eq(complianceActionItems.tenantId, tenantId)];

      if (trackerId) {
        conditions.push(eq(complianceActionItems.trackerId, trackerId));
      }

      if (status) {
        conditions.push(eq(complianceActionItems.status, status));
      }

      if (priority) {
        conditions.push(eq(complianceActionItems.priority, priority));
      }

      if (assigneeId) {
        conditions.push(eq(complianceActionItems.assigneeId, assigneeId));
      }

      if (overdueOnly) {
        conditions.push(
          and(
            sql`${complianceActionItems.status} != 'completed'`,
            sql`${complianceActionItems.status} != 'cancelled'`,
            lt(complianceActionItems.dueDate, sql`CURRENT_DATE`)
          )!
        );
      }

      if (dateFrom) {
        conditions.push(gte(complianceActionItems.dueDate, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(complianceActionItems.dueDate, dateTo));
      }

      // If filtering by tracker type, we need to join
      let actionsList;
      if (trackerTypeSlug) {
        actionsList = await ctx.db
          .select({
            actionItem: complianceActionItems,
            tracker: {
              id: complianceTrackers.id,
              referenceNumber: complianceTrackers.referenceNumber,
              title: complianceTrackers.title,
            },
            trackerType: {
              id: complianceTrackerTypes.id,
              name: complianceTrackerTypes.name,
              slug: complianceTrackerTypes.slug,
              icon: complianceTrackerTypes.icon,
            },
            assignee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(complianceActionItems)
          .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
          .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
          .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
          .where(
            and(
              ...conditions,
              eq(complianceTrackerTypes.slug, trackerTypeSlug)
            )
          )
          .orderBy(desc(complianceActionItems.dueDate), desc(complianceActionItems.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        actionsList = await ctx.db
          .select({
            actionItem: complianceActionItems,
            tracker: {
              id: complianceTrackers.id,
              referenceNumber: complianceTrackers.referenceNumber,
              title: complianceTrackers.title,
            },
            trackerType: {
              id: complianceTrackerTypes.id,
              name: complianceTrackerTypes.name,
              slug: complianceTrackerTypes.slug,
              icon: complianceTrackerTypes.icon,
            },
            assignee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(complianceActionItems)
          .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
          .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
          .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(complianceActionItems.dueDate), desc(complianceActionItems.createdAt))
          .limit(limit)
          .offset(offset);
      }

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(complianceActionItems)
        .where(and(...conditions));

      return {
        data: actionsList.map(item => ({
          ...item.actionItem,
          tracker: item.tracker,
          trackerType: item.trackerType,
          assignee: item.assignee?.id ? item.assignee : null,
          isOverdue: item.actionItem.dueDate &&
            item.actionItem.status !== 'completed' &&
            item.actionItem.status !== 'cancelled' &&
            new Date(item.actionItem.dueDate) < new Date(),
        })),
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get a single action item by ID
   */
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      const [result] = await ctx.db
        .select({
          actionItem: complianceActionItems,
          tracker: {
            id: complianceTrackers.id,
            referenceNumber: complianceTrackers.referenceNumber,
            title: complianceTrackers.title,
          },
          trackerType: {
            id: complianceTrackerTypes.id,
            name: complianceTrackerTypes.name,
            slug: complianceTrackerTypes.slug,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceActionItems)
        .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
        .where(
          and(
            eq(complianceActionItems.id, input.id),
            eq(complianceActionItems.tenantId, tenantId)
          )
        );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action non trouvée',
        });
      }

      return {
        ...result.actionItem,
        tracker: result.tracker,
        trackerType: result.trackerType,
        assignee: result.assignee?.id ? result.assignee : null,
      };
    }),

  /**
   * Create a new action item
   */
  create: hrManagerProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        assigneeId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify tracker exists
      const [tracker] = await ctx.db
        .select()
        .from(complianceTrackers)
        .where(and(
          eq(complianceTrackers.id, input.trackerId),
          eq(complianceTrackers.tenantId, tenantId)
        ))
        .limit(1);

      if (!tracker) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dossier non trouvé',
        });
      }

      // Verify assignee exists if provided
      if (input.assigneeId) {
        const [assignee] = await ctx.db
          .select()
          .from(employees)
          .where(and(
            eq(employees.id, input.assigneeId),
            eq(employees.tenantId, tenantId)
          ))
          .limit(1);

        if (!assignee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employé non trouvé',
          });
        }
      }

      // Create action item
      const [created] = await ctx.db
        .insert(complianceActionItems)
        .values({
          tenantId,
          trackerId: input.trackerId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate,
          source: input.source,
          status: 'pending',
          createdBy: ctx.user.id,
        })
        .returning();

      // Add comment to tracker
      await ctx.db.insert(complianceTrackerComments).values({
        tenantId,
        trackerId: input.trackerId,
        content: `Action ajoutée: ${input.title}`,
        isStatusChange: false,
        createdBy: ctx.user.id,
      });

      // Create in-app alert if assignee is set
      if (input.assigneeId) {
        // Find the user linked to this employee
        const [assigneeUser] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.employeeId, input.assigneeId))
          .limit(1);

        if (assigneeUser) {
          await ctx.db.insert(alerts).values({
            tenantId,
            type: 'compliance_action_assigned',
            severity: input.priority === 'critical' ? 'urgent' : input.priority === 'high' ? 'warning' : 'info',
            message: `Nouvelle action: ${input.title}`,
            assigneeId: assigneeUser.id,
            actionUrl: `/compliance/actions?id=${created.id}`,
            actionLabel: 'Voir l\'action',
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            metadata: {
              actionItemId: created.id,
              trackerId: input.trackerId,
              trackerReference: tracker.referenceNumber,
            },
          });
        }
      }

      return created;
    }),

  /**
   * Update an action item
   */
  update: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { id, ...updates } = input;

      // Verify action item exists
      const [actionItem] = await ctx.db
        .select()
        .from(complianceActionItems)
        .where(and(
          eq(complianceActionItems.id, id),
          eq(complianceActionItems.tenantId, tenantId)
        ))
        .limit(1);

      if (!actionItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action non trouvée',
        });
      }

      // Cannot update completed/cancelled actions
      if (actionItem.status === 'completed' || actionItem.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de modifier une action terminée ou annulée',
        });
      }

      const [updated] = await ctx.db
        .update(complianceActionItems)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(complianceActionItems.id, id))
        .returning();

      return updated;
    }),

  /**
   * Update action item status
   */
  updateStatus: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify action item exists
      const [actionItem] = await ctx.db
        .select()
        .from(complianceActionItems)
        .where(and(
          eq(complianceActionItems.id, input.id),
          eq(complianceActionItems.tenantId, tenantId)
        ))
        .limit(1);

      if (!actionItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action non trouvée',
        });
      }

      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = ctx.user.id;
      }

      const [updated] = await ctx.db
        .update(complianceActionItems)
        .set(updateData)
        .where(eq(complianceActionItems.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Mark action as complete with optional proof document
   */
  markComplete: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        proofDocumentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify action item exists
      const [actionItem] = await ctx.db
        .select()
        .from(complianceActionItems)
        .where(and(
          eq(complianceActionItems.id, input.id),
          eq(complianceActionItems.tenantId, tenantId)
        ))
        .limit(1);

      if (!actionItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action non trouvée',
        });
      }

      if (actionItem.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Action déjà terminée',
        });
      }

      const [updated] = await ctx.db
        .update(complianceActionItems)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy: ctx.user.id,
          proofDocumentId: input.proofDocumentId,
          updatedAt: new Date(),
        })
        .where(eq(complianceActionItems.id, input.id))
        .returning();

      // Add comment to tracker
      await ctx.db.insert(complianceTrackerComments).values({
        tenantId,
        trackerId: actionItem.trackerId,
        content: `Action terminée: ${actionItem.title}`,
        isStatusChange: false,
        createdBy: ctx.user.id,
      });

      return updated;
    }),

  /**
   * Bulk update status for multiple actions
   */
  bulkUpdateStatus: hrManagerProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify all actions exist and belong to tenant
      const actions = await ctx.db
        .select()
        .from(complianceActionItems)
        .where(and(
          inArray(complianceActionItems.id, input.ids),
          eq(complianceActionItems.tenantId, tenantId)
        ));

      if (actions.length !== input.ids.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Certaines actions n\'ont pas été trouvées',
        });
      }

      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = ctx.user.id;
      }

      await ctx.db
        .update(complianceActionItems)
        .set(updateData)
        .where(inArray(complianceActionItems.id, input.ids));

      return { updated: input.ids.length };
    }),

  /**
   * Get overdue actions
   */
  getOverdue: hrManagerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const limit = input?.limit ?? 10;

      const overdueActions = await ctx.db
        .select({
          actionItem: complianceActionItems,
          tracker: {
            id: complianceTrackers.id,
            referenceNumber: complianceTrackers.referenceNumber,
            title: complianceTrackers.title,
          },
          trackerType: {
            name: complianceTrackerTypes.name,
            icon: complianceTrackerTypes.icon,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceActionItems)
        .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
        .where(
          and(
            eq(complianceActionItems.tenantId, tenantId),
            sql`${complianceActionItems.status} NOT IN ('completed', 'cancelled')`,
            lt(complianceActionItems.dueDate, sql`CURRENT_DATE`)
          )
        )
        .orderBy(complianceActionItems.dueDate)
        .limit(limit);

      return overdueActions.map(item => ({
        ...item.actionItem,
        tracker: item.tracker,
        trackerType: item.trackerType,
        assignee: item.assignee?.id ? item.assignee : null,
        daysOverdue: item.actionItem.dueDate
          ? Math.floor((Date.now() - new Date(item.actionItem.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }));
    }),

  /**
   * Get urgent actions (due soon or overdue)
   */
  getUrgent: hrManagerProcedure
    .input(
      z.object({
        daysAhead: z.number().min(1).max(30).default(7),
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const daysAhead = input?.daysAhead ?? 7;
      const limit = input?.limit ?? 10;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const urgentActions = await ctx.db
        .select({
          actionItem: complianceActionItems,
          tracker: {
            id: complianceTrackers.id,
            referenceNumber: complianceTrackers.referenceNumber,
            title: complianceTrackers.title,
          },
          trackerType: {
            name: complianceTrackerTypes.name,
            icon: complianceTrackerTypes.icon,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceActionItems)
        .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
        .where(
          and(
            eq(complianceActionItems.tenantId, tenantId),
            sql`${complianceActionItems.status} NOT IN ('completed', 'cancelled')`,
            lte(complianceActionItems.dueDate, futureDate.toISOString().split('T')[0])
          )
        )
        .orderBy(complianceActionItems.dueDate)
        .limit(limit);

      return urgentActions.map(item => ({
        ...item.actionItem,
        tracker: item.tracker,
        trackerType: item.trackerType,
        assignee: item.assignee?.id ? item.assignee : null,
        isOverdue: item.actionItem.dueDate && new Date(item.actionItem.dueDate) < new Date(),
      }));
    }),
});
