/**
 * Event-Driven Function: Batch Operation Completed
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: batch.operation.completed event is published
 * Actions:
 * - Create alert for user who started the operation
 * - Send notification (email/SMS if configured)
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema';

/**
 * Batch Operation Completed Event Handler
 */
export const batchOperationCompletedFunction = inngest.createFunction(
  {
    id: 'batch-operation-completed-handler',
    name: 'Handle Batch Operation Completion',
    retries: 2,
  },

  { event: 'batch.operation.completed' },

  async ({ event, step }) => {
    const { operationId, operationType, successCount, errorCount, tenantId } = event.data;
    const userId = event.data.metadata?.userId;

    console.log('[Inngest] Processing batch operation completion:', {
      operationId,
      operationType,
      successCount,
      errorCount,
    });

    if (!userId) {
      console.warn('[Inngest] No userId in batch operation metadata, skipping alert creation');
      return {
        success: true,
        alertCreated: false,
        reason: 'No userId provided',
      };
    }

    // Step 1: Create completion alert
    const alert = await step.run('create-completion-alert', async () => {
      const operationTypeLabels: Record<string, string> = {
        salary_update: 'mise à jour des salaires',
        document_generation: 'génération de documents',
        contract_renewal: 'renouvellement de contrats',
      };

      const operationLabel = operationTypeLabels[operationType] || operationType;

      const message =
        errorCount > 0
          ? `${operationLabel.charAt(0).toUpperCase() + operationLabel.slice(1)} terminée: ${successCount} succès, ${errorCount} erreurs`
          : `${operationLabel.charAt(0).toUpperCase() + operationLabel.slice(1)} terminée avec succès: ${successCount} éléments traités`;

      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'batch_operation_completed',
          severity: errorCount > 0 ? 'warning' : 'info',
          message,
          assigneeId: userId,
          actionUrl: `/batch-operations/${operationId}`,
          actionLabel: 'Voir les détails',
          status: 'active',
          metadata: {
            operationId,
            operationType,
            successCount,
            errorCount,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newAlert;
    });

    // Step 2: Send notification (TODO: implement email/SMS service)
    await step.run('send-notification', async () => {
      // TODO: Integrate with email/SMS service
      console.log('[Inngest] Notification would be sent for batch operation completion');

      return {
        notificationSent: false,
        reason: 'Email/SMS service not yet implemented',
      };
    });

    console.log('[Inngest] Batch operation completion processed:', {
      operationId,
      alertId: alert.id,
    });

    return {
      success: true,
      alertId: alert.id,
    };
  }
);
