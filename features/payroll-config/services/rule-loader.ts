/**
 * Rule Loader Service
 *
 * High-level service for loading and caching payroll configuration.
 * This service sits above the repository and provides caching to avoid
 * repeated database queries.
 */

import { loadCountryConfig } from '../repositories/payroll-config-repository';
import type { CountryPayrollConfig } from '../types';

/**
 * In-memory cache for payroll configurations
 * Key format: "{countryCode}:{YYYY-MM-DD}"
 */
const configCache = new Map<string, CountryPayrollConfig>();

/**
 * Cache TTL in milliseconds (1 hour)
 * Config rarely changes, so we can cache for a reasonable time
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Cache timestamps to track expiry
 */
const cacheTimestamps = new Map<string, number>();

/**
 * Load payroll configuration for a country with caching
 *
 * This is the main entry point for getting payroll configuration.
 * It uses an in-memory cache to avoid repeated database queries.
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param effectiveDate - Date for which to load rules (defaults to today)
 * @returns Complete payroll configuration
 * @throws Error if configuration not found
 *
 * @example
 * ```typescript
 * const config = await loadPayrollConfig('CI', new Date('2025-01-15'));
 *
 * // Use tax brackets
 * const taxStrategy = new ProgressiveMonthlyTaxStrategy(config.taxBrackets);
 *
 * // Use contributions
 * const cnpsStrategy = new CNPSStrategy(config.contributions);
 * ```
 */
export async function loadPayrollConfig(
  countryCode: string,
  effectiveDate: Date = new Date()
): Promise<CountryPayrollConfig> {
  const cacheKey = getCacheKey(countryCode, effectiveDate);

  // Check cache
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Load from database
  const config = await loadCountryConfig(countryCode, effectiveDate);

  if (!config) {
    throw new Error(
      `No payroll configuration found for country ${countryCode} on ${effectiveDate.toISOString()}`
    );
  }

  // Store in cache
  setInCache(cacheKey, config);

  return config;
}

/**
 * Clear cache for a specific country or all countries
 *
 * Use this after updating payroll configuration to ensure fresh data is loaded.
 *
 * @param countryCode - Country to clear (optional, clears all if omitted)
 */
export function clearConfigCache(countryCode?: string): void {
  if (countryCode) {
    // Clear all entries for this country
    for (const key of configCache.keys()) {
      if (key.startsWith(`${countryCode}:`)) {
        configCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
  } else {
    // Clear everything
    configCache.clear();
    cacheTimestamps.clear();
  }
}

/**
 * Get configuration from cache if valid
 */
function getFromCache(cacheKey: string): CountryPayrollConfig | null {
  const timestamp = cacheTimestamps.get(cacheKey);

  // Check if cache entry exists and is not expired
  if (timestamp && Date.now() - timestamp < CACHE_TTL_MS) {
    return configCache.get(cacheKey) || null;
  }

  // Remove expired entry
  if (timestamp) {
    configCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
  }

  return null;
}

/**
 * Store configuration in cache
 */
function setInCache(cacheKey: string, config: CountryPayrollConfig): void {
  configCache.set(cacheKey, config);
  cacheTimestamps.set(cacheKey, Date.now());
}

/**
 * Generate cache key from country code and date
 */
function getCacheKey(countryCode: string, effectiveDate: Date): string {
  const dateStr = effectiveDate.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${countryCode}:${dateStr}`;
}

/**
 * Get cache statistics (for monitoring/debugging)
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
  oldestEntry: string | null;
  newestEntry: string | null;
} {
  const timestamps = Array.from(cacheTimestamps.entries());
  timestamps.sort((a, b) => a[1] - b[1]);

  return {
    size: configCache.size,
    keys: Array.from(configCache.keys()),
    oldestEntry: timestamps[0]?.[0] || null,
    newestEntry: timestamps[timestamps.length - 1]?.[0] || null,
  };
}
