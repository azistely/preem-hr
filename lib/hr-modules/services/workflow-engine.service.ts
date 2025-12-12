/**
 * Workflow Engine Service
 * Core workflow utility functions for state management and step handling
 *
 * Note: Database operations are handled in the tRPC router (server/routers/hr-workflows.ts)
 * and Inngest functions (lib/inngest/functions/hr-workflow-executor.ts).
 * This service provides pure utility functions for workflow logic.
 */

import type {
  WorkflowStepDefinition,
  WorkflowTransitionDefinition,
  WorkflowTransitionTrigger,
  WorkflowCondition,
  HrWorkflowDefinition,
} from '@/lib/db/schema/hr-workflows';

import type {
  WorkflowExecutionState,
  StepExecutionState,
  WorkflowProgress,
  StepDisplayInfo,
  WorkflowTimelineEvent,
  WorkflowAction,
} from '../types/workflow-engine.types';

// ============================================================================
// WORKFLOW STATE MANAGEMENT
// ============================================================================

/**
 * Determine if a workflow is in a terminal state
 */
export function isTerminalState(status: string): boolean {
  return ['completed', 'cancelled', 'expired', 'failed'].includes(status);
}

/**
 * Determine if a step is in a terminal state
 */
export function isStepTerminal(status: string): boolean {
  return ['completed', 'skipped', 'expired', 'failed'].includes(status);
}

/**
 * Get available actions for a step based on its type and state
 */
export function getStepAvailableActions(
  stepDefinition: WorkflowStepDefinition,
  stepStatus: string
): WorkflowAction[] {
  if (stepStatus !== 'in_progress') {
    return [];
  }

  const actions: WorkflowAction[] = [];

  switch (stepDefinition.type) {
    case 'form':
      actions.push({
        type: 'submit',
        label: 'Soumettre',
        variant: 'primary',
      });
      break;

    case 'approval':
      actions.push({
        type: 'approve',
        label: 'Approuver',
        variant: 'primary',
      });
      actions.push({
        type: 'reject',
        label: 'Rejeter',
        variant: 'destructive',
        requiresComment: stepDefinition.approvalConfig?.requireComment ?? false,
      });
      break;

    case 'review':
      actions.push({
        type: 'submit',
        label: 'Confirmer lecture',
        variant: 'primary',
      });
      break;
  }

  // Add skip action if allowed
  if (stepDefinition.canSkip) {
    actions.push({
      type: 'skip',
      label: 'Ignorer',
      variant: 'default',
    });
  }

  return actions;
}

// ============================================================================
// WORKFLOW ADVANCEMENT
// ============================================================================

/**
 * Get the next step based on transitions
 */
export function getNextStep(
  definition: HrWorkflowDefinition,
  currentStepId: string,
  trigger: WorkflowTransitionTrigger,
  contextData: Record<string, unknown>
): WorkflowStepDefinition | null {
  const steps = definition.steps as WorkflowStepDefinition[];
  const transitions = definition.transitions as WorkflowTransitionDefinition[];

  // Find matching transition
  const matchingTransition = transitions.find((t) => {
    if (t.fromStepId !== currentStepId && t.fromStepId !== '*') return false;
    if (t.trigger !== trigger) return false;

    // Evaluate conditions if present
    if (t.conditions && t.conditions.length > 0) {
      const conditionsMet = evaluateConditions(t.conditions, t.conditionLogic ?? 'AND', contextData);
      if (!conditionsMet) return false;
    }

    return true;
  });

  if (!matchingTransition) {
    // Default: find next step in sequence
    const currentIndex = steps.findIndex((s) => s.id === currentStepId);
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      return steps[currentIndex + 1];
    }
    return null;
  }

  if (matchingTransition.toStepId === 'END') {
    return null;
  }

  return steps.find((s) => s.id === matchingTransition.toStepId) ?? null;
}

/**
 * Get the step index in the workflow
 */
export function getStepIndex(definition: HrWorkflowDefinition, stepId: string): number {
  const steps = definition.steps as WorkflowStepDefinition[];
  return steps.findIndex((s) => s.id === stepId);
}

/**
 * Check if workflow should complete after this step
 */
export function shouldCompleteWorkflow(
  definition: HrWorkflowDefinition,
  currentStepId: string,
  trigger: WorkflowTransitionTrigger,
  contextData: Record<string, unknown>
): boolean {
  const nextStep = getNextStep(definition, currentStepId, trigger, contextData);
  return nextStep === null;
}

// ============================================================================
// CONDITION EVALUATION
// ============================================================================

/**
 * Evaluate workflow conditions
 */
export function evaluateConditions(
  conditions: WorkflowCondition[],
  logic: 'AND' | 'OR',
  contextData: Record<string, unknown>
): boolean {
  const results = conditions.map((condition) => evaluateCondition(condition, contextData));

  if (logic === 'AND') {
    return results.every((r) => r);
  } else {
    return results.some((r) => r);
  }
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: WorkflowCondition,
  contextData: Record<string, unknown>
): boolean {
  switch (condition.type) {
    case 'field_check': {
      if (!condition.field) return false;
      const fieldValue = contextData[condition.field];
      return compareValues(fieldValue, condition.operator ?? 'eq', condition.value);
    }
    case 'score_check': {
      if (!condition.scoreField || condition.scoreThreshold === undefined) return false;
      const score = contextData[condition.scoreField] as number;
      return score >= condition.scoreThreshold;
    }
    case 'date_check': {
      if (!condition.dateField || !condition.dateComparison) return false;
      const dateValue = new Date(contextData[condition.dateField] as string);
      const now = new Date();
      switch (condition.dateComparison) {
        case 'before':
          return dateValue < now;
        case 'after':
          return dateValue > now;
        case 'on':
          return dateValue.toDateString() === now.toDateString();
      }
      return false;
    }
    default:
      return true;
  }
}

/**
 * Compare values based on operator
 */
function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'gt':
      return (actual as number) > (expected as number);
    case 'gte':
      return (actual as number) >= (expected as number);
    case 'lt':
      return (actual as number) < (expected as number);
    case 'lte':
      return (actual as number) <= (expected as number);
    case 'contains':
      return String(actual).includes(String(expected));
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    default:
      return false;
  }
}

// ============================================================================
// PROGRESS CALCULATION
// ============================================================================

/**
 * Calculate workflow progress from step states
 */
export function calculateProgress(
  steps: WorkflowStepDefinition[],
  completedStepIds: string[],
  currentStepId: string | null
): WorkflowProgress {
  const totalSteps = steps.length;
  const completedSteps = completedStepIds.length;
  const currentStepIndex = currentStepId
    ? steps.findIndex((s) => s.id === currentStepId)
    : -1;

  return {
    instanceId: '', // To be filled by caller
    totalSteps,
    completedSteps,
    currentStep: currentStepIndex + 1,
    percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    isOverdue: false, // To be calculated by caller based on dueDate
  };
}

/**
 * Build step display info array
 */
export function buildStepDisplayInfo(
  steps: WorkflowStepDefinition[],
  stepStatuses: Record<string, string>,
  currentStepId: string | null
): Omit<StepDisplayInfo, 'availableActions'>[] {
  return steps.map((step, index) => {
    const status = stepStatuses[step.id] ?? 'pending';

    return {
      stepId: step.id,
      stepNumber: index + 1,
      name: step.name,
      description: step.description,
      icon: step.icon,
      type: step.type,
      status: status as StepExecutionState,
      isActive: status === 'in_progress',
      isCurrent: step.id === currentStepId,
      canBeSkipped: step.canSkip ?? false,
    };
  });
}

// ============================================================================
// TIMELINE GENERATION
// ============================================================================

/**
 * Build workflow timeline events
 */
export function buildTimeline(
  workflowCreatedAt: Date,
  workflowStartedAt: Date | null,
  workflowCompletedAt: Date | null,
  workflowStatus: string,
  stepEvents: Array<{
    stepId: string;
    stepName: string;
    completedAt: Date | null;
    status: string;
  }>
): WorkflowTimelineEvent[] {
  const timeline: WorkflowTimelineEvent[] = [
    {
      id: 'created',
      timestamp: workflowCreatedAt,
      type: 'created',
    },
  ];

  if (workflowStartedAt) {
    timeline.push({
      id: 'started',
      timestamp: workflowStartedAt,
      type: 'step_started',
    });
  }

  for (const event of stepEvents) {
    if (event.completedAt) {
      timeline.push({
        id: `step-${event.stepId}`,
        timestamp: event.completedAt,
        type: event.status === 'skipped' ? 'step_skipped' : 'step_completed',
        stepId: event.stepId,
        stepName: event.stepName,
      });
    }
  }

  if (workflowCompletedAt) {
    timeline.push({
      id: 'completed',
      timestamp: workflowCompletedAt,
      type: workflowStatus === 'cancelled' ? 'cancelled' : 'completed',
    });
  }

  return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ============================================================================
// DUE DATE CALCULATION
// ============================================================================

/**
 * Calculate step due date based on duration
 */
export function calculateStepDueDate(
  startDate: Date,
  durationDays: number | undefined
): Date | null {
  if (!durationDays || durationDays <= 0) return null;

  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + durationDays);
  return dueDate;
}

/**
 * Check if a step is overdue
 */
export function isStepOverdue(dueDate: Date | string | null): boolean {
  if (!dueDate) return false;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return due < new Date();
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(dueDate: Date | string | null): number {
  if (!dueDate) return 0;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  if (due >= now) return 0;
  return Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
}

// ============================================================================
// REFERENCE NUMBER GENERATION
// ============================================================================

/**
 * Generate a workflow reference number
 */
export function generateReferenceNumber(prefix = 'WF'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// STEP TYPE HELPERS
// ============================================================================

/**
 * Get icon for step type
 */
export function getStepTypeIcon(type: WorkflowStepDefinition['type']): string {
  const icons: Record<WorkflowStepDefinition['type'], string> = {
    form: 'FileText',
    approval: 'ThumbsUp',
    review: 'MessageSquare',
    notification: 'Bell',
    wait: 'Clock',
    parallel: 'GitBranch',
    conditional: 'GitMerge',
  };
  return icons[type] ?? 'Circle';
}

/**
 * Get French label for step type
 */
export function getStepTypeLabel(type: WorkflowStepDefinition['type']): string {
  const labels: Record<WorkflowStepDefinition['type'], string> = {
    form: 'Formulaire',
    approval: 'Approbation',
    review: 'Revue',
    notification: 'Notification',
    wait: 'Attente',
    parallel: 'Parallèle',
    conditional: 'Conditionnel',
  };
  return labels[type] ?? type;
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'gray',
    in_progress: 'blue',
    completed: 'green',
    skipped: 'yellow',
    expired: 'red',
    failed: 'red',
    cancelled: 'orange',
  };
  return colors[status] ?? 'gray';
}

/**
 * Get French label for status
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    in_progress: 'En cours',
    completed: 'Terminé',
    skipped: 'Ignoré',
    expired: 'Expiré',
    failed: 'Échoué',
    cancelled: 'Annulé',
    awaiting_approval: 'En attente d\'approbation',
  };
  return labels[status] ?? status;
}
