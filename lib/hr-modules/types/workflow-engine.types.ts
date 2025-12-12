/**
 * Workflow Engine Type Definitions
 * Types for workflow execution, state management, and step handling
 */

import type {
  WorkflowStepType,
  WorkflowAssignmentRole,
  WorkflowTransitionTrigger,
  WorkflowStepDefinition,
  WorkflowTransitionDefinition,
  WorkflowCondition,
  ReminderScheduleConfig,
  EscalationRuleConfig,
  HrWorkflowDefinition,
  HrWorkflowInstance,
  HrWorkflowStepInstance,
} from '@/lib/db/schema/hr-workflows';

// Re-export schema types
export type {
  WorkflowStepType,
  WorkflowAssignmentRole,
  WorkflowTransitionTrigger,
  WorkflowStepDefinition,
  WorkflowTransitionDefinition,
  WorkflowCondition,
  ReminderScheduleConfig,
  EscalationRuleConfig,
  HrWorkflowDefinition,
  HrWorkflowInstance,
  HrWorkflowStepInstance,
};

// ============================================================================
// WORKFLOW EXECUTION TYPES
// ============================================================================

/**
 * Workflow execution state
 */
export type WorkflowExecutionState =
  | 'idle'
  | 'running'
  | 'waiting_for_input'
  | 'waiting_for_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Step execution state
 */
export type StepExecutionState =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'awaiting_action'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'timed_out';

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  instanceId: string;
  definitionId: string;
  tenantId: string;
  subjectEmployeeId: string;
  sourceType: string;
  sourceId: string;
  currentStepId: string | null;
  completedStepIds: string[];
  contextData: Record<string, unknown>;
  executionState: WorkflowExecutionState;
}

/**
 * Step execution context
 */
export interface StepExecutionContext {
  stepInstance: HrWorkflowStepInstance;
  stepDefinition: WorkflowStepDefinition;
  workflowContext: WorkflowExecutionContext;
  assigneeInfo: AssigneeInfo;
}

/**
 * Assignee resolution info
 */
export interface AssigneeInfo {
  role: WorkflowAssignmentRole;
  employeeId?: string;
  userId?: string;
  employeeName?: string;
  email?: string;
}

// ============================================================================
// WORKFLOW ACTIONS
// ============================================================================

/**
 * Available workflow action
 */
export interface WorkflowAction {
  type: 'submit' | 'approve' | 'reject' | 'skip' | 'delegate' | 'cancel';
  label: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'destructive';
  requiresComment?: boolean;
  requiresConfirmation?: boolean;
}

/**
 * Workflow action input
 */
export interface WorkflowActionInput {
  instanceId: string;
  stepInstanceId: string;
  action: WorkflowAction['type'];
  comment?: string;
  formSubmissionId?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Workflow action result
 */
export interface WorkflowActionResult {
  success: boolean;
  newState: WorkflowExecutionState;
  nextStepId?: string;
  error?: string;
  notifications?: WorkflowNotification[];
}

// ============================================================================
// WORKFLOW NOTIFICATIONS
// ============================================================================

/**
 * Notification type
 */
export type WorkflowNotificationType =
  | 'assignment'
  | 'reminder'
  | 'escalation'
  | 'completion'
  | 'rejection'
  | 'action_required';

/**
 * Workflow notification
 */
export interface WorkflowNotification {
  type: WorkflowNotificationType;
  recipientUserId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  templateSlug?: string;
  channels: ('email' | 'in_app' | 'push')[];
  priority: 'low' | 'normal' | 'high';
  scheduledAt?: Date;
}

// ============================================================================
// WORKFLOW PROGRESS & VISUALIZATION
// ============================================================================

/**
 * Workflow progress summary
 */
export interface WorkflowProgress {
  instanceId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: number;
  percentComplete: number;
  estimatedCompletionDate?: Date;
  isOverdue: boolean;
  daysOverdue?: number;
}

/**
 * Step display info (for UI)
 */
export interface StepDisplayInfo {
  stepId: string;
  stepNumber: number;
  name: string;
  description?: string;
  icon?: string;
  type: WorkflowStepType;
  status: StepExecutionState;
  assignee?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  dueDate?: Date;
  completedAt?: Date;
  isActive: boolean;
  isCurrent: boolean;
  canBeSkipped: boolean;
  availableActions: WorkflowAction[];
}

/**
 * Workflow visualization data
 */
export interface WorkflowVisualization {
  instanceId: string;
  definitionName: string;
  subjectEmployee: {
    id: string;
    name: string;
    jobTitle?: string;
    department?: string;
  };
  progress: WorkflowProgress;
  steps: StepDisplayInfo[];
  timeline: WorkflowTimelineEvent[];
}

/**
 * Timeline event for workflow history
 */
export interface WorkflowTimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'step_started' | 'step_completed' | 'step_skipped' |
        'approved' | 'rejected' | 'comment_added' | 'escalated' | 'completed' | 'cancelled';
  stepId?: string;
  stepName?: string;
  actor?: {
    userId: string;
    name: string;
  };
  details?: string;
  comment?: string;
}

// ============================================================================
// WORKFLOW TEMPLATES & PRESETS
// ============================================================================

/**
 * Workflow template metadata
 */
export interface WorkflowTemplateMetadata {
  slug: string;
  name: string;
  description: string;
  module: 'performance' | 'training' | 'shared';
  category: string;
  targetCompanySize?: 'small' | 'medium' | 'large' | 'all';
  countryCode?: string;
  version: string;
  estimatedDurationDays: number;
}

/**
 * Pre-built workflow template slugs
 */
export const WorkflowTemplates = {
  // Performance
  ANNUAL_REVIEW_SIMPLE: 'annual-review-simple',
  ANNUAL_REVIEW_STANDARD: 'annual-review-standard',
  ANNUAL_REVIEW_360: 'annual-review-360',
  QUARTERLY_CHECK_IN: 'quarterly-check-in',
  PEER_FEEDBACK: 'peer-feedback',
  OBJECTIVE_SETTING: 'objective-setting',

  // Training
  TRAINING_REQUEST: 'training-request',
  TRAINING_COMPLETION: 'training-completion',
  CERTIFICATION_RENEWAL: 'certification-renewal',
  COMPETENCY_ASSESSMENT: 'competency-assessment',
} as const;

export type WorkflowTemplateSlug = typeof WorkflowTemplates[keyof typeof WorkflowTemplates];

// ============================================================================
// WORKFLOW CONFIGURATION HELPERS
// ============================================================================

/**
 * Create a simple approval step definition
 */
export function createApprovalStep(
  id: string,
  name: string,
  role: WorkflowAssignmentRole,
  options?: Partial<WorkflowStepDefinition>
): WorkflowStepDefinition {
  return {
    id,
    type: 'approval',
    name,
    assignmentRole: role,
    approvalConfig: {
      requireComment: false,
      allowDelegation: true,
      ...options?.approvalConfig,
    },
    notifyOnAssignment: true,
    notifyOnDue: true,
    notifyOnOverdue: true,
    ...options,
  };
}

/**
 * Create a form step definition
 */
export function createFormStep(
  id: string,
  name: string,
  role: WorkflowAssignmentRole,
  formTemplateSlug: string,
  options?: Partial<WorkflowStepDefinition>
): WorkflowStepDefinition {
  return {
    id,
    type: 'form',
    name,
    assignmentRole: role,
    formTemplateSlug,
    notifyOnAssignment: true,
    notifyOnDue: true,
    notifyOnOverdue: true,
    ...options,
  };
}

/**
 * Create a transition definition
 */
export function createTransition(
  id: string,
  fromStepId: string,
  toStepId: string,
  trigger: WorkflowTransitionTrigger,
  options?: Partial<WorkflowTransitionDefinition>
): WorkflowTransitionDefinition {
  return {
    id,
    fromStepId,
    toStepId,
    trigger,
    ...options,
  };
}

// ============================================================================
// ASSIGNEE RESOLUTION
// ============================================================================

/**
 * Assignee resolution request
 */
export interface AssigneeResolutionRequest {
  role: WorkflowAssignmentRole;
  subjectEmployeeId: string;
  tenantId: string;
  customAssigneeField?: string;
  contextData?: Record<string, unknown>;
}

/**
 * Assignee resolution result
 */
export interface AssigneeResolutionResult {
  resolved: boolean;
  employeeId?: string;
  userId?: string;
  error?: string;
}

/**
 * Assignment role labels (French)
 */
export const AssignmentRoleLabels: Record<WorkflowAssignmentRole, string> = {
  employee: 'Collaborateur',
  manager: 'Manager direct',
  skip_level_manager: 'N+2',
  hr_manager: 'Responsable RH',
  hr_admin: 'Admin RH',
  peer: 'Collègue',
  custom: 'Personnalisé',
};
