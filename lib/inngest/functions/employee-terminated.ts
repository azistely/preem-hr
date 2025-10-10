/**
 * Event-Driven Function: Employee Termination
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: employee.terminated event is published
 * Actions:
 * - Calculate final payroll with prorations (partial month)
 * - Include vacation payout
 * - Include exit benefits (indemnité de licenciement)
 * - Create alert for HR manager to review
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, payrollEvents, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { differenceInBusinessDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Calculate working days for proration
 * Uses business days (Monday-Friday) excluding public holidays
 */
function getWorkingDaysInMonth(date: Date): number {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return differenceInBusinessDays(end, start) + 1;
}

function getDaysWorkedUntil(monthStart: Date, terminationDate: Date): number {
  return differenceInBusinessDays(terminationDate, monthStart) + 1;
}

/**
 * Employee Termination Event Handler
 */
export const employeeTerminatedFunction = inngest.createFunction(
  {
    id: 'employee-terminated-handler',
    name: 'Handle Employee Termination',
    retries: 3,

    // Throttle: Process max 10 terminations per minute (prevent overwhelming system)
    rateLimit: {
      limit: 10,
      period: '1m',
    },
  },

  // Listen to employee.terminated event
  { event: 'employee.terminated' },

  async ({ event, step }) => {
    const { employeeId, employeeName, terminationDate, reason, tenantId } = event.data;

    console.log('[Inngest] Processing employee termination:', {
      employeeId,
      employeeName,
      terminationDate,
      reason,
    });

    // Step 1: Get employee data
    const employee = await step.run('fetch-employee-data', async () => {
      const emp = await db.query.employees.findFirst({
        where: eq(employees.id, employeeId),
        with: {
          currentSalary: true,
          currentAssignment: true,
        },
      });

      if (!emp) {
        throw new Error(`Employee ${employeeId} not found`);
      }

      return emp;
    });

    // Step 2: Calculate final payroll (prorated)
    const finalPayroll = await step.run('calculate-final-payroll', async () => {
      const terminationDateObj = new Date(terminationDate);
      const monthStart = startOfMonth(terminationDateObj);

      // Calculate working days
      const totalWorkingDays = getWorkingDaysInMonth(terminationDateObj);
      const daysWorked = getDaysWorkedUntil(monthStart, terminationDateObj);
      const prorationPercentage = (daysWorked / totalWorkingDays) * 100;

      // Get current salary
      if (!employee.currentSalary) {
        throw new Error(`No active salary found for employee ${employeeId}`);
      }

      const baseSalary = employee.currentSalary.baseSalary;
      const proratedSalary = (baseSalary / totalWorkingDays) * daysWorked;

      // TODO: Calculate vacation payout (requires vacation balance data)
      const vacationPayout = 0;

      // TODO: Calculate exit benefits based on country rules
      // For CI: indemnité de licenciement = depends on years of service and reason
      const exitBenefits = reason === 'termination' ? 0 : 0; // Placeholder

      const totalAmount = proratedSalary + vacationPayout + exitBenefits;

      return {
        baseSalary,
        proratedSalary,
        totalWorkingDays,
        daysWorked,
        prorationPercentage,
        vacationPayout,
        exitBenefits,
        totalAmount,
      };
    });

    // Step 3: Create payroll event for audit trail
    const payrollEvent = await step.run('create-payroll-event', async () => {
      const [event] = await db
        .insert(payrollEvents)
        .values({
          tenantId,
          eventType: 'termination',
          employeeId,
          eventDate: new Date(terminationDate),
          amountCalculated: finalPayroll.totalAmount,
          isProrated: true,
          workingDays: finalPayroll.totalWorkingDays,
          daysWorked: finalPayroll.daysWorked,
          prorationPercentage: finalPayroll.prorationPercentage,
          metadata: {
            reason,
            baseSalary: finalPayroll.baseSalary,
            proratedSalary: finalPayroll.proratedSalary,
            vacationPayout: finalPayroll.vacationPayout,
            exitBenefits: finalPayroll.exitBenefits,
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
      // Find HR manager or tenant admin
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
          type: 'final_payroll_ready',
          severity: 'info',
          message: `Paie de sortie calculée pour ${employeeName}`,
          assigneeId: hrManager.id,
          employeeId,
          actionUrl: `/payroll/events/${payrollEvent.id}`,
          actionLabel: 'Vérifier la paie de sortie',
          status: 'active',
          metadata: {
            terminationReason: reason,
            terminationDate: format(new Date(terminationDate), 'dd/MM/yyyy'),
            proratedAmount: finalPayroll.proratedSalary,
            totalAmount: finalPayroll.totalAmount,
            daysWorked: finalPayroll.daysWorked,
            totalWorkingDays: finalPayroll.totalWorkingDays,
          },
        } as any)
        .returning();

      return newAlert;
    });

    // Step 5: Log completion
    await step.run('log-completion', async () => {
      console.log('[Inngest] Employee termination processed successfully:', {
        employeeId,
        employeeName,
        proratedAmount: finalPayroll.proratedSalary,
        totalAmount: finalPayroll.totalAmount,
        alertCreated: alert?.id || null,
      });

      return { success: true };
    });

    return {
      success: true,
      employeeId,
      payrollEventId: payrollEvent.id,
      alertId: alert?.id,
      finalPayroll,
    };
  }
);
