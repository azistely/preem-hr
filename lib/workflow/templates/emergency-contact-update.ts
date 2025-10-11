/**
 * Emergency Contact Update Reminder Workflow Template
 *
 * Automated workflow to remind employees to update emergency contacts
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const emergencyContactUpdateTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Mise à jour contacts d\'urgence',
  description: 'Rappels automatiques pour vérifier et mettre à jour les contacts d\'urgence',
  triggerType: 'scheduled',
  triggerConfig: {
    cron: '0 9 1 */6 *', // Every 6 months, 1st day at 9 AM
    timezone: 'Africa/Abidjan',
  },

  conditions: [
    {
      field: 'employeeStatus',
      operator: 'eq',
      value: 'active',
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Vérifiez vos contacts d\'urgence (mise à jour semestrielle)',
        severity: 'info',
        assignTo: 'employee',
        actionUrl: '/profile/emergency-contacts',
        actionLabel: 'Mettre à jour',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'emergency_contact_reminder',
        recipients: ['employee'],
        subject: 'Rappel: Vérification contacts d\'urgence',
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
          field: 'emergencyContactsUpdated',
          operator: 'eq',
          value: false,
        },
        trueBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'RAPPEL: Contacts d\'urgence non vérifiés',
              severity: 'warning',
              assignTo: 'employee',
              actionUrl: '/profile/emergency-contacts',
              actionLabel: 'Mettre à jour maintenant',
            },
          },
          {
            type: 'send_notification',
            config: {
              channel: 'sms',
              template: 'emergency_contact_urgent',
              recipients: ['employee'],
              message: 'Rappel urgent: Mettez à jour vos contacts d\'urgence sur :appUrl',
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
                field: 'emergencyContactsUpdated',
                operator: 'eq',
                value: false,
              },
              trueBranch: [
                {
                  type: 'create_alert',
                  config: {
                    message: ':employeeName n\'a pas mis à jour ses contacts d\'urgence (14 jours)',
                    severity: 'warning',
                    assignTo: 'hr_manager',
                    actionUrl: '/employees/:employeeId',
                    actionLabel: 'Contacter l\'employé',
                  },
                },
              ],
              falseBranch: [
                {
                  type: 'send_notification',
                  config: {
                    channel: 'email',
                    template: 'emergency_contact_confirmed',
                    recipients: ['employee'],
                    subject: 'Contacts d\'urgence mis à jour avec succès',
                  },
                },
              ],
            },
          },
        ],
        falseBranch: [
          {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'emergency_contact_confirmed',
              recipients: ['employee'],
              subject: 'Merci d\'avoir vérifié vos contacts d\'urgence',
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
