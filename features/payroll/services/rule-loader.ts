/**
 * RuleLoader Service - Multi-Country Payroll Configuration Loader
 *
 * Loads country-specific payroll rules from the database for calculations.
 * Implements the Configuration Over Code principle.
 *
 * Source: docs/05-EPIC-PAYROLL.md Story 0.1
 */

import { db } from '@/lib/db';
import {
  countries,
  taxSystems,
  taxBrackets,
  familyDeductionRules,
  socialSecuritySchemes,
  contributionTypes,
  sectorContributionOverrides,
  otherTaxes,
  cityTransportMinimums,
} from '@/lib/db/schema';
import { and, eq, lte, gte, or, isNull, asc } from 'drizzle-orm';

// ========================================
// Types
// ========================================

export interface CountryConfig {
  country: {
    code: string;
    name: string;
    currency: string;
    minimumWage: number;
  };
  taxSystem: {
    id: string;
    code: string;
    name: string;
    calculationMethod: string;
    supportsFamilyDeductions: boolean;
    brackets: TaxBracket[];
    familyDeductions: FamilyDeduction[];
  };
  socialScheme: {
    id: string;
    code: string;
    name: string;
    salaryCeiling: number | null;
    contributionTypes: ContributionType[];
  };
  otherTaxes: OtherTax[];
}

export interface TaxBracket {
  id: string;
  bracketOrder: number;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  description: string | null;
}

export interface FamilyDeduction {
  id: string;
  fiscalParts: number;
  deductionAmount: number;
  description: any; // JSONB: { fr: string, en?: string }
}

export interface ContributionType {
  id: string;
  code: string;
  name: any; // JSONB: { fr: string, en?: string }
  employeeRate: number;
  employerRate: number;
  calculationBase: string;
  ceilingAmount: number | null;
  fixedAmount: number | null;
  sectorOverrides: SectorOverride[];
}

export interface SectorOverride {
  id: string;
  sectorCode: string;
  sectorName: any; // JSONB: { fr: string, en?: string }
  employerRate: number;
}

export interface OtherTax {
  id: string;
  code: string;
  name: any; // JSONB: { fr: string, en?: string }
  taxRate: number;
  calculationBase: string;
  paidBy: string;
  appliesToEmployeeType?: 'local' | 'expat' | null; // For ITS filtering
}

export interface CityTransportMinimum {
  id: string;
  cityName: string;
  displayName: any; // JSONB: { fr: string, en?: string }
  monthlyMinimum: number;
  dailyRate: number;
  taxExemptionCap: number | null;
  legalReference: any; // JSONB
}

// ========================================
// RuleLoader Class
// ========================================

export class RuleLoader {
  /**
   * Get tax system for a country on a specific date
   */
  async getTaxSystem(countryCode: string, effectiveDate: Date) {
    // Use db.select() instead of db.query.* to avoid relational query issues
    const dateStr = effectiveDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
    const [taxSystem] = await db
      .select()
      .from(taxSystems)
      .where(
        and(
          eq(taxSystems.countryCode, countryCode),
          lte(taxSystems.effectiveFrom, dateStr),
          or(
            isNull(taxSystems.effectiveTo),
            gte(taxSystems.effectiveTo, dateStr)
          )
        )
      )
      .limit(1);

    if (!taxSystem) {
      throw new Error(
        `No tax system found for country ${countryCode} on date ${effectiveDate.toISOString()}`
      );
    }

    // Load brackets separately
    const brackets = await db
      .select()
      .from(taxBrackets)
      .where(eq(taxBrackets.taxSystemId, taxSystem.id))
      .orderBy(asc(taxBrackets.bracketOrder));

    // Load family deductions separately
    const familyDeductions = await db
      .select()
      .from(familyDeductionRules)
      .where(eq(familyDeductionRules.taxSystemId, taxSystem.id));

    return {
      id: taxSystem.id,
      code: taxSystem.name, // name is the code (ITS, IRPP, etc.)
      name: typeof taxSystem.displayName === 'object' ? (taxSystem.displayName as any).fr : taxSystem.displayName,
      calculationMethod: taxSystem.calculationMethod,
      supportsFamilyDeductions: taxSystem.supportsFamilyDeductions,
      brackets: brackets.map((b) => ({
        id: b.id,
        bracketOrder: b.bracketOrder,
        minAmount: Number(b.minAmount),
        maxAmount: b.maxAmount ? Number(b.maxAmount) : null,
        rate: Number(b.rate),
        description: (b.description as string) || null,
      })),
      familyDeductions: familyDeductions.map((fd) => ({
        id: fd.id,
        fiscalParts: Number(fd.fiscalParts),
        deductionAmount: Number(fd.deductionAmount),
        description: fd.description,
      })),
    };
  }

  /**
   * Get social security scheme for a country on a specific date
   */
  async getSocialScheme(countryCode: string, effectiveDate: Date) {
    // Use db.select() instead of db.query.* to avoid relational query issues
    const dateStr = effectiveDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
    const [scheme] = await db
      .select()
      .from(socialSecuritySchemes)
      .where(
        and(
          eq(socialSecuritySchemes.countryCode, countryCode),
          lte(socialSecuritySchemes.effectiveFrom, dateStr),
          or(
            isNull(socialSecuritySchemes.effectiveTo),
            gte(socialSecuritySchemes.effectiveTo, dateStr)
          )
        )
      )
      .limit(1);

    if (!scheme) {
      throw new Error(
        `No social security scheme found for country ${countryCode} on date ${effectiveDate.toISOString()}`
      );
    }

    // Load contribution types separately
    const contribTypes = await db
      .select()
      .from(contributionTypes)
      .where(eq(contributionTypes.schemeId, scheme.id));

    // Load sector overrides for all contribution types
    const overrides = await db
      .select()
      .from(sectorContributionOverrides)
      .where(
        eq(
          sectorContributionOverrides.contributionTypeId,
          contribTypes.length > 0 ? contribTypes[0].id : ''
        )
      );

    const agencyName = scheme.agencyName as { fr: string; en?: string };

    return {
      id: scheme.id,
      code: scheme.agencyCode,
      name: agencyName.fr,
      salaryCeiling: null, // Field doesn't exist in new schema
      contributionTypes: contribTypes.map((ct) => {
        const ctName = ct.name as { fr: string; en?: string };
        const ctOverrides = overrides.filter((o) => o.contributionTypeId === ct.id);
        return {
          id: ct.id,
          code: ct.code,
          name: ctName,
          employeeRate: ct.employeeRate ? Number(ct.employeeRate) : 0,
          employerRate: ct.employerRate ? Number(ct.employerRate) : 0,
          calculationBase: ct.calculationBase,
          ceilingAmount: ct.ceilingAmount ? Number(ct.ceilingAmount) : null,
          fixedAmount: ct.fixedAmount ? Number(ct.fixedAmount) : null,
          sectorOverrides: ctOverrides.map((so) => ({
            id: so.id,
            sectorCode: so.sectorCode,
            sectorName: so.sectorName,
            employerRate: Number(so.employerRate),
          })),
        };
      }),
    };
  }

  /**
   * Get other taxes (training, development, etc.) for a country on a specific date
   */
  async getOtherTaxes(countryCode: string, effectiveDate: Date) {
    // Use db.select() instead of db.query.* to avoid relational query issues
    const dateStr = effectiveDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
    const taxes = await db
      .select()
      .from(otherTaxes)
      .where(
        and(
          eq(otherTaxes.countryCode, countryCode),
          lte(otherTaxes.effectiveFrom, dateStr),
          or(
            isNull(otherTaxes.effectiveTo),
            gte(otherTaxes.effectiveTo, dateStr)
          )
        )
      );

    // DEBUG: Log raw database values
    console.log('🔍 [RULE LOADER] Raw taxes from database:', taxes.map(t => ({
      code: t.code,
      appliesToEmployeeType: t.appliesToEmployeeType,
      appliesToEmployeeTypeType: typeof t.appliesToEmployeeType
    })));

    return taxes.map((tax) => ({
      id: tax.id,
      code: tax.code,
      name: tax.name,
      taxRate: Number(tax.taxRate),
      calculationBase: tax.calculationBase,
      paidBy: tax.paidBy,
      appliesToEmployeeType: tax.appliesToEmployeeType as 'local' | 'expat' | null | undefined, // For ITS filtering (local vs expat)
    }));
  }

  /**
   * Get complete country configuration for payroll calculations
   *
   * This is the main entry point for loading all country-specific rules.
   */
  async getCountryConfig(
    countryCode: string,
    effectiveDate: Date = new Date()
  ): Promise<CountryConfig> {
    // Load country using db.select() to avoid relational query issues
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(countries.code, countryCode))
      .limit(1);

    if (!country) {
      throw new Error(`Country ${countryCode} not found in database`);
    }

    // Load all other configuration in parallel
    const [taxSystem, socialScheme, otherTaxesList] = await Promise.all([
      this.getTaxSystem(countryCode, effectiveDate),
      this.getSocialScheme(countryCode, effectiveDate),
      this.getOtherTaxes(countryCode, effectiveDate),
    ]);

    const countryName = country.name as { fr: string; en?: string };

    return {
      country: {
        code: country.code,
        name: countryName.fr,
        currency: country.currencyCode,
        minimumWage: 75000, // TODO: Load from minimum_wage table or metadata
      },
      taxSystem,
      socialScheme,
      otherTaxes: otherTaxesList,
    };
  }

  /**
   * Get contribution type by code
   */
  async getContributionType(
    countryCode: string,
    contributionCode: string,
    effectiveDate: Date = new Date()
  ) {
    const scheme = await this.getSocialScheme(countryCode, effectiveDate);
    const contribution = scheme.contributionTypes.find((ct) => ct.code === contributionCode);

    if (!contribution) {
      throw new Error(
        `Contribution type ${contributionCode} not found for country ${countryCode}`
      );
    }

    return contribution;
  }

  /**
   * Get sector-specific rate for a contribution type
   */
  getSectorRate(contribution: ContributionType, sectorCode: string, rateType: 'employee' | 'employer'): number {
    const override = contribution.sectorOverrides.find((so) => so.sectorCode === sectorCode);

    if (override) {
      // Sector overrides only apply to employer rates
      if (rateType === 'employer' && override.employerRate !== null) {
        return override.employerRate;
      }
    }

    return rateType === 'employee' ? contribution.employeeRate : contribution.employerRate;
  }

  /**
   * Get salary ceiling for a contribution type
   */
  getSalaryCeiling(contribution: ContributionType, schemeCeiling: number | null): number | null {
    // Contribution-specific ceiling takes precedence
    if (contribution.ceilingAmount !== null) {
      return contribution.ceilingAmount;
    }

    // Fall back to scheme-wide ceiling
    return schemeCeiling;
  }

  /**
   * Get city transport minimums for a country
   */
  async getCityTransportMinimums(
    countryCode: string,
    effectiveDate: Date = new Date()
  ): Promise<CityTransportMinimum[]> {
    const dateStr = effectiveDate.toISOString().split('T')[0];

    const minimums = await db
      .select()
      .from(cityTransportMinimums)
      .where(
        and(
          eq(cityTransportMinimums.countryCode, countryCode),
          lte(cityTransportMinimums.effectiveFrom, dateStr),
          or(
            isNull(cityTransportMinimums.effectiveTo),
            gte(cityTransportMinimums.effectiveTo, dateStr)
          )
        )
      );

    return minimums.map((m) => ({
      id: m.id,
      cityName: m.cityName,
      displayName: m.displayName,
      monthlyMinimum: Number(m.monthlyMinimum),
      dailyRate: Number(m.dailyRate),
      taxExemptionCap: m.taxExemptionCap ? Number(m.taxExemptionCap) : null,
      legalReference: m.legalReference,
    }));
  }

  /**
   * Get transport minimum for a specific city
   */
  async getCityTransportMinimum(
    countryCode: string,
    cityName: string | null | undefined,
    effectiveDate: Date = new Date()
  ): Promise<CityTransportMinimum> {
    const minimums = await this.getCityTransportMinimums(countryCode, effectiveDate);

    if (!minimums || minimums.length === 0) {
      throw new Error(
        `No transport minimums configured for country ${countryCode}`
      );
    }

    // If no city provided, return default (OTHER)
    if (!cityName) {
      const defaultMinimum = minimums.find(
        (m) => m.cityName.toUpperCase() === 'OTHER'
      );
      if (defaultMinimum) return defaultMinimum;
      // Fall back to first minimum if OTHER doesn't exist
      return minimums[0];
    }

    // Normalize city name for matching
    const normalized = cityName.toLowerCase().trim();

    // Try exact match
    const match = minimums.find(
      (m) => m.cityName.toLowerCase() === normalized
    );

    if (match) return match;

    // Return default (OTHER) as fallback
    const defaultMinimum = minimums.find(
      (m) => m.cityName.toUpperCase() === 'OTHER'
    );
    if (defaultMinimum) return defaultMinimum;

    // If still no match, return first minimum
    return minimums[0];
  }
}

// ========================================
// Singleton Instance
// ========================================

export const ruleLoader = new RuleLoader();
