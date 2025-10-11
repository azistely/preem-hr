/**
 * Alert Creation Engine
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Proactively creates alerts for HR managers:
 * - Contract expiry notifications (30/15/7 days before)
 * - Leave notifications (upcoming absences)
 * - Document expiry warnings
 * - Payroll reminders
 *
 * FIXED: Schema mismatches corrected
 * - Removed non-existent assignments.status (use employee.status instead)
 * - Removed non-existent assignments.terminationDate (use employee.terminationDate instead)
 * - Query now properly joins employees table to check active status
 */

import { db } from '@/lib/db';
import { alerts, assignments, employees, users } from '@/lib/db/schema';
import { payrollRuns } from '@/lib/db/schema/payroll';
import { tenants } from '@/lib/db/schema/tenants';
import { timeOffBalances, timeOffRequests } from '@/lib/db/schema/time-tracking';
import { and, eq, gte, lte, isNull, sql, or, gt, lt } from 'drizzle-orm';
import { addDays, differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { sendEvent } from '@/lib/inngest/client';

/**
 * Helper function to trigger email notification for new alert
 */
async function triggerEmailNotification(alertId: string) {
  try {
    await sendEvent({
      name: 'alert.created',
      data: { alertId },
    });
  } catch (error) {
    console.error('[Alert Engine] Failed to trigger email notification:', error);
  }
}

/**
 * Create contract expiry alerts for all tenants
 * Run daily as a scheduled job
 */
export async function createContractExpiryAlerts() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const in30Days = addDays(today, 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];

  // Find all active contracts (assignments) expiring in the next 30 days
  // Active = employee is active AND assignment has an effectiveTo date in the next 30 days
  const expiringContracts = await db
    .select({
      id: assignments.id,
      employeeId: assignments.employeeId,
      effectiveTo: assignments.effectiveTo,
      assignmentType: assignments.assignmentType,
      tenantId: assignments.tenantId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      employeeStatus: employees.status,
      employeeTerminationDate: employees.terminationDate,
      employeeTenantId: employees.tenantId,
    })
    .from(assignments)
    .innerJoin(employees, eq(assignments.employeeId, employees.id))
    .where(
      and(
        // Assignment must have an end date
        sql`${assignments.effectiveTo} IS NOT NULL`,
        // End date must be in the next 30 days
        gte(assignments.effectiveTo, todayStr),
        lte(assignments.effectiveTo, in30DaysStr)
      )
    );

  let alertsCreated = 0;

  for (const contract of expiringContracts) {
    if (!contract.effectiveTo) continue;

    // Skip if employee is not active (terminated or inactive)
    if (contract.employeeStatus !== 'active') continue;

    // Skip if employee already has a termination date (being processed)
    if (contract.employeeTerminationDate) continue;

    const daysUntilExpiry = differenceInDays(new Date(contract.effectiveTo), today);

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
            message: `Contrat de ${contract.employeeFirstName} ${contract.employeeLastName} expire dans ${daysUntilExpiry} jours`,
            dueDate: new Date(contract.effectiveTo),
            updatedAt: new Date(),
          })
          .where(eq(alerts.id, existingAlert.id));
      }
      continue;
    }

    // Find HR manager or tenant admin to assign alert to
    const hrManager = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, contract.employeeTenantId),
        sql`${users.role} IN ('hr_manager', 'tenant_admin')`
      ),
      orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
    });

    if (!hrManager) {
      console.warn(
        `No HR manager found for tenant ${contract.employeeTenantId}, skipping alert`
      );
      continue;
    }

    // Create alert
    await db.insert(alerts).values({
      tenantId: contract.employeeTenantId,
      type: 'contract_expiry',
      severity,
      message: `Contrat de ${contract.employeeFirstName} ${contract.employeeLastName} expire dans ${daysUntilExpiry} jours`,
      assigneeId: hrManager.id,
      employeeId: contract.employeeId,
      actionUrl: `/employees/${contract.employeeId}/assignments/${contract.id}`,
      actionLabel: 'Renouveler le contrat',
      dueDate: new Date(contract.effectiveTo),
      status: 'active',
      metadata: {
        contractId: contract.id,
        contractType: contract.assignmentType,
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
 * Alerts managers about team members going on leave and low balances
 */
export async function createLeaveNotifications() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const in7Days = addDays(today, 7);
  const in7DaysStr = in7Days.toISOString().split('T')[0];

  let alertsCreated = 0;

  // 1. Low Balance Alerts - Alert employees when leave balance < 5 days
  // Note: Currently disabled - employees don't have user accounts to receive alerts
  // This would require a user_id field in the employees table
  const lowBalances = await db
    .select({
      id: timeOffBalances.id,
      employeeId: timeOffBalances.employeeId,
      policyId: timeOffBalances.policyId,
      available: timeOffBalances.available,
      tenantId: timeOffBalances.tenantId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(timeOffBalances)
    .innerJoin(employees, eq(timeOffBalances.employeeId, employees.id))
    .where(
      and(
        eq(employees.status, 'active'),
        lt(timeOffBalances.available, '5'),
        gte(timeOffBalances.available, '0'),
        eq(timeOffBalances.year, today.getFullYear())
      )
    );

  // Skip low balance alerts for now - employees need user accounts to receive them
  // TODO: Implement once employees have user_id field to link to users table

  // 2. Pending Leave Requests - Alert managers when team members request leave
  const pendingRequests = await db
    .select({
      id: timeOffRequests.id,
      employeeId: timeOffRequests.employeeId,
      policyId: timeOffRequests.policyId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      daysRequested: timeOffRequests.daysRequested,
      tenantId: timeOffRequests.tenantId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      employeeTenantId: employees.tenantId,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(
      and(
        eq(timeOffRequests.status, 'pending'),
        eq(employees.status, 'active')
      )
    );

  for (const request of pendingRequests) {
    // Check if alert already exists
    const existingAlert = await db.query.alerts.findFirst({
      where: and(
        eq(alerts.type, 'leave_request_pending'),
        sql`metadata->>'requestId' = ${request.id}`,
        eq(alerts.status, 'active')
      ),
    });

    if (!existingAlert) {
      // Find HR manager for this tenant
      const hrManager = await db.query.users.findFirst({
        where: and(
          eq(users.tenantId, request.tenantId),
          sql`${users.role} IN ('hr_manager', 'tenant_admin')`
        ),
        orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
      });

      if (hrManager) {
        await db.insert(alerts).values({
          tenantId: request.tenantId,
          type: 'leave_request_pending',
          severity: 'warning',
          message: `${request.employeeFirstName} ${request.employeeLastName} demande ${request.daysRequested} jour(s) de congé`,
          assigneeId: hrManager.id,
          employeeId: request.employeeId,
          actionUrl: `/time-off/requests/${request.id}`,
          actionLabel: 'Examiner la demande',
          status: 'active',
          metadata: {
            requestId: request.id,
            startDate: request.startDate,
            endDate: request.endDate,
            daysRequested: request.daysRequested,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        alertsCreated++;
      }
    }
  }

  // 3. Upcoming Approved Leave - Alert managers about team members going on leave soon
  const upcomingLeave = await db
    .select({
      id: timeOffRequests.id,
      employeeId: timeOffRequests.employeeId,
      policyId: timeOffRequests.policyId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      daysRequested: timeOffRequests.daysRequested,
      tenantId: timeOffRequests.tenantId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(
      and(
        eq(timeOffRequests.status, 'approved'),
        gte(timeOffRequests.startDate, todayStr),
        lte(timeOffRequests.startDate, in7DaysStr),
        eq(employees.status, 'active')
      )
    );

  for (const leave of upcomingLeave) {
    // Check if alert already exists
    const existingAlert = await db.query.alerts.findFirst({
      where: and(
        eq(alerts.type, 'leave_upcoming'),
        sql`metadata->>'requestId' = ${leave.id}`,
        eq(alerts.status, 'active')
      ),
    });

    if (!existingAlert) {
      // Find HR manager
      const hrManager = await db.query.users.findFirst({
        where: and(
          eq(users.tenantId, leave.tenantId),
          sql`${users.role} IN ('hr_manager', 'tenant_admin')`
        ),
        orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
      });

      if (hrManager) {
        const daysUntilLeave = differenceInDays(new Date(leave.startDate), today);
        const severity = daysUntilLeave <= 2 ? 'warning' : 'info';

        await db.insert(alerts).values({
          tenantId: leave.tenantId,
          type: 'leave_upcoming',
          severity,
          message: `${leave.employeeFirstName} ${leave.employeeLastName} en congé à partir du ${format(new Date(leave.startDate), 'dd/MM/yyyy', { locale: fr })}`,
          assigneeId: hrManager.id,
          employeeId: leave.employeeId,
          actionUrl: `/time-off/requests/${leave.id}`,
          actionLabel: 'Voir les détails',
          dueDate: new Date(leave.startDate),
          status: 'active',
          metadata: {
            requestId: leave.id,
            startDate: leave.startDate,
            endDate: leave.endDate,
            daysRequested: leave.daysRequested,
            daysUntilLeave,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        alertsCreated++;
      }
    }
  }

  return {
    success: true,
    alertsCreated,
    message: `Created ${alertsCreated} leave notification alerts`,
  };
}

/**
 * Create document expiry warnings
 * Alerts for work permits, medical certificates, ID cards, etc.
 *
 * Uses manual SELECT + JOIN pattern for proper Drizzle query support
 */
export async function createDocumentExpiryAlerts() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const in30Days = addDays(today, 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];

  let alertsCreated = 0;

  // Check for expiring employee documents using manual SELECT (Drizzle query pattern)
  const employeesList = await db
    .select({
      id: employees.id,
      tenantId: employees.tenantId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      status: employees.status,
      nationalIdExpiry: employees.nationalIdExpiry,
      workPermitExpiry: employees.workPermitExpiry,
    })
    .from(employees)
    .where(
      and(
        eq(employees.status, 'active'),
        or(
          // National ID expiry
          and(
            sql`${employees.nationalIdExpiry} IS NOT NULL`,
            gte(employees.nationalIdExpiry, todayStr),
            lte(employees.nationalIdExpiry, in30DaysStr)
          ),
          // Work permit expiry
          and(
            sql`${employees.workPermitExpiry} IS NOT NULL`,
            gte(employees.workPermitExpiry, todayStr),
            lte(employees.workPermitExpiry, in30DaysStr)
          )
        )
      )
    );

  for (const employee of employeesList) {
    // Check National ID expiry
    if (employee.nationalIdExpiry) {
      const expiryDate = new Date(employee.nationalIdExpiry);
      const daysUntilExpiry = differenceInDays(expiryDate, today);

      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
        const severity = daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'warning' : 'info';

        // Check if alert already exists
        const existingAlert = await db.query.alerts.findFirst({
          where: and(
            eq(alerts.type, 'document_expiry'),
            eq(alerts.employeeId, employee.id),
            eq(alerts.status, 'active'),
            sql`metadata->>'documentType' = 'national_id'`
          ),
        });

        if (!existingAlert) {
          // Find HR manager
          const hrManager = await db.query.users.findFirst({
            where: and(
              eq(users.tenantId, employee.tenantId),
              sql`${users.role} IN ('hr_manager', 'tenant_admin')`
            ),
            orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
          });

          if (hrManager) {
            await db.insert(alerts).values({
              tenantId: employee.tenantId,
              type: 'document_expiry',
              severity,
              message: `Pièce d'identité de ${employee.firstName} ${employee.lastName} expire dans ${daysUntilExpiry} jours`,
              assigneeId: hrManager.id,
              employeeId: employee.id,
              actionUrl: `/employees/${employee.id}/documents`,
              actionLabel: 'Mettre à jour le document',
              dueDate: new Date(employee.nationalIdExpiry),
              status: 'active',
              metadata: {
                documentType: 'national_id',
                daysUntilExpiry,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            alertsCreated++;
          }
        } else if (existingAlert.severity !== severity) {
          // Update severity if changed
          await db
            .update(alerts)
            .set({
              severity,
              message: `Pièce d'identité de ${employee.firstName} ${employee.lastName} expire dans ${daysUntilExpiry} jours`,
              dueDate: new Date(employee.nationalIdExpiry),
              updatedAt: new Date(),
            })
            .where(eq(alerts.id, existingAlert.id));
        }
      }
    }

    // Check Work Permit expiry
    if (employee.workPermitExpiry) {
      const expiryDate = new Date(employee.workPermitExpiry);
      const daysUntilExpiry = differenceInDays(expiryDate, today);

      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
        const severity = daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'warning' : 'info';

        const existingAlert = await db.query.alerts.findFirst({
          where: and(
            eq(alerts.type, 'document_expiry'),
            eq(alerts.employeeId, employee.id),
            eq(alerts.status, 'active'),
            sql`metadata->>'documentType' = 'work_permit'`
          ),
        });

        if (!existingAlert) {
          const hrManager = await db.query.users.findFirst({
            where: and(
              eq(users.tenantId, employee.tenantId),
              sql`${users.role} IN ('hr_manager', 'tenant_admin')`
            ),
            orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
          });

          if (hrManager) {
            await db.insert(alerts).values({
              tenantId: employee.tenantId,
              type: 'document_expiry',
              severity,
              message: `Permis de travail de ${employee.firstName} ${employee.lastName} expire dans ${daysUntilExpiry} jours`,
              assigneeId: hrManager.id,
              employeeId: employee.id,
              actionUrl: `/employees/${employee.id}/documents`,
              actionLabel: 'Renouveler le permis',
              dueDate: new Date(employee.workPermitExpiry),
              status: 'active',
              metadata: {
                documentType: 'work_permit',
                daysUntilExpiry,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            alertsCreated++;
          }
        } else if (existingAlert.severity !== severity) {
          await db
            .update(alerts)
            .set({
              severity,
              message: `Permis de travail de ${employee.firstName} ${employee.lastName} expire dans ${daysUntilExpiry} jours`,
              dueDate: new Date(employee.workPermitExpiry),
              updatedAt: new Date(),
            })
            .where(eq(alerts.id, existingAlert.id));
        }
      }
    }
  }

  return {
    success: true,
    alertsCreated,
    message: `Created ${alertsCreated} document expiry alerts`,
  };
}

/**
 * Create monthly payroll reminders
 * Reminds HR managers to run payroll
 */
export async function createPayrollReminders() {
  const today = new Date();
  const dayOfMonth = today.getDate();
  let alertsCreated = 0;

  // Alert on 25th of each month to prepare payroll (3 days before month end)
  if (dayOfMonth === 25) {
    const tenantsList = await db.query.tenants.findMany({
      where: eq(tenants.status, 'active'),
    });

    for (const tenant of tenantsList) {
      // Check if payroll reminder already exists for this month
      const existingAlert = await db.query.alerts.findFirst({
        where: and(
          eq(alerts.tenantId, tenant.id),
          eq(alerts.type, 'payroll_reminder'),
          eq(alerts.status, 'active'),
          sql`metadata->>'reminderType' = 'prepare'`,
          sql`metadata->>'month' = ${today.getMonth() + 1}::text`,
          sql`metadata->>'year' = ${today.getFullYear()}::text`
        ),
      });

      if (!existingAlert) {
        const hrManager = await db.query.users.findFirst({
          where: and(
            eq(users.tenantId, tenant.id),
            sql`${users.role} IN ('hr_manager', 'tenant_admin')`
          ),
          orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
        });

        if (hrManager) {
          await db.insert(alerts).values({
            tenantId: tenant.id,
            type: 'payroll_reminder',
            severity: 'warning',
            message: `Préparez la paie du mois de ${format(today, 'MMMM yyyy', { locale: fr })}`,
            assigneeId: hrManager.id,
            actionUrl: '/payroll/new',
            actionLabel: 'Lancer la paie',
            dueDate: addDays(today, 6), // Due by end of month
            status: 'active',
            metadata: {
              reminderType: 'prepare',
              month: today.getMonth() + 1,
              year: today.getFullYear(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          alertsCreated++;
        }
      }
    }
  }

  // Alert on 5th of each month if payroll not run for previous month
  if (dayOfMonth === 5) {
    const tenantsList2 = await db.query.tenants.findMany({
      where: eq(tenants.status, 'active'),
    });

    for (const tenant of tenantsList2) {
      const previousMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
      const previousYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

      // Check if payroll was run for previous month
      const payrollRun = await db.query.payrollRuns.findFirst({
        where: and(
          eq(payrollRuns.tenantId, tenant.id),
          sql`EXTRACT(MONTH FROM pay_period_start) = ${previousMonth + 1}`,
          sql`EXTRACT(YEAR FROM pay_period_start) = ${previousYear}`
        ),
      });

      if (!payrollRun) {
        // Check if alert already exists
        const existingAlert = await db.query.alerts.findFirst({
          where: and(
            eq(alerts.tenantId, tenant.id),
            eq(alerts.type, 'payroll_reminder'),
            eq(alerts.status, 'active'),
            sql`metadata->>'reminderType' = 'overdue'`,
            sql`metadata->>'month' = ${previousMonth + 1}::text`,
            sql`metadata->>'year' = ${previousYear}::text`
          ),
        });

        if (!existingAlert) {
          const hrManager = await db.query.users.findFirst({
            where: and(
              eq(users.tenantId, tenant.id),
              sql`${users.role} IN ('hr_manager', 'tenant_admin')`
            ),
            orderBy: sql`CASE WHEN ${users.role} = 'hr_manager' THEN 0 ELSE 1 END`,
          });

          if (hrManager) {
            const previousMonthDate = new Date(previousYear, previousMonth, 1);
            await db.insert(alerts).values({
              tenantId: tenant.id,
              type: 'payroll_reminder',
              severity: 'urgent',
              message: `Paie non lancée pour ${format(previousMonthDate, 'MMMM yyyy', { locale: fr })}`,
              assigneeId: hrManager.id,
              actionUrl: '/payroll/new',
              actionLabel: 'Lancer la paie',
              dueDate: addDays(today, 2), // Urgent - 2 days to complete
              status: 'active',
              metadata: {
                reminderType: 'overdue',
                month: previousMonth + 1,
                year: previousYear,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            alertsCreated++;
          }
        }
      }
    }
  }

  return {
    success: true,
    alertsCreated,
    message: `Created ${alertsCreated} payroll reminder alerts`,
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
