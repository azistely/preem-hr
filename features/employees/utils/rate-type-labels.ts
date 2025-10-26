/**
 * Rate Type Labels and Formatting Utilities
 *
 * Provides consistent labels and formatting for different employee rate types
 * (MONTHLY, DAILY, HOURLY) across the application.
 */

export type RateType = 'MONTHLY' | 'DAILY' | 'HOURLY';

/**
 * Get localized label for base salary based on rate type
 */
export function getBaseSalaryLabel(rateType?: RateType | null): string {
  switch (rateType) {
    case 'DAILY':
      return 'Salaire journalier';
    case 'HOURLY':
      return 'Salaire horaire';
    case 'MONTHLY':
    default:
      return 'Salaire de base';
  }
}

/**
 * Get currency suffix based on rate type
 */
export function getCurrencySuffix(rateType?: RateType | null): string {
  switch (rateType) {
    case 'DAILY':
      return '/jour';
    case 'HOURLY':
      return '/heure';
    case 'MONTHLY':
    default:
      return '/mois';
  }
}

/**
 * Format currency with rate-type aware suffix
 */
export function formatCurrencyWithRate(
  amount: number,
  rateType?: RateType | null,
  currency: string = 'FCFA'
): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount);
  const suffix = getCurrencySuffix(rateType);
  return `${formatted} ${currency}${suffix}`;
}

/**
 * Get period label for salary calculations
 */
export function getPeriodLabel(rateType?: RateType | null): string {
  switch (rateType) {
    case 'DAILY':
      return 'par jour';
    case 'HOURLY':
      return 'par heure';
    case 'MONTHLY':
    default:
      return 'par mois';
  }
}

/**
 * Get gross salary label
 */
export function getGrossSalaryLabel(rateType?: RateType | null): string {
  switch (rateType) {
    case 'DAILY':
      return 'Salaire brut journalier';
    case 'HOURLY':
      return 'Salaire brut horaire';
    case 'MONTHLY':
    default:
      return 'Salaire brut mensuel';
  }
}

/**
 * Get net salary label
 */
export function getNetSalaryLabel(rateType?: RateType | null): string {
  switch (rateType) {
    case 'DAILY':
      return 'Salaire net journalier';
    case 'HOURLY':
      return 'Salaire net horaire';
    case 'MONTHLY':
    default:
      return 'Salaire net mensuel';
  }
}

/**
 * Convert component amount to employee's rate type
 *
 * Components are stored in monthly amounts by convention.
 * This function converts them to daily or hourly rates when needed.
 *
 * Conversion formulas:
 * - Monthly to Daily: amount ÷ 30
 * - Monthly to Hourly: amount ÷ 30 ÷ 8
 *
 * @param monthlyAmount - The component amount (assumed to be monthly)
 * @param employeeRateType - The employee's rate type (MONTHLY/DAILY/HOURLY)
 * @returns The converted amount for the employee's rate type
 */
export function convertMonthlyAmountToRateType(
  monthlyAmount: number,
  employeeRateType?: RateType | null
): number {
  switch (employeeRateType) {
    case 'DAILY':
      return Math.round(monthlyAmount / 30);
    case 'HOURLY':
      return Math.round(monthlyAmount / 30 / 8);
    case 'MONTHLY':
    default:
      return monthlyAmount;
  }
}
