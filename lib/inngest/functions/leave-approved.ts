/**
 * Event-Driven Function: Leave Approved
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: leave.approved event is published
 * Actions:
 * - Apply unpaid leave deductions to payroll (if unpaid)
 * - Create alert for HR manager
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, payrollEvents } from '@/lib/db/schema';
import { format, differenceInBusinessDays } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Leave Approved Event Handler
 */
export const leaveApprovedFunction = inngest.createFunction(
  {
    id: 'leave-approved-handler',
    name: 'Handle Leave Approval',
    retries: 3,
    rateLimit: {
      limit: 20,
      period: '1m',
    },
  },

  { event: 'leave.approved' },

  async ({ event, step }) => {
    const { employeeId, employeeName, leaveType, startDate, endDate, days, isUnpaid, tenantId } =
      event.data;

    console.log('[Inngest] Processing leave approval:', {
      employeeId,
      employeeName,
      leaveType,
      days,
      isUnpaid,
    });

    // Only process unpaid leave (paid leave doesn't affect payroll calculations)
    if (!isUnpaid) {
      console.log('[Inngest] Leave is paid, no payroll deduction needed');
      return {
        success: true,
        employeeId,
        deductionNeeded: false,
        message: 'No payroll deduction needed - leave is paid',
      };
    }

    // Step 1: Get employee current salary
    const employee = await step.run('fetch-employee-data', async () => {
      const emp = await db.query.employees.findFirst({
        where: (employees, { eq }) => eq(employees.id, employeeId),
        with: {
          currentSalary: true,
        },
      });

      if (!emp) {
        throw new Error(`Employee ${employeeId} not found`);
      }

      if (!emp.currentSalary) {
        throw new Error(`No active salary found for employee ${employeeId}`);
      }

      return emp;
    });

    // Step 2: Calculate unpaid leave deduction
    const deduction = await step.run('calculate-deduction', async () => {
      const baseSalary = employee.currentSalary!.baseSalary;

      // Assumption: 22 working days per month (standard for West Africa)
      const dailyRate = baseSalary / 22;
      const deductionAmount = dailyRate * days;

      return {
        baseSalary,
        dailyRate,
        days,
        deductionAmount,
      };
    });

    // Step 3: Create payroll event for audit trail
    const payrollEvent = await step.run('create-payroll-event', async () => {
      const [event] = await db
        .insert(payrollEvents)
        .values({
          tenantId,
          eventType: 'unpaid_leave',
          employeeId,
          eventDate: new Date(startDate),
          amountCalculated: -deduction.deductionAmount, // Negative amount (deduction)
          isProrated: true,
          workingDays: 22,
          daysWorked: 22 - days,
          metadata: {
            leaveType,
            startDate: format(new Date(startDate), 'yyyy-MM-dd'),
            endDate: format(new Date(endDate), 'yyyy-MM-dd'),
            days,
            dailyRate: deduction.dailyRate,
            deductionAmount: deduction.deductionAmount,
          },
          processingStatus: 'completed',
          processedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as any)
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

      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'unpaid_leave_deduction',
          severity: 'info',
          message: `Déduction pour congé sans solde ajoutée pour ${employeeName} (${days}j - ${Math.round(
            deduction.deductionAmount
          ).toLocaleString('fr-FR')} FCFA)`,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/events/${payrollEvent.id}`,
          actionLabel: 'Voir les détails',
          status: 'active',
          metadata: {
            leaveType,
            startDate: format(new Date(startDate), 'dd/MM/yyyy'),
            endDate: format(new Date(endDate), 'dd/MM/yyyy'),
            days,
            deductionAmount: deduction.deductionAmount,
          },
        } as any)
        .returning();

      return newAlert;
    });

    console.log('[Inngest] Leave approval processed successfully:', {
      employeeId,
      deductionAmount: deduction.deductionAmount,
      alertCreated: alert?.id || null,
    });

    return {
      success: true,
      employeeId,
      payrollEventId: payrollEvent.id,
      alertId: alert?.id,
      deduction,
    };
  }
);
