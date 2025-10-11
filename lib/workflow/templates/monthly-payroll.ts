/**
 * Monthly Payroll Run Workflow Template
 *
 * Automated workflow for monthly payroll processing
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const monthlyPayrollTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Exécution paie mensuelle',
  description: 'Processus automatisé pour la paie mensuelle avec vérifications et notifications',
  triggerType: 'scheduled',
  triggerConfig: {
    cron: '0 9 1 * *', // 1st of month at 9 AM
    timezone: 'Africa/Abidjan',
  },

  conditions: [
    {
      field: 'employeeCount',
      operator: 'gt',
      value: 0,
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Rappel: Calculer la paie du mois',
        severity: 'warning',
        assignTo: 'hr_manager',
        actionUrl: '/payroll/new',
        actionLabel: 'Créer la paie',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'payroll_reminder',
        recipients: ['hr_manager'],
        subject: 'Rappel: Paie mensuelle à traiter',
      },
    },
    {
      type: 'wait_delay',
      config: {
        duration: 3 * 24 * 60 * 60 * 1000, // 3 days
      },
    },
    {
      type: 'conditional',
      config: {
        condition: {
          field: 'payrollStatus',
          operator: 'eq',
          value: 'not_started',
        },
        trueBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'URGENT: La paie du mois n\'est pas encore créée',
              severity: 'urgent',
              assignTo: 'hr_manager',
              actionUrl: '/payroll/new',
            },
          },
        ],
        falseBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'Paie du mois créée avec succès',
              severity: 'info',
              assignTo: 'hr_manager',
            },
          },
        ],
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'payroll',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
