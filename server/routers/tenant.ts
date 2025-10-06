/**
 * Tenant tRPC Router
 *
 * Provides type-safe API endpoints for tenant operations
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const tenantRouter = createTRPCRouter({
  /**
   * Get current tenant information
   *
   * Returns tenant details including country code for payroll configuration.
   *
   * @example
   * ```typescript
   * const tenant = await trpc.tenant.getCurrent.query();
   * // tenant = { id: '...', name: 'Company', countryCode: 'CI', ... }
   * ```
   */
  getCurrent: publicProcedure
    .query(async () => {
      // In production, get tenant ID from auth context
      // For now, use the first tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, '00000000-0000-0000-0000-000000000001'),
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      return {
        id: tenant.id,
        name: tenant.name,
        countryCode: tenant.countryCode,
        currency: tenant.currency,
        timezone: tenant.timezone,
      };
    }),
});
