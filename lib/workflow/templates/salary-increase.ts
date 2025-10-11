/**
 * Salary Increase Approval Workflow Template
 *
 * Automated workflow for salary increase approval process
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const salaryIncreaseTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Approbation d\'augmentation de salaire',
  description: 'Processus d\'approbation multi-niveaux pour les augmentations de salaire',
  triggerType: 'manual',
  triggerConfig: {},

  conditions: [
    {
      field: 'increasePercentage',
      operator: 'gt',
      value: 0,
    },
    {
      field: 'increasePercentage',
      operator: 'lte',
      value: 100,
    },
  ],

  actions: [
    {
      type: 'create_alert',
      config: {
        message: 'Demande d\'augmentation de salaire pour :employeeName (:increasePercentage%)',
        severity: 'info',
        assignTo: 'employee_manager',
        actionUrl: '/employees/:employeeId/salary/review',
        actionLabel: 'Examiner la demande',
      },
    },
    {
      type: 'wait_for_approval',
      config: {
        timeout: 3 * 24 * 60 * 60 * 1000, // 3 days
        approvalField: 'managerApproval',
      },
    },
    {
      type: 'conditional',
      config: {
        condition: {
          field: 'managerApproval',
          operator: 'eq',
          value: 'approved',
        },
        trueBranch: [
          {
            type: 'conditional',
            config: {
              condition: {
                field: 'increasePercentage',
                operator: 'gt',
                value: 10,
              },
              trueBranch: [
                {
                  type: 'create_alert',
                  config: {
                    message: 'Augmentation >10% pour :employeeName - Approbation RH requise',
                    severity: 'warning',
                    assignTo: 'hr_director',
                    actionUrl: '/employees/:employeeId/salary/review',
                    actionLabel: 'Approuver/Refuser',
                  },
                },
                {
                  type: 'wait_for_approval',
                  config: {
                    timeout: 2 * 24 * 60 * 60 * 1000, // 2 days
                    approvalField: 'hrApproval',
                  },
                },
              ],
              falseBranch: [
                {
                  type: 'update_employee_record',
                  config: {
                    field: 'baseSalary',
                    operation: 'increase_by_percentage',
                    value: ':increasePercentage',
                    effectiveDate: ':effectiveDate',
                  },
                },
                {
                  type: 'send_notification',
                  config: {
                    channel: 'email',
                    template: 'salary_increase_approved',
                    recipients: ['employee', 'employee_manager'],
                    subject: 'Augmentation de salaire approuvée',
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
              template: 'salary_increase_rejected',
              recipients: ['employee_manager'],
              subject: 'Demande d\'augmentation refusée',
            },
          },
        ],
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'compensation',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
