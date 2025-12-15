/**
 * Compliance Module
 *
 * Convention Collective compliance validation for West Africa
 */

export { ComplianceValidator, complianceValidator } from './compliance-validator';
export type {
  ComplianceLevel,
  ComplianceRule,
  ComplianceRuleType,
  ValidationLogic,
  ValidationResult,
  ValidationViolation,
  ValidationWarning,
  TemplateValidationContext,
  ComponentCustomization,
  RuleCheckResult,
} from './types';

// Probation Compliance
export {
  ProbationComplianceService,
  probationComplianceService,
  getDefaultProbationDuration,
} from './probation-compliance.service';
export type {
  ProbationStatus,
  ProbationAlertType,
  ProbationAlertSeverity,
  ProbationAlert,
  ProbationComplianceStatus,
  ProbationUpdateResult,
  ProbationDashboardSummary,
} from './probation-compliance.service';
