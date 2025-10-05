/**
 * Server-side Data Fetching for Employees
 *
 * Uses React cache for automatic request deduplication
 */

import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get employee by ID with automatic deduplication
 */
export const getEmployee = cache(async (employeeId: string, tenantId?: string) => {
  const where = tenantId
    ? and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId))
    : eq(employees.id, employeeId);

  return await db.query.employees.findFirst({
    where,
    with: {
      currentSalary: true,
      currentAssignment: true,
    },
  });
});

/**
 * Get active employees for a tenant
 * Cached for 1 minute
 */
export const getActiveEmployees = unstable_cache(
  async (tenantId: string) => {
    return await db.query.employees.findMany({
      where: and(
        eq(employees.tenantId, tenantId),
        eq(employees.status, 'active')
      ),
      orderBy: (employees, { asc }) => [asc(employees.lastName)],
    });
  },
  ['active-employees'],
  {
    revalidate: 60, // 1 minute
    tags: ['employees'],
  }
);

/**
 * Get all employees for a tenant
 * Uses React cache for deduplication within the same render
 */
export const getAllEmployees = cache(async (tenantId: string, status?: string) => {
  const where = status
    ? and(eq(employees.tenantId, tenantId), eq(employees.status, status))
    : eq(employees.tenantId, tenantId);

  return await db.query.employees.findMany({
    where,
    orderBy: (employees, { asc }) => [asc(employees.lastName)],
  });
});
