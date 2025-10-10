/**
 * Inngest Client Configuration
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Inngest is the event-driven workflow engine for:
 * - Scheduled jobs (daily alerts, monthly payroll reminders)
 * - Event-driven automation (employee lifecycle, payroll changes)
 * - Durable workflows with retries and step functions
 */

import { Inngest } from 'inngest';

/**
 * Inngest client for Preem HR
 * Used by both the API server and function definitions
 */
export const inngest = new Inngest({
  id: 'preem-hr',
  name: 'Preem HR',
  eventKey: process.env.INNGEST_EVENT_KEY,

  // Environment-specific configuration
  env: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // Retry configuration for all functions
  retryFunction: async (attempt: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return {
      delay: Math.min(1000 * Math.pow(2, attempt), 16000),
    };
  },
});

/**
 * Type-safe event sender
 * Use this to publish events from your application code
 *
 * @example
 * import { sendEvent } from '@/lib/inngest/client';
 *
 * await sendEvent({
 *   name: 'employee.hired',
 *   data: {
 *     employeeId: '...',
 *     tenantId: '...',
 *     hireDate: new Date(),
 *   }
 * });
 */
export const sendEvent = inngest.send.bind(inngest);

/**
 * Batch event sender for efficiency
 * Use when publishing multiple events at once
 *
 * @example
 * await sendEvents([
 *   { name: 'employee.hired', data: {...} },
 *   { name: 'employee.hired', data: {...} },
 * ]);
 */
export const sendEvents = inngest.send.bind(inngest);
