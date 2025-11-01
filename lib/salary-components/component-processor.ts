/**
 * Component Processor
 *
 * Central service for metadata-driven salary component processing.
 * Applies exemption caps, validates components, and builds audit trail.
 */

import { db } from '@/lib/db';
import { cityTransportMinimums } from '@/lib/db/schema';
import { and, eq, lte, desc } from 'drizzle-orm';
import type { ComponentDefinitionCache } from './component-definition-cache';
import type {
  ComponentProcessingContext,
  ProcessedComponent,
  ExemptionCap,
  CapAppliedInfo,
  CityTransportMinimum,
} from './types';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

export class ComponentProcessor {
  constructor(private cache: ComponentDefinitionCache) {}

  /**
   * Process a single component with metadata-driven rules
   *
   * @param component - Component instance with code and amount
   * @param context - Processing context (salary, location, date, tenantId)
   * @returns Processed component with tax treatment applied
   */
  async processComponent(
    component: SalaryComponentInstance,
    context: ComponentProcessingContext
  ): Promise<ProcessedComponent> {
    // 1. Fetch component definition from database (with caching)
    // This now includes tenant overrides if tenantId is provided
    const definition = await this.cache.getDefinition(
      component.code,
      context.countryCode,
      context.tenantId,
      context.effectiveDate
    );

    if (!definition) {
      // In preview mode (hiring flow), use safe defaults for unknown components
      // This allows preview to work before components are activated
      if (context.isPreview) {
        return this.getPreviewDefaultComponent(component);
      }

      throw new Error(
        `Component ${component.code} not found for country ${context.countryCode}`
      );
    }

    // 2. Extract metadata (with defaults)
    const taxTreatment = definition.metadata?.taxTreatment ?? {
      isTaxable: true,
      includeInBrutImposable: true,
      includeInSalaireCategoriel: false,
    };

    const ssTreatment = definition.metadata?.socialSecurityTreatment ?? {
      includeInCnpsBase: true,
    };

    // 3. Apply exemption cap (if defined)
    const capResult = await this.applyExemptionCap(
      component,
      taxTreatment.exemptionCap,
      context
    );

    // 4. Validate against rules
    const validation = await this.validateComponent(
      component,
      definition,
      context
    );

    // 5. Return processed component
    return {
      code: component.code,
      name: component.name,
      originalAmount: component.amount,
      exemptPortion: capResult.exemptPortion,
      taxablePortion: capResult.taxablePortion,
      includeInBrutImposable: taxTreatment.includeInBrutImposable,
      includeInSalaireCategoriel: taxTreatment.includeInSalaireCategoriel,
      includeInCnpsBase: ssTreatment.includeInCnpsBase,
      includeInIpresBase: ssTreatment.includeInIpresBase ?? false,
      capApplied: capResult.capApplied,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  /**
   * Apply exemption cap based on metadata
   *
   * Handles three types of caps:
   * - fixed: Fixed amount (e.g., 30,000 FCFA)
   * - percentage: Percentage of total remuneration or base salary
   * - city_based: Cap varies by city (loaded from database)
   *
   * @param component - Component instance
   * @param exemptionCap - Exemption cap metadata
   * @param context - Processing context
   * @returns Cap application result with exempt/taxable portions
   */
  private async applyExemptionCap(
    component: SalaryComponentInstance,
    exemptionCap: ExemptionCap | undefined,
    context: ComponentProcessingContext
  ): Promise<{
    exemptPortion: number;
    taxablePortion: number;
    capApplied?: CapAppliedInfo;
  }> {
    // No cap defined → fully taxable
    if (!exemptionCap) {
      return {
        exemptPortion: 0,
        taxablePortion: component.amount,
      };
    }

    let capValue: number;
    let calculatedFrom: string;

    switch (exemptionCap.type) {
      case 'fixed':
        capValue = exemptionCap.value ?? 0;
        calculatedFrom = 'fixed_amount';
        break;

      case 'percentage': {
        const base =
          exemptionCap.appliesTo === 'total_remuneration'
            ? context.totalRemuneration
            : context.baseSalary;
        capValue = Math.round(base * (exemptionCap.value ?? 0));
        calculatedFrom = `${exemptionCap.appliesTo}: ${base.toLocaleString('fr-FR')} FCFA × ${((exemptionCap.value ?? 0) * 100).toFixed(0)}%`;
        break;
      }

      case 'city_based': {
        if (context.city && exemptionCap.cityTable) {
          const cityRule = await this.getCityTransportMinimum(
            context.countryCode,
            context.city,
            context.effectiveDate
          );

          if (cityRule) {
            capValue = cityRule.taxExemptionCap;
            calculatedFrom = `city: ${context.city}`;
          } else {
            capValue = exemptionCap.fallbackValue ?? 0;
            calculatedFrom = 'fallback_value (city not found)';
          }
        } else {
          capValue = exemptionCap.fallbackValue ?? 0;
          calculatedFrom = 'fallback_value (no city specified)';
        }
        break;
      }

      default: {
        // Type guard to ensure exhaustive check
        const _exhaustiveCheck: never = exemptionCap;
        capValue = 0;
        calculatedFrom = 'unknown';
        break;
      }
    }

    // Apply cap
    if (component.amount <= capValue) {
      // Fully exempt
      return {
        exemptPortion: component.amount,
        taxablePortion: 0,
      };
    } else {
      // Partially exempt (cap applies)
      return {
        exemptPortion: capValue,
        taxablePortion: component.amount - capValue,
        capApplied: {
          type: exemptionCap.type,
          capValue,
          calculatedFrom,
          reason: `Exonéré jusqu'à ${capValue.toLocaleString('fr-FR')} FCFA (${calculatedFrom})`,
        },
      };
    }
  }

  /**
   * Validate component against business rules
   *
   * @param component - Component instance
   * @param definition - Component definition from database
   * @param context - Processing context
   * @returns Validation errors and warnings
   */
  private async validateComponent(
    component: SalaryComponentInstance,
    definition: any,
    context: ComponentProcessingContext
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check transport minimum (Code 22)
    if (component.code === '22' && context.city) {
      // Check if this is a non-monthly worker (DAILY, WEEKLY, BIWEEKLY)
      const isNonMonthlyWorker =
        context.paymentFrequency &&
        ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(context.paymentFrequency);

      if (isNonMonthlyWorker) {
        // For non-monthly workers, skip monthly minimum validation
        // They receive prorated amounts based on hours worked
        console.log(
          `[ComponentProcessor] Skipping monthly minimum check for ${context.paymentFrequency} worker - prorated amount is valid`
        );
      } else {
        // Monthly workers - validate against monthly minimum
        try {
          const cityMin = await this.getCityTransportMinimum(
            context.countryCode,
            context.city,
            context.effectiveDate
          );

          if (cityMin && component.amount < cityMin.monthlyMinimum) {
            errors.push(
              `Transport ${component.amount.toLocaleString('fr-FR')} FCFA est inférieur au minimum légal de ${context.city} (${cityMin.monthlyMinimum.toLocaleString('fr-FR')} FCFA)`
            );
          }
        } catch (error) {
          // City minimum not configured - log warning but don't fail
          console.warn(
            `[ComponentProcessor] City minimum not found for ${context.city}, skipping validation`
          );
        }
      }
    }

    // Check maximum value (if defined in metadata)
    if (definition.metadata?.maxValue && component.amount > definition.metadata.maxValue) {
      warnings.push(
        `Montant ${component.amount.toLocaleString('fr-FR')} FCFA dépasse le maximum suggéré (${definition.metadata.maxValue.toLocaleString('fr-FR')} FCFA)`
      );
    }

    return { errors, warnings };
  }

  /**
   * Get city transport minimum from database
   *
   * @param countryCode - Country code
   * @param cityName - City name
   * @param effectiveDate - Date for versioning
   * @returns City transport minimum or null if not found
   */
  private async getCityTransportMinimum(
    countryCode: string,
    cityName: string,
    effectiveDate: Date
  ): Promise<CityTransportMinimum | null> {
    try {
      const effectiveDateStr = effectiveDate.toISOString().split('T')[0];

      const results = await db
        .select()
        .from(cityTransportMinimums)
        .where(
          and(
            eq(cityTransportMinimums.countryCode, countryCode),
            eq(cityTransportMinimums.cityName, cityName),
            lte(cityTransportMinimums.effectiveFrom, effectiveDateStr)
          )
        )
        .orderBy(desc(cityTransportMinimums.effectiveFrom))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const row = results[0];

      return {
        id: row.id,
        countryCode: row.countryCode,
        cityName: row.cityName,
        cityNameNormalized: row.cityNameNormalized,
        displayName: row.displayName as Record<string, string>,
        monthlyMinimum: Number(row.monthlyMinimum),
        dailyRate: Number(row.dailyRate),
        taxExemptionCap: Number(row.taxExemptionCap),
        effectiveFrom: new Date(row.effectiveFrom),
        legalReference: row.legalReference as Record<string, string> | undefined,
      };
    } catch (error) {
      console.error(
        `[ComponentProcessor] Error fetching city transport minimum:`,
        error
      );
      return null;
    }
  }

  /**
   * Get safe default for unknown component in preview mode
   *
   * Used during hiring flow when components haven't been activated yet.
   * Returns a component with conservative assumptions (fully taxable, subject to SS).
   *
   * @param component - Component instance
   * @returns Processed component with safe defaults
   */
  private getPreviewDefaultComponent(component: SalaryComponentInstance): ProcessedComponent {
    return {
      code: component.code,
      name: component.name,
      originalAmount: component.amount,
      exemptPortion: 0, // Conservative: assume fully taxable
      taxablePortion: component.amount,
      includeInBrutImposable: true, // Conservative: include in taxable base
      includeInSalaireCategoriel: false, // Safe: only base salary components should be true
      includeInCnpsBase: true, // Conservative: assume subject to social security
      includeInIpresBase: false,
      errors: [],
      warnings: ['Composant non configuré - utilisation de valeurs par défaut pour l\'aperçu'],
    };
  }

  /**
   * Process multiple components in batch
   *
   * @param components - Array of component instances
   * @param context - Processing context
   * @returns Array of processed components
   */
  async processComponents(
    components: SalaryComponentInstance[],
    context: ComponentProcessingContext
  ): Promise<ProcessedComponent[]> {
    return Promise.all(
      components.map((component) => this.processComponent(component, context))
    );
  }
}
