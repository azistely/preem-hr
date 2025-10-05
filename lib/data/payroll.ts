/**
 * Server-side Data Fetching for Payroll
 *
 * Uses React cache for automatic request deduplication
 */

import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { payrollRuns, payrollLineItems } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Get payroll run by ID with automatic deduplication
 * Uses React cache to deduplicate requests in the same render
 */
export const getPayrollRun = cache(async (runId: string) => {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
  });

  if (!run) {
    return null;
  }

  const lineItems = await db.query.payrollLineItems.findMany({
    where: eq(payrollLineItems.payrollRunId, runId),
    orderBy: [desc(payrollLineItems.employeeId)],
  });

  return {
    ...run,
    lineItems,
  };
});

/**
 * Get payroll runs for a tenant
 * Cached for 5 minutes using Next.js cache
 */
export const getPayrollRuns = unstable_cache(
  async (tenantId: string, status?: string) => {
    const where = status
      ? and(
          eq(payrollRuns.tenantId, tenantId),
          eq(payrollRuns.status, status)
        )
      : eq(payrollRuns.tenantId, tenantId);

    return await db.query.payrollRuns.findMany({
      where,
      orderBy: [desc(payrollRuns.periodStart)],
      limit: 50,
    });
  },
  ['payroll-runs'],
  {
    revalidate: 300, // 5 minutes
    tags: ['payroll-runs'],
  }
);

/**
 * Get latest payroll run for a tenant
 */
export const getLatestPayrollRun = cache(async (tenantId: string) => {
  return await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.tenantId, tenantId),
    orderBy: [desc(payrollRuns.periodStart)],
  });
});
