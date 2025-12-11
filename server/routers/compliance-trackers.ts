/**
 * Compliance Trackers tRPC Router
 * Manages tracker records (dossiers) for accidents, visits, certifications, disciplinary
 *
 * HR-only access (hrManagerProcedure)
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import {
  complianceTrackers,
  complianceTrackerTypes,
  complianceActionItems,
  complianceTrackerComments,
  employees,
} from '@/lib/db/schema';
import { and, eq, desc, sql, gte, lte, isNull, or, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// Helper to generate reference number
async function generateReferenceNumber(
  db: any,
  tenantId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();

  // Count existing trackers with this prefix for this year
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(complianceTrackers)
    .where(
      and(
        eq(complianceTrackers.tenantId, tenantId),
        sql`${complianceTrackers.referenceNumber} LIKE ${`${prefix}-${year}-%`}`
      )
    );

  const nextNumber = (result?.count ?? 0) + 1;
  return `${prefix}-${year}-${String(nextNumber).padStart(3, '0')}`;
}

export const complianceTrackersRouter = createTRPCRouter({
  /**
   * List trackers with filters and pagination
   */
  list: hrManagerProcedure
    .input(
      z.object({
        typeSlug: z.string().optional(),
        status: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigneeId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { typeSlug, status, priority, assigneeId, employeeId, dateFrom, dateTo, search, limit, offset } = input;

      // Build conditions
      const conditions = [eq(complianceTrackers.tenantId, tenantId)];

      if (typeSlug) {
        // Get type ID from slug
        const [trackerType] = await ctx.db
          .select()
          .from(complianceTrackerTypes)
          .where(and(
            eq(complianceTrackerTypes.slug, typeSlug),
            eq(complianceTrackerTypes.tenantId, tenantId)
          ))
          .limit(1);
        if (trackerType) {
          conditions.push(eq(complianceTrackers.trackerTypeId, trackerType.id));
        }
      }

      if (status) {
        conditions.push(eq(complianceTrackers.status, status));
      }

      if (priority) {
        conditions.push(eq(complianceTrackers.priority, priority));
      }

      if (assigneeId) {
        conditions.push(eq(complianceTrackers.assigneeId, assigneeId));
      }

      if (employeeId) {
        conditions.push(eq(complianceTrackers.employeeId, employeeId));
      }

      if (dateFrom) {
        conditions.push(gte(complianceTrackers.createdAt, new Date(dateFrom)));
      }

      if (dateTo) {
        conditions.push(lte(complianceTrackers.createdAt, new Date(dateTo)));
      }

      if (search) {
        conditions.push(
          or(
            sql`${complianceTrackers.title} ILIKE ${`%${search}%`}`,
            sql`${complianceTrackers.referenceNumber} ILIKE ${`%${search}%`}`
          )!
        );
      }

      // Fetch trackers with manual joins
      const trackersList = await ctx.db
        .select({
          tracker: complianceTrackers,
          trackerType: {
            id: complianceTrackerTypes.id,
            name: complianceTrackerTypes.name,
            slug: complianceTrackerTypes.slug,
            icon: complianceTrackerTypes.icon,
            workflowStatuses: complianceTrackerTypes.workflowStatuses,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceTrackers)
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceTrackers.assigneeId, employees.id))
        .where(and(...conditions))
        .orderBy(desc(complianceTrackers.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(complianceTrackers)
        .where(and(...conditions));

      // Get action item counts per tracker
      const trackerIds = trackersList.map(t => t.tracker.id);
      let actionCounts: Record<string, { total: number; completed: number }> = {};

      if (trackerIds.length > 0) {
        const actionStats = await ctx.db
          .select({
            trackerId: complianceActionItems.trackerId,
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) FILTER (WHERE ${complianceActionItems.status} = 'completed')::int`,
          })
          .from(complianceActionItems)
          .where(inArray(complianceActionItems.trackerId, trackerIds))
          .groupBy(complianceActionItems.trackerId);

        actionCounts = Object.fromEntries(
          actionStats.map(s => [s.trackerId, { total: s.total, completed: s.completed }])
        );
      }

      return {
        data: trackersList.map(t => ({
          ...t.tracker,
          trackerType: t.trackerType,
          assignee: t.assignee?.id ? t.assignee : null,
          actionItemsCount: actionCounts[t.tracker.id]?.total ?? 0,
          actionItemsCompleted: actionCounts[t.tracker.id]?.completed ?? 0,
        })),
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get a single tracker by ID with full details
   */
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch tracker with type
      const [result] = await ctx.db
        .select({
          tracker: complianceTrackers,
          trackerType: complianceTrackerTypes,
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          },
        })
        .from(complianceTrackers)
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceTrackers.assigneeId, employees.id))
        .where(
          and(
            eq(complianceTrackers.id, input.id),
            eq(complianceTrackers.tenantId, tenantId)
          )
        );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dossier non trouvé',
        });
      }

      // Get related employee if exists
      let relatedEmployee = null;
      if (result.tracker.employeeId) {
        const [emp] = await ctx.db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          })
          .from(employees)
          .where(eq(employees.id, result.tracker.employeeId));
        relatedEmployee = emp || null;
      }

      // Get action items
      const actionItems = await ctx.db
        .select()
        .from(complianceActionItems)
        .where(eq(complianceActionItems.trackerId, input.id))
        .orderBy(desc(complianceActionItems.createdAt));

      // Get comments
      const comments = await ctx.db
        .select()
        .from(complianceTrackerComments)
        .where(eq(complianceTrackerComments.trackerId, input.id))
        .orderBy(desc(complianceTrackerComments.createdAt));

      return {
        ...result.tracker,
        trackerType: result.trackerType,
        assignee: result.assignee?.id ? result.assignee : null,
        employee: relatedEmployee,
        actionItems,
        comments,
      };
    }),

  /**
   * Create a new tracker
   */
  create: hrManagerProcedure
    .input(
      z.object({
        trackerTypeId: z.string().uuid(),
        title: z.string().min(1),
        data: z.record(z.unknown()),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        assigneeId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify tracker type exists and is active
      const [trackerType] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.id, input.trackerTypeId),
          eq(complianceTrackerTypes.tenantId, tenantId),
          eq(complianceTrackerTypes.isActive, true)
        ))
        .limit(1);

      if (!trackerType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Type de suivi non trouvé ou inactif',
        });
      }

      // Generate reference number
      const referenceNumber = await generateReferenceNumber(
        ctx.db,
        tenantId,
        trackerType.referencePrefix
      );

      // Get initial status from workflow
      const workflowStatuses = trackerType.workflowStatuses as Array<{ id: string }>;
      const initialStatus = workflowStatuses[0]?.id ?? 'nouveau';

      // Create tracker
      const [created] = await ctx.db
        .insert(complianceTrackers)
        .values({
          tenantId,
          trackerTypeId: input.trackerTypeId,
          referenceNumber,
          title: input.title,
          status: initialStatus,
          priority: input.priority,
          data: input.data,
          assigneeId: input.assigneeId,
          employeeId: input.employeeId,
          dueDate: input.dueDate,
          createdBy: ctx.user.id,
        })
        .returning();

      // Add initial comment
      await ctx.db.insert(complianceTrackerComments).values({
        tenantId,
        trackerId: created.id,
        content: `Dossier créé: ${created.title}`,
        isStatusChange: false,
        createdBy: ctx.user.id,
      });

      return created;
    }),

  /**
   * Update tracker data
   */
  update: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        data: z.record(z.unknown()).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        employeeId: z.string().uuid().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { id, ...updates } = input;

      // Verify tracker exists
      const [tracker] = await ctx.db
        .select()
        .from(complianceTrackers)
        .where(and(
          eq(complianceTrackers.id, id),
          eq(complianceTrackers.tenantId, tenantId)
        ))
        .limit(1);

      if (!tracker) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dossier non trouvé',
        });
      }

      // Cannot update closed trackers
      if (tracker.closedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de modifier un dossier clôturé',
        });
      }

      const [updated] = await ctx.db
        .update(complianceTrackers)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(complianceTrackers.id, id))
        .returning();

      return updated;
    }),

  /**
   * Update tracker status
   */
  updateStatus: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.string(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Get tracker with type
      const [result] = await ctx.db
        .select({
          tracker: complianceTrackers,
          trackerType: complianceTrackerTypes,
        })
        .from(complianceTrackers)
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .where(
          and(
            eq(complianceTrackers.id, input.id),
            eq(complianceTrackers.tenantId, tenantId)
          )
        );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dossier non trouvé',
        });
      }

      // Validate status is in workflow
      const workflowStatuses = result.trackerType?.workflowStatuses as Array<{ id: string; isFinal?: boolean }> ?? [];
      const validStatus = workflowStatuses.find(s => s.id === input.status);

      if (!validStatus) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Statut invalide',
        });
      }

      const oldStatus = result.tracker.status;

      // Update tracker
      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };

      // If final status, set closedAt
      if (validStatus.isFinal) {
        updateData.closedAt = new Date();
        updateData.closedBy = ctx.user.id;
      }

      const [updated] = await ctx.db
        .update(complianceTrackers)
        .set(updateData)
        .where(eq(complianceTrackers.id, input.id))
        .returning();

      // Add status change comment
      const statusLabel = workflowStatuses.find(s => s.id === input.status);
      const oldStatusLabel = workflowStatuses.find(s => s.id === oldStatus);

      await ctx.db.insert(complianceTrackerComments).values({
        tenantId,
        trackerId: input.id,
        content: input.comment || `Statut modifié: ${oldStatusLabel?.id ?? oldStatus} → ${statusLabel?.id ?? input.status}`,
        isStatusChange: true,
        oldStatus,
        newStatus: input.status,
        createdBy: ctx.user.id,
      });

      return updated;
    }),

  /**
   * Assign tracker to an employee
   */
  assign: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assigneeId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify tracker exists
      const [tracker] = await ctx.db
        .select()
        .from(complianceTrackers)
        .where(and(
          eq(complianceTrackers.id, input.id),
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

      const [updated] = await ctx.db
        .update(complianceTrackers)
        .set({
          assigneeId: input.assigneeId,
          updatedAt: new Date(),
        })
        .where(eq(complianceTrackers.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Close a tracker
   */
  close: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Get tracker with type
      const [result] = await ctx.db
        .select({
          tracker: complianceTrackers,
          trackerType: complianceTrackerTypes,
        })
        .from(complianceTrackers)
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .where(
          and(
            eq(complianceTrackers.id, input.id),
            eq(complianceTrackers.tenantId, tenantId)
          )
        );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Dossier non trouvé',
        });
      }

      if (result.tracker.closedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dossier déjà clôturé',
        });
      }

      // Get final status
      const workflowStatuses = result.trackerType?.workflowStatuses as Array<{ id: string; isFinal?: boolean }> ?? [];
      const finalStatus = workflowStatuses.find(s => s.isFinal)?.id ?? 'cloture';

      const [updated] = await ctx.db
        .update(complianceTrackers)
        .set({
          status: finalStatus,
          closedAt: new Date(),
          closedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(complianceTrackers.id, input.id))
        .returning();

      // Add close comment
      await ctx.db.insert(complianceTrackerComments).values({
        tenantId,
        trackerId: input.id,
        content: input.comment || 'Dossier clôturé',
        isStatusChange: true,
        oldStatus: result.tracker.status,
        newStatus: finalStatus,
        createdBy: ctx.user.id,
      });

      return updated;
    }),

  /**
   * Get dashboard statistics
   */
  getDashboardStats: hrManagerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Get open trackers count
    const [openCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceTrackers)
      .where(
        and(
          eq(complianceTrackers.tenantId, tenantId),
          isNull(complianceTrackers.closedAt)
        )
      );

    // Get critical priority count
    const [criticalCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceTrackers)
      .where(
        and(
          eq(complianceTrackers.tenantId, tenantId),
          isNull(complianceTrackers.closedAt),
          eq(complianceTrackers.priority, 'critical')
        )
      );

    // Get action items stats
    const [actionStats] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${complianceActionItems.status} = 'completed')::int`,
        overdue: sql<number>`count(*) FILTER (WHERE ${complianceActionItems.status} != 'completed' AND ${complianceActionItems.dueDate} < CURRENT_DATE)::int`,
      })
      .from(complianceActionItems)
      .where(eq(complianceActionItems.tenantId, tenantId));

    // Get counts by type
    const byType = await ctx.db
      .select({
        typeId: complianceTrackers.trackerTypeId,
        typeName: complianceTrackerTypes.name,
        typeSlug: complianceTrackerTypes.slug,
        typeIcon: complianceTrackerTypes.icon,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceTrackers)
      .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
      .where(
        and(
          eq(complianceTrackers.tenantId, tenantId),
          isNull(complianceTrackers.closedAt)
        )
      )
      .groupBy(
        complianceTrackers.trackerTypeId,
        complianceTrackerTypes.name,
        complianceTrackerTypes.slug,
        complianceTrackerTypes.icon
      );

    // Calculate completion rate
    const completionRate = actionStats.total > 0
      ? Math.round((actionStats.completed / actionStats.total) * 100)
      : 100;

    return {
      openTrackers: openCount.count,
      criticalTrackers: criticalCount.count,
      actionItemsTotal: actionStats.total,
      actionItemsCompleted: actionStats.completed,
      actionItemsOverdue: actionStats.overdue,
      completionRate,
      byType,
    };
  }),

  /**
   * Add a comment to a tracker
   */
  addComment: hrManagerProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        content: z.string().min(1),
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

      const [comment] = await ctx.db
        .insert(complianceTrackerComments)
        .values({
          tenantId,
          trackerId: input.trackerId,
          content: input.content,
          isStatusChange: false,
          createdBy: ctx.user.id,
        })
        .returning();

      return comment;
    }),
});
