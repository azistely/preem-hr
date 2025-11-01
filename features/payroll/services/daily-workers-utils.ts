/**
 * Daily Workers (Journaliers) Utility Functions
 *
 * Based on DAILY-WORKERS-ARCHITECTURE-V2.md v3.0
 *
 * Core utilities for calculating daily workers payroll with special rules:
 * - Hourly divisor calculation (based on weekly hours regime)
 * - Contribution employeur (employer payroll tax)
 * - Dynamic overtime thresholds
 * - Prorated deductions
 */

/**
 * Weekly hours regime type
 * Determines overtime thresholds and hourly rate divisor
 */
export type WeeklyHoursRegime = '40h' | '44h' | '48h' | '52h' | '56h';

/**
 * Employee type for contribution employeur
 */
export type EmployeeType = 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE';

/**
 * Payment frequency for payroll closures
 */
export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/**
 * Calculate hourly divisor from weekly hours regime
 *
 * Formula: (weeklyHours × 52 weeks) / 12 months
 *
 * Reference: Décret N° 96-203 Article 3
 *
 * @param weeklyHoursRegime - Employee's weekly hours regime
 * @returns Monthly hours divisor
 *
 * @example
 * ```ts
 * calculateHourlyDivisor('40h') // 173.33
 * calculateHourlyDivisor('48h') // 208.00 (agriculture)
 * calculateHourlyDivisor('56h') // 242.67 (security)
 * ```
 */
export function calculateHourlyDivisor(weeklyHoursRegime: WeeklyHoursRegime): number {
  const weeklyHoursMap: Record<WeeklyHoursRegime, number> = {
    '40h': 40,
    '44h': 44,
    '48h': 48,
    '52h': 52,
    '56h': 56,
  };

  const weeklyHours = weeklyHoursMap[weeklyHoursRegime];
  return (weeklyHours * 52) / 12;
}

/**
 * Calculate hourly rate from categorical salary
 *
 * @param categoricalSalary - Monthly categorical salary (salaire catégoriel)
 * @param weeklyHoursRegime - Employee's weekly hours regime
 * @returns Hourly rate in FCFA
 *
 * @example
 * ```ts
 * // Standard 40h worker with 100,000 FCFA salary
 * calculateHourlyRate(100000, '40h') // 577.0 FCFA/hour
 *
 * // Agricultural worker (48h) with same salary
 * calculateHourlyRate(100000, '48h') // 480.8 FCFA/hour
 * ```
 */
export function calculateHourlyRate(
  categoricalSalary: number,
  weeklyHoursRegime: WeeklyHoursRegime
): number {
  const divisor = calculateHourlyDivisor(weeklyHoursRegime);
  return categoricalSalary / divisor;
}

/**
 * Calculate contribution employeur (employer payroll tax)
 *
 * Rates (Article 146 du Code Général des Impôts):
 * - LOCAL/DETACHE/STAGIAIRE: 2.8%
 * - EXPAT: 12%
 *
 * Applied to total gross (including gratification, congés, précarité)
 *
 * @param totalBrut - Total gross salary
 * @param employeeType - Employee classification
 * @returns Contribution employeur amount in FCFA
 *
 * @example
 * ```ts
 * calculateContributionEmployeur(100000, 'LOCAL')  // 2,800 FCFA
 * calculateContributionEmployeur(100000, 'EXPAT')  // 12,000 FCFA
 * ```
 */
export function calculateContributionEmployeur(
  totalBrut: number,
  employeeType: EmployeeType
): number {
  const rate = employeeType === 'EXPAT' ? 0.12 : 0.028;
  return totalBrut * rate;
}

/**
 * Get contribution employeur rate for employee type
 *
 * @param employeeType - Employee classification
 * @returns Rate as decimal (0.028 or 0.12)
 */
export function getContributionEmployeurRate(employeeType: EmployeeType): number {
  return employeeType === 'EXPAT' ? 0.12 : 0.028;
}

/**
 * Get overtime threshold based on weekly hours regime
 *
 * Overtime starts after the employee's normal weekly hours
 *
 * @param weeklyHoursRegime - Employee's weekly hours regime
 * @returns Weekly overtime threshold in hours
 *
 * @example
 * ```ts
 * getOvertimeThreshold('40h') // 40 hours
 * getOvertimeThreshold('48h') // 48 hours (agriculture)
 * getOvertimeThreshold('56h') // 56 hours (security)
 * ```
 */
export function getOvertimeThreshold(weeklyHoursRegime: WeeklyHoursRegime): number {
  const thresholdMap: Record<WeeklyHoursRegime, number> = {
    '40h': 40,
    '44h': 44,
    '48h': 48,
    '52h': 52,
    '56h': 56,
  };

  return thresholdMap[weeklyHoursRegime];
}

/**
 * Overtime classification for weekly hours
 */
export interface OvertimeBreakdown {
  regularHours: number;           // Up to threshold
  hours_threshold_to_plus8: number; // First 8 hours of OT (1.15×)
  hours_above_plus8: number;       // Beyond 8 hours OT (1.50×)
  // Note: Saturday, Sunday, holiday, night hours handled separately
}

/**
 * Classify weekly hours into regular and overtime
 *
 * Rules:
 * - Regular: Up to threshold (based on weekly_hours_regime)
 * - First 8 OT hours: 1.15× multiplier
 * - Beyond 8 OT hours: 1.50× multiplier
 *
 * @param totalWeeklyHours - Total hours worked in week
 * @param weeklyHoursRegime - Employee's weekly hours regime
 * @returns Breakdown of regular and overtime hours
 *
 * @example
 * ```ts
 * // Standard 40h worker who worked 52 hours
 * classifyOvertime(52, '40h')
 * // { regularHours: 40, hours_threshold_to_plus8: 8, hours_above_plus8: 4 }
 *
 * // Agricultural 48h worker who worked 52 hours
 * classifyOvertime(52, '48h')
 * // { regularHours: 48, hours_threshold_to_plus8: 4, hours_above_plus8: 0 }
 * ```
 */
export function classifyOvertime(
  totalWeeklyHours: number,
  weeklyHoursRegime: WeeklyHoursRegime
): OvertimeBreakdown {
  const threshold = getOvertimeThreshold(weeklyHoursRegime);
  const regularHours = Math.min(totalWeeklyHours, threshold);
  const overtimeHours = Math.max(0, totalWeeklyHours - threshold);

  // First 8 hours of overtime: 1.15×
  const hours_threshold_to_plus8 = Math.min(overtimeHours, 8);

  // Beyond 8 hours of overtime: 1.50×
  const hours_above_plus8 = Math.max(0, overtimeHours - 8);

  return {
    regularHours,
    hours_threshold_to_plus8,
    hours_above_plus8,
  };
}

/**
 * Calculate equivalent days for ITS calculation
 *
 * Per HR clarification (2025-10-31): Use equivalent days (hours ÷ 8)
 * not calendar days worked
 *
 * @param totalHours - Total hours worked in period
 * @returns Equivalent days (can be fractional)
 *
 * @example
 * ```ts
 * calculateEquivalentDays(30) // 3.75 days
 * calculateEquivalentDays(40) // 5.00 days
 * ```
 */
export function calculateEquivalentDays(totalHours: number): number {
  return totalHours / 8;
}

/**
 * Suggest weekly hours regime based on employee sector
 *
 * Auto-detection helper for employee creation
 *
 * @param sector - Employee's work sector
 * @returns Suggested weekly hours regime
 *
 * @example
 * ```ts
 * suggestWeeklyHoursForSector('agriculture')   // '48h'
 * suggestWeeklyHoursForSector('sécurité')     // '56h'
 * suggestWeeklyHoursForSector('services')     // '40h'
 * ```
 */
export function suggestWeeklyHoursForSector(sector?: string | null): WeeklyHoursRegime {
  if (!sector) return '40h';

  const sectorLower = sector.toLowerCase();

  if (['agriculture', 'élevage', 'pêche', 'agricole'].some(s => sectorLower.includes(s))) {
    return '48h';
  }

  if (['sécurité', 'gardiennage', 'domestique', 'security'].some(s => sectorLower.includes(s))) {
    return '56h';
  }

  if (['commerce', 'retail'].some(s => sectorLower.includes(s))) {
    return '44h';
  }

  if (['saisonnier', 'seasonal'].some(s => sectorLower.includes(s))) {
    return '52h';
  }

  return '40h'; // Default for services
}

/**
 * Get number of payroll closures per month for payment frequency
 *
 * @param paymentFrequency - Employee's payment frequency
 * @returns Number of closures per month
 *
 * @example
 * ```ts
 * getClosuresPerMonth('MONTHLY')   // 1
 * getClosuresPerMonth('BIWEEKLY')  // 2 (quinzaines)
 * getClosuresPerMonth('WEEKLY')    // 4 (semaines)
 * getClosuresPerMonth('DAILY')     // ~30 (daily)
 * ```
 */
export function getClosuresPerMonth(paymentFrequency: PaymentFrequency): number {
  const closuresMap: Record<PaymentFrequency, number> = {
    MONTHLY: 1,
    BIWEEKLY: 2,
    WEEKLY: 4,
    DAILY: 30, // Approximate
  };

  return closuresMap[paymentFrequency];
}

/**
 * Check if employee is daily/hourly worker (journalier)
 *
 * Journaliers have payment_frequency !== MONTHLY
 *
 * @param paymentFrequency - Employee's payment frequency
 * @returns True if journalier (non-monthly payment)
 */
export function isJournalier(paymentFrequency: PaymentFrequency): boolean {
  return paymentFrequency !== 'MONTHLY';
}

/**
 * Format payment frequency for display
 *
 * @param paymentFrequency - Payment frequency code
 * @returns French display name
 *
 * @example
 * ```ts
 * formatPaymentFrequency('MONTHLY')   // 'Mensuel'
 * formatPaymentFrequency('WEEKLY')    // 'Hebdomadaire'
 * formatPaymentFrequency('BIWEEKLY')  // 'Quinzaine'
 * ```
 */
export function formatPaymentFrequency(paymentFrequency: PaymentFrequency): string {
  const displayMap: Record<PaymentFrequency, string> = {
    MONTHLY: 'Mensuel',
    BIWEEKLY: 'Quinzaine',
    WEEKLY: 'Hebdomadaire',
    DAILY: 'Journalier',
  };

  return displayMap[paymentFrequency];
}
