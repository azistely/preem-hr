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
import { workflowExecutorFunction, manualWorkflowTriggerFunction } from '@/lib/inngest/functions/workflow-executor';

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

    // Event-driven functions (employee lifecycle)
    employeeTerminatedFunction,
    employeeHiredFunction,
    salaryChangedFunction,
    leaveApprovedFunction,

    // Event-driven functions (system)
    alertEscalationFunction,
    batchOperationCompletedFunction,

    // Workflow automation (Phase 4)
    workflowExecutorFunction,
    manualWorkflowTriggerFunction,
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
