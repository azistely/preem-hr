/**
 * Inngest Event Type Definitions
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Event naming convention: {entity}.{action}[.status]
 * Examples: employee.hired, employee.terminated, salary.changed, leave.approved
 */

import { z } from 'zod';

/**
 * Base event metadata schema
 * Included in all events for tracking
 */
export const eventMetadataSchema = z.object({
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type EventMetadata = z.infer<typeof eventMetadataSchema>;

// ============================================================================
// EMPLOYEE LIFECYCLE EVENTS
// ============================================================================

/**
 * Event: employee.terminated
 * Triggered when an employee's contract is terminated
 * Actions: Calculate final payroll with prorations
 */
export const employeeTerminatedEventSchema = z.object({
  name: z.literal('employee.terminated'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    terminationDate: z.coerce.date(),
    reason: z.enum(['resignation', 'termination', 'retirement', 'end_of_contract']),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type EmployeeTerminatedEvent = z.infer<typeof employeeTerminatedEventSchema>;

/**
 * Event: employee.hired
 * Triggered when a new employee is hired
 * Actions: Calculate prorated first payroll, create onboarding workflow
 */
export const employeeHiredEventSchema = z.object({
  name: z.literal('employee.hired'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    hireDate: z.coerce.date(),
    startDate: z.coerce.date(),
    baseSalary: z.number().positive(),
    positionId: z.string().uuid(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type EmployeeHiredEvent = z.infer<typeof employeeHiredEventSchema>;

// ============================================================================
// SALARY CHANGE EVENTS
// ============================================================================

/**
 * Event: salary.changed
 * Triggered when an employee's salary is changed
 * Actions: Recalculate affected payroll runs
 */
export const salaryChangedEventSchema = z.object({
  name: z.literal('salary.changed'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    oldSalary: z.number().positive(),
    newSalary: z.number().positive(),
    effectiveDate: z.coerce.date(),
    reason: z.string().optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type SalaryChangedEvent = z.infer<typeof salaryChangedEventSchema>;

// ============================================================================
// LEAVE EVENTS
// ============================================================================

/**
 * Event: leave.approved
 * Triggered when a leave request is approved
 * Actions: Apply unpaid leave deductions if applicable
 */
export const leaveApprovedEventSchema = z.object({
  name: z.literal('leave.approved'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    leaveType: z.enum(['paid', 'unpaid', 'sick', 'maternity', 'paternity', 'annual']),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    days: z.number().positive(),
    isUnpaid: z.boolean(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type LeaveApprovedEvent = z.infer<typeof leaveApprovedEventSchema>;

// ============================================================================
// BATCH OPERATION EVENTS
// ============================================================================

/**
 * Event: batch.operation.started
 * Triggered when a batch operation starts
 * Actions: Track progress, send notifications
 */
export const batchOperationStartedEventSchema = z.object({
  name: z.literal('batch.operation.started'),
  data: z.object({
    operationId: z.string().uuid(),
    operationType: z.enum(['salary_update', 'document_generation', 'contract_renewal']),
    entityCount: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type BatchOperationStartedEvent = z.infer<typeof batchOperationStartedEventSchema>;

/**
 * Event: batch.operation.completed
 * Triggered when a batch operation completes
 * Actions: Send completion notification, create alert
 */
export const batchOperationCompletedEventSchema = z.object({
  name: z.literal('batch.operation.completed'),
  data: z.object({
    operationId: z.string().uuid(),
    operationType: z.enum(['salary_update', 'document_generation', 'contract_renewal']),
    successCount: z.number(),
    errorCount: z.number(),
    duration: z.number(), // milliseconds
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type BatchOperationCompletedEvent = z.infer<typeof batchOperationCompletedEventSchema>;

// ============================================================================
// EMPLOYEE STATUS EVENTS
// ============================================================================

/**
 * Event: employee.status.changed
 * Triggered when an employee's status changes (active, suspended, etc.)
 * Actions: Update workflows, notify stakeholders
 */
export const employeeStatusChangedEventSchema = z.object({
  name: z.literal('employee.status.changed'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    oldStatus: z.string(),
    newStatus: z.string(),
    reason: z.string().optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type EmployeeStatusChangedEvent = z.infer<typeof employeeStatusChangedEventSchema>;

/**
 * Event: employee.assignment.changed
 * Triggered when an employee's position/assignment changes
 * Actions: Update payroll calculations, notify relevant parties
 */
export const employeeAssignmentChangedEventSchema = z.object({
  name: z.literal('employee.assignment.changed'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    oldPositionId: z.string().uuid().optional(),
    newPositionId: z.string().uuid(),
    effectiveDate: z.coerce.date(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type EmployeeAssignmentChangedEvent = z.infer<typeof employeeAssignmentChangedEventSchema>;

// ============================================================================
// LEAVE EVENTS (Extended)
// ============================================================================

/**
 * Event: leave.request.created
 * Triggered when a new leave request is created
 * Actions: Create approval workflow, notify manager
 */
export const leaveRequestCreatedEventSchema = z.object({
  name: z.literal('leave.request.created'),
  data: z.object({
    leaveRequestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    leaveType: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    days: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type LeaveRequestCreatedEvent = z.infer<typeof leaveRequestCreatedEventSchema>;

/**
 * Event: leave.request.rejected
 * Triggered when a leave request is rejected
 * Actions: Notify employee with reason
 */
export const leaveRequestRejectedEventSchema = z.object({
  name: z.literal('leave.request.rejected'),
  data: z.object({
    leaveRequestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    reason: z.string(),
    rejectedBy: z.string().uuid(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type LeaveRequestRejectedEvent = z.infer<typeof leaveRequestRejectedEventSchema>;

/**
 * Event: leave.balance.low
 * Triggered when an employee's leave balance is low
 * Actions: Alert employee and manager
 */
export const leaveBalanceLowEventSchema = z.object({
  name: z.literal('leave.balance.low'),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    leaveType: z.string(),
    remainingDays: z.number(),
    threshold: z.number(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type LeaveBalanceLowEvent = z.infer<typeof leaveBalanceLowEventSchema>;

/**
 * Event: leave.upcoming
 * Triggered for upcoming leaves (notification reminder)
 * Actions: Notify team, ensure coverage
 */
export const leaveUpcomingEventSchema = z.object({
  name: z.literal('leave.upcoming'),
  data: z.object({
    leaveRequestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    daysUntilStart: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type LeaveUpcomingEvent = z.infer<typeof leaveUpcomingEventSchema>;

// ============================================================================
// PAYROLL EVENTS
// ============================================================================

/**
 * Event: payroll.run.started
 * Triggered when a payroll run starts
 * Actions: Track progress, prepare data
 */
export const payrollRunStartedEventSchema = z.object({
  name: z.literal('payroll.run.started'),
  data: z.object({
    payrollRunId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    employeeCount: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type PayrollRunStartedEvent = z.infer<typeof payrollRunStartedEventSchema>;

/**
 * Event: payroll.run.completed
 * Triggered when a payroll run completes successfully
 * Actions: Generate reports, send notifications
 */
export const payrollRunCompletedEventSchema = z.object({
  name: z.literal('payroll.run.completed'),
  data: z.object({
    payrollRunId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    employeeCount: z.number().positive(),
    totalNetSalary: z.number().positive(),
    totalDeductions: z.number().positive(),
    duration: z.number(), // milliseconds
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type PayrollRunCompletedEvent = z.infer<typeof payrollRunCompletedEventSchema>;

/**
 * Event: payroll.run.failed
 * Triggered when a payroll run fails
 * Actions: Alert finance team, create urgent task
 */
export const payrollRunFailedEventSchema = z.object({
  name: z.literal('payroll.run.failed'),
  data: z.object({
    payrollRunId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    errorMessage: z.string(),
    errorDetails: z.record(z.unknown()).optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type PayrollRunFailedEvent = z.infer<typeof payrollRunFailedEventSchema>;

/**
 * Event: payroll.run.calculate
 * Triggered to start background payroll calculation for large tenants
 * Actions: Process payroll in background with progress tracking
 */
export const payrollRunCalculateEventSchema = z.object({
  name: z.literal('payroll.run.calculate'),
  data: z.object({
    payrollRunId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    employeeCount: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type PayrollRunCalculateEvent = z.infer<typeof payrollRunCalculateEventSchema>;

/**
 * Event: payroll.payment.processed
 * Triggered when a payroll payment is processed
 * Actions: Update payment status, send confirmations
 */
export const payrollPaymentProcessedEventSchema = z.object({
  name: z.literal('payroll.payment.processed'),
  data: z.object({
    payrollRunId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    amount: z.number().positive(),
    paymentMethod: z.string(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type PayrollPaymentProcessedEvent = z.infer<typeof payrollPaymentProcessedEventSchema>;

// ============================================================================
// CONTRACT EVENTS
// ============================================================================

/**
 * Event: contract.expiring
 * Triggered when a contract is expiring soon
 * Actions: Trigger renewal workflow, create alerts
 */
export const contractExpiringEventSchema = z.object({
  name: z.literal('contract.expiring'),
  data: z.object({
    contractId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    expiryDate: z.coerce.date(),
    daysUntilExpiry: z.number().positive(),
    contractType: z.string(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type ContractExpiringEvent = z.infer<typeof contractExpiringEventSchema>;

/**
 * Event: contract.renewed
 * Triggered when a contract is renewed
 * Actions: Update employee record, notify stakeholders
 */
export const contractRenewedEventSchema = z.object({
  name: z.literal('contract.renewed'),
  data: z.object({
    contractId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    newStartDate: z.coerce.date(),
    newEndDate: z.coerce.date(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type ContractRenewedEvent = z.infer<typeof contractRenewedEventSchema>;

/**
 * Event: contract.terminated
 * Triggered when a contract is terminated early
 * Actions: Calculate final payroll, trigger offboarding
 */
export const contractTerminatedEventSchema = z.object({
  name: z.literal('contract.terminated'),
  data: z.object({
    contractId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    terminationDate: z.coerce.date(),
    reason: z.string(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type ContractTerminatedEvent = z.infer<typeof contractTerminatedEventSchema>;

// ============================================================================
// DOCUMENT EVENTS
// ============================================================================

/**
 * Event: document.uploaded
 * Triggered when a document is uploaded
 * Actions: Process document, extract metadata
 */
export const documentUploadedEventSchema = z.object({
  name: z.literal('document.uploaded'),
  data: z.object({
    documentId: z.string().uuid(),
    employeeId: z.string().uuid().optional(),
    documentType: z.string(),
    fileName: z.string(),
    fileSize: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type DocumentUploadedEvent = z.infer<typeof documentUploadedEventSchema>;

/**
 * Event: document.expiring
 * Triggered when a document is about to expire
 * Actions: Create alerts, notify employee
 */
export const documentExpiringEventSchema = z.object({
  name: z.literal('document.expiring'),
  data: z.object({
    documentId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    documentType: z.string(),
    expiryDate: z.coerce.date(),
    daysUntilExpiry: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type DocumentExpiringEvent = z.infer<typeof documentExpiringEventSchema>;

/**
 * Event: document.expired
 * Triggered when a document has expired
 * Actions: Suspend employee, alert compliance
 */
export const documentExpiredEventSchema = z.object({
  name: z.literal('document.expired'),
  data: z.object({
    documentId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    documentType: z.string(),
    expiryDate: z.coerce.date(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type DocumentExpiredEvent = z.infer<typeof documentExpiredEventSchema>;

// ============================================================================
// WORKFLOW EVENTS
// ============================================================================

/**
 * Event: workflow.created
 * Triggered when a workflow is created
 * Actions: Initialize workflow, prepare execution
 */
export const workflowCreatedEventSchema = z.object({
  name: z.literal('workflow.created'),
  data: z.object({
    workflowId: z.string().uuid(),
    workflowName: z.string(),
    triggerType: z.string(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type WorkflowCreatedEvent = z.infer<typeof workflowCreatedEventSchema>;

/**
 * Event: workflow.started
 * Triggered when a workflow execution starts
 * Actions: Track execution, initialize state
 */
export const workflowStartedEventSchema = z.object({
  name: z.literal('workflow.started'),
  data: z.object({
    workflowId: z.string().uuid(),
    executionId: z.string().uuid(),
    triggerEventId: z.string().uuid().optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type WorkflowStartedEvent = z.infer<typeof workflowStartedEventSchema>;

/**
 * Event: workflow.step.completed
 * Triggered when a workflow step completes
 * Actions: Move to next step, update progress
 */
export const workflowStepCompletedEventSchema = z.object({
  name: z.literal('workflow.step.completed'),
  data: z.object({
    workflowId: z.string().uuid(),
    executionId: z.string().uuid(),
    stepIndex: z.number(),
    stepType: z.string(),
    output: z.record(z.unknown()).optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type WorkflowStepCompletedEvent = z.infer<typeof workflowStepCompletedEventSchema>;

/**
 * Event: workflow.completed
 * Triggered when a workflow execution completes
 * Actions: Send notifications, clean up resources
 */
export const workflowCompletedEventSchema = z.object({
  name: z.literal('workflow.completed'),
  data: z.object({
    workflowId: z.string().uuid(),
    executionId: z.string().uuid(),
    duration: z.number(), // milliseconds
    result: z.record(z.unknown()).optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type WorkflowCompletedEvent = z.infer<typeof workflowCompletedEventSchema>;

/**
 * Event: workflow.failed
 * Triggered when a workflow execution fails
 * Actions: Log error, send alerts, retry if configured
 */
export const workflowFailedEventSchema = z.object({
  name: z.literal('workflow.failed'),
  data: z.object({
    workflowId: z.string().uuid(),
    executionId: z.string().uuid(),
    stepIndex: z.number(),
    errorMessage: z.string(),
    errorDetails: z.record(z.unknown()).optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type WorkflowFailedEvent = z.infer<typeof workflowFailedEventSchema>;

// ============================================================================
// ALERT EVENTS
// ============================================================================

/**
 * Event: alert.created
 * Triggered when a new alert is created
 * Actions: Send notifications, update dashboards
 */
export const alertCreatedEventSchema = z.object({
  name: z.literal('alert.created'),
  data: z.object({
    alertId: z.string().uuid(),
    alertType: z.string(),
    severity: z.enum(['info', 'warning', 'urgent']),
    assigneeId: z.string().uuid(),
    employeeId: z.string().uuid().optional(),
    dueDate: z.coerce.date().optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type AlertCreatedEvent = z.infer<typeof alertCreatedEventSchema>;

/**
 * Event: alert.dismissed
 * Triggered when an alert is dismissed
 * Actions: Update metrics, track dismissal patterns
 */
export const alertDismissedEventSchema = z.object({
  name: z.literal('alert.dismissed'),
  data: z.object({
    alertId: z.string().uuid(),
    alertType: z.string(),
    dismissedBy: z.string().uuid(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type AlertDismissedEvent = z.infer<typeof alertDismissedEventSchema>;

/**
 * Event: alert.completed
 * Triggered when an alert is marked complete
 * Actions: Update metrics, archive alert
 */
export const alertCompletedEventSchema = z.object({
  name: z.literal('alert.completed'),
  data: z.object({
    alertId: z.string().uuid(),
    alertType: z.string(),
    completedBy: z.string().uuid(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type AlertCompletedEvent = z.infer<typeof alertCompletedEventSchema>;

/**
 * Event: alert.escalation.needed
 * Triggered when an alert needs escalation (overdue)
 * Actions: Escalate to manager's manager, send urgent notification
 */
export const alertEscalationNeededEventSchema = z.object({
  name: z.literal('alert.escalation.needed'),
  data: z.object({
    alertId: z.string().uuid(),
    alertType: z.string(),
    originalAssigneeId: z.string().uuid(),
    daysOverdue: z.number().positive(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type AlertEscalationNeededEvent = z.infer<typeof alertEscalationNeededEventSchema>;

// ============================================================================
// BATCH OPERATION EVENTS (Extended)
// ============================================================================

/**
 * Event: batch.operation.failed
 * Triggered when a batch operation fails
 * Actions: Alert admins, create error report
 */
export const batchOperationFailedEventSchema = z.object({
  name: z.literal('batch.operation.failed'),
  data: z.object({
    operationId: z.string().uuid(),
    operationType: z.string(),
    errorMessage: z.string(),
    errorDetails: z.record(z.unknown()).optional(),
    tenantId: z.string().uuid(),
    metadata: eventMetadataSchema.optional(),
  }),
});

export type BatchOperationFailedEvent = z.infer<typeof batchOperationFailedEventSchema>;

// ============================================================================
// EVENT UNION TYPE (for type safety)
// ============================================================================

/**
 * Union of all event schemas
 * Used by Inngest for type-safe event handling
 */
export const eventSchemas = {
  // Employee lifecycle
  'employee.hired': employeeHiredEventSchema,
  'employee.terminated': employeeTerminatedEventSchema,
  'employee.status.changed': employeeStatusChangedEventSchema,
  'employee.assignment.changed': employeeAssignmentChangedEventSchema,

  // Salary
  'salary.changed': salaryChangedEventSchema,

  // Leave
  'leave.request.created': leaveRequestCreatedEventSchema,
  'leave.request.rejected': leaveRequestRejectedEventSchema,
  'leave.approved': leaveApprovedEventSchema,
  'leave.balance.low': leaveBalanceLowEventSchema,
  'leave.upcoming': leaveUpcomingEventSchema,

  // Payroll
  'payroll.run.started': payrollRunStartedEventSchema,
  'payroll.run.completed': payrollRunCompletedEventSchema,
  'payroll.run.failed': payrollRunFailedEventSchema,
  'payroll.run.calculate': payrollRunCalculateEventSchema,
  'payroll.payment.processed': payrollPaymentProcessedEventSchema,

  // Contract
  'contract.expiring': contractExpiringEventSchema,
  'contract.renewed': contractRenewedEventSchema,
  'contract.terminated': contractTerminatedEventSchema,

  // Document
  'document.uploaded': documentUploadedEventSchema,
  'document.expiring': documentExpiringEventSchema,
  'document.expired': documentExpiredEventSchema,

  // Workflow
  'workflow.created': workflowCreatedEventSchema,
  'workflow.started': workflowStartedEventSchema,
  'workflow.step.completed': workflowStepCompletedEventSchema,
  'workflow.completed': workflowCompletedEventSchema,
  'workflow.failed': workflowFailedEventSchema,

  // Alert
  'alert.created': alertCreatedEventSchema,
  'alert.dismissed': alertDismissedEventSchema,
  'alert.completed': alertCompletedEventSchema,
  'alert.escalation.needed': alertEscalationNeededEventSchema,

  // Batch operations
  'batch.operation.started': batchOperationStartedEventSchema,
  'batch.operation.completed': batchOperationCompletedEventSchema,
  'batch.operation.failed': batchOperationFailedEventSchema,
};

/**
 * Union type of all events
 */
export type PreemEvent =
  // Employee
  | EmployeeHiredEvent
  | EmployeeTerminatedEvent
  | EmployeeStatusChangedEvent
  | EmployeeAssignmentChangedEvent
  // Salary
  | SalaryChangedEvent
  // Leave
  | LeaveRequestCreatedEvent
  | LeaveRequestRejectedEvent
  | LeaveApprovedEvent
  | LeaveBalanceLowEvent
  | LeaveUpcomingEvent
  // Payroll
  | PayrollRunStartedEvent
  | PayrollRunCompletedEvent
  | PayrollRunFailedEvent
  | PayrollRunCalculateEvent
  | PayrollPaymentProcessedEvent
  // Contract
  | ContractExpiringEvent
  | ContractRenewedEvent
  | ContractTerminatedEvent
  // Document
  | DocumentUploadedEvent
  | DocumentExpiringEvent
  | DocumentExpiredEvent
  // Workflow
  | WorkflowCreatedEvent
  | WorkflowStartedEvent
  | WorkflowStepCompletedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  // Alert
  | AlertCreatedEvent
  | AlertDismissedEvent
  | AlertCompletedEvent
  | AlertEscalationNeededEvent
  // Batch
  | BatchOperationStartedEvent
  | BatchOperationCompletedEvent
  | BatchOperationFailedEvent;

/**
 * Event names (for type-safe event publishing)
 */
export type EventName = keyof typeof eventSchemas;

/**
 * Get event data type by name
 */
export type EventData<T extends EventName> = z.infer<(typeof eventSchemas)[T]>['data'];

/**
 * Helper function to emit events safely
 */
export function createEvent<T extends EventName>(
  name: T,
  data: EventData<T>
): z.infer<(typeof eventSchemas)[T]> {
  return { name, data } as z.infer<(typeof eventSchemas)[T]>;
}
