/**
 * Leave Request Approval Workflow Template
 *
 * Automated workflow for leave request approval process
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const leaveApprovalTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Approbation de congé',
  description: 'Processus d\'approbation automatisé pour les demandes de congé',
  triggerType: 'event',
  triggerConfig: {
    eventName: 'leave.request.created',
  },

  conditions: [
    {
      field: 'leaveBalance',
      operator: 'gte',
      value: 0,
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Nouvelle demande de congé à approuver',
        severity: 'info',
        assignTo: 'employee_manager',
        actionUrl: '/time-off/requests/:requestId',
        actionLabel: 'Approuver/Refuser',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'leave_request_pending',
        recipients: ['employee_manager'],
        subject: 'Nouvelle demande de congé de :employeeName',
      },
    },
    {
      type: 'wait_for_approval',
      config: {
        timeout: 2 * 24 * 60 * 60 * 1000, // 2 days
        approvalField: 'leaveRequestStatus',
      },
    },
    {
      type: 'conditional',
      config: {
        condition: {
          field: 'leaveRequestStatus',
          operator: 'eq',
          value: 'approved',
        },
        trueBranch: [
          {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'leave_approved',
              recipients: ['employee'],
              subject: 'Votre demande de congé a été approuvée',
            },
          },
          {
            type: 'update_employee_record',
            config: {
              field: 'leaveBalance',
              operation: 'subtract',
              value: ':leaveDays',
            },
          },
        ],
        falseBranch: [
          {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'leave_rejected',
              recipients: ['employee'],
              subject: 'Votre demande de congé a été refusée',
            },
          },
        ],
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'time_off',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
