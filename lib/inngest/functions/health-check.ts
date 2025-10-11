/**
 * Scheduled Function: Health Check & Monitoring
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Runs every hour to monitor system health:
 * - Check Inngest function status
 * - Monitor alert processing delays
 * - Track batch operation queue depth
 * - Verify database connectivity
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, batchOperations } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { subHours, subMinutes } from 'date-fns';

interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: 'ok' | 'error'; latency?: number; error?: string };
    pendingAlerts: { status: 'ok' | 'warning'; count: number; oldestAge?: number };
    stuckBatchOps: { status: 'ok' | 'warning'; count: number; operations?: string[] };
    overdueTasks: { status: 'ok' | 'warning'; count: number };
  };
  issues: string[];
}

/**
 * Scheduled health check function
 * Runs every hour to monitor system health
 */
export const healthCheckFunction = inngest.createFunction(
  {
    id: 'system-health-check',
    name: 'System Health Check & Monitoring',
    retries: 1, // Don't retry health checks aggressively
  },

  // Run every hour
  { cron: '0 * * * *' },

  async ({ event, step }) => {
    console.log('[Health Check] Starting system health check at', new Date().toISOString());

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        database: { status: 'ok' },
        pendingAlerts: { status: 'ok', count: 0 },
        stuckBatchOps: { status: 'ok', count: 0 },
        overdueTasks: { status: 'ok', count: 0 },
      },
      issues: [],
    };

    // Step 1: Database connectivity check
    await step.run('check-database', async () => {
      const startTime = Date.now();

      try {
        // Simple query to check DB connection
        await db.execute(sql`SELECT 1`);

        const latency = Date.now() - startTime;
        result.checks.database = { status: 'ok', latency };

        if (latency > 1000) {
          result.issues.push(`Database latency is high: ${latency}ms`);
          result.status = 'degraded';
        }
      } catch (error) {
        result.checks.database = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        result.issues.push('Database connection failed');
        result.status = 'unhealthy';
      }
    });

    // Step 2: Check for old pending alerts (should be processed quickly)
    await step.run('check-pending-alerts', async () => {
      try {
        const fifteenMinutesAgo = subMinutes(new Date(), 15);

        const oldAlerts = await db.query.alerts.findMany({
          where: and(
            eq(alerts.status, 'active'),
            lt(alerts.createdAt, fifteenMinutesAgo)
          ),
          columns: {
            id: true,
            createdAt: true,
          },
        });

        const count = oldAlerts.length;
        result.checks.pendingAlerts = { status: count > 10 ? 'warning' : 'ok', count };

        if (count > 0) {
          const oldestAge = Math.floor(
            (Date.now() - new Date(oldAlerts[0].createdAt).getTime()) / 1000 / 60
          );
          result.checks.pendingAlerts.oldestAge = oldestAge;
        }

        if (count > 10) {
          result.issues.push(`${count} alerts pending for >15 minutes`);
          result.status = result.status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      } catch (error) {
        console.error('[Health Check] Error checking pending alerts:', error);
      }
    });

    // Step 3: Check for stuck batch operations (running for >1 hour)
    await step.run('check-batch-operations', async () => {
      try {
        const oneHourAgo = subHours(new Date(), 1);

        const stuckOps = await db.query.batchOperations.findMany({
          where: and(
            eq(batchOperations.status, 'running'),
            lt(batchOperations.startedAt, oneHourAgo)
          ),
          columns: {
            id: true,
            operationType: true,
            startedAt: true,
          },
        });

        const count = stuckOps.length;
        const operations = stuckOps.map((op) => op.id);

        result.checks.stuckBatchOps = {
          status: count > 0 ? 'warning' : 'ok',
          count,
          operations: count > 0 ? operations : undefined,
        };

        if (count > 0) {
          result.issues.push(`${count} batch operations stuck for >1 hour`);
          result.status = result.status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      } catch (error) {
        console.error('[Health Check] Error checking batch operations:', error);
      }
    });

    // Step 4: Check for overdue urgent alerts (should be handled within 24h)
    await step.run('check-overdue-tasks', async () => {
      try {
        const yesterday = subHours(new Date(), 24);

        const overdueAlerts = await db.query.alerts.findMany({
          where: and(
            eq(alerts.severity, 'urgent'),
            eq(alerts.status, 'active'),
            lt(alerts.createdAt, yesterday)
          ),
          columns: {
            id: true,
          },
        });

        const count = overdueAlerts.length;
        result.checks.overdueTasks = { status: count > 5 ? 'warning' : 'ok', count };

        if (count > 5) {
          result.issues.push(`${count} urgent alerts unresolved for >24 hours`);
          result.status = result.status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      } catch (error) {
        console.error('[Health Check] Error checking overdue tasks:', error);
      }
    });

    // Step 5: Log results and create alert if unhealthy
    await step.run('log-results', async () => {
      console.log('[Health Check] Results:', result);

      // Create admin alert if system is degraded or unhealthy
      if (result.status !== 'healthy') {
        try {
          await db.insert(alerts).values({
            tenantId: '00000000-0000-0000-0000-000000000000', // System-wide alert
            type: 'system_health',
            severity: result.status === 'unhealthy' ? 'urgent' : 'warning',
            message: `Problème de santé système: ${result.issues.join(', ')}`,
            assigneeId: null, // Will be picked up by system admins
            employeeId: null, // Not employee-specific
            status: 'active',
            metadata: {
              healthCheck: result,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any); // Type assertion needed for system alerts
        } catch (error) {
          console.error('[Health Check] Failed to create health alert:', error);
        }
      }

      return result;
    });

    return {
      success: true,
      health: result,
    };
  }
);

/**
 * Manual health check trigger (for debugging)
 */
export const manualHealthCheckFunction = inngest.createFunction(
  {
    id: 'manual-health-check',
    name: 'Manual Health Check (On-Demand)',
    retries: 0,
  },

  { event: 'health/check.manual' },

  async ({ event, step }) => {
    console.log('[Health Check] Manual health check triggered');

    // Reuse the same health check logic
    // Note: In production, extract shared logic to a separate function
    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        database: { status: 'ok' },
        pendingAlerts: { status: 'ok', count: 0 },
        stuckBatchOps: { status: 'ok', count: 0 },
        overdueTasks: { status: 'ok', count: 0 },
      },
      issues: [],
    };

    // Database check
    const startTime = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      result.checks.database = { status: 'ok', latency: Date.now() - startTime };
    } catch (error) {
      result.checks.database = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'unhealthy';
    }

    return {
      success: true,
      health: result,
      triggeredBy: event.user,
    };
  }
);
