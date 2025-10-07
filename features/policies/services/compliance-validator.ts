/**
 * Compliance Validation Service
 *
 * Validates time-off policies against Convention Collective legal minimums
 * Prevents HR from creating non-compliant policies
 *
 * Design Philosophy:
 * - NEVER trust user input
 * - Validate against database-driven legal minimums
 * - Return actionable error messages in French
 * - Support multi-country expansion via database
 */

import { db } from '@/lib/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { overtimeRates, leaveAccrualRules } from '@/lib/db/schema/policies';

// ============================================================================
// Types
// ============================================================================

export type ComplianceSeverity = 'critical' | 'warning' | 'info';

export interface ComplianceViolation {
  field: string;
  message: string;
  severity: ComplianceSeverity;
  legalReference?: string;
  suggestedValue?: number | string;
  currentValue?: number | string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  complianceLevel: 'convention_collective' | 'configurable' | 'freeform' | 'non_compliant';
  legalReferences: string[];
}

export interface PolicyInput {
  templateId?: string;
  accrualRate?: number;
  maxBalance?: number;
  requiresApproval?: boolean;
  advanceNoticeDays?: number;
  minDaysPerRequest?: number;
  maxDaysPerRequest?: number;
  isPaid?: boolean;
}

// ============================================================================
// Legal Minimums Loader
// ============================================================================

/**
 * Get legal minimums for annual leave from database
 * Uses time_off_policy_templates table (locked templates)
 *
 * NOTE: Template validation temporarily disabled - template system not yet implemented
 */
export async function getLegalMinimumsForAnnualLeave(
  countryCode: string
): Promise<{
  accrualRate: number;
  maxBalance: number | null;
  minContinuousDays: number;
  carryoverMonths: number;
  legalReference: string;
}> {
  // TODO: Re-enable when time_off_policy_templates table is created
  // const template = await db.query.timeOffPolicyTemplates.findFirst({
  //   where: and(
  //     eq(timeOffPolicyTemplates.countryCode, countryCode),
  //     eq(timeOffPolicyTemplates.code, `ANNUAL_LEAVE_STANDARD_${countryCode}`),
  //     eq(timeOffPolicyTemplates.complianceLevel, 'locked')
  //   ),
  // });

  // if (!template) {
  //   throw new Error(
  //     `Aucun modèle de congés annuels trouvé pour le pays ${countryCode}`
  //   );
  // }

  // Hardcoded CI defaults until template system is implemented
  return {
    accrualRate: 2.0,
    maxBalance: null,
    minContinuousDays: 12,
    carryoverMonths: 6,
    legalReference: 'Convention Collective Article 28',
  };
}

/**
 * Get overtime rate minimums from database
 */
export async function getOvertimeRateLimits(
  countryCode: string,
  periodType: string
): Promise<{
  legalMinimum: number;
  legalReference: string;
  displayName: string;
}> {
  const rate = await db.query.overtimeRates.findFirst({
    where: and(
      eq(overtimeRates.countryCode, countryCode),
      eq(overtimeRates.periodType, periodType),
      isNull(overtimeRates.effectiveTo) // Active rates only
    ),
  });

  if (!rate) {
    throw new Error(
      `Aucun taux de majoration trouvé pour ${periodType} au ${countryCode}`
    );
  }

  return {
    legalMinimum: parseFloat(rate.legalMinimum),
    legalReference: rate.legalReference || '',
    displayName: (rate.displayName as any)?.fr || periodType,
  };
}

/**
 * Get leave accrual minimums for specific age/seniority
 */
export async function getLeaveAccrualMinimum(
  countryCode: string,
  age?: number,
  seniorityYears?: number
): Promise<{
  daysPerMonth: number;
  bonusDays: number;
  totalAnnual: number;
  legalReference: string;
}> {
  // Find applicable rule with highest priority
  const applicableRules = await db.query.leaveAccrualRules.findMany({
    where: and(
      eq(leaveAccrualRules.countryCode, countryCode),
      isNull(leaveAccrualRules.effectiveTo)
    ),
    orderBy: (rules, { desc }) => [desc(rules.priority)],
  });

  // Filter rules that apply to this employee
  const matchingRule = applicableRules.find((rule) => {
    if (rule.ageThreshold && age && age < rule.ageThreshold) return true;
    if (rule.seniorityYears && seniorityYears && seniorityYears >= rule.seniorityYears)
      return true;
    if (!rule.ageThreshold && !rule.seniorityYears) return true; // Standard rule
    return false;
  });

  if (!matchingRule) {
    // Fallback to standard (2.0 days/month for CI)
    return {
      daysPerMonth: 2.0,
      bonusDays: 0,
      totalAnnual: 24,
      legalReference: 'Convention Collective Article 28',
    };
  }

  const daysPerMonth = parseFloat(matchingRule.daysPerMonth);
  const bonusDays = matchingRule.bonusDays || 0;

  return {
    daysPerMonth,
    bonusDays,
    totalAnnual: daysPerMonth * 12 + bonusDays,
    legalReference: matchingRule.legalReference || 'Convention Collective',
  };
}

// ============================================================================
// Policy Compliance Validation
// ============================================================================

/**
 * Validate time-off policy against Convention Collective requirements
 *
 * Returns ComplianceResult with actionable violations
 */
export async function validatePolicyCompliance(
  policy: PolicyInput,
  countryCode: string
): Promise<ComplianceResult> {
  const violations: ComplianceViolation[] = [];
  const legalReferences: string[] = [];

  // If using template, validate against template constraints
  // TODO: Re-enable when template system is implemented
  if (policy.templateId) {
    // const template = await db.query.timeOffPolicyTemplates.findFirst({
    //   where: eq(timeOffPolicyTemplates.id, policy.templateId),
    // });

    // if (!template) {
    //   violations.push({
    //     field: 'templateId',
    //     message: 'Modèle de politique introuvable',
    //     severity: 'critical',
    //   });
    //   return {
    //     isCompliant: false,
    //     violations,
    //     complianceLevel: 'non_compliant',
    //     legalReferences: [],
    //   };
    // }

    // if (template.legalReference) {
    //   legalReferences.push(template.legalReference);
    // }

    // // LOCKED template: Cannot modify any values
    // if (template.complianceLevel === 'locked') {
    //   if (policy.accrualRate && policy.accrualRate !== parseFloat(template.defaultAccrualRate || '0')) {
    //     violations.push({
    //       field: 'accrualRate',
    //       message: `Taux d'accumulation verrouillé à ${template.defaultAccrualRate} jours/mois selon ${template.legalReference}. Cette valeur ne peut pas être modifiée.`,
    //       severity: 'critical',
    //       legalReference: template.legalReference || undefined,
    //       suggestedValue: parseFloat(template.defaultAccrualRate || '0'),
    //       currentValue: policy.accrualRate,
    //     });
    //   }
    // }

    // // CONFIGURABLE template: Validate within min/max bounds
    // if (template.complianceLevel === 'configurable') {
    //   if (policy.accrualRate) {
    //     const minRate = parseFloat(template.minAccrualRate || '0');
    //     const maxRate = parseFloat(template.maxAccrualRate || '999');

    //     if (policy.accrualRate < minRate) {
    //       violations.push({
    //         field: 'accrualRate',
    //         message: `Minimum légal: ${minRate} jours/mois. Vous avez saisi: ${policy.accrualRate} jours. Veuillez choisir une valeur entre ${minRate} et ${maxRate} jours.`,
    //         severity: 'critical',
    //         legalReference: template.legalReference || undefined,
    //         suggestedValue: minRate,
    //         currentValue: policy.accrualRate,
    //       });
    //     }

    //     if (policy.accrualRate > maxRate) {
    //       violations.push({
    //         field: 'accrualRate',
    //         message: `Maximum légal: ${maxRate} jours/mois. Vous avez saisi: ${policy.accrualRate} jours.`,
    //         severity: 'warning',
    //         suggestedValue: maxRate,
    //         currentValue: policy.accrualRate,
    //       });
    //     }
    //   }
    // }

    // return {
    //   isCompliant: violations.filter((v) => v.severity === 'critical').length === 0,
    //   violations,
    //   complianceLevel: template.complianceLevel as any,
    //   legalReferences,
    // };
  }

  // No template: Validate against country-wide legal minimums
  try {
    const legalMinimums = await getLegalMinimumsForAnnualLeave(countryCode);
    legalReferences.push(legalMinimums.legalReference);

    if (policy.accrualRate && policy.accrualRate < legalMinimums.accrualRate) {
      violations.push({
        field: 'accrualRate',
        message: `Le taux d'accumulation doit être au moins ${legalMinimums.accrualRate} jours/mois (minimum légal pour ${countryCode}). Vous avez saisi: ${policy.accrualRate} jours/mois.`,
        severity: 'critical',
        legalReference: legalMinimums.legalReference,
        suggestedValue: legalMinimums.accrualRate,
        currentValue: policy.accrualRate,
      });
    }
  } catch (error) {
    // If no legal minimums found, allow custom policy (freeform)
    console.warn('No legal minimums found for country:', countryCode, error);
  }

  return {
    isCompliant: violations.filter((v) => v.severity === 'critical').length === 0,
    violations,
    complianceLevel: violations.length === 0 ? 'freeform' : 'non_compliant',
    legalReferences,
  };
}

/**
 * Validate overtime rate against legal minimum
 */
export async function validateOvertimeRate(
  countryCode: string,
  periodType: string,
  proposedRate: number
): Promise<ComplianceResult> {
  const violations: ComplianceViolation[] = [];
  const legalReferences: string[] = [];

  try {
    const limits = await getOvertimeRateLimits(countryCode, periodType);
    legalReferences.push(limits.legalReference);

    if (proposedRate < limits.legalMinimum) {
      violations.push({
        field: 'rateMultiplier',
        message: `Le taux de majoration pour ${limits.displayName} doit être au moins ${limits.legalMinimum}x (minimum légal). Vous avez saisi: ${proposedRate}x.`,
        severity: 'critical',
        legalReference: limits.legalReference,
        suggestedValue: limits.legalMinimum,
        currentValue: proposedRate,
      });
    }
  } catch (error) {
    violations.push({
      field: 'periodType',
      message: `Type de période invalide ou non trouvé: ${periodType}`,
      severity: 'critical',
    });
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    complianceLevel: violations.length === 0 ? 'convention_collective' : 'non_compliant',
    legalReferences,
  };
}

// ============================================================================
// Effective Dating Helpers
// ============================================================================

/**
 * Validate effective date change for policy
 * Prevents backdating or invalid date ranges
 */
export function validateEffectiveDating(
  effectiveFrom: Date,
  effectiveTo?: Date | null
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cannot backdate before today (prevents rewriting history)
  if (effectiveFrom < today) {
    violations.push({
      field: 'effectiveFrom',
      message: `La date de prise d'effet ne peut pas être dans le passé. Veuillez choisir une date à partir d'aujourd'hui.`,
      severity: 'critical',
      suggestedValue: today.toISOString().split('T')[0],
      currentValue: effectiveFrom.toISOString().split('T')[0],
    });
  }

  // effectiveTo must be after effectiveFrom
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    violations.push({
      field: 'effectiveTo',
      message: `La date de fin doit être postérieure à la date de début.`,
      severity: 'critical',
    });
  }

  return violations;
}

/**
 * Check for overlapping effective date ranges
 * Used to prevent duplicate policies for same period
 */
export function detectOverlappingPeriods(
  periods: Array<{ effectiveFrom: Date; effectiveTo: Date | null }>
): boolean {
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const period1 = periods[i];
      const period2 = periods[j];

      // Check if periods overlap
      const start1 = period1.effectiveFrom.getTime();
      const end1 = period1.effectiveTo ? period1.effectiveTo.getTime() : Infinity;
      const start2 = period2.effectiveFrom.getTime();
      const end2 = period2.effectiveTo ? period2.effectiveTo.getTime() : Infinity;

      if (start1 < end2 && start2 < end1) {
        return true; // Overlap detected
      }
    }
  }

  return false;
}

// ============================================================================
// Helper: Format compliance summary for UI
// ============================================================================

/**
 * Generate compliance badge data for UI
 */
export function getComplianceBadge(level: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'success';
  icon: string;
} {
  switch (level) {
    case 'locked':
    case 'convention_collective':
      return {
        label: 'Conforme Convention Collective',
        variant: 'success',
        icon: 'lock',
      };
    case 'configurable':
      return {
        label: 'Configurable (limites légales)',
        variant: 'default',
        icon: 'settings',
      };
    case 'freeform':
      return {
        label: 'Personnalisé',
        variant: 'secondary',
        icon: 'palette',
      };
    case 'non_compliant':
      return {
        label: 'Non conforme',
        variant: 'destructive',
        icon: 'alert-triangle',
      };
    default:
      return {
        label: 'Inconnu',
        variant: 'secondary',
        icon: 'help-circle',
      };
  }
}
