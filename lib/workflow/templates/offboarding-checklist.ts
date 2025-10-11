/**
 * Offboarding Checklist Workflow Template
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 4
 *
 * Auto-created when employee is terminated.
 * Creates a checklist of offboarding tasks for smooth employee exit.
 */

import type { WorkflowTemplate } from './onboarding-checklist';

export const offboardingChecklistTemplate: WorkflowTemplate = {
  name: 'Sortie d\'employé',
  description: 'Checklist complète des tâches d\'offboarding pour un départ d\'employé',
  category: 'offboarding',
  triggerType: 'employee.terminated',
  icon: 'user-minus',
  estimatedDuration: '14 jours',
  targetAudience: ['RH', 'IT', 'Facilities', 'Finance'],

  // Conditions: Trigger for all terminations
  conditions: [],

  // Actions: Create offboarding alerts for different teams
  actions: [
    {
      type: 'create_alert',
      config: {
        title: 'Organiser l\'entretien de sortie',
        description: 'Planifier et conduire l\'entretien de sortie avec l\'employé',
        severity: 'warning',
        assigneeRole: 'hr_manager',
        dueInDays: 1,
        actionUrl: '/employees/{employeeId}/exit-interview',
        actionLabel: 'Planifier',
        metadata: {
          priority: 'high',
          category: 'offboarding',
          step: 1,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Récupérer l\'équipement',
        description: 'Récupérer ordinateur, téléphone, badge et autres équipements',
        severity: 'urgent',
        assigneeRole: 'it_admin',
        dueInDays: 1,
        actionUrl: '/equipment/return/{employeeId}',
        actionLabel: 'Enregistrer',
        metadata: {
          priority: 'high',
          category: 'offboarding',
          step: 2,
          team: 'IT',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Révoquer les accès systèmes',
        description: 'Désactiver email, VPN, applications et tous les accès IT',
        severity: 'urgent',
        assigneeRole: 'it_admin',
        dueInDays: 1,
        actionUrl: '/it/access-revocation/{employeeId}',
        actionLabel: 'Révoquer',
        metadata: {
          priority: 'critical',
          category: 'offboarding',
          step: 3,
          team: 'IT',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Calculer la paie de sortie',
        description: 'Calculer les indemnités de départ et la paie finale proratisée',
        severity: 'urgent',
        assigneeRole: 'hr_manager',
        dueInDays: 3,
        actionUrl: '/payroll/final-pay/{employeeId}',
        actionLabel: 'Calculer',
        metadata: {
          priority: 'critical',
          category: 'offboarding',
          step: 4,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Générer les documents de sortie',
        description: 'Certificat de travail, attestation CNPS, reçu pour solde de tout compte',
        severity: 'warning',
        assigneeRole: 'hr_manager',
        dueInDays: 5,
        actionUrl: '/employees/{employeeId}/exit-documents',
        actionLabel: 'Générer',
        metadata: {
          priority: 'high',
          category: 'offboarding',
          step: 5,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Effectuer le paiement final',
        description: 'Virer le solde final incluant les indemnités',
        severity: 'urgent',
        assigneeRole: 'finance_manager',
        dueInDays: 7,
        actionUrl: '/finance/final-payment/{employeeId}',
        actionLabel: 'Payer',
        metadata: {
          priority: 'critical',
          category: 'offboarding',
          step: 6,
          team: 'Finance',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Mettre à jour la CNPS',
        description: 'Notifier la CNPS de la fin de contrat',
        severity: 'warning',
        assigneeRole: 'hr_manager',
        dueInDays: 10,
        actionUrl: '/employees/{employeeId}/cnps-update',
        actionLabel: 'Notifier',
        metadata: {
          priority: 'medium',
          category: 'offboarding',
          step: 7,
          team: 'RH',
        },
      },
    },
    {
      type: 'create_alert',
      config: {
        title: 'Archiver le dossier employé',
        description: 'Archiver tous les documents conformément aux obligations légales (RGPD)',
        severity: 'info',
        assigneeRole: 'hr_manager',
        dueInDays: 14,
        actionUrl: '/employees/{employeeId}/archive',
        actionLabel: 'Archiver',
        metadata: {
          priority: 'low',
          category: 'offboarding',
          step: 8,
          team: 'RH',
        },
      },
    },
    {
      type: 'send_notification',
      config: {
        recipient: '{manager.email}',
        subject: 'Départ d\'employé: {employee.fullName}',
        template: 'offboarding_started',
        body: 'Un employé quitte l\'entreprise. Les tâches de sortie ont été créées.',
      },
    },
  ],
};

/**
 * Helper function to instantiate the template with actual employee data
 */
export function instantiateOffboardingWorkflow(employeeData: {
  employeeId: string;
  employeeName: string;
  terminationDate: Date;
  terminationType: 'resignation' | 'dismissal' | 'retirement' | 'end_of_contract';
}) {
  // Replace placeholders in actions with actual employee data
  const actions = offboardingChecklistTemplate.actions.map((action) => {
    const config = { ...action.config };

    // Replace {employeeId} placeholder
    if (config.actionUrl) {
      config.actionUrl = config.actionUrl.replace('{employeeId}', employeeData.employeeId);
    }

    // Set employeeId for alerts
    if (action.type === 'create_alert') {
      config.employeeId = employeeData.employeeId;
      config.metadata = {
        ...config.metadata,
        terminationType: employeeData.terminationType,
        terminationDate: employeeData.terminationDate.toISOString(),
      };
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
    ...offboardingChecklistTemplate,
    actions,
  };
}
