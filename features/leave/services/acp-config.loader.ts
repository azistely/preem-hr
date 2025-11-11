/**
 * ACP Configuration Loader Service
 *
 * Loads and caches ACP (Allocations de Congés Payés) configuration from database.
 * Configuration is country-specific and includes calculation parameters like
 * days per month factor, multipliers, and reference period settings.
 *
 * @module features/leave/services/acp-config-loader
 */

import { db } from '@/lib/db'
import { acpConfiguration } from '@/lib/db/schema'
import { and, eq, or, isNull, lte, gte } from 'drizzle-orm'

/**
 * ACP Configuration for a specific country
 */
export interface ACPConfiguration {
  id: string
  countryCode: string
  daysPerMonthFactor: number
  calendarDayMultiplier: number
  defaultPaidDaysPerMonth: number
  includesBaseSalary: boolean
  includesTaxableAllowances: boolean
  includesNonTaxableAllowances: boolean
  includesBonuses: boolean
  includesOvertime: boolean
  referencePeriodType: 'since_last_leave' | 'calendar_year' | 'rolling_12_months'
  effectiveFrom: Date
  effectiveTo: Date | null
}

/**
 * In-memory cache for ACP configurations
 * Key: countryCode
 * Value: ACPConfiguration
 */
const configCache = new Map<string, ACPConfiguration>()

/**
 * Load ACP configuration for a specific country
 *
 * Loads the currently active configuration based on:
 * - Country code matches
 * - Current date is >= effective_from
 * - Current date is < effective_to (or effective_to is NULL)
 *
 * Results are cached in memory to avoid repeated database queries.
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'CI', 'SN')
 * @param asOfDate - Date to check configuration for (default: today)
 * @param bypassCache - Force reload from database (default: false)
 * @returns Active ACP configuration for the country
 * @throws Error if no configuration found for country
 *
 * @example
 * ```typescript
 * const config = await loadACPConfig('CI')
 * console.log(config.daysPerMonthFactor) // 2.2
 * console.log(config.calendarDayMultiplier) // 1.25
 * ```
 */
export async function loadACPConfig(
  countryCode: string,
  asOfDate: Date = new Date(),
  bypassCache = false
): Promise<ACPConfiguration> {
  // Check cache first (unless bypass requested)
  if (!bypassCache && configCache.has(countryCode)) {
    const cached = configCache.get(countryCode)!

    // Verify cached config is still valid for the date
    if (
      cached.effectiveFrom <= asOfDate &&
      (cached.effectiveTo === null || cached.effectiveTo > asOfDate)
    ) {
      return cached
    }

    // Cached config expired, remove from cache
    configCache.delete(countryCode)
  }

  // Format date for database comparison (YYYY-MM-DD)
  const asOfDateStr = asOfDate.toISOString().split('T')[0]

  // Load from database
  const configs = await db
    .select()
    .from(acpConfiguration)
    .where(
      and(
        eq(acpConfiguration.countryCode, countryCode),
        lte(acpConfiguration.effectiveFrom, asOfDateStr),
        or(
          isNull(acpConfiguration.effectiveTo),
          gte(acpConfiguration.effectiveTo, asOfDateStr)
        )
      )
    )
    .orderBy(acpConfiguration.effectiveFrom)
    .limit(1)

  if (configs.length === 0) {
    throw new Error(
      `No ACP configuration found for country: ${countryCode}. ` +
        `Please configure ACP settings in the database first.`
    )
  }

  const dbConfig = configs[0]

  // Map database result to interface (parse date strings to Date objects)
  const config: ACPConfiguration = {
    id: dbConfig.id,
    countryCode: dbConfig.countryCode,
    daysPerMonthFactor: Number(dbConfig.daysPerMonthFactor),
    calendarDayMultiplier: Number(dbConfig.calendarDayMultiplier),
    defaultPaidDaysPerMonth: dbConfig.defaultPaidDaysPerMonth,
    includesBaseSalary: dbConfig.includesBaseSalary,
    includesTaxableAllowances: dbConfig.includesTaxableAllowances,
    includesNonTaxableAllowances: dbConfig.includesNonTaxableAllowances,
    includesBonuses: dbConfig.includesBonuses,
    includesOvertime: dbConfig.includesOvertime,
    referencePeriodType: dbConfig.referencePeriodType as ACPConfiguration['referencePeriodType'],
    effectiveFrom: new Date(dbConfig.effectiveFrom),
    effectiveTo: dbConfig.effectiveTo ? new Date(dbConfig.effectiveTo) : null,
  }

  // Cache for future use
  configCache.set(countryCode, config)

  return config
}

/**
 * Clear configuration cache
 *
 * Useful for testing or when configuration has been updated in database.
 *
 * @param countryCode - Optional country code to clear specific cache entry.
 *                      If not provided, clears entire cache.
 *
 * @example
 * ```typescript
 * // Clear specific country cache
 * clearACPConfigCache('CI')
 *
 * // Clear all caches
 * clearACPConfigCache()
 * ```
 */
export function clearACPConfigCache(countryCode?: string): void {
  if (countryCode) {
    configCache.delete(countryCode)
  } else {
    configCache.clear()
  }
}

/**
 * Preload ACP configuration for multiple countries
 *
 * Useful for application startup to warm up the cache.
 *
 * @param countryCodes - Array of country codes to preload
 * @returns Object mapping country codes to their configurations
 *
 * @example
 * ```typescript
 * // Preload configs for West African countries
 * const configs = await preloadACPConfigs(['CI', 'SN', 'BF', 'TG'])
 * console.log(configs.CI.daysPerMonthFactor) // 2.2
 * ```
 */
export async function preloadACPConfigs(
  countryCodes: string[]
): Promise<Record<string, ACPConfiguration>> {
  const configs: Record<string, ACPConfiguration> = {}

  await Promise.all(
    countryCodes.map(async (code) => {
      try {
        configs[code] = await loadACPConfig(code)
      } catch (error) {
        // Log error but continue loading other configs
        console.warn(`Failed to preload ACP config for ${code}:`, error)
      }
    })
  )

  return configs
}

/**
 * Get all available ACP configurations from database
 *
 * Returns all configurations regardless of effective dates.
 * Useful for admin UI to display and manage configurations.
 *
 * @returns Array of all ACP configurations
 *
 * @example
 * ```typescript
 * const allConfigs = await getAllACPConfigs()
 * console.log(`Total configs: ${allConfigs.length}`)
 * ```
 */
export async function getAllACPConfigs(): Promise<ACPConfiguration[]> {
  const configs = await db
    .select()
    .from(acpConfiguration)
    .orderBy(acpConfiguration.countryCode, acpConfiguration.effectiveFrom)

  return configs.map((dbConfig) => ({
    id: dbConfig.id,
    countryCode: dbConfig.countryCode,
    daysPerMonthFactor: Number(dbConfig.daysPerMonthFactor),
    calendarDayMultiplier: Number(dbConfig.calendarDayMultiplier),
    defaultPaidDaysPerMonth: dbConfig.defaultPaidDaysPerMonth,
    includesBaseSalary: dbConfig.includesBaseSalary,
    includesTaxableAllowances: dbConfig.includesTaxableAllowances,
    includesNonTaxableAllowances: dbConfig.includesNonTaxableAllowances,
    includesBonuses: dbConfig.includesBonuses,
    includesOvertime: dbConfig.includesOvertime,
    referencePeriodType: dbConfig.referencePeriodType as ACPConfiguration['referencePeriodType'],
    effectiveFrom: new Date(dbConfig.effectiveFrom),
    effectiveTo: dbConfig.effectiveTo ? new Date(dbConfig.effectiveTo) : null,
  }))
}
