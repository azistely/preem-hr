/**
 * Payroll Run Completed Event Handler
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 3
 *
 * Triggered when payroll run completes successfully.
 * Actions:
 * - Create summary alert for HR manager
 * - Generate payroll reports (future)
 * - Update employee payment history (future)
 * - Send email notifications
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { EventPayload } from '../event-registry';

export const payrollRunCompletedFunction = inngest.createFunction(
  {
    id: 'payroll-run-completed',
    name: 'Handle Payroll Run Completion',
    retries: 3,
  },
  { event: 'payroll.run.completed' },
  async ({ event, step }) => {
    const payload = event.data as EventPayload<'payroll.run.completed'>;
    const {
      payrollRunId,
      tenantId,
      period,
      employeesCount,
      totalNetSalaries,
      totalDeductions,
      totalEmployerCosts,
      status,
      completedBy,
      completedAt,
    } = payload;

    console.log('[Payroll Run Completed]', {
      payrollRunId,
      period: `${period.month}/${period.year}`,
      employeesCount,
      status,
    });

    // Step 1: Format payroll summary
    const summary = await step.run('format-summary', async () => {
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const monthName = monthNames[period.month - 1];

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
          style: 'decimal',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount) + ' FCFA';
      };

      return {
        periodLabel: `${monthName} ${period.year}`,
        employeesCount,
        totalNetSalariesFormatted: formatCurrency(totalNetSalaries),
        totalDeductionsFormatted: formatCurrency(totalDeductions),
        totalEmployerCostsFormatted: formatCurrency(totalEmployerCosts),
        totalCostFormatted: formatCurrency(totalNetSalaries + totalEmployerCosts),
        status,
        statusLabel: status === 'calculated' ? 'Calculée' :
                     status === 'approved' ? 'Approuvée' :
                     status === 'paid' ? 'Payée' : status,
      };
    });

    // Step 2: Determine alert severity and message
    const alertConfig = await step.run('determine-alert-config', async () => {
      let severity: 'info' | 'warning' | 'urgent' = 'info';
      let message = '';
      let actionUrl = `/payroll/runs/${payrollRunId}`;
      let actionLabel = 'Voir la paie';

      if (status === 'calculated') {
        severity = 'warning';
        message = `Paie de ${summary.periodLabel} calculée - ${employeesCount} employés - Total: ${summary.totalNetSalariesFormatted}`;
        actionLabel = 'Vérifier et approuver';
      } else if (status === 'approved') {
        severity = 'warning';
        message = `Paie de ${summary.periodLabel} approuvée - Prête pour le paiement`;
        actionLabel = 'Procéder au paiement';
      } else if (status === 'paid') {
        severity = 'info';
        message = `Paie de ${summary.periodLabel} payée avec succès - ${employeesCount} employés`;
        actionLabel = 'Voir le récapitulatif';
      }

      return { severity, message, actionUrl, actionLabel };
    });

    // Step 3: Find HR manager to notify
    const hrManager = await step.run('find-hr-manager', async () => {
      // Use the person who completed the payroll as the assignee
      return completedBy;
    });

    // Step 4: Create summary alert for HR manager
    const alert = await step.run('create-alert', async () => {
      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'payroll_run_completed',
          severity: alertConfig.severity,
          message: alertConfig.message,
          assigneeId: hrManager,
          actionUrl: alertConfig.actionUrl,
          actionLabel: alertConfig.actionLabel,
          dueDate: status === 'calculated' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, // 7 days to approve
          status: 'active',
          metadata: {
            payrollRunId,
            period: `${period.month}/${period.year}`,
            employeesCount,
            totalNetSalaries,
            totalDeductions,
            totalEmployerCosts,
            payrollStatus: status,
            completedAt: completedAt.toISOString(),
          },
        })
        .returning();

      console.log('[Payroll Run Completed] Alert created:', newAlert.id);
      return newAlert;
    });

    // Step 5: Generate payroll reports (placeholder for future implementation)
    const reportsGenerated = await step.run('generate-reports', async () => {
      console.log('[Payroll Run Completed] Report generation:', {
        payrollRunId,
        period: summary.periodLabel,
      });

      // TODO: Implement report generation
      // - Generate PDF pay slips for each employee
      // - Generate summary report for HR
      // - Generate tax declaration files
      // - Generate CNPS declaration files

      return {
        generated: false,
        reason: 'Report generation not yet implemented',
        plannedReports: [
          'Bulletins de paie (PDF)',
          'Rapport récapitulatif RH',
          'Déclaration fiscale ITS',
          'Déclaration CNPS',
        ],
      };
    });

    // Step 6: Update employee payment history (placeholder)
    const paymentHistoryUpdated = await step.run('update-payment-history', async () => {
      console.log('[Payroll Run Completed] Payment history update:', {
        payrollRunId,
        employeesCount,
      });

      // TODO: Implement payment history tracking
      // - Create payment records for each employee
      // - Update year-to-date totals
      // - Track for tax purposes

      return {
        updated: false,
        reason: 'Payment history tracking not yet implemented',
      };
    });

    // Step 7: Send email notifications
    if (status === 'calculated' || status === 'approved') {
      await step.run('send-email-notification', async () => {
        // Get HR manager email
        const userResults = await db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, hrManager))
          .limit(1);

        if (userResults[0]?.email) {
          console.log('[Payroll Run Completed] Would send email to:', {
            email: userResults[0].email,
            subject: status === 'calculated'
              ? `Paie ${summary.periodLabel} calculée - Action requise`
              : `Paie ${summary.periodLabel} approuvée - Prête pour le paiement`,
          });

          // Emit event for email notification
          await inngest.send({
            name: 'alert.created',
            data: {
              alertId: alert.id,
              tenantId,
              type: 'payroll_run_completed',
              severity: alertConfig.severity,
              assigneeId: hrManager,
              message: alertConfig.message,
              createdAt: new Date(),
            },
          });

          return { emailSent: true };
        }

        return { emailSent: false, reason: 'HR manager email not found' };
      });
    }

    return {
      success: true,
      payrollRunId,
      period: summary.periodLabel,
      employeesCount,
      status,
      summary: {
        totalNetSalaries: summary.totalNetSalariesFormatted,
        totalDeductions: summary.totalDeductionsFormatted,
        totalEmployerCosts: summary.totalEmployerCostsFormatted,
        totalCost: summary.totalCostFormatted,
      },
      alertCreated: alert.id,
      reportsGenerated: reportsGenerated.generated,
      paymentHistoryUpdated: paymentHistoryUpdated.updated,
    };
  }
);
