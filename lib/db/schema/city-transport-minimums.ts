/**
 * City Transport Minimums Schema
 *
 * Multi-country city-based minimum transport allowances.
 * Follows the same pattern as tax_systems and social_security_schemes.
 *
 * Legal basis (Côte d'Ivoire):
 * - Arrêté du 30 janvier 2020
 * - Abidjan: 30,000 FCFA/mois (1,000 FCFA/jour)
 * - Bouaké: 24,000 FCFA/mois (800 FCFA/jour)
 * - Other cities: 20,000 FCFA/mois (667 FCFA/jour)
 */

import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  jsonb,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';

export const cityTransportMinimums = pgTable(
  'city_transport_minimums',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Country reference
    countryCode: varchar('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: 'cascade' }),

    // City identification
    cityName: varchar('city_name', { length: 100 }).notNull(),
    cityNameNormalized: varchar('city_name_normalized', { length: 100 }).notNull(),

    // Display names (multilingual)
    displayName: jsonb('display_name').notNull(),

    // Transport allowance minimums
    monthlyMinimum: numeric('monthly_minimum', { precision: 15, scale: 2 }).notNull(),
    dailyRate: numeric('daily_rate', { precision: 15, scale: 2 }).notNull(),

    // Tax exemption cap (country-specific)
    taxExemptionCap: numeric('tax_exemption_cap', { precision: 15, scale: 2 }),

    // Effective dates
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),

    // Legal reference
    legalReference: jsonb('legal_reference'),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    countryDateIdx: index('idx_city_transport_country_date').on(
      table.countryCode,
      table.effectiveFrom,
      table.effectiveTo
    ),
    normalizedIdx: index('idx_city_transport_normalized').on(
      table.cityNameNormalized
    ),
  })
);

export type CityTransportMinimum = typeof cityTransportMinimums.$inferSelect;
export type NewCityTransportMinimum = typeof cityTransportMinimums.$inferInsert;
