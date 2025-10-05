/**
 * Payroll Configuration Module
 *
 * Multi-country payroll rules and calculation strategies.
 */

// Types
export type * from './types';

// Services
export { loadPayrollConfig, clearConfigCache, getCacheStats } from './services/rule-loader';

// Repositories
export { loadCountryConfig } from './repositories/payroll-config-repository';

// Strategies
export { ProgressiveMonthlyTaxStrategy } from './strategies/progressive-monthly-tax-strategy';
export type { TaxCalculationInput, TaxCalculationResult } from './strategies/progressive-monthly-tax-strategy';
