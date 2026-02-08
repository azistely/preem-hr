/**
 * ComplianceValidator Service
 *
 * Validates salary component customizations against Convention Collective rules
 * Implements 3-tier compliance system:
 * - 🔒 Locked: Cannot customize (mandatory components)
 * - ⚙️ Configurable: Within legal bounds (housing 20-30%, transport ≤30k)
 * - 🎨 Freeform: Full flexibility (non-regulated components)
 */

import { db } from '@/lib/db/index';
import { salaryComponentTemplates, complianceRules } from '@/drizzle/schema';
import { eq, and, lte, gte, or, isNull } from 'drizzle-orm';
import type {
  ValidationResult,
  ValidationViolation,
  ValidationWarning,
  ComponentCustomization,
  TemplateValidationContext,
  ComplianceRule,
  RuleCheckResult,
} from './types';
import type { CIComponentMetadata } from '@/features/employees/types/salary-components';

export class ComplianceValidator {
  /**
   * Validate a component customization against compliance rules
   *
   * @param templateCode - Template code (e.g., 'TPT_HOUSING_CI')
   * @param countryCode - Country code (e.g., 'CI')
   * @param customization - User's customization (name, amount, metadata)
   * @returns Validation result with violations and warnings
   */
  async validateComponent(
    templateCode: string,
    countryCode: string,
    customization?: ComponentCustomization
  ): Promise<ValidationResult> {
    // Get template context
    const templateContext = await this.getTemplateContext(templateCode, countryCode);

    if (!templateContext) {
      return {
        valid: false,
        violations: [
          {
            field: 'template',
            error: 'Template not found',
            severity: 'error',
          },
        ],
      };
    }

    // 🚨 CRITICAL: Validate forbidden customizations (tax treatment, CNPS)
    const forbiddenValidation = this.validateForbiddenCustomizations(customization);
    if (!forbiddenValidation.valid) {
      return forbiddenValidation;
    }

    // If locked, no customization allowed
    if (templateContext.complianceLevel === 'locked' && customization?.metadata) {
      return {
        valid: false,
        violations: [
          {
            field: 'compliance',
            error: 'Ce composant est obligatoire et ne peut pas être modifié',
            legalReference: templateContext.legalReference || undefined,
            severity: 'error',
          },
        ],
      };
    }

    // If freeform, only allow calculation rule modifications
    if (templateContext.complianceLevel === 'freeform') {
      // Still enforce forbidden customizations (tax/CNPS already checked above)
      return {
        valid: true,
        violations: [],
      };
    }

    // If configurable, validate against legal ranges
    if (templateContext.complianceLevel === 'configurable' && customization?.metadata) {
      return await this.validateConfigurableComponent(
        templateContext,
        customization
      );
    }

    return {
      valid: true,
      violations: [],
    };
  }

  /**
   * Validate that user is NOT trying to modify forbidden fields
   *
   * FORBIDDEN FIELDS (defined by law, not by employer):
   * - taxTreatment.* (Code Général des Impôts)
   * - socialSecurityTreatment.* (Décret CNPS)
   * - category (impacts tax treatment)
   */
  private validateForbiddenCustomizations(
    customization?: ComponentCustomization
  ): ValidationResult {
    const violations: ValidationViolation[] = [];

    if (!customization?.metadata) {
      return { valid: true, violations: [] };
    }

    const metadata = customization.metadata as any;

    // Check tax treatment modification
    if (metadata.taxTreatment) {
      violations.push({
        field: 'taxTreatment',
        error: 'Le traitement fiscal est défini par la loi et ne peut pas être modifié',
        legalReference: 'Code Général des Impôts de Côte d\'Ivoire',
        severity: 'error',
      });
    }

    // Check social security treatment modification
    if (metadata.socialSecurityTreatment) {
      violations.push({
        field: 'socialSecurityTreatment',
        error: 'Les cotisations sociales sont définies par décret CNPS et ne peuvent pas être modifiées',
        legalReference: 'Décret CNPS - Caisse Nationale de Prévoyance Sociale',
        severity: 'error',
      });
    }

    // Check category modification
    if (metadata.category) {
      violations.push({
        field: 'category',
        error: 'La catégorie du composant ne peut pas être modifiée (impacte le traitement fiscal)',
        legalReference: 'Convention Collective Interprofessionnelle Article 6',
        severity: 'error',
      });
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Get template validation context
   */
  private async getTemplateContext(
    templateCode: string,
    countryCode: string
  ): Promise<TemplateValidationContext | null> {
    const template = await db.query.salaryComponentTemplates.findFirst({
      where: and(
        eq(salaryComponentTemplates.code, templateCode),
        eq(salaryComponentTemplates.countryCode, countryCode)
      ),
    });

    if (!template) {
      return null;
    }

    return {
      templateCode: template.code,
      countryCode: template.countryCode,
      complianceLevel: (template.complianceLevel as 'locked' | 'configurable' | 'freeform') || 'freeform',
      legalReference: template.legalReference,
      customizableFields: (template.customizableFields as string[]) || [],
      canDeactivate: template.canDeactivate ?? true,
      canModify: template.canModify ?? true,
    };
  }

  /**
   * Validate configurable component against legal ranges
   */
  private async validateConfigurableComponent(
    templateContext: TemplateValidationContext,
    customization: ComponentCustomization
  ): Promise<ValidationResult> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationWarning[] = [];

    // Get applicable compliance rules
    const rules = await this.getApplicableRules(
      templateContext.countryCode,
      templateContext.templateCode
    );

    // Check each rule
    for (const rule of rules) {
      const checkResult = await this.checkRule(
        rule,
        templateContext,
        customization
      );

      violations.push(...checkResult.violations);
      warnings.push(...checkResult.warnings);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get applicable compliance rules for a template
   */
  private async getApplicableRules(
    countryCode: string,
    templateCode: string
  ): Promise<ComplianceRule[]> {
    const today = new Date().toISOString().split('T')[0];

    // Determine rule type based on template code
    let ruleType: string | null = null;

    if (templateCode.includes('HOUSING')) {
      ruleType = 'housing_allowance_range';
    } else if (templateCode.includes('TRANSPORT')) {
      ruleType = 'transport_exemption';
    } else if (templateCode.includes('HAZARD')) {
      ruleType = 'hazard_pay_range';
    } else if (templateCode.includes('SENIORITY')) {
      ruleType = 'seniority_bonus';
    }

    if (!ruleType) {
      return [];
    }

    const rules = await db.query.complianceRules.findMany({
      where: and(
        eq(complianceRules.countryCode, countryCode),
        eq(complianceRules.ruleType, ruleType),
        lte(complianceRules.effectiveFrom, today),
        or(
          isNull(complianceRules.effectiveTo),
          gte(complianceRules.effectiveTo, today)
        )
      ),
    });

    return rules as ComplianceRule[];
  }

  /**
   * Check a single compliance rule
   */
  private async checkRule(
    rule: ComplianceRule,
    templateContext: TemplateValidationContext,
    customization: ComponentCustomization
  ): Promise<RuleCheckResult> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationWarning[] = [];

    const metadata = customization.metadata as CIComponentMetadata | undefined;
    const calculationRule = metadata?.calculationRule;

    // Check housing allowance rate (20-30%)
    if (rule.ruleType === 'housing_allowance_range' && calculationRule?.rate !== undefined) {
      const minRate = (rule.validationLogic.minRate as number) || 0.20;
      const maxRate = (rule.validationLogic.maxRate as number) || 0.30;
      const rate = calculationRule.rate;

      if (rate < minRate || rate > maxRate) {
        violations.push({
          field: 'calculationRule.rate',
          error: `Le pourcentage doit être entre ${minRate * 100}% et ${maxRate * 100}%`,
          legalReference: rule.legalReference,
          severity: 'error',
        });
      }
    }

    // Check transport amount (≤30,000 for tax exemption)
    if (rule.ruleType === 'transport_exemption' && calculationRule?.baseAmount !== undefined) {
      const exemptionCap = (rule.validationLogic.exemptionCap as number) || 30000;
      const amount = calculationRule.baseAmount;

      if (amount > exemptionCap) {
        warnings.push({
          field: 'calculationRule.baseAmount',
          message: `Au-delà de ${exemptionCap.toLocaleString('fr-FR')} FCFA, la prime devient imposable`,
          legalReference: rule.legalReference,
          severity: 'warning',
        });
      }
    }

    // Check hazard pay rate (15-25%)
    if (rule.ruleType === 'hazard_pay_range' && calculationRule?.rate !== undefined) {
      const minRate = (rule.validationLogic.minRate as number) || 0.15;
      const maxRate = (rule.validationLogic.maxRate as number) || 0.25;
      const rate = calculationRule.rate;

      if (rate < minRate || rate > maxRate) {
        violations.push({
          field: 'calculationRule.rate',
          error: `Le pourcentage doit être entre ${minRate * 100}% et ${maxRate * 100}%`,
          legalReference: rule.legalReference,
          severity: 'error',
        });
      }

      if (rule.validationLogic.requires_certification === true) {
        warnings.push({
          field: 'certification',
          message: 'Cette prime nécessite une certification de conditions de travail dangereuses',
          legalReference: rule.legalReference,
          severity: 'warning',
        });
      }
    }

    return {
      rule,
      passed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate custom component against compliance rules (without template)
   * Used in wizard-based component creation
   *
   * @param componentData - Component metadata to validate
   * @param countryCode - Country code (e.g., 'CI')
   * @returns Validation result with violations and warnings
   */
  async validateComponentAgainstRules(
    componentData: {
      name: string;
      category: string;
      componentType?: string;
      isTaxable: boolean;
      isReimbursement: boolean;
      calculationRule?: {
        type: 'fixed' | 'percentage' | 'auto-calculated';
        baseAmount?: number;
        rate?: number;
      };
    },
    countryCode: string
  ): Promise<ValidationResult> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationWarning[] = [];

    // Rule 1: If it's a reimbursement, it MUST be non-taxable
    if (componentData.isReimbursement && componentData.isTaxable) {
      violations.push({
        field: 'isTaxable',
        error: 'Un remboursement ne peut pas être imposable selon le Code Général des Impôts',
        legalReference: 'Code Général des Impôts Article X - Remboursements de frais',
        severity: 'error',
      });
    }

    // Rule 2: If non-taxable and NOT a reimbursement, warn about 10% cap
    if (!componentData.isTaxable && !componentData.isReimbursement) {
      warnings.push({
        field: 'isTaxable',
        message: 'Cette prime sera soumise au plafond global de 10% des primes non imposables',
        legalReference: 'Code Général des Impôts Article X - Primes et indemnités non imposables',
        severity: 'warning',
      });
    }

    // Rule 3: Validate component-specific caps for non-taxable components
    if (!componentData.isTaxable && componentData.componentType) {
      const componentTypeRules = await this.getComponentTypeRules(
        countryCode,
        componentData.componentType
      );

      for (const rule of componentTypeRules) {
        const ruleResult = await this.checkComponentTypeRule(
          rule,
          componentData
        );
        violations.push(...ruleResult.violations);
        warnings.push(...ruleResult.warnings);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get compliance rules specific to a component type
   */
  private async getComponentTypeRules(
    countryCode: string,
    componentType: string
  ): Promise<ComplianceRule[]> {
    const today = new Date().toISOString().split('T')[0];

    const rules = await db.query.complianceRules.findMany({
      where: and(
        eq(complianceRules.countryCode, countryCode),
        lte(complianceRules.effectiveFrom, today),
        or(
          isNull(complianceRules.effectiveTo),
          gte(complianceRules.effectiveTo, today)
        )
      ),
    });

    // Filter rules that apply to this component type
    return rules.filter((rule) => {
      const validationLogic = rule.validationLogic as any;

      // Global rules apply to all
      if (validationLogic.scope === 'global') {
        return true;
      }

      // Component-specific rules
      if (validationLogic.component_type === componentType) {
        return true;
      }

      // Multi-component rules (e.g., representation/responsibility/function)
      if (Array.isArray(validationLogic.component_types)) {
        return validationLogic.component_types.includes(componentType);
      }

      return false;
    }) as ComplianceRule[];
  }

  /**
   * Check component data against a specific rule
   */
  private async checkComponentTypeRule(
    rule: ComplianceRule,
    componentData: {
      name: string;
      category: string;
      componentType?: string;
      isTaxable: boolean;
      isReimbursement: boolean;
      calculationRule?: {
        type: 'fixed' | 'percentage' | 'auto-calculated';
        baseAmount?: number;
        rate?: number;
      };
    }
  ): Promise<RuleCheckResult> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationWarning[] = [];
    const validationLogic = rule.validationLogic as any;

    // Check fixed amount caps (e.g., uniform allowance ≤ 3,000 FCFA)
    if (validationLogic.max_amount && componentData.calculationRule?.baseAmount) {
      const amount = componentData.calculationRule.baseAmount;
      const maxAmount = validationLogic.max_amount as number;

      if (amount > maxAmount) {
        if (rule.canExceed) {
          warnings.push({
            field: 'calculationRule.baseAmount',
            message: validationLogic.error_message || `Le montant dépasse ${maxAmount.toLocaleString('fr-FR')} FCFA et sera imposable`,
            legalReference: rule.legalReference,
            severity: 'warning',
          });
        } else {
          violations.push({
            field: 'calculationRule.baseAmount',
            error: validationLogic.error_message || `Le montant ne peut pas dépasser ${maxAmount.toLocaleString('fr-FR')} FCFA`,
            legalReference: rule.legalReference,
            severity: 'error',
          });
        }
      }
    }

    // Check percentage caps (e.g., representation ≤ 10%)
    if (validationLogic.max_percentage && componentData.calculationRule?.rate) {
      const rate = componentData.calculationRule.rate;
      const maxRate = validationLogic.max_percentage as number;

      if (rate > maxRate) {
        violations.push({
          field: 'calculationRule.rate',
          error: validationLogic.error_message || `Le pourcentage ne peut pas dépasser ${maxRate * 100}%`,
          legalReference: rule.legalReference,
          severity: 'error',
        });
      }
    }

    return {
      rule,
      passed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate global 10% cap on non-taxable components during payroll
   *
   * @param payrollData - Employee salary components for validation
   * @param countryCode - Country code (e.g., 'CI')
   * @returns Validation result with cap percentage and warnings
   */
  async validateGlobalNonTaxableCap(
    payrollData: {
      totalRemuneration: number; // Total gross salary (brut global)
      components: Array<{
        code: string;
        name: string;
        amount: number;
        isTaxable: boolean;
        isReimbursement: boolean;
      }>;
    },
    countryCode: string
  ): Promise<{
    valid: boolean;
    currentPercentage: number;
    maxPercentage: number;
    totalNonTaxable: number;
    totalReimbursements: number;
    violations: ValidationViolation[];
    warnings: ValidationWarning[];
  }> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationWarning[] = [];

    // Get the global cap rule
    const today = new Date().toISOString().split('T')[0];
    const globalCapRule = await db.query.complianceRules.findFirst({
      where: and(
        eq(complianceRules.countryCode, countryCode),
        eq(complianceRules.ruleType, 'non_taxable_global_cap'),
        lte(complianceRules.effectiveFrom, today),
        or(
          isNull(complianceRules.effectiveTo),
          gte(complianceRules.effectiveTo, today)
        )
      ),
    });

    const maxPercentage = globalCapRule
      ? ((globalCapRule.validationLogic as any).max_percentage as number)
      : 0.10;

    // Separate reimbursements from other non-taxable components
    const totalReimbursements = payrollData.components
      .filter((c) => c.isReimbursement)
      .reduce((sum, c) => sum + c.amount, 0);

    const totalNonTaxableNonReimbursements = payrollData.components
      .filter((c) => !c.isTaxable && !c.isReimbursement)
      .reduce((sum, c) => sum + c.amount, 0);

    const totalNonTaxable = totalReimbursements + totalNonTaxableNonReimbursements;

    // Calculate percentage (excluding reimbursements per the rule)
    const currentPercentage =
      payrollData.totalRemuneration > 0
        ? totalNonTaxableNonReimbursements / payrollData.totalRemuneration
        : 0;

    // Check if exceeds cap
    if (currentPercentage > maxPercentage) {
      const excessAmount = totalNonTaxableNonReimbursements - payrollData.totalRemuneration * maxPercentage;

      violations.push({
        field: 'global_non_taxable_cap',
        error: `Le total des primes non imposables (${totalNonTaxableNonReimbursements.toLocaleString('fr-FR')} FCFA) dépasse le plafond de ${maxPercentage * 100}% de la rémunération totale (${(payrollData.totalRemuneration * maxPercentage).toLocaleString('fr-FR')} FCFA). Excédent: ${excessAmount.toLocaleString('fr-FR')} FCFA.`,
        legalReference: globalCapRule?.legalReference || 'Code Général des Impôts Article X',
        severity: 'error',
      });
    } else if (currentPercentage > maxPercentage * 0.8) {
      // Warning if approaching cap (>80% of limit)
      warnings.push({
        field: 'global_non_taxable_cap',
        message: `Attention: Les primes non imposables représentent ${(currentPercentage * 100).toFixed(1)}% de la rémunération totale. Le plafond légal est de ${maxPercentage * 100}%.`,
        legalReference: globalCapRule?.legalReference || 'Code Général des Impôts Article X',
        severity: 'warning',
      });
    }

    return {
      valid: violations.length === 0,
      currentPercentage,
      maxPercentage,
      totalNonTaxable,
      totalReimbursements,
      violations,
      warnings,
    };
  }

  /**
   * Get recommended value for a configurable component
   * Used to pre-fill customization dialog with legal defaults
   */
  async getRecommendedValue(
    templateCode: string,
    countryCode: string,
    field: string
  ): Promise<number | null> {
    const rules = await this.getApplicableRules(countryCode, templateCode);

    if (rules.length === 0) {
      return null;
    }

    const rule = rules[0];

    // Housing allowance: recommend 25% (mid-range of 20-30%)
    if (rule.ruleType === 'housing_allowance_range' && field === 'rate') {
      return (rule.validationLogic.recommended as number) || 0.25;
    }

    // Transport: recommend max exempt amount (30,000)
    if (rule.ruleType === 'transport_exemption' && field === 'baseAmount') {
      return (rule.validationLogic.exemptionCap as number) || 30000;
    }

    // Hazard pay: recommend mid-range (20%)
    if (rule.ruleType === 'hazard_pay_range' && field === 'rate') {
      const minRate = (rule.validationLogic.minRate as number) || 0.15;
      const maxRate = (rule.validationLogic.maxRate as number) || 0.25;
      return (minRate + maxRate) / 2;
    }

    return null;
  }

  /**
   * Get legal range for a configurable field
   * Used to display slider bounds in UI
   */
  async getLegalRange(
    templateCode: string,
    countryCode: string,
    field: string
  ): Promise<{ min: number; max: number; recommended?: number } | null> {
    const rules = await this.getApplicableRules(countryCode, templateCode);

    if (rules.length === 0) {
      return null;
    }

    const rule = rules[0];

    // Housing allowance rate
    if (rule.ruleType === 'housing_allowance_range' && field === 'rate') {
      return {
        min: (rule.validationLogic.minRate as number) || 0.20,
        max: (rule.validationLogic.maxRate as number) || 0.30,
        recommended: (rule.validationLogic.recommended as number) || 0.25,
      };
    }

    // Transport amount
    if (rule.ruleType === 'transport_exemption' && field === 'baseAmount') {
      return {
        min: 0,
        max: (rule.validationLogic.exemptionCap as number) || 30000,
        recommended: (rule.validationLogic.exemptionCap as number) || 30000,
      };
    }

    // Hazard pay rate
    if (rule.ruleType === 'hazard_pay_range' && field === 'rate') {
      const minRate = (rule.validationLogic.minRate as number) || 0.15;
      const maxRate = (rule.validationLogic.maxRate as number) || 0.25;
      return {
        min: minRate,
        max: maxRate,
        recommended: (minRate + maxRate) / 2,
      };
    }

    return null;
  }
}

// Export singleton instance
export const complianceValidator = new ComplianceValidator();
