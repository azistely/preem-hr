/**
 * Event-Driven Function: Batch Operation Processor
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: batch.operation.created event is published
 * Actions:
 * - Process batch operations asynchronously
 * - Update progress in real-time
 * - Handle errors gracefully
 */

import { inngest } from '../client';
import { processBatchOperation } from '@/lib/workflow/batch-processor';

/**
 * Batch Operation Processor
 * Processes batch operations asynchronously when they are created
 */
export const batchOperationProcessorFunction = inngest.createFunction(
  {
    id: 'batch-operation-processor',
    name: 'Process Batch Operation',
    retries: 2,

    // Concurrency control: process one batch operation at a time per tenant
    concurrency: [
      {
        limit: 3, // Max 3 batch operations processing simultaneously across all tenants
        key: 'event.data.tenantId', // One batch op at a time per tenant
      },
    ],
  },

  { event: 'batch.operation.created' },

  async ({ event, step }) => {
    const { operationId, operationType, tenantId } = event.data;

    console.log('[Inngest] Processing batch operation:', {
      operationId,
      operationType,
      tenantId,
    });

    // Step 1: Process the batch operation
    const result = await step.run('process-batch-operation', async () => {
      try {
        return await processBatchOperation(operationId);
      } catch (error) {
        console.error('[Inngest] Error processing batch operation:', error);
        throw error; // Inngest will retry
      }
    });

    console.log('[Inngest] Batch operation processed:', {
      operationId,
      successCount: result.successCount,
      errorCount: result.errorCount,
    });

    return {
      success: true,
      operationId,
      result,
    };
  }
);
