/**
 * Inngest API Route Handler
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * This route serves the Inngest functions to the Inngest Cloud or Dev Server.
 * It handles incoming events and scheduled function invocations.
 *
 * Endpoint: POST /api/inngest
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Import all Inngest functions
import { dailyAlertsFunction, manualAlertsFunction } from '@/lib/inngest/functions/daily-alerts';
import { employeeTerminatedFunction } from '@/lib/inngest/functions/employee-terminated';
import { employeeHiredFunction } from '@/lib/inngest/functions/employee-hired';
import { salaryChangedFunction } from '@/lib/inngest/functions/salary-changed';
import { leaveApprovedFunction } from '@/lib/inngest/functions/leave-approved';
import { alertEscalationFunction } from '@/lib/inngest/functions/alert-escalation';
import { batchOperationCompletedFunction } from '@/lib/inngest/functions/batch-operation-completed';
import { batchOperationProcessorFunction } from '@/lib/inngest/functions/batch-operation-processor';
import { workflowExecutorFunction, manualWorkflowTriggerFunction } from '@/lib/inngest/functions/workflow-executor';
import { healthCheckFunction, manualHealthCheckFunction } from '@/lib/inngest/functions/health-check';
import { sendAlertEmail } from '@/lib/inngest/functions/send-alert-email';

// Phase 3: Additional event-driven functions
import { employeeStatusChangedFunction } from '@/lib/inngest/functions/employee-status-changed';
import { leaveStatusChangedFunction } from '@/lib/inngest/functions/leave-status-changed';
import { payrollRunCompletedFunction } from '@/lib/inngest/functions/payroll-run-completed';

// Payroll background processing
import {
  payrollCalculationFunction,
  payrollCalculationFailedFunction,
} from '@/lib/inngest/functions/payroll-calculation';

// Week 16: Digital Registre du Personnel
import { registreEmployeeHiredFunction } from '@/lib/inngest/functions/registre-employee-hired';
import { registreEmployeeTerminatedFunction } from '@/lib/inngest/functions/registre-employee-terminated';

// Document Management System
import {
  documentApprovalWorkflow,
  documentRejectionHandler,
} from '@/lib/inngest/functions/document-approval-workflow';
import {
  documentExpiryCheckFunction,
  criticalDocumentExpiredHandler,
} from '@/lib/inngest/functions/document-expiry-reminders';

// Leave Planning System
import { leaveReminder20Days } from '@/lib/inngest/functions/leave-reminder-20d';
import { leaveReminder15Days } from '@/lib/inngest/functions/leave-reminder-15d';

// Compliance Tracker Reminders
import {
  complianceActionReminders,
  complianceWeeklySummary,
} from '@/lib/inngest/functions/compliance-reminders';

// Termination background processing (3G resilience)
import {
  terminationProcessingFunction,
  terminationProcessingFailedFunction,
} from '@/lib/inngest/functions/termination-processing';

// HR Workflow Engine (Performance & Training modules)
import { hrWorkflowFunctions } from '@/lib/inngest/functions/hr-workflow-executor';
import { performanceTrainingIntegrationFunctions } from '@/lib/inngest/functions/performance-training-integration';

/**
 * Register all Inngest functions with the API route
 * The serve() function automatically handles:
 * - Event routing
 * - Scheduled function invocations
 * - Retry logic
 * - Step function orchestration
 */
const handler = serve({
  client: inngest,
  functions: [
    // Scheduled jobs
    dailyAlertsFunction,
    manualAlertsFunction,
    healthCheckFunction,
    manualHealthCheckFunction,

    // Event-driven functions (employee lifecycle)
    employeeTerminatedFunction,
    employeeHiredFunction,
    salaryChangedFunction,
    leaveApprovedFunction,

    // Phase 3: Additional event-driven functions
    employeeStatusChangedFunction,
    leaveStatusChangedFunction,
    payrollRunCompletedFunction,

    // Payroll background processing
    payrollCalculationFunction,
    payrollCalculationFailedFunction,

    // Week 16: Digital Registre du Personnel
    registreEmployeeHiredFunction,
    registreEmployeeTerminatedFunction,

    // Event-driven functions (system)
    alertEscalationFunction,
    sendAlertEmail, // Email notifications for alerts
    batchOperationCompletedFunction,
    batchOperationProcessorFunction,

    // Workflow automation (Phase 4)
    workflowExecutorFunction,
    manualWorkflowTriggerFunction,

    // Document Management System
    documentApprovalWorkflow,
    documentRejectionHandler,
    documentExpiryCheckFunction,
    criticalDocumentExpiredHandler,

    // Leave Planning System
    leaveReminder20Days,
    leaveReminder15Days,

    // Compliance Tracker Reminders
    complianceActionReminders,
    complianceWeeklySummary,

    // Termination background processing (3G resilience)
    terminationProcessingFunction,
    terminationProcessingFailedFunction,

    // HR Workflow Engine (Performance & Training modules)
    ...hrWorkflowFunctions,

    // Performance ↔ Training Integration
    ...performanceTrainingIntegrationFunctions,
  ],

  // Streaming: Return results as they complete (improves performance)
  streaming: 'allow',

  // Signature verification (production only)
  signingKey: process.env.INNGEST_SIGNING_KEY,

  // Custom logging (optional)
  logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

/**
 * Export HTTP methods
 * Inngest uses:
 * - GET: Health check and function discovery
 * - POST: Receive events and invoke functions
 * - PUT: Update function state (retries, cancellations)
 */
export { handler as GET, handler as POST, handler as PUT };
