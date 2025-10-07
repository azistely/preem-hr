/**
 * Overtime Detection & Classification Service
 *
 * Detects and classifies overtime hours based on country-specific rules.
 * Supports:
 * - Weekly hour thresholds (40h, 46h+)
 * - Night work detection (21h-6h)
 * - Weekend work
 * - Public holidays
 * - Country-specific multipliers
 */

import { db } from '@/db';
import { overtimeRules, timeEntries, employees } from '@/drizzle/schema';
import { and, eq, gte, lte, or, isNull, sql } from 'drizzle-orm';
import {
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  getDay,
  getHours,
  getMinutes,
  addHours,
} from 'date-fns';
import { isPublicHoliday } from './holiday.service';

export interface OvertimeBreakdown {
  regular: number; // Regular hours (up to 40)
  hours_41_to_46?: number; // Hours 41-46 (CI: x1.15)
  hours_above_46?: number; // Hours 46+ (CI: x1.50)
  night_work?: number; // Night hours (21h-6h, CI: x1.75)
  saturday?: number; // Saturday hours (CI: x1.50)
  sunday?: number; // Sunday hours (CI: x1.75)
  public_holiday?: number; // Public holiday hours (CI: x2.00)
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

  const weeklyEntries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(weekStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(weekEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  const hoursThisWeek = weeklyEntries.reduce((sum, entry) => {
    return sum + (entry.totalHours ? parseFloat(entry.totalHours as string) : 0);
  }, 0);

  // Get overtime rules for country
  const rules = await getOvertimeRules(countryCode);

  const breakdown: OvertimeBreakdown = {
    regular: 0,
  };

  // Check if this is a public holiday (highest priority - 2.00x)
  const isHoliday = await isPublicHoliday(clockIn, countryCode);
  if (isHoliday) {
    breakdown.public_holiday = totalHours;
    // Holiday work takes precedence over everything else
    return breakdown;
  }

  // Detect Sunday work (1.75x) - higher than Saturday
  if (isSunday(clockIn)) {
    breakdown.sunday = totalHours;
    // Sunday work takes precedence over other overtime classifications
    return breakdown;
  }

  // Detect Saturday work (1.50x)
  if (isSaturday(clockIn)) {
    breakdown.saturday = totalHours;
    // Saturday work takes precedence over weekday overtime
    return breakdown;
  }

  // Detect night work (1.75x) - can overlap with weekday overtime
  const nightRule = rules.find((r) => r.ruleType === 'night_work');
  if (nightRule && nightRule.appliesFromTime && nightRule.appliesToTime) {
    const [fromHour] = nightRule.appliesFromTime.split(':').map(Number);
    const [toHour] = nightRule.appliesToTime.split(':').map(Number);
    breakdown.night_work = calculateHoursInRange(clockIn, clockOut, fromHour, toHour);
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
): Promise<OvertimeBreakdown> {
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      gte(timeEntries.clockIn, format(periodStart, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      lte(timeEntries.clockIn, format(periodEnd, "yyyy-MM-dd'T'HH:mm:ssXXX")),
      eq(timeEntries.status, 'approved')
    ),
  });

  const summary: OvertimeBreakdown = {
    regular: 0,
    hours_41_to_46: 0,
    hours_above_46: 0,
    night_work: 0,
    saturday: 0,
    sunday: 0,
    public_holiday: 0,
  };

  for (const entry of entries) {
    const breakdown = entry.overtimeBreakdown as OvertimeBreakdown;
    if (breakdown) {
      summary.regular += breakdown.regular || 0;
      summary.hours_41_to_46 = (summary.hours_41_to_46 || 0) + (breakdown.hours_41_to_46 || 0);
      summary.hours_above_46 = (summary.hours_above_46 || 0) + (breakdown.hours_above_46 || 0);
      summary.night_work = (summary.night_work || 0) + (breakdown.night_work || 0);
      summary.saturday = (summary.saturday || 0) + (breakdown.saturday || 0);
      summary.sunday = (summary.sunday || 0) + (breakdown.sunday || 0);
      summary.public_holiday = (summary.public_holiday || 0) + (breakdown.public_holiday || 0);
    }
  }

  return summary;
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
