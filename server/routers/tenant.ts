/**
 * Tenant tRPC Router
 *
 * Provides type-safe API endpoints for tenant operations
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const tenantRouter = createTRPCRouter({
  /**
   * Get current tenant information
   *
   * Returns tenant details including country code for payroll configuration.
   * Uses the authenticated user's tenantId from the session context.
   *
   * @example
   * ```typescript
   * const tenant = await trpc.tenant.getCurrent.query();
   * // tenant = { id: '...', name: 'Company', countryCode: 'CI', ... }
   * ```
   */
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      // Get tenant ID from authenticated user's context
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user.tenantId),
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
