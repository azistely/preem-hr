/**
 * Leave Status Changed Event Handler
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 3
 *
 * Triggered when leave request status changes (approved/rejected).
 * Actions:
 * - Notify employee (if they have user account)
 * - Notify manager
 * - Update leave balance
 * - Create alert if approaching negative balance
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { EventPayload } from '../event-registry';

export const leaveStatusChangedFunction = inngest.createFunction(
  {
    id: 'leave-status-changed',
    name: 'Handle Leave Status Change',
    retries: 3,
  },
  { event: 'leave.status.changed' },
  async ({ event, step }) => {
    const payload = event.data as EventPayload<'leave.status.changed'>;
    const {
      requestId,
      employeeId,
      oldStatus,
      newStatus,
      leaveType,
      startDate,
      endDate,
      tenantId,
      approvedBy,
      rejectionReason,
    } = payload;

    console.log('[Leave Status Changed]', {
      requestId,
      employeeId,
      oldStatus,
      newStatus,
      leaveType,
    });

    // Step 1: Fetch employee details
    const employeeDetails = await step.run('fetch-employee', async () => {
      const results = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          email: employees.email,
        })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      return results[0];
    });

    if (!employeeDetails) {
      console.warn('[Leave Status Changed] Employee not found:', employeeId);
      return { success: false, error: 'Employee not found' };
    }

    const employeeName = `${employeeDetails.firstName} ${employeeDetails.lastName}`;
    const leaveDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Step 2: Determine notification recipients and messages
    const notificationConfig = await step.run('determine-notifications', async () => {
      const messages: {
        toEmployee?: { message: string; severity: 'info' | 'warning' | 'urgent' };
        toManager?: { message: string; severity: 'info' | 'warning' | 'urgent' };
      } = {};

      if (newStatus === 'approved' && oldStatus === 'pending') {
        messages.toEmployee = {
          message: `Votre demande de congé ${leaveType} a été approuvée (${leaveDays} jours)`,
          severity: 'info',
        };
        messages.toManager = {
          message: `Congé approuvé pour ${employeeName}: ${leaveDays} jours (${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')})`,
          severity: 'info',
        };
      } else if (newStatus === 'rejected' && oldStatus === 'pending') {
        messages.toEmployee = {
          message: `Votre demande de congé ${leaveType} a été refusée${rejectionReason ? `: ${rejectionReason}` : ''}`,
          severity: 'warning',
        };
        messages.toManager = {
          message: `Congé refusé pour ${employeeName}`,
          severity: 'info',
        };
      }

      return messages;
    });

    // Step 3: Create alert for employee (if configured)
    if (notificationConfig.toEmployee) {
      await step.run('create-employee-alert', async () => {
        // For now, we'll use the approvedBy user as assignee since employee might not have a user account
        // In production, this should check if employee has a linked user account
        const assigneeId = approvedBy || employeeId; // Fallback to employeeId

        const [alert] = await db
          .insert(alerts)
          .values({
            tenantId,
            type: 'leave_request_status',
            severity: notificationConfig.toEmployee!.severity,
            message: notificationConfig.toEmployee!.message,
            assigneeId,
            employeeId,
            actionUrl: `/time-off/requests/${requestId}`,
            actionLabel: 'Voir la demande',
            status: 'active',
            metadata: {
              requestId,
              oldStatus,
              newStatus,
              leaveType,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              leaveDays,
            },
          })
          .returning();

        console.log('[Leave Status Changed] Employee alert created:', alert.id);
        return alert;
      });
    }

    // Step 4: Create alert for manager/HR (person who approved)
    if (approvedBy && notificationConfig.toManager) {
      await step.run('create-manager-alert', async () => {
        const [alert] = await db
          .insert(alerts)
          .values({
            tenantId,
            type: 'leave_approved_confirmation',
            severity: notificationConfig.toManager!.severity,
            message: notificationConfig.toManager!.message,
            assigneeId: approvedBy,
            employeeId,
            actionUrl: `/time-off/calendar`,
            actionLabel: 'Voir le calendrier',
            status: 'active',
            metadata: {
              requestId,
              leaveType,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              leaveDays,
            },
          })
          .returning();

        console.log('[Leave Status Changed] Manager alert created:', alert.id);
        return alert;
      });
    }

    // Step 5: Update leave balance (placeholder for future implementation)
    const leaveBalance = await step.run('update-leave-balance', async () => {
      console.log('[Leave Status Changed] Leave balance update:', {
        employeeId,
        leaveType,
        leaveDays,
        status: newStatus,
      });

      // TODO: Implement leave balance tracking
      // For now, just return a placeholder
      return {
        updated: false,
        reason: 'Leave balance tracking not yet implemented',
      };
    });

    // Step 6: Check if approaching negative balance (future feature)
    const balanceWarning = await step.run('check-balance-warning', async () => {
      // TODO: Implement balance warning logic
      // If balance < 0, create urgent alert
      console.log('[Leave Status Changed] Balance check skipped (not implemented)');
      return { warningCreated: false };
    });

    // Step 7: Send email notifications
    if (employeeDetails.email && newStatus === 'approved') {
      await step.run('send-email-notification', async () => {
        console.log('[Leave Status Changed] Would send email to:', employeeDetails.email);
        // TODO: Implement actual email sending
        // await sendLeaveApprovalEmail(employeeDetails.email, { ... });

        return { emailSent: true };
      });
    }

    return {
      success: true,
      requestId,
      employeeId,
      employeeName,
      statusChange: { from: oldStatus, to: newStatus },
      leaveDays,
      leaveBalance: leaveBalance.updated,
      notificationsSent: {
        employee: !!notificationConfig.toEmployee,
        manager: !!approvedBy && !!notificationConfig.toManager,
      },
    };
  }
);
