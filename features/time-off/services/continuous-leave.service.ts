/**
 * Continuous Leave Validation Service
 *
 * Enforces minimum 12 consecutive days requirement per Convention Collective Article 28
 *
 * Legal Requirement:
 * "La durée du congé principal ne peut être inférieure à 12 jours ouvrables consécutifs."
 * (The main leave period cannot be less than 12 consecutive working days)
 */

import { db } from '@/lib/db';
import { timeOffRequests, timeOffPolicies } from '@/drizzle/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { differenceInDays, format, startOfYear, endOfYear } from 'date-fns';

export interface ContinuousLeaveStatus {
  employeeId: string;
  year: number;
  hasMetRequirement: boolean;
  longestContinuousPeriod: number;
  minimumRequired: number;
  remainingRequired: number;
}

export interface ContinuousLeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: string;
}

export class ContinuousLeaveError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContinuousLeaveError';
  }
}

/**
 * Check if employee has taken required 12 consecutive days in a year
 */
export async function hasTakenContinuousLeave(
  employeeId: string,
  tenantId: string,
  year: number
): Promise<ContinuousLeaveStatus> {
  const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(new Date(year, 11, 31)), 'yyyy-MM-dd');

  // Get all approved annual leave requests for the year
  const requests = await db
    .select({
      id: timeOffRequests.id,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      totalDays: timeOffRequests.totalDays,
      status: timeOffRequests.status,
    })
    .from(timeOffRequests)
    .innerJoin(timeOffPolicies, eq(timeOffPolicies.id, timeOffRequests.policyId))
    .where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'),
        eq(timeOffPolicies.policyType, 'annual_leave'),
        gte(timeOffRequests.startDate, yearStart),
        lte(timeOffRequests.endDate, yearEnd)
      )
    )
    .orderBy(timeOffRequests.startDate);

  // Find longest continuous period
  let longestPeriod = 0;

  for (const request of requests) {
    const days = parseFloat(request.totalDays as string);
    if (days > longestPeriod) {
      longestPeriod = days;
    }
  }

  const minimumRequired = 12; // Article 28
  const hasMetRequirement = longestPeriod >= minimumRequired;

  return {
    employeeId,
    year,
    hasMetRequirement,
    longestContinuousPeriod: longestPeriod,
    minimumRequired,
    remainingRequired: Math.max(0, minimumRequired - longestPeriod),
  };
}

/**
 * Validate continuous leave requirement before year-end
 * Throws error if requirement not met and we're in Q4
 */
export async function validateContinuousLeaveRequirement(
  employeeId: string,
  tenantId: string,
  year?: number
): Promise<void> {
  const currentYear = year || new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  const status = await hasTakenContinuousLeave(employeeId, tenantId, currentYear);

  // Only enforce if we're in November (month 10) or December (month 11)
  // and requirement hasn't been met
  if (!status.hasMetRequirement && currentMonth >= 10) {
    throw new ContinuousLeaveError(
      `Vous devez prendre au moins ${status.minimumRequired} jours consécutifs de congés cette année. ` +
        `Actuellement: ${status.longestContinuousPeriod} jours. ` +
        `Il vous reste ${status.remainingRequired} jours à prendre en continu. ` +
        `(Convention Collective Article 28)`,
      'CONTINUOUS_LEAVE_REQUIRED',
      {
        currentYear,
        longestPeriod: status.longestContinuousPeriod,
        required: status.minimumRequired,
        remaining: status.remainingRequired,
      }
    );
  }
}

/**
 * Check if a new leave request would satisfy the continuous leave requirement
 */
export function wouldSatisfyContinuousLeave(
  requestDays: number,
  currentLongestPeriod: number,
  minimumRequired: number = 12
): boolean {
  return requestDays >= minimumRequired || currentLongestPeriod >= minimumRequired;
}

/**
 * Get employees who haven't met continuous leave requirement
 * Used for proactive alerts in Q4
 */
export async function getEmployeesWithoutContinuousLeave(
  tenantId: string,
  year: number
): Promise<
  Array<{
    employeeId: string;
    employeeName: string;
    longestPeriod: number;
    remainingRequired: number;
  }>
> {
  // This would require a more complex query
  // For now, return empty array - to be implemented with proper employee join
  return [];
}

/**
 * Get warning message for continuous leave requirement
 */
export function getContinuousLeaveWarningMessage(
  status: ContinuousLeaveStatus,
  currentMonth: number
): string | null {
  if (status.hasMetRequirement) {
    return null; // No warning needed
  }

  // November (month 10)
  if (currentMonth === 10) {
    return (
      `⚠️ Rappel: Vous devez prendre au moins ${status.minimumRequired} jours consécutifs cette année. ` +
      `Actuellement: ${status.longestContinuousPeriod} jours. ` +
      `Il vous reste ${status.remainingRequired} jours à prendre en continu avant fin décembre.`
    );
  }

  // December (month 11)
  if (currentMonth === 11) {
    return (
      `🚨 URGENT: Vous devez prendre ${status.remainingRequired} jours consécutifs avant le 31 décembre. ` +
      `Actuellement: ${status.longestContinuousPeriod} jours sur ${status.minimumRequired} requis. ` +
      `(Convention Collective Article 28)`
    );
  }

  // September-October (early warning)
  if (currentMonth >= 8 && currentMonth <= 9) {
    return (
      `ℹ️ Planifiez vos congés: ${status.remainingRequired} jours consécutifs requis cette année. ` +
      `Actuellement: ${status.longestContinuousPeriod} jours.`
    );
  }

  return null;
}

/**
 * Suggest ideal continuous leave period length
 */
export function suggestContinuousLeavePeriod(
  availableBalance: number,
  currentLongestPeriod: number,
  minimumRequired: number = 12
): {
  suggested: number;
  reason: string;
} {
  if (currentLongestPeriod >= minimumRequired) {
    return {
      suggested: 0,
      reason: 'Exigence déjà remplie',
    };
  }

  const remaining = minimumRequired - currentLongestPeriod;

  if (availableBalance < minimumRequired) {
    return {
      suggested: availableBalance,
      reason: `Solde insuffisant (${availableBalance} jours disponibles, ${minimumRequired} requis)`,
    };
  }

  // Suggest taking exactly 12 days (minimum) or 14 days (2 weeks)
  if (availableBalance >= 14) {
    return {
      suggested: 14,
      reason: '2 semaines de congé (recommandé)',
    };
  }

  return {
    suggested: minimumRequired,
    reason: `Minimum légal (${minimumRequired} jours consécutifs)`,
  };
}
