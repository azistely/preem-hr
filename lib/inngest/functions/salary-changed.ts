/**
 * Event-Driven Function: Salary Changed
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: salary.changed event is published
 * Actions:
 * - Recalculate affected payroll runs (current month if mid-month change)
 * - Create alert for HR manager to review
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, payrollEvents } from '@/lib/db/schema';
import { format, startOfMonth, endOfMonth, differenceInBusinessDays } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Salary Change Event Handler
 */
export const salaryChangedFunction = inngest.createFunction(
  {
    id: 'salary-changed-handler',
    name: 'Handle Salary Change',
    retries: 3,
    rateLimit: {
      limit: 20,
      period: '1m',
    },
  },

  { event: 'salary.changed' },

  async ({ event, step }) => {
    const { employeeId, employeeName, oldSalary, newSalary, effectiveDate, tenantId } =
      event.data;

    console.log('[Inngest] Processing salary change:', {
      employeeId,
      employeeName,
      oldSalary,
      newSalary,
      effectiveDate,
    });

    // Step 1: Determine if current month's payroll is affected
    const effectiveDateObj = new Date(effectiveDate);
    const today = new Date();
    const isMidMonthChange = effectiveDateObj.getDate() > 1;
    const isCurrentMonth =
      effectiveDateObj.getMonth() === today.getMonth() &&
      effectiveDateObj.getFullYear() === today.getFullYear();

    const needsProration = isMidMonthChange && isCurrentMonth;

    // Step 2: Calculate prorated amounts if needed
    const recalculation = await step.run('calculate-recalculation', async () => {
      if (!needsProration) {
        return {
          needsProration: false,
          message: 'Salary change effective from start of month or future month',
        };
      }

      const monthStart = startOfMonth(effectiveDateObj);
      const monthEnd = endOfMonth(effectiveDateObj);

      const totalWorkingDays = differenceInBusinessDays(monthEnd, monthStart) + 1;
      const daysAtOldSalary = differenceInBusinessDays(effectiveDateObj, monthStart);
      const daysAtNewSalary = differenceInBusinessDays(monthEnd, effectiveDateObj) + 1;

      const salaryFromOldRate = (oldSalary / totalWorkingDays) * daysAtOldSalary;
      const salaryFromNewRate = (newSalary / totalWorkingDays) * daysAtNewSalary;
      const totalSalary = salaryFromOldRate + salaryFromNewRate;

      return {
        needsProration: true,
        totalWorkingDays,
        daysAtOldSalary,
        daysAtNewSalary,
        salaryFromOldRate,
        salaryFromNewRate,
        totalSalary,
      };
    });

    // Step 3: Create payroll event for audit trail
    const payrollEvent = await step.run('create-payroll-event', async () => {
      const [event] = await db
        .insert(payrollEvents)
        .values({
          tenantId,
          eventType: 'salary_change',
          employeeId,
          eventDate: effectiveDateObj,
          amountCalculated:
            recalculation.needsProration ? recalculation.totalSalary : newSalary,
          isProrated: recalculation.needsProration,
          workingDays: recalculation.needsProration
            ? recalculation.totalWorkingDays
            : null,
          daysWorked: recalculation.needsProration ? recalculation.daysAtNewSalary : null,
          metadata: {
            oldSalary,
            newSalary,
            effectiveDate: format(effectiveDateObj, 'yyyy-MM-dd'),
            needsProration: recalculation.needsProration,
            ...(recalculation.needsProration && {
              daysAtOldSalary: recalculation.daysAtOldSalary,
              daysAtNewSalary: recalculation.daysAtNewSalary,
              salaryFromOldRate: recalculation.salaryFromOldRate,
              salaryFromNewRate: recalculation.salaryFromNewRate,
            }),
          },
          processingStatus: 'completed',
          processedAt: new Date(),
          createdAt: new Date(),
        })
        .returning();

      return event;
    });

    // Step 4: Create alert for HR manager
    const alert = await step.run('create-hr-alert', async () => {
      const hrManager = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.tenantId, tenantId),
      });

      if (!hrManager) {
        console.warn(`No HR manager found for tenant ${tenantId}`);
        return null;
      }

      const alertMessage = recalculation.needsProration
        ? `Paie recalculée suite au changement de salaire de ${employeeName} (proratisée)`
        : `Salaire de ${employeeName} modifié à partir du ${format(
            effectiveDateObj,
            'dd MMMM yyyy',
            { locale: fr }
          )}`;

      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'payroll_recalculated',
          severity: recalculation.needsProration ? 'warning' : 'info',
          message: alertMessage,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/events/${payrollEvent.id}`,
          actionLabel: 'Voir les détails',
          status: 'active',
          metadata: {
            oldSalary,
            newSalary,
            effectiveDate: format(effectiveDateObj, 'dd/MM/yyyy'),
            needsProration: recalculation.needsProration,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newAlert;
    });

    console.log('[Inngest] Salary change processed successfully:', {
      employeeId,
      needsProration: recalculation.needsProration,
      alertCreated: alert?.id || null,
    });

    return {
      success: true,
      employeeId,
      payrollEventId: payrollEvent.id,
      alertId: alert?.id,
      recalculation,
    };
  }
);
