/**
 * Event-Driven Function: Alert Escalation
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: alert.escalation.needed event is published
 * Actions:
 * - Escalate overdue urgent alerts to manager's manager
 * - Send urgent notifications
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Alert Escalation Event Handler
 */
export const alertEscalationFunction = inngest.createFunction(
  {
    id: 'alert-escalation-handler',
    name: 'Handle Alert Escalation',
    retries: 2, // Don't retry too much for escalations
    rateLimit: {
      limit: 10,
      period: '1m',
    },
  },

  { event: 'alert.escalation.needed' },

  async ({ event, step }) => {
    const { alertId, alertType, originalAssigneeId, daysOverdue, tenantId } = event.data;

    console.log('[Inngest] Processing alert escalation:', {
      alertId,
      alertType,
      daysOverdue,
    });

    // Step 1: Get the original alert
    const originalAlert = await step.run('fetch-original-alert', async () => {
      const alert = await db.query.alerts.findFirst({
        where: and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId)),
        with: {
          // @ts-expect-error - Relations not yet defined in schema
          assignee: true,
          employee: true,
        },
      });

      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      return alert;
    });

    // Step 2: Find escalation target (manager's manager or tenant admin)
    const escalationTarget = await step.run('find-escalation-target', async () => {
      // Try to find the original assignee's manager
      const originalAssignee = await db.query.users.findFirst({
        where: eq(users.id, originalAssigneeId),
      });

      if (!originalAssignee) {
        throw new Error(`Original assignee ${originalAssigneeId} not found`);
      }

      // If original assignee has a manager, escalate to them
      if (originalAssignee.managerId) {
        const manager = await db.query.users.findFirst({
          where: eq(users.id, originalAssignee.managerId),
        });

        if (manager) {
          return {
            targetUser: manager,
            escalationType: 'manager',
          };
        }
      }

      // Otherwise, escalate to tenant admin
      const tenantAdmin = await db.query.users.findFirst({
        where: and(
          eq(users.tenantId, tenantId),
          eq(users.role, 'tenant_admin')
        ),
      });

      if (!tenantAdmin) {
        throw new Error(`No escalation target found for tenant ${tenantId}`);
      }

      return {
        targetUser: tenantAdmin,
        escalationType: 'tenant_admin',
      };
    });

    // Step 3: Create escalated alert
    const escalatedAlert = await step.run('create-escalated-alert', async () => {
      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'alert_escalation',
          severity: 'urgent',
          message: `ESCALATION: ${originalAlert.message} (${daysOverdue} jours de retard)`,
          assigneeId: escalationTarget.targetUser.id,
          employeeId: originalAlert.employeeId,
          actionUrl: originalAlert.actionUrl,
          actionLabel: originalAlert.actionLabel,
          dueDate: originalAlert.dueDate,
          status: 'active',
          metadata: {
            originalAlertId: alertId,
            originalAssigneeId,
            originalAlertType: alertType,
            daysOverdue,
            escalationType: escalationTarget.escalationType,
            escalatedAt: new Date().toISOString(),
          },
        } as any)
        .returning();

      return newAlert;
    });

    // Step 4: Update original alert status
    await step.run('update-original-alert', async () => {
      await db
        .update(alerts)
        .set({
          metadata: {
            ...(originalAlert.metadata as object || {}),
            escalated: true,
            escalatedAt: new Date().toISOString(),
            escalatedTo: escalationTarget.targetUser.id,
          },
        })
        .where(eq(alerts.id, alertId));
    });

    // Step 5: Send urgent notification (TODO: implement email/SMS service)
    await step.run('send-urgent-notification', async () => {
      // TODO: Integrate with email/SMS service
      console.log('[Inngest] Urgent notification would be sent to:', {
        recipient: escalationTarget.targetUser.email,
        alertMessage: escalatedAlert.message,
        escalationType: escalationTarget.escalationType,
      });

      return {
        notificationSent: false,
        reason: 'Email/SMS service not yet implemented',
      };
    });

    console.log('[Inngest] Alert escalation processed successfully:', {
      originalAlertId: alertId,
      escalatedAlertId: escalatedAlert.id,
      escalatedTo: escalationTarget.targetUser.email,
    });

    return {
      success: true,
      originalAlertId: alertId,
      escalatedAlertId: escalatedAlert.id,
      escalatedTo: escalationTarget.targetUser.id,
      escalationType: escalationTarget.escalationType,
    };
  }
);
