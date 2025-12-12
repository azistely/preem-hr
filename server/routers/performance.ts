/**
 * Performance Management tRPC Router
 * Complete performance management system for cycles, evaluations, objectives, feedback, and calibration
 *
 * HR-only access for management operations
 * Employee access for self-evaluation and viewing own data
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import {
  performanceCycles,
  competencies,
  jobRoleCompetencies,
  objectives,
  evaluations,
  competencyRatings,
  continuousFeedback,
  oneOnOneMeetings,
  calibrationSessions,
  calibrationRatings,
  employees,
  hrFormTemplates,
  departments,
} from '@/lib/db/schema';
import { and, eq, desc, asc, sql, gte, lte, isNull, or, inArray, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  detectCompanySize,
  applyPerformanceCycleDefaults,
  getPerformanceWizardSteps,
} from '@/lib/hr-modules/services/smart-defaults.service';

// ============================================================================
// PERFORMANCE CYCLES
// ============================================================================

export const performanceRouter = createTRPCRouter({
  /**
   * Get smart defaults for company size
   */
  getSmartDefaults: hrManagerProcedure
    .input(z.object({
      periodStart: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Count active employees
      const [{ count: employeeCount }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(and(
          eq(employees.tenantId, tenantId),
          eq(employees.status, 'active')
        ));

      const periodStart = input.periodStart ? new Date(input.periodStart) : new Date();
      const defaults = applyPerformanceCycleDefaults(employeeCount, 'CI', periodStart);
      const wizardSteps = getPerformanceWizardSteps(employeeCount);
      const companySize = detectCompanySize(employeeCount);

      return {
        employeeCount,
        companySize,
        defaults,
        wizardSteps,
      };
    }),

  /**
   * List performance cycles
   */
  cycles: createTRPCRouter({
    list: hrManagerProcedure
      .input(z.object({
        status: z.string().optional(),
        year: z.number().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(performanceCycles.tenantId, tenantId)];

        if (input.status) {
          conditions.push(eq(performanceCycles.status, input.status));
        }

        if (input.year) {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${performanceCycles.periodStart}) = ${input.year}`
          );
        }

        const cyclesList = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(...conditions))
          .orderBy(desc(performanceCycles.periodStart))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(performanceCycles)
          .where(and(...conditions));

        // Get evaluation stats per cycle
        const cycleIds = cyclesList.map(c => c.id);
        let evalStats: Record<string, { total: number; completed: number }> = {};

        if (cycleIds.length > 0) {
          const stats = await ctx.db
            .select({
              cycleId: evaluations.cycleId,
              total: sql<number>`count(*)::int`,
              completed: sql<number>`count(*) FILTER (WHERE ${evaluations.status} = 'submitted')::int`,
            })
            .from(evaluations)
            .where(inArray(evaluations.cycleId, cycleIds))
            .groupBy(evaluations.cycleId);

          evalStats = Object.fromEntries(
            stats.map(s => [s.cycleId, { total: s.total, completed: s.completed }])
          );
        }

        return {
          data: cyclesList.map(cycle => ({
            ...cycle,
            evaluationsTotal: evalStats[cycle.id]?.total ?? 0,
            evaluationsCompleted: evalStats[cycle.id]?.completed ?? 0,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    getById: hrManagerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(
            eq(performanceCycles.id, input.id),
            eq(performanceCycles.tenantId, tenantId)
          ));

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle d\'évaluation non trouvé',
          });
        }

        // Get evaluation stats
        const [evalStats] = await ctx.db
          .select({
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) FILTER (WHERE ${evaluations.status} = 'submitted')::int`,
            self: sql<number>`count(*) FILTER (WHERE ${evaluations.evaluationType} = 'self')::int`,
            manager: sql<number>`count(*) FILTER (WHERE ${evaluations.evaluationType} = 'manager')::int`,
          })
          .from(evaluations)
          .where(eq(evaluations.cycleId, input.id));

        // Get objectives count
        const [objectiveStats] = await ctx.db
          .select({
            total: sql<number>`count(*)::int`,
            achieved: sql<number>`count(*) FILTER (WHERE ${objectives.status} = 'completed')::int`,
          })
          .from(objectives)
          .where(eq(objectives.cycleId, input.id));

        return {
          ...cycle,
          stats: {
            evaluations: evalStats,
            objectives: objectiveStats,
          },
        };
      }),

    create: hrManagerProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        cycleType: z.enum(['annual', 'semi_annual', 'quarterly']).default('annual'),
        periodStart: z.string(),
        periodEnd: z.string(),
        objectiveSettingDeadline: z.string().optional(),
        selfEvaluationDeadline: z.string().optional(),
        managerEvaluationDeadline: z.string().optional(),
        calibrationDeadline: z.string().optional(),
        resultsReleaseDate: z.string().optional(),
        evaluationTemplateId: z.string().uuid().optional(),
        includeObjectives: z.boolean().default(true),
        includeSelfEvaluation: z.boolean().default(true),
        includeManagerEvaluation: z.boolean().default(true),
        includePeerFeedback: z.boolean().default(false),
        include360Feedback: z.boolean().default(false),
        includeCalibration: z.boolean().default(false),
        companySizeProfile: z.enum(['small', 'medium', 'large']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify template exists if provided
        if (input.evaluationTemplateId) {
          const [template] = await ctx.db
            .select()
            .from(hrFormTemplates)
            .where(and(
              eq(hrFormTemplates.id, input.evaluationTemplateId),
              eq(hrFormTemplates.tenantId, tenantId)
            ));

          if (!template) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Modèle d\'évaluation non trouvé',
            });
          }
        }

        const [created] = await ctx.db
          .insert(performanceCycles)
          .values({
            tenantId,
            name: input.name,
            description: input.description,
            cycleType: input.cycleType,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            objectiveSettingDeadline: input.objectiveSettingDeadline,
            selfEvaluationDeadline: input.selfEvaluationDeadline,
            managerEvaluationDeadline: input.managerEvaluationDeadline,
            calibrationDeadline: input.calibrationDeadline,
            resultsReleaseDate: input.resultsReleaseDate,
            evaluationTemplateId: input.evaluationTemplateId,
            includeObjectives: input.includeObjectives,
            includeSelfEvaluation: input.includeSelfEvaluation,
            includeManagerEvaluation: input.includeManagerEvaluation,
            includePeerFeedback: input.includePeerFeedback,
            include360Feedback: input.include360Feedback,
            includeCalibration: input.includeCalibration,
            companySizeProfile: input.companySizeProfile,
            status: 'planning',
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        objectiveSettingDeadline: z.string().nullable().optional(),
        selfEvaluationDeadline: z.string().nullable().optional(),
        managerEvaluationDeadline: z.string().nullable().optional(),
        calibrationDeadline: z.string().nullable().optional(),
        resultsReleaseDate: z.string().nullable().optional(),
        evaluationTemplateId: z.string().uuid().nullable().optional(),
        includeObjectives: z.boolean().optional(),
        includeSelfEvaluation: z.boolean().optional(),
        includeManagerEvaluation: z.boolean().optional(),
        includePeerFeedback: z.boolean().optional(),
        include360Feedback: z.boolean().optional(),
        includeCalibration: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(
            eq(performanceCycles.id, id),
            eq(performanceCycles.tenantId, tenantId)
          ));

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle d\'évaluation non trouvé',
          });
        }

        if (cycle.status === 'closed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Impossible de modifier un cycle clôturé',
          });
        }

        const [updated] = await ctx.db
          .update(performanceCycles)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(performanceCycles.id, id))
          .returning();

        return updated;
      }),

    updateStatus: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(['planning', 'objective_setting', 'active', 'calibration', 'closed']),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(
            eq(performanceCycles.id, input.id),
            eq(performanceCycles.tenantId, tenantId)
          ));

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle d\'évaluation non trouvé',
          });
        }

        const [updated] = await ctx.db
          .update(performanceCycles)
          .set({
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(performanceCycles.id, input.id))
          .returning();

        return updated;
      }),

    launch: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        employeeIds: z.array(z.string().uuid()).optional(), // Specific employees, or all active
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(
            eq(performanceCycles.id, input.id),
            eq(performanceCycles.tenantId, tenantId)
          ));

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle d\'évaluation non trouvé',
          });
        }

        if (cycle.status !== 'planning' && cycle.status !== 'objective_setting') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Le cycle doit être en phase de planification ou définition des objectifs',
          });
        }

        // Get target employees
        let targetEmployees: { id: string; reportingManagerId: string | null }[];
        if (input.employeeIds && input.employeeIds.length > 0) {
          targetEmployees = await ctx.db
            .select({ id: employees.id, reportingManagerId: employees.reportingManagerId })
            .from(employees)
            .where(and(
              eq(employees.tenantId, tenantId),
              inArray(employees.id, input.employeeIds)
            ));
        } else {
          targetEmployees = await ctx.db
            .select({ id: employees.id, reportingManagerId: employees.reportingManagerId })
            .from(employees)
            .where(and(
              eq(employees.tenantId, tenantId),
              eq(employees.status, 'active')
            ));
        }

        // Create evaluations for each employee
        const evaluationsToCreate: Array<{
          tenantId: string;
          cycleId: string;
          employeeId: string;
          evaluationType: string;
          evaluatorId: string | null;
          status: string;
        }> = [];

        for (const emp of targetEmployees) {
          // Self-evaluation
          if (cycle.includeSelfEvaluation) {
            evaluationsToCreate.push({
              tenantId,
              cycleId: cycle.id,
              employeeId: emp.id,
              evaluationType: 'self',
              evaluatorId: emp.id,
              status: 'pending',
            });
          }

          // Manager evaluation
          if (cycle.includeManagerEvaluation && emp.reportingManagerId) {
            evaluationsToCreate.push({
              tenantId,
              cycleId: cycle.id,
              employeeId: emp.id,
              evaluationType: 'manager',
              evaluatorId: emp.reportingManagerId,
              status: 'pending',
            });
          }
        }

        // Insert all evaluations
        if (evaluationsToCreate.length > 0) {
          await ctx.db.insert(evaluations).values(evaluationsToCreate);
        }

        // Update cycle status
        const [updated] = await ctx.db
          .update(performanceCycles)
          .set({
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(performanceCycles.id, input.id))
          .returning();

        return {
          cycle: updated,
          evaluationsCreated: evaluationsToCreate.length,
          employeesIncluded: targetEmployees.length,
        };
      }),

    delete: hrManagerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(and(
            eq(performanceCycles.id, input.id),
            eq(performanceCycles.tenantId, tenantId)
          ));

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle d\'évaluation non trouvé',
          });
        }

        if (cycle.status !== 'planning') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Seuls les cycles en planification peuvent être supprimés',
          });
        }

        await ctx.db
          .delete(performanceCycles)
          .where(eq(performanceCycles.id, input.id));

        return { success: true };
      }),
  }),

  // ============================================================================
  // EVALUATIONS
  // ============================================================================

  evaluations: createTRPCRouter({
    /**
     * List evaluations - HR sees all, employees see their own
     */
    list: protectedProcedure
      .input(z.object({
        cycleId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
        evaluatorId: z.string().uuid().optional(),
        evaluationType: z.enum(['self', 'manager', 'peer', '360_report']).optional(),
        status: z.enum(['pending', 'in_progress', 'submitted', 'validated', 'shared']).optional(),
        myEvaluations: z.boolean().default(false), // Evaluations I need to complete
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(evaluations.tenantId, tenantId)];

        // If user is not HR, restrict to their own evaluations
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';

        if (!isHr) {
          const employeeId = ctx.user.employeeId;
          if (!employeeId) {
            return { data: [], total: 0, hasMore: false };
          }

          // Employee can see evaluations about them or evaluations they need to complete
          conditions.push(
            or(
              eq(evaluations.employeeId, employeeId),
              eq(evaluations.evaluatorId, employeeId)
            )!
          );
        }

        if (input.cycleId) {
          conditions.push(eq(evaluations.cycleId, input.cycleId));
        }

        if (input.employeeId) {
          conditions.push(eq(evaluations.employeeId, input.employeeId));
        }

        if (input.evaluatorId) {
          conditions.push(eq(evaluations.evaluatorId, input.evaluatorId));
        }

        if (input.evaluationType) {
          conditions.push(eq(evaluations.evaluationType, input.evaluationType));
        }

        if (input.status) {
          conditions.push(eq(evaluations.status, input.status));
        }

        if (input.myEvaluations) {
          // Get evaluations the current user needs to complete
          const employeeId = ctx.user.employeeId;
          if (employeeId) {
            conditions.push(eq(evaluations.evaluatorId, employeeId));
            conditions.push(
              or(
                eq(evaluations.status, 'pending'),
                eq(evaluations.status, 'in_progress')
              )!
            );
          }
        }

        const evalsList = await ctx.db
          .select({
            evaluation: evaluations,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              employeeNumber: employees.employeeNumber,
            },
            cycle: {
              id: performanceCycles.id,
              name: performanceCycles.name,
              periodStart: performanceCycles.periodStart,
              periodEnd: performanceCycles.periodEnd,
            },
          })
          .from(evaluations)
          .leftJoin(employees, eq(evaluations.employeeId, employees.id))
          .leftJoin(performanceCycles, eq(evaluations.cycleId, performanceCycles.id))
          .where(and(...conditions))
          .orderBy(desc(evaluations.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(evaluations)
          .where(and(...conditions));

        return {
          data: evalsList.map(e => ({
            ...e.evaluation,
            employee: e.employee,
            cycle: e.cycle,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [result] = await ctx.db
          .select({
            evaluation: evaluations,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              employeeNumber: employees.employeeNumber,
              jobTitle: employees.jobTitle,
            },
            cycle: performanceCycles,
          })
          .from(evaluations)
          .leftJoin(employees, eq(evaluations.employeeId, employees.id))
          .leftJoin(performanceCycles, eq(evaluations.cycleId, performanceCycles.id))
          .where(and(
            eq(evaluations.id, input.id),
            eq(evaluations.tenantId, tenantId)
          ));

        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Évaluation non trouvée',
          });
        }

        // Get competency ratings if any
        const ratings = await ctx.db
          .select({
            rating: competencyRatings,
            competency: competencies,
          })
          .from(competencyRatings)
          .leftJoin(competencies, eq(competencyRatings.competencyId, competencies.id))
          .where(eq(competencyRatings.evaluationId, input.id));

        return {
          ...result.evaluation,
          employee: result.employee,
          cycle: result.cycle,
          competencyRatings: ratings.map(r => ({
            ...r.rating,
            competency: r.competency,
          })),
        };
      }),

    submit: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        responses: z.record(z.unknown()),
        overallScore: z.string().optional(),
        overallRating: z.string().optional(),
        strengthsComment: z.string().optional(),
        improvementAreasComment: z.string().optional(),
        developmentPlanComment: z.string().optional(),
        competencyRatings: z.array(z.object({
          competencyId: z.string().uuid(),
          rating: z.number().min(1).max(5),
          comment: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [evaluation] = await ctx.db
          .select()
          .from(evaluations)
          .where(and(
            eq(evaluations.id, input.id),
            eq(evaluations.tenantId, tenantId)
          ));

        if (!evaluation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Évaluation non trouvée',
          });
        }

        // Verify user is the evaluator
        const employeeId = ctx.user.employeeId;
        if (!employeeId || evaluation.evaluatorId !== employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous n\'êtes pas autorisé à soumettre cette évaluation',
          });
        }

        if (evaluation.status === 'submitted' || evaluation.status === 'validated' || evaluation.status === 'shared') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cette évaluation a déjà été soumise',
          });
        }

        // Update evaluation
        const [updated] = await ctx.db
          .update(evaluations)
          .set({
            responses: input.responses,
            overallScore: input.overallScore,
            overallRating: input.overallRating,
            strengthsComment: input.strengthsComment,
            improvementAreasComment: input.improvementAreasComment,
            developmentPlanComment: input.developmentPlanComment,
            status: 'submitted',
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(evaluations.id, input.id))
          .returning();

        // Add competency ratings if provided
        if (input.competencyRatings && input.competencyRatings.length > 0) {
          await ctx.db.insert(competencyRatings).values(
            input.competencyRatings.map(cr => ({
              tenantId,
              evaluationId: input.id,
              competencyId: cr.competencyId,
              rating: cr.rating,
              comment: cr.comment,
            }))
          );
        }

        return updated;
      }),

    saveDraft: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        responses: z.record(z.unknown()),
        overallScore: z.string().optional(),
        overallRating: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [evaluation] = await ctx.db
          .select()
          .from(evaluations)
          .where(and(
            eq(evaluations.id, input.id),
            eq(evaluations.tenantId, tenantId)
          ));

        if (!evaluation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Évaluation non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(evaluations)
          .set({
            responses: input.responses,
            overallScore: input.overallScore,
            overallRating: input.overallRating,
            status: 'in_progress',
            updatedAt: new Date(),
          })
          .where(eq(evaluations.id, input.id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // OBJECTIVES
  // ============================================================================

  objectives: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        cycleId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
        objectiveLevel: z.enum(['company', 'team', 'individual']).optional(),
        status: z.enum(['draft', 'proposed', 'approved', 'in_progress', 'completed', 'cancelled']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(objectives.tenantId, tenantId)];

        if (input.cycleId) {
          conditions.push(eq(objectives.cycleId, input.cycleId));
        }

        if (input.employeeId) {
          conditions.push(eq(objectives.employeeId, input.employeeId));
        }

        if (input.objectiveLevel) {
          conditions.push(eq(objectives.objectiveLevel, input.objectiveLevel));
        }

        if (input.status) {
          conditions.push(eq(objectives.status, input.status));
        }

        const objectivesList = await ctx.db
          .select({
            objective: objectives,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(objectives)
          .leftJoin(employees, eq(objectives.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(objectives.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(objectives)
          .where(and(...conditions));

        return {
          data: objectivesList.map(o => ({
            ...o.objective,
            employee: o.employee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        cycleId: z.string().uuid(),
        employeeId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        parentObjectiveId: z.string().uuid().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        objectiveLevel: z.enum(['company', 'team', 'individual']).default('individual'),
        objectiveType: z.enum(['quantitative', 'qualitative', 'behavioral', 'project']).default('quantitative'),
        weight: z.string().optional(),
        targetValue: z.string().optional(),
        targetUnit: z.string().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [created] = await ctx.db
          .insert(objectives)
          .values({
            tenantId,
            cycleId: input.cycleId,
            employeeId: input.employeeId,
            departmentId: input.departmentId,
            parentObjectiveId: input.parentObjectiveId,
            title: input.title,
            description: input.description,
            objectiveLevel: input.objectiveLevel,
            objectiveType: input.objectiveType,
            weight: input.weight,
            targetValue: input.targetValue,
            targetUnit: input.targetUnit,
            dueDate: input.dueDate,
            status: 'draft',
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        weight: z.string().optional(),
        targetValue: z.string().optional(),
        targetUnit: z.string().optional(),
        currentValue: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        status: z.enum(['draft', 'proposed', 'approved', 'in_progress', 'completed', 'cancelled']).optional(),
        achievementScore: z.string().optional(),
        achievementNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [objective] = await ctx.db
          .select()
          .from(objectives)
          .where(and(
            eq(objectives.id, id),
            eq(objectives.tenantId, tenantId)
          ));

        if (!objective) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Objectif non trouvé',
          });
        }

        const [updated] = await ctx.db
          .update(objectives)
          .set({
            ...updates,
            completedAt: updates.status === 'completed' ? new Date() : objective.completedAt,
            updatedAt: new Date(),
          })
          .where(eq(objectives.id, id))
          .returning();

        return updated;
      }),

    delete: hrManagerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [objective] = await ctx.db
          .select()
          .from(objectives)
          .where(and(
            eq(objectives.id, input.id),
            eq(objectives.tenantId, tenantId)
          ));

        if (!objective) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Objectif non trouvé',
          });
        }

        await ctx.db
          .delete(objectives)
          .where(eq(objectives.id, input.id));

        return { success: true };
      }),
  }),

  // ============================================================================
  // COMPETENCIES (Catalog)
  // ============================================================================

  competencies: createTRPCRouter({
    list: hrManagerProcedure
      .input(z.object({
        category: z.string().optional(),
        isCore: z.boolean().optional(),
        isActive: z.boolean().default(true),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(competencies.tenantId, tenantId)];

        if (input.category) {
          conditions.push(eq(competencies.category, input.category));
        }

        if (input.isCore !== undefined) {
          conditions.push(eq(competencies.isCore, input.isCore));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(competencies.isActive, input.isActive));
        }

        if (input.search) {
          conditions.push(
            or(
              sql`${competencies.name} ILIKE ${`%${input.search}%`}`,
              sql`${competencies.code} ILIKE ${`%${input.search}%`}`
            )!
          );
        }

        const competenciesList = await ctx.db
          .select()
          .from(competencies)
          .where(and(...conditions))
          .orderBy(asc(competencies.displayOrder), asc(competencies.name));

        return competenciesList;
      }),

    create: hrManagerProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().min(1),
        proficiencyLevels: z.array(z.object({
          level: z.number().min(1).max(5),
          name: z.string(),
          description: z.string(),
          behaviors: z.array(z.string()).optional(),
        })),
        isCore: z.boolean().default(false),
        displayOrder: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Check for duplicate code
        const [existing] = await ctx.db
          .select()
          .from(competencies)
          .where(and(
            eq(competencies.tenantId, tenantId),
            eq(competencies.code, input.code)
          ));

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Une compétence avec ce code existe déjà',
          });
        }

        const [created] = await ctx.db
          .insert(competencies)
          .values({
            tenantId,
            code: input.code,
            name: input.name,
            description: input.description,
            category: input.category,
            proficiencyLevels: input.proficiencyLevels,
            isCore: input.isCore,
            displayOrder: input.displayOrder,
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        proficiencyLevels: z.array(z.object({
          level: z.number().min(1).max(5),
          name: z.string(),
          description: z.string(),
          behaviors: z.array(z.string()).optional(),
        })).optional(),
        isCore: z.boolean().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [competency] = await ctx.db
          .select()
          .from(competencies)
          .where(and(
            eq(competencies.id, id),
            eq(competencies.tenantId, tenantId)
          ));

        if (!competency) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Compétence non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(competencies)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(competencies.id, id))
          .returning();

        return updated;
      }),

    getCategories: hrManagerProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      const categories = await ctx.db
        .selectDistinct({ category: competencies.category })
        .from(competencies)
        .where(eq(competencies.tenantId, tenantId))
        .orderBy(asc(competencies.category));

      return categories.map(c => c.category);
    }),
  }),

  // ============================================================================
  // CONTINUOUS FEEDBACK
  // ============================================================================

  feedback: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(),
        feedbackType: z.enum(['recognition', 'constructive', 'coaching']).optional(),
        isPrivate: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(continuousFeedback.tenantId, tenantId)];

        // Non-HR users can only see public feedback or feedback involving them
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';

        if (!isHr) {
          const employeeId = ctx.user.employeeId;
          if (employeeId) {
            conditions.push(
              or(
                eq(continuousFeedback.isPrivate, false),
                eq(continuousFeedback.employeeId, employeeId),
                eq(continuousFeedback.givenBy, ctx.user.id)
              )!
            );
          } else {
            conditions.push(eq(continuousFeedback.isPrivate, false));
          }
        }

        if (input.employeeId) {
          conditions.push(eq(continuousFeedback.employeeId, input.employeeId));
        }

        if (input.feedbackType) {
          conditions.push(eq(continuousFeedback.feedbackType, input.feedbackType));
        }

        if (input.isPrivate !== undefined) {
          conditions.push(eq(continuousFeedback.isPrivate, input.isPrivate));
        }

        const feedbackList = await ctx.db
          .select({
            feedback: continuousFeedback,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(continuousFeedback)
          .leftJoin(employees, eq(continuousFeedback.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(continuousFeedback.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(continuousFeedback)
          .where(and(...conditions));

        return {
          data: feedbackList.map(f => ({
            ...f.feedback,
            employee: f.employee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid(),
        feedbackType: z.enum(['recognition', 'constructive', 'coaching']),
        title: z.string().optional(),
        content: z.string().min(1),
        tags: z.array(z.string()).optional(),
        isPrivate: z.boolean().default(false),
        isAnonymous: z.boolean().default(false),
        cycleId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify recipient exists
        const [recipient] = await ctx.db
          .select()
          .from(employees)
          .where(and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, tenantId)
          ));

        if (!recipient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employé destinataire non trouvé',
          });
        }

        const [created] = await ctx.db
          .insert(continuousFeedback)
          .values({
            tenantId,
            employeeId: input.employeeId,
            givenBy: ctx.user.id,
            feedbackType: input.feedbackType,
            title: input.title,
            content: input.content,
            tags: input.tags ?? [],
            isPrivate: input.isPrivate,
            isAnonymous: input.isAnonymous,
            cycleId: input.cycleId,
          })
          .returning();

        return created;
      }),
  }),

  // ============================================================================
  // ONE-ON-ONE MEETINGS
  // ============================================================================

  oneOnOnes: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(),
        managerId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(oneOnOneMeetings.tenantId, tenantId)];

        // Non-HR can only see their own meetings
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';

        if (!isHr) {
          const employeeId = ctx.user.employeeId;
          if (employeeId) {
            conditions.push(
              or(
                eq(oneOnOneMeetings.employeeId, employeeId),
                eq(oneOnOneMeetings.managerId, employeeId)
              )!
            );
          } else {
            return { data: [], total: 0, hasMore: false };
          }
        }

        if (input.employeeId) {
          conditions.push(eq(oneOnOneMeetings.employeeId, input.employeeId));
        }

        if (input.managerId) {
          conditions.push(eq(oneOnOneMeetings.managerId, input.managerId));
        }

        if (input.status) {
          conditions.push(eq(oneOnOneMeetings.status, input.status));
        }

        if (input.dateFrom) {
          conditions.push(gte(oneOnOneMeetings.meetingDate, input.dateFrom));
        }

        if (input.dateTo) {
          conditions.push(lte(oneOnOneMeetings.meetingDate, input.dateTo));
        }

        const meetingsList = await ctx.db
          .select({
            meeting: oneOnOneMeetings,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(oneOnOneMeetings)
          .leftJoin(employees, eq(oneOnOneMeetings.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(oneOnOneMeetings.meetingDate))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(oneOnOneMeetings)
          .where(and(...conditions));

        return {
          data: meetingsList.map(m => ({
            ...m.meeting,
            employee: m.employee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid(),
        meetingDate: z.string(),
        duration: z.number().min(15).max(240).default(30),
        agendaItems: z.array(z.object({
          topic: z.string(),
          completed: z.boolean().default(false),
        })).optional(),
        cycleId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get manager employee ID (current user)
        const employeeId = ctx.user.employeeId;

        if (!employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous devez être un employé pour planifier un 1:1',
          });
        }

        const [created] = await ctx.db
          .insert(oneOnOneMeetings)
          .values({
            tenantId,
            employeeId: input.employeeId,
            managerId: employeeId,
            meetingDate: input.meetingDate,
            duration: input.duration,
            agendaItems: input.agendaItems ?? [],
            cycleId: input.cycleId,
            status: 'scheduled',
          })
          .returning();

        return created;
      }),

    complete: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        notes: z.string(),
        actionItems: z.array(z.object({
          description: z.string(),
          assignee: z.enum(['employee', 'manager']),
          dueDate: z.string().optional(),
          completed: z.boolean().default(false),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [meeting] = await ctx.db
          .select()
          .from(oneOnOneMeetings)
          .where(and(
            eq(oneOnOneMeetings.id, input.id),
            eq(oneOnOneMeetings.tenantId, tenantId)
          ));

        if (!meeting) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Réunion non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(oneOnOneMeetings)
          .set({
            notes: input.notes,
            actionItems: input.actionItems ?? [],
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(oneOnOneMeetings.id, input.id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // CALIBRATION (Large companies)
  // ============================================================================

  calibration: createTRPCRouter({
    sessions: createTRPCRouter({
      list: hrManagerProcedure
        .input(z.object({
          cycleId: z.string().uuid().optional(),
          status: z.enum(['scheduled', 'in_progress', 'completed']).optional(),
        }))
        .query(async ({ ctx, input }) => {
          const tenantId = ctx.user.tenantId;
          const conditions = [eq(calibrationSessions.tenantId, tenantId)];

          if (input.cycleId) {
            conditions.push(eq(calibrationSessions.cycleId, input.cycleId));
          }

          if (input.status) {
            conditions.push(eq(calibrationSessions.status, input.status));
          }

          const sessionsList = await ctx.db
            .select({
              session: calibrationSessions,
              cycle: {
                id: performanceCycles.id,
                name: performanceCycles.name,
              },
            })
            .from(calibrationSessions)
            .leftJoin(performanceCycles, eq(calibrationSessions.cycleId, performanceCycles.id))
            .where(and(...conditions))
            .orderBy(desc(calibrationSessions.sessionDate));

          return sessionsList.map(s => ({
            ...s.session,
            cycle: s.cycle,
          }));
        }),

      create: hrManagerProcedure
        .input(z.object({
          cycleId: z.string().uuid(),
          name: z.string().min(1),
          description: z.string().optional(),
          sessionDate: z.string().optional(),
          scope: z.object({
            departmentIds: z.array(z.string().uuid()).optional(),
            employeeIds: z.array(z.string().uuid()).optional(),
          }).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const tenantId = ctx.user.tenantId;

          const [created] = await ctx.db
            .insert(calibrationSessions)
            .values({
              tenantId,
              cycleId: input.cycleId,
              name: input.name,
              description: input.description,
              sessionDate: input.sessionDate,
              scope: input.scope ?? {},
              status: 'scheduled',
              createdBy: ctx.user.id,
            })
            .returning();

          return created;
        }),
    }),

    ratings: createTRPCRouter({
      list: hrManagerProcedure
        .input(z.object({
          calibrationSessionId: z.string().uuid(),
        }))
        .query(async ({ ctx, input }) => {
          const tenantId = ctx.user.tenantId;

          // Join calibration ratings with evaluations to get employee info
          const ratingsList = await ctx.db
            .select({
              rating: calibrationRatings,
              evaluation: evaluations,
              employee: {
                id: employees.id,
                firstName: employees.firstName,
                lastName: employees.lastName,
                jobTitle: employees.jobTitle,
              },
            })
            .from(calibrationRatings)
            .leftJoin(evaluations, eq(calibrationRatings.evaluationId, evaluations.id))
            .leftJoin(employees, eq(evaluations.employeeId, employees.id))
            .where(and(
              eq(calibrationRatings.calibrationSessionId, input.calibrationSessionId),
              eq(calibrationRatings.tenantId, tenantId)
            ));

          return ratingsList.map(r => ({
            ...r.rating,
            evaluation: r.evaluation,
            employee: r.employee,
          }));
        }),

      update: hrManagerProcedure
        .input(z.object({
          calibrationSessionId: z.string().uuid(),
          evaluationId: z.string().uuid(),
          performanceAxis: z.number().min(1).max(3), // 1-3 for 9-box grid
          potentialAxis: z.number().min(1).max(3), // 1-3 for 9-box grid
          calibratedRating: z.string(),
          justification: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const tenantId = ctx.user.tenantId;

          // First get original rating from evaluation
          const evaluation = await ctx.db
            .select()
            .from(evaluations)
            .where(and(
              eq(evaluations.id, input.evaluationId),
              eq(evaluations.tenantId, tenantId)
            ))
            .limit(1);

          const originalRating = evaluation[0]?.overallScore?.toString() ?? '';

          // Upsert calibration rating
          const existing = await ctx.db
            .select()
            .from(calibrationRatings)
            .where(and(
              eq(calibrationRatings.calibrationSessionId, input.calibrationSessionId),
              eq(calibrationRatings.evaluationId, input.evaluationId),
              eq(calibrationRatings.tenantId, tenantId)
            ))
            .limit(1);

          if (existing.length > 0) {
            const [updated] = await ctx.db
              .update(calibrationRatings)
              .set({
                calibratedRating: input.calibratedRating,
                performanceAxis: input.performanceAxis,
                potentialAxis: input.potentialAxis,
                justification: input.justification,
              })
              .where(eq(calibrationRatings.id, existing[0].id))
              .returning();

            return updated;
          } else {
            const [created] = await ctx.db
              .insert(calibrationRatings)
              .values({
                tenantId,
                calibrationSessionId: input.calibrationSessionId,
                evaluationId: input.evaluationId,
                originalRating,
                calibratedRating: input.calibratedRating,
                performanceAxis: input.performanceAxis,
                potentialAxis: input.potentialAxis,
                justification: input.justification,
                calibratedBy: ctx.user.id,
              })
              .returning();

            return created;
          }
        }),
    }),
  }),

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  dashboard: createTRPCRouter({
    stats: hrManagerProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Active cycles
      const [activeCycles] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceCycles)
        .where(and(
          eq(performanceCycles.tenantId, tenantId),
          eq(performanceCycles.status, 'active')
        ));

      // Pending evaluations
      const [pendingEvaluations] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(evaluations)
        .where(and(
          eq(evaluations.tenantId, tenantId),
          or(
            eq(evaluations.status, 'pending'),
            eq(evaluations.status, 'in_progress')
          )
        ));

      // Completed evaluations this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [completedThisMonth] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(evaluations)
        .where(and(
          eq(evaluations.tenantId, tenantId),
          eq(evaluations.status, 'submitted'),
          gte(evaluations.submittedAt, startOfMonth)
        ));

      // Active objectives
      const [activeObjectives] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(objectives)
        .where(and(
          eq(objectives.tenantId, tenantId),
          eq(objectives.status, 'in_progress')
        ));

      // Feedback this month
      const [feedbackThisMonth] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(continuousFeedback)
        .where(and(
          eq(continuousFeedback.tenantId, tenantId),
          gte(continuousFeedback.createdAt, startOfMonth)
        ));

      return {
        activeCycles: activeCycles.count,
        pendingEvaluations: pendingEvaluations.count,
        completedThisMonth: completedThisMonth.count,
        activeObjectives: activeObjectives.count,
        feedbackThisMonth: feedbackThisMonth.count,
      };
    }),

    myPendingTasks: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;
      const employeeId = ctx.user.employeeId;

      if (!employeeId) {
        return { pendingEvaluations: [], upcomingOneOnOnes: [], overdueObjectives: [] };
      }

      // Pending evaluations to complete
      const pendingEvaluations = await ctx.db
        .select({
          evaluation: evaluations,
          employee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
          cycle: {
            name: performanceCycles.name,
          },
        })
        .from(evaluations)
        .leftJoin(employees, eq(evaluations.employeeId, employees.id))
        .leftJoin(performanceCycles, eq(evaluations.cycleId, performanceCycles.id))
        .where(and(
          eq(evaluations.tenantId, tenantId),
          eq(evaluations.evaluatorId, employeeId),
          or(
            eq(evaluations.status, 'pending'),
            eq(evaluations.status, 'in_progress')
          )
        ))
        .limit(5);

      // Upcoming 1:1s
      const upcomingOneOnOnes = await ctx.db
        .select({
          meeting: oneOnOneMeetings,
          employee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(oneOnOneMeetings)
        .leftJoin(employees, eq(oneOnOneMeetings.employeeId, employees.id))
        .where(and(
          eq(oneOnOneMeetings.tenantId, tenantId),
          eq(oneOnOneMeetings.managerId, employeeId),
          eq(oneOnOneMeetings.status, 'scheduled'),
          gte(oneOnOneMeetings.meetingDate, new Date().toISOString().split('T')[0])
        ))
        .orderBy(asc(oneOnOneMeetings.meetingDate))
        .limit(5);

      // Overdue objectives
      const overdueObjectives = await ctx.db
        .select()
        .from(objectives)
        .where(and(
          eq(objectives.tenantId, tenantId),
          eq(objectives.employeeId, employeeId),
          eq(objectives.status, 'in_progress'),
          lte(objectives.dueDate, new Date().toISOString().split('T')[0])
        ))
        .limit(5);

      return {
        pendingEvaluations: pendingEvaluations.map(e => ({
          ...e.evaluation,
          employee: e.employee,
          cycleName: e.cycle?.name,
        })),
        upcomingOneOnOnes: upcomingOneOnOnes.map(m => ({
          ...m.meeting,
          employee: m.employee,
        })),
        overdueObjectives,
      };
    }),
  }),
});
