/**
 * Payment Frequency Utilities
 *
 * Helper functions for displaying payment frequency information
 * in the salary wizard and other UI components.
 *
 * Used for:
 * - Converting payment frequency codes to French labels
 * - Extracting weekly hours from regime strings
 * - Formatting currency amounts
 */

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/**
 * Get French label for payment frequency
 *
 * @param frequency - Payment frequency code
 * @returns French label for the payment frequency
 *
 * @example
 * getPaymentFrequencyLabel('WEEKLY') // 'hebdomadaire'
 * getPaymentFrequencyLabel('DAILY') // 'journalière'
 */
export function getPaymentFrequencyLabel(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'journalière';
    case 'WEEKLY':
      return 'hebdomadaire';
    case 'BIWEEKLY':
      return 'bimensuelle';
    case 'MONTHLY':
    default:
      return 'mensuelle';
  }
}

/**
 * Extract numeric hours from weekly hours regime string
 *
 * @param regime - Weekly hours regime (e.g., '40h', '44h', '48h')
 * @returns Numeric hours value
 *
 * @example
 * getWeeklyHours('40h') // 40
 * getWeeklyHours('48h') // 48
 */
export function getWeeklyHours(regime: string): number {
  return parseInt(regime.replace('h', ''), 10);
}

/**
 * Format amount as French currency (FCFA)
 *
 * @param amount - Amount to format
 * @returns Formatted currency string without currency symbol
 *
 * @example
 * formatCurrency(75000) // '75 000'
 * formatCurrency(2500.5) // '2 501' (rounded)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
}
