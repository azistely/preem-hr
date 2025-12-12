/**
 * HR Workflows Router
 *
 * Manages workflow definitions and instances for Performance and Training modules.
 * Workflows orchestrate multi-step processes like evaluations, training requests, etc.
 *
 * Endpoints:
 * - definitions: CRUD for workflow templates
 * - instances: Manage running workflows
 * - steps: Handle step actions (complete, skip, approve/reject)
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure } from '@/server/api/trpc';
import {
  hrWorkflowDefinitions,
  hrWorkflowInstances,
  hrWorkflowStepInstances,
  type WorkflowStepDefinition,
  type WorkflowTransitionDefinition,
  type ReminderScheduleConfig,
  type EscalationRuleConfig,
} from '@/lib/db/schema/hr-workflows';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, desc, ilike, or, sql, inArray, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

// Use z.any() for complex nested types to avoid recursive type issues
const workflowStepDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum(['form', 'approval', 'review', 'notification', 'wait', 'parallel', 'conditional']),
  name: z.string(),
  description: z.string().optional(),
  assignmentRole: z.enum(['employee', 'manager', 'skip_level_manager', 'hr_manager', 'hr_admin', 'peer', 'custom']),
  customAssigneeField: z.string().optional(),
  formTemplateId: z.string().optional(),
  formTemplateSlug: z.string().optional(),
  approvalConfig: z.object({
    requireComment: z.boolean().optional(),
    allowDelegation: z.boolean().optional(),
    escalateAfterDays: z.number().optional(),
    escalateTo: z.enum(['employee', 'manager', 'skip_level_manager', 'hr_manager', 'hr_admin', 'peer', 'custom']).optional(),
  }).optional(),
  waitConfig: z.object({
    type: z.enum(['duration', 'date', 'condition']),
    durationDays: z.number().optional(),
    dateField: z.string().optional(),
    condition: z.any().optional(),
  }).optional(),
  parallelSteps: z.array(z.any()).optional(), // Recursive type
  parallelCompletion: z.enum(['all', 'any', 'majority']).optional(),
  conditionalConfig: z.object({
    condition: z.any(),
    trueStepId: z.string().optional(),
    falseStepId: z.string().optional(),
  }).optional(),
  defaultDurationDays: z.number().optional(),
  isOptional: z.boolean().optional(),
  canSkip: z.boolean().optional(),
  notifyOnAssignment: z.boolean().optional(),
  notifyOnDue: z.boolean().optional(),
  notifyOnOverdue: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const transitionDefinitionSchema = z.object({
  id: z.string(),
  fromStepId: z.string(),
  toStepId: z.string(),
  trigger: z.enum([
    'manual', 'form_submitted', 'approved', 'rejected',
    'due_date_reached', 'condition_met', 'all_parallel_complete',
    'escalation', 'timeout'
  ]),
  conditions: z.array(z.any()).optional(),
  conditionLogic: z.enum(['AND', 'OR']).optional(),
  label: z.string().optional(),
  buttonVariant: z.enum(['default', 'primary', 'destructive']).optional(),
});

const reminderScheduleSchema = z.object({
  enabled: z.boolean(),
  firstReminderDays: z.number(),
  repeatIntervalDays: z.number().optional(),
  maxReminders: z.number().optional(),
  channels: z.array(z.enum(['email', 'in_app', 'push'])),
});

const escalationRuleSchema = z.object({
  triggerDaysOverdue: z.number(),
  escalateTo: z.enum(['employee', 'manager', 'skip_level_manager', 'hr_manager', 'hr_admin', 'peer', 'custom']),
  notifyOriginal: z.boolean(),
  autoReassign: z.boolean(),
  maxEscalations: z.number().optional(),
});

// =============================================================================
// ROUTER
// =============================================================================

export const hrWorkflowsRouter = createTRPCRouter({
  // ===========================================================================
  // DEFINITIONS (Templates)
  // ===========================================================================
  definitions: createTRPCRouter({
    /**
     * List all workflow definitions
     */
    list: protectedProcedure
      .input(z.object({
        module: z.enum(['performance', 'training', 'shared']).optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
        isTemplate: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [
          or(
            eq(hrWorkflowDefinitions.tenantId, tenantId),
            eq(hrWorkflowDefinitions.isSystem, true)
          )!,
        ];

        if (input.module) {
          conditions.push(eq(hrWorkflowDefinitions.module, input.module));
        }

        if (input.category) {
          conditions.push(eq(hrWorkflowDefinitions.category, input.category));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(hrWorkflowDefinitions.isActive, input.isActive));
        }

        if (input.isTemplate !== undefined) {
          conditions.push(eq(hrWorkflowDefinitions.isTemplate, input.isTemplate));
        }

        if (input.search) {
          conditions.push(
            or(
              ilike(hrWorkflowDefinitions.name, `%${input.search}%`),
              ilike(hrWorkflowDefinitions.description, `%${input.search}%`)
            )!
          );
        }

        const definitions = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(and(...conditions))
          .orderBy(desc(hrWorkflowDefinitions.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hrWorkflowDefinitions)
          .where(and(...conditions));

        return {
          data: definitions,
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    /**
     * Get a single definition by ID
     */
    getById: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [definition] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            or(
              eq(hrWorkflowDefinitions.tenantId, tenantId),
              eq(hrWorkflowDefinitions.isSystem, true)
            )
          ))
          .limit(1);

        return definition ?? null;
      }),

    /**
     * Get definition by slug
     */
    getBySlug: protectedProcedure
      .input(z.object({
        slug: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [definition] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.slug, input.slug),
            or(
              eq(hrWorkflowDefinitions.tenantId, tenantId),
              eq(hrWorkflowDefinitions.isSystem, true)
            )
          ))
          .limit(1);

        return definition ?? null;
      }),

    /**
     * Create a new workflow definition (HR only)
     */
    create: hrManagerProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        module: z.enum(['performance', 'training', 'shared']),
        category: z.string().optional(),
        steps: z.array(workflowStepDefinitionSchema),
        transitions: z.array(transitionDefinitionSchema),
        defaultDurations: z.record(z.string(), z.number()).optional(),
        reminderSchedule: reminderScheduleSchema.optional(),
        escalationRules: z.array(escalationRuleSchema).optional(),
        isTemplate: z.boolean().default(false),
        isActive: z.boolean().default(true),
        countryCode: z.string().optional(),
        tenantSizeMin: z.number().optional(),
        tenantSizeMax: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const slug = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;

        const [created] = await ctx.db
          .insert(hrWorkflowDefinitions)
          .values({
            tenantId,
            name: input.name,
            slug,
            description: input.description ?? null,
            icon: input.icon ?? null,
            module: input.module,
            category: input.category ?? null,
            steps: input.steps as WorkflowStepDefinition[],
            transitions: input.transitions as WorkflowTransitionDefinition[],
            defaultDurations: input.defaultDurations ?? null,
            reminderSchedule: input.reminderSchedule as ReminderScheduleConfig ?? null,
            escalationRules: input.escalationRules as EscalationRuleConfig[] ?? null,
            isTemplate: input.isTemplate,
            isActive: input.isActive,
            isSystem: false,
            version: 1,
            countryCode: input.countryCode ?? null,
            tenantSizeMin: input.tenantSizeMin ?? null,
            tenantSizeMax: input.tenantSizeMax ?? null,
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    /**
     * Update a workflow definition (HR only)
     */
    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        steps: z.array(workflowStepDefinitionSchema).optional(),
        transitions: z.array(transitionDefinitionSchema).optional(),
        defaultDurations: z.record(z.string(), z.number()).optional(),
        reminderSchedule: reminderScheduleSchema.optional(),
        escalationRules: z.array(escalationRuleSchema).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get current version
        const [current] = await ctx.db
          .select({ version: hrWorkflowDefinitions.version, isSystem: hrWorkflowDefinitions.isSystem })
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            eq(hrWorkflowDefinitions.tenantId, tenantId)
          ))
          .limit(1);

        if (!current) {
          throw new Error('Workflow definition not found');
        }

        if (current.isSystem) {
          throw new Error('Cannot modify system workflows');
        }

        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.icon !== undefined) updateData.icon = input.icon;
        if (input.defaultDurations !== undefined) updateData.defaultDurations = input.defaultDurations;
        if (input.reminderSchedule !== undefined) updateData.reminderSchedule = input.reminderSchedule;
        if (input.escalationRules !== undefined) updateData.escalationRules = input.escalationRules;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.steps !== undefined || input.transitions !== undefined) {
          if (input.steps !== undefined) updateData.steps = input.steps;
          if (input.transitions !== undefined) updateData.transitions = input.transitions;
          updateData.version = current.version + 1;
        }

        const [updated] = await ctx.db
          .update(hrWorkflowDefinitions)
          .set(updateData)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            eq(hrWorkflowDefinitions.tenantId, tenantId)
          ))
          .returning();

        return updated;
      }),

    /**
     * Clone a workflow definition (HR only)
     */
    clone: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        newName: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get original
        const [original] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            or(
              eq(hrWorkflowDefinitions.tenantId, tenantId),
              eq(hrWorkflowDefinitions.isSystem, true)
            )
          ))
          .limit(1);

        if (!original) {
          throw new Error('Workflow definition not found');
        }

        const slug = `${input.newName.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;

        // Create clone
        const [cloned] = await ctx.db
          .insert(hrWorkflowDefinitions)
          .values({
            tenantId,
            name: input.newName,
            slug,
            description: original.description,
            icon: original.icon,
            module: original.module,
            category: original.category,
            steps: original.steps,
            transitions: original.transitions,
            defaultDurations: original.defaultDurations,
            reminderSchedule: original.reminderSchedule,
            escalationRules: original.escalationRules,
            isTemplate: false,
            isActive: false, // Start as inactive
            isSystem: false,
            version: 1,
            createdBy: ctx.user.id,
          })
          .returning();

        return cloned;
      }),

    /**
     * Delete a workflow definition (soft delete) (HR only)
     */
    delete: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Check if system workflow
        const [definition] = await ctx.db
          .select({ isSystem: hrWorkflowDefinitions.isSystem })
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            eq(hrWorkflowDefinitions.tenantId, tenantId)
          ))
          .limit(1);

        if (!definition) {
          throw new Error('Workflow definition not found');
        }

        if (definition.isSystem) {
          throw new Error('Cannot delete system workflows');
        }

        await ctx.db
          .update(hrWorkflowDefinitions)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(
            eq(hrWorkflowDefinitions.id, input.id),
            eq(hrWorkflowDefinitions.tenantId, tenantId)
          ));

        return { success: true };
      }),
  }),

  // ===========================================================================
  // INSTANCES (Running Workflows)
  // ===========================================================================
  instances: createTRPCRouter({
    /**
     * List workflow instances
     */
    list: protectedProcedure
      .input(z.object({
        definitionId: z.string().uuid().optional(),
        subjectEmployeeId: z.string().uuid().optional(),
        sourceType: z.string().optional(),
        sourceId: z.string().uuid().optional(),
        status: z.enum(['pending', 'in_progress', 'awaiting_approval', 'completed', 'cancelled', 'expired']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(hrWorkflowInstances.tenantId, tenantId)];

        // Non-HR can only see their own instances
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
        if (!isHr && ctx.user.employeeId) {
          conditions.push(eq(hrWorkflowInstances.subjectEmployeeId, ctx.user.employeeId));
        }

        if (input.definitionId) {
          conditions.push(eq(hrWorkflowInstances.definitionId, input.definitionId));
        }

        if (input.subjectEmployeeId) {
          conditions.push(eq(hrWorkflowInstances.subjectEmployeeId, input.subjectEmployeeId));
        }

        if (input.sourceType) {
          conditions.push(eq(hrWorkflowInstances.sourceType, input.sourceType));
        }

        if (input.sourceId) {
          conditions.push(eq(hrWorkflowInstances.sourceId, input.sourceId));
        }

        if (input.status) {
          conditions.push(eq(hrWorkflowInstances.status, input.status));
        }

        // Get instances with subject employee
        const instances = await ctx.db
          .select({
            instance: hrWorkflowInstances,
            subjectEmployee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              jobTitle: employees.jobTitle,
            },
          })
          .from(hrWorkflowInstances)
          .leftJoin(employees, eq(hrWorkflowInstances.subjectEmployeeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(hrWorkflowInstances.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hrWorkflowInstances)
          .where(and(...conditions));

        return {
          data: instances.map(row => ({
            ...row.instance,
            subjectEmployee: row.subjectEmployee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    /**
     * Get a single instance by ID with all step instances
     */
    getById: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get instance
        const [instance] = await ctx.db
          .select({
            instance: hrWorkflowInstances,
            subjectEmployee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              jobTitle: employees.jobTitle,
            },
          })
          .from(hrWorkflowInstances)
          .leftJoin(employees, eq(hrWorkflowInstances.subjectEmployeeId, employees.id))
          .where(and(
            eq(hrWorkflowInstances.id, input.id),
            eq(hrWorkflowInstances.tenantId, tenantId)
          ))
          .limit(1);

        if (!instance) {
          return null;
        }

        // Get workflow definition
        const [definition] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(eq(hrWorkflowDefinitions.id, instance.instance.definitionId))
          .limit(1);

        // Get step instances
        const stepInstances = await ctx.db
          .select({
            step: hrWorkflowStepInstances,
            assigneeEmployee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(hrWorkflowStepInstances)
          .leftJoin(employees, eq(hrWorkflowStepInstances.assigneeEmployeeId, employees.id))
          .where(eq(hrWorkflowStepInstances.instanceId, input.id))
          .orderBy(asc(hrWorkflowStepInstances.stepOrder));

        return {
          ...instance.instance,
          subjectEmployee: instance.subjectEmployee,
          definition,
          stepInstances: stepInstances.map(row => ({
            ...row.step,
            assigneeEmployee: row.assigneeEmployee,
          })),
        };
      }),

    /**
     * Start a new workflow instance (HR or system)
     */
    start: protectedProcedure
      .input(z.object({
        definitionId: z.string().uuid(),
        subjectEmployeeId: z.string().uuid(),
        sourceType: z.string(),
        sourceId: z.string().uuid(),
        dueDate: z.string().optional(), // ISO date string
        contextData: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get definition
        const [definition] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(and(
            eq(hrWorkflowDefinitions.id, input.definitionId),
            or(
              eq(hrWorkflowDefinitions.tenantId, tenantId),
              eq(hrWorkflowDefinitions.isSystem, true)
            )
          ))
          .limit(1);

        if (!definition) {
          throw new Error('Workflow definition not found');
        }

        if (!definition.isActive) {
          throw new Error('Workflow is not active');
        }

        // Generate reference number
        const referenceNumber = `WF-${nanoid(8).toUpperCase()}`;

        // Get first step
        const steps = definition.steps as WorkflowStepDefinition[];
        const firstStep = steps[0];

        // Create instance
        const [instance] = await ctx.db
          .insert(hrWorkflowInstances)
          .values({
            tenantId,
            definitionId: input.definitionId,
            referenceNumber,
            subjectEmployeeId: input.subjectEmployeeId,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            status: 'in_progress',
            currentStepId: firstStep?.id ?? null,
            completedStepIds: [],
            contextData: input.contextData ?? {},
            startedAt: new Date(),
            dueDate: input.dueDate ?? null,
            createdBy: ctx.user.id,
          })
          .returning();

        // Create first step instance if there are steps
        if (firstStep) {
          // Resolve assignee
          const assigneeEmployeeId = await resolveAssignee(
            ctx.db,
            tenantId,
            firstStep.assignmentRole,
            input.subjectEmployeeId
          );

          await ctx.db
            .insert(hrWorkflowStepInstances)
            .values({
              tenantId,
              instanceId: instance.id,
              stepId: firstStep.id,
              stepOrder: 0,
              assigneeRole: firstStep.assignmentRole,
              assigneeEmployeeId,
              assigneeUserId: null,
              status: 'in_progress',
              startedAt: new Date(),
              dueDate: firstStep.defaultDurationDays
                ? getDateAfterDays(firstStep.defaultDurationDays)
                : null,
            });
        }

        return instance;
      }),

    /**
     * Cancel a workflow instance
     */
    cancel: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Check access (HR only for now)
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
        if (!isHr) {
          throw new Error('Only HR can cancel workflows');
        }

        const [updated] = await ctx.db
          .update(hrWorkflowInstances)
          .set({
            status: 'cancelled',
            completedAt: new Date(),
            contextData: sql`${hrWorkflowInstances.contextData} || ${JSON.stringify({ cancellationReason: input.reason })}::jsonb`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(hrWorkflowInstances.id, input.id),
            eq(hrWorkflowInstances.tenantId, tenantId)
          ))
          .returning();

        // Mark all pending steps as skipped
        await ctx.db
          .update(hrWorkflowStepInstances)
          .set({
            status: 'skipped',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(hrWorkflowStepInstances.instanceId, input.id),
            inArray(hrWorkflowStepInstances.status, ['pending', 'in_progress'])
          ));

        return updated;
      }),
  }),

  // ===========================================================================
  // STEPS (Step Actions)
  // ===========================================================================
  steps: createTRPCRouter({
    /**
     * Get steps assigned to current user
     */
    myPendingSteps: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const employeeId = ctx.user.employeeId;

        if (!employeeId) {
          return { data: [], total: 0, hasMore: false };
        }

        const conditions = [
          eq(hrWorkflowStepInstances.tenantId, tenantId),
          eq(hrWorkflowStepInstances.assigneeEmployeeId, employeeId),
          inArray(hrWorkflowStepInstances.status, ['pending', 'in_progress']),
        ];

        const steps = await ctx.db
          .select({
            step: hrWorkflowStepInstances,
            instance: hrWorkflowInstances,
            subjectEmployee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(hrWorkflowStepInstances)
          .innerJoin(hrWorkflowInstances, eq(hrWorkflowStepInstances.instanceId, hrWorkflowInstances.id))
          .leftJoin(employees, eq(hrWorkflowInstances.subjectEmployeeId, employees.id))
          .where(and(...conditions))
          .orderBy(asc(hrWorkflowStepInstances.dueDate))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hrWorkflowStepInstances)
          .where(and(...conditions));

        return {
          data: steps.map(row => ({
            ...row.step,
            instance: row.instance,
            subjectEmployee: row.subjectEmployee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    /**
     * Complete a step
     */
    complete: protectedProcedure
      .input(z.object({
        stepInstanceId: z.string().uuid(),
        stepData: z.record(z.string(), z.any()).optional(),
        formSubmissionId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get step instance
        const [stepInstance] = await ctx.db
          .select()
          .from(hrWorkflowStepInstances)
          .where(and(
            eq(hrWorkflowStepInstances.id, input.stepInstanceId),
            eq(hrWorkflowStepInstances.tenantId, tenantId)
          ))
          .limit(1);

        if (!stepInstance) {
          throw new Error('Step not found');
        }

        // Verify assignee
        if (stepInstance.assigneeEmployeeId !== ctx.user.employeeId) {
          const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
          if (!isHr) {
            throw new Error('You are not assigned to this step');
          }
        }

        // Update step
        const [updatedStep] = await ctx.db
          .update(hrWorkflowStepInstances)
          .set({
            status: 'completed',
            stepData: input.stepData ?? {},
            formSubmissionId: input.formSubmissionId ?? null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, input.stepInstanceId))
          .returning();

        // Advance workflow
        await advanceWorkflow(ctx.db, tenantId, stepInstance.instanceId, stepInstance.stepId, ctx.user.id);

        return updatedStep;
      }),

    /**
     * Approve/Reject a step
     */
    decide: protectedProcedure
      .input(z.object({
        stepInstanceId: z.string().uuid(),
        decision: z.enum(['approved', 'rejected']),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get step instance
        const [stepInstance] = await ctx.db
          .select()
          .from(hrWorkflowStepInstances)
          .where(and(
            eq(hrWorkflowStepInstances.id, input.stepInstanceId),
            eq(hrWorkflowStepInstances.tenantId, tenantId)
          ))
          .limit(1);

        if (!stepInstance) {
          throw new Error('Step not found');
        }

        // Verify assignee
        if (stepInstance.assigneeEmployeeId !== ctx.user.employeeId) {
          const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
          if (!isHr) {
            throw new Error('You are not assigned to this step');
          }
        }

        // Update step
        const [updatedStep] = await ctx.db
          .update(hrWorkflowStepInstances)
          .set({
            status: 'completed',
            approvalStatus: input.decision,
            approvalComment: input.comment ?? null,
            approvedBy: ctx.user.id,
            approvedAt: new Date(),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, input.stepInstanceId))
          .returning();

        // Advance workflow
        await advanceWorkflow(ctx.db, tenantId, stepInstance.instanceId, stepInstance.stepId, ctx.user.id);

        return updatedStep;
      }),

    /**
     * Skip a step (if allowed)
     */
    skip: protectedProcedure
      .input(z.object({
        stepInstanceId: z.string().uuid(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get step instance and definition
        const [stepInstance] = await ctx.db
          .select()
          .from(hrWorkflowStepInstances)
          .where(and(
            eq(hrWorkflowStepInstances.id, input.stepInstanceId),
            eq(hrWorkflowStepInstances.tenantId, tenantId)
          ))
          .limit(1);

        if (!stepInstance) {
          throw new Error('Step not found');
        }

        // Get workflow instance and definition
        const [instance] = await ctx.db
          .select()
          .from(hrWorkflowInstances)
          .where(eq(hrWorkflowInstances.id, stepInstance.instanceId))
          .limit(1);

        if (!instance) {
          throw new Error('Workflow instance not found');
        }

        const [definition] = await ctx.db
          .select()
          .from(hrWorkflowDefinitions)
          .where(eq(hrWorkflowDefinitions.id, instance.definitionId))
          .limit(1);

        // Check if step can be skipped
        const steps = definition?.steps as WorkflowStepDefinition[] ?? [];
        const stepDef = steps.find(s => s.id === stepInstance.stepId);

        if (!stepDef?.canSkip && !stepDef?.isOptional) {
          throw new Error('This step cannot be skipped');
        }

        // Update step
        const [updatedStep] = await ctx.db
          .update(hrWorkflowStepInstances)
          .set({
            status: 'skipped',
            stepData: { skipReason: input.reason },
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, input.stepInstanceId))
          .returning();

        // Advance workflow
        await advanceWorkflow(ctx.db, tenantId, stepInstance.instanceId, stepInstance.stepId, ctx.user.id);

        return updatedStep;
      }),
  }),

  // ===========================================================================
  // DASHBOARD STATS
  // ===========================================================================
  dashboard: createTRPCRouter({
    /**
     * Get workflow stats for dashboard
     */
    stats: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;
      const employeeId = ctx.user.employeeId;

      // Pending steps assigned to me
      const [{ pendingSteps }] = await ctx.db
        .select({ pendingSteps: sql<number>`count(*)::int` })
        .from(hrWorkflowStepInstances)
        .where(and(
          eq(hrWorkflowStepInstances.tenantId, tenantId),
          eq(hrWorkflowStepInstances.assigneeEmployeeId, employeeId ?? ''),
          inArray(hrWorkflowStepInstances.status, ['pending', 'in_progress'])
        ));

      // Active workflows (in progress)
      const [{ activeWorkflows }] = await ctx.db
        .select({ activeWorkflows: sql<number>`count(*)::int` })
        .from(hrWorkflowInstances)
        .where(and(
          eq(hrWorkflowInstances.tenantId, tenantId),
          eq(hrWorkflowInstances.status, 'in_progress')
        ));

      // Overdue steps
      const [{ overdueSteps }] = await ctx.db
        .select({ overdueSteps: sql<number>`count(*)::int` })
        .from(hrWorkflowStepInstances)
        .where(and(
          eq(hrWorkflowStepInstances.tenantId, tenantId),
          inArray(hrWorkflowStepInstances.status, ['pending', 'in_progress']),
          sql`${hrWorkflowStepInstances.dueDate} < CURRENT_DATE`
        ));

      // Completed this month
      const [{ completedThisMonth }] = await ctx.db
        .select({ completedThisMonth: sql<number>`count(*)::int` })
        .from(hrWorkflowInstances)
        .where(and(
          eq(hrWorkflowInstances.tenantId, tenantId),
          eq(hrWorkflowInstances.status, 'completed'),
          sql`${hrWorkflowInstances.completedAt} >= date_trunc('month', CURRENT_DATE)`
        ));

      return {
        pendingSteps,
        activeWorkflows,
        overdueSteps,
        completedThisMonth,
      };
    }),
  }),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Resolve assignee employee ID based on assignment role
 */
async function resolveAssignee(
  db: typeof import('@/lib/db').db,
  tenantId: string,
  assignmentRole: string,
  subjectEmployeeId: string
): Promise<string | null> {
  switch (assignmentRole) {
    case 'employee':
      return subjectEmployeeId;

    case 'manager': {
      const [employee] = await db
        .select({ reportingManagerId: employees.reportingManagerId })
        .from(employees)
        .where(and(
          eq(employees.id, subjectEmployeeId),
          eq(employees.tenantId, tenantId)
        ))
        .limit(1);
      return employee?.reportingManagerId ?? null;
    }

    case 'skip_level_manager': {
      // Get employee's manager's manager
      const [employee] = await db
        .select({ reportingManagerId: employees.reportingManagerId })
        .from(employees)
        .where(and(
          eq(employees.id, subjectEmployeeId),
          eq(employees.tenantId, tenantId)
        ))
        .limit(1);

      if (!employee?.reportingManagerId) return null;

      const [manager] = await db
        .select({ reportingManagerId: employees.reportingManagerId })
        .from(employees)
        .where(and(
          eq(employees.id, employee.reportingManagerId),
          eq(employees.tenantId, tenantId)
        ))
        .limit(1);

      return manager?.reportingManagerId ?? null;
    }

    case 'hr_manager':
    case 'hr_admin':
      // TODO: Look up HR manager from tenant config
      return null;

    case 'peer':
    case 'custom':
      // These require additional context
      return null;

    default:
      return null;
  }
}

/**
 * Get date after N days
 */
function getDateAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Advance workflow to next step
 */
async function advanceWorkflow(
  db: typeof import('@/lib/db').db,
  tenantId: string,
  instanceId: string,
  completedStepId: string,
  userId: string
): Promise<void> {
  // Get instance
  const [instance] = await db
    .select()
    .from(hrWorkflowInstances)
    .where(eq(hrWorkflowInstances.id, instanceId))
    .limit(1);

  if (!instance) return;

  // Get definition
  const [definition] = await db
    .select()
    .from(hrWorkflowDefinitions)
    .where(eq(hrWorkflowDefinitions.id, instance.definitionId))
    .limit(1);

  if (!definition) return;

  const steps = definition.steps as WorkflowStepDefinition[];
  const transitions = definition.transitions as WorkflowTransitionDefinition[];
  const completedStepIds = (instance.completedStepIds as string[]) ?? [];

  // Find applicable transition
  const applicableTransition = transitions.find(t =>
    (t.fromStepId === completedStepId || t.fromStepId === '*') &&
    (t.trigger === 'form_submitted' || t.trigger === 'approved' || t.trigger === 'manual')
  );

  if (!applicableTransition) {
    // No transition found, check if this was the last step
    const currentStepIndex = steps.findIndex(s => s.id === completedStepId);
    if (currentStepIndex === steps.length - 1) {
      // Complete workflow
      await db
        .update(hrWorkflowInstances)
        .set({
          status: 'completed',
          currentStepId: null,
          completedStepIds: [...completedStepIds, completedStepId],
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hrWorkflowInstances.id, instanceId));
      return;
    }
  }

  const nextStepId = applicableTransition?.toStepId;

  if (nextStepId === 'END') {
    // Complete workflow
    await db
      .update(hrWorkflowInstances)
      .set({
        status: 'completed',
        currentStepId: null,
        completedStepIds: [...completedStepIds, completedStepId],
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hrWorkflowInstances.id, instanceId));
    return;
  }

  // Find next step
  const nextStep = nextStepId
    ? steps.find(s => s.id === nextStepId)
    : steps[steps.findIndex(s => s.id === completedStepId) + 1];

  if (!nextStep) {
    // No more steps, complete workflow
    await db
      .update(hrWorkflowInstances)
      .set({
        status: 'completed',
        currentStepId: null,
        completedStepIds: [...completedStepIds, completedStepId],
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hrWorkflowInstances.id, instanceId));
    return;
  }

  // Resolve assignee
  const assigneeEmployeeId = await resolveAssignee(
    db,
    tenantId,
    nextStep.assignmentRole,
    instance.subjectEmployeeId
  );

  // Create next step instance
  await db
    .insert(hrWorkflowStepInstances)
    .values({
      tenantId,
      instanceId,
      stepId: nextStep.id,
      stepOrder: (completedStepIds.length + 1),
      assigneeRole: nextStep.assignmentRole,
      assigneeEmployeeId,
      assigneeUserId: null,
      status: nextStep.type === 'approval' ? 'pending' : 'in_progress',
      startedAt: new Date(),
      dueDate: nextStep.defaultDurationDays
        ? getDateAfterDays(nextStep.defaultDurationDays)
        : null,
    });

  // Update instance
  await db
    .update(hrWorkflowInstances)
    .set({
      currentStepId: nextStep.id,
      completedStepIds: [...completedStepIds, completedStepId],
      status: nextStep.type === 'approval' ? 'awaiting_approval' : 'in_progress',
      updatedAt: new Date(),
    })
    .where(eq(hrWorkflowInstances.id, instanceId));
}

export default hrWorkflowsRouter;
