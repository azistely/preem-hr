/**
 * Smart Defaults Type Definitions
 * Types for company-size-aware configuration and auto-configuration
 */

import type { RatingScaleConfig } from '@/lib/db/schema/hr-forms';

// ============================================================================
// COMPANY SIZE PROFILES
// ============================================================================

/**
 * Company size category based on employee count
 */
export type CompanySizeCategory = 'solo' | 'small' | 'medium' | 'large' | 'enterprise';

/**
 * Company size thresholds
 */
export const CompanySizeThresholds = {
  solo: { min: 1, max: 1 },
  small: { min: 2, max: 50 },
  medium: { min: 51, max: 200 },
  large: { min: 201, max: 1000 },
  enterprise: { min: 1001, max: Infinity },
} as const;

/**
 * Company size labels (French)
 */
export const CompanySizeLabels: Record<CompanySizeCategory, string> = {
  solo: 'Solo',
  small: 'Petite entreprise (2-50)',
  medium: 'Moyenne entreprise (51-200)',
  large: 'Grande entreprise (201-1000)',
  enterprise: 'Très grande entreprise (1000+)',
};

// ============================================================================
// PERFORMANCE MODULE DEFAULTS
// ============================================================================

/**
 * Performance module configuration based on company size
 */
export interface PerformanceModuleConfig {
  // Review cycle
  defaultCycleType: 'none' | 'annual' | 'semi_annual' | 'quarterly';
  cycleDurationMonths: number;

  // Workflow complexity
  approvalLevels: number; // 0, 1, 2, or 3
  wizardSteps: number;    // 3, 5, or 7

  // Features enabled
  includeObjectives: boolean;
  includeSelfEvaluation: boolean;
  includeManagerEvaluation: boolean;
  includePeerFeedback: boolean;
  include360Feedback: boolean;
  includeCalibration: boolean;
  includeContinuousFeedback: boolean;
  includeOneOnOnes: boolean;

  // Evaluation template
  defaultRatingScale: RatingScaleConfig;
  objectiveWeighting: boolean;
  competencyAssessment: boolean;

  // Deadlines (days)
  defaultObjectiveSettingDays: number;
  defaultSelfEvaluationDays: number;
  defaultManagerEvaluationDays: number;
  defaultCalibrationDays: number;
}

/**
 * Performance defaults by company size
 */
export const PerformanceDefaultsBySize: Record<CompanySizeCategory, PerformanceModuleConfig> = {
  solo: {
    defaultCycleType: 'none',
    cycleDurationMonths: 12,
    approvalLevels: 0,
    wizardSteps: 0,
    includeObjectives: false,
    includeSelfEvaluation: false,
    includeManagerEvaluation: false,
    includePeerFeedback: false,
    include360Feedback: false,
    includeCalibration: false,
    includeContinuousFeedback: false,
    includeOneOnOnes: false,
    defaultRatingScale: {
      type: 'stars',
      scale: 5,
    },
    objectiveWeighting: false,
    competencyAssessment: false,
    defaultObjectiveSettingDays: 0,
    defaultSelfEvaluationDays: 0,
    defaultManagerEvaluationDays: 0,
    defaultCalibrationDays: 0,
  },
  small: {
    defaultCycleType: 'annual',
    cycleDurationMonths: 12,
    approvalLevels: 1,
    wizardSteps: 3,
    includeObjectives: false,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: false,
    include360Feedback: false,
    includeCalibration: false,
    includeContinuousFeedback: true,
    includeOneOnOnes: true,
    defaultRatingScale: {
      type: 'stars',
      scale: 5,
      labels: {
        1: '1 étoile',
        2: '2 étoiles',
        3: '3 étoiles',
        4: '4 étoiles',
        5: '5 étoiles',
      },
    },
    objectiveWeighting: false,
    competencyAssessment: false,
    defaultObjectiveSettingDays: 14,
    defaultSelfEvaluationDays: 7,
    defaultManagerEvaluationDays: 7,
    defaultCalibrationDays: 0,
  },
  medium: {
    defaultCycleType: 'semi_annual',
    cycleDurationMonths: 6,
    approvalLevels: 2,
    wizardSteps: 5,
    includeObjectives: true,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: true,
    include360Feedback: false,
    includeCalibration: false,
    includeContinuousFeedback: true,
    includeOneOnOnes: true,
    defaultRatingScale: {
      type: 'numeric',
      scale: 5,
      labels: {
        1: 'Insuffisant',
        2: 'A améliorer',
        3: 'Satisfaisant',
        4: 'Très bien',
        5: 'Excellent',
      },
    },
    objectiveWeighting: true,
    competencyAssessment: true,
    defaultObjectiveSettingDays: 21,
    defaultSelfEvaluationDays: 14,
    defaultManagerEvaluationDays: 14,
    defaultCalibrationDays: 0,
  },
  large: {
    defaultCycleType: 'quarterly',
    cycleDurationMonths: 3,
    approvalLevels: 3,
    wizardSteps: 7,
    includeObjectives: true,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: true,
    include360Feedback: true,
    includeCalibration: true,
    includeContinuousFeedback: true,
    includeOneOnOnes: true,
    defaultRatingScale: {
      type: 'numeric',
      scale: 5,
      labels: {
        1: 'Nécessite amélioration significative',
        2: 'Nécessite amélioration',
        3: 'Répond aux attentes',
        4: 'Dépasse les attentes',
        5: 'Performance exceptionnelle',
      },
    },
    objectiveWeighting: true,
    competencyAssessment: true,
    defaultObjectiveSettingDays: 30,
    defaultSelfEvaluationDays: 14,
    defaultManagerEvaluationDays: 21,
    defaultCalibrationDays: 14,
  },
  enterprise: {
    defaultCycleType: 'quarterly',
    cycleDurationMonths: 3,
    approvalLevels: 3,
    wizardSteps: 7,
    includeObjectives: true,
    includeSelfEvaluation: true,
    includeManagerEvaluation: true,
    includePeerFeedback: true,
    include360Feedback: true,
    includeCalibration: true,
    includeContinuousFeedback: true,
    includeOneOnOnes: true,
    defaultRatingScale: {
      type: 'numeric',
      scale: 5,
      labels: {
        1: 'Nécessite amélioration significative',
        2: 'Nécessite amélioration',
        3: 'Répond aux attentes',
        4: 'Dépasse les attentes',
        5: 'Performance exceptionnelle',
      },
    },
    objectiveWeighting: true,
    competencyAssessment: true,
    defaultObjectiveSettingDays: 30,
    defaultSelfEvaluationDays: 21,
    defaultManagerEvaluationDays: 21,
    defaultCalibrationDays: 21,
  },
};

// ============================================================================
// TRAINING MODULE DEFAULTS
// ============================================================================

/**
 * Training module configuration based on company size
 */
export interface TrainingModuleConfig {
  // Training plan
  enableTrainingPlans: boolean;
  defaultBudgetCurrency: string;

  // Request workflow
  requestApprovalLevels: number; // 0 = no approval, 1 = manager only, 2 = manager + HR
  enableBudgetAllocation: boolean;

  // LMS features
  enableELearning: boolean;
  enableCertificationTracking: boolean;
  enableCompetencyGapAnalysis: boolean;
  enableKirkpatrickEvaluation: boolean;

  // Country-specific
  enableTaxTracking: boolean; // FDFP/ONFP

  // Reminders
  certificationExpiryReminderDays: number;
  mandatoryTrainingReminderDays: number;
}

/**
 * Training defaults by company size
 */
export const TrainingDefaultsBySize: Record<CompanySizeCategory, TrainingModuleConfig> = {
  solo: {
    enableTrainingPlans: false,
    defaultBudgetCurrency: 'XOF',
    requestApprovalLevels: 0,
    enableBudgetAllocation: false,
    enableELearning: false,
    enableCertificationTracking: true,
    enableCompetencyGapAnalysis: false,
    enableKirkpatrickEvaluation: false,
    enableTaxTracking: false,
    certificationExpiryReminderDays: 30,
    mandatoryTrainingReminderDays: 30,
  },
  small: {
    enableTrainingPlans: false,
    defaultBudgetCurrency: 'XOF',
    requestApprovalLevels: 1,
    enableBudgetAllocation: false,
    enableELearning: false,
    enableCertificationTracking: true,
    enableCompetencyGapAnalysis: false,
    enableKirkpatrickEvaluation: false,
    enableTaxTracking: true,
    certificationExpiryReminderDays: 30,
    mandatoryTrainingReminderDays: 30,
  },
  medium: {
    enableTrainingPlans: true,
    defaultBudgetCurrency: 'XOF',
    requestApprovalLevels: 2,
    enableBudgetAllocation: true,
    enableELearning: true,
    enableCertificationTracking: true,
    enableCompetencyGapAnalysis: true,
    enableKirkpatrickEvaluation: false,
    enableTaxTracking: true,
    certificationExpiryReminderDays: 60,
    mandatoryTrainingReminderDays: 30,
  },
  large: {
    enableTrainingPlans: true,
    defaultBudgetCurrency: 'XOF',
    requestApprovalLevels: 2,
    enableBudgetAllocation: true,
    enableELearning: true,
    enableCertificationTracking: true,
    enableCompetencyGapAnalysis: true,
    enableKirkpatrickEvaluation: true,
    enableTaxTracking: true,
    certificationExpiryReminderDays: 90,
    mandatoryTrainingReminderDays: 30,
  },
  enterprise: {
    enableTrainingPlans: true,
    defaultBudgetCurrency: 'XOF',
    requestApprovalLevels: 2,
    enableBudgetAllocation: true,
    enableELearning: true,
    enableCertificationTracking: true,
    enableCompetencyGapAnalysis: true,
    enableKirkpatrickEvaluation: true,
    enableTaxTracking: true,
    certificationExpiryReminderDays: 90,
    mandatoryTrainingReminderDays: 30,
  },
};

// ============================================================================
// WORKFLOW DEFAULTS
// ============================================================================

/**
 * Workflow configuration based on company size
 */
export interface WorkflowConfig {
  // Default templates to use
  performanceWorkflow: string;
  trainingRequestWorkflow: string;

  // Reminder settings
  reminderFirstDays: number;
  reminderRepeatDays: number;
  reminderMaxCount: number;

  // Escalation settings
  escalationTriggerDays: number;
  escalationAutoReassign: boolean;

  // Notification channels
  notificationChannels: ('email' | 'in_app' | 'push')[];
}

/**
 * Workflow defaults by company size
 */
export const WorkflowDefaultsBySize: Record<CompanySizeCategory, WorkflowConfig> = {
  solo: {
    performanceWorkflow: '',
    trainingRequestWorkflow: '',
    reminderFirstDays: 0,
    reminderRepeatDays: 0,
    reminderMaxCount: 0,
    escalationTriggerDays: 0,
    escalationAutoReassign: false,
    notificationChannels: [],
  },
  small: {
    performanceWorkflow: 'annual-review-simple',
    trainingRequestWorkflow: 'training-request',
    reminderFirstDays: 3,
    reminderRepeatDays: 3,
    reminderMaxCount: 3,
    escalationTriggerDays: 7,
    escalationAutoReassign: false,
    notificationChannels: ['email', 'in_app'],
  },
  medium: {
    performanceWorkflow: 'annual-review-standard',
    trainingRequestWorkflow: 'training-request',
    reminderFirstDays: 3,
    reminderRepeatDays: 2,
    reminderMaxCount: 5,
    escalationTriggerDays: 5,
    escalationAutoReassign: true,
    notificationChannels: ['email', 'in_app'],
  },
  large: {
    performanceWorkflow: 'annual-review-360',
    trainingRequestWorkflow: 'training-request',
    reminderFirstDays: 2,
    reminderRepeatDays: 2,
    reminderMaxCount: 5,
    escalationTriggerDays: 3,
    escalationAutoReassign: true,
    notificationChannels: ['email', 'in_app', 'push'],
  },
  enterprise: {
    performanceWorkflow: 'annual-review-360',
    trainingRequestWorkflow: 'training-request',
    reminderFirstDays: 2,
    reminderRepeatDays: 1,
    reminderMaxCount: 7,
    escalationTriggerDays: 3,
    escalationAutoReassign: true,
    notificationChannels: ['email', 'in_app', 'push'],
  },
};

// ============================================================================
// COMBINED MODULE CONFIGURATION
// ============================================================================

/**
 * Complete HR module configuration
 */
export interface HrModuleConfiguration {
  companySize: CompanySizeCategory;
  employeeCount: number;
  countryCode: string;
  performance: PerformanceModuleConfig;
  training: TrainingModuleConfig;
  workflow: WorkflowConfig;
}

/**
 * Feature availability by company size
 */
export interface FeatureAvailability {
  feature: string;
  description: string;
  availableFrom: CompanySizeCategory;
  isEnabled: boolean;
}

/**
 * All features and their availability
 */
export const FeaturesByCompanySize: FeatureAvailability[] = [
  // Performance features
  {
    feature: 'basic_rating',
    description: 'Notation simple (étoiles)',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'self_evaluation',
    description: 'Auto-évaluation',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'manager_evaluation',
    description: 'Évaluation manager',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'objectives',
    description: 'Gestion des objectifs',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: 'peer_feedback',
    description: 'Feedback entre pairs',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: 'competency_assessment',
    description: 'Évaluation des compétences',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: '360_feedback',
    description: 'Feedback 360°',
    availableFrom: 'large',
    isEnabled: true,
  },
  {
    feature: 'calibration',
    description: 'Sessions de calibration (9-box)',
    availableFrom: 'large',
    isEnabled: true,
  },
  // Training features
  {
    feature: 'training_catalog',
    description: 'Catalogue de formations',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'training_requests',
    description: 'Demandes de formation',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'certification_tracking',
    description: 'Suivi des certifications',
    availableFrom: 'small',
    isEnabled: true,
  },
  {
    feature: 'training_plans',
    description: 'Plans de formation annuels',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: 'e_learning',
    description: 'E-learning intégré',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: 'gap_analysis',
    description: 'Analyse des écarts de compétences',
    availableFrom: 'medium',
    isEnabled: true,
  },
  {
    feature: 'kirkpatrick_evaluation',
    description: 'Évaluation Kirkpatrick (4 niveaux)',
    availableFrom: 'large',
    isEnabled: true,
  },
];
