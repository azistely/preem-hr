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
  objectiveEvaluationScores,
  continuousFeedback,
  oneOnOneMeetings,
  calibrationSessions,
  calibrationRatings,
  employees,
  hrFormTemplates,
  departments,
  tenants,
} from '@/lib/db/schema';
import { positions } from '@/lib/db/schema/positions';
import { assignments } from '@/lib/db/schema/assignments';
import { and, eq, desc, asc, sql, gte, lte, isNull, or, inArray, count, type SQL } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  detectCompanySize,
  applyPerformanceCycleDefaults,
  getPerformanceWizardSteps,
} from '@/lib/hr-modules/services/smart-defaults.service';
import {
  getCompetencyScale,
  normalizeScore,
  getMaxLevel,
  DEFAULT_SCALE_TYPE,
  type ProficiencyLevel,
} from '@/lib/constants/competency-scales';
import type { CompetencyScaleType, TenantSettings } from '@/lib/db/schema/tenant-settings.schema';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get employee's current active position from assignments table
 * Returns the primary assignment position that is currently active
 */
async function getEmployeeCurrentPosition(
  db: typeof import('@/lib/db').db,
  employeeId: string,
  tenantId: string
) {
  const today = new Date().toISOString().split('T')[0];

  const [assignment] = await db
    .select({
      position: positions,
    })
    .from(assignments)
    .innerJoin(positions, eq(assignments.positionId, positions.id))
    .where(and(
      eq(assignments.employeeId, employeeId),
      eq(assignments.tenantId, tenantId),
      eq(assignments.assignmentType, 'primary'),
      lte(assignments.effectiveFrom, today),
      or(isNull(assignments.effectiveTo), gte(assignments.effectiveTo, today))
    ))
    .limit(1);

  return assignment?.position ?? null;
}

/**
 * Get competencies assigned to a position through jobRoleCompetencies table
 * Returns competencies with required level and critical flag
 */
async function getPositionCompetencies(
  db: typeof import('@/lib/db').db,
  positionId: string,
  tenantId: string
) {
  const results = await db
    .select({
      competency: competencies,
      requiredLevel: jobRoleCompetencies.requiredLevel,
      isCritical: jobRoleCompetencies.isCritical,
    })
    .from(jobRoleCompetencies)
    .innerJoin(competencies, eq(jobRoleCompetencies.competencyId, competencies.id))
    .where(and(
      eq(jobRoleCompetencies.positionId, positionId),
      eq(jobRoleCompetencies.tenantId, tenantId),
      eq(competencies.isActive, true)
    ))
    .orderBy(competencies.displayOrder);

  return results;
}

/**
 * Get tenant's default competency scale from settings
 */
async function getTenantDefaultScale(
  db: typeof import('@/lib/db').db,
  tenantId: string
): Promise<CompetencyScaleType> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const settings = tenant?.settings as TenantSettings | null;
  return settings?.performance?.defaultCompetencyScale ?? DEFAULT_SCALE_TYPE;
}

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
        // Template assignments by department/position (overrides default)
        templateAssignments: z.array(z.object({
          departmentId: z.string().uuid().optional(),
          positionId: z.string().uuid().optional(),
          evaluationType: z.enum(['self', 'manager']),
          templateId: z.string().uuid(),
        })).optional(),
        includeObjectives: z.boolean().default(true),
        includeSelfEvaluation: z.boolean().default(true),
        includeManagerEvaluation: z.boolean().default(true),
        includePeerFeedback: z.boolean().default(false),
        include360Feedback: z.boolean().default(false),
        includeCompetencies: z.boolean().default(true),
        includeCalibration: z.boolean().default(false),
        companySizeProfile: z.enum(['small', 'medium', 'large']).optional(),
        // Custom/quick questions specific to this cycle
        customQuestions: z.array(z.object({
          id: z.string(),
          question: z.string().min(1),
          type: z.enum(['rating', 'text', 'textarea', 'select']),
          required: z.boolean(),
          options: z.array(z.string()).optional(),
          helpText: z.string().optional(),
          appliesTo: z.enum(['self', 'manager', 'both']),
        })).optional(),
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
            templateAssignments: input.templateAssignments ?? null,
            includeObjectives: input.includeObjectives,
            includeSelfEvaluation: input.includeSelfEvaluation,
            includeManagerEvaluation: input.includeManagerEvaluation,
            includePeerFeedback: input.includePeerFeedback,
            include360Feedback: input.include360Feedback,
            includeCompetencies: input.includeCompetencies,
            includeCalibration: input.includeCalibration,
            companySizeProfile: input.companySizeProfile,
            customQuestions: input.customQuestions,
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
        // Template assignments by department/position (overrides default)
        templateAssignments: z.array(z.object({
          departmentId: z.string().uuid().optional(),
          positionId: z.string().uuid().optional(),
          evaluationType: z.enum(['self', 'manager']),
          templateId: z.string().uuid(),
        })).nullable().optional(),
        // Custom/quick questions specific to this cycle
        customQuestions: z.array(z.object({
          id: z.string(),
          question: z.string().min(1),
          type: z.enum(['rating', 'text', 'textarea', 'select']),
          required: z.boolean(),
          options: z.array(z.string()).optional(),
          helpText: z.string().optional(),
          appliesTo: z.enum(['self', 'manager', 'both']),
        })).nullable().optional(),
        includeObjectives: z.boolean().optional(),
        includeSelfEvaluation: z.boolean().optional(),
        includeManagerEvaluation: z.boolean().optional(),
        includePeerFeedback: z.boolean().optional(),
        include360Feedback: z.boolean().optional(),
        includeCompetencies: z.boolean().optional(),
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

        // Enforce: objectives must exist before launch if includeObjectives is enabled
        if (cycle.includeObjectives) {
          const [objectiveCount] = await ctx.db
            .select({ count: count() })
            .from(objectives)
            .where(and(
              eq(objectives.tenantId, tenantId),
              eq(objectives.cycleId, cycle.id)
            ));

          if (objectiveCount.count === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Vous devez définir au moins un objectif avant de lancer le cycle. Les objectifs sont requis car "Inclure les objectifs" est activé.',
            });
          }
        }

        // Get target employees with their position and department info for template resolution
        let targetEmployees: {
          id: string;
          reportingManagerId: string | null;
          departmentId: string | null;
          positionId: string | null;
        }[];

        if (input.employeeIds && input.employeeIds.length > 0) {
          // Fetch specific employees with their current position via assignments
          // Department is on positions table, not employees
          const employeesWithPositions = await ctx.db
            .select({
              id: employees.id,
              reportingManagerId: employees.reportingManagerId,
              positionId: assignments.positionId,
              departmentId: positions.departmentId,
            })
            .from(employees)
            .leftJoin(assignments, and(
              eq(assignments.employeeId, employees.id),
              eq(assignments.assignmentType, 'primary'),
              lte(assignments.effectiveFrom, sql`CURRENT_DATE`),
              or(
                isNull(assignments.effectiveTo),
                gte(assignments.effectiveTo, sql`CURRENT_DATE`)
              )
            ))
            .leftJoin(positions, eq(positions.id, assignments.positionId))
            .where(and(
              eq(employees.tenantId, tenantId),
              inArray(employees.id, input.employeeIds)
            ));
          targetEmployees = employeesWithPositions;
        } else {
          // Fetch all active employees with their current position
          // Department is on positions table, not employees
          const employeesWithPositions = await ctx.db
            .select({
              id: employees.id,
              reportingManagerId: employees.reportingManagerId,
              positionId: assignments.positionId,
              departmentId: positions.departmentId,
            })
            .from(employees)
            .leftJoin(assignments, and(
              eq(assignments.employeeId, employees.id),
              eq(assignments.assignmentType, 'primary'),
              lte(assignments.effectiveFrom, sql`CURRENT_DATE`),
              or(
                isNull(assignments.effectiveTo),
                gte(assignments.effectiveTo, sql`CURRENT_DATE`)
              )
            ))
            .leftJoin(positions, eq(positions.id, assignments.positionId))
            .where(and(
              eq(employees.tenantId, tenantId),
              eq(employees.status, 'active')
            ));
          targetEmployees = employeesWithPositions;
        }

        // Helper function to resolve template for an employee based on assignments
        const resolveTemplateForEmployee = (
          emp: { departmentId: string | null; positionId: string | null },
          evaluationType: 'self' | 'manager' | 'peer' | '360'
        ): string | null => {
          const assignments = cycle.templateAssignments as Array<{
            departmentId?: string;
            positionId?: string;
            evaluationType: 'self' | 'manager' | 'peer' | '360';
            templateId: string;
          }> | null;

          if (!assignments || assignments.length === 0) {
            // Fall back to cycle default template
            return cycle.evaluationTemplateId;
          }

          // Priority 1: Position-specific + evaluation type match
          if (emp.positionId) {
            const positionMatch = assignments.find(
              a => a.positionId === emp.positionId && a.evaluationType === evaluationType
            );
            if (positionMatch) return positionMatch.templateId;
          }

          // Priority 2: Department-specific + evaluation type match
          if (emp.departmentId) {
            const deptMatch = assignments.find(
              a => a.departmentId === emp.departmentId && a.evaluationType === evaluationType
            );
            if (deptMatch) return deptMatch.templateId;
          }

          // Priority 3: Evaluation type only (no dept/position specified)
          const typeOnlyMatch = assignments.find(
            a => !a.departmentId && !a.positionId && a.evaluationType === evaluationType
          );
          if (typeOnlyMatch) return typeOnlyMatch.templateId;

          // Fall back to cycle default template
          return cycle.evaluationTemplateId;
        };

        // Create evaluations for each employee
        const evaluationsToCreate: Array<{
          tenantId: string;
          cycleId: string;
          employeeId: string;
          evaluationType: string;
          evaluatorId: string | null;
          templateId: string | null;
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
              templateId: resolveTemplateForEmployee(emp, 'self'),
              status: 'pending',
            });
          }

          // Manager evaluation - create for ALL employees (even without reporting manager)
          // If no reportingManagerId, set evaluatorId to null - HR managers/admins can evaluate
          if (cycle.includeManagerEvaluation) {
            evaluationsToCreate.push({
              tenantId,
              cycleId: cycle.id,
              employeeId: emp.id,
              evaluationType: 'manager',
              evaluatorId: emp.reportingManagerId, // Can be null - HR/admins can evaluate
              templateId: resolveTemplateForEmployee(emp, 'manager'),
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

        // Get competency ratings if any (existing ratings for this evaluation)
        const existingRatings = await ctx.db
          .select({
            rating: competencyRatings,
            competency: competencies,
          })
          .from(competencyRatings)
          .leftJoin(competencies, eq(competencyRatings.competencyId, competencies.id))
          .where(eq(competencyRatings.evaluationId, input.id));

        // Load position competencies if cycle has includeCompetencies enabled
        let positionCompetencies: Array<{
          competency: typeof competencies.$inferSelect;
          requiredLevel: number;
          isCritical: boolean;
          proficiencyLevels: ProficiencyLevel[];
        }> = [];
        let selfCompetencyRatings: typeof existingRatings = [];

        if (result.cycle?.includeCompetencies && result.evaluation.employeeId) {
          // Get employee's current position
          const position = await getEmployeeCurrentPosition(ctx.db, result.evaluation.employeeId, tenantId);

          if (position) {
            // Get competencies for this position
            const rawCompetencies = await getPositionCompetencies(ctx.db, position.id, tenantId);

            // Get tenant's default scale for resolving competency scales
            const tenantDefaultScale = await getTenantDefaultScale(ctx.db, tenantId);

            // Resolve proficiency levels for each competency
            positionCompetencies = rawCompetencies.map(pc => ({
              competency: pc.competency,
              requiredLevel: pc.requiredLevel,
              isCritical: pc.isCritical,
              proficiencyLevels: getCompetencyScale(
                {
                  scaleType: pc.competency.scaleType,
                  proficiencyLevels: pc.competency.proficiencyLevels as ProficiencyLevel[] | null,
                },
                tenantDefaultScale
              ),
            }));
          }

          // For manager evaluations, also get self-evaluation competency ratings for comparison
          if (result.evaluation.evaluationType === 'manager' && result.evaluation.cycleId) {
            const [selfEval] = await ctx.db
              .select({ id: evaluations.id })
              .from(evaluations)
              .where(and(
                eq(evaluations.tenantId, tenantId),
                eq(evaluations.employeeId, result.evaluation.employeeId),
                eq(evaluations.cycleId, result.evaluation.cycleId),
                eq(evaluations.evaluationType, 'self')
              ));

            if (selfEval) {
              selfCompetencyRatings = await ctx.db
                .select({
                  rating: competencyRatings,
                  competency: competencies,
                })
                .from(competencyRatings)
                .leftJoin(competencies, eq(competencyRatings.competencyId, competencies.id))
                .where(eq(competencyRatings.evaluationId, selfEval.id));
            }
          }
        }

        // Get objectives for this employee in this cycle
        // Include: individual objectives, team objectives (filtered by dept/position), company objectives

        // Get employee's current position for team objective filtering
        let employeePosition: { id: string; departmentId: string | null } | null = null;
        if (result.evaluation.employeeId) {
          const pos = await getEmployeeCurrentPosition(ctx.db, result.evaluation.employeeId, tenantId);
          if (pos) {
            employeePosition = { id: pos.id, departmentId: pos.departmentId };
          }
        }

        // Build conditions for objectives:
        // 1. Individual objectives for this employee
        // 2. Team objectives matching employee's department OR position
        // 3. Company-wide objectives
        const objectiveConditions = [
          eq(objectives.tenantId, tenantId),
          eq(objectives.cycleId, result.evaluation.cycleId!),
        ];

        // Build team objective conditions based on employee's position/department
        const teamObjectiveConditions: SQL[] = [];

        if (employeePosition) {
          // Legacy single departmentId match
          if (employeePosition.departmentId) {
            teamObjectiveConditions.push(
              and(
                eq(objectives.objectiveLevel, 'team'),
                eq(objectives.departmentId, employeePosition.departmentId)
              )!
            );
            // New: targetDepartmentIds array contains employee's department
            teamObjectiveConditions.push(
              and(
                eq(objectives.objectiveLevel, 'team'),
                sql`${objectives.targetDepartmentIds} @> ${JSON.stringify([employeePosition.departmentId])}::jsonb`
              )!
            );
          }
          // New: targetPositionIds array contains employee's position
          teamObjectiveConditions.push(
            and(
              eq(objectives.objectiveLevel, 'team'),
              sql`${objectives.targetPositionIds} @> ${JSON.stringify([employeePosition.id])}::jsonb`
            )!
          );
        }

        // If no position found, include all team objectives (fallback)
        if (teamObjectiveConditions.length === 0) {
          teamObjectiveConditions.push(eq(objectives.objectiveLevel, 'team'));
        }

        const employeeObjectives = await ctx.db
          .select({
            id: objectives.id,
            title: objectives.title,
            description: objectives.description,
            objectiveLevel: objectives.objectiveLevel,
            objectiveType: objectives.objectiveType,
            status: objectives.status,
            weight: objectives.weight,
            targetValue: objectives.targetValue,
            currentValue: objectives.currentValue,
            targetUnit: objectives.targetUnit,
            dueDate: objectives.dueDate,
            achievementScore: objectives.achievementScore,
            achievementNotes: objectives.achievementNotes,
          })
          .from(objectives)
          .where(and(
            ...objectiveConditions,
            or(
              // Individual objectives for this employee
              and(
                eq(objectives.objectiveLevel, 'individual'),
                eq(objectives.employeeId, result.evaluation.employeeId!)
              ),
              // Team objectives matching employee's dept/position
              ...teamObjectiveConditions,
              // Company-wide objectives
              eq(objectives.objectiveLevel, 'company')
            )
          ))
          .orderBy(
            asc(objectives.objectiveLevel), // company first, then team, then individual
            desc(objectives.weight)
          );

        // Get objective scores for THIS evaluation
        const thisEvalScores = await ctx.db
          .select()
          .from(objectiveEvaluationScores)
          .where(eq(objectiveEvaluationScores.evaluationId, input.id));

        // For manager evaluations, also get the self-evaluation scores for comparison
        let selfEvalScores: typeof thisEvalScores = [];
        if (result.evaluation.evaluationType === 'manager' && result.evaluation.employeeId && result.evaluation.cycleId) {
          // Find the self-evaluation for this employee in this cycle
          const [selfEval] = await ctx.db
            .select({ id: evaluations.id })
            .from(evaluations)
            .where(and(
              eq(evaluations.tenantId, tenantId),
              eq(evaluations.employeeId, result.evaluation.employeeId),
              eq(evaluations.cycleId, result.evaluation.cycleId),
              eq(evaluations.evaluationType, 'self')
            ));

          if (selfEval) {
            selfEvalScores = await ctx.db
              .select()
              .from(objectiveEvaluationScores)
              .where(eq(objectiveEvaluationScores.evaluationId, selfEval.id));
          }
        }

        // Map scores to objectives for easy lookup
        const objectiveScoresMap = new Map(thisEvalScores.map(s => [s.objectiveId, { score: s.score, comment: s.comment }]));
        const selfScoresMap = new Map(selfEvalScores.map(s => [s.objectiveId, { score: s.score, comment: s.comment }]));

        // Map existing competency ratings by competencyId for easy lookup
        const existingRatingsMap = new Map(existingRatings.map(r => [r.rating.competencyId, r]));
        const selfCompetencyRatingsMap = new Map(selfCompetencyRatings.map(r => [r.rating.competencyId, r]));

        return {
          ...result.evaluation,
          employee: result.employee,
          cycle: result.cycle,
          // Existing competency ratings for this evaluation
          competencyRatings: existingRatings.map(r => ({
            ...r.rating,
            competency: r.competency,
          })),
          // Position competencies (what employee should be evaluated on)
          positionCompetencies: positionCompetencies.map(pc => ({
            competency: pc.competency,
            requiredLevel: pc.requiredLevel,
            isCritical: pc.isCritical,
            proficiencyLevels: pc.proficiencyLevels,
            // Include existing rating if any
            existingRating: existingRatingsMap.get(pc.competency.id)?.rating ?? null,
            // Include self-rating for manager evaluations
            selfRating: selfCompetencyRatingsMap.get(pc.competency.id)?.rating ?? null,
          })),
          objectives: employeeObjectives,
          // Objective scores for this evaluation
          objectiveScores: thisEvalScores.map(s => ({
            objectiveId: s.objectiveId,
            score: parseFloat(s.score),
            comment: s.comment,
          })),
          // Self-evaluation scores (only for manager evaluations)
          selfEvalObjectiveScores: selfEvalScores.map(s => ({
            objectiveId: s.objectiveId,
            score: parseFloat(s.score),
            comment: s.comment,
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
          rating: z.number().min(0).max(100), // 0-100 for percentage scales, 1-10 for others
          comment: z.string().optional(),
          expectedLevel: z.number().optional(), // From position competency mapping
          maxLevel: z.number().min(1).default(5), // Max level of the scale for normalization
        })).optional(),
        objectiveScores: z.array(z.object({
          objectiveId: z.string().uuid(),
          score: z.number().min(0).max(100),
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

        // Verify user is authorized to submit:
        // - The evaluator themselves (employeeId matches)
        // - HR managers/admins can submit any evaluation in their tenant
        const employeeId = ctx.user.employeeId;
        const userRole = ctx.user.role;
        const isEvaluator = employeeId && evaluation.evaluatorId === employeeId;
        const isHROrAdmin = userRole === 'super_admin' || userRole === 'tenant_admin' || userRole === 'hr_manager';

        if (!isEvaluator && !isHROrAdmin) {
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

        // Handle competency ratings if provided
        if (input.competencyRatings && input.competencyRatings.length > 0) {
          // Delete existing ratings first (allows re-submit/draft save)
          await ctx.db
            .delete(competencyRatings)
            .where(eq(competencyRatings.evaluationId, input.id));

          // Insert new competency ratings
          await ctx.db.insert(competencyRatings).values(
            input.competencyRatings.map(cr => ({
              tenantId,
              evaluationId: input.id,
              competencyId: cr.competencyId,
              rating: cr.rating,
              comment: cr.comment,
              expectedLevel: cr.expectedLevel, // For gap analysis
            }))
          );

          // Calculate normalized competencies score (0-100)
          // Each rating is normalized based on its scale's max level
          const normalizedScores = input.competencyRatings.map(cr => {
            const maxLevel = cr.maxLevel || 5;
            // For percentage scales (maxLevel=100), rating is already 0-100
            if (maxLevel === 100) {
              return cr.rating;
            }
            // For discrete scales, normalize to 0-100
            return normalizeScore(cr.rating, maxLevel);
          });

          const avgNormalizedScore = normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length;

          // Update competenciesScore on the evaluation (numeric type expects string)
          await ctx.db
            .update(evaluations)
            .set({ competenciesScore: (Math.round(avgNormalizedScore * 100) / 100).toString() }) // Round to 2 decimals
            .where(eq(evaluations.id, input.id));
        }

        // Save objective scores to separate table (allows self vs manager scores to coexist)
        if (input.objectiveScores && input.objectiveScores.length > 0) {
          // First, delete any existing scores for this evaluation (in case of re-submit/draft save)
          await ctx.db
            .delete(objectiveEvaluationScores)
            .where(eq(objectiveEvaluationScores.evaluationId, input.id));

          // Insert new scores
          await ctx.db.insert(objectiveEvaluationScores).values(
            input.objectiveScores.map(score => ({
              tenantId,
              evaluationId: input.id,
              objectiveId: score.objectiveId,
              score: score.score.toString(),
              comment: score.comment,
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

    // Validate evaluations (HR action - move from submitted to validated)
    validate: protectedProcedure
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const userRole = ctx.user.role;

        // Check user has HR permissions (admin, tenant_admin, or hr_manager)
        if (!['super_admin', 'tenant_admin', 'hr_manager', 'admin'].includes(userRole ?? '')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Seuls les responsables RH peuvent valider les évaluations',
          });
        }

        // Verify all evaluations exist and are in submitted status
        const evaluationsList = await ctx.db
          .select()
          .from(evaluations)
          .where(and(
            eq(evaluations.tenantId, tenantId),
            inArray(evaluations.id, input.ids)
          ));

        if (evaluationsList.length !== input.ids.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certaines évaluations n\'ont pas été trouvées',
          });
        }

        const notSubmitted = evaluationsList.filter(e => e.status !== 'submitted');
        if (notSubmitted.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${notSubmitted.length} évaluation(s) ne sont pas en attente de validation`,
          });
        }

        // Update all to validated
        await ctx.db
          .update(evaluations)
          .set({
            status: 'validated',
            updatedAt: new Date(),
          })
          .where(and(
            eq(evaluations.tenantId, tenantId),
            inArray(evaluations.id, input.ids)
          ));

        return { success: true, count: input.ids.length };
      }),

    // Share evaluations (HR action - move from validated to shared, notifies employees)
    share: protectedProcedure
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const userRole = ctx.user.role;

        // Check user has HR permissions
        if (!['super_admin', 'tenant_admin', 'hr_manager', 'admin'].includes(userRole ?? '')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Seuls les responsables RH peuvent partager les évaluations',
          });
        }

        // Verify all evaluations exist and are in validated status
        const evaluationsList = await ctx.db
          .select({
            evaluation: evaluations,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              email: employees.email,
            },
          })
          .from(evaluations)
          .innerJoin(employees, eq(evaluations.employeeId, employees.id))
          .where(and(
            eq(evaluations.tenantId, tenantId),
            inArray(evaluations.id, input.ids)
          ));

        if (evaluationsList.length !== input.ids.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certaines évaluations n\'ont pas été trouvées',
          });
        }

        const notValidated = evaluationsList.filter(e => e.evaluation.status !== 'validated');
        if (notValidated.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${notValidated.length} évaluation(s) ne sont pas validées. Validez-les d'abord.`,
          });
        }

        // Update all to shared
        await ctx.db
          .update(evaluations)
          .set({
            status: 'shared',
            updatedAt: new Date(),
          })
          .where(and(
            eq(evaluations.tenantId, tenantId),
            inArray(evaluations.id, input.ids)
          ));

        // TODO: Send notification emails to employees
        // For now, just return success. Email notifications can be added later.

        return { success: true, count: input.ids.length };
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
        departmentId: z.string().uuid().optional(), // Legacy single department
        targetDepartmentIds: z.array(z.string().uuid()).optional(), // Multi-department for team objectives
        targetPositionIds: z.array(z.string().uuid()).optional(), // Multi-position for team objectives
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

        // Validate: individual objectives require employeeId
        if (input.objectiveLevel === 'individual' && !input.employeeId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Les objectifs individuels nécessitent la sélection d\'un collaborateur',
          });
        }

        // Validate: team objectives require at least one department OR position
        if (input.objectiveLevel === 'team') {
          const hasDepartment = input.departmentId || (input.targetDepartmentIds && input.targetDepartmentIds.length > 0);
          const hasPosition = input.targetPositionIds && input.targetPositionIds.length > 0;
          if (!hasDepartment && !hasPosition) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Les objectifs d\'équipe nécessitent la sélection d\'au moins un département ou poste',
            });
          }
        }

        // Admin/HR created objectives are auto-approved, employee created are draft
        const isAdminOrHR = ['super_admin', 'tenant_admin', 'hr_manager', 'admin'].includes(ctx.user.role);
        const initialStatus = isAdminOrHR ? 'approved' : 'draft';

        const [created] = await ctx.db
          .insert(objectives)
          .values({
            tenantId,
            cycleId: input.cycleId,
            employeeId: input.employeeId,
            departmentId: input.departmentId,
            targetDepartmentIds: input.targetDepartmentIds,
            targetPositionIds: input.targetPositionIds,
            parentObjectiveId: input.parentObjectiveId,
            title: input.title,
            description: input.description,
            objectiveLevel: input.objectiveLevel,
            objectiveType: input.objectiveType,
            weight: input.weight,
            targetValue: input.targetValue,
            targetUnit: input.targetUnit,
            dueDate: input.dueDate,
            status: initialStatus,
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
  // POSITION COMPETENCIES
  // ============================================================================

  positionCompetencies: createTRPCRouter({
    /**
     * List competencies assigned to a position
     */
    list: hrManagerProcedure
      .input(z.object({
        positionId: z.string().uuid(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify position belongs to tenant
        const [position] = await ctx.db
          .select()
          .from(positions)
          .where(and(
            eq(positions.id, input.positionId),
            eq(positions.tenantId, tenantId)
          ));

        if (!position) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Poste non trouvé',
          });
        }

        // Get competencies assigned to this position
        const assignedCompetencies = await ctx.db
          .select({
            mapping: jobRoleCompetencies,
            competency: competencies,
          })
          .from(jobRoleCompetencies)
          .innerJoin(competencies, eq(jobRoleCompetencies.competencyId, competencies.id))
          .where(and(
            eq(jobRoleCompetencies.positionId, input.positionId),
            eq(jobRoleCompetencies.tenantId, tenantId),
            eq(competencies.isActive, true)
          ))
          .orderBy(asc(competencies.displayOrder), asc(competencies.name));

        return {
          position,
          competencies: assignedCompetencies.map(ac => ({
            id: ac.mapping.id,
            competencyId: ac.competency.id,
            code: ac.competency.code,
            name: ac.competency.name,
            description: ac.competency.description,
            category: ac.competency.category,
            proficiencyLevels: ac.competency.proficiencyLevels,
            isCore: ac.competency.isCore,
            requiredLevel: ac.mapping.requiredLevel,
            isCritical: ac.mapping.isCritical,
          })),
        };
      }),

    /**
     * Add a competency to a position
     */
    add: hrManagerProcedure
      .input(z.object({
        positionId: z.string().uuid(),
        competencyId: z.string().uuid(),
        requiredLevel: z.number().min(1).max(10).default(3),
        isCritical: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify position belongs to tenant
        const [position] = await ctx.db
          .select()
          .from(positions)
          .where(and(
            eq(positions.id, input.positionId),
            eq(positions.tenantId, tenantId)
          ));

        if (!position) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Poste non trouvé',
          });
        }

        // Verify competency belongs to tenant and is active
        const [competency] = await ctx.db
          .select()
          .from(competencies)
          .where(and(
            eq(competencies.id, input.competencyId),
            eq(competencies.tenantId, tenantId),
            eq(competencies.isActive, true)
          ));

        if (!competency) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Compétence non trouvée',
          });
        }

        // Check if already assigned
        const [existing] = await ctx.db
          .select()
          .from(jobRoleCompetencies)
          .where(and(
            eq(jobRoleCompetencies.positionId, input.positionId),
            eq(jobRoleCompetencies.competencyId, input.competencyId),
            eq(jobRoleCompetencies.tenantId, tenantId)
          ));

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cette compétence est déjà assignée à ce poste',
          });
        }

        // Add the competency to the position
        const [created] = await ctx.db
          .insert(jobRoleCompetencies)
          .values({
            tenantId,
            positionId: input.positionId,
            competencyId: input.competencyId,
            requiredLevel: input.requiredLevel,
            isCritical: input.isCritical,
            createdBy: ctx.user.id,
          })
          .returning();

        return {
          ...created,
          competency,
        };
      }),

    /**
     * Update a position competency mapping (change required level or critical flag)
     */
    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        requiredLevel: z.number().min(1).max(10).optional(),
        isCritical: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify mapping exists and belongs to tenant
        const [existing] = await ctx.db
          .select()
          .from(jobRoleCompetencies)
          .where(and(
            eq(jobRoleCompetencies.id, input.id),
            eq(jobRoleCompetencies.tenantId, tenantId)
          ));

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mapping non trouvé',
          });
        }

        const { id, ...updates } = input;

        const [updated] = await ctx.db
          .update(jobRoleCompetencies)
          .set(updates)
          .where(eq(jobRoleCompetencies.id, id))
          .returning();

        return updated;
      }),

    /**
     * Remove a competency from a position
     */
    remove: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify mapping exists and belongs to tenant
        const [existing] = await ctx.db
          .select()
          .from(jobRoleCompetencies)
          .where(and(
            eq(jobRoleCompetencies.id, input.id),
            eq(jobRoleCompetencies.tenantId, tenantId)
          ));

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mapping non trouvé',
          });
        }

        await ctx.db
          .delete(jobRoleCompetencies)
          .where(eq(jobRoleCompetencies.id, input.id));

        return { success: true };
      }),

    /**
     * Bulk add competencies to a position
     */
    bulkAdd: hrManagerProcedure
      .input(z.object({
        positionId: z.string().uuid(),
        competencies: z.array(z.object({
          competencyId: z.string().uuid(),
          requiredLevel: z.number().min(1).max(10).default(3),
          isCritical: z.boolean().default(false),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify position belongs to tenant
        const [position] = await ctx.db
          .select()
          .from(positions)
          .where(and(
            eq(positions.id, input.positionId),
            eq(positions.tenantId, tenantId)
          ));

        if (!position) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Poste non trouvé',
          });
        }

        // Get existing assignments
        const existingMappings = await ctx.db
          .select({ competencyId: jobRoleCompetencies.competencyId })
          .from(jobRoleCompetencies)
          .where(and(
            eq(jobRoleCompetencies.positionId, input.positionId),
            eq(jobRoleCompetencies.tenantId, tenantId)
          ));

        const existingCompetencyIds = new Set(existingMappings.map(m => m.competencyId));

        // Filter out already assigned competencies
        const newCompetencies = input.competencies.filter(
          c => !existingCompetencyIds.has(c.competencyId)
        );

        if (newCompetencies.length === 0) {
          return { added: 0 };
        }

        // Insert new mappings
        await ctx.db.insert(jobRoleCompetencies).values(
          newCompetencies.map(c => ({
            tenantId,
            positionId: input.positionId,
            competencyId: c.competencyId,
            requiredLevel: c.requiredLevel,
            isCritical: c.isCritical,
            createdBy: ctx.user.id,
          }))
        );

        return { added: newCompetencies.length };
      }),

    /**
     * List positions that have no competencies assigned
     * Used by the cycle readiness check to identify gaps
     */
    listMissing: hrManagerProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Find positions with NO competencies assigned
      const results = await ctx.db
        .select({
          id: positions.id,
          title: positions.title,
        })
        .from(positions)
        .leftJoin(jobRoleCompetencies, and(
          eq(positions.id, jobRoleCompetencies.positionId),
          eq(jobRoleCompetencies.tenantId, tenantId)
        ))
        .where(and(
          eq(positions.tenantId, tenantId),
          eq(positions.status, 'active')
        ))
        .groupBy(positions.id)
        .having(sql`count(${jobRoleCompetencies.id}) = 0`);

      return results.map(p => ({
        id: p.id,
        title: p.title,
      }));
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

          // Auto-populate calibration ratings with completed evaluations from the cycle
          // Get evaluations that are submitted or validated (ready for calibration)
          const eligibleEvaluations = await ctx.db
            .select({
              id: evaluations.id,
              overallScore: evaluations.overallScore,
              overallRating: evaluations.overallRating,
            })
            .from(evaluations)
            .where(and(
              eq(evaluations.cycleId, input.cycleId),
              eq(evaluations.tenantId, tenantId),
              inArray(evaluations.status, ['submitted', 'validated'])
            ));

          // Create calibration ratings for each eligible evaluation
          if (eligibleEvaluations.length > 0) {
            await ctx.db.insert(calibrationRatings).values(
              eligibleEvaluations.map((ev) => ({
                tenantId,
                calibrationSessionId: created.id,
                evaluationId: ev.id,
                originalRating: ev.overallRating ?? ev.overallScore?.toString() ?? 'N/A',
                // Initialize at center of 9-box grid (2,2 = "Solide")
                performanceAxis: 2,
                potentialAxis: 2,
              }))
            );
          }

          return created;
        }),

      updateStatus: hrManagerProcedure
        .input(z.object({
          sessionId: z.string().uuid(),
          status: z.enum(['scheduled', 'in_progress', 'completed']),
        }))
        .mutation(async ({ ctx, input }) => {
          const tenantId = ctx.user.tenantId;

          // Verify session exists and belongs to tenant
          const [session] = await ctx.db
            .select()
            .from(calibrationSessions)
            .where(and(
              eq(calibrationSessions.id, input.sessionId),
              eq(calibrationSessions.tenantId, tenantId)
            ))
            .limit(1);

          if (!session) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Session de calibration non trouvée',
            });
          }

          // Update status
          const [updated] = await ctx.db
            .update(calibrationSessions)
            .set({
              status: input.status,
              updatedAt: new Date(),
            })
            .where(eq(calibrationSessions.id, input.sessionId))
            .returning();

          // If completing session, calculate and save results summary
          if (input.status === 'completed') {
            // Get all ratings for this session
            const ratings = await ctx.db
              .select()
              .from(calibrationRatings)
              .where(eq(calibrationRatings.calibrationSessionId, input.sessionId));

            // Calculate distribution by 9-box position
            const distribution: Record<string, number> = {};
            let adjustments = 0;

            for (const rating of ratings) {
              const boxKey = `${rating.performanceAxis}-${rating.potentialAxis}`;
              distribution[boxKey] = (distribution[boxKey] || 0) + 1;

              // Count adjustments (where calibratedRating differs from originalRating)
              if (rating.calibratedRating && rating.calibratedRating !== rating.originalRating) {
                adjustments++;
              }
            }

            // Update with results summary
            await ctx.db
              .update(calibrationSessions)
              .set({
                resultsSummary: {
                  totalEmployees: ratings.length,
                  ratingDistribution: distribution,
                  adjustments,
                },
              })
              .where(eq(calibrationSessions.id, input.sessionId));
          }

          return updated;
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
  // EVALUATION GUIDE (Simplified flow for non-HR users)
  // ============================================================================

  /**
   * Get status data for the evaluation guide component
   * Returns progress through the 4-step evaluation flow
   */
  getGuideStatus: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Get most recent active cycle (or most recent cycle if none active)
    const [activeCycle] = await ctx.db
      .select({
        id: performanceCycles.id,
        name: performanceCycles.name,
        status: performanceCycles.status,
        periodStart: performanceCycles.periodStart,
        periodEnd: performanceCycles.periodEnd,
        resultsReleaseDate: performanceCycles.resultsReleaseDate,
        includeSelfEvaluation: performanceCycles.includeSelfEvaluation,
        includeManagerEvaluation: performanceCycles.includeManagerEvaluation,
        includeObjectives: performanceCycles.includeObjectives,
        includeCompetencies: performanceCycles.includeCompetencies,
        includeCalibration: performanceCycles.includeCalibration,
      })
      .from(performanceCycles)
      .where(and(
        eq(performanceCycles.tenantId, tenantId),
        or(
          eq(performanceCycles.status, 'active'),
          eq(performanceCycles.status, 'planning'),
          eq(performanceCycles.status, 'objective_setting')
        )
      ))
      .orderBy(desc(performanceCycles.createdAt))
      .limit(1);

    // If no active cycle, return empty state
    if (!activeCycle) {
      return {
        activeCycle: null,
        selfEvalProgress: { completed: 0, total: 0 },
        managerEvalProgress: { completed: 0, total: 0 },
        objectivesProgress: { completed: 0, total: 0 },
        resultsShared: false,
      };
    }

    // Get self-evaluation progress
    const [selfEvalStats] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${evaluations.status} IN ('submitted', 'validated', 'shared'))::int`,
      })
      .from(evaluations)
      .where(and(
        eq(evaluations.cycleId, activeCycle.id),
        eq(evaluations.tenantId, tenantId),
        eq(evaluations.evaluationType, 'self')
      ));

    // Get manager evaluation progress
    const [managerEvalStats] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${evaluations.status} IN ('submitted', 'validated', 'shared'))::int`,
      })
      .from(evaluations)
      .where(and(
        eq(evaluations.cycleId, activeCycle.id),
        eq(evaluations.tenantId, tenantId),
        eq(evaluations.evaluationType, 'manager')
      ));

    // Get objectives progress (count of objectives with individual employees assigned)
    // "Completed" means objectives have been assigned to employees
    const [objectivesStats] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${objectives.status} = 'approved')::int`,
      })
      .from(objectives)
      .where(and(
        eq(objectives.cycleId, activeCycle.id),
        eq(objectives.tenantId, tenantId)
      ));

    // Check if results have been shared (cycle is closed or resultsReleaseDate is in the past)
    const resultsShared = activeCycle.status === 'closed' ||
      (activeCycle.resultsReleaseDate && new Date(activeCycle.resultsReleaseDate) <= new Date());

    return {
      activeCycle: {
        id: activeCycle.id,
        name: activeCycle.name,
        status: activeCycle.status,
        periodStart: activeCycle.periodStart,
        periodEnd: activeCycle.periodEnd,
        includeSelfEvaluation: activeCycle.includeSelfEvaluation,
        includeManagerEvaluation: activeCycle.includeManagerEvaluation,
        includeObjectives: activeCycle.includeObjectives,
        includeCompetencies: activeCycle.includeCompetencies,
        includeCalibration: activeCycle.includeCalibration,
      },
      selfEvalProgress: {
        completed: selfEvalStats?.completed ?? 0,
        total: selfEvalStats?.total ?? 0,
      },
      managerEvalProgress: {
        completed: managerEvalStats?.completed ?? 0,
        total: managerEvalStats?.total ?? 0,
      },
      objectivesProgress: {
        completed: objectivesStats?.completed ?? 0,
        total: objectivesStats?.total ?? 0,
      },
      resultsShared: !!resultsShared,
    };
  }),

  /**
   * Get pre-launch readiness checks for a performance cycle
   * Returns validation checks that must pass before launching the cycle
   * Used by CycleProgressSidebar to display blockers
   */
  getReadinessChecks: hrManagerProcedure
    .input(z.object({ cycleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get cycle
      const [cycle] = await ctx.db
        .select()
        .from(performanceCycles)
        .where(and(
          eq(performanceCycles.id, input.cycleId),
          eq(performanceCycles.tenantId, tenantId)
        ));

      if (!cycle) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cycle non trouvé',
        });
      }

      type ReadinessCheck = {
        id: string;
        label: string;
        description: string;
        status: 'passed' | 'failed' | 'warning';
        blocksLaunch: boolean;
        actionHref?: string;
        details?: {
          count?: number;
          items?: Array<{ id: string; name: string }>;
        };
      };

      const checks: ReadinessCheck[] = [];

      // CHECK 1: Active employees exist
      const [empCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(and(
          eq(employees.tenantId, tenantId),
          eq(employees.status, 'active')
        ));

      checks.push({
        id: 'employees',
        label: 'Employés actifs',
        description: (empCount?.count ?? 0) > 0
          ? `${empCount?.count ?? 0} employé(s) seront évalués`
          : 'Aucun employé actif trouvé',
        status: (empCount?.count ?? 0) > 0 ? 'passed' : 'failed',
        blocksLaunch: true,
        actionHref: '/employees',
        details: { count: empCount?.count ?? 0 },
      });

      // CHECK 2: Dates valid
      const datesValid = cycle.periodStart && cycle.periodEnd &&
        new Date(cycle.periodStart) < new Date(cycle.periodEnd);
      checks.push({
        id: 'dates',
        label: 'Dates du cycle',
        description: datesValid
          ? 'Période correctement configurée'
          : 'Dates invalides ou manquantes',
        status: datesValid ? 'passed' : 'failed',
        blocksLaunch: true,
        actionHref: `/performance/cycles/${input.cycleId}`,
      });

      // CHECK 3: Competencies (only if competency evaluation is enabled)
      if (cycle.includeCompetencies) {
        // Find active employees with primary positions that have NO competencies assigned
        const today = new Date().toISOString().split('T')[0];

        const employeesWithoutPositionCompetencies = await ctx.db
          .select({
            employeeId: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            positionId: positions.id,
            positionTitle: positions.title,
          })
          .from(employees)
          .innerJoin(assignments, and(
            eq(employees.id, assignments.employeeId),
            eq(assignments.assignmentType, 'primary'),
            lte(assignments.effectiveFrom, today),
            or(isNull(assignments.effectiveTo), gte(assignments.effectiveTo, today))
          ))
          .innerJoin(positions, eq(assignments.positionId, positions.id))
          .leftJoin(jobRoleCompetencies, and(
            eq(positions.id, jobRoleCompetencies.positionId),
            eq(jobRoleCompetencies.tenantId, tenantId)
          ))
          .where(and(
            eq(employees.tenantId, tenantId),
            eq(employees.status, 'active')
          ))
          .groupBy(
            employees.id,
            employees.firstName,
            employees.lastName,
            positions.id,
            positions.title
          )
          .having(sql`count(${jobRoleCompetencies.id}) = 0`);

        const missingCount = employeesWithoutPositionCompetencies.length;

        checks.push({
          id: 'competencies',
          label: 'Compétences des postes',
          description: missingCount > 0
            ? `${missingCount} employé(s) ont des postes sans compétences définies`
            : 'Tous les postes ont des compétences assignées',
          status: missingCount > 0 ? 'failed' : 'passed',
          blocksLaunch: true,
          actionHref: '/positions?filter=missing-competencies',
          details: {
            count: missingCount,
            items: employeesWithoutPositionCompetencies.slice(0, 5).map(e => ({
              id: e.positionId,
              name: `${e.firstName} ${e.lastName} - ${e.positionTitle}`,
            })),
          },
        });
      }

      // CHECK 4: Objectives (only if objectives are enabled)
      if (cycle.includeObjectives) {
        const [objectiveStats] = await ctx.db
          .select({
            total: sql<number>`count(*)::int`,
            approved: sql<number>`count(*) FILTER (WHERE ${objectives.status} = 'approved')::int`,
          })
          .from(objectives)
          .where(and(
            eq(objectives.cycleId, input.cycleId),
            eq(objectives.tenantId, tenantId)
          ));

        const hasApprovedObjectives = (objectiveStats?.approved ?? 0) > 0;

        checks.push({
          id: 'objectives',
          label: 'Objectifs définis',
          description: hasApprovedObjectives
            ? `${objectiveStats?.approved ?? 0} objectif(s) approuvé(s)`
            : 'Aucun objectif approuvé pour ce cycle',
          status: hasApprovedObjectives ? 'passed' : 'failed',
          blocksLaunch: true,
          actionHref: `/performance/cycles/${input.cycleId}?tab=objectives`,
          details: {
            count: objectiveStats?.approved ?? 0,
          },
        });
      }

      // Compute canLaunch: all blocking checks must pass
      const canLaunch = checks.every(c => c.status === 'passed' || !c.blocksLaunch);

      return {
        cycleId: input.cycleId,
        cycleStatus: cycle.status,
        checks,
        canLaunch,
      };
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

  // ============================================================================
  // DEPARTMENTS (for team objectives)
  // ============================================================================

  departments: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(['active', 'inactive']).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(departments.tenantId, tenantId)];

        if (input?.status) {
          conditions.push(eq(departments.status, input.status));
        } else {
          // Default to active departments
          conditions.push(eq(departments.status, 'active'));
        }

        const departmentsList = await ctx.db
          .select({
            id: departments.id,
            name: departments.name,
            code: departments.code,
            description: departments.description,
            parentDepartmentId: departments.parentDepartmentId,
            managerId: departments.managerId,
            status: departments.status,
          })
          .from(departments)
          .where(and(...conditions))
          .orderBy(asc(departments.name));

        return departmentsList;
      }),
  }),
});
