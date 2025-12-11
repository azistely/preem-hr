/**
 * Compliance Tracker Types tRPC Router
 * Manages tracker type templates (accidents, visits, certifications, disciplinary)
 *
 * HR-only access (hrManagerProcedure)
 */

import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure, adminProcedure } from '../api/trpc';
import { complianceTrackerTypes } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const complianceTrackerTypesRouter = createTRPCRouter({
  /**
   * List all tracker types for the current tenant
   */
  list: hrManagerProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const activeOnly = input?.activeOnly ?? true;

      const conditions = [eq(complianceTrackerTypes.tenantId, tenantId)];

      if (activeOnly) {
        conditions.push(eq(complianceTrackerTypes.isActive, true));
      }

      const types = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(...conditions))
        .orderBy(desc(complianceTrackerTypes.isSystem), complianceTrackerTypes.name);

      return types;
    }),

  /**
   * Get a single tracker type by ID
   */
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      const [trackerType] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.id, input.id),
          eq(complianceTrackerTypes.tenantId, tenantId)
        ))
        .limit(1);

      if (!trackerType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Type de suivi non trouvé',
        });
      }

      return trackerType;
    }),

  /**
   * Get a tracker type by slug
   */
  getBySlug: hrManagerProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      const [trackerType] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.slug, input.slug),
          eq(complianceTrackerTypes.tenantId, tenantId)
        ))
        .limit(1);

      if (!trackerType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Type de suivi non trouvé',
        });
      }

      return trackerType;
    }),

  /**
   * Toggle active status of a tracker type (admin only)
   */
  toggleActive: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Find the tracker type
      const [trackerType] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.id, input.id),
          eq(complianceTrackerTypes.tenantId, tenantId)
        ))
        .limit(1);

      if (!trackerType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Type de suivi non trouvé',
        });
      }

      // Toggle the active status
      const [updated] = await ctx.db
        .update(complianceTrackerTypes)
        .set({
          isActive: !trackerType.isActive,
          updatedAt: new Date(),
        })
        .where(eq(complianceTrackerTypes.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Create a custom tracker type (admin only, for future use)
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
        icon: z.string().optional(),
        definition: z.object({
          fields: z.array(z.object({
            id: z.string(),
            label: z.string(),
            type: z.enum(['text', 'textarea', 'date', 'datetime', 'select', 'multiselect', 'number', 'employee', 'file', 'checkbox', 'location']),
            required: z.boolean(),
            options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
            placeholder: z.string().optional(),
            helpText: z.string().optional(),
            section: z.string().optional(),
            readOnly: z.boolean().optional(),
            computed: z.object({
              type: z.enum(['add_hours', 'add_business_days']),
              sourceField: z.string(),
              value: z.number(),
            }).optional(),
          })),
          sections: z.array(z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
          })).optional(),
          rules: z.array(z.object({
            condition: z.object({
              field: z.string(),
              operator: z.enum(['equals', 'not_equals']),
              value: z.string(),
            }),
            action: z.enum(['skip_action_plan', 'require_field']),
            targetField: z.string().optional(),
          })).optional(),
        }),
        workflowStatuses: z.array(z.object({
          id: z.string(),
          label: z.string(),
          color: z.enum(['default', 'info', 'warning', 'success', 'destructive']),
          isFinal: z.boolean().optional(),
        })),
        referencePrefix: z.string().min(1).max(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Check if slug already exists for this tenant
      const [existing] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.slug, input.slug),
          eq(complianceTrackerTypes.tenantId, tenantId)
        ))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Un type de suivi avec ce slug existe déjà',
        });
      }

      const [created] = await ctx.db
        .insert(complianceTrackerTypes)
        .values({
          tenantId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          icon: input.icon,
          definition: input.definition,
          workflowStatuses: input.workflowStatuses,
          referencePrefix: input.referencePrefix,
          isSystem: false,
          isActive: true,
          createdBy: ctx.user.id,
        })
        .returning();

      return created;
    }),

  /**
   * Update a custom tracker type (admin only, system types cannot be edited)
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Find the tracker type
      const [trackerType] = await ctx.db
        .select()
        .from(complianceTrackerTypes)
        .where(and(
          eq(complianceTrackerTypes.id, input.id),
          eq(complianceTrackerTypes.tenantId, tenantId)
        ))
        .limit(1);

      if (!trackerType) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Type de suivi non trouvé',
        });
      }

      // System types can only have name/description/icon updated
      const [updated] = await ctx.db
        .update(complianceTrackerTypes)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
          updatedAt: new Date(),
        })
        .where(eq(complianceTrackerTypes.id, input.id))
        .returning();

      return updated;
    }),
});
