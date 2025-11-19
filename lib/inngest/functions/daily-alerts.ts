/**
 * Scheduled Function: Daily Alerts Generation
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Runs daily at 6:00 AM WAT (West Africa Time) to generate proactive alerts:
 * - Contract expiry notifications (30/15/7 days before)
 * - Leave notifications (upcoming absences)
 * - Document expiry warnings
 * - Payroll reminders
 */

import { inngest } from '../client';
import { generateDailyAlerts } from '@/lib/workflow/alert-engine';

/**
 * Scheduled function that runs daily at 6 AM WAT
 * WAT = UTC+1, so 6 AM WAT = 5 AM UTC
 */
export const dailyAlertsFunction = inngest.createFunction(
  {
    id: 'daily-alerts-generation',
    name: 'Generate Daily Alerts',

    // Retry configuration
    retries: 3,

    // Rate limiting (prevent overwhelming the system)
    rateLimit: {
      limit: 1,
      period: '1h', // Max once per hour
    },
  },

  // Schedule: Every day at 6 AM WAT (5 AM UTC)
  { cron: '0 5 * * *' },

  // Function handler
  async ({ event, step }) => {
    console.log('[Inngest] Starting daily alerts generation at', new Date().toISOString());

    // Step 1: Generate all daily alerts
    const result = await step.run('generate-alerts', async () => {
      try {
        const alertsResult = await generateDailyAlerts();

        console.log('[Inngest] Daily alerts generated successfully:', {
          contractExpiry: alertsResult.summary.contractExpiry?.alertsCreated || 0,
          leaveNotifications: alertsResult.summary.leaveNotifications?.alertsCreated || 0,
          documentExpiry: alertsResult.summary.documentExpiry?.alertsCreated || 0,
          payrollReminders: alertsResult.summary.payrollReminders?.alertsCreated || 0,
          contractCompliance: alertsResult.summary.contractCompliance?.alertsCreated || 0,
          totalAlerts: alertsResult.summary.totalAlerts,
        });

        return alertsResult;
      } catch (error) {
        console.error('[Inngest] Error generating daily alerts:', error);
        throw error; // Inngest will retry automatically
      }
    });

    // Step 2: Log completion (separate step for observability)
    await step.run('log-completion', async () => {
      console.log('[Inngest] Daily alerts generation completed', {
        timestamp: new Date().toISOString(),
        success: result.success,
        totalAlerts: result.summary.totalAlerts,
      });

      return {
        success: true,
        completedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      alertsGenerated: result.summary.totalAlerts,
      details: result.summary,
    };
  }
);

/**
 * Manual trigger function (for testing or on-demand alert generation)
 * Can be invoked via Inngest dashboard or API
 */
export const manualAlertsFunction = inngest.createFunction(
  {
    id: 'manual-alerts-generation',
    name: 'Manual Alert Generation (On-Demand)',
    retries: 2,
  },

  // Event-triggered (can be called programmatically)
  { event: 'alerts/generate.manual' },

  async ({ event, step }) => {
    console.log('[Inngest] Manual alert generation triggered by:', event.user);

    // Use the same alert generation logic
    const result = await step.run('generate-alerts', async () => {
      return await generateDailyAlerts();
    });

    return {
      success: true,
      alertsGenerated: result.summary.totalAlerts,
      triggeredBy: event.user,
      triggeredAt: new Date().toISOString(),
    };
  }
);
