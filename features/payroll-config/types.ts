/**
 * Payroll Configuration Types
 *
 * Domain models for multi-country payroll rules loaded from database.
 * These types represent the configuration data that drives payroll calculations.
 */

// ========================================
// Tax Configuration
// ========================================

export interface TaxSystem {
  id: string;
  countryCode: string;
  name: string;
  displayName: Record<string, string>; // { fr: "...", en: "..." }
  calculationMethod: 'progressive_monthly' | 'progressive_annual' | 'flat_rate';
  supportsFamilyDeductions: boolean;
  calculationBase: 'brut_imposable' | 'gross_salary' | 'net_salary';
  taxCalculationBase: 'gross_before_ss' | 'gross_after_ss'; // NEW: Determines if tax is on gross before or after SS deductions
  retirementContributionLabel: Record<string, string>; // NEW: Country-specific label (e.g., "CNPS Retraite" for CI, "IPRES" for SN)
  healthContributionLabel: Record<string, string>; // NEW: Country-specific label (e.g., "CMU" for CI, "CSS" for SN)
  incomeTaxLabel: Record<string, string>; // NEW: Country-specific label (e.g., "ITS" for CI, "IRPP" for SN)
  effectiveFrom: Date;
  effectiveTo: Date | null;
  metadata?: Record<string, unknown>;
}

export interface TaxBracket {
  id: string;
  taxSystemId: string;
  bracketOrder: number;
  minAmount: number;
  maxAmount: number | null; // null = infinity
  rate: number; // 0-1 (e.g., 0.16 = 16%)
  description?: Record<string, string>;
}

export interface FamilyDeductionRule {
  id: string;
  taxSystemId: string;
  fiscalParts: number; // 1.0, 1.5, 2.0, etc.
  deductionAmount: number; // FCFA
  description?: Record<string, string>;
}

// ========================================
// Social Security Configuration
// ========================================

export interface SocialSecurityScheme {
  id: string;
  countryCode: string;
  agencyCode: string; // 'CNPS', 'IPRES', etc.
  agencyName: Record<string, string>;
  defaultSectorCode: string; // NEW: Default sector code when employee.sector is null (e.g., 'SERVICES')
  effectiveFrom: Date;
  effectiveTo: Date | null;
  metadata?: Record<string, unknown>;
}

export interface ContributionType {
  id: string;
  schemeId: string | null; // null for V2 which uses country_code directly
  code: string; // 'pension', 'family_benefits', 'work_accident', 'cmu'
  name: Record<string, string>;
  employeeRate: number | null; // null if not applicable
  employerRate: number | null; // null if variable by sector
  calculationBase: 'gross_salary' | 'brut_imposable' | 'capped_gross' | 'salaire_categoriel' | 'fixed';
  ceilingAmount: number | null;
  ceilingPeriod: 'monthly' | 'annual' | null;
  fixedAmount: number | null; // For fixed contributions like CMU
  isVariableBySector: boolean;
  displayOrder: number;
}

export interface SectorContributionOverride {
  id: string;
  contributionTypeId: string;
  sectorCode: string; // 'services', 'industry', 'construction', etc.
  sectorName: Record<string, string>;
  employerRate: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

// ========================================
// Other Taxes
// ========================================

export interface OtherTax {
  id: string;
  countryCode: string;
  code: string; // 'fdfp_tap', 'fdfp_tfpc', '3fpt', etc.
  name: Record<string, string>;
  taxRate: number; // 0-1
  calculationBase: 'gross_salary' | 'brut_imposable';
  paidBy: 'employer' | 'employee' | 'shared';
  appliesToEmployeeType?: 'local' | 'expat' | null; // For ITS filtering (local vs expat)
  effectiveFrom: Date;
  effectiveTo: Date | null;
  metadata?: Record<string, unknown>;
}

// ========================================
// Salary Components
// ========================================

export interface SalaryComponentDefinition {
  id: string;
  countryCode: string;
  code: string; // 'transport', 'housing', 'meal', etc.
  name: Record<string, string>;
  category: 'allowance' | 'bonus' | 'deduction';
  componentType: string; // 'transport', 'housing', 'meal', 'seniority', etc.
  isTaxable: boolean;
  isSubjectToSocialSecurity: boolean;
  calculationMethod?: 'fixed' | 'percentage' | 'formula';
  defaultValue?: number;
  displayOrder: number;
  isCommon: boolean; // Common across countries
  metadata?: Record<string, unknown>;
}

// ========================================
// Country Configuration (Aggregate)
// ========================================

export interface CountryPayrollConfig {
  countryCode: string;
  taxSystem: TaxSystem;
  taxBrackets: TaxBracket[];
  familyDeductions: FamilyDeductionRule[];
  socialSecurityScheme: SocialSecurityScheme;
  contributions: ContributionType[];
  sectorOverrides: SectorContributionOverride[];
  otherTaxes: OtherTax[];
  salaryComponents: SalaryComponentDefinition[];
}
