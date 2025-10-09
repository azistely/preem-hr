/**
 * Event-Driven Function: Employee Hired
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: employee.hired event is published
 * Actions:
 * - Calculate prorated first payroll (if hired mid-month)
 * - Create alert for HR manager
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, payrollEvents, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { differenceInBusinessDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';

function getWorkingDaysInMonth(date: Date): number {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return differenceInBusinessDays(end, start) + 1;
}

function getDaysWorkedFrom(hireDate: Date, monthEnd: Date): number {
  return differenceInBusinessDays(monthEnd, hireDate) + 1;
}

/**
 * Employee Hired Event Handler
 */
export const employeeHiredFunction = inngest.createFunction(
  {
    id: 'employee-hired-handler',
    name: 'Handle Employee Hire',
    retries: 3,
    rateLimit: {
      limit: 10,
      period: '1m',
    },
  },

  { event: 'employee.hired' },

  async ({ event, step }) => {
    const { employeeId, employeeName, hireDate, startDate, baseSalary, tenantId } = event.data;

    console.log('[Inngest] Processing employee hire:', {
      employeeId,
      employeeName,
      hireDate,
      baseSalary,
    });

    // Only create prorated payroll if hired mid-month
    const hireDateObj = new Date(hireDate);
    const isFirstDayOfMonth = hireDateObj.getDate() === 1;

    if (isFirstDayOfMonth) {
      console.log('[Inngest] Employee hired on first day of month, no proration needed');
      return {
        success: true,
        employeeId,
        prorationNeeded: false,
        message: 'No proration needed - hired on first day of month',
      };
    }

    // Step 1: Calculate prorated first payroll
    const firstPayroll = await step.run('calculate-prorated-payroll', async () => {
      const monthEnd = endOfMonth(hireDateObj);
      const totalWorkingDays = getWorkingDaysInMonth(hireDateObj);
      const daysWorked = getDaysWorkedFrom(hireDateObj, monthEnd);
      const prorationPercentage = (daysWorked / totalWorkingDays) * 100;

      const proratedSalary = (baseSalary / totalWorkingDays) * daysWorked;

      return {
        baseSalary,
        proratedSalary,
        totalWorkingDays,
        daysWorked,
        prorationPercentage,
      };
    });

    // Step 2: Create payroll event
    const payrollEvent = await step.run('create-payroll-event', async () => {
      const [event] = await db
        .insert(payrollEvents)
        .values({
          tenantId,
          eventType: 'hire',
          employeeId,
          eventDate: hireDateObj,
          amountCalculated: firstPayroll.proratedSalary,
          isProrated: true,
          workingDays: firstPayroll.totalWorkingDays,
          daysWorked: firstPayroll.daysWorked,
          prorationPercentage: firstPayroll.prorationPercentage,
          metadata: {
            baseSalary: firstPayroll.baseSalary,
            proratedSalary: firstPayroll.proratedSalary,
            hireDate: format(hireDateObj, 'yyyy-MM-dd'),
          },
          processingStatus: 'completed',
          processedAt: new Date(),
          createdAt: new Date(),
        })
        .returning();

      return event;
    });

    // Step 3: Create alert for HR manager
    const alert = await step.run('create-hr-alert', async () => {
      const hrManager = await db.query.users.findFirst({
        where: eq(employees.tenantId, tenantId),
      });

      if (!hrManager) {
        console.warn(`No HR manager found for tenant ${tenantId}`);
        return null;
      }

      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'prorated_payroll_created',
          severity: 'info',
          message: `Paie au prorata créée pour ${employeeName} (embauche le ${format(
            hireDateObj,
            'dd MMM',
            { locale: fr }
          )})`,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/events/${payrollEvent.id}`,
          actionLabel: 'Vérifier la paie',
          status: 'active',
          metadata: {
            hireDate: format(hireDateObj, 'dd/MM/yyyy'),
            proratedAmount: firstPayroll.proratedSalary,
            daysWorked: firstPayroll.daysWorked,
            totalWorkingDays: firstPayroll.totalWorkingDays,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newAlert;
    });

    console.log('[Inngest] Employee hire processed successfully:', {
      employeeId,
      proratedAmount: firstPayroll.proratedSalary,
      alertCreated: alert?.id || null,
    });

    return {
      success: true,
      employeeId,
      payrollEventId: payrollEvent.id,
      alertId: alert?.id,
      firstPayroll,
    };
  }
);
