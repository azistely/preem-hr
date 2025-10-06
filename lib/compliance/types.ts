/**
 * Compliance Validation Types
 *
 * Types for Convention Collective compliance validation
 * Used by ComplianceValidator service
 */

import type { ComponentMetadata } from '@/features/employees/types/salary-components';

// ============================================================================
// Compliance Levels (3-Tier System)
// ============================================================================

export type ComplianceLevel = 'locked' | 'configurable' | 'freeform';

// ============================================================================
// Compliance Rules
// ============================================================================

export interface ComplianceRule {
  id: string;
  countryCode: string;
  ruleType: ComplianceRuleType;
  isMandatory: boolean;
  canExceed: boolean;
  legalReference: string;
  validationLogic: ValidationLogic;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export type ComplianceRuleType =
  | 'minimum_wage'
  | 'seniority_bonus'
  | 'notice_period'
  | 'severance'
  | 'annual_leave'
  | 'maternity_leave'
  | 'overtime_rate'
  | 'transport_exemption'
  | 'housing_allowance_range'
  | 'hazard_pay_range';

export interface ValidationLogic {
  minimum?: number;
  maximum?: number;
  minRate?: number;
  maxRate?: number;
  exemptionCap?: number;
  applies_to?: string;
  enforcement?: string;
  calculation_base?: string;
  rate_per_year?: number;
  cap?: number;
  max_years?: number;
  beyond_cap?: string;
  recommended?: number;
  requires_certification?: boolean;
  standard_days?: number;
  accrual_rate?: number;
  under_21_days?: number;
  seniority_bonuses?: Record<string, number>;
  [key: string]: unknown;
}

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  warnings?: ValidationWarning[];
}

export interface ValidationViolation {
  field: string;
  error: string;
  legalReference?: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  legalReference?: string;
  severity: 'warning';
}

// ============================================================================
// Template Validation Context
// ============================================================================

export interface TemplateValidationContext {
  templateCode: string;
  countryCode: string;
  complianceLevel: ComplianceLevel;
  legalReference?: string | null;
  customizableFields: string[];
  canDeactivate: boolean;
  canModify: boolean;
}

export interface ComponentCustomization {
  name?: string;
  amount?: number;
  metadata?: Partial<ComponentMetadata>;
}

// ============================================================================
// Rule Check Results
// ============================================================================

export interface RuleCheckResult {
  rule: ComplianceRule;
  passed: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
}
