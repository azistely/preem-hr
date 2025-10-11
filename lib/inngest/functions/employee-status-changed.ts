/**
 * Employee Status Changed Event Handler
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 3
 *
 * Triggered when employee employment status changes (hired/terminated/suspended).
 * Actions:
 * - Create alert for HR manager
 * - Update related workflows
 * - Log audit trail
 * - Send notification email if urgent
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { EventPayload } from '../event-registry';

export const employeeStatusChangedFunction = inngest.createFunction(
  {
    id: 'employee-status-changed',
    name: 'Handle Employee Status Change',
    retries: 3,
  },
  { event: 'employee.status.changed' },
  async ({ event, step }) => {
    const payload = event.data as EventPayload<'employee.status.changed'>;
    const { employeeId, oldStatus, newStatus, tenantId, changedBy, reason, effectiveDate } = payload;

    console.log('[Employee Status Changed]', {
      employeeId,
      oldStatus,
      newStatus,
      tenantId,
    });

    // Step 1: Fetch employee details
    const employee = await step.run('fetch-employee', async () => {
      const results = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      return results[0];
    });

    if (!employee) {
      console.warn('[Employee Status Changed] Employee not found:', employeeId);
      return { success: false, error: 'Employee not found' };
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;

    // Step 2: Determine alert severity and message
    const alertConfig = await step.run('determine-alert-config', async () => {
      let severity: 'info' | 'warning' | 'urgent' = 'info';
      let message = '';
      let actionUrl = `/employees/${employeeId}`;
      let actionLabel = 'Voir le profil';

      if (newStatus === 'terminated' && oldStatus === 'active') {
        severity = 'warning';
        message = `${employeeName} a été terminé(e) - ${reason || 'Raison non spécifiée'}`;
        actionLabel = 'Gérer la sortie';
      } else if (newStatus === 'suspended' && oldStatus === 'active') {
        severity = 'urgent';
        message = `${employeeName} a été suspendu(e) - ${reason || 'Raison non spécifiée'}`;
        actionLabel = 'Vérifier le statut';
      } else if (newStatus === 'active' && oldStatus === 'suspended') {
        severity = 'info';
        message = `${employeeName} a été réactivé(e)`;
        actionLabel = 'Voir le profil';
      } else if (newStatus === 'active' && oldStatus === 'terminated') {
        severity = 'warning';
        message = `${employeeName} a été réembauché(e)`;
        actionLabel = 'Configurer l\'onboarding';
      }

      return { severity, message, actionUrl, actionLabel };
    });

    // Step 3: Find HR manager (the person who should be notified)
    const hrManager = await step.run('find-hr-manager', async () => {
      // For now, use the person who made the change as the assignee
      // In production, this should query for the actual HR manager
      return changedBy;
    });

    // Step 4: Create alert for HR manager
    const alert = await step.run('create-alert', async () => {
      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'employee_status_change',
          severity: alertConfig.severity,
          message: alertConfig.message,
          assigneeId: hrManager,
          employeeId,
          actionUrl: alertConfig.actionUrl,
          actionLabel: alertConfig.actionLabel,
          dueDate: new Date(effectiveDate),
          status: 'active',
          metadata: {
            oldStatus,
            newStatus,
            reason,
            changedBy,
            effectiveDate: effectiveDate.toISOString(),
          },
        })
        .returning();

      console.log('[Employee Status Changed] Alert created:', newAlert.id);
      return newAlert;
    });

    // Step 5: Send email notification if urgent or warning
    if (alertConfig.severity === 'urgent' || alertConfig.severity === 'warning') {
      await step.run('send-notification', async () => {
        // Emit event for email notification
        await inngest.send({
          name: 'alert.created',
          data: {
            alertId: alert.id,
            tenantId,
            type: 'employee_status_change',
            severity: alertConfig.severity,
            assigneeId: hrManager,
            employeeId,
            message: alertConfig.message,
            createdAt: new Date(),
          },
        });

        console.log('[Employee Status Changed] Email notification triggered');
      });
    }

    // Step 6: Log audit trail
    await step.run('log-audit-trail', async () => {
      console.log('[Employee Status Changed] Audit log:', {
        event: 'employee.status.changed',
        employeeId,
        employeeName,
        oldStatus,
        newStatus,
        reason,
        changedBy,
        effectiveDate,
        alertCreated: alert.id,
      });

      // In production, this would write to an audit_logs table
      return { logged: true };
    });

    return {
      success: true,
      employeeId,
      employeeName,
      statusChange: { from: oldStatus, to: newStatus },
      alertCreated: alert.id,
      notificationSent: alertConfig.severity === 'urgent' || alertConfig.severity === 'warning',
    };
  }
);
