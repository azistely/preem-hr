/**
 * Component Definition Cache
 *
 * Caches salary component definitions from the database for performance.
 * Implements TTL-based invalidation and manual cache clearing.
 *
 * Architecture:
 * - Level 1 (System): salary_component_definitions - base law/regulation
 * - Level 2 (Tenant): tenant_salary_component_activations.overrides - company policy
 * - Level 3 (Employee): employee_salaries.components - individual amounts
 *
 * This cache handles Level 1 + Level 2 merging.
 */

import { db } from '@/lib/db';
import { salaryComponentDefinitions } from '@/lib/db/schema';
import { tenantSalaryComponentActivations } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import type { ComponentDefinition, ComponentMetadata } from './types';

export class ComponentDefinitionCache {
  private cache: Map<string, ComponentDefinition>;
  private ttl: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get component definition from cache or database
   *
   * Implements 3-level architecture:
   * 1. Fetch system definition (salary_component_definitions)
   * 2. If tenantId provided, fetch tenant overrides (tenant_salary_component_activations.overrides)
   * 3. Merge: System + Tenant overrides
   *
   * @param code - Component code (e.g., '22', '34')
   * @param countryCode - Country code (e.g., 'CI', 'SN')
   * @param tenantId - Tenant ID (for tenant-specific overrides)
   * @param effectiveDate - Date for versioning (future use)
   * @returns Component definition (merged) or null if not found
   */
  async getDefinition(
    code: string,
    countryCode: string,
    tenantId?: string,
    effectiveDate?: Date
  ): Promise<ComponentDefinition | null> {
    // Cache key includes tenant for proper isolation
    const cacheKey = tenantId
      ? `${countryCode}:${code}:${tenantId}`
      : `${countryCode}:${code}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValid(cached)) {
      return cached;
    }

    // Fetch from database
    try {
      // Level 1: Fetch system definition
      const systemResults = await db
        .select()
        .from(salaryComponentDefinitions)
        .where(
          and(
            eq(salaryComponentDefinitions.countryCode, countryCode),
            eq(salaryComponentDefinitions.code, code)
          )
        )
        .limit(1);

      if (systemResults.length === 0) {
        return null;
      }

      const systemRow = systemResults[0];

      // Convert database row to ComponentDefinition (Level 1: System)
      let definition: ComponentDefinition = {
        id: systemRow.id,
        countryCode: systemRow.countryCode,
        code: systemRow.code,
        name: systemRow.name as Record<string, string>,
        category: systemRow.category,
        componentType: systemRow.componentType,
        isTaxable: systemRow.isTaxable,
        isSubjectToSocialSecurity: systemRow.isSubjectToSocialSecurity,
        calculationMethod: systemRow.calculationMethod ?? undefined,
        defaultValue: systemRow.defaultValue ?? null,
        displayOrder: systemRow.displayOrder,
        isCommon: systemRow.isCommon,
        metadata: systemRow.metadata as ComponentMetadata,
        createdAt: systemRow.createdAt,
        updatedAt: systemRow.updatedAt,
        cachedAt: Date.now(),
      };

      // Level 2: Apply tenant overrides (if tenantId provided)
      if (tenantId) {
        const tenantResults = await db
          .select()
          .from(tenantSalaryComponentActivations)
          .where(
            and(
              eq(tenantSalaryComponentActivations.tenantId, tenantId),
              eq(tenantSalaryComponentActivations.templateCode, code),
              eq(tenantSalaryComponentActivations.isActive, true)
            )
          )
          .limit(1);

        if (tenantResults.length > 0) {
          const tenantRow = tenantResults[0];
          const overrides = tenantRow.overrides as Record<string, any> | null;

          if (overrides && Object.keys(overrides).length > 0) {
            // Merge tenant overrides into system definition
            definition = this.mergeOverrides(definition, overrides);

            console.log(
              `[ComponentDefinitionCache] Applied tenant overrides for ${code} (tenant: ${tenantId}):`,
              overrides
            );
          }

          // Use custom name if provided
          if (tenantRow.customName) {
            definition.name = {
              ...definition.name,
              fr: tenantRow.customName,
            };
          }
        }
      }

      // Store in cache
      this.cache.set(cacheKey, definition);

      return definition;
    } catch (error) {
      console.error(`[ComponentDefinitionCache] Error fetching definition for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Merge tenant overrides into system definition
   *
   * Rules:
   * - Tenant can make caps MORE restrictive (lower values)
   * - Tenant can make components taxable (if exempt in system)
   * - Tenant CANNOT make components exempt (if taxable in system) - law takes precedence
   *
   * @param systemDefinition - Base definition from salary_component_definitions
   * @param overrides - Overrides from tenant_salary_component_activations.overrides
   * @returns Merged definition
   */
  private mergeOverrides(
    systemDefinition: ComponentDefinition,
    overrides: Record<string, any>
  ): ComponentDefinition {
    const merged = { ...systemDefinition };

    // Deep clone metadata to avoid mutations
    if (merged.metadata) {
      merged.metadata = JSON.parse(JSON.stringify(merged.metadata));
    }

    // Apply metadata overrides
    if (overrides.metadata && merged.metadata) {
      // Tax treatment overrides
      if (overrides.metadata.taxTreatment) {
        merged.metadata.taxTreatment = {
          ...merged.metadata.taxTreatment,
          ...overrides.metadata.taxTreatment,
        };

        // Validate exemption cap override (tenant can only make MORE restrictive)
        if (overrides.metadata.taxTreatment.exemptionCap) {
          const systemCap = systemDefinition.metadata?.taxTreatment?.exemptionCap;
          const tenantCap = overrides.metadata.taxTreatment.exemptionCap;

          // If system has no cap, tenant can add one
          // If system has a cap, tenant can only lower it
          if (systemCap && systemCap.type === 'fixed' && tenantCap.type === 'fixed') {
            if (tenantCap.value && systemCap.value && tenantCap.value > systemCap.value) {
              console.warn(
                `[ComponentDefinitionCache] Tenant tried to increase exemption cap for ${merged.code}. ` +
                `System: ${systemCap.value}, Tenant: ${tenantCap.value}. Using system value.`
              );
              // Revert to system value (tenant cannot be less restrictive)
              merged.metadata.taxTreatment.exemptionCap = systemCap;
            }
          }
        }
      }

      // Social security treatment overrides
      if (overrides.metadata.socialSecurityTreatment) {
        merged.metadata.socialSecurityTreatment = {
          ...merged.metadata.socialSecurityTreatment,
          ...overrides.metadata.socialSecurityTreatment,
        };
      }

      // Auto-calculate overrides
      if (overrides.metadata.autoCalculate) {
        merged.metadata.autoCalculate = {
          ...merged.metadata.autoCalculate,
          ...overrides.metadata.autoCalculate,
        };
      }
    }

    // Top-level field overrides (if tenant wants to change isTaxable, etc.)
    if (overrides.isTaxable !== undefined) {
      merged.isTaxable = overrides.isTaxable;
    }

    if (overrides.isSubjectToSocialSecurity !== undefined) {
      merged.isSubjectToSocialSecurity = overrides.isSubjectToSocialSecurity;
    }

    if (overrides.displayOrder !== undefined) {
      merged.displayOrder = overrides.displayOrder;
    }

    return merged;
  }

  /**
   * Check if cached definition is still valid
   *
   * @param definition - Cached component definition
   * @returns true if cache entry is still valid
   */
  private isValid(definition: ComponentDefinition): boolean {
    if (!definition.cachedAt) {
      return false;
    }

    const age = Date.now() - definition.cachedAt;
    return age < this.ttl;
  }

  /**
   * Invalidate cache for a specific component
   *
   * @param code - Component code
   * @param countryCode - Country code
   * @param tenantId - Optional tenant ID (if omitted, invalidates all tenant versions)
   */
  invalidate(code: string, countryCode: string, tenantId?: string): void {
    if (tenantId) {
      // Invalidate specific tenant version
      const cacheKey = `${countryCode}:${code}:${tenantId}`;
      this.cache.delete(cacheKey);
    } else {
      // Invalidate all versions (system + all tenants)
      const prefix = `${countryCode}:${code}`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear entire cache
   *
   * Use this when component definitions are updated in bulk.
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   *
   * @returns Cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const componentDefinitionCache = new ComponentDefinitionCache();
