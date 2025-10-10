/**
 * Carryover Enforcement Service
 *
 * Enforces 6-month carryover limit per Convention Collective Article 28
 * Unused leave expires 6 months after period end
 *
 * Legal Requirement:
 * "Les congés non pris doivent être pris dans les 6 mois suivant
 * la période de référence, sinon ils sont perdus."
 */

import { db } from '@/lib/db';
import { timeOffBalances, employees, timeOffPolicies } from '@/drizzle/schema';
import { and, eq, lte, gte, sql, isNotNull } from 'drizzle-orm';
import { addMonths, differenceInDays, format } from 'date-fns';

export interface ExpiringBalance {
  employeeId: string;
  employeeName: string;
  policyId: string;
  policyName: string;
  balance: number;
  expiresAt: Date;
  daysUntilExpiry: number;
}

export interface ExpiredBalance {
  employeeId: string;
  policyId: string;
  expiredAmount: number;
  newBalance: number;
}

/**
 * Get balances expiring within X days
 * Used for proactive warnings to employees
 */
export async function getExpiringBalances(
  daysThreshold: number = 30,
  tenantId: string
): Promise<ExpiringBalance[]> {
  const today = new Date();
  const futureDate = addMonths(today, 1);

  const balances = await db
    .select({
      employeeId: timeOffBalances.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      policyId: timeOffBalances.policyId,
      policyName: timeOffPolicies.name,
      balance: timeOffBalances.balance,
      expiresAt: timeOffBalances.expiresAt,
    })
    .from(timeOffBalances)
    .innerJoin(employees, eq(employees.id, timeOffBalances.employeeId))
    .innerJoin(timeOffPolicies, eq(timeOffPolicies.id, timeOffBalances.policyId))
    .where(
      and(
        eq(timeOffBalances.tenantId, tenantId),
        isNotNull(timeOffBalances.expiresAt),
        gte(timeOffBalances.expiresAt, format(today, 'yyyy-MM-dd')),
        lte(timeOffBalances.expiresAt, format(addMonths(today, 0), 'yyyy-MM-dd')),
        sql`${timeOffBalances.balance} > 0`
      )
    )
    .orderBy(timeOffBalances.expiresAt);

  return balances.map((b) => ({
    employeeId: b.employeeId,
    employeeName: b.employeeName,
    policyId: b.policyId,
    policyName: b.policyName,
    balance: parseFloat(b.balance as string),
    expiresAt: new Date(b.expiresAt!),
    daysUntilExpiry: differenceInDays(new Date(b.expiresAt!), today),
  }));
}

/**
 * Expire all balances past their 6-month limit
 * Should be run monthly as part of accrual job
 */
export async function expireOldBalances(
  tenantId: string
): Promise<ExpiredBalance[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const results: ExpiredBalance[] = [];

  // Find all expired balances
  const expiredBalances = await db.query.timeOffBalances.findMany({
    where: and(
      eq(timeOffBalances.tenantId, tenantId),
      lte(timeOffBalances.expiresAt, today),
      sql`${timeOffBalances.balance} > 0`
    ),
  });

  // Process each expired balance
  for (const balance of expiredBalances) {
    const expiredAmount = parseFloat(balance.balance as string);

    // Update balance to 0 and track in metadata
    const metadata = (balance.metadata as Record<string, any>) || {};
    const expiredHistory = metadata.expired_history || [];

    expiredHistory.push({
      amount: expiredAmount,
      expired_on: today,
      reason: 'Carryover limit exceeded (6 months per Article 28)',
    });

    await db
      .update(timeOffBalances)
      .set({
        balance: '0',
        metadata: {
          ...metadata,
          expired_history: expiredHistory,
        },
        updatedAt: new Date().toISOString(),
      })
      .where(eq(timeOffBalances.id, balance.id));

    results.push({
      employeeId: balance.employeeId,
      policyId: balance.policyId,
      expiredAmount,
      newBalance: 0,
    });
  }

  return results;
}

/**
 * Check if an employee should be warned about expiring balance
 * Returns warning severity based on days remaining
 */
export function getExpirationSeverity(
  daysUntilExpiry: number
): 'urgent' | 'warning' | 'info' | null {
  if (daysUntilExpiry < 0) return null; // Already expired
  if (daysUntilExpiry <= 7) return 'urgent'; // 1 week or less
  if (daysUntilExpiry <= 30) return 'warning'; // 1 month or less
  if (daysUntilExpiry <= 60) return 'info'; // 2 months or less
  return null; // Not close to expiration
}

/**
 * Get expiration warning message in French
 */
export function getExpirationWarningMessage(
  balance: number,
  daysUntilExpiry: number,
  expiresAt: Date
): string {
  const severity = getExpirationSeverity(daysUntilExpiry);

  if (severity === 'urgent') {
    return `⚠️ URGENT: ${balance} jours de congé expirent dans ${daysUntilExpiry} jour(s) (${format(expiresAt, 'dd/MM/yyyy')}). Prenez vos congés avant l'expiration !`;
  }

  if (severity === 'warning') {
    return `⚠️ Attention: ${balance} jours de congé expirent dans ${daysUntilExpiry} jours (${format(expiresAt, 'dd/MM/yyyy')}). Planifiez vos congés bientôt.`;
  }

  if (severity === 'info') {
    return `ℹ️ Information: ${balance} jours de congé expirent le ${format(expiresAt, 'dd/MM/yyyy')} (dans ${daysUntilExpiry} jours).`;
  }

  return '';
}

/**
 * Calculate expiration date for a new balance
 * 6 months after period end per Article 28
 */
export function calculateExpirationDate(periodEnd: Date): Date {
  return addMonths(periodEnd, 6);
}

/**
 * Get expired balance history for an employee
 */
export async function getExpiredBalanceHistory(
  employeeId: string,
  tenantId: string
): Promise<
  Array<{
    policyId: string;
    policyName: string;
    expiredHistory: Array<{
      amount: number;
      expired_on: string;
      reason: string;
    }>;
  }>
> {
  const balances = await db
    .select({
      policyId: timeOffBalances.policyId,
      policyName: timeOffPolicies.name,
      metadata: timeOffBalances.metadata,
    })
    .from(timeOffBalances)
    .innerJoin(timeOffPolicies, eq(timeOffPolicies.id, timeOffBalances.policyId))
    .where(
      and(
        eq(timeOffBalances.employeeId, employeeId),
        eq(timeOffBalances.tenantId, tenantId),
        sql`${timeOffBalances.metadata} ? 'expired_history'`
      )
    );

  return balances.map((b) => ({
    policyId: b.policyId,
    policyName: b.policyName,
    expiredHistory: ((b.metadata as Record<string, any>)?.expired_history ||
      []) as Array<{
      amount: number;
      expired_on: string;
      reason: string;
    }>,
  }));
}
