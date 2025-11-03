/**
 * Formula Loader Service
 *
 * Loads component metadata and calculation rules from database
 * Priority: Employee override > Tenant override > Standard definition
 *
 * This ensures formulas can be:
 * - Updated by super admin (standard components)
 * - Customized by tenant admin (tenant overrides)
 * - Customized per employee (employee overrides)
 *
 * VERSION SUPPORT:
 * - Can load historical formula versions by date
 * - Used for audit compliance and historical payroll accuracy
 */

import { db } from '@/lib/db';
import { salaryComponentDefinitions, salaryComponentTemplates } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import type { ComponentMetadata, CIComponentMetadata } from '@/features/employees/types/salary-components';
import { getActiveFormulaVersion } from './formula-version-service';
import type { ComponentType } from './formula-version-service';

// ============================================================================
// Types
// ============================================================================

export interface FormulaLoadOptions {
  componentCode: string;
  tenantId: string;
  employeeId?: string;
  countryCode?: string;
  /**
   * Date for which to load the formula (ISO format: YYYY-MM-DD)
   * If provided, loads the formula version that was active on this date
   * Used for historical payroll calculations and audits
   */
  asOfDate?: string;
}

export interface LoadedFormula {
  metadata: ComponentMetadata;
  source: 'employee-override' | 'custom-component' | 'standard-component' | 'hardcoded-default' | 'formula-version';
  sourceId?: string;
  versionNumber?: number;
}

// ============================================================================
// Main Loader Function
// ============================================================================

/**
 * Load formula metadata for a component
 *
 * Search order:
 * 1. Formula version history (if asOfDate provided) - historical formulas
 * 2. Custom component (tenant-specific) - if code starts with CUSTOM_
 * 3. Standard component (super admin seeded) - codes 11-41
 * 4. Hardcoded defaults (fallback only)
 *
 * @example
 * // Load current formula
 * const formula = await loadFormulaMetadata({
 *   componentCode: '21',
 *   tenantId: 'uuid',
 *   countryCode: 'CI'
 * });
 *
 * // Load historical formula (e.g., for audit or recalculating old payslip)
 * const historicalFormula = await loadFormulaMetadata({
 *   componentCode: '21',
 *   tenantId: 'uuid',
 *   countryCode: 'CI',
 *   asOfDate: '2024-06-15' // Get formula that was active on June 15, 2024
 * });
 */
export async function loadFormulaMetadata(
  options: FormulaLoadOptions
): Promise<LoadedFormula> {
  console.time(`[Formula Loader] Load ${options.componentCode}`);
  const loadStart = Date.now();

  const { componentCode, tenantId, countryCode, asOfDate } = options;

  // 0. If asOfDate provided, try loading from version history first
  if (asOfDate) {
    console.time(`[Formula Loader] Version history for ${componentCode}`);
    const historyStart = Date.now();
    const versionedFormula = await loadFormulaFromVersionHistory(
      componentCode,
      tenantId,
      countryCode,
      asOfDate
    );
    console.timeEnd(`[Formula Loader] Version history for ${componentCode}`);
    console.log(`[Formula Loader] Version history query: ${Date.now() - historyStart}ms`);
    if (versionedFormula) {
      console.log(`[Formula Loader] Total load time: ${Date.now() - loadStart}ms`);
      return versionedFormula;
    }
  }

  // 1. Check if this is a custom component (CUSTOM_XXX format)
  if (componentCode.startsWith('CUSTOM_')) {
    console.time(`[Formula Loader] Custom component ${componentCode}`);
    const customStart = Date.now();
    const customComponent = await loadCustomComponentMetadata(componentCode, tenantId);
    console.timeEnd(`[Formula Loader] Custom component ${componentCode}`);
    console.log(`[Formula Loader] Custom component query: ${Date.now() - customStart}ms`);
    if (customComponent) {
      console.log(`[Formula Loader] Total load time: ${Date.now() - loadStart}ms`);
      return {
        metadata: customComponent.metadata,
        source: 'custom-component',
        sourceId: customComponent.id,
      };
    }
  }

  // 2. Check standard component (codes 11-41)
  console.time(`[Formula Loader] Standard component ${componentCode}`);
  const standardStart = Date.now();
  const standardComponent = await loadStandardComponentMetadata(componentCode, countryCode);
  console.timeEnd(`[Formula Loader] Standard component ${componentCode}`);
  console.log(`[Formula Loader] Standard component query: ${Date.now() - standardStart}ms`);
  if (standardComponent) {
    console.log(`[Formula Loader] Total load time: ${Date.now() - loadStart}ms`);
    return {
      metadata: standardComponent.metadata,
      source: 'standard-component',
      sourceId: standardComponent.id,
    };
  }

  // 3. Fallback to hardcoded defaults
  console.log(`[Formula Loader] Using hardcoded default for ${componentCode}`);
  console.log(`[Formula Loader] Total load time: ${Date.now() - loadStart}ms`);
  return {
    metadata: getHardcodedDefaults(componentCode),
    source: 'hardcoded-default',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load formula from version history
 *
 * Used when asOfDate is provided to load historical formulas
 * Checks version history for both custom and standard components
 */
async function loadFormulaFromVersionHistory(
  componentCode: string,
  tenantId: string,
  countryCode: string | undefined,
  asOfDate: string
): Promise<LoadedFormula | null> {
  try {
    // First, determine component ID and type
    let componentId: string | undefined;
    let componentType: ComponentType | undefined;

    // Check if custom component
    if (componentCode.startsWith('CUSTOM_')) {
      const customComponent = await loadCustomComponentMetadata(componentCode, tenantId);
      if (customComponent) {
        componentId = customComponent.id;
        componentType = 'custom';
      }
    } else {
      // Check if standard component
      const standardComponent = await loadStandardComponentMetadata(componentCode, countryCode);
      if (standardComponent) {
        componentId = standardComponent.id;
        componentType = 'standard';
      }
    }

    // If we couldn't find the component, we can't load version history
    if (!componentId || !componentType) {
      return null;
    }

    // Load version from history
    const version = await getActiveFormulaVersion({
      componentId,
      componentType,
      asOfDate,
    });

    if (!version) {
      return null;
    }

    // Return formula from version history
    return {
      metadata: { calculationRule: version.calculationRule } as ComponentMetadata,
      source: 'formula-version',
      sourceId: version.id,
      versionNumber: version.versionNumber,
    };
  } catch (error) {
    console.error('Error loading formula from version history:', error);
    return null;
  }
}

/**
 * Load metadata from tenant_salary_component_activations
 *
 * NOTE: This function needs refactoring to use the new Option B architecture
 * with tenant_salary_component_activations instead of the deprecated
 * custom_salary_components table. For now, returns null to allow compilation.
 *
 * TODO: Implement proper tenant-specific component activation loading
 * See: docs/OPTION-B-ARCHITECTURE-SUMMARY.md
 */
async function loadCustomComponentMetadata(
  code: string,
  tenantId: string
): Promise<{ id: string; metadata: ComponentMetadata } | null> {
  // TODO: Implement loading from tenant_salary_component_activations
  // The custom_salary_components table was deprecated in favor of
  // tenant_salary_component_activations (see migration 20251007_cleanup_deprecated_custom_components.sql)

  console.warn(`[Formula Loader] Custom component loading not yet implemented for new architecture: ${code}`);
  return null;
}

/**
 * Load metadata from salary_component_definitions table
 */
async function loadStandardComponentMetadata(
  code: string,
  countryCode?: string
): Promise<{ id: string; metadata: ComponentMetadata } | null> {
  try {
    const conditions = [eq(salaryComponentDefinitions.code, code)];
    if (countryCode) {
      conditions.push(eq(salaryComponentDefinitions.countryCode, countryCode));
    }

    const [component] = await db
      .select({
        id: salaryComponentDefinitions.id,
        metadata: salaryComponentDefinitions.metadata,
      })
      .from(salaryComponentDefinitions)
      .where(and(...conditions))
      .limit(1);

    if (!component) return null;

    return {
      id: component.id,
      metadata: component.metadata as ComponentMetadata,
    };
  } catch (error) {
    console.error('Error loading standard component metadata:', error);
    return null;
  }
}

/**
 * Hardcoded defaults as ultimate fallback
 * These match the original implementation but should rarely be used
 */
function getHardcodedDefaults(componentCode: string): ComponentMetadata {
  // Seniority (Code 21)
  if (componentCode === '21') {
    return {
      taxTreatment: {
        isTaxable: true,
        includeInBrutImposable: true,
        includeInSalaireCategoriel: true,
      },
      socialSecurityTreatment: {
        includeInCnpsBase: true,
      },
      calculationRule: {
        type: 'auto-calculated',
        rate: 0.02, // 2% per year
        cap: 0.25, // Max 25%
      },
    } as CIComponentMetadata;
  }

  // Family Allowance (Code 41)
  if (componentCode === '41') {
    return {
      taxTreatment: {
        isTaxable: false,
        includeInBrutImposable: false,
        includeInSalaireCategoriel: false,
      },
      socialSecurityTreatment: {
        includeInCnpsBase: false,
      },
      calculationRule: {
        type: 'auto-calculated',
        rate: 4200, // 4,200 FCFA per dependent
        cap: 6, // Max 6 dependents
      },
    } as CIComponentMetadata;
  }

  // Default: taxable, included in all bases
  return {
    taxTreatment: {
      isTaxable: true,
      includeInBrutImposable: true,
      includeInSalaireCategoriel: false,
    },
    socialSecurityTreatment: {
      includeInCnpsBase: false,
    },
  } as CIComponentMetadata;
}

// ============================================================================
// Batch Loading (for performance)
// ============================================================================

/**
 * Load metadata for multiple components at once
 * More efficient than calling loadFormulaMetadata in a loop
 */
export async function loadMultipleFormulas(
  componentCodes: string[],
  tenantId: string,
  countryCode?: string
): Promise<Map<string, LoadedFormula>> {
  const results = new Map<string, LoadedFormula>();

  // Separate custom and standard codes
  const customCodes = componentCodes.filter((code) => code.startsWith('CUSTOM_'));
  const standardCodes = componentCodes.filter((code) => !code.startsWith('CUSTOM_'));

  // Batch load custom components
  // TODO: Implement loading from tenant_salary_component_activations
  // The custom_salary_components table was deprecated
  if (customCodes.length > 0) {
    console.warn(`[Formula Loader] Batch loading custom components not yet implemented for new architecture`);
    // For now, custom codes will fall through to hardcoded defaults
  }

  // Batch load standard components
  if (standardCodes.length > 0) {
    try {
      const conditions = countryCode
        ? [eq(salaryComponentDefinitions.countryCode, countryCode)]
        : [];

      const standardComponents = await db
        .select({
          code: salaryComponentDefinitions.code,
          id: salaryComponentDefinitions.id,
          metadata: salaryComponentDefinitions.metadata,
        })
        .from(salaryComponentDefinitions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      for (const component of standardComponents) {
        if (standardCodes.includes(component.code) && !results.has(component.code)) {
          results.set(component.code, {
            metadata: component.metadata as ComponentMetadata,
            source: 'standard-component',
            sourceId: component.id,
          });
        }
      }
    } catch (error) {
      console.error('Error batch loading standard components:', error);
    }
  }

  // Fill in defaults for any missing codes
  for (const code of componentCodes) {
    if (!results.has(code)) {
      results.set(code, {
        metadata: getHardcodedDefaults(code),
        source: 'hardcoded-default',
      });
    }
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get calculation rule from metadata
 * Handles different metadata types (CI, BF, SN, Generic)
 */
export function getCalculationRule(metadata: ComponentMetadata) {
  // CI metadata
  if ('calculationRule' in metadata) {
    return metadata.calculationRule;
  }

  // Generic metadata
  if ('calculationRule' in metadata) {
    return metadata.calculationRule;
  }

  return undefined;
}

/**
 * Check if component is auto-calculated
 */
export function isAutoCalculated(metadata: ComponentMetadata): boolean {
  const rule = getCalculationRule(metadata);
  return rule?.type === 'auto-calculated';
}

/**
 * Check if component is percentage-based
 */
export function isPercentageBased(metadata: ComponentMetadata): boolean {
  const rule = getCalculationRule(metadata);
  return rule?.type === 'percentage';
}

/**
 * Check if component is fixed amount
 */
export function isFixedAmount(metadata: ComponentMetadata): boolean {
  const rule = getCalculationRule(metadata);
  return rule?.type === 'fixed';
}
