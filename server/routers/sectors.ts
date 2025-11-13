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
import { createTRPCRouter as router, publicProcedure, protectedProcedure, hrManagerProcedure } from '../api/trpc';
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
  getTenantSector: protectedProcedure
    .query(async ({ ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      return getTenantSector(ctx.user.tenantId);
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
  getWorkAccidentRate: protectedProcedure
    .query(async ({ ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      const rate = await getWorkAccidentRate(ctx.user.tenantId);
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
  getRequiredComponents: protectedProcedure
    .query(async ({ ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      const components = await getRequiredComponents(ctx.user.tenantId);
      return { requiredComponents: components };
    }),

  /**
   * Validate if tenant has all required components activated
   *
   * Use case: Show warning in settings if components missing
   */
  validateRequiredComponents: protectedProcedure
    .input(
      z.object({
        activatedComponents: z.array(z.string()),
      })
    )
    .query(async ({ input, ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      return validateRequiredComponents(
        ctx.user.tenantId,
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
        sectorCode: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Use tenantId from context (automatically uses activeTenantId if set)
      return updateTenantSector(ctx.user.tenantId, input.sectorCode);
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
