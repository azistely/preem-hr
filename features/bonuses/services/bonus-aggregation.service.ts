/**
 * Bonus Aggregation Service
 *
 * Purpose: Aggregate approved bonuses for payroll calculation
 * Used by: payroll-calculation-v2.ts, payroll router
 */

import { db } from '@/lib/db';
import { bonuses } from '@/lib/db/schema/bonuses';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface EmployeeBonusAggregate {
  employeeId: string;
  totalAmount: number;
  bonusCount: number;
  bonuses: Array<{
    id: string;
    bonusType: string;
    amount: number;
    description: string | null;
    period: string;
    isTaxable: boolean;
    isSubjectToSocialSecurity: boolean;
  }>;
}

/**
 * Aggregate approved bonuses for an employee for a specific period
 *
 * @param employeeId - Employee UUID
 * @param periodStart - Start date of payroll period (YYYY-MM-DD)
 * @param periodEnd - End date of payroll period (YYYY-MM-DD)
 * @param tenantId - Tenant UUID (for security)
 * @returns Aggregated bonus data
 *
 * @example
 * ```typescript
 * const bonusData = await getEmployeeBonusesForPeriod(
 *   'employee-uuid',
 *   '2025-01-01',
 *   '2025-01-31',
 *   'tenant-uuid'
 * );
 *
 * console.log(bonusData.totalAmount); // 75000 (sum of all bonuses)
 * console.log(bonusData.bonusCount); // 2
 * console.log(bonusData.bonuses); // Array of individual bonuses
 * ```
 */
export async function getEmployeeBonusesForPeriod(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tenantId: string
): Promise<EmployeeBonusAggregate> {
  // Convert dates to period format (YYYY-MM-01)
  const startPeriod = periodStart.substring(0, 8) + '01'; // YYYY-MM-01
  const endPeriod = periodEnd.substring(0, 8) + '01'; // YYYY-MM-01

  // Fetch approved bonuses for the period
  const approvedBonuses = await db
    .select({
      id: bonuses.id,
      bonusType: bonuses.bonusType,
      amount: bonuses.amount,
      description: bonuses.description,
      period: bonuses.period,
      isTaxable: bonuses.isTaxable,
      isSubjectToSocialSecurity: bonuses.isSubjectToSocialSecurity,
    })
    .from(bonuses)
    .where(
      and(
        eq(bonuses.tenantId, tenantId),
        eq(bonuses.employeeId, employeeId),
        eq(bonuses.status, 'approved'), // Only approved bonuses
        gte(bonuses.period, startPeriod),
        lte(bonuses.period, endPeriod)
      )
    );

  // Calculate total
  const totalAmount = approvedBonuses.reduce(
    (sum, bonus) => sum + Number(bonus.amount),
    0
  );

  return {
    employeeId,
    totalAmount,
    bonusCount: approvedBonuses.length,
    bonuses: approvedBonuses.map((bonus) => ({
      ...bonus,
      amount: Number(bonus.amount),
    })),
  };
}

/**
 * Aggregate bonuses for multiple employees for a payroll period
 *
 * @param employeeIds - Array of employee UUIDs
 * @param periodStart - Start date of payroll period (YYYY-MM-DD)
 * @param periodEnd - End date of payroll period (YYYY-MM-DD)
 * @param tenantId - Tenant UUID (for security)
 * @returns Map of employee ID to bonus aggregate
 *
 * @example
 * ```typescript
 * const bonusesByEmployee = await getBulkEmployeeBonuses(
 *   ['emp1-uuid', 'emp2-uuid'],
 *   '2025-01-01',
 *   '2025-01-31',
 *   'tenant-uuid'
 * );
 *
 * console.log(bonusesByEmployee['emp1-uuid'].totalAmount); // 50000
 * console.log(bonusesByEmployee['emp2-uuid'].totalAmount); // 75000
 * ```
 */
export async function getBulkEmployeeBonuses(
  employeeIds: string[],
  periodStart: string,
  periodEnd: string,
  tenantId: string
): Promise<Record<string, EmployeeBonusAggregate>> {
  if (employeeIds.length === 0) {
    return {};
  }

  // Fetch all bonuses for all employees in one query
  const results = await Promise.all(
    employeeIds.map((employeeId) =>
      getEmployeeBonusesForPeriod(employeeId, periodStart, periodEnd, tenantId)
    )
  );

  // Convert to map
  const bonusMap: Record<string, EmployeeBonusAggregate> = {};
  results.forEach((result) => {
    bonusMap[result.employeeId] = result;
  });

  return bonusMap;
}

/**
 * Get detailed bonus breakdown for payslip display
 *
 * @param employeeId - Employee UUID
 * @param periodStart - Start date of payroll period (YYYY-MM-DD)
 * @param periodEnd - End date of payroll period (YYYY-MM-DD)
 * @param tenantId - Tenant UUID (for security)
 * @returns Array of bonus line items for payslip
 */
export async function getBonusLineItems(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tenantId: string
): Promise<
  Array<{
    code: string;
    name: string;
    amount: number;
    isTaxable: boolean;
    isSubjectToSocialSecurity: boolean;
  }>
> {
  const aggregate = await getEmployeeBonusesForPeriod(
    employeeId,
    periodStart,
    periodEnd,
    tenantId
  );

  // Convert bonuses to line items
  return aggregate.bonuses.map((bonus, index) => ({
    code: `BONUS_${bonus.bonusType.toUpperCase()}_${index + 1}`,
    name: bonus.description || `Prime ${bonus.bonusType}`,
    amount: bonus.amount,
    isTaxable: bonus.isTaxable,
    isSubjectToSocialSecurity: bonus.isSubjectToSocialSecurity,
  }));
}
