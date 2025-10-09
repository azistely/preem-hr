/**
 * Workflow Executor Inngest Function
 * Epic: Phase 4 - Visual Workflow Builder
 *
 * Listens for employee/* events and triggers matching workflows.
 * Executes user-defined workflow automations.
 */

import { inngest } from '../client';
import { executeWorkflow } from '@/lib/workflow/workflow-engine';
import { db } from '@/lib/db';
import { workflowDefinitions } from '@/lib/db/schema/workflows';
import { eq, and } from 'drizzle-orm';

/**
 * Workflow executor function
 * Listens to all employee lifecycle events and triggers matching workflows
 */
export const workflowExecutorFunction = inngest.createFunction(
  {
    id: 'workflow-executor',
    name: 'Workflow Executor',
    retries: 3,
  },
  // Listen to multiple event patterns
  [
    { event: 'employee.hired' },
    { event: 'employee.terminated' },
    { event: 'employee.promoted' },
    { event: 'employee.transferred' },
    { event: 'salary.changed' },
    { event: 'leave.approved' },
    { event: 'leave.rejected' },
    { event: 'contract.expiring' },
    { event: 'document.expiring' },
  ],
  async ({ event, step }) => {
    const eventName = event.name;
    const eventData = event.data;

    // Step 1: Find workflows matching this event type
    const matchingWorkflows = await step.run('find-matching-workflows', async () => {
      // Get tenant ID from event data
      const tenantId = eventData.tenantId;

      if (!tenantId) {
        console.warn(`Event ${eventName} missing tenantId, skipping workflow execution`);
        return [];
      }

      // Find active workflows with matching trigger type
      const workflows = await db.query.workflowDefinitions.findMany({
        where: and(
          eq(workflowDefinitions.tenantId, tenantId),
          eq(workflowDefinitions.status, 'active'),
          eq(workflowDefinitions.triggerType, eventName)
        ),
      });

      return workflows;
    });

    if (matchingWorkflows.length === 0) {
      return {
        message: `No active workflows found for event: ${eventName}`,
        eventId: event.id,
      };
    }

    // Step 2: Execute each matching workflow
    const results = [];
    for (const workflow of matchingWorkflows) {
      const result = await step.run(`execute-workflow-${workflow.id}`, async () => {
        try {
          const executionResult = await executeWorkflow(
            workflow.id,
            eventData,
            event.id
          );

          return {
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: executionResult.status,
            executionId: executionResult.executionId,
            durationMs: executionResult.durationMs,
            errorMessage: executionResult.errorMessage,
          };
        } catch (error) {
          console.error(`Error executing workflow ${workflow.id}:`, error);
          return {
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      results.push(result);
    }

    // Step 3: Return summary
    return {
      message: `Executed ${matchingWorkflows.length} workflow(s) for event: ${eventName}`,
      eventId: event.id,
      eventName,
      workflows: results,
    };
  }
);

/**
 * Manual workflow trigger function
 * Allows HR managers to manually trigger workflows for testing
 */
export const manualWorkflowTriggerFunction = inngest.createFunction(
  {
    id: 'manual-workflow-trigger',
    name: 'Manual Workflow Trigger',
  },
  { event: 'workflow.manual_trigger' },
  async ({ event, step }) => {
    const { workflowId, testData, tenantId } = event.data;

    // Execute workflow with test data
    const result = await step.run('execute-workflow', async () => {
      try {
        const executionResult = await executeWorkflow(
          workflowId,
          testData || {},
          event.id
        );

        return {
          workflowId,
          status: executionResult.status,
          executionId: executionResult.executionId,
          durationMs: executionResult.durationMs,
          conditionsEvaluated: executionResult.conditionsEvaluated,
          actionsExecuted: executionResult.actionsExecuted,
          errorMessage: executionResult.errorMessage,
        };
      } catch (error) {
        console.error(`Error manually executing workflow ${workflowId}:`, error);
        return {
          workflowId,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    return {
      message: 'Manual workflow execution completed',
      result,
    };
  }
);
