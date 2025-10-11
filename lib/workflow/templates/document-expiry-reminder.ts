/**
 * Document Expiry Reminder Workflow Template
 *
 * Automated workflow for document expiry notifications
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const documentExpiryReminderTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Rappels d\'expiration de documents',
  description: 'Notifications automatiques pour les documents expirants (CNI, permis, etc.)',
  triggerType: 'event',
  triggerConfig: {
    eventName: 'document.expiring',
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
        message: ':documentType de :employeeName expire dans :daysUntilExpiry jours',
        severity: 'info',
        assignTo: 'hr_manager',
        actionUrl: '/employees/:employeeId/documents',
        actionLabel: 'Mettre à jour',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'document_expiry_reminder',
        recipients: ['employee', 'hr_manager'],
        subject: 'Rappel: :documentType expire bientôt',
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
          field: 'documentStatus',
          operator: 'eq',
          value: 'expired',
        },
        trueBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'URGENT: :documentType de :employeeName expire dans 15 jours',
              severity: 'warning',
              assignTo: 'hr_manager',
              actionUrl: '/employees/:employeeId/documents',
              actionLabel: 'Action requise',
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
                field: 'documentStatus',
                operator: 'eq',
                value: 'expired',
              },
              trueBranch: [
                {
                  type: 'create_alert',
                  config: {
                    message: 'CRITIQUE: :documentType de :employeeName expire dans 7 jours - Suspendre employé',
                    severity: 'urgent',
                    assignTo: 'hr_director',
                    actionUrl: '/employees/:employeeId',
                  },
                },
                {
                  type: 'wait_delay',
                  config: {
                    duration: 7 * 24 * 60 * 60 * 1000, // 7 days
                  },
                },
                {
                  type: 'conditional',
                  config: {
                    condition: {
                      field: 'documentStatus',
                      operator: 'eq',
                      value: 'expired',
                    },
                    trueBranch: [
                      {
                        type: 'update_employee_record',
                        config: {
                          field: 'status',
                          value: 'suspended',
                          reason: 'Document expiré - :documentType',
                        },
                      },
                      {
                        type: 'send_notification',
                        config: {
                          channel: 'email',
                          template: 'employee_suspended',
                          recipients: ['employee', 'hr_director'],
                          subject: 'Suspension pour document expiré',
                        },
                      },
                    ],
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
  templateCategory: 'compliance',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
