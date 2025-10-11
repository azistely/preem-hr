/**
 * Onboarding Checklist Workflow Template
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 4
 *
 * Auto-created when employee is hired.
 * Creates a checklist of onboarding tasks for HR, IT, and Facilities teams.
 */

import type { WorkflowAction, WorkflowCondition } from '../workflow-engine';

export interface WorkflowTemplate {
  name: string;
  description: string;
  category: 'onboarding' | 'offboarding' | 'payroll' | 'hr' | 'custom';
  triggerType: string;
  icon: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  estimatedDuration?: string;
  targetAudience?: string[];
}

export const onboardingChecklistTemplate: WorkflowTemplate = {
  name: 'Intégration nouvel employé',
  description: 'Checklist complète des tâches d\'onboarding pour un nouvel employé',
  category: 'onboarding',
  triggerType: 'employee.hired',
  icon: 'user-plus',
  estimatedDuration: '7 jours',
  targetAudience: ['RH', 'IT', 'Facilities'],

  // Conditions: Trigger for all new hires
  conditions: [],

  // Actions: Create onboarding alerts for different teams
  actions: [
    {
      type: 'create_alert',
      config: {
        title: 'Créer le contrat de travail',
        description: 'Préparer et faire signer le contrat de travail pour le nouvel employé',
        severity: 'urgent',
        assigneeRole: 'hr_manager',
        dueInDays: 1,
        actionUrl: '/employees/{employeeId}/contracts/new',
        actionLabel: 'Créer le contrat',
        metadata: {
          priority: 'high',
          category: 'onboarding',
          step: 1,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Configurer l\'email professionnel',
        description: 'Créer l\'adresse email et configurer les accès aux outils',
        severity: 'urgent',
        assigneeRole: 'it_admin',
        dueInDays: 2,
        actionUrl: '/employees/{employeeId}',
        actionLabel: 'Configurer',
        metadata: {
          priority: 'high',
          category: 'onboarding',
          step: 2,
          team: 'IT',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Commander l\'équipement',
        description: 'Commander ordinateur, téléphone et autres équipements nécessaires',
        severity: 'warning',
        assigneeRole: 'it_admin',
        dueInDays: 3,
        actionUrl: '/equipment/order',
        actionLabel: 'Commander',
        metadata: {
          priority: 'medium',
          category: 'onboarding',
          step: 3,
          team: 'IT',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Préparer le poste de travail',
        description: 'Préparer le bureau et l\'espace de travail pour l\'arrivée',
        severity: 'info',
        assigneeRole: 'facilities_manager',
        dueInDays: 3,
        actionUrl: '/facilities/workspace',
        actionLabel: 'Préparer',
        metadata: {
          priority: 'medium',
          category: 'onboarding',
          step: 4,
          team: 'Facilities',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Planifier l\'orientation',
        description: 'Organiser la session d\'orientation et la présentation à l\'équipe',
        severity: 'warning',
        assigneeRole: 'hr_manager',
        dueInDays: 5,
        actionUrl: '/employees/{employeeId}',
        actionLabel: 'Planifier',
        metadata: {
          priority: 'medium',
          category: 'onboarding',
          step: 5,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Enregistrement CNPS',
        description: 'Enregistrer l\'employé auprès de la CNPS et obtenir le numéro',
        severity: 'warning',
        assigneeRole: 'hr_manager',
        dueInDays: 7,
        actionUrl: '/employees/{employeeId}/social-security',
        actionLabel: 'Enregistrer',
        metadata: {
          priority: 'high',
          category: 'onboarding',
          step: 6,
          team: 'RH',
        },
      },
    },
    {
      type: 'send_notification',
      config: {
        recipient: '{manager.email}',
        subject: 'Nouvel employé: {employee.fullName}',
        template: 'onboarding_started',
        body: 'Un nouvel employé rejoint votre équipe. Les tâches d\'intégration ont été créées.',
      },
    },
  ],
};

/**
 * Helper function to instantiate the template with actual employee data
 */
export function instantiateOnboardingWorkflow(employeeData: {
  employeeId: string;
  employeeName: string;
  managerId?: string;
  departmentId?: string;
}) {
  // Replace placeholders in actions with actual employee data
  const actions = onboardingChecklistTemplate.actions.map((action) => {
    const config = { ...action.config };

    // Replace {employeeId} placeholder
    if (config.actionUrl) {
      config.actionUrl = config.actionUrl.replace('{employeeId}', employeeData.employeeId);
    }

    // Set employeeId for alerts
    if (action.type === 'create_alert') {
      config.employeeId = employeeData.employeeId;
    }

    // Replace placeholders in notification
    if (action.type === 'send_notification') {
      config.body = config.body?.replace('{employee.fullName}', employeeData.employeeName);
    }

    return {
      ...action,
      config,
    };
  });

  return {
    ...onboardingChecklistTemplate,
    actions,
  };
}
