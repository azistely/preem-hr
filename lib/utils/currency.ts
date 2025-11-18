/**
 * Currency formatting utilities
 */

export function formatCurrency(amount: number, currency: string = 'FCFA'): string {
  const formatted = amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return `${formatted} ${currency}`;
}

export function parseCurrency(value: string): number {
  // Remove spaces and non-numeric characters except comma and dot
  const cleaned = value.replace(/[^\d,.-]/g, '');
  // Replace comma with dot for parsing
  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}
