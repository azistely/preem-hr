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
// ALERT ESCALATION EVENTS
// ============================================================================

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
// EVENT UNION TYPE (for type safety)
// ============================================================================

/**
 * Union of all event schemas
 * Used by Inngest for type-safe event handling
 */
export const eventSchemas = {
  'employee.terminated': employeeTerminatedEventSchema,
  'employee.hired': employeeHiredEventSchema,
  'salary.changed': salaryChangedEventSchema,
  'leave.approved': leaveApprovedEventSchema,
  'batch.operation.started': batchOperationStartedEventSchema,
  'batch.operation.completed': batchOperationCompletedEventSchema,
  'alert.escalation.needed': alertEscalationNeededEventSchema,
};

/**
 * Union type of all events
 */
export type PreemEvent =
  | EmployeeTerminatedEvent
  | EmployeeHiredEvent
  | SalaryChangedEvent
  | LeaveApprovedEvent
  | BatchOperationStartedEvent
  | BatchOperationCompletedEvent
  | AlertEscalationNeededEvent;

/**
 * Event names (for type-safe event publishing)
 */
export type EventName = keyof typeof eventSchemas;

/**
 * Get event data type by name
 */
export type EventData<T extends EventName> = z.infer<(typeof eventSchemas)[T]>['data'];
