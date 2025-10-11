/**
 * Event Registry - Type-Safe Event Definitions
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 3
 *
 * Centralized registry of all Inngest events with Zod schemas for validation.
 * Provides type safety and documentation for event payloads.
 */

import { z } from 'zod';

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Employee Status Changed Event
 * Triggered when employee employment status changes (hired/terminated/suspended)
 */
export const employeeStatusChangedSchema = z.object({
  employeeId: z.string().uuid(),
  oldStatus: z.enum(['active', 'terminated', 'suspended']),
  newStatus: z.enum(['active', 'terminated', 'suspended']),
  tenantId: z.string().uuid(),
  changedBy: z.string().uuid(),
  reason: z.string().optional(),
  effectiveDate: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Leave Status Changed Event
 * Triggered when leave request status changes (approved/rejected)
 */
export const leaveStatusChangedSchema = z.object({
  requestId: z.string().uuid(),
  employeeId: z.string().uuid(),
  oldStatus: z.enum(['pending', 'approved', 'rejected']),
  newStatus: z.enum(['pending', 'approved', 'rejected']),
  leaveType: z.string(), // 'annual', 'sick', 'unpaid', etc.
  startDate: z.date(),
  endDate: z.date(),
  tenantId: z.string().uuid(),
  approvedBy: z.string().uuid().optional(),
  rejectionReason: z.string().optional(),
});

/**
 * Payroll Run Completed Event
 * Triggered when payroll calculation completes successfully
 */
export const payrollRunCompletedSchema = z.object({
  payrollRunId: z.string().uuid(),
  tenantId: z.string().uuid(),
  period: z.object({
    month: z.number().min(1).max(12),
    year: z.number(),
  }),
  employeesCount: z.number().int().positive(),
  totalNetSalaries: z.number(),
  totalDeductions: z.number(),
  totalEmployerCosts: z.number(),
  status: z.enum(['calculated', 'approved', 'paid']),
  completedBy: z.string().uuid(),
  completedAt: z.date(),
});

/**
 * Alert Created Event
 * Triggered when a new alert is created
 */
export const alertCreatedSchema = z.object({
  alertId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: z.string(),
  severity: z.enum(['info', 'warning', 'urgent']),
  assigneeId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  message: z.string(),
  createdAt: z.date(),
});

/**
 * Batch Operation Completed Event
 * Triggered when a batch operation finishes
 */
export const batchOperationCompletedSchema = z.object({
  operationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  operationType: z.string(),
  status: z.enum(['completed', 'failed', 'partial']),
  totalCount: z.number().int(),
  successCount: z.number().int(),
  errorCount: z.number().int(),
  durationMs: z.number().int(),
  completedAt: z.date(),
});

/**
 * Employee Hired Event
 * Triggered when a new employee is hired
 */
export const employeeHiredSchema = z.object({
  employeeId: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeName: z.string(),
  hireDate: z.date(),
  baseSalary: z.number().positive(),
  positionId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
});

/**
 * Employee Terminated Event
 * Triggered when an employee is terminated
 */
export const employeeTerminatedSchema = z.object({
  employeeId: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeName: z.string(),
  terminationDate: z.date(),
  reason: z.string(),
  terminationType: z.enum(['resignation', 'dismissal', 'retirement', 'end_of_contract']),
});

/**
 * Salary Changed Event
 * Triggered when employee salary changes
 */
export const salaryChangedSchema = z.object({
  employeeId: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeName: z.string(),
  oldSalary: z.number().positive(),
  newSalary: z.number().positive(),
  effectiveFrom: z.date(),
  reason: z.string().optional(),
  changedBy: z.string().uuid(),
});

/**
 * Leave Approved Event
 * Triggered when leave request is approved
 */
export const leaveApprovedSchema = z.object({
  requestId: z.string().uuid(),
  employeeId: z.string().uuid(),
  tenantId: z.string().uuid(),
  leaveType: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  daysCount: z.number().int().positive(),
  approvedBy: z.string().uuid(),
  approvedAt: z.date(),
});

// ============================================================================
// Event Registry
// ============================================================================

export const eventSchemas = {
  'employee.status.changed': employeeStatusChangedSchema,
  'leave.status.changed': leaveStatusChangedSchema,
  'payroll.run.completed': payrollRunCompletedSchema,
  'alert.created': alertCreatedSchema,
  'batch.operation.completed': batchOperationCompletedSchema,
  'employee.hired': employeeHiredSchema,
  'employee.terminated': employeeTerminatedSchema,
  'salary.changed': salaryChangedSchema,
  'leave.approved': leaveApprovedSchema,
} as const;

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Get the payload type for a specific event
 *
 * @example
 * type EmployeeHiredPayload = EventPayload<'employee.hired'>;
 */
export type EventPayload<T extends keyof typeof eventSchemas> =
  z.infer<typeof eventSchemas[T]>;

/**
 * Get all event names
 */
export type EventName = keyof typeof eventSchemas;

/**
 * Union type of all possible event payloads
 */
export type AnyEventPayload = {
  [K in EventName]: { name: K; data: EventPayload<K> };
}[EventName];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate event payload against its schema
 *
 * @param eventName - Name of the event
 * @param payload - Event payload to validate
 * @returns Validated and typed payload
 * @throws ZodError if validation fails
 */
export function validateEventPayload<T extends EventName>(
  eventName: T,
  payload: unknown
): EventPayload<T> {
  const schema = eventSchemas[eventName];
  return schema.parse(payload);
}

/**
 * Check if event payload is valid without throwing
 *
 * @param eventName - Name of the event
 * @param payload - Event payload to check
 * @returns True if valid, false otherwise
 */
export function isValidEventPayload<T extends EventName>(
  eventName: T,
  payload: unknown
): payload is EventPayload<T> {
  const schema = eventSchemas[eventName];
  return schema.safeParse(payload).success;
}

/**
 * Get event documentation
 *
 * @param eventName - Name of the event
 * @returns Event documentation object
 */
export function getEventDocumentation(eventName: EventName): {
  name: EventName;
  description: string;
  triggeredBy: string;
  payload: Record<string, string>;
} {
  const docs: Record<EventName, {
    name: EventName;
    description: string;
    triggeredBy: string;
    payload: Record<string, string>;
  }> = {
    'employee.status.changed': {
      name: 'employee.status.changed',
      description: 'Déclenché quand le statut d\'emploi d\'un employé change',
      triggeredBy: 'Modification du statut dans l\'interface RH ou API',
      payload: {
        employeeId: 'UUID de l\'employé',
        oldStatus: 'Ancien statut (active/terminated/suspended)',
        newStatus: 'Nouveau statut (active/terminated/suspended)',
        tenantId: 'UUID du tenant',
        changedBy: 'UUID de l\'utilisateur qui a fait le changement',
        reason: 'Raison du changement (optionnel)',
        effectiveDate: 'Date d\'effet du changement',
      },
    },
    'leave.status.changed': {
      name: 'leave.status.changed',
      description: 'Déclenché quand le statut d\'une demande de congé change',
      triggeredBy: 'Approbation ou rejet d\'une demande de congé',
      payload: {
        requestId: 'UUID de la demande de congé',
        employeeId: 'UUID de l\'employé',
        oldStatus: 'Ancien statut (pending/approved/rejected)',
        newStatus: 'Nouveau statut (pending/approved/rejected)',
        leaveType: 'Type de congé (annual/sick/unpaid)',
        startDate: 'Date de début du congé',
        endDate: 'Date de fin du congé',
        tenantId: 'UUID du tenant',
        approvedBy: 'UUID de l\'approbateur (optionnel)',
      },
    },
    'payroll.run.completed': {
      name: 'payroll.run.completed',
      description: 'Déclenché quand un calcul de paie est terminé',
      triggeredBy: 'Fin du calcul de paie mensuelle',
      payload: {
        payrollRunId: 'UUID de la paie',
        tenantId: 'UUID du tenant',
        period: 'Période (mois et année)',
        employeesCount: 'Nombre d\'employés payés',
        totalNetSalaries: 'Total des salaires nets',
        totalDeductions: 'Total des déductions',
        totalEmployerCosts: 'Total des charges patronales',
        status: 'Statut (calculated/approved/paid)',
        completedBy: 'UUID de l\'utilisateur',
        completedAt: 'Date et heure de fin',
      },
    },
    'alert.created': {
      name: 'alert.created',
      description: 'Déclenché quand une alerte est créée',
      triggeredBy: 'Création d\'alerte automatique ou manuelle',
      payload: {
        alertId: 'UUID de l\'alerte',
        tenantId: 'UUID du tenant',
        type: 'Type d\'alerte',
        severity: 'Sévérité (info/warning/urgent)',
        assigneeId: 'UUID de l\'assigné',
        employeeId: 'UUID de l\'employé concerné (optionnel)',
        message: 'Message de l\'alerte',
        createdAt: 'Date et heure de création',
      },
    },
    'batch.operation.completed': {
      name: 'batch.operation.completed',
      description: 'Déclenché quand une opération groupée est terminée',
      triggeredBy: 'Fin d\'une opération batch',
      payload: {
        operationId: 'UUID de l\'opération',
        tenantId: 'UUID du tenant',
        operationType: 'Type d\'opération',
        status: 'Statut (completed/failed/partial)',
        totalCount: 'Nombre total d\'éléments',
        successCount: 'Nombre de succès',
        errorCount: 'Nombre d\'erreurs',
        durationMs: 'Durée en millisecondes',
        completedAt: 'Date et heure de fin',
      },
    },
    'employee.hired': {
      name: 'employee.hired',
      description: 'Déclenché quand un nouvel employé est embauché',
      triggeredBy: 'Création d\'un nouvel employé dans le système',
      payload: {
        employeeId: 'UUID de l\'employé',
        tenantId: 'UUID du tenant',
        employeeName: 'Nom complet de l\'employé',
        hireDate: 'Date d\'embauche',
        baseSalary: 'Salaire de base',
        positionId: 'UUID du poste',
        departmentId: 'UUID du département (optionnel)',
      },
    },
    'employee.terminated': {
      name: 'employee.terminated',
      description: 'Déclenché quand un employé est terminé',
      triggeredBy: 'Termination d\'un employé',
      payload: {
        employeeId: 'UUID de l\'employé',
        tenantId: 'UUID du tenant',
        employeeName: 'Nom complet de l\'employé',
        terminationDate: 'Date de fin',
        reason: 'Raison de la termination',
        terminationType: 'Type (resignation/dismissal/retirement/end_of_contract)',
      },
    },
    'salary.changed': {
      name: 'salary.changed',
      description: 'Déclenché quand le salaire d\'un employé change',
      triggeredBy: 'Modification du salaire dans le système',
      payload: {
        employeeId: 'UUID de l\'employé',
        tenantId: 'UUID du tenant',
        employeeName: 'Nom complet de l\'employé',
        oldSalary: 'Ancien salaire',
        newSalary: 'Nouveau salaire',
        effectiveFrom: 'Date d\'effet',
        reason: 'Raison du changement (optionnel)',
        changedBy: 'UUID de l\'utilisateur',
      },
    },
    'leave.approved': {
      name: 'leave.approved',
      description: 'Déclenché quand une demande de congé est approuvée',
      triggeredBy: 'Approbation d\'une demande de congé',
      payload: {
        requestId: 'UUID de la demande',
        employeeId: 'UUID de l\'employé',
        tenantId: 'UUID du tenant',
        leaveType: 'Type de congé',
        startDate: 'Date de début',
        endDate: 'Date de fin',
        daysCount: 'Nombre de jours',
        approvedBy: 'UUID de l\'approbateur',
        approvedAt: 'Date et heure d\'approbation',
      },
    },
  };

  return docs[eventName];
}

/**
 * Type-safe event emitter helper
 *
 * @example
 * import { emitEvent } from '@/lib/inngest/event-registry';
 * import { sendEvent } from '@/lib/inngest/client';
 *
 * await emitEvent('employee.hired', {
 *   employeeId: '...',
 *   tenantId: '...',
 *   employeeName: 'Jean Dupont',
 *   hireDate: new Date(),
 *   baseSalary: 300000,
 *   positionId: '...',
 * });
 */
export async function emitEvent<T extends EventName>(
  eventName: T,
  payload: EventPayload<T>,
  sendFn: (event: { name: string; data: unknown }) => Promise<void>
): Promise<void> {
  // Validate payload before sending
  const validatedPayload = validateEventPayload(eventName, payload);

  // Send event via Inngest
  await sendFn({
    name: eventName,
    data: validatedPayload,
  });
}
