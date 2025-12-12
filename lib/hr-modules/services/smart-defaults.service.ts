/**
 * Smart Defaults Service
 * Automatically configures HR modules based on company size and country
 */

import {
  type CompanySizeCategory,
  type PerformanceModuleConfig,
  type TrainingModuleConfig,
  type WorkflowConfig,
  type HrModuleConfiguration,
  type FeatureAvailability,
  CompanySizeThresholds,
  PerformanceDefaultsBySize,
  TrainingDefaultsBySize,
  WorkflowDefaultsBySize,
  FeaturesByCompanySize,
} from '../types/smart-defaults.types';

// ============================================================================
// COMPANY SIZE DETECTION
// ============================================================================

/**
 * Determine company size category from employee count
 */
export function detectCompanySize(employeeCount: number): CompanySizeCategory {
  if (employeeCount <= CompanySizeThresholds.solo.max) {
    return 'solo';
  }
  if (employeeCount <= CompanySizeThresholds.small.max) {
    return 'small';
  }
  if (employeeCount <= CompanySizeThresholds.medium.max) {
    return 'medium';
  }
  if (employeeCount <= CompanySizeThresholds.large.max) {
    return 'large';
  }
  return 'enterprise';
}

/**
 * Get the threshold values for a company size
 */
export function getCompanySizeThreshold(size: CompanySizeCategory): { min: number; max: number } {
  return CompanySizeThresholds[size];
}

// ============================================================================
// MODULE CONFIGURATION
// ============================================================================

/**
 * Get performance module configuration for company size
 */
export function getPerformanceConfig(
  employeeCount: number,
  overrides?: Partial<PerformanceModuleConfig>
): PerformanceModuleConfig {
  const size = detectCompanySize(employeeCount);
  const defaults = PerformanceDefaultsBySize[size];

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get training module configuration for company size
 */
export function getTrainingConfig(
  employeeCount: number,
  overrides?: Partial<TrainingModuleConfig>
): TrainingModuleConfig {
  const size = detectCompanySize(employeeCount);
  const defaults = TrainingDefaultsBySize[size];

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get workflow configuration for company size
 */
export function getWorkflowConfig(
  employeeCount: number,
  overrides?: Partial<WorkflowConfig>
): WorkflowConfig {
  const size = detectCompanySize(employeeCount);
  const defaults = WorkflowDefaultsBySize[size];

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get complete HR module configuration
 */
export function getHrModuleConfiguration(
  employeeCount: number,
  countryCode: string,
  overrides?: {
    performance?: Partial<PerformanceModuleConfig>;
    training?: Partial<TrainingModuleConfig>;
    workflow?: Partial<WorkflowConfig>;
  }
): HrModuleConfiguration {
  const size = detectCompanySize(employeeCount);

  return {
    companySize: size,
    employeeCount,
    countryCode,
    performance: getPerformanceConfig(employeeCount, overrides?.performance),
    training: getTrainingConfig(employeeCount, overrides?.training),
    workflow: getWorkflowConfig(employeeCount, overrides?.workflow),
  };
}

// ============================================================================
// FEATURE AVAILABILITY
// ============================================================================

/**
 * Size hierarchy for comparison
 */
const sizeHierarchy: CompanySizeCategory[] = ['solo', 'small', 'medium', 'large', 'enterprise'];

/**
 * Check if a feature is available for a given company size
 */
export function isFeatureAvailable(
  feature: string,
  employeeCount: number
): boolean {
  const currentSize = detectCompanySize(employeeCount);
  const featureConfig = FeaturesByCompanySize.find(f => f.feature === feature);

  if (!featureConfig) {
    return false;
  }

  const currentIndex = sizeHierarchy.indexOf(currentSize);
  const requiredIndex = sizeHierarchy.indexOf(featureConfig.availableFrom);

  return currentIndex >= requiredIndex && featureConfig.isEnabled;
}

/**
 * Get all available features for a company size
 */
export function getAvailableFeatures(employeeCount: number): FeatureAvailability[] {
  const currentSize = detectCompanySize(employeeCount);
  const currentIndex = sizeHierarchy.indexOf(currentSize);

  return FeaturesByCompanySize.map(feature => {
    const requiredIndex = sizeHierarchy.indexOf(feature.availableFrom);
    return {
      ...feature,
      isEnabled: currentIndex >= requiredIndex && feature.isEnabled,
    };
  });
}

/**
 * Get features that will unlock at the next company size tier
 */
export function getUpcomingFeatures(employeeCount: number): FeatureAvailability[] {
  const currentSize = detectCompanySize(employeeCount);
  const currentIndex = sizeHierarchy.indexOf(currentSize);

  if (currentIndex >= sizeHierarchy.length - 1) {
    return []; // Already at enterprise level
  }

  const nextSize = sizeHierarchy[currentIndex + 1];

  return FeaturesByCompanySize.filter(feature =>
    feature.availableFrom === nextSize && feature.isEnabled
  );
}

// ============================================================================
// WIZARD STEP CONFIGURATION
// ============================================================================

/**
 * Performance evaluation wizard steps by company size
 */
export interface WizardStepConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  isOptional?: boolean;
}

/**
 * Get wizard steps for performance evaluation
 */
export function getPerformanceWizardSteps(employeeCount: number): WizardStepConfig[] {
  const size = detectCompanySize(employeeCount);

  // Base steps for all sizes
  const baseSteps: WizardStepConfig[] = [
    {
      id: 'period',
      title: 'Quelle période?',
      description: 'Sélectionnez la période d\'évaluation',
      icon: 'Calendar',
    },
  ];

  if (size === 'solo') {
    return []; // No wizard for solo
  }

  if (size === 'small') {
    // Simple 3-step wizard
    return [
      ...baseSteps,
      {
        id: 'employees',
        title: 'Évaluez vos employés',
        description: 'Notation simple pour chaque employé',
        icon: 'Users',
      },
      {
        id: 'confirmation',
        title: 'Confirmation',
        description: 'Vérifiez et partagez les résultats',
        icon: 'Check',
      },
    ];
  }

  if (size === 'medium') {
    // 5-step wizard
    return [
      ...baseSteps,
      {
        id: 'objectives',
        title: 'Définissez les objectifs',
        description: 'Objectifs individuels et d\'équipe',
        icon: 'Target',
      },
      {
        id: 'self_evaluation',
        title: 'Auto-évaluation',
        description: 'Les employés s\'évaluent eux-mêmes',
        icon: 'User',
      },
      {
        id: 'manager_evaluation',
        title: 'Évaluation manager',
        description: 'Les managers évaluent leurs équipes',
        icon: 'UserCheck',
      },
      {
        id: 'share_results',
        title: 'Partager les résultats',
        description: 'Communiquez les évaluations finales',
        icon: 'Share2',
      },
    ];
  }

  // Large & Enterprise: 7-step wizard
  return [
    ...baseSteps,
    {
      id: 'objective_cascade',
      title: 'Cascade des objectifs',
      description: 'Alignez les objectifs entreprise → équipe → individu',
      icon: 'GitBranch',
    },
    {
      id: 'self_evaluation',
      title: 'Auto-évaluation',
      description: 'Les employés s\'évaluent eux-mêmes',
      icon: 'User',
    },
    {
      id: 'manager_evaluation',
      title: 'Évaluation manager',
      description: 'Les managers évaluent leurs équipes',
      icon: 'UserCheck',
    },
    {
      id: '360_feedback',
      title: 'Feedback 360°',
      description: 'Collecte du feedback multi-sources',
      icon: 'Users',
      isOptional: true,
    },
    {
      id: 'calibration',
      title: 'Session de calibration',
      description: 'Harmonisez les évaluations (9-box)',
      icon: 'BarChart3',
      isOptional: true,
    },
    {
      id: 'release_results',
      title: 'Publication des résultats',
      description: 'Partagez les évaluations finales',
      icon: 'Send',
    },
  ];
}

/**
 * Get wizard steps for training request
 */
export function getTrainingRequestWizardSteps(employeeCount: number): WizardStepConfig[] {
  const size = detectCompanySize(employeeCount);

  if (size === 'solo') {
    return []; // No workflow
  }

  // Common steps for all sizes
  const baseSteps: WizardStepConfig[] = [
    {
      id: 'training_type',
      title: 'Quel type de formation?',
      description: 'Choisissez dans le catalogue ou proposez une formation',
      icon: 'BookOpen',
    },
    {
      id: 'justification',
      title: 'Pourquoi?',
      description: 'Expliquez le besoin de formation',
      icon: 'FileText',
    },
    {
      id: 'timing',
      title: 'Quand?',
      description: 'Dates préférées et urgence',
      icon: 'Calendar',
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      description: 'Vérifiez et soumettez la demande',
      icon: 'Send',
    },
  ];

  return baseSteps;
}

// ============================================================================
// COUNTRY-SPECIFIC DEFAULTS
// ============================================================================

/**
 * Country-specific training tax configuration
 */
export interface CountryTrainingTaxConfig {
  countryCode: string;
  taxName: string;
  taxRate: number; // As decimal (0.016 = 1.6%)
  creditRate: number; // Max recoverable as decimal
  declarationFrequency: 'monthly' | 'quarterly' | 'annual';
  authority: string;
}

/**
 * Training tax configurations by country
 */
export const TrainingTaxByCountry: Record<string, CountryTrainingTaxConfig> = {
  CI: {
    countryCode: 'CI',
    taxName: 'FDFP (TAP + TFPC)',
    taxRate: 0.016, // 0.4% TAP + 1.2% TFPC
    creditRate: 0.008, // Up to 0.8% recoverable
    declarationFrequency: 'monthly',
    authority: 'FDFP - Fonds de Développement de la Formation Professionnelle',
  },
  SN: {
    countryCode: 'SN',
    taxName: 'ONFP',
    taxRate: 0.03, // 3%
    creditRate: 0.015, // Up to 1.5% recoverable
    declarationFrequency: 'monthly',
    authority: 'ONFP - Office National de Formation Professionnelle',
  },
  BF: {
    countryCode: 'BF',
    taxName: 'FAFPA',
    taxRate: 0.015, // 1.5%
    creditRate: 0.0075, // Up to 0.75% recoverable
    declarationFrequency: 'quarterly',
    authority: 'FAFPA - Fonds d\'Appui à la Formation Professionnelle et à l\'Apprentissage',
  },
};

/**
 * Get training tax configuration for a country
 */
export function getTrainingTaxConfig(countryCode: string): CountryTrainingTaxConfig | null {
  return TrainingTaxByCountry[countryCode] || null;
}

// ============================================================================
// SMART DEFAULTS APPLICATION
// ============================================================================

/**
 * Apply smart defaults to a new performance cycle
 */
export function applyPerformanceCycleDefaults(
  employeeCount: number,
  countryCode: string,
  periodStart: Date
): {
  cycleType: string;
  periodEnd: Date;
  objectiveSettingDeadline: Date | null;
  selfEvaluationDeadline: Date | null;
  managerEvaluationDeadline: Date | null;
  calibrationDeadline: Date | null;
  resultsReleaseDate: Date | null;
  includeObjectives: boolean;
  includeSelfEvaluation: boolean;
  includeManagerEvaluation: boolean;
  includePeerFeedback: boolean;
  include360Feedback: boolean;
  includeCalibration: boolean;
} {
  const config = getPerformanceConfig(employeeCount);

  // Calculate period end based on cycle type
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + config.cycleDurationMonths);
  periodEnd.setDate(periodEnd.getDate() - 1);

  // Calculate deadlines if applicable
  const calculateDeadline = (daysFromStart: number): Date | null => {
    if (daysFromStart === 0) return null;
    const deadline = new Date(periodEnd);
    deadline.setDate(deadline.getDate() - daysFromStart);
    return deadline;
  };

  // Calculate progressive deadlines (working backwards from period end)
  let totalDays = 0;

  const resultsReleaseDate = new Date(periodEnd);
  resultsReleaseDate.setDate(resultsReleaseDate.getDate() + 7); // 1 week after period end

  totalDays += config.defaultCalibrationDays;
  const calibrationDeadline = config.includeCalibration
    ? calculateDeadline(totalDays)
    : null;

  totalDays += config.defaultManagerEvaluationDays;
  const managerEvaluationDeadline = config.includeManagerEvaluation
    ? calculateDeadline(totalDays)
    : null;

  totalDays += config.defaultSelfEvaluationDays;
  const selfEvaluationDeadline = config.includeSelfEvaluation
    ? calculateDeadline(totalDays)
    : null;

  // Objective setting should be at the start of the period
  const objectiveSettingDeadline = config.includeObjectives
    ? new Date(periodStart.getTime() + config.defaultObjectiveSettingDays * 24 * 60 * 60 * 1000)
    : null;

  return {
    cycleType: config.defaultCycleType,
    periodEnd,
    objectiveSettingDeadline,
    selfEvaluationDeadline,
    managerEvaluationDeadline,
    calibrationDeadline,
    resultsReleaseDate,
    includeObjectives: config.includeObjectives,
    includeSelfEvaluation: config.includeSelfEvaluation,
    includeManagerEvaluation: config.includeManagerEvaluation,
    includePeerFeedback: config.includePeerFeedback,
    include360Feedback: config.include360Feedback,
    includeCalibration: config.includeCalibration,
  };
}

/**
 * Apply smart defaults to a new training plan
 */
export function applyTrainingPlanDefaults(
  employeeCount: number,
  countryCode: string,
  year: number
): {
  currency: string;
  enableBudgetAllocation: boolean;
  taxConfig: CountryTrainingTaxConfig | null;
} {
  const config = getTrainingConfig(employeeCount);
  const taxConfig = config.enableTaxTracking ? getTrainingTaxConfig(countryCode) : null;

  return {
    currency: config.defaultBudgetCurrency,
    enableBudgetAllocation: config.enableBudgetAllocation,
    taxConfig,
  };
}
