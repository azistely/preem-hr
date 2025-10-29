/**
 * Component Metadata Loader
 *
 * Loads salary component metadata from database (single source of truth).
 * Replaces hardcoded getSmartDefaults() function.
 *
 * Architecture:
 * - Query salary_component_definitions table
 * - Support both official codes (11, 12, 21, 22) and template codes (TPT_TRANSPORT_CI)
 * - Return authoritative metadata for payroll calculations
 */

import { db } from '@/lib/db';
import { salaryComponentDefinitions } from '@/drizzle/schema';
import { eq, and, or } from 'drizzle-orm';
import type { ComponentMetadata } from '@/features/employees/types/salary-components';

export interface ComponentLoaderResult {
  code: string;
  templateCode: string | null;
  name: Record<string, string>;
  countryCode: string;
  category: string;
  componentType: string;
  isTaxable: boolean;
  isSubjectToSocialSecurity: boolean;
  metadata: ComponentMetadata;
}

/**
 * Get component metadata from database by code or template code
 *
 * @param countryCode - Country code (CI, BF, SN, etc.)
 * @param codeOrTemplateCode - Official code (22, 21) or template code (TPT_TRANSPORT_CI)
 * @returns Component metadata from database
 * @throws Error if component not found
 */
export async function getComponentMetadata(
  countryCode: string,
  codeOrTemplateCode: string
): Promise<ComponentLoaderResult> {
  const [component] = await db
    .select()
    .from(salaryComponentDefinitions)
    .where(
      and(
        eq(salaryComponentDefinitions.countryCode, countryCode),
        or(
          eq(salaryComponentDefinitions.code, codeOrTemplateCode),
          eq(salaryComponentDefinitions.templateCode, codeOrTemplateCode)
        )
      )
    )
    .limit(1);

  if (!component) {
    throw new Error(
      `Component ${codeOrTemplateCode} not found for country ${countryCode}. ` +
        `Please ensure component is seeded in salary_component_definitions table.`
    );
  }

  return {
    code: component.code,
    templateCode: component.templateCode,
    name: component.name as Record<string, string>,
    countryCode: component.countryCode,
    category: component.category,
    componentType: component.componentType,
    isTaxable: component.isTaxable,
    isSubjectToSocialSecurity: component.isSubjectToSocialSecurity,
    metadata: component.metadata as ComponentMetadata,
  };
}

/**
 * Get multiple component metadatas in batch
 *
 * @param countryCode - Country code
 * @param codes - Array of codes or template codes
 * @returns Array of component metadatas
 */
export async function getComponentMetadataBatch(
  countryCode: string,
  codes: string[]
): Promise<ComponentLoaderResult[]> {
  const results: ComponentLoaderResult[] = [];

  for (const code of codes) {
    try {
      const component = await getComponentMetadata(countryCode, code);
      results.push(component);
    } catch (error) {
      console.error(`Failed to load component ${code}:`, error);
      // Skip missing components but continue processing others
    }
  }

  return results;
}

/**
 * Get popular components for a country (for UI dropdowns)
 *
 * @param countryCode - Country code
 * @returns Array of popular components sorted by display_order
 */
export async function getPopularComponents(
  countryCode: string
): Promise<ComponentLoaderResult[]> {
  const components = await db
    .select()
    .from(salaryComponentDefinitions)
    .where(
      and(
        eq(salaryComponentDefinitions.countryCode, countryCode),
        eq(salaryComponentDefinitions.isPopular, true)
      )
    )
    .orderBy(salaryComponentDefinitions.displayOrder);

  return components.map((c) => ({
    code: c.code,
    templateCode: c.templateCode,
    name: c.name as Record<string, string>,
    countryCode: c.countryCode,
    category: c.category,
    componentType: c.componentType,
    isTaxable: c.isTaxable,
    isSubjectToSocialSecurity: c.isSubjectToSocialSecurity,
    metadata: c.metadata as ComponentMetadata,
  }));
}
