/**
 * Sector Resolution Helper Functions
 *
 * Purpose: Resolve business activity sector for tenants and employees
 * to determine work accident rates and required salary components.
 *
 * Architecture (Phase 1 - Current):
 * - tenant.sector_code → stored in database
 * - sector_configurations table → defines sector rules per country
 * - This module → provides helper functions for sector lookup
 *
 * Future (Phase 2 - Subsidiaries):
 * - Priority 1: employee.sector_override (rare)
 * - Priority 2: employee.subsidiary.sector_code (normal)
 * - Priority 3: tenant.sector_code (legacy fallback)
 */

import { db } from '@/lib/db';
import { tenants, sectorConfigurations } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface SectorInfo {
  countryCode: string;
  sectorCode: string;
  sectorNameFr: string;
  workAccidentRate: number; // 2-5% depending on sector
  requiredComponents: string[]; // e.g., ['PRIME_TRANSPORT'] for TRANSPORT sector
  legalReference?: string;
  source: 'tenant' | 'employee_override' | 'subsidiary'; // For debugging
}

/**
 * Get sector information for a tenant
 *
 * Phase 1 Implementation:
 * - Looks up tenant.sector_code
 * - Returns sector configuration from sector_configurations table
 *
 * Example:
 * - Tenant sector_code = 'CONSTRUCTION'
 * - Returns: { sectorCode: 'CONSTRUCTION', workAccidentRate: 5%, ... }
 */
export async function getTenantSector(tenantId: string): Promise<SectorInfo | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      countryCode: true,
      sectorCode: true,
    },
  });

  if (!tenant || !tenant.sectorCode) {
    console.warn(`Tenant ${tenantId} has no sector_code assigned`);
    return null;
  }

  const sector = await db.query.sectorConfigurations.findFirst({
    where: and(
      eq(sectorConfigurations.countryCode, tenant.countryCode),
      eq(sectorConfigurations.sectorCode, tenant.sectorCode)
    ),
  });

  if (!sector) {
    console.error(
      `Sector configuration not found for ${tenant.countryCode}/${tenant.sectorCode}`
    );
    return null;
  }

  return {
    countryCode: tenant.countryCode,
    sectorCode: tenant.sectorCode,
    sectorNameFr: (sector.name as any)?.fr || sector.sectorCode,
    workAccidentRate: parseFloat(sector.workAccidentRate),
    requiredComponents: (sector.defaultComponents as string[]) ?? [],
    legalReference: undefined,
    source: 'tenant',
  };
}

/**
 * Get sector information for an employee
 *
 * Phase 1 Implementation:
 * - Uses tenant.sector_code (same as getTenantSector)
 *
 * Phase 2 Implementation (Future):
 * - Priority 1: employee.sector_override
 * - Priority 2: employee.subsidiary.sector_code
 * - Priority 3: tenant.sector_code (fallback)
 *
 * Use cases:
 * - Payroll calculation (work accident contribution)
 * - Required component validation (PRIME_TRANSPORT for chauffeurs)
 */
export async function getEmployeeSector(employeeId: string): Promise<SectorInfo | null> {
  // Phase 1: Use tenant sector
  const employee = await db.query.employees.findFirst({
    where: eq(db.schema.employees.id, employeeId),
    columns: { tenantId: true },
  });

  if (!employee) {
    return null;
  }

  return getTenantSector(employee.tenantId);

  // Phase 2 TODO: Check employee.sector_override and employee.subsidiary.sector_code
  // if (employee.sector_override) {
  //   return resolveSectorByCode(employee.country_code, employee.sector_override, 'employee_override');
  // }
  // if (employee.subsidiary) {
  //   return resolveSectorByCode(employee.subsidiary.country_code, employee.subsidiary.sector_code, 'subsidiary');
  // }
  // return getTenantSector(employee.tenantId); // Fallback
}

/**
 * Get work accident rate for tenant
 *
 * Convention Collective rates by sector:
 * - SERVICES: 2%
 * - COMMERCE: 2%
 * - TRANSPORT: 3%
 * - INDUSTRIE: 4%
 * - CONSTRUCTION: 5%
 */
export async function getWorkAccidentRate(tenantId: string): Promise<number | null> {
  const sector = await getTenantSector(tenantId);
  return sector?.workAccidentRate ?? null;
}

/**
 * Get required salary components for tenant's sector
 *
 * Example:
 * - TRANSPORT sector requires PRIME_TRANSPORT
 * - CONSTRUCTION sector requires PRIME_SALISSURE
 *
 * Returns array of component codes that MUST be activated
 */
export async function getRequiredComponents(tenantId: string): Promise<string[]> {
  const sector = await getTenantSector(tenantId);
  return sector?.requiredComponents ?? [];
}

/**
 * Validate if a tenant has required components activated
 *
 * Use case: Settings page validation
 * - Show warning if required components are missing
 * - Block payroll if critical components not activated
 */
export async function validateRequiredComponents(
  tenantId: string,
  activatedComponents: string[]
): Promise<{ valid: boolean; missingComponents: string[] }> {
  const required = await getRequiredComponents(tenantId);

  const missingComponents = required.filter(
    (component) => !activatedComponents.includes(component)
  );

  return {
    valid: missingComponents.length === 0,
    missingComponents,
  };
}

/**
 * Get all sectors for a country
 *
 * Useful for:
 * - Tenant settings sector dropdown
 * - Sector comparison tables
 */
export async function getSectorsByCountry(countryCode: string) {
  const sectors = await db.query.sectorConfigurations.findMany({
    where: eq(sectorConfigurations.countryCode, countryCode),
    orderBy: (sectors, { asc }) => [asc(sectors.sectorCode)],
  });

  return sectors.map((sector) => ({
    sectorCode: sector.sectorCode,
    sectorNameFr: (sector.name as any)?.fr || sector.sectorCode,
    workAccidentRate: parseFloat(sector.workAccidentRate),
    requiredComponents: (sector.defaultComponents as string[]) ?? [],
    legalReference: undefined,
  }));
}

/**
 * Update tenant sector
 *
 * Use case: Tenant settings page
 * - Admin changes company sector from SERVICES to CONSTRUCTION
 * - Work accident rate changes from 2% to 5%
 * - Required components may change
 *
 * IMPORTANT: This affects all employees in the tenant (Phase 1)
 */
export async function updateTenantSector(
  tenantId: string,
  sectorCode: string
): Promise<{ success: boolean; error?: string }> {
  // Validate sector exists for tenant's country
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { countryCode: true },
  });

  if (!tenant) {
    return { success: false, error: 'Tenant not found' };
  }

  const sectorExists = await db.query.sectorConfigurations.findFirst({
    where: and(
      eq(sectorConfigurations.countryCode, tenant.countryCode),
      eq(sectorConfigurations.sectorCode, sectorCode)
    ),
  });

  if (!sectorExists) {
    return {
      success: false,
      error: `Sector ${sectorCode} not available for country ${tenant.countryCode}`,
    };
  }

  // Update tenant
  await db
    .update(tenants)
    .set({ sectorCode })
    .where(eq(tenants.id, tenantId));

  return { success: true };
}

/**
 * Get sector smart defaults for new tenants
 *
 * Use case: Onboarding flow
 * - Suggests 'SERVICES' as safest default (lowest work accident rate)
 * - Can be changed later in tenant settings
 */
export async function getDefaultSector(countryCode: string): Promise<string> {
  const sectors = await getSectorsByCountry(countryCode);

  // Find SERVICES sector (safest default)
  const servicesSector = sectors.find((s) => s.sectorCode === 'SERVICES');
  if (servicesSector) {
    return 'SERVICES';
  }

  // Fallback: lowest work accident rate
  const lowestRate = sectors.reduce((prev, curr) =>
    curr.workAccidentRate < prev.workAccidentRate ? curr : prev
  );

  return lowestRate?.sectorCode ?? 'SERVICES';
}
