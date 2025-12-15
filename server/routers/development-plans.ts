/**
 * Development Plans tRPC Router
 *
 * Handles Individual Development Plan (IDP) operations:
 * - CRUD operations for development plans
 * - Goal tracking and progress updates
 * - Training recommendation linking
 * - Creation from evaluation competency gaps
 *
 * French error messages and labels
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sql, and, eq, desc, asc, isNull, isNotNull, like, inArray } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure, managerProcedure, hrManagerProcedure, employeeProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import {
  employees,
  users,
} from '@/drizzle/schema';
import {
  developmentPlans,
  evaluations,
  performanceCycles,
  type DevelopmentGoal,
  type RecommendedTraining,
} from '@/lib/db/schema/performance';
import { eventBus } from '@/lib/event-bus';
import { format, addMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const goalSchema = z.object({
  id: z.string().uuid().optional(), // Generated if not provided
  description: z.string().min(5, 'La description doit faire au moins 5 caractères'),
  competencyId: z.string().uuid().optional(),
  targetDate: z.string(), // ISO date string
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  progress: z.number().int().min(0).max(100).default(0),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
});

const trainingRecommendationSchema = z.object({
  courseId: z.string().uuid(),
  courseName: z.string(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  enrolled: z.boolean().default(false),
  enrollmentId: z.string().uuid().optional(),
  completedAt: z.string().optional(),
});

const competencyGapSchema = z.object({
  competencyId: z.string().uuid(),
  competencyName: z.string(),
  currentLevel: z.number().int().min(0).max(5),
  requiredLevel: z.number().int().min(0).max(5),
  gap: z.number().int(),
});

const createPlanSchema = z.object({
  employeeId: z.string().uuid('ID employé invalide'),
  evaluationId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
  title: z.string().min(3, 'Le titre doit faire au moins 3 caractères'),
  description: z.string().optional(),
  goals: z.array(goalSchema).default([]),
  recommendedTrainings: z.array(trainingRecommendationSchema).default([]),
  competencyGaps: z.array(competencyGapSchema).optional(),
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
  managerNotes: z.string().optional(),
});

const updatePlanSchema = z.object({
  planId: z.string().uuid('ID plan invalide'),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled', 'archived']).optional(),
  managerNotes: z.string().optional(),
  employeeNotes: z.string().optional(),
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
});

const updateGoalSchema = z.object({
  planId: z.string().uuid('ID plan invalide'),
  goalId: z.string().uuid('ID objectif invalide'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// ROUTER
// ============================================================================

export const developmentPlansRouter = createTRPCRouter({
  /**
   * List development plans with filters
   */
  list: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid().optional(),
        cycleId: z.string().uuid().optional(),
        status: z.enum(['draft', 'active', 'completed', 'cancelled', 'archived']).optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        orderBy: z.enum(['createdAt', 'updatedAt', 'title', 'status']).default('updatedAt'),
        orderDir: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Build conditions
      const conditions = [eq(developmentPlans.tenantId, tenantId)];

      if (input.employeeId) {
        conditions.push(eq(developmentPlans.employeeId, input.employeeId));
      }

      if (input.cycleId) {
        conditions.push(eq(developmentPlans.cycleId, input.cycleId));
      }

      if (input.status) {
        conditions.push(eq(developmentPlans.status, input.status));
      }

      if (input.search) {
        conditions.push(like(developmentPlans.title, `%${input.search}%`));
      }

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(developmentPlans)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Get plans with employee info
      const orderColumn = input.orderBy === 'title'
        ? developmentPlans.title
        : input.orderBy === 'status'
          ? developmentPlans.status
          : input.orderBy === 'createdAt'
            ? developmentPlans.createdAt
            : developmentPlans.updatedAt;

      const orderFn = input.orderDir === 'asc' ? asc : desc;

      const plans = await db
        .select({
          id: developmentPlans.id,
          employeeId: developmentPlans.employeeId,
          evaluationId: developmentPlans.evaluationId,
          cycleId: developmentPlans.cycleId,
          title: developmentPlans.title,
          description: developmentPlans.description,
          status: developmentPlans.status,
          goals: developmentPlans.goals,
          recommendedTrainings: developmentPlans.recommendedTrainings,
          competencyGaps: developmentPlans.competencyGaps,
          totalGoals: developmentPlans.totalGoals,
          completedGoals: developmentPlans.completedGoals,
          progressPercentage: developmentPlans.progressPercentage,
          startDate: developmentPlans.startDate,
          targetEndDate: developmentPlans.targetEndDate,
          completedAt: developmentPlans.completedAt,
          createdAt: developmentPlans.createdAt,
          updatedAt: developmentPlans.updatedAt,
          // Employee info
          employeeNumber: employees.employeeNumber,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          employeeJobTitle: employees.jobTitle,
        })
        .from(developmentPlans)
        .leftJoin(employees, eq(developmentPlans.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(input.limit)
        .offset(input.offset);

      return {
        items: plans,
        total,
        hasMore: input.offset + plans.length < total,
      };
    }),

  /**
   * Get single development plan by ID
   */
  getById: protectedProcedure
    .input(z.object({ planId: z.string().uuid('ID plan invalide') }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const results = await db
        .select({
          plan: developmentPlans,
          employee: employees,
          evaluation: evaluations,
          cycle: performanceCycles,
        })
        .from(developmentPlans)
        .leftJoin(employees, eq(developmentPlans.employeeId, employees.id))
        .leftJoin(evaluations, eq(developmentPlans.evaluationId, evaluations.id))
        .leftJoin(performanceCycles, eq(developmentPlans.cycleId, performanceCycles.id))
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      const result = results[0];

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      return {
        ...result.plan,
        employee: result.employee,
        evaluation: result.evaluation,
        cycle: result.cycle,
      };
    }),

  /**
   * Get development plans for current user (employee view)
   */
  getMyPlans: employeeProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    const employeeId = ctx.user.employeeId;

    if (!employeeId) {
      return [];
    }

    const plans = await db
      .select()
      .from(developmentPlans)
      .where(
        and(
          eq(developmentPlans.tenantId, tenantId),
          eq(developmentPlans.employeeId, employeeId)
        )
      )
      .orderBy(desc(developmentPlans.updatedAt));

    return plans;
  }),

  /**
   * Create new development plan
   */
  create: managerProcedure
    .input(createPlanSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Verify employee exists
      const employeeRows = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, tenantId)
          )
        )
        .limit(1);

      if (employeeRows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employé introuvable',
        });
      }

      // Generate IDs for goals
      const goalsWithIds: DevelopmentGoal[] = input.goals.map((g) => ({
        ...g,
        id: g.id ?? uuidv4(),
      }));

      // Calculate metrics
      const totalGoals = goalsWithIds.length;
      const completedGoals = goalsWithIds.filter((g) => g.status === 'completed').length;
      const progressPercentage = totalGoals > 0
        ? Math.round((completedGoals / totalGoals) * 100)
        : 0;

      // Insert plan
      const [newPlan] = await db
        .insert(developmentPlans)
        .values({
          tenantId,
          employeeId: input.employeeId,
          evaluationId: input.evaluationId,
          cycleId: input.cycleId,
          title: input.title,
          description: input.description,
          status: 'draft',
          goals: goalsWithIds,
          recommendedTrainings: input.recommendedTrainings as RecommendedTraining[],
          competencyGaps: input.competencyGaps,
          managerNotes: input.managerNotes,
          totalGoals,
          completedGoals,
          progressPercentage,
          startDate: input.startDate ? format(input.startDate, 'yyyy-MM-dd') : null,
          targetEndDate: input.targetEndDate ? format(input.targetEndDate, 'yyyy-MM-dd') : null,
          createdBy: ctx.user.id,
        })
        .returning();

      // Emit event
      await eventBus.publish('development_plan.created', {
        planId: newPlan.id,
        employeeId: input.employeeId,
        tenantId,
        createdBy: ctx.user.id,
      });

      return newPlan;
    }),

  /**
   * Create development plan from evaluation
   */
  createFromEvaluation: managerProcedure
    .input(
      z.object({
        evaluationId: z.string().uuid('ID évaluation invalide'),
        title: z.string().optional(),
        includeCompetencyGaps: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get evaluation with employee
      const evaluationRows = await db
        .select({
          evaluation: evaluations,
          employee: employees,
          cycle: performanceCycles,
        })
        .from(evaluations)
        .leftJoin(employees, eq(evaluations.employeeId, employees.id))
        .leftJoin(performanceCycles, eq(evaluations.cycleId, performanceCycles.id))
        .where(
          and(
            eq(evaluations.id, input.evaluationId),
            eq(evaluations.tenantId, tenantId)
          )
        )
        .limit(1);

      const evaluationResult = evaluationRows[0];

      if (!evaluationResult?.evaluation || !evaluationResult.employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Évaluation introuvable',
        });
      }

      const evaluation = evaluationResult.evaluation;
      const employee = evaluationResult.employee;
      const cycle = evaluationResult.cycle;

      // Check if plan already exists for this evaluation
      const existingPlan = await db
        .select()
        .from(developmentPlans)
        .where(
          and(
            eq(developmentPlans.evaluationId, input.evaluationId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      if (existingPlan.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Un plan de développement existe déjà pour cette évaluation',
        });
      }

      // Build default title
      const planTitle = input.title
        ?? `Plan de développement - ${employee.lastName} ${employee.firstName}${cycle ? ` (${cycle.name})` : ''}`;

      // Extract development areas from evaluation responses
      const developmentAreas: DevelopmentGoal[] = [];
      const responses = evaluation.responses as Record<string, unknown>;

      // Check for development comments in common evaluation fields
      const developmentComment = (responses?.developmentAreasComment as string)
        || (responses?.improvementAreasComment as string);

      if (developmentComment && developmentComment.trim()) {
        developmentAreas.push({
          id: uuidv4(),
          description: developmentComment.trim(),
          targetDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd'),
          status: 'pending',
          progress: 0,
        });
      }

      // Create plan
      const [newPlan] = await db
        .insert(developmentPlans)
        .values({
          tenantId,
          employeeId: employee.id,
          evaluationId: evaluation.id,
          cycleId: evaluation.cycleId,
          title: planTitle,
          description: `Plan créé à partir de l'évaluation ${cycle?.name ?? ''}`,
          status: 'draft',
          goals: developmentAreas,
          recommendedTrainings: [],
          managerNotes: evaluation.developmentPlanComment ?? evaluation.generalComment ?? null,
          totalGoals: developmentAreas.length,
          completedGoals: 0,
          progressPercentage: 0,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          targetEndDate: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
          createdBy: ctx.user.id,
        })
        .returning();

      // Emit event
      await eventBus.publish('development_plan.created_from_evaluation', {
        planId: newPlan.id,
        evaluationId: evaluation.id,
        employeeId: employee.id,
        tenantId,
        createdBy: ctx.user.id,
      });

      return newPlan;
    }),

  /**
   * Update development plan
   */
  update: managerProcedure
    .input(updatePlanSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: ctx.user.id,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.managerNotes !== undefined) updateData.managerNotes = input.managerNotes;
      if (input.employeeNotes !== undefined) updateData.employeeNotes = input.employeeNotes;
      if (input.startDate !== undefined) updateData.startDate = format(input.startDate, 'yyyy-MM-dd');
      if (input.targetEndDate !== undefined) updateData.targetEndDate = format(input.targetEndDate, 'yyyy-MM-dd');

      // Set completedAt if status changes to completed
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
      }

      const [updated] = await db
        .update(developmentPlans)
        .set(updateData)
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Emit event
      await eventBus.publish('development_plan.updated', {
        planId: updated.id,
        tenantId,
        updatedBy: ctx.user.id,
        changes: input,
      });

      return updated;
    }),

  /**
   * Add goal to development plan
   */
  addGoal: managerProcedure
    .input(
      z.object({
        planId: z.string().uuid('ID plan invalide'),
        goal: goalSchema.omit({ id: true }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get current plan
      const plans = await db
        .select()
        .from(developmentPlans)
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      const plan = plans[0];

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Add new goal
      const newGoal: DevelopmentGoal = {
        ...input.goal,
        id: uuidv4(),
      };

      const updatedGoals = [...(plan.goals as DevelopmentGoal[]), newGoal];
      const totalGoals = updatedGoals.length;
      const completedGoals = updatedGoals.filter((g) => g.status === 'completed').length;
      const progressPercentage = totalGoals > 0
        ? Math.round((completedGoals / totalGoals) * 100)
        : 0;

      const [updated] = await db
        .update(developmentPlans)
        .set({
          goals: updatedGoals,
          totalGoals,
          completedGoals,
          progressPercentage,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(developmentPlans.id, input.planId))
        .returning();

      return updated;
    }),

  /**
   * Update goal progress
   */
  updateGoal: protectedProcedure
    .input(updateGoalSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get current plan
      const plans = await db
        .select()
        .from(developmentPlans)
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      const plan = plans[0];

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Update goal
      const goals = plan.goals as DevelopmentGoal[];
      const goalIndex = goals.findIndex((g) => g.id === input.goalId);

      if (goalIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Objectif introuvable',
        });
      }

      const updatedGoal = { ...goals[goalIndex] };

      if (input.status !== undefined) {
        updatedGoal.status = input.status;
        if (input.status === 'completed') {
          updatedGoal.completedAt = new Date().toISOString();
          updatedGoal.progress = 100;
        }
      }

      if (input.progress !== undefined) {
        updatedGoal.progress = input.progress;
      }

      if (input.notes !== undefined) {
        updatedGoal.notes = input.notes;
      }

      goals[goalIndex] = updatedGoal;

      // Recalculate metrics
      const totalGoals = goals.length;
      const completedGoals = goals.filter((g) => g.status === 'completed').length;
      const progressPercentage = totalGoals > 0
        ? Math.round((completedGoals / totalGoals) * 100)
        : 0;

      const [updated] = await db
        .update(developmentPlans)
        .set({
          goals,
          completedGoals,
          progressPercentage,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(developmentPlans.id, input.planId))
        .returning();

      return updated;
    }),

  /**
   * Delete goal from development plan
   */
  deleteGoal: managerProcedure
    .input(
      z.object({
        planId: z.string().uuid('ID plan invalide'),
        goalId: z.string().uuid('ID objectif invalide'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get current plan
      const plans = await db
        .select()
        .from(developmentPlans)
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      const plan = plans[0];

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Remove goal
      const goals = (plan.goals as DevelopmentGoal[]).filter(
        (g) => g.id !== input.goalId
      );

      // Recalculate metrics
      const totalGoals = goals.length;
      const completedGoals = goals.filter((g) => g.status === 'completed').length;
      const progressPercentage = totalGoals > 0
        ? Math.round((completedGoals / totalGoals) * 100)
        : 0;

      const [updated] = await db
        .update(developmentPlans)
        .set({
          goals,
          totalGoals,
          completedGoals,
          progressPercentage,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(developmentPlans.id, input.planId))
        .returning();

      return updated;
    }),

  /**
   * Approve/activate development plan
   */
  approve: hrManagerProcedure
    .input(
      z.object({
        planId: z.string().uuid('ID plan invalide'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const [updated] = await db
        .update(developmentPlans)
        .set({
          status: 'active',
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          startDate: format(new Date(), 'yyyy-MM-dd'),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Emit event
      await eventBus.publish('development_plan.approved', {
        planId: updated.id,
        employeeId: updated.employeeId,
        tenantId,
        approvedBy: ctx.user.id,
      });

      return updated;
    }),

  /**
   * Archive development plan
   */
  archive: hrManagerProcedure
    .input(
      z.object({
        planId: z.string().uuid('ID plan invalide'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const [updated] = await db
        .update(developmentPlans)
        .set({
          status: 'archived',
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      return updated;
    }),

  /**
   * Delete development plan (soft delete via archive)
   */
  delete: hrManagerProcedure
    .input(
      z.object({
        planId: z.string().uuid('ID plan invalide'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Check if plan exists
      const plans = await db
        .select()
        .from(developmentPlans)
        .where(
          and(
            eq(developmentPlans.id, input.planId),
            eq(developmentPlans.tenantId, tenantId)
          )
        )
        .limit(1);

      if (plans.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan de développement introuvable',
        });
      }

      // Archive instead of delete (soft delete)
      await db
        .update(developmentPlans)
        .set({
          status: 'archived',
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(developmentPlans.id, input.planId));

      return { success: true };
    }),

  /**
   * Get summary statistics for dashboard
   */
  getSummary: hrManagerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const stats = await db
      .select({
        status: developmentPlans.status,
        count: sql<number>`count(*)::int`,
      })
      .from(developmentPlans)
      .where(eq(developmentPlans.tenantId, tenantId))
      .groupBy(developmentPlans.status);

    const statusCounts: Record<string, number> = {};
    let total = 0;

    for (const stat of stats) {
      statusCounts[stat.status] = stat.count;
      if (stat.status !== 'archived') {
        total += stat.count;
      }
    }

    // Get average progress of active plans
    const [progressResult] = await db
      .select({
        avgProgress: sql<number>`COALESCE(AVG(${developmentPlans.progressPercentage}), 0)::int`,
      })
      .from(developmentPlans)
      .where(
        and(
          eq(developmentPlans.tenantId, tenantId),
          eq(developmentPlans.status, 'active')
        )
      );

    return {
      total,
      draft: statusCounts.draft ?? 0,
      active: statusCounts.active ?? 0,
      completed: statusCounts.completed ?? 0,
      cancelled: statusCounts.cancelled ?? 0,
      archived: statusCounts.archived ?? 0,
      averageProgress: progressResult?.avgProgress ?? 0,
    };
  }),
});
