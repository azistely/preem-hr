/**
 * Workflows tRPC Router
 * Epic: Phase 4 - Visual Workflow Builder
 *
 * Handles workflow automation:
 * - List/create/update/delete workflows
 * - Template management
 * - Execution history
 * - Statistics and monitoring
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import { workflowDefinitions, workflowExecutions } from '@/lib/db/schema/workflows';
import { and, eq, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Workflow configuration schemas
 */
const workflowTriggerConfigSchema = z.record(z.any());
const workflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value: z.any(),
});
const workflowActionSchema = z.object({
  type: z.enum(['create_alert', 'send_notification', 'create_payroll_event', 'update_employee_status']),
  config: z.record(z.any()),
});

export const workflowsRouter = createTRPCRouter({
  /**
   * List all workflows with filtering
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
        templateCategory: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { status, templateCategory, limit, offset } = input;
      const tenantId = ctx.user.tenantId;

      // Build where conditions
      const conditions = [eq(workflowDefinitions.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(workflowDefinitions.status, status));
      }

      if (templateCategory) {
        conditions.push(eq(workflowDefinitions.templateCategory, templateCategory));
      }

      // Fetch workflows
      const workflows = await ctx.db.query.workflowDefinitions.findMany({
        where: and(...conditions),
        orderBy: [desc(workflowDefinitions.createdAt)],
        limit,
        offset,
      });

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowDefinitions)
        .where(and(...conditions));

      return {
        workflows,
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get workflow by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      return workflow;
    }),

  /**
   * Get pre-built templates
   */
  getTemplates: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(workflowDefinitions.isTemplate, true),
        // Templates are stored with a null tenantId (system-wide)
        isNull(workflowDefinitions.tenantId),
      ];

      if (input.category) {
        conditions.push(eq(workflowDefinitions.templateCategory, input.category));
      }

      const templates = await ctx.db.query.workflowDefinitions.findMany({
        where: and(...conditions),
        orderBy: [desc(workflowDefinitions.createdAt)],
      });

      return templates;
    }),

  /**
   * Create workflow from scratch or template
   */
  create: hrManagerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        triggerType: z.string(),
        triggerConfig: workflowTriggerConfigSchema,
        conditions: z.array(workflowConditionSchema).default([]),
        actions: z.array(workflowActionSchema).min(1),
        status: z.enum(['draft', 'active']).default('draft'),
        templateId: z.string().uuid().optional(), // If creating from template
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { templateId, ...workflowData } = input;

      // If creating from template, fetch template data
      let templateData = null;
      if (templateId) {
        templateData = await ctx.db.query.workflowDefinitions.findFirst({
          where: and(
            eq(workflowDefinitions.id, templateId),
            eq(workflowDefinitions.isTemplate, true)
          ),
        });

        if (!templateData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Modèle non trouvé',
          });
        }
      }

      // Create workflow
      const [workflow] = await ctx.db
        .insert(workflowDefinitions)
        .values({
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
          name: workflowData.name,
          description: workflowData.description,
          triggerType: workflowData.triggerType,
          triggerConfig: workflowData.triggerConfig,
          conditions: workflowData.conditions,
          actions: workflowData.actions,
          status: workflowData.status,
          isTemplate: false,
          templateCategory: templateData?.templateCategory,
        })
        .returning();

      return workflow;
    }),

  /**
   * Update workflow
   */
  update: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        triggerConfig: workflowTriggerConfigSchema.optional(),
        conditions: z.array(workflowConditionSchema).optional(),
        actions: z.array(workflowActionSchema).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Update workflow
      const [updatedWorkflow] = await ctx.db
        .update(workflowDefinitions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(workflowDefinitions.id, id))
        .returning();

      return updatedWorkflow;
    }),

  /**
   * Activate workflow
   */
  activate: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Validate workflow has at least one action
      if (!workflow.actions || (workflow.actions as any[]).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Le workflow doit avoir au moins une action',
        });
      }

      // Activate workflow
      const [updatedWorkflow] = await ctx.db
        .update(workflowDefinitions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(workflowDefinitions.id, input.id))
        .returning();

      return updatedWorkflow;
    }),

  /**
   * Pause workflow
   */
  pause: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Pause workflow
      const [updatedWorkflow] = await ctx.db
        .update(workflowDefinitions)
        .set({
          status: 'paused',
          updatedAt: new Date(),
        })
        .where(eq(workflowDefinitions.id, input.id))
        .returning();

      return updatedWorkflow;
    }),

  /**
   * Delete workflow (soft delete - archive)
   */
  delete: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Archive workflow instead of deleting
      const [archivedWorkflow] = await ctx.db
        .update(workflowDefinitions)
        .set({
          status: 'archived',
          updatedAt: new Date(),
        })
        .where(eq(workflowDefinitions.id, input.id))
        .returning();

      return archivedWorkflow;
    }),

  /**
   * Get execution history
   */
  getExecutionHistory: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        status: z.enum(['running', 'success', 'failed', 'skipped']).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workflowId, status, limit, offset } = input;

      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Build conditions
      const conditions = [eq(workflowExecutions.workflowId, workflowId)];
      if (status) {
        conditions.push(eq(workflowExecutions.status, status));
      }

      // Fetch executions
      const executions = await ctx.db.query.workflowExecutions.findMany({
        where: and(...conditions),
        orderBy: [desc(workflowExecutions.startedAt)],
        limit,
        offset,
        with: {
          // @ts-expect-error - Relations not yet defined in schema
          employee: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowExecutions)
        .where(and(...conditions));

      return {
        executions,
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get workflow statistics
   */
  getStats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // Get execution statistics
      const stats = await ctx.db
        .select({
          status: workflowExecutions.status,
          count: sql<number>`count(*)::int`,
          avgDuration: sql<number>`avg(duration_ms)::int`,
        })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, input.id))
        .groupBy(workflowExecutions.status);

      return {
        workflow,
        stats,
      };
    }),

  /**
   * Test workflow (dry run)
   */
  testWorkflow: hrManagerProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        testData: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify workflow belongs to tenant
      const workflow = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.workflowId),
          eq(workflowDefinitions.tenantId, ctx.user.tenantId)
        ),
      });

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow non trouvé',
        });
      }

      // TODO: Implement actual test workflow logic in workflow-engine.ts
      // For now, return mock data
      return {
        success: true,
        conditionsEvaluated: workflow.conditions,
        actionsPreview: workflow.actions,
        message: 'Test réussi - Les actions seraient exécutées normalement',
      };
    }),
});
