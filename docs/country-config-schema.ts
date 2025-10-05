/**
 * Country Configuration Schema
 *
 * TypeScript type definitions for multi-country payroll configuration.
 * These types align with the database schema defined in multi-country-payroll-architecture.md
 *
 * @module country-config-schema
 * @version 1.0
 * @date October 2025
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Supported country codes (ISO 3166-1 alpha-2)
 */
export type CountryCode =
  | 'CI'  // Côte d'Ivoire
  | 'SN'  // Senegal
  | 'BF'  // Burkina Faso
  | 'ML'  // Mali
  | 'BJ'  // Benin
  | 'TG'  // Togo
  | 'GN'; // Guinea

/**
 * Supported currency codes (ISO 4217)
 */
export type CurrencyCode =
  | 'XOF'  // West African CFA Franc (UEMOA countries)
  | 'GNF'; // Guinean Franc

/**
 * Localized text (supports French and English)
 */
export interface LocalizedText {
  fr: string;
  en?: string;
}

/**
 * Effective date range for temporal rules
 */
export interface EffectiveDateRange {
  effective_from: Date;
  effective_to: Date | null;  // null = currently active
}

// ============================================================================
// COUNTRY CONFIGURATION
// ============================================================================

/**
 * Country master configuration
 */
export interface Country {
  id: string;
  code: CountryCode;
  name: LocalizedText;
  currency_code: CurrencyCode;
  decimal_places: number;  // 0 for CFA, 2 for GNF
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Complete country configuration including all rules
 */
export interface CountryConfig {
  country: Country;
  taxSystem: TaxSystem;
  socialScheme: SocialSecurityScheme;
  otherTaxes: OtherTax[];
  salaryComponents: SalaryComponentDefinition[];
}

// ============================================================================
// TAX SYSTEM CONFIGURATION
// ============================================================================

/**
 * Tax calculation methods
 */
export type TaxCalculationMethod =
  | 'progressive_monthly'   // Côte d'Ivoire, Benin
  | 'progressive_annual'    // Senegal
  | 'progressive_hybrid'    // Mixed methods
  | 'flat_rate';            // Simple percentage

/**
 * Tax calculation base
 */
export type TaxCalculationBase =
  | 'brut_imposable'        // Taxable gross (most common)
  | 'net_imposable'         // Taxable net
  | 'total_brut';           // Total gross

/**
 * Tax system configuration
 */
export interface TaxSystem extends EffectiveDateRange {
  id: string;
  country_code: CountryCode;
  name: string;              // 'ITS', 'IRPP', 'IUTS', 'IGR'
  display_name: LocalizedText;
  calculation_method: TaxCalculationMethod;
  supports_family_deductions: boolean;
  calculation_base: TaxCalculationBase;
  metadata?: Record<string, unknown>;  // Country-specific extras
  brackets: TaxBracket[];
  familyDeductions?: FamilyDeductionRule[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Tax bracket definition
 */
export interface TaxBracket {
  id: string;
  tax_system_id: string;
  bracket_order: number;     // 1, 2, 3, ...
  min_amount: number;
  max_amount: number | null; // null = infinity (last bracket)
  rate: number;              // 0.16 = 16%
  description?: LocalizedText;
}

/**
 * Family deduction rule (for countries that support it)
 */
export interface FamilyDeductionRule {
  id: string;
  tax_system_id: string;
  fiscal_parts: number;      // 1.0, 1.5, 2.0, 2.5, etc.
  deduction_amount: number;  // Fixed deduction amount
  description?: LocalizedText;
}

/**
 * Tax calculation input
 */
export interface TaxInput {
  taxableIncome: number;
  fiscalParts?: number;
  countryCode: CountryCode;
  effectiveDate: Date;
}

/**
 * Tax calculation result
 */
export interface TaxResult {
  grossTax: number;
  familyDeduction: number;
  netTax: number;
  effectiveRate: number;     // Percentage (0.15 = 15%)
  bracketBreakdown: TaxBracketResult[];
}

/**
 * Individual tax bracket calculation result
 */
export interface TaxBracketResult {
  bracketOrder: number;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  taxableInBracket: number;
  taxAmount: number;
}

// ============================================================================
// SOCIAL SECURITY CONFIGURATION
// ============================================================================

/**
 * Social security agency codes
 */
export type SocialSecurityAgency =
  | 'CNPS'   // Côte d'Ivoire, Burkina Faso, Benin, Togo
  | 'CSS'    // Senegal
  | 'IPRES'  // Senegal (retirement)
  | 'IPM'    // Senegal (health)
  | 'INPS';  // Mali

/**
 * Contribution calculation base
 */
export type ContributionCalculationBase =
  | 'brut_imposable'        // Taxable gross (most common)
  | 'salaire_categoriel'    // Base/category salary only
  | 'total_brut'            // Total gross
  | 'fixed';                // Fixed amount (CMU)

/**
 * Ceiling period for contribution limits
 */
export type CeilingPeriod =
  | 'monthly'
  | 'quarterly'
  | 'annual';

/**
 * Social security scheme configuration
 */
export interface SocialSecurityScheme extends EffectiveDateRange {
  id: string;
  country_code: CountryCode;
  agency_code: SocialSecurityAgency;
  agency_name: LocalizedText;
  contributionTypes: ContributionType[];
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Contribution type (pension, health, family, etc.)
 */
export interface ContributionType {
  id: string;
  scheme_id: string;
  code: string;              // 'pension', 'family_benefits', 'work_accident', 'health', 'cmu'
  name: LocalizedText;
  employee_rate: number | null;  // null if employer-only
  employer_rate: number | null;  // null if employee-only
  calculation_base: ContributionCalculationBase;
  ceiling_amount: number | null; // null if no ceiling
  ceiling_period: CeilingPeriod | null;
  fixed_amount: number | null;   // For fixed contributions (CMU)
  is_variable_by_sector: boolean;
  display_order: number;
  sectorOverrides?: SectorContributionOverride[];
}

/**
 * Sector-specific contribution rate override
 */
export interface SectorContributionOverride {
  id: string;
  contribution_type_id: string;
  sector_code: string;       // 'services', 'industry', 'construction', 'agriculture', 'mining'
  sector_name: LocalizedText;
  employer_rate: number;     // Overrides default employer_rate
  risk_level?: 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Social security calculation input
 */
export interface SocialSecurityInput {
  brutImposable: number;
  salaireCategoriel: number;
  sectorCode?: string;
  hasFamily?: boolean;       // For CMU family coverage
  dependentChildren?: number;
}

/**
 * Social security calculation result
 */
export interface SocialSecurityResult {
  contributions: ContributionResult[];
  totalEmployee: number;
  totalEmployer: number;
}

/**
 * Individual contribution calculation result
 */
export interface ContributionResult {
  code: string;
  name: LocalizedText;
  base: number;
  employeeRate: number;
  employerRate: number;
  employeeAmount: number;
  employerAmount: number;
  ceiling?: number;
  appliedSectorOverride?: boolean;
}

// ============================================================================
// OTHER TAXES (TRAINING, ETC.)
// ============================================================================

/**
 * Who pays the tax
 */
export type TaxPayer = 'employer' | 'employee' | 'both';

/**
 * Other payroll-related taxes (FDFP, ANPE, etc.)
 */
export interface OtherTax extends EffectiveDateRange {
  id: string;
  country_code: CountryCode;
  code: string;              // 'fdfp_tap', 'fdfp_tfpc', 'anpe'
  name: LocalizedText;
  tax_rate: number;          // 0.004 = 0.4%
  calculation_base: TaxCalculationBase | 'brut_imposable';
  paid_by: TaxPayer;
}

/**
 * Other tax calculation result
 */
export interface OtherTaxResult {
  code: string;
  name: LocalizedText;
  rate: number;
  base: number;
  amount: number;
  paidBy: TaxPayer;
}

// ============================================================================
// SALARY COMPONENTS
// ============================================================================

/**
 * Salary component types
 */
export type SalaryComponentType =
  | 'base'               // Base salary
  | 'allowance'          // Housing, transport, meal, etc.
  | 'bonus'              // Seniority, performance, etc.
  | 'benefit_in_kind'    // Vehicle, housing, etc.
  | 'overtime'           // Overtime pay
  | 'commission';        // Sales commission

/**
 * Salary component definition
 */
export interface SalaryComponentDefinition {
  id: string;
  country_code: CountryCode;
  code: string;          // '11', '12', '21', '22', etc.
  name: LocalizedText;
  component_type: SalaryComponentType;
  is_taxable: boolean;
  include_in_brut_imposable: boolean;
  include_in_salaire_categoriel: boolean;
  tax_exempt_threshold: number | null;  // e.g., 30000 for transport
  display_order: number;
  is_active: boolean;
}

/**
 * Actual salary component instance for an employee
 */
export interface SalaryComponent {
  code: string;
  amount: number;
  description?: string;
  effectiveDate?: Date;
}

/**
 * Salary component calculation result
 */
export interface SalaryComponentResult extends SalaryComponent {
  name: LocalizedText;
  componentType: SalaryComponentType;
  isTaxable: boolean;
  includeInBrutImposable: boolean;
  includeInSalaireCategoriel: boolean;
  taxableAmount: number;  // May differ from amount if threshold applies
}

// ============================================================================
// EMPLOYEE PAYROLL DATA
// ============================================================================

/**
 * Employee payroll-specific information
 */
export interface EmployeePayrollData {
  employeeId: string;
  fiscal_parts: number;      // 1.0, 1.5, 2.0, etc.
  has_spouse: boolean;
  dependent_children: number;
  cmu_family_coverage: boolean;
}

// ============================================================================
// TENANT/COMPANY CONFIGURATION
// ============================================================================

/**
 * Sector codes
 */
export type SectorCode =
  | 'services'
  | 'commerce'
  | 'industry'
  | 'manufacturing'
  | 'construction'
  | 'agriculture'
  | 'mining'
  | 'transportation'
  | 'healthcare'
  | 'education'
  | 'other';

/**
 * Tenant payroll configuration
 */
export interface TenantPayrollConfig {
  tenantId: string;
  country_code: CountryCode;
  sector_code: SectorCode;
  default_fiscal_parts: number;  // Default for new employees
  currency_code: CurrencyCode;
}

// ============================================================================
// PAYROLL CALCULATION
// ============================================================================

/**
 * Payroll calculation input
 */
export interface PayrollCalculationInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  salaryComponents: SalaryComponent[];
  fiscalParts?: number;
  sectorCode?: string;
  hasFamily?: boolean;
  dependentChildren?: number;
}

/**
 * Complete payroll calculation result
 */
export interface PayrollResult {
  // Employee info
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;

  // Earnings
  salaryComponents: SalaryComponentResult[];
  totalBrut: number;
  brutImposable: number;
  salaireCategoriel: number;

  // Tax
  tax: TaxResult;

  // Social security
  socialSecurity: SocialSecurityResult;

  // Other taxes
  otherTaxes: OtherTaxResult[];

  // Totals
  totalEmployeeDeductions: number;
  totalEmployerCosts: number;
  netSalary: number;

  // Metadata
  calculatedAt: Date;
  configVersion?: string;  // Track which rules were used
}

// ============================================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================================

import { z } from 'zod';

/**
 * Zod schema for country code
 */
export const countryCodeSchema = z.enum(['CI', 'SN', 'BF', 'ML', 'BJ', 'TG', 'GN']);

/**
 * Zod schema for currency code
 */
export const currencyCodeSchema = z.enum(['XOF', 'GNF']);

/**
 * Zod schema for localized text
 */
export const localizedTextSchema = z.object({
  fr: z.string().min(1),
  en: z.string().optional(),
});

/**
 * Zod schema for tax bracket
 */
export const taxBracketSchema = z.object({
  bracket_order: z.number().int().positive(),
  min_amount: z.number().min(0),
  max_amount: z.number().min(0).nullable(),
  rate: z.number().min(0).max(1),  // 0 to 1 (0% to 100%)
}).refine(
  (data) => data.max_amount === null || data.max_amount > data.min_amount,
  { message: 'max_amount must be greater than min_amount' }
);

/**
 * Zod schema for family deduction rule
 */
export const familyDeductionRuleSchema = z.object({
  fiscal_parts: z.number().min(1).max(5),  // 1.0 to 5.0
  deduction_amount: z.number().min(0),
  description: localizedTextSchema.optional(),
});

/**
 * Zod schema for contribution type
 */
export const contributionTypeSchema = z.object({
  code: z.string().min(1),
  name: localizedTextSchema,
  employee_rate: z.number().min(0).max(1).nullable(),
  employer_rate: z.number().min(0).max(1).nullable(),
  calculation_base: z.enum(['brut_imposable', 'salaire_categoriel', 'total_brut', 'fixed']),
  ceiling_amount: z.number().min(0).nullable(),
  ceiling_period: z.enum(['monthly', 'quarterly', 'annual']).nullable(),
  fixed_amount: z.number().min(0).nullable(),
  is_variable_by_sector: z.boolean(),
}).refine(
  (data) => data.employee_rate !== null || data.employer_rate !== null,
  { message: 'At least one of employee_rate or employer_rate must be set' }
);

/**
 * Zod schema for salary component
 */
export const salaryComponentSchema = z.object({
  code: z.string().min(1).max(10),
  amount: z.number().min(0),
  description: z.string().optional(),
  effectiveDate: z.date().optional(),
});

/**
 * Zod schema for payroll calculation input
 */
export const payrollCalculationInputSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  salaryComponents: z.array(salaryComponentSchema).min(1),
  fiscalParts: z.number().min(1).max(5).optional(),
  sectorCode: z.string().optional(),
  hasFamily: z.boolean().optional(),
  dependentChildren: z.number().int().min(0).max(20).optional(),
}).refine(
  (data) => data.periodEnd >= data.periodStart,
  { message: 'periodEnd must be after periodStart' }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate fiscal parts based on marital status and children
 */
export function calculateFiscalParts(
  isMarried: boolean,
  dependentChildren: number
): number {
  let parts = isMarried ? 2.0 : 1.0;

  // Add 0.5 parts per child (Côte d'Ivoire standard)
  parts += dependentChildren * 0.5;

  // Cap at 5.0 parts
  return Math.min(parts, 5.0);
}

/**
 * Get effective rule based on date
 */
export function getEffectiveRule<T extends EffectiveDateRange>(
  rules: T[],
  effectiveDate: Date
): T | null {
  return rules.find(
    (rule) =>
      rule.effective_from <= effectiveDate &&
      (rule.effective_to === null || rule.effective_to >= effectiveDate)
  ) ?? null;
}

/**
 * Calculate ceiling-adjusted base
 */
export function applyCeiling(
  amount: number,
  ceiling: number | null
): number {
  if (ceiling === null) return amount;
  return Math.min(amount, ceiling);
}

/**
 * Round amount according to country rules
 */
export function roundAmount(
  amount: number,
  countryCode: CountryCode
): number {
  // Côte d'Ivoire: round to nearest 10 FCFA
  if (countryCode === 'CI') {
    return Math.round(amount / 10) * 10;
  }

  // Default: round to 2 decimal places
  return Math.round(amount * 100) / 100;
}

/**
 * Format amount with currency
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode,
  locale: string = 'fr-FR'
): string {
  const decimalPlaces = currencyCode === 'XOF' ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);
}

// ============================================================================
// EXAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Example: Côte d'Ivoire complete configuration
 */
export const COTE_IVOIRE_CONFIG: Partial<CountryConfig> = {
  country: {
    id: 'country-ci',
    code: 'CI',
    name: { fr: "Côte d'Ivoire", en: "Ivory Coast" },
    currency_code: 'XOF',
    decimal_places: 0,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
  taxSystem: {
    id: 'tax-system-ci-its',
    country_code: 'CI',
    name: 'ITS',
    display_name: {
      fr: "Impôt sur les Traitements et Salaires",
      en: "Tax on Salaries"
    },
    calculation_method: 'progressive_monthly',
    supports_family_deductions: true,
    calculation_base: 'brut_imposable',
    effective_from: new Date('2024-01-01'),
    effective_to: null,
    brackets: [
      { id: '1', tax_system_id: 'tax-system-ci-its', bracket_order: 1, min_amount: 0, max_amount: 75000, rate: 0 },
      { id: '2', tax_system_id: 'tax-system-ci-its', bracket_order: 2, min_amount: 75000, max_amount: 240000, rate: 0.16 },
      { id: '3', tax_system_id: 'tax-system-ci-its', bracket_order: 3, min_amount: 240000, max_amount: 800000, rate: 0.21 },
      { id: '4', tax_system_id: 'tax-system-ci-its', bracket_order: 4, min_amount: 800000, max_amount: 2400000, rate: 0.24 },
      { id: '5', tax_system_id: 'tax-system-ci-its', bracket_order: 5, min_amount: 2400000, max_amount: 8000000, rate: 0.28 },
      { id: '6', tax_system_id: 'tax-system-ci-its', bracket_order: 6, min_amount: 8000000, max_amount: null, rate: 0.32 },
    ],
    familyDeductions: [
      { id: '1', tax_system_id: 'tax-system-ci-its', fiscal_parts: 1.0, deduction_amount: 0 },
      { id: '2', tax_system_id: 'tax-system-ci-its', fiscal_parts: 1.5, deduction_amount: 5500 },
      { id: '3', tax_system_id: 'tax-system-ci-its', fiscal_parts: 2.0, deduction_amount: 11000 },
      { id: '4', tax_system_id: 'tax-system-ci-its', fiscal_parts: 2.5, deduction_amount: 16500 },
      { id: '5', tax_system_id: 'tax-system-ci-its', fiscal_parts: 3.0, deduction_amount: 22000 },
      { id: '6', tax_system_id: 'tax-system-ci-its', fiscal_parts: 3.5, deduction_amount: 27500 },
      { id: '7', tax_system_id: 'tax-system-ci-its', fiscal_parts: 4.0, deduction_amount: 33000 },
      { id: '8', tax_system_id: 'tax-system-ci-its', fiscal_parts: 4.5, deduction_amount: 38500 },
      { id: '9', tax_system_id: 'tax-system-ci-its', fiscal_parts: 5.0, deduction_amount: 44000 },
    ],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
};

/**
 * Example: Senegal IRPP configuration
 */
export const SENEGAL_CONFIG: Partial<CountryConfig> = {
  country: {
    id: 'country-sn',
    code: 'SN',
    name: { fr: "Sénégal", en: "Senegal" },
    currency_code: 'XOF',
    decimal_places: 0,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
  taxSystem: {
    id: 'tax-system-sn-irpp',
    country_code: 'SN',
    name: 'IRPP',
    display_name: {
      fr: "Impôt sur le Revenu des Personnes Physiques",
      en: "Personal Income Tax"
    },
    calculation_method: 'progressive_annual',
    supports_family_deductions: false,  // Uses 30% deduction instead
    calculation_base: 'brut_imposable',
    effective_from: new Date('2024-01-01'),
    effective_to: null,
    brackets: [
      { id: '1', tax_system_id: 'tax-system-sn-irpp', bracket_order: 1, min_amount: 0, max_amount: 630000, rate: 0 },
      { id: '2', tax_system_id: 'tax-system-sn-irpp', bracket_order: 2, min_amount: 630000, max_amount: 1500000, rate: 0.20 },
      { id: '3', tax_system_id: 'tax-system-sn-irpp', bracket_order: 3, min_amount: 1500000, max_amount: 4000000, rate: 0.30 },
      { id: '4', tax_system_id: 'tax-system-sn-irpp', bracket_order: 4, min_amount: 4000000, max_amount: null, rate: 0.40 },
    ],
    familyDeductions: [],  // Not used
    metadata: {
      standard_deduction_rate: 0.30,  // 30% deduction before tax
    },
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Types
  type: {} as CountryConfig,

  // Schemas
  schemas: {
    countryCode: countryCodeSchema,
    currencyCode: currencyCodeSchema,
    localizedText: localizedTextSchema,
    taxBracket: taxBracketSchema,
    familyDeduction: familyDeductionRuleSchema,
    contributionType: contributionTypeSchema,
    salaryComponent: salaryComponentSchema,
    payrollInput: payrollCalculationInputSchema,
  },

  // Helpers
  helpers: {
    calculateFiscalParts,
    getEffectiveRule,
    applyCeiling,
    roundAmount,
    formatCurrency,
  },

  // Examples
  examples: {
    coteIvoire: COTE_IVOIRE_CONFIG,
    senegal: SENEGAL_CONFIG,
  },
};
