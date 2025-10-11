/**
 * New Hire Welcome Journey Workflow Template
 *
 * Automated welcome workflow for new employees
 */

import type { WorkflowDefinition } from '@/lib/db/schema/workflows';

export const newHireWelcomeTemplate: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Parcours d\'accueil nouvel employé',
  description: 'Séquence automatique de bienvenue et d\'intégration pour nouveaux employés',
  triggerType: 'event',
  triggerConfig: {
    eventName: 'employee.hired',
  },

  conditions: [],

  actions: [
    // Day 1: Welcome
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'welcome_day1',
        recipients: ['employee'],
        subject: 'Bienvenue chez :companyName !',
      },
    },
    {
      type: 'create_alert',
      config: {
        message: 'Nouvel employé: :employeeName - Préparer l\'accueil',
        severity: 'info',
        assignTo: 'hr_manager',
        actionUrl: '/employees/:employeeId/onboarding',
        actionLabel: 'Voir le plan d\'intégration',
      },
    },

    // Day 2: System access
    {
      type: 'wait_delay',
      config: {
        duration: 1 * 24 * 60 * 60 * 1000, // 1 day
      },
    },
    {
      type: 'create_alert',
      config: {
        message: 'Créer les accès système pour :employeeName',
        severity: 'info',
        assignTo: 'it_manager',
        actionUrl: '/it/setup/:employeeId',
        actionLabel: 'Configurer les accès',
      },
    },

    // Week 1: Check-in
    {
      type: 'wait_delay',
      config: {
        duration: 5 * 24 * 60 * 60 * 1000, // 5 days
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'week1_checkin',
        recipients: ['employee', 'employee_manager'],
        subject: 'Check-in première semaine',
      },
    },
    {
      type: 'create_alert',
      config: {
        message: 'Point hebdo avec :employeeName (1ère semaine)',
        severity: 'info',
        assignTo: 'employee_manager',
        actionUrl: '/onboarding/checkin/:employeeId',
        actionLabel: 'Planifier',
      },
    },

    // Month 1: Feedback
    {
      type: 'wait_delay',
      config: {
        duration: 23 * 24 * 60 * 60 * 1000, // 23 days (total 1 month)
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'month1_survey',
        recipients: ['employee'],
        subject: 'Comment se passe votre premier mois ?',
      },
    },
    {
      type: 'create_alert',
      config: {
        message: 'Bilan 1 mois pour :employeeName',
        severity: 'info',
        assignTo: 'hr_manager',
        actionUrl: '/onboarding/review/:employeeId',
        actionLabel: 'Voir le bilan',
      },
    },

    // Month 3: Probation review
    {
      type: 'wait_delay',
      config: {
        duration: 60 * 24 * 60 * 60 * 1000, // 60 days (total 3 months)
      },
    },
    {
      type: 'create_alert',
      config: {
        message: 'Fin période d\'essai: :employeeName - Décision à prendre',
        severity: 'warning',
        assignTo: 'hr_director',
        actionUrl: '/employees/:employeeId/probation',
        actionLabel: 'Confirmer/Prolonger/Terminer',
      },
    },
    {
      type: 'send_notification',
      config: {
        channel: 'email',
        template: 'probation_review',
        recipients: ['employee_manager', 'hr_director'],
        subject: 'Évaluation de période d\'essai: :employeeName',
      },
    },
  ],

  status: 'draft',
  isTemplate: true,
  templateCategory: 'onboarding',
  version: 1,
  lastExecutedAt: null,
  executionCount: 0,
  successCount: 0,
  errorCount: 0,
};
