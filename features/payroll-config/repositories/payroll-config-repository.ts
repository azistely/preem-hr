/**
 * Payroll Configuration Repository
 *
 * Loads multi-country payroll rules from the database.
 * This repository provides a clean interface for accessing payroll configuration
 * data without exposing database implementation details.
 */

import { db } from '@/lib/db';
import { eq, and, or, lte, gte, isNull } from 'drizzle-orm';
import type {
  TaxSystem,
  TaxBracket,
  FamilyDeductionRule,
  SocialSecurityScheme,
  ContributionType,
  SectorContributionOverride,
  OtherTax,
  SalaryComponentDefinition,
  CountryPayrollConfig,
} from '../types';

/**
 * Load complete payroll configuration for a country
 *
 * This is the main method that loads all payroll rules for a specific country
 * and date. It performs multiple database queries and assembles the complete
 * configuration.
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'CI', 'SN')
 * @param effectiveDate - Date for which to load rules (defaults to today)
 * @returns Complete payroll configuration or null if not found
 *
 * @example
 * ```typescript
 * const config = await loadCountryConfig('CI', new Date('2025-01-01'));
 * if (!config) throw new Error('No config found for CI');
 *
 * // Use config.taxBrackets for ITS calculation
 * // Use config.contributions for CNPS calculation
 * ```
 */
export async function loadCountryConfig(
  countryCode: string,
  effectiveDate: Date = new Date()
): Promise<CountryPayrollConfig | null> {
  // Load tax system
  const taxSystem = await loadTaxSystem(countryCode, effectiveDate);
  if (!taxSystem) return null;

  // Load all related configuration in parallel
  const [
    taxBrackets,
    familyDeductions,
    socialSecurityScheme,
    contributions,
    sectorOverrides,
    otherTaxes,
    salaryComponents,
  ] = await Promise.all([
    loadTaxBrackets(taxSystem.id),
    loadFamilyDeductions(taxSystem.id),
    loadSocialSecurityScheme(countryCode, effectiveDate),
    loadContributions(countryCode, effectiveDate),
    loadSectorOverrides(countryCode, effectiveDate),
    loadOtherTaxes(countryCode, effectiveDate),
    loadSalaryComponents(countryCode),
  ]);

  if (!socialSecurityScheme) return null;

  return {
    countryCode,
    taxSystem,
    taxBrackets,
    familyDeductions,
    socialSecurityScheme,
    contributions,
    sectorOverrides,
    otherTaxes,
    salaryComponents,
  };
}

/**
 * Load tax system for a country
 *
 * Finds the active tax system for a country at a specific date.
 * A tax system is active if:
 * - effective_from <= effectiveDate
 * - effective_to IS NULL OR effective_to > effectiveDate
 */
async function loadTaxSystem(
  countryCode: string,
  effectiveDate: Date
): Promise<TaxSystem | null> {
  // Convert Date to ISO string for Drizzle/postgres-js compatibility
  const effectiveDateStr = effectiveDate.toISOString();

  const result = await db.query.taxSystems.findFirst({
    where: (taxSystems, { eq, and, or, lte, gte, isNull }) =>
      and(
        eq(taxSystems.countryCode, countryCode),
        lte(taxSystems.effectiveFrom, effectiveDateStr),
        or(
          isNull(taxSystems.effectiveTo),
          gte(taxSystems.effectiveTo, effectiveDateStr)
        )
      ),
  });

  if (!result) return null;

  return {
    id: result.id,
    countryCode: result.countryCode,
    name: result.name,
    displayName: result.displayName as Record<string, string>,
    calculationMethod: result.calculationMethod as TaxSystem['calculationMethod'],
    supportsFamilyDeductions: result.supportsFamilyDeductions,
    calculationBase: result.calculationBase as TaxSystem['calculationBase'],
    taxCalculationBase: result.taxCalculationBase as TaxSystem['taxCalculationBase'],
    retirementContributionLabel: result.retirementContributionLabel as Record<string, string>,
    healthContributionLabel: result.healthContributionLabel as Record<string, string>,
    incomeTaxLabel: result.incomeTaxLabel as Record<string, string>,
    effectiveFrom: new Date(result.effectiveFrom),
    effectiveTo: result.effectiveTo ? new Date(result.effectiveTo) : null,
    metadata: result.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Load tax brackets for a tax system
 *
 * Returns brackets ordered by bracket_order (ascending).
 * These define the progressive tax rates.
 */
async function loadTaxBrackets(taxSystemId: string): Promise<TaxBracket[]> {
  const results = await db.query.taxBrackets.findMany({
    where: (taxBrackets, { eq }) => eq(taxBrackets.taxSystemId, taxSystemId),
    orderBy: (taxBrackets, { asc }) => [asc(taxBrackets.bracketOrder)],
  });

  return results.map(row => ({
    id: row.id,
    taxSystemId: row.taxSystemId,
    bracketOrder: row.bracketOrder,
    minAmount: Number(row.minAmount),
    maxAmount: row.maxAmount ? Number(row.maxAmount) : null,
    rate: Number(row.rate),
    description: row.description as Record<string, string> | undefined,
  }));
}

/**
 * Load family deduction rules for a tax system
 *
 * Returns deduction amounts for each fiscal_parts value.
 * Used for calculating family-based tax deductions.
 */
async function loadFamilyDeductions(
  taxSystemId: string
): Promise<FamilyDeductionRule[]> {
  const results = await db.query.familyDeductionRules.findMany({
    where: (familyDeductionRules, { eq }) =>
      eq(familyDeductionRules.taxSystemId, taxSystemId),
    orderBy: (familyDeductionRules, { asc }) => [
      asc(familyDeductionRules.fiscalParts),
    ],
  });

  return results.map(row => ({
    id: row.id,
    taxSystemId: row.taxSystemId,
    fiscalParts: Number(row.fiscalParts),
    deductionAmount: Number(row.deductionAmount),
    description: row.description as Record<string, string> | undefined,
  }));
}

/**
 * Load social security scheme for a country
 */
async function loadSocialSecurityScheme(
  countryCode: string,
  effectiveDate: Date
): Promise<SocialSecurityScheme | null> {
  // Convert Date to ISO string for Drizzle/postgres-js compatibility
  const effectiveDateStr = effectiveDate.toISOString();

  const result = await db.query.socialSecuritySchemes.findFirst({
    where: (schemes, { eq, and, or, lte, gte, isNull }) =>
      and(
        eq(schemes.countryCode, countryCode),
        lte(schemes.effectiveFrom, effectiveDateStr),
        or(isNull(schemes.effectiveTo), gte(schemes.effectiveTo, effectiveDateStr))
      ),
  });

  if (!result) return null;

  return {
    id: result.id,
    countryCode: result.countryCode,
    agencyCode: result.agencyCode,
    agencyName: result.agencyName as Record<string, string>,
    defaultSectorCode: result.defaultSectorCode || 'SERVICES', // Provide fallback for null
    effectiveFrom: new Date(result.effectiveFrom),
    effectiveTo: result.effectiveTo ? new Date(result.effectiveTo) : null,
    metadata: result.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Load contribution types for a country's social security scheme
 */
async function loadContributions(
  countryCode: string,
  effectiveDate: Date
): Promise<ContributionType[]> {
  // First get the scheme
  const scheme = await loadSocialSecurityScheme(countryCode, effectiveDate);
  if (!scheme) return [];

  const results = await db.query.contributionTypes.findMany({
    where: (contributionTypes, { eq }) =>
      eq(contributionTypes.schemeId, scheme.id),
    orderBy: (contributionTypes, { asc }) => [
      asc(contributionTypes.displayOrder),
    ],
  });

  console.log('[DEBUG] Loaded contributions:', results.map(r => ({ code: r.code, fixedAmount: r.fixedAmount })));

  return results.map(row => ({
    id: row.id,
    schemeId: row.schemeId,
    code: row.code,
    name: row.name as Record<string, string>,
    employeeRate: row.employeeRate ? Number(row.employeeRate) : null,
    employerRate: row.employerRate ? Number(row.employerRate) : null,
    calculationBase: row.calculationBase as ContributionType['calculationBase'],
    ceilingAmount: row.ceilingAmount ? Number(row.ceilingAmount) : null,
    ceilingPeriod: row.ceilingPeriod as ContributionType['ceilingPeriod'],
    fixedAmount: row.fixedAmount ? Number(row.fixedAmount) : null,
    isVariableBySector: row.isVariableBySector,
    displayOrder: row.displayOrder,
  }));
}

/**
 * Load sector-specific contribution rate overrides
 */
async function loadSectorOverrides(
  countryCode: string,
  effectiveDate: Date
): Promise<SectorContributionOverride[]> {
  const contributions = await loadContributions(countryCode, effectiveDate);
  const contributionIds = contributions.map(c => c.id);

  if (contributionIds.length === 0) return [];

  const results = await db.query.sectorContributionOverrides.findMany({
    where: (overrides, { inArray }) =>
      inArray(overrides.contributionTypeId, contributionIds),
  });

  return results.map(row => ({
    id: row.id,
    contributionTypeId: row.contributionTypeId,
    sectorCode: row.sectorCode,
    sectorName: row.sectorName as Record<string, string>,
    employerRate: Number(row.employerRate),
    riskLevel: row.riskLevel as SectorContributionOverride['riskLevel'],
  }));
}

/**
 * Load other payroll taxes (FDFP, 3FPT, etc.)
 */
async function loadOtherTaxes(
  countryCode: string,
  effectiveDate: Date
): Promise<OtherTax[]> {
  // Convert Date to ISO string for Drizzle/postgres-js compatibility
  const effectiveDateStr = effectiveDate.toISOString();

  const results = await db.query.otherTaxes.findMany({
    where: (otherTaxes, { eq, and, or, lte, gte, isNull }) =>
      and(
        eq(otherTaxes.countryCode, countryCode),
        lte(otherTaxes.effectiveFrom, effectiveDateStr),
        or(
          isNull(otherTaxes.effectiveTo),
          gte(otherTaxes.effectiveTo, effectiveDateStr)
        )
      ),
  });

  return results.map(row => ({
    id: row.id,
    countryCode: row.countryCode,
    code: row.code,
    name: row.name as Record<string, string>,
    taxRate: Number(row.taxRate),
    calculationBase: row.calculationBase as OtherTax['calculationBase'],
    paidBy: row.paidBy as OtherTax['paidBy'],
    appliesToEmployeeType: row.appliesToEmployeeType as 'local' | 'expat' | null | undefined,
    effectiveFrom: new Date(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? new Date(row.effectiveTo) : null,
    metadata: row.metadata as Record<string, unknown> | undefined,
  }));
}

/**
 * Load salary component definitions
 */
async function loadSalaryComponents(
  countryCode: string
): Promise<SalaryComponentDefinition[]> {
  const results = await db.query.salaryComponentDefinitions.findMany({
    where: (components, { eq }) => eq(components.countryCode, countryCode),
    orderBy: (components, { asc }) => [asc(components.displayOrder)],
  });

  return results.map(row => ({
    id: row.id,
    countryCode: row.countryCode,
    code: row.code,
    name: row.name as Record<string, string>,
    category: row.category as SalaryComponentDefinition['category'],
    componentType: row.componentType,
    isTaxable: row.isTaxable,
    isSubjectToSocialSecurity: row.isSubjectToSocialSecurity,
    calculationMethod: row.calculationMethod as
      | SalaryComponentDefinition['calculationMethod']
      | undefined,
    defaultValue: row.defaultValue ? Number(row.defaultValue) : undefined,
    displayOrder: row.displayOrder,
    isCommon: row.isCommon,
    metadata: row.metadata as Record<string, unknown> | undefined,
  }));
}
