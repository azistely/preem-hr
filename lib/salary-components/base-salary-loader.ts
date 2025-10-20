/**
 * Base Salary Component Loader
 *
 * Database-driven, multi-country helper for base salary component handling.
 * Determines which components make up "base salary" per country via metadata.
 *
 * For CI: Returns [Code 11, Code 12]
 * For SN: Returns whatever is configured (TBD)
 * For other countries: Returns their configured base components
 */

import { db } from '@/lib/db';
import { salaryComponentDefinitions } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface BaseSalaryComponent {
  code: string;
  name: {
    fr: string;
    en: string;
  };
  order: number;
  label: {
    fr: string;
    en: string;
  };
  description: {
    fr: string;
    en: string;
  };
  isOptional: boolean;
  defaultValue?: number;
  metadata: Record<string, any>;
}

/**
 * Get base salary components for a country
 *
 * Loads components marked with metadata.isBaseComponent = true
 * Returns them sorted by metadata.baseComponentOrder
 *
 * @param countryCode - ISO country code (CI, SN, etc.)
 * @returns Array of base salary components in display order
 *
 * @example
 * // For CI:
 * const components = await getBaseSalaryComponents('CI');
 * // Returns: [
 * //   { code: '11', name: {fr: 'Salaire catégoriel'}, order: 1, isOptional: false },
 * //   { code: '12', name: {fr: 'Sursalaire'}, order: 2, isOptional: true, defaultValue: 0 }
 * // ]
 */
export async function getBaseSalaryComponents(
  countryCode: string
): Promise<BaseSalaryComponent[]> {
  // Query database for components with isBaseComponent = true
  const components = await db
    .select()
    .from(salaryComponentDefinitions)
    .where(
      and(
        eq(salaryComponentDefinitions.countryCode, countryCode),
        sql`${salaryComponentDefinitions.metadata}->>'isBaseComponent' = 'true'`
      )
    );

  // Map to structured format and sort by order
  const baseComponents = components
    .map(c => {
      const metadata = c.metadata as any || {};
      return {
        code: c.code,
        name: c.name as { fr: string; en: string },
        order: (metadata.baseComponentOrder as number) || 999,
        label: (metadata.baseComponentLabel as { fr: string; en: string }) || c.name as { fr: string; en: string },
        description: (metadata.baseComponentDescription as { fr: string; en: string }) || { fr: '', en: '' },
        isOptional: (metadata.isOptional as boolean) || false,
        defaultValue: metadata.defaultValue as number | undefined,
        metadata: metadata as Record<string, any>,
      };
    })
    .sort((a, b) => a.order - b.order);

  return baseComponents;
}

/**
 * Extract base salary component amounts from components array
 *
 * @param components - Array of salary component instances
 * @param countryCode - ISO country code
 * @returns Object with base component amounts by code
 *
 * @example
 * const amounts = await extractBaseSalaryAmounts([
 *   { code: '11', amount: 75000 },
 *   { code: '22', amount: 30000 }
 * ], 'CI');
 * // Returns: { '11': 75000 }
 */
export async function extractBaseSalaryAmounts(
  components: Array<{ code: string; amount: number }>,
  countryCode: string
): Promise<Record<string, number>> {
  const baseComponents = await getBaseSalaryComponents(countryCode);
  const baseCodes = new Set(baseComponents.map(c => c.code));

  const amounts: Record<string, number> = {};

  for (const component of components) {
    if (baseCodes.has(component.code)) {
      amounts[component.code] = component.amount;
    }
  }

  return amounts;
}

/**
 * Calculate total base salary from components
 *
 * For CI: sum of Code 11 + Code 12
 * For other countries: sum of their base components
 *
 * @param components - Array of salary component instances
 * @param countryCode - ISO country code
 * @returns Total base salary amount
 *
 * @example
 * const total = await calculateBaseSalaryTotal([
 *   { code: '11', amount: 75000 },
 *   { code: '12', amount: 25000 },
 *   { code: '22', amount: 30000 }
 * ], 'CI');
 * // Returns: 100000 (75000 + 25000, ignoring Code 22)
 */
export async function calculateBaseSalaryTotal(
  components: Array<{ code: string; amount: number }>,
  countryCode: string
): Promise<number> {
  const amounts = await extractBaseSalaryAmounts(components, countryCode);
  return Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
}

/**
 * Build base salary components array from form inputs
 *
 * @param inputs - Object with component code as key, amount as value
 * @param countryCode - ISO country code
 * @returns Array of component instances ready for database
 *
 * @example
 * const components = await buildBaseSalaryComponents(
 *   { '11': 75000, '12': 0 },
 *   'CI'
 * );
 * // Returns: [
 * //   { code: '11', name: 'Salaire catégoriel', amount: 75000, sourceType: 'standard' },
 * //   // Code 12 omitted because optional and amount = 0
 * // ]
 */
export async function buildBaseSalaryComponents(
  inputs: Record<string, number>,
  countryCode: string
): Promise<Array<{
  code: string;
  name: string;
  amount: number;
  sourceType: string;
  metadata?: Record<string, any>;
}>> {
  const baseComponents = await getBaseSalaryComponents(countryCode);
  const result = [];

  for (const component of baseComponents) {
    const amount = inputs[component.code] ?? component.defaultValue ?? 0;

    // Skip optional components with 0 amount
    if (component.isOptional && amount === 0) {
      continue;
    }

    result.push({
      code: component.code,
      name: component.name.fr,
      amount,
      sourceType: 'standard',
      metadata: component.metadata,
    });
  }

  return result;
}

/**
 * Get salaireCategoriel amount (Code 11 or equivalent)
 *
 * For CI: Returns Code 11 amount
 * For other countries: Returns amount of component with is_base_for_cnps_family = true
 *
 * @param components - Array of salary component instances
 * @param countryCode - ISO country code
 * @param fallbackToTotal - If true, falls back to total base salary if not found
 * @returns Amount to use for CNPS family/accident calculations
 *
 * @example
 * const salaireCategoriel = await getSalaireCategoriel([
 *   { code: '11', amount: 75000 },
 *   { code: '12', amount: 25000 }
 * ], 'CI');
 * // Returns: 75000
 */
export async function getSalaireCategoriel(
  components: Array<{ code: string; amount: number }>,
  countryCode: string,
  fallbackToTotal: boolean = true
): Promise<number> {
  // First, try to find component with is_base_for_cnps_family metadata
  const baseComponents = await getBaseSalaryComponents(countryCode);

  for (const baseComp of baseComponents) {
    const metadata = baseComp.metadata as any || {};
    if (metadata.is_base_for_cnps_family === true) {
      const found = components.find(c => c.code === baseComp.code);
      if (found) {
        return found.amount;
      }
    }
  }

  // Fallback to total base salary
  if (fallbackToTotal) {
    return await calculateBaseSalaryTotal(components, countryCode);
  }

  return 0;
}
