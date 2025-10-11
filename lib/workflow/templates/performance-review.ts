/**
 * Quarterly Performance Review Workflow Template
 *
 * Automated workflow for quarterly performance reviews
 */

import type { WorkflowDefinition} from '@/lib/db/schema/workflows';

export const performanceReviewTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Évaluation trimestrielle de performance',
  description: 'Processus d\'évaluation de performance avec auto-évaluation et feedback manager',
  triggerType: 'scheduled',
  triggerConfig: {
    cron: '0 9 1 */3 *', // 1st of every 3rd month at 9 AM (quarterly)
    timezone: 'Africa/Abidjan',
  },

  conditions: [
    {
      field: 'employeeStatus',
      operator: 'eq',
      value: 'active',
    },
    {
      field: 'monthsSinceHire',
      operator: 'gte',
      value: 3,
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Évaluation trimestrielle: Auto-évaluation à compléter',
        severity: 'info',
        assignTo: 'employee',
        actionUrl: '/performance/self-review',
        actionLabel: 'Commencer l\'auto-évaluation',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'self_review_reminder',
        recipients: ['employee'],
        subject: 'Rappel: Auto-évaluation trimestrielle',
      },
    },
    {
      type: 'wait_for_completion',
      config: {
        timeout: 7 * 24 * 60 * 60 * 1000, // 7 days
        completionField: 'selfReviewStatus',
      },
    },
    {
      type: 'conditional',
      config: {
        condition: {
          field: 'selfReviewStatus',
          operator: 'eq',
          value: 'completed',
        },
        trueBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'Évaluation de :employeeName à compléter',
              severity: 'info',
              assignTo: 'employee_manager',
              actionUrl: '/performance/manager-review/:employeeId',
              actionLabel: 'Évaluer',
            },
          },
          {
            type: 'wait_for_completion',
            config: {
              timeout: 5 * 24 * 60 * 60 * 1000, // 5 days
              completionField: 'managerReviewStatus',
            },
          },
          {
            type: 'create_alert',
            config: {
              message: 'Entretien d\'évaluation programmé avec votre manager',
              severity: 'info',
              assignTo: 'employee',
              actionUrl: '/performance/meeting/:reviewId',
              actionLabel: 'Voir les détails',
            },
          },
        ],
        falseBranch: [
          {
            type: 'create_alert',
            config: {
              message: 'RAPPEL: Auto-évaluation non complétée',
              severity: 'warning',
              assignTo: 'employee',
              actionUrl: '/performance/self-review',
            },
          },
          {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'self_review_overdue',
              recipients: ['employee', 'employee_manager'],
              subject: 'Rappel urgent: Auto-évaluation en retard',
            },
          },
        ],
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'performance',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
