/**
 * Alert Creation Engine
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Proactively creates alerts for HR managers:
 * - Contract expiry notifications (30/15/7 days before)
 * - Leave notifications (upcoming absences)
 * - Document expiry warnings
 * - Payroll reminders
 */

import { db } from '@/lib/db';
import { alerts, employeeAssignments, employees, users } from '@/lib/db/schema';
import { and, eq, gte, lte, isNull, sql } from 'drizzle-orm';
import { addDays, differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Create contract expiry alerts for all tenants
 * Run daily as a scheduled job
 */
export async function createContractExpiryAlerts() {
  const today = new Date();
  const in30Days = addDays(today, 30);

  // Find all active contracts expiring in the next 30 days
  const expiringContracts = await db.query.employeeAssignments.findMany({
    where: and(
      eq(employeeAssignments.status, 'active'),
      isNull(employeeAssignments.terminationDate),
      gte(employeeAssignments.effectiveTo, today),
      lte(employeeAssignments.effectiveTo, in30Days)
    ),
    with: {
      employee: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          tenantId: true,
        },
      },
    },
  });

  let alertsCreated = 0;

  for (const contract of expiringContracts) {
    if (!contract.effectiveTo || !contract.employee) continue;

    const daysUntilExpiry = differenceInDays(contract.effectiveTo, today);

    // Determine severity based on days remaining
    const severity =
      daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'warning' : 'info';

    // Skip if alert already exists for this contract
    const existingAlert = await db.query.alerts.findFirst({
      where: and(
        eq(alerts.type, 'contract_expiry'),
        eq(alerts.employeeId, contract.employeeId),
        eq(alerts.status, 'active')
      ),
    });

    if (existingAlert) {
      // Update severity if changed
      if (existingAlert.severity !== severity) {
        await db
          .update(alerts)
          .set({
            severity,
            message: `Contrat de ${contract.employee.firstName} ${contract.employee.lastName} expire dans ${daysUntilExpiry} jours`,
            dueDate: contract.effectiveTo,
            updatedAt: new Date(),
          })
          .where(eq(alerts.id, existingAlert.id));
      }
      continue;
    }

    // Find HR manager or tenant admin to assign alert to
    const hrManager = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, contract.employee.tenantId),
        sql`${users.role} IN ('hr_manager', 'tenant_admin')`
      ),
      orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
    });

    if (!hrManager) {
      console.warn(
        `No HR manager found for tenant ${contract.employee.tenantId}, skipping alert`
      );
      continue;
    }

    // Create alert
    await db.insert(alerts).values({
      tenantId: contract.employee.tenantId,
      type: 'contract_expiry',
      severity,
      message: `Contrat de ${contract.employee.firstName} ${contract.employee.lastName} expire dans ${daysUntilExpiry} jours`,
      assigneeId: hrManager.id,
      employeeId: contract.employeeId,
      actionUrl: `/employees/${contract.employeeId}/assignments/${contract.id}`,
      actionLabel: 'Renouveler le contrat',
      dueDate: contract.effectiveTo,
      status: 'active',
      metadata: {
        contractId: contract.id,
        contractType: contract.type,
        daysUntilExpiry,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    alertsCreated++;
  }

  return {
    success: true,
    alertsCreated,
    contractsChecked: expiringContracts.length,
  };
}

/**
 * Create leave notifications for upcoming absences
 * Alerts managers about team members going on leave
 */
export async function createLeaveNotifications() {
  const today = new Date();
  const in7Days = addDays(today, 7);

  // TODO: Implement once leave/time-off system is available
  // This will query approved leaves starting in next 7 days
  // and create alerts for managers

  return {
    success: true,
    alertsCreated: 0,
    message: 'Leave notifications not yet implemented (requires time-off module)',
  };
}

/**
 * Create document expiry warnings
 * Alerts for work permits, medical certificates, etc.
 */
export async function createDocumentExpiryAlerts() {
  const today = new Date();
  const in30Days = addDays(today, 30);

  // TODO: Implement once document management system is available
  // This will query documents with expiry dates in next 30 days

  return {
    success: true,
    alertsCreated: 0,
    message: 'Document expiry alerts not yet implemented (requires document module)',
  };
}

/**
 * Create monthly payroll reminders
 * Reminds HR managers to run payroll
 */
export async function createPayrollReminders() {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // TODO: Implement payroll reminder logic
  // Alert on 25th of each month to prepare payroll
  // Alert on 1st of each month if payroll not run

  return {
    success: true,
    alertsCreated: 0,
    message: 'Payroll reminders not yet implemented',
  };
}

/**
 * Clean up old dismissed/completed alerts
 * Run weekly to keep alerts table clean
 */
export async function cleanupOldAlerts(daysOld = 90) {
  const cutoffDate = addDays(new Date(), -daysOld);

  const result = await db
    .delete(alerts)
    .where(
      and(
        sql`${alerts.status} IN ('dismissed', 'completed')`,
        lte(alerts.updatedAt, cutoffDate)
      )
    );

  return {
    success: true,
    message: `Cleaned up alerts older than ${daysOld} days`,
  };
}

/**
 * Main alert generation function
 * Run this daily as a cron job
 */
export async function generateDailyAlerts() {
  console.log('[Alert Engine] Starting daily alert generation...');

  try {
    const results = await Promise.allSettled([
      createContractExpiryAlerts(),
      createLeaveNotifications(),
      createDocumentExpiryAlerts(),
      createPayrollReminders(),
    ]);

    const summary = {
      contractExpiry:
        results[0].status === 'fulfilled' ? results[0].value : { alertsCreated: 0 },
      leaveNotifications:
        results[1].status === 'fulfilled' ? results[1].value : { alertsCreated: 0 },
      documentExpiry:
        results[2].status === 'fulfilled' ? results[2].value : { alertsCreated: 0 },
      payrollReminders:
        results[3].status === 'fulfilled' ? results[3].value : { alertsCreated: 0 },
      totalAlerts:
        (results[0].status === 'fulfilled' ? results[0].value.alertsCreated : 0) +
        (results[1].status === 'fulfilled' ? results[1].value.alertsCreated : 0) +
        (results[2].status === 'fulfilled' ? results[2].value.alertsCreated : 0) +
        (results[3].status === 'fulfilled' ? results[3].value.alertsCreated : 0),
    };

    console.log('[Alert Engine] Daily alert generation completed:', summary);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error('[Alert Engine] Error generating daily alerts:', error);
    throw error;
  }
}
