/**
 * Contract Renewal Workflow Template
 *
 * Automated workflow for contract renewal process
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const contractRenewalTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Renouvellement de contrat',
  description: 'Processus automatisé de renouvellement de contrat avec rappels et escalade',
  triggerType: 'event',
  triggerConfig: {
    eventName: 'contract.expiring',
  },

  conditions: [
    {
      field: 'daysUntilExpiry',
      operator: 'lte',
      value: 30,
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Contrat expire dans 30 jours - Préparer le renouvellement',
        severity: 'info',
        assignTo: 'hr_manager',
        actionUrl: '/employees/:employeeId/contract/renew',
        actionLabel: 'Renouveler le contrat',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'contract_renewal_reminder',
        recipients: ['hr_manager'],
        subject: 'Rappel: Contrat de :employeeName expire le :expiryDate',
      },
    },
    {
      type: 'wait_delay',
      config: {
        duration: 15 * 24 * 60 * 60 * 1000, // 15 days
      },
    },
    {
      type: 'conditional',
      config: {
        condition: {
          field: 'contractStatus',
          operator: 'eq',
          value: 'not_renewed',
        },
        trueBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'URGENT: Contrat expire dans 15 jours - Action requise',
              severity: 'warning',
              assignTo: 'hr_manager',
              actionUrl: '/employees/:employeeId/contract/renew',
              actionLabel: 'Renouveler maintenant',
            },
          },
          {
            type: 'wait_delay',
            config: {
              duration: 8 * 24 * 60 * 60 * 1000, // 8 days
            },
          },
          {
            type: 'conditional',
            config: {
              condition: {
                field: 'contractStatus',
                operator: 'eq',
                value: 'not_renewed',
              },
              trueBranch: [
                {
                  type: 'create_alert',
                  config: {
                    message: 'CRITIQUE: Contrat expire dans 7 jours - Escalade nécessaire',
                    severity: 'urgent',
                    assignTo: 'hr_director',
                    actionUrl: '/employees/:employeeId/contract/renew',
                    actionLabel: 'Renouveler immédiatement',
                  },
                },
                {
                  type: 'send_notification',
                  config: {
                    channel: 'sms',
                    template: 'contract_critical',
                    recipients: ['hr_director'],
                    message: 'URGENT: Contrat de :employeeName expire dans 7 jours',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'contracts',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
