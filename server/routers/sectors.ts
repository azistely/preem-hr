/**
 * tRPC Router: Sector Management
 *
 * Purpose: API endpoints for managing business activity sectors
 *
 * Endpoints:
 * - getTenantSector: Get current tenant sector configuration
 * - getSectorsByCountry: List all available sectors for country
 * - getWorkAccidentRate: Get work accident rate for tenant
 * - getRequiredComponents: Get required salary components by sector
 * - validateRequiredComponents: Check if tenant has required components
 * - updateTenantSector: Change tenant's business sector
 */

import { z } from 'zod';
import { createTRPCRouter as router, publicProcedure, hrManagerProcedure } from '../api/trpc';
import {
  getTenantSector,
  getSectorsByCountry,
  getWorkAccidentRate,
  getRequiredComponents,
  validateRequiredComponents,
  updateTenantSector,
  getDefaultSector,
} from '@/lib/compliance/sector-resolution';

export const sectorsRouter = router({
  /**
   * Get tenant's current sector configuration
   *
   * Use case: Display sector info in tenant settings
   */
  getTenantSector: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      return getTenantSector(input.tenantId);
    }),

  /**
   * Get all available sectors for a country
   *
   * Use case: Populate sector dropdown in tenant settings
   */
  getSectorsByCountry: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
      })
    )
    .query(async ({ input }) => {
      return getSectorsByCountry(input.countryCode);
    }),

  /**
   * Get work accident contribution rate
   *
   * Use case: Display rate in payroll breakdown
   * Rates: SERVICES 2%, COMMERCE 2%, TRANSPORT 3%, INDUSTRIE 4%, CONSTRUCTION 5%
   */
  getWorkAccidentRate: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const rate = await getWorkAccidentRate(input.tenantId);
      if (rate === null) {
        throw new Error('Tenant sector not configured');
      }
      return { rate };
    }),

  /**
   * Get required salary components for sector
   *
   * Use case: Validation in salary components settings
   * Example: TRANSPORT sector requires PRIME_TRANSPORT
   */
  getRequiredComponents: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const components = await getRequiredComponents(input.tenantId);
      return { requiredComponents: components };
    }),

  /**
   * Validate if tenant has all required components activated
   *
   * Use case: Show warning in settings if components missing
   */
  validateRequiredComponents: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        activatedComponents: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      return validateRequiredComponents(
        input.tenantId,
        input.activatedComponents
      );
    }),

  /**
   * Update tenant's business sector
   *
   * Use case: Tenant settings page - change sector dropdown
   * IMPORTANT: Affects all employees in tenant (Phase 1)
   * Requires: HR Manager role
   */
  updateTenantSector: hrManagerProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        sectorCode: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return updateTenantSector(input.tenantId, input.sectorCode);
    }),

  /**
   * Get default sector for country
   *
   * Use case: Onboarding - suggest default sector
   */
  getDefaultSector: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
      })
    )
    .query(async ({ input }) => {
      const defaultSector = await getDefaultSector(input.countryCode);
      return { defaultSector };
    }),
});
