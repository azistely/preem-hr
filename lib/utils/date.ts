/**
 * Date formatting utilities
 */

import { format as formatFns, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatFns(dateObj, formatStr, { locale: fr });
}

export function formatDateTime(
  date: Date | string,
  formatStr: string = 'dd/MM/yyyy HH:mm'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatFns(dateObj, formatStr, { locale: fr });
}

export function formatRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) return "Aujourd'hui";
  if (diffInDays === 1) return 'Hier';
  if (diffInDays < 7) return `Il y a ${diffInDays} jours`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `Il y a ${months} mois`;
  }
  const years = Math.floor(diffInDays / 365);
  return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}

/**
 * Add hours to a date
 * Used for legal deadlines like 72h employee response time
 */
export function addHours(date: Date | string, hours: number): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  return new Date(dateObj.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Add business days to a date (excludes weekends)
 * Used for legal deadlines like 15 business days employer decision
 *
 * Note: This does not account for public holidays.
 * For country-specific holiday handling, use with public holidays lookup.
 */
export function addBusinessDays(date: Date | string, days: number): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  let result = new Date(dateObj);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Add business days with public holidays excluded
 * @param date - Start date
 * @param days - Number of business days to add
 * @param holidays - Array of holiday dates (Date objects or ISO strings)
 */
export function addBusinessDaysWithHolidays(
  date: Date | string,
  days: number,
  holidays: (Date | string)[] = []
): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  let result = new Date(dateObj);
  let addedDays = 0;

  // Convert holidays to timestamp Set for O(1) lookup
  const holidaySet = new Set(
    holidays.map((h) => {
      const d = typeof h === 'string' ? parseISO(h) : h;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const isHoliday = (d: Date): boolean => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return holidaySet.has(key);
  };

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result) && !isHoliday(result)) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Calculate number of business days between two dates
 */
export function getBusinessDaysBetween(
  startDate: Date | string,
  endDate: Date | string,
  holidays: (Date | string)[] = []
): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
  const end = typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate);

  if (end <= start) return 0;

  // Convert holidays to timestamp Set for O(1) lookup
  const holidaySet = new Set(
    holidays.map((h) => {
      const d = typeof h === 'string' ? parseISO(h) : h;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const isHoliday = (d: Date): boolean => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return holidaySet.has(key);
  };

  let businessDays = 0;
  const current = new Date(start);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (!isWeekend(current) && !isHoliday(current)) {
      businessDays++;
    }
  }

  return businessDays;
}

/**
 * Check if a deadline is approaching (within threshold)
 * Returns remaining time info for visual indicators
 */
export function getDeadlineStatus(
  deadline: Date | string,
  now: Date = new Date()
): {
  status: 'overdue' | 'critical' | 'warning' | 'ok';
  hoursRemaining: number;
  daysRemaining: number;
  label: string;
} {
  const deadlineDate = typeof deadline === 'string' ? parseISO(deadline) : deadline;
  const msRemaining = deadlineDate.getTime() - now.getTime();
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  if (msRemaining <= 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      status: 'overdue',
      hoursRemaining,
      daysRemaining,
      label: overdueDays === 0
        ? "En retard aujourd'hui"
        : `En retard de ${overdueDays} jour${overdueDays > 1 ? 's' : ''}`,
    };
  }

  if (hoursRemaining < 24) {
    return {
      status: 'critical',
      hoursRemaining,
      daysRemaining,
      label: `${hoursRemaining}h restantes`,
    };
  }

  if (daysRemaining <= 3) {
    return {
      status: 'warning',
      hoursRemaining,
      daysRemaining,
      label: `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`,
    };
  }

  return {
    status: 'ok',
    hoursRemaining,
    daysRemaining,
    label: `${daysRemaining} jours restants`,
  };
}
