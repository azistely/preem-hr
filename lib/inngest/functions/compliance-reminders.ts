/**
 * Compliance Action Item Reminders
 *
 * Runs daily at 7 AM to:
 * 1. Send alerts for action items due today
 * 2. Send alerts for action items overdue
 * 3. Send weekly summary to HR managers
 */

import { inngest } from '../client';
import { db } from '@/db';
import {
  complianceActionItems,
  complianceTrackers,
  complianceTrackerTypes,
} from '@/lib/db/schema/compliance-tracker';
import { employees, users, alerts } from '@/drizzle/schema';
import { eq, and, lt, sql, lte, gte, inArray } from 'drizzle-orm';
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export const complianceActionReminders = inngest.createFunction(
  { id: 'compliance-action-reminders', name: 'Compliance Action Item Reminders' },
  { cron: '0 7 * * *' }, // Every day at 7 AM
  async ({ step }) => {
    const result = await step.run('send-compliance-reminders', async () => {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const threeDaysFromNow = format(addDays(today, 3), 'yyyy-MM-dd');

      const results = {
        overdueAlerts: 0,
        dueSoonAlerts: 0,
        errors: [] as Array<{ actionId: string; error: string }>,
      };

      // 1. Find overdue actions (status not completed/cancelled, dueDate < today)
      // Note: We send reminders daily for overdue actions until they're completed
      const overdueActions = await db
        .select({
          action: complianceActionItems,
          tracker: {
            id: complianceTrackers.id,
            referenceNumber: complianceTrackers.referenceNumber,
            title: complianceTrackers.title,
          },
          trackerType: {
            name: complianceTrackerTypes.name,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceActionItems)
        .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
        .where(
          and(
            sql`${complianceActionItems.status} NOT IN ('completed', 'cancelled')`,
            lt(complianceActionItems.dueDate, todayStr)
          )
        );

      // Send overdue alerts
      for (const { action, tracker, trackerType, assignee } of overdueActions) {
        try {
          if (!assignee?.id) continue;

          // Find user linked to this employee
          const [assigneeUser] = await db
            .select()
            .from(users)
            .where(eq(users.employeeId, assignee.id))
            .limit(1);

          if (!assigneeUser) continue;

          const daysOverdue = Math.floor(
            (today.getTime() - new Date(action.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Create alert
          await db.insert(alerts).values({
            tenantId: action.tenantId,
            type: 'compliance_action_overdue',
            severity: daysOverdue > 7 ? 'urgent' : 'warning',
            message: `Action en retard (${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}): ${action.title}`,
            assigneeId: assigneeUser.id,
            actionUrl: `/compliance/trackers/${tracker?.id}`,
            actionLabel: 'Voir le dossier',
            dueDate: action.dueDate ? new Date(action.dueDate).toISOString() : null,
            metadata: {
              actionItemId: action.id,
              trackerId: tracker?.id,
              trackerReference: tracker?.referenceNumber,
              daysOverdue,
            },
          });

          results.overdueAlerts++;
        } catch (error) {
          results.errors.push({
            actionId: action.id,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
        }
      }

      // 2. Find actions due within 3 days (not overdue, not completed)
      // Note: We send reminders for actions due today or within 3 days
      const dueSoonActions = await db
        .select({
          action: complianceActionItems,
          tracker: {
            id: complianceTrackers.id,
            referenceNumber: complianceTrackers.referenceNumber,
            title: complianceTrackers.title,
          },
          trackerType: {
            name: complianceTrackerTypes.name,
          },
          assignee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(complianceActionItems)
        .leftJoin(complianceTrackers, eq(complianceActionItems.trackerId, complianceTrackers.id))
        .leftJoin(complianceTrackerTypes, eq(complianceTrackers.trackerTypeId, complianceTrackerTypes.id))
        .leftJoin(employees, eq(complianceActionItems.assigneeId, employees.id))
        .where(
          and(
            sql`${complianceActionItems.status} NOT IN ('completed', 'cancelled')`,
            gte(complianceActionItems.dueDate, todayStr),
            lte(complianceActionItems.dueDate, threeDaysFromNow)
          )
        );

      // Send due soon alerts
      for (const { action, tracker, trackerType, assignee } of dueSoonActions) {
        try {
          if (!assignee?.id) continue;

          // Find user linked to this employee
          const [assigneeUser] = await db
            .select()
            .from(users)
            .where(eq(users.employeeId, assignee.id))
            .limit(1);

          if (!assigneeUser) continue;

          const dueDate = new Date(action.dueDate!);
          const isToday = format(dueDate, 'yyyy-MM-dd') === todayStr;

          // Create alert
          await db.insert(alerts).values({
            tenantId: action.tenantId,
            type: 'compliance_action_due_soon',
            severity: isToday ? 'warning' : 'info',
            message: isToday
              ? `Action à faire aujourd'hui: ${action.title}`
              : `Action à échéance proche (${format(dueDate, 'dd/MM', { locale: fr })}): ${action.title}`,
            assigneeId: assigneeUser.id,
            actionUrl: `/compliance/trackers/${tracker?.id}`,
            actionLabel: 'Voir le dossier',
            dueDate: dueDate.toISOString(),
            metadata: {
              actionItemId: action.id,
              trackerId: tracker?.id,
              trackerReference: tracker?.referenceNumber,
            },
          });

          results.dueSoonAlerts++;
        } catch (error) {
          results.errors.push({
            actionId: action.id,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
        }
      }

      return results;
    });

    return result;
  }
);

/**
 * Weekly Compliance Summary
 *
 * Sends every Monday at 8 AM to HR managers
 */
export const complianceWeeklySummary = inngest.createFunction(
  { id: 'compliance-weekly-summary', name: 'Weekly Compliance Summary' },
  { cron: '0 8 * * 1' }, // Every Monday at 8 AM
  async ({ step }) => {
    const result = await step.run('send-weekly-summary', async () => {
      // Get distinct tenants with compliance data
      const tenants = await db
        .selectDistinct({ tenantId: complianceTrackers.tenantId })
        .from(complianceTrackers);

      const results = {
        summariesSent: 0,
        errors: [] as Array<{ tenantId: string; error: string }>,
      };

      for (const { tenantId } of tenants) {
        try {
          // Get summary stats for this tenant
          const [stats] = await db
            .select({
              openTrackers: sql<number>`count(DISTINCT ${complianceTrackers.id}) FILTER (WHERE ${complianceTrackers.status} != 'cloture')`,
              criticalTrackers: sql<number>`count(DISTINCT ${complianceTrackers.id}) FILTER (WHERE ${complianceTrackers.priority} = 'critical' AND ${complianceTrackers.status} != 'cloture')`,
              overdueActions: sql<number>`count(DISTINCT ${complianceActionItems.id}) FILTER (WHERE ${complianceActionItems.status} NOT IN ('completed', 'cancelled') AND ${complianceActionItems.dueDate} < CURRENT_DATE)`,
              pendingActions: sql<number>`count(DISTINCT ${complianceActionItems.id}) FILTER (WHERE ${complianceActionItems.status} = 'pending')`,
            })
            .from(complianceTrackers)
            .leftJoin(complianceActionItems, eq(complianceActionItems.trackerId, complianceTrackers.id))
            .where(eq(complianceTrackers.tenantId, tenantId));

          // Find HR managers for this tenant
          const hrManagers = await db
            .select({ userId: users.id })
            .from(users)
            .where(
              and(
                eq(users.tenantId, tenantId),
                inArray(users.role, ['hr_manager', 'tenant_admin', 'super_admin'])
              )
            );

          // Create summary alert for each HR manager
          for (const { userId } of hrManagers) {
            await db.insert(alerts).values({
              tenantId,
              type: 'compliance_weekly_summary',
              severity: stats.overdueActions > 0 ? 'warning' : 'info',
              message: `Résumé hebdo: ${stats.openTrackers} dossier(s) ouvert(s), ${stats.overdueActions} action(s) en retard, ${stats.pendingActions} action(s) en attente`,
              assigneeId: userId,
              actionUrl: '/compliance',
              actionLabel: 'Voir le tableau de bord',
              metadata: {
                openTrackers: stats.openTrackers,
                criticalTrackers: stats.criticalTrackers,
                overdueActions: stats.overdueActions,
                pendingActions: stats.pendingActions,
              },
            });
          }

          results.summariesSent += hrManagers.length;
        } catch (error) {
          results.errors.push({
            tenantId,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
        }
      }

      return results;
    });

    return result;
  }
);
