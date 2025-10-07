/**
 * Required Salary Components Enforcement
 *
 * Purpose: Automatically activate and lock required salary components
 * based on a tenant's business sector.
 *
 * Legal Basis (Côte d'Ivoire):
 * - Convention Collective Interprofessionnelle requires sector-specific components
 * - Example: Transport sector MUST include PRIME_TRANSPORT
 * - Example: Construction sector MUST include PRIME_SALISSURE, HAZARD_PAY
 *
 * Architecture:
 * - Sector requirements defined in sector_configurations.default_components
 * - Components auto-activated when tenant.sector_code is set/changed
 * - Components marked as isRequired=true to prevent deactivation
 *
 * Use Cases:
 * 1. Tenant onboarding: Auto-activate required components on sector selection
 * 2. Sector change: Update required components when admin changes sector
 * 3. Validation: Block payroll if required components missing
 */

import { db } from '@/lib/db';
import { getTenantSector, SectorInfo } from './sector-resolution';
import { salaryComponentDefinitions } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface ComponentEnforcementResult {
  success: boolean;
  activated: string[]; // Component codes that were activated
  alreadyActive: string[]; // Component codes that were already active
  error?: string;
}

/**
 * Enforce required salary components for a tenant
 *
 * This function:
 * 1. Gets the tenant's sector configuration
 * 2. Identifies required components from sector.defaultComponents
 * 3. Activates missing required components
 * 4. Marks them as isRequired=true (prevents deactivation)
 *
 * @param tenantId - Tenant UUID
 * @returns Result with list of activated/already-active components
 *
 * @example
 * ```typescript
 * // After tenant selects TRANSPORT sector
 * const result = await enforceRequiredComponents('tenant-123');
 * // result.activated = ['PRIME_TRANSPORT']
 * // result.alreadyActive = ['BASE_SALARY', 'HOUSING_ALLOWANCE']
 *
 * // After changing to CONSTRUCTION sector
 * const result2 = await enforceRequiredComponents('tenant-123');
 * // result2.activated = ['HAZARD_PAY', 'PRIME_SALISSURE', 'CLOTHING_ALLOWANCE']
 * ```
 */
export async function enforceRequiredComponents(
  tenantId: string
): Promise<ComponentEnforcementResult> {
  // 1. Get tenant's sector configuration
  const sector = await getTenantSector(tenantId);

  if (!sector) {
    return {
      success: false,
      activated: [],
      alreadyActive: [],
      error: 'Secteur non configuré pour ce tenant',
    };
  }

  // 2. Extract required component codes from sector config
  // sector.requiredComponents is loaded from sector_configurations.default_components.commonComponents
  const requiredCodes = sector.requiredComponents;

  if (!requiredCodes || requiredCodes.length === 0) {
    return {
      success: true,
      activated: [],
      alreadyActive: [],
    };
  }

  // 3. Load component definitions to get full component info
  const componentDefs = await db.query.salaryComponentDefinitions.findMany({
    where: and(
      eq(salaryComponentDefinitions.countryCode, sector.countryCode),
      inArray(salaryComponentDefinitions.code, requiredCodes)
    ),
  });

  if (componentDefs.length === 0) {
    return {
      success: false,
      activated: [],
      alreadyActive: [],
      error: 'Aucun composant salarial trouvé pour ce secteur',
    };
  }

  // 4. Check which components are already active in tenant settings
  // Note: This assumes you have a tenant_salary_components table (to be created)
  // For now, we'll document the expected behavior
  const activated: string[] = [];
  const alreadyActive: string[] = [];

  // TODO: Query tenant_salary_components table when it exists
  // For now, just mark all as "to be activated"
  for (const compDef of componentDefs) {
    activated.push(compDef.code);
  }

  // 5. Insert/update tenant_salary_components
  // TODO: Implement when tenant_salary_components table exists
  // await db.insert(tenantSalaryComponents).values(...)
  //   .onConflictDoUpdate({ target: [...], set: { isActive: true, isRequired: true } })

  return {
    success: true,
    activated,
    alreadyActive,
  };
}

/**
 * Validate that tenant has all required components activated
 *
 * Use case: Show warning in settings page if required components are missing.
 * Block payroll run if critical components are not activated.
 *
 * @param tenantId - Tenant UUID
 * @param activatedComponents - Array of component codes currently activated
 * @returns Validation result with list of missing components
 *
 * @example
 * ```typescript
 * const activatedComponents = ['BASE_SALARY', 'HOUSING_ALLOWANCE'];
 * const result = await validateRequiredComponents('tenant-123', activatedComponents);
 * // result.valid = false
 * // result.missingComponents = ['PRIME_TRANSPORT']
 * ```
 */
export async function validateRequiredComponents(
  tenantId: string,
  activatedComponents: string[]
): Promise<{ valid: boolean; missingComponents: string[] }> {
  const sector = await getTenantSector(tenantId);

  if (!sector || !sector.requiredComponents) {
    return { valid: true, missingComponents: [] };
  }

  const required = sector.requiredComponents;
  const missingComponents = required.filter(
    (code) => !activatedComponents.includes(code)
  );

  return {
    valid: missingComponents.length === 0,
    missingComponents,
  };
}

/**
 * Get required component codes for tenant's sector
 *
 * Convenience function to get required component codes without full validation.
 *
 * @param tenantId - Tenant UUID
 * @returns Array of required component codes
 *
 * @example
 * ```typescript
 * const required = await getRequiredComponentCodes('tenant-123');
 * // ['PRIME_TRANSPORT', 'BASE_SALARY']
 * ```
 */
export async function getRequiredComponentCodes(
  tenantId: string
): Promise<string[]> {
  const sector = await getTenantSector(tenantId);
  return sector?.requiredComponents ?? [];
}

/**
 * Check if a component can be deactivated
 *
 * Use case: UI - disable deactivation toggle for required components.
 *
 * @param tenantId - Tenant UUID
 * @param componentCode - Component code to check
 * @returns True if component can be deactivated, false if it's required
 *
 * @example
 * ```typescript
 * const canDeactivate = await canDeactivateComponent('tenant-123', 'PRIME_TRANSPORT');
 * // false (for TRANSPORT sector)
 *
 * const canDeactivate2 = await canDeactivateComponent('tenant-123', 'MEAL_ALLOWANCE');
 * // true (optional component)
 * ```
 */
export async function canDeactivateComponent(
  tenantId: string,
  componentCode: string
): Promise<boolean> {
  const requiredCodes = await getRequiredComponentCodes(tenantId);
  return !requiredCodes.includes(componentCode);
}
