/**
 * Employee Number Generation Service
 *
 * Generates unique, sequential employee numbers within a tenant.
 * Format: EMP-{6-digit sequential number}
 */

import { db } from '@/lib/db';
import { employees } from '@/drizzle/schema';
import { eq, desc, sql, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof import('@/drizzle/schema'),
  ExtractTablesWithRelations<typeof import('@/drizzle/schema')>
>;

const PREFIX = 'EMP';
const NUMBER_LENGTH = 6;

/**
 * Generate next employee number for a tenant
 *
 * @param tenantId - Tenant UUID
 * @param tx - Optional transaction (for atomic operations)
 * @returns Employee number (e.g., "EMP-000001")
 */
export async function generateEmployeeNumber(
  tenantId: string,
  tx?: Transaction
): Promise<string> {
  const dbClient = tx || db;

  // Get the last employee number for this tenant
  const lastEmployee = await dbClient
    .select({
      employeeNumber: employees.employeeNumber,
    })
    .from(employees)
    .where(eq(employees.tenantId, tenantId))
    .orderBy(desc(employees.createdAt))
    .limit(1);

  let nextNumber = 1;

  if (lastEmployee.length > 0) {
    const lastNumber = lastEmployee[0]?.employeeNumber;

    if (lastNumber) {
      // Extract number part (e.g., "EMP-000123" → 123)
      const match = lastNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
  }

  // Format with leading zeros (e.g., 1 → "000001")
  const paddedNumber = nextNumber.toString().padStart(NUMBER_LENGTH, '0');

  return `${PREFIX}-${paddedNumber}`;
}

/**
 * Validate employee number format
 *
 * @param employeeNumber - Number to validate
 * @returns True if valid format
 */
export function validateEmployeeNumber(employeeNumber: string): boolean {
  const pattern = new RegExp(`^${PREFIX}-\\d{${NUMBER_LENGTH}}$`);
  return pattern.test(employeeNumber);
}
