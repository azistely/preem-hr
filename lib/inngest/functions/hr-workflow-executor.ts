/**
 * HR Workflow Executor Inngest Functions
 * Epic: Performance Management & Training Modules
 *
 * Specialized workflow executor for HR modules:
 * - Performance evaluation workflows
 * - Training request workflows
 * - Competency assessment workflows
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import {
  hrWorkflowDefinitions,
  hrWorkflowInstances,
  hrWorkflowStepInstances,
} from '@/lib/db/schema/hr-workflows';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, or, isNull, lte, sql } from 'drizzle-orm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface StepConfig {
  type?: string;
  waitDays?: number;
  escalateAfterDays?: number;
}

// ============================================================================
// HR WORKFLOW STEP EXECUTOR
// ============================================================================

/**
 * HR Workflow Step Executor
 * Executes individual workflow steps based on type
 */
export const hrWorkflowStepExecutorFunction = inngest.createFunction(
  {
    id: 'hr-workflow-step-executor',
    name: 'HR Workflow Step Executor',
    retries: 3,
  },
  { event: 'hr.workflow.step.ready' },
  async ({ event, step }) => {
    const { stepInstanceId, tenantId } = event.data;

    // Step 1: Get step instance with workflow and definition
    const stepData = await step.run('get-step-data', async () => {
      // Get step instance
      const stepInstance = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(eq(hrWorkflowStepInstances.id, stepInstanceId))
        .limit(1);

      if (!stepInstance[0]) {
        throw new Error(`Step instance not found: ${stepInstanceId}`);
      }

      // Get workflow instance
      const instance = await db
        .select()
        .from(hrWorkflowInstances)
        .where(eq(hrWorkflowInstances.id, stepInstance[0].instanceId))
        .limit(1);

      if (!instance[0]) {
        throw new Error(`Workflow instance not found: ${stepInstance[0].instanceId}`);
      }

      // Get workflow definition
      const definition = await db
        .select()
        .from(hrWorkflowDefinitions)
        .where(eq(hrWorkflowDefinitions.id, instance[0].definitionId))
        .limit(1);

      return {
        ...stepInstance[0],
        instance: instance[0],
        definition: definition[0] ?? null,
      };
    });

    const stepConfig = stepData.stepConfig as StepConfig | null;
    const stepType = stepConfig?.type;

    // Step 2: Execute based on step type
    switch (stepType) {
      case 'notification':
        await step.run('send-notification', async () => {
          // Get assignee email
          if (stepData.assigneeEmployeeId) {
            const assignee = await db
              .select()
              .from(employees)
              .where(eq(employees.id, stepData.assigneeEmployeeId))
              .limit(1);

            if (assignee[0]?.email) {
              // Send notification email (placeholder - integrate with email service)
              console.log(`Sending notification to ${assignee[0].email}`);
              // TODO: Integrate with email service
            }
          }

          // Mark step as completed
          await db
            .update(hrWorkflowStepInstances)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(hrWorkflowStepInstances.id, stepInstanceId));

          return { notificationSent: true };
        });
        break;

      case 'wait':
        // For wait steps, calculate when to advance
        const waitDays = stepConfig?.waitDays ?? 1;
        await step.sleep(`wait-${waitDays}-days`, `${waitDays}d`);

        await step.run('complete-wait-step', async () => {
          await db
            .update(hrWorkflowStepInstances)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(hrWorkflowStepInstances.id, stepInstanceId));
        });
        break;

      case 'form':
      case 'approval':
      case 'review':
        // These steps require human action, just ensure status is correct
        await step.run('update-step-status', async () => {
          await db
            .update(hrWorkflowStepInstances)
            .set({
              status: 'in_progress',
              startedAt: stepData.startedAt ? new Date(stepData.startedAt) : new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(hrWorkflowStepInstances.id, stepInstanceId),
                eq(hrWorkflowStepInstances.status, 'pending')
              )
            );
        });
        break;

      default:
        console.warn(`Unknown step type: ${stepType}`);
    }

    // Step 3: Check if we should advance the workflow
    await step.run('check-workflow-advancement', async () => {
      const completedStep = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(eq(hrWorkflowStepInstances.id, stepInstanceId))
        .limit(1);

      if (completedStep[0]?.status === 'completed') {
        // Send event to advance workflow
        await inngest.send({
          name: 'hr.workflow.advance',
          data: {
            instanceId: stepData.instanceId,
            completedStepId: stepInstanceId,
            tenantId,
          },
        });
      }
    });

    return {
      message: `Step ${stepType} executed`,
      stepInstanceId,
      status: 'processed',
    };
  }
);

// ============================================================================
// HR WORKFLOW REMINDER SENDER
// ============================================================================

/**
 * HR Workflow Reminder Sender
 * Sends reminders for pending workflow steps
 */
export const hrWorkflowReminderFunction = inngest.createFunction(
  {
    id: 'hr-workflow-reminder-sender',
    name: 'HR Workflow Reminder Sender',
    retries: 2,
  },
  // Run daily at 9 AM
  { cron: '0 9 * * *' },
  async ({ step }) => {
    // Step 1: Find all pending steps that need reminders
    const pendingSteps = await step.run('find-pending-steps', async () => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Find in_progress steps where due date is approaching or passed
      const steps = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(
          and(
            eq(hrWorkflowStepInstances.status, 'in_progress'),
            or(
              // Due date is today or past
              lte(hrWorkflowStepInstances.dueDate, today),
              isNull(hrWorkflowStepInstances.dueDate)
            )
          )
        );

      return steps;
    });

    if (pendingSteps.length === 0) {
      return { message: 'No pending steps require reminders' };
    }

    // Step 2: Send reminders for each step
    const reminderResults: Array<{ stepId: string; sent: boolean; reason?: string; email?: string }> = [];

    for (const pendingStep of pendingSteps) {
      const result = await step.run(`send-reminder-${pendingStep.id}`, async () => {
        // Get assignee info
        if (!pendingStep.assigneeEmployeeId) {
          return { stepId: pendingStep.id, sent: false, reason: 'No assignee' };
        }

        const assignee = await db
          .select()
          .from(employees)
          .where(eq(employees.id, pendingStep.assigneeEmployeeId))
          .limit(1);

        if (!assignee[0]?.email) {
          return { stepId: pendingStep.id, sent: false, reason: 'No email' };
        }

        // Increment reminder count
        await db
          .update(hrWorkflowStepInstances)
          .set({
            remindersSent: sql`COALESCE(${hrWorkflowStepInstances.remindersSent}, 0) + 1`,
            lastReminderAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, pendingStep.id));

        // TODO: Send actual email
        console.log(`Reminder sent to ${assignee[0].email} for step ${pendingStep.id}`);

        return { stepId: pendingStep.id, sent: true, email: assignee[0].email };
      });

      reminderResults.push(result);
    }

    return {
      message: `Processed ${pendingSteps.length} pending steps`,
      reminders: reminderResults,
    };
  }
);

// ============================================================================
// HR WORKFLOW ESCALATION HANDLER
// ============================================================================

/**
 * HR Workflow Escalation Handler
 * Escalates overdue workflow steps to managers
 */
export const hrWorkflowEscalationFunction = inngest.createFunction(
  {
    id: 'hr-workflow-escalation-handler',
    name: 'HR Workflow Escalation Handler',
    retries: 2,
  },
  // Run daily at 10 AM (after reminders)
  { cron: '0 10 * * *' },
  async ({ step }) => {
    // Step 1: Find overdue steps that need escalation
    const overdueSteps = await step.run('find-overdue-steps', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      // Find steps that are significantly overdue (2+ days past due)
      const steps = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(
          and(
            eq(hrWorkflowStepInstances.status, 'in_progress'),
            lte(hrWorkflowStepInstances.dueDate, twoDaysAgoStr)
          )
        );

      return steps;
    });

    if (overdueSteps.length === 0) {
      return { message: 'No steps require escalation' };
    }

    // Step 2: Escalate each step
    const escalationResults: Array<{
      stepId: string;
      escalated: boolean;
      reason?: string;
      escalatedTo?: string;
      daysPastDue?: number;
    }> = [];

    for (const overdueStep of overdueSteps) {
      const result = await step.run(`escalate-${overdueStep.id}`, async () => {
        const stepConfig = overdueStep.stepConfig as StepConfig | null;
        const escalateAfterDays = stepConfig?.escalateAfterDays ?? 3;

        // Check if step is past escalation threshold
        const dueDate = overdueStep.dueDate ? new Date(overdueStep.dueDate) : null;
        if (!dueDate) {
          return { stepId: overdueStep.id, escalated: false, reason: 'No due date' };
        }

        const daysPastDue = Math.floor(
          (Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (daysPastDue < escalateAfterDays) {
          return { stepId: overdueStep.id, escalated: false, reason: 'Not past threshold' };
        }

        // Get original assignee and their manager
        if (!overdueStep.assigneeEmployeeId) {
          return { stepId: overdueStep.id, escalated: false, reason: 'No assignee' };
        }

        const assignee = await db
          .select()
          .from(employees)
          .where(eq(employees.id, overdueStep.assigneeEmployeeId))
          .limit(1);

        if (!assignee[0]?.reportingManagerId) {
          return { stepId: overdueStep.id, escalated: false, reason: 'No manager' };
        }

        const manager = await db
          .select()
          .from(employees)
          .where(eq(employees.id, assignee[0].reportingManagerId))
          .limit(1);

        if (!manager[0]?.email) {
          return { stepId: overdueStep.id, escalated: false, reason: 'Manager has no email' };
        }

        // Mark as escalated
        await db
          .update(hrWorkflowStepInstances)
          .set({
            isEscalated: true,
            escalatedAt: new Date(),
            escalatedToEmployeeId: manager[0].id,
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, overdueStep.id));

        // TODO: Send escalation email to manager
        console.log(`Escalated step ${overdueStep.id} to manager ${manager[0].email}`);

        return {
          stepId: overdueStep.id,
          escalated: true,
          escalatedTo: manager[0].email,
          daysPastDue,
        };
      });

      escalationResults.push(result);
    }

    return {
      message: `Processed ${overdueSteps.length} overdue steps`,
      escalations: escalationResults.filter(r => r.escalated),
    };
  }
);

// ============================================================================
// HR WORKFLOW ADVANCE
// ============================================================================

/**
 * HR Workflow Advance
 * Advances workflow to next step after a step completes
 */
export const hrWorkflowAdvanceFunction = inngest.createFunction(
  {
    id: 'hr-workflow-advance',
    name: 'HR Workflow Advance',
    retries: 3,
  },
  { event: 'hr.workflow.advance' },
  async ({ event, step }) => {
    const { instanceId, completedStepId, tenantId } = event.data;

    // Step 1: Get workflow instance with all steps
    const instanceData = await step.run('get-instance-data', async () => {
      const instance = await db
        .select()
        .from(hrWorkflowInstances)
        .where(eq(hrWorkflowInstances.id, instanceId))
        .limit(1);

      if (!instance[0]) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      const definition = await db
        .select()
        .from(hrWorkflowDefinitions)
        .where(eq(hrWorkflowDefinitions.id, instance[0].definitionId))
        .limit(1);

      const steps = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(eq(hrWorkflowStepInstances.instanceId, instanceId))
        .orderBy(hrWorkflowStepInstances.stepOrder);

      return {
        ...instance[0],
        definition: definition[0] ?? null,
        stepInstances: steps,
      };
    });

    // Step 2: Find next pending step
    const nextStep = await step.run('find-next-step', async () => {
      const pendingSteps = instanceData.stepInstances.filter(
        (s) => s.status === 'pending'
      );

      if (pendingSteps.length === 0) {
        // No more pending steps - workflow is complete
        return null;
      }

      // Get the next step in order
      return pendingSteps[0];
    });

    // Step 3: Either start next step or complete workflow
    if (nextStep) {
      await step.run('start-next-step', async () => {
        // Update step to in_progress
        await db
          .update(hrWorkflowStepInstances)
          .set({
            status: 'in_progress',
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowStepInstances.id, nextStep.id));

        // Update workflow currentStepId
        await db
          .update(hrWorkflowInstances)
          .set({
            currentStepId: nextStep.id,
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowInstances.id, instanceId));

        // Send event to execute the step
        await inngest.send({
          name: 'hr.workflow.step.ready',
          data: {
            stepInstanceId: nextStep.id,
            tenantId,
          },
        });
      });

      return {
        message: 'Advanced to next step',
        instanceId,
        nextStepId: nextStep.id,
      };
    } else {
      // Complete the workflow
      await step.run('complete-workflow', async () => {
        await db
          .update(hrWorkflowInstances)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(hrWorkflowInstances.id, instanceId));

        // Send completion event
        await inngest.send({
          name: 'hr.workflow.completed',
          data: {
            instanceId,
            tenantId,
            definitionId: instanceData.definitionId,
          },
        });
      });

      return {
        message: 'Workflow completed',
        instanceId,
      };
    }
  }
);

// ============================================================================
// HR WORKFLOW START
// ============================================================================

/**
 * HR Workflow Start
 * Starts a new workflow instance
 */
export const hrWorkflowStartFunction = inngest.createFunction(
  {
    id: 'hr-workflow-start',
    name: 'HR Workflow Start',
    retries: 3,
  },
  { event: 'hr.workflow.start' },
  async ({ event, step }) => {
    const { instanceId, tenantId } = event.data;

    // Step 1: Get workflow instance with definition
    const instanceData = await step.run('get-instance-data', async () => {
      const instance = await db
        .select()
        .from(hrWorkflowInstances)
        .where(eq(hrWorkflowInstances.id, instanceId))
        .limit(1);

      if (!instance[0]) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      const definition = await db
        .select()
        .from(hrWorkflowDefinitions)
        .where(eq(hrWorkflowDefinitions.id, instance[0].definitionId))
        .limit(1);

      const steps = await db
        .select()
        .from(hrWorkflowStepInstances)
        .where(eq(hrWorkflowStepInstances.instanceId, instanceId))
        .orderBy(hrWorkflowStepInstances.stepOrder);

      return {
        ...instance[0],
        definition: definition[0] ?? null,
        stepInstances: steps,
      };
    });

    // Step 2: Start first step
    const firstStep = instanceData.stepInstances[0];

    if (!firstStep) {
      throw new Error('Workflow has no steps');
    }

    await step.run('start-first-step', async () => {
      // Update first step to in_progress
      await db
        .update(hrWorkflowStepInstances)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hrWorkflowStepInstances.id, firstStep.id));

      // Update workflow status and current step
      await db
        .update(hrWorkflowInstances)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          currentStepId: firstStep.id,
          updatedAt: new Date(),
        })
        .where(eq(hrWorkflowInstances.id, instanceId));

      // Send event to execute the first step
      await inngest.send({
        name: 'hr.workflow.step.ready',
        data: {
          stepInstanceId: firstStep.id,
          tenantId,
        },
      });
    });

    return {
      message: 'Workflow started',
      instanceId,
      firstStepId: firstStep.id,
    };
  }
);

// Export all functions
export const hrWorkflowFunctions = [
  hrWorkflowStepExecutorFunction,
  hrWorkflowReminderFunction,
  hrWorkflowEscalationFunction,
  hrWorkflowAdvanceFunction,
  hrWorkflowStartFunction,
];
