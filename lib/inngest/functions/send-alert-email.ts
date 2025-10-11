/**
 * Send Alert Email Notification
 * Inngest function to send email when high-priority alerts are created
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 2
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema/automation';
import { users, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendAlertNotification } from '@/lib/notifications/email-service';

export const sendAlertEmail = inngest.createFunction(
  {
    id: 'send-alert-email',
    name: 'Send Alert Email Notification',
  },
  { event: 'alert.created' },
  async ({ event, step }) => {
    const { alertId } = event.data;

    // Fetch alert with related data using manual joins
    const alert = await step.run('fetch-alert', async () => {
      const results = await db
        .select({
          id: alerts.id,
          tenantId: alerts.tenantId,
          type: alerts.type,
          severity: alerts.severity,
          message: alerts.message,
          assigneeId: alerts.assigneeId,
          employeeId: alerts.employeeId,
          actionUrl: alerts.actionUrl,
          actionLabel: alerts.actionLabel,
          dueDate: alerts.dueDate,
          status: alerts.status,
          metadata: alerts.metadata,
          // Assignee info
          assigneeEmail: users.email,
          assigneeFirstName: users.firstName,
          assigneeLastName: users.lastName,
          // Employee info (optional)
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
        })
        .from(alerts)
        .innerJoin(users, eq(alerts.assigneeId, users.id))
        .leftJoin(employees, eq(alerts.employeeId, employees.id))
        .where(eq(alerts.id, alertId))
        .limit(1);

      return results[0];
    });

    if (!alert) {
      console.warn('[Send Alert Email] Alert not found:', alertId);
      return { success: false, reason: 'Alert not found' };
    }

    // Only send emails for warning and urgent alerts
    if (alert.severity !== 'warning' && alert.severity !== 'urgent') {
      console.log('[Send Alert Email] Skipping email for info alert:', alertId);
      return { success: true, reason: 'Info alerts do not trigger emails' };
    }

    // Send email notification
    const emailResult = await step.run('send-email', async () => {
      if (!alert.assigneeEmail) {
        console.warn('[Send Alert Email] Assignee email not found');
        return { success: false, error: 'Assignee email not found' };
      }

      const employeeName = alert.employeeFirstName && alert.employeeLastName
        ? `${alert.employeeFirstName} ${alert.employeeLastName}`
        : undefined;

      // Build action URL (absolute URL for emails)
      const actionUrl = alert.actionUrl
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.preem.com'}${alert.actionUrl}`
        : undefined;

      return sendAlertNotification({
        to: alert.assigneeEmail,
        alertType: alert.type,
        severity: alert.severity as 'info' | 'warning' | 'urgent',
        message: alert.message,
        actionUrl,
        actionLabel: alert.actionLabel || undefined,
        employeeName,
      });
    });

    if (!emailResult.success) {
      console.error('[Send Alert Email] Failed to send email:', emailResult.error);
      return { success: false, error: emailResult.error };
    }

    console.log('[Send Alert Email] Email sent successfully:', emailResult.messageId);
    return { success: true, messageId: emailResult.messageId };
  }
);
