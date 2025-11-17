/**
 * Overtime Detection & Classification Service
 *
 * Detects and classifies overtime hours based on country-specific rules.
 * Supports:
 * - Weekly hour thresholds (40h, 41-46h, 46h+)
 * - Night work detection (21h-5h) on weekdays
 * - Sunday work (daytime 1.75×, night 2.00×)
 * - Public holidays (daytime 1.75×, night 2.00×)
 * - Country-specific multipliers
 *
 * Note: Saturday is a normal working day (no special premium)
 */

import { db } from '@/db';
import { overtimeRules, timeEntries, employees } from '@/drizzle/schema';
import { and, eq, gte, lte, or, isNull, sql } from 'drizzle-orm';
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  format,
  parseISO,
  getDay,
  getHours,
  getMinutes,
  addHours,
  differenceInYears,
  isAfter,
} from 'date-fns';
import { isPublicHoliday } from './holiday.service';

export interface OvertimeBreakdown {
  regular: number; // Regular hours (up to 40)
  hours_41_to_46?: number; // Hours 41-46 (CI: x1.15)
  hours_above_46?: number; // Hours 46+ (CI: x1.50)
  night_work?: number; // Night hours weekday (21h-5h, CI: x1.75)
  sunday?: number; // Sunday daytime hours (CI: x1.75)
  public_holiday?: number; // Public holiday daytime hours (CI: x1.75)
  night_sunday_holiday?: number; // Night hours on Sunday/holiday (21h-5h, CI: x2.00)
  // Note: Saturday is a normal working day (no special premium)
}

export interface OvertimeRule {
  id: string;
  ruleType: string;
  multiplier: number;
  maxHoursPerWeek?: number;
  appliesFromTime?: string;
  appliesToTime?: string;
  appliesToDays?: string[];
}

/**
 * Get overtime rules for a country
 */
export async function getOvertimeRules(
  countryCode: string
): Promise<OvertimeRule[]> {
  const today = new Date().toISOString().split('T')[0];

  const rules = await db.query.overtimeRules.findMany({
    where: and(
      eq(overtimeRules.countryCode, countryCode),
      lte(overtimeRules.effectiveFrom, today),
      or(
        isNull(overtimeRules.effectiveTo),
        sql`${overtimeRules.effectiveTo} > ${today}`
      )
    ),
  });

  return rules.map((rule) => ({
    id: rule.id,
    ruleType: rule.ruleType,
    multiplier: parseFloat(rule.multiplier as string),
    maxHoursPerWeek: rule.maxHoursPerWeek
      ? parseFloat(rule.maxHoursPerWeek as string)
      : undefined,
    appliesFromTime: rule.appliesFromTime || undefined,
    appliesToTime: rule.appliesToTime || undefined,
    appliesToDays: rule.appliesToDays
      ? (rule.appliesToDays as string[])
      : undefined,
  }));
}

/**
 * Check if time falls within night work hours
 */
function isNightWork(timestamp: Date, rule: OvertimeRule): boolean {
  if (!rule.appliesFromTime || !rule.appliesToTime) return false;

  const hour = getHours(timestamp);
  const minute = getMinutes(timestamp);
  const currentMinutes = hour * 60 + minute;

  // Parse rule times (e.g., "21:00:00")
  const [fromHour, fromMin] = rule.appliesFromTime.split(':').map(Number);
  const [toHour, toMin] = rule.appliesToTime.split(':').map(Number);

  const fromMinutes = fromHour * 60 + fromMin;
  const toMinutes = toHour * 60 + toMin;

  // Handle overnight shift (e.g., 21:00 - 06:00)
  if (fromMinutes > toMinutes) {
    return currentMinutes >= fromMinutes || currentMinutes < toMinutes;
  }

  return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
}

/**
 * Check if date is weekend
 */
function isWeekend(date: Date, rule: OvertimeRule): boolean {
  if (!rule.appliesToDays) return false;

  const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  return rule.appliesToDays.includes(dayNames[dayOfWeek]);
}

/**
 * Check if date is Saturday
 */
function isSaturday(date: Date): boolean {
  return getDay(date) === 6;
}

/**
 * Check if date is Sunday
 */
function isSunday(date: Date): boolean {
  return getDay(date) === 0;
}

/**
 * Calculate hours that fall within a specific time range
 */
function calculateHoursInRange(
  clockIn: Date,
  clockOut: Date,
  fromHour: number,
  toHour: number
): number {
  let hours = 0;
  let current = new Date(clockIn);

  while (current < clockOut) {
    const currentHour = getHours(current);

    // Check if current hour falls within range
    let isInRange = false;
    if (fromHour > toHour) {
      // Overnight range (e.g., 21:00 - 06:00)
      isInRange = currentHour >= fromHour || currentHour < toHour;
    } else {
      isInRange = currentHour >= fromHour && currentHour < toHour;
    }

    if (isInRange) {
      const nextHour = addHours(current, 1);
      const endOfPeriod = nextHour > clockOut ? clockOut : nextHour;
      const minutesWorked = (endOfPeriod.getTime() - current.getTime()) / (1000 * 60);
      hours += minutesWorked / 60;
    }

    current = addHours(current, 1);
  }

  return hours;
}

/**
 * Classify overtime hours for a time entry
 */
export async function classifyOvertimeHours(
  employeeId: string,
  clockIn: Date,
  clockOut: Date,
  countryCode: string
): Promise<OvertimeBreakdown> {
  const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

  // Get weekly hours worked so far
  const weekStart = startOfWeek(clockIn, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(clockIn, { weekStartsOn: 1 });

  // Include both pending and approved entries for accurate overtime calculation
  // (pending entries need to count towards weekly totals)
  const weeklyEntries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(weekStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(weekEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      // Don't filter by status - include pending and approved
      // (only exclude rejected entries)
      sql`${timeEntries.status} != 'rejected'`
    ),
  });

  const hoursThisWeek = weeklyEntries.reduce((sum, entry) => {
    return sum + (entry.totalHours ? parseFloat(entry.totalHours as string) : 0);
  }, 0);

  console.log('[classifyOvertimeHours] Calculating overtime:', {
    employeeId,
    clockIn: clockIn.toISOString(),
    totalHours,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    weeklyEntriesCount: weeklyEntries.length,
    hoursThisWeek,
    cumulativeHours: hoursThisWeek + totalHours,
  });

  // Get overtime rules for country
  const rules = await getOvertimeRules(countryCode);

  const breakdown: OvertimeBreakdown = {
    regular: 0,
  };

  // Priority 1: Check for night hours on Sunday/holiday (highest - 2.00x)
  const isHoliday = await isPublicHoliday(clockIn, countryCode);
  const isSundayDay = isSunday(clockIn);

  if (isHoliday || isSundayDay) {
    // Check if any hours fall during night time (21h-5h)
    const nightHours = calculateHoursInRange(clockIn, clockOut, 21, 5);

    if (nightHours > 0) {
      breakdown.night_sunday_holiday = nightHours;

      // Any remaining hours (daytime) go to public_holiday or sunday
      const daytimeHours = totalHours - nightHours;
      if (daytimeHours > 0) {
        if (isHoliday) {
          breakdown.public_holiday = daytimeHours;
        } else {
          breakdown.sunday = daytimeHours;
        }
      }

      // Night + Sunday/holiday takes precedence over everything
      return breakdown;
    }

    // If no night hours, all hours are daytime Sunday/holiday (1.75x)
    if (isHoliday) {
      breakdown.public_holiday = totalHours;
    } else {
      breakdown.sunday = totalHours;
    }
    return breakdown;
  }

  // Priority 2: Detect night work on weekdays (21h-5h, 1.75x)
  // Note: Night hours can overlap with weekday overtime tiers
  const nightHoursWeekday = calculateHoursInRange(clockIn, clockOut, 21, 5);
  if (nightHoursWeekday > 0) {
    breakdown.night_work = nightHoursWeekday;
  }

  // Classify by weekly thresholds (Côte d'Ivoire rules)
  if (countryCode === 'CI') {
    const cumulativeHours = hoursThisWeek + totalHours;

    if (cumulativeHours <= 40) {
      // All regular
      breakdown.regular = totalHours;
    } else if (cumulativeHours <= 46) {
      // Some regular, some 41-46
      const regularFromEntry = Math.max(0, 40 - hoursThisWeek);
      breakdown.regular = regularFromEntry;
      breakdown.hours_41_to_46 = totalHours - regularFromEntry;
    } else {
      // Regular + 41-46 + 46+
      const regularFromEntry = Math.max(0, 40 - hoursThisWeek);
      const hours4146FromEntry = Math.max(0, Math.min(6, 46 - hoursThisWeek - regularFromEntry));
      const hoursAbove46 = totalHours - regularFromEntry - hours4146FromEntry;

      breakdown.regular = regularFromEntry;
      breakdown.hours_41_to_46 = hours4146FromEntry;
      breakdown.hours_above_46 = hoursAbove46;
    }

    // Validate max weekly overtime (15h max in CI) - Article 23
    await validateWeeklyOvertimeLimit(
      employeeId,
      weekStart,
      (breakdown.hours_41_to_46 || 0) + (breakdown.hours_above_46 || 0),
      countryCode
    );

    // Validate max daily overtime (3h max in CI) - Article 23
    await validateDailyOvertimeLimit(
      employeeId,
      clockIn,
      (breakdown.hours_41_to_46 || 0) + (breakdown.hours_above_46 || 0),
      countryCode
    );

    // Validate max yearly overtime (75h max in CI) - Article 23
    const yearlyCheck = await validateYearlyOvertimeLimit(
      employeeId,
      clockIn.getFullYear(),
      (breakdown.hours_41_to_46 || 0) + (breakdown.hours_above_46 || 0),
      countryCode
    );

    if (!yearlyCheck.allowed) {
      throw new Error(yearlyCheck.error);
    }
    if (yearlyCheck.warning) {
      console.warn(`[Yearly OT Warning] Employee ${employeeId}: ${yearlyCheck.warning}`);
    }
  }

  // For Senegal or other countries, apply their specific rules
  if (countryCode === 'SN') {
    const dailyOvertime = Math.max(0, totalHours - 8);

    if (dailyOvertime <= 8) {
      breakdown.regular = Math.min(8, totalHours);
      breakdown.hours_41_to_46 = dailyOvertime;
    } else {
      breakdown.regular = Math.min(8, totalHours);
      breakdown.hours_41_to_46 = 8;
      breakdown.hours_above_46 = dailyOvertime - 8;
    }
  }

  return breakdown;
}

/**
 * Calculate overtime pay based on breakdown and rules
 */
export async function calculateOvertimePay(
  baseSalary: number,
  breakdown: OvertimeBreakdown,
  countryCode: string
): Promise<number> {
  const rules = await getOvertimeRules(countryCode);

  // Hourly rate (assuming 173.33 hours/month)
  const hourlyRate = baseSalary / 173.33;

  let overtimePay = 0;

  // Apply multipliers for each overtime type
  for (const [type, hours] of Object.entries(breakdown)) {
    if (type === 'regular' || hours === 0) continue;

    const rule = rules.find((r) => r.ruleType === type);
    if (rule) {
      overtimePay += hours * hourlyRate * rule.multiplier;
    }
  }

  return overtimePay;
}

/**
 * Aggregate overtime summary for payroll period
 */
export async function getOvertimeSummary(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<import('../types/overtime').OvertimeSummary> {
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(periodStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(periodEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  const breakdown: OvertimeBreakdown = {
    regular: 0,
    hours_41_to_46: 0,
    hours_above_46: 0,
    night_work: 0,
    sunday: 0,
    public_holiday: 0,
    night_sunday_holiday: 0,
  };

  for (const entry of entries) {
    const entryBreakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (entryBreakdown) {
      breakdown.regular += entryBreakdown.regular || 0;
      breakdown.hours_41_to_46 = (breakdown.hours_41_to_46 || 0) + (entryBreakdown.hours_41_to_46 || 0);
      breakdown.hours_above_46 = (breakdown.hours_above_46 || 0) + (entryBreakdown.hours_above_46 || 0);
      breakdown.night_work = (breakdown.night_work || 0) + (entryBreakdown.night_work || 0);
      breakdown.sunday = (breakdown.sunday || 0) + (entryBreakdown.sunday || 0);
      breakdown.public_holiday = (breakdown.public_holiday || 0) + (entryBreakdown.public_holiday || 0);
      breakdown.night_sunday_holiday = (breakdown.night_sunday_holiday || 0) + (entryBreakdown.night_sunday_holiday || 0);
    }
  }

  // Calculate total overtime hours (excluding regular)
  const totalOvertimeHours = (breakdown.hours_41_to_46 || 0) +
    (breakdown.hours_above_46 || 0) +
    (breakdown.night_work || 0) +
    (breakdown.sunday || 0) +
    (breakdown.public_holiday || 0) +
    (breakdown.night_sunday_holiday || 0);

  return {
    totalOvertimeHours,
    breakdown,
    periodStart,
    periodEnd,
  };
}

/**
 * Validate weekly overtime limit (Convention Collective Article 23)
 * Maximum 15 hours/week for CI
 */
export async function validateWeeklyOvertimeLimit(
  employeeId: string,
  weekStart: Date,
  additionalOvertimeHours: number,
  countryCode: string
): Promise<void> {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Get existing overtime this week
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(weekStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(weekEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  // Sum existing overtime hours
  const existingOvertimeHours = entries.reduce((sum, entry) => {
    const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (breakdown) {
      return (
        sum +
        (breakdown.hours_41_to_46 || 0) +
        (breakdown.hours_above_46 || 0)
      );
    }
    return sum;
  }, 0);

  // Get max overtime limit for country
  const rules = await getOvertimeRules(countryCode);
  const limitRule = rules.find(
    (r) => r.ruleType === 'hours_41_to_46' && r.maxHoursPerWeek
  );

  if (!limitRule?.maxHoursPerWeek) {
    // No limit configured for this country
    return;
  }

  const maxWeeklyOvertime = limitRule.maxHoursPerWeek;
  const totalOvertimeThisWeek = existingOvertimeHours + additionalOvertimeHours;

  if (totalOvertimeThisWeek > maxWeeklyOvertime) {
    throw new Error(
      `Dépassement de la limite d'heures supplémentaires. ` +
        `Maximum: ${maxWeeklyOvertime}h/semaine. ` +
        `Déjà effectué: ${existingOvertimeHours.toFixed(1)}h. ` +
        `Demandé: ${additionalOvertimeHours.toFixed(1)}h. ` +
        `Total: ${totalOvertimeThisWeek.toFixed(1)}h. ` +
        `(Convention Collective Article 23)`
    );
  }

  // Warning if approaching limit (>80%)
  const usagePercent = (totalOvertimeThisWeek / maxWeeklyOvertime) * 100;
  if (usagePercent > 80 && usagePercent <= 100) {
    console.warn(
      `[Overtime Warning] Employee ${employeeId} approaching weekly limit: ${totalOvertimeThisWeek.toFixed(1)}h / ${maxWeeklyOvertime}h (${usagePercent.toFixed(0)}%)`
    );
  }
}

/**
 * Get overtime usage for current week (for UI warnings)
 */
export async function getWeeklyOvertimeUsage(
  employeeId: string,
  countryCode: string
): Promise<{
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
}> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Get this week's entries
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(weekStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(weekEnd, "yyyy-MM-dd'T'HH:mm:ssXXX"))
    ),
  });

  // Sum overtime hours
  const currentOvertimeHours = entries.reduce((sum, entry) => {
    const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (breakdown) {
      return (
        sum +
        (breakdown.hours_41_to_46 || 0) +
        (breakdown.hours_above_46 || 0)
      );
    }
    return sum;
  }, 0);

  // Get limit
  const rules = await getOvertimeRules(countryCode);
  const limitRule = rules.find(
    (r) => r.ruleType === 'hours_41_to_46' && r.maxHoursPerWeek
  );

  const limit = limitRule?.maxHoursPerWeek || 15; // Default to 15h for CI
  const remaining = Math.max(0, limit - currentOvertimeHours);
  const percentage = (currentOvertimeHours / limit) * 100;

  return {
    current: parseFloat(currentOvertimeHours.toFixed(2)),
    limit,
    remaining: parseFloat(remaining.toFixed(2)),
    percentage: parseFloat(percentage.toFixed(1)),
  };
}

/**
 * Validate daily overtime limit (Convention Collective Article 23)
 * Maximum 3 hours/day for CI
 */
export async function validateDailyOvertimeLimit(
  employeeId: string,
  date: Date,
  additionalOvertimeHours: number,
  countryCode: string
): Promise<void> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Get existing overtime for this specific day (APPROVED only)
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(dayStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(dayEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  // Sum existing overtime hours for the day
  const existingOvertimeHours = entries.reduce((sum, entry) => {
    const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (breakdown) {
      return (
        sum +
        (breakdown.hours_41_to_46 || 0) +
        (breakdown.hours_above_46 || 0)
      );
    }
    return sum;
  }, 0);

  // Daily limit for CI (3h/day as per Convention Collective Article 23)
  const dailyLimit = 3;
  const totalDailyOvertime = existingOvertimeHours + additionalOvertimeHours;

  if (totalDailyOvertime > dailyLimit) {
    throw new Error(
      `Dépassement de la limite journalière d'heures supplémentaires. ` +
        `Maximum: ${dailyLimit}h/jour. ` +
        `Déjà effectué: ${existingOvertimeHours.toFixed(1)}h. ` +
        `Demandé: ${additionalOvertimeHours.toFixed(1)}h. ` +
        `Total: ${totalDailyOvertime.toFixed(1)}h. ` +
        `(Convention Collective Article 23)`
    );
  }
}

/**
 * Get total overtime hours for a calendar year
 */
export async function getYearlyOvertimeHours(
  employeeId: string,
  year: number
): Promise<number> {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 11, 31));

  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(yearStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(yearEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  return entries.reduce((sum, entry) => {
    const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (breakdown) {
      return (
        sum +
        (breakdown.hours_41_to_46 || 0) +
        (breakdown.hours_above_46 || 0)
      );
    }
    return sum;
  }, 0);
}

/**
 * Validate yearly overtime limit (Convention Collective Article 23)
 * Maximum 75 hours/year for CI
 */
export async function validateYearlyOvertimeLimit(
  employeeId: string,
  year: number,
  additionalOvertimeHours: number,
  countryCode: string
): Promise<{ allowed: boolean; warning?: string; error?: string }> {
  const existingYearlyHours = await getYearlyOvertimeHours(employeeId, year);
  const yearlyLimit = 75; // Convention Collective Article 23
  const totalYearlyOvertime = existingYearlyHours + additionalOvertimeHours;

  // Hard block at limit
  if (totalYearlyOvertime > yearlyLimit) {
    return {
      allowed: false,
      error:
        `Dépassement de la limite annuelle d'heures supplémentaires. ` +
        `Maximum: ${yearlyLimit}h/an. ` +
        `Déjà effectué en ${year}: ${existingYearlyHours.toFixed(1)}h. ` +
        `Demandé: ${additionalOvertimeHours.toFixed(1)}h. ` +
        `Total: ${totalYearlyOvertime.toFixed(1)}h. ` +
        `(Convention Collective Article 23)`,
    };
  }

  // Warning at 80% usage (60h)
  const usagePercent = (totalYearlyOvertime / yearlyLimit) * 100;
  if (usagePercent >= 80) {
    return {
      allowed: true,
      warning: `⚠️ Attention: ${totalYearlyOvertime.toFixed(1)}h/${yearlyLimit}h annuelles (${usagePercent.toFixed(0)}%)`,
    };
  }

  return { allowed: true };
}
