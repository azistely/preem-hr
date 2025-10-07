/**
 * Public Holidays Service
 *
 * Manages public holidays for:
 * - Holiday overtime detection (2.00x multiplier)
 * - Business days calculation in time-off
 * - Payroll compliance
 */

import { db } from '@/db';
import { publicHolidays } from '@/drizzle/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { format, parse, startOfYear, endOfYear } from 'date-fns';

export interface Holiday {
  id: string;
  countryCode: string;
  holidayDate: string;
  name: Record<string, string>; // { fr: "Noël", en: "Christmas" }
  description?: Record<string, string>;
  isRecurring: boolean;
  isPaid: boolean;
}

/**
 * Check if a date is a public holiday
 */
export async function isPublicHoliday(
  date: Date,
  countryCode: string
): Promise<boolean> {
  const dateStr = format(date, 'yyyy-MM-dd');

  const holiday = await db.query.publicHolidays.findFirst({
    where: and(
      eq(publicHolidays.countryCode, countryCode),
      eq(publicHolidays.holidayDate, dateStr)
    ),
  });

  return !!holiday;
}

/**
 * Get all holidays for a country in a specific year
 */
export async function getHolidaysForYear(
  countryCode: string,
  year: number
): Promise<Holiday[]> {
  const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(new Date(year, 11, 31)), 'yyyy-MM-dd');

  const holidays = await db.query.publicHolidays.findMany({
    where: and(
      eq(publicHolidays.countryCode, countryCode),
      gte(publicHolidays.holidayDate, yearStart),
      lte(publicHolidays.holidayDate, yearEnd)
    ),
  });

  return holidays.map((h) => ({
    id: h.id,
    countryCode: h.countryCode,
    holidayDate: h.holidayDate,
    name: h.name as Record<string, string>,
    description: h.description as Record<string, string> | undefined,
    isRecurring: h.isRecurring || false,
    isPaid: h.isPaid || true,
  }));
}

/**
 * Get holidays in a date range
 */
export async function getHolidaysInRange(
  countryCode: string,
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  const holidays = await db.query.publicHolidays.findMany({
    where: and(
      eq(publicHolidays.countryCode, countryCode),
      gte(publicHolidays.holidayDate, startStr),
      lte(publicHolidays.holidayDate, endStr)
    ),
  });

  return holidays.map((h) => ({
    id: h.id,
    countryCode: h.countryCode,
    holidayDate: h.holidayDate,
    name: h.name as Record<string, string>,
    description: h.description as Record<string, string> | undefined,
    isRecurring: h.isRecurring || false,
    isPaid: h.isPaid || true,
  }));
}

/**
 * Get holiday name in French (default language)
 */
export async function getHolidayName(
  date: Date,
  countryCode: string,
  lang: 'fr' | 'en' = 'fr'
): Promise<string | null> {
  const dateStr = format(date, 'yyyy-MM-dd');

  const holiday = await db.query.publicHolidays.findFirst({
    where: and(
      eq(publicHolidays.countryCode, countryCode),
      eq(publicHolidays.holidayDate, dateStr)
    ),
  });

  if (!holiday) return null;

  const names = holiday.name as Record<string, string>;
  return names[lang] || names.fr || null;
}

/**
 * Count business days excluding weekends AND holidays
 * (Used by time-off service)
 */
export async function countBusinessDaysExcludingHolidays(
  startDate: Date,
  endDate: Date,
  countryCode: string
): Promise<number> {
  const holidays = await getHolidaysInRange(countryCode, startDate, endDate);
  const holidayDates = new Set(holidays.map((h) => h.holidayDate));

  let businessDays = 0;
  let current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = format(current, 'yyyy-MM-dd');

    // Count if not weekend AND not holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      businessDays++;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}

/**
 * Get upcoming holidays (next 12 months)
 */
export async function getUpcomingHolidays(
  countryCode: string,
  limit: number = 10
): Promise<Holiday[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextYear = format(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    'yyyy-MM-dd'
  );

  const holidays = await db.query.publicHolidays.findMany({
    where: and(
      eq(publicHolidays.countryCode, countryCode),
      gte(publicHolidays.holidayDate, today),
      lte(publicHolidays.holidayDate, nextYear)
    ),
    limit,
  });

  return holidays.map((h) => ({
    id: h.id,
    countryCode: h.countryCode,
    holidayDate: h.holidayDate,
    name: h.name as Record<string, string>,
    description: h.description as Record<string, string> | undefined,
    isRecurring: h.isRecurring || false,
    isPaid: h.isPaid || true,
  }));
}
