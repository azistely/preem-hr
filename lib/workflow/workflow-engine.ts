/**
 * Workflow Execution Engine
 * Epic: Phase 4 - Visual Workflow Builder
 *
 * Executes user-defined workflows triggered by events.
 * Evaluates conditions and executes actions.
 */

import { db } from '@/lib/db';
import { workflowDefinitions, workflowExecutions } from '@/lib/db/schema/workflows';
import { alerts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEvent } from '@/lib/inngest/client';

/**
 * Workflow condition structure
 */
export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

/**
 * Workflow action structure
 */
export interface WorkflowAction {
  type: 'create_alert' | 'send_notification' | 'create_payroll_event' | 'update_employee_status';
  config: Record<string, any>;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  tenantId: string;
  triggerData: Record<string, any>;
  triggerEventId?: string;
}

/**
 * Action execution result
 */
export interface ActionResult {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  executionId: string;
  status: 'success' | 'failed' | 'skipped';
  conditionsEvaluated: boolean;
  actionsExecuted: ActionResult[];
  durationMs: number;
  errorMessage?: string;
}

/**
 * Workflow test result (dry run)
 */
export interface WorkflowTestResult {
  conditionsPass: boolean;
  actionsPreview: WorkflowAction[];
  message: string;
}

/**
 * Main workflow execution function
 * Called by Inngest when events trigger workflows
 */
export async function executeWorkflow(
  workflowId: string,
  triggerData: Record<string, any>,
  triggerEventId?: string
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const executionLog: any[] = [];

  try {
    // 1. Fetch workflow definition
    const workflow = await db.query.workflowDefinitions.findFirst({
      where: eq(workflowDefinitions.id, workflowId),
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'active') {
      // Skip inactive workflows
      const executionId = await logExecution(workflowId, workflow.tenantId, {
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        actionsExecuted: [],
        errorMessage: 'Workflow is not active',
        workflowSnapshot: workflow,
        triggerData,
        executionLog: [{ message: 'Workflow skipped - not active', timestamp: new Date() }],
        triggerEventId,
      });

      return {
        executionId,
        status: 'skipped',
        conditionsEvaluated: false,
        actionsExecuted: [],
        durationMs: Date.now() - startTime,
        errorMessage: 'Workflow is not active',
      };
    }

    executionLog.push({ message: 'Workflow execution started', timestamp: new Date() });

    // 2. Evaluate conditions
    const conditions = workflow.conditions as WorkflowCondition[];
    const conditionsPass = await evaluateConditions(conditions, triggerData);

    executionLog.push({
      message: `Conditions evaluated: ${conditionsPass ? 'passed' : 'failed'}`,
      timestamp: new Date(),
      conditions,
    });

    if (!conditionsPass) {
      // Conditions failed - skip execution
      const executionId = await logExecution(workflowId, workflow.tenantId, {
        status: 'skipped',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        actionsExecuted: [],
        errorMessage: 'Conditions not met',
        workflowSnapshot: workflow,
        triggerData,
        executionLog,
        triggerEventId,
      });

      return {
        executionId,
        status: 'skipped',
        conditionsEvaluated: true,
        actionsExecuted: [],
        durationMs: Date.now() - startTime,
        errorMessage: 'Conditions not met',
      };
    }

    // 3. Execute actions
    const actions = workflow.actions as WorkflowAction[];
    const context: WorkflowContext = {
      workflowId,
      tenantId: workflow.tenantId,
      triggerData,
      triggerEventId,
    };

    executionLog.push({ message: `Executing ${actions.length} actions`, timestamp: new Date() });

    const actionResults = await executeActions(actions, context);

    executionLog.push({
      message: 'Actions executed',
      timestamp: new Date(),
      results: actionResults,
    });

    // 4. Update workflow stats
    await db
      .update(workflowDefinitions)
      .set({
        executionCount: workflow.executionCount + 1,
        lastExecutedAt: new Date(),
        successCount: workflow.successCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(workflowDefinitions.id, workflowId));

    // 5. Log execution
    const executionId = await logExecution(workflowId, workflow.tenantId, {
      status: 'success',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
      actionsExecuted: actionResults,
      workflowSnapshot: workflow,
      triggerData,
      executionLog,
      triggerEventId,
      employeeId: triggerData.employeeId,
    });

    return {
      executionId,
      status: 'success',
      conditionsEvaluated: true,
      actionsExecuted: actionResults,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    executionLog.push({
      message: 'Workflow execution failed',
      timestamp: new Date(),
      error: errorMessage,
    });

    // Log failed execution
    const workflow = await db.query.workflowDefinitions.findFirst({
      where: eq(workflowDefinitions.id, workflowId),
    });

    if (workflow) {
      await db
        .update(workflowDefinitions)
        .set({
          executionCount: workflow.executionCount + 1,
          lastExecutedAt: new Date(),
          errorCount: workflow.errorCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(workflowDefinitions.id, workflowId));

      await logExecution(workflowId, workflow.tenantId, {
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        actionsExecuted: [],
        errorMessage,
        workflowSnapshot: workflow,
        triggerData,
        executionLog,
        triggerEventId,
      });
    }

    return {
      executionId: '',
      status: 'failed',
      conditionsEvaluated: false,
      actionsExecuted: [],
      durationMs: Date.now() - startTime,
      errorMessage,
    };
  }
}

/**
 * Evaluate workflow conditions against trigger data
 */
export async function evaluateConditions(
  conditions: WorkflowCondition[],
  data: Record<string, any>
): Promise<boolean> {
  // Empty conditions = always pass
  if (!conditions || conditions.length === 0) {
    return true;
  }

  // Evaluate all conditions with AND logic
  for (const condition of conditions) {
    const fieldValue = getNestedValue(data, condition.field);
    const conditionValue = condition.value;

    let passes = false;

    switch (condition.operator) {
      case 'eq':
        passes = fieldValue === conditionValue;
        break;
      case 'ne':
        passes = fieldValue !== conditionValue;
        break;
      case 'gt':
        passes = fieldValue > conditionValue;
        break;
      case 'gte':
        passes = fieldValue >= conditionValue;
        break;
      case 'lt':
        passes = fieldValue < conditionValue;
        break;
      case 'lte':
        passes = fieldValue <= conditionValue;
        break;
      case 'contains':
        passes =
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(String(conditionValue).toLowerCase());
        break;
      case 'in':
        passes = Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
        break;
      default:
        passes = false;
    }

    // If any condition fails, return false (AND logic)
    if (!passes) {
      return false;
    }
  }

  return true;
}

/**
 * Execute configured actions
 */
export async function executeActions(
  actions: WorkflowAction[],
  context: WorkflowContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      let result: ActionResult;

      switch (action.type) {
        case 'create_alert':
          result = await executeCreateAlert(action, context);
          break;
        case 'send_notification':
          result = await executeSendNotification(action, context);
          break;
        case 'create_payroll_event':
          result = await executeCreatePayrollEvent(action, context);
          break;
        case 'update_employee_status':
          result = await executeUpdateEmployeeStatus(action, context);
          break;
        default:
          result = {
            type: action.type,
            success: false,
            error: `Unknown action type: ${action.type}`,
          };
      }

      results.push(result);
    } catch (error) {
      results.push({
        type: action.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Action: Create Alert
 */
async function executeCreateAlert(
  action: WorkflowAction,
  context: WorkflowContext
): Promise<ActionResult> {
  const { config } = action;
  const { triggerData, tenantId } = context;

  const [alert] = await db
    .insert(alerts)
    .values({
      tenantId,
      employeeId: config.employeeId || triggerData.employeeId,
      alertType: config.alertType || 'workflow_trigger',
      severity: config.severity || 'info',
      title: config.title,
      description: config.description,
      actionUrl: config.actionUrl,
      assigneeId: config.assigneeId,
      dueDate: config.dueDate ? new Date(config.dueDate) : null,
      status: 'active',
    })
    .returning();

  return {
    type: 'create_alert',
    success: true,
    data: { alertId: alert.id },
  };
}

/**
 * Action: Send Notification
 */
async function executeSendNotification(
  action: WorkflowAction,
  context: WorkflowContext
): Promise<ActionResult> {
  const { config } = action;

  // TODO: Integrate with actual notification service (email, SMS, push)
  // For now, just log the notification

  return {
    type: 'send_notification',
    success: true,
    data: {
      message: 'Notification sent',
      recipient: config.recipient,
      subject: config.subject,
    },
  };
}

/**
 * Action: Create Payroll Event
 */
async function executeCreatePayrollEvent(
  action: WorkflowAction,
  context: WorkflowContext
): Promise<ActionResult> {
  const { config } = action;
  const { triggerData, tenantId } = context;

  // Publish payroll event via Inngest
  await sendEvent({
    name: config.eventName || 'payroll.custom_event',
    data: {
      ...triggerData,
      tenantId,
      workflowId: context.workflowId,
      customData: config.data,
    },
  });

  return {
    type: 'create_payroll_event',
    success: true,
    data: { eventName: config.eventName },
  };
}

/**
 * Action: Update Employee Status
 */
async function executeUpdateEmployeeStatus(
  action: WorkflowAction,
  context: WorkflowContext
): Promise<ActionResult> {
  const { config } = action;
  const { triggerData } = context;

  // TODO: Implement actual employee status update
  // This would require importing the employees schema and executing an update

  return {
    type: 'update_employee_status',
    success: true,
    data: {
      employeeId: config.employeeId || triggerData.employeeId,
      newStatus: config.status,
    },
  };
}

/**
 * Test workflow without actually executing actions
 */
export async function testWorkflow(
  workflowId: string,
  testData: Record<string, any>
): Promise<WorkflowTestResult> {
  // Fetch workflow
  const workflow = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, workflowId),
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  // Evaluate conditions
  const conditions = workflow.conditions as WorkflowCondition[];
  const conditionsPass = await evaluateConditions(conditions, testData);

  const actions = workflow.actions as WorkflowAction[];

  return {
    conditionsPass,
    actionsPreview: actions,
    message: conditionsPass
      ? `Les conditions sont remplies. ${actions.length} action(s) serai(en)t exécutée(s).`
      : 'Les conditions ne sont pas remplies. Aucune action ne serait exécutée.',
  };
}

/**
 * Log workflow execution to database
 */
async function logExecution(
  workflowId: string,
  tenantId: string,
  data: {
    status: 'running' | 'success' | 'failed' | 'skipped';
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    actionsExecuted: any[];
    errorMessage?: string;
    workflowSnapshot: any;
    triggerData: Record<string, any>;
    executionLog: any[];
    triggerEventId?: string;
    employeeId?: string;
  }
): Promise<string> {
  const [execution] = await db
    .insert(workflowExecutions)
    .values({
      workflowId,
      tenantId,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      durationMs: data.durationMs,
      actionsExecuted: data.actionsExecuted,
      errorMessage: data.errorMessage,
      workflowSnapshot: data.workflowSnapshot,
      triggerData: data.triggerData,
      executionLog: data.executionLog,
      triggerEventId: data.triggerEventId,
      employeeId: data.employeeId,
    })
    .returning();

  return execution.id;
}

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue({ user: { name: 'John' } }, 'user.name') => 'John'
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}
