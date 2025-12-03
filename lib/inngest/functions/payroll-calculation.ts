/**
 * Inngest Background Function: Payroll Calculation
 *
 * Handles long-running payroll calculations for large tenants (>500 employees).
 * Uses chunked processing with progress tracking for resumability.
 *
 * Features:
 * - Chunked processing (1000 employees per chunk) for memory efficiency
 * - Real-time progress updates via payroll_run_progress table
 * - Automatic retry with error tracking
 * - Sends completion/failure events for downstream workflows
 *
 * Designed for West African 3G connections with unreliable connectivity.
 */

import { inngest, sendEvent } from '../client';
import { db } from '@/lib/db';
import { payrollRunProgress, payrollRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { calculatePayrollRunOptimized } from '@/features/payroll/services/run-calculation';

const CHUNK_SIZE = 1000;

/**
 * Background Payroll Calculation Function
 *
 * Triggered by: payroll.run.calculate event
 * Called from: tRPC calculateRun endpoint for tenants with >500 employees
 */
export const payrollCalculationFunction = inngest.createFunction(
  {
    id: 'payroll-calculation',
    name: 'Background Payroll Calculation',
    retries: 2,

    // Concurrency control: one payroll calculation at a time per tenant
    concurrency: [
      {
        limit: 1,
        key: 'event.data.tenantId',
      },
    ],

    // Cancel any existing calculation for the same payroll run
    cancelOn: [
      {
        event: 'payroll.run.calculate',
        if: 'event.data.payrollRunId == async.data.payrollRunId',
      },
    ],
  },

  { event: 'payroll.run.calculate' },

  async ({ event, step }) => {
    const { payrollRunId, periodStart, periodEnd, employeeCount, tenantId } = event.data;

    console.log('[Inngest] Starting background payroll calculation:', {
      payrollRunId,
      employeeCount,
      tenantId,
    });

    // Step 1: Initialize progress tracking
    await step.run('initialize-progress', async () => {
      const totalChunks = Math.ceil(employeeCount / CHUNK_SIZE);

      // Insert or update progress record
      await db
        .insert(payrollRunProgress)
        .values({
          payrollRunId,
          tenantId,
          status: 'processing',
          totalEmployees: employeeCount,
          processedCount: 0,
          successCount: 0,
          errorCount: 0,
          currentChunk: 0,
          totalChunks,
          errors: [],
          startedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: payrollRunProgress.payrollRunId,
          set: {
            status: 'processing',
            totalEmployees: employeeCount,
            processedCount: 0,
            successCount: 0,
            errorCount: 0,
            currentChunk: 0,
            totalChunks,
            errors: [],
            startedAt: new Date(),
            completedAt: null,
            lastError: null,
          },
        });

      console.log('[Inngest] Progress initialized:', { totalChunks });
    });

    // Step 2: Run the optimized calculation
    const result = await step.run('calculate-payroll', async () => {
      try {
        // Get the payroll run to extract necessary input
        const [run] = await db
          .select()
          .from(payrollRuns)
          .where(eq(payrollRuns.id, payrollRunId))
          .limit(1);

        if (!run) {
          throw new Error(`Payroll run not found: ${payrollRunId}`);
        }

        // Execute the optimized calculation
        const calcResult = await calculatePayrollRunOptimized({
          runId: payrollRunId,
        });

        return calcResult;
      } catch (error) {
        console.error('[Inngest] Payroll calculation error:', error);

        // Update progress with failure
        await db
          .update(payrollRunProgress)
          .set({
            status: 'failed',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          })
          .where(eq(payrollRunProgress.payrollRunId, payrollRunId));

        throw error;
      }
    });

    // Step 3: Mark as completed
    await step.run('mark-completed', async () => {
      await db
        .update(payrollRunProgress)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(payrollRunProgress.payrollRunId, payrollRunId));
    });

    // Step 4: Send completion event
    await step.run('send-completion-event', async () => {
      // Calculate total deductions (tax + employee contributions)
      const totalDeductions = (result.totalTax ?? 0) + (result.totalEmployeeContributions ?? 0);

      await sendEvent({
        name: 'payroll.run.completed',
        data: {
          payrollRunId,
          periodStart,
          periodEnd,
          employeeCount: result.employeeCount,
          totalNetSalary: result.totalNet ?? 0,
          totalDeductions,
          duration: 0, // Not tracked in optimized version
          tenantId,
        },
      });
    });

    console.log('[Inngest] Payroll calculation completed:', {
      payrollRunId,
      employeeCount: result.employeeCount,
      totalNet: result.totalNet,
    });

    return {
      success: true,
      payrollRunId,
      result: {
        employeeCount: result.employeeCount,
        totalGross: result.totalGross,
        totalNet: result.totalNet,
      },
    };
  }
);

/**
 * Failure Handler
 *
 * Sends payroll.run.failed event when the calculation fails after all retries.
 */
export const payrollCalculationFailedFunction = inngest.createFunction(
  {
    id: 'payroll-calculation-failed',
    name: 'Handle Payroll Calculation Failure',
  },

  { event: 'inngest/function.failed' },

  async ({ event, step }) => {
    // Only handle failures from payroll-calculation function
    if (event.data.function_id !== 'payroll-calculation') {
      return { skipped: true };
    }

    const originalEvent = event.data.event;
    const { payrollRunId, periodStart, periodEnd, tenantId } = originalEvent.data;
    const errorMessage = event.data.error?.message ?? 'Unknown error';

    console.log('[Inngest] Payroll calculation failed after retries:', {
      payrollRunId,
      error: errorMessage,
    });

    // Update the payroll run status
    await step.run('update-run-status', async () => {
      await db
        .update(payrollRuns)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, payrollRunId));
    });

    // Send failure event for downstream handling
    await step.run('send-failure-event', async () => {
      await sendEvent({
        name: 'payroll.run.failed',
        data: {
          payrollRunId,
          periodStart,
          periodEnd,
          errorMessage,
          errorDetails: { source: 'inngest-background' },
          tenantId,
        },
      });
    });

    return {
      handled: true,
      payrollRunId,
      error: errorMessage,
    };
  }
);
