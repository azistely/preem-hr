import { pgTable, uuid, text, timestamp, jsonb, varchar, numeric } from 'drizzle-orm/pg-core';
import { countries } from './countries';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  countryCode: text('country_code').notNull().default('CI').references(() => countries.code),
  currency: text('currency').notNull().default('XOF'),
  timezone: text('timezone').notNull().default('Africa/Abidjan'),

  // Business info
  taxId: text('tax_id'),
  businessRegistration: text('business_registration'),
  industry: text('industry'),

  // Sector configuration (required field)
  sectorCode: varchar('sector_code', { length: 50 }).notNull(),

  // CGECI Sector (company-level, determines employee categories and minimum wages)
  cgeciSectorCode: varchar('cgeci_sector_code', { length: 50 }), // 'BANQUES', 'BTP', 'COMMERCE', etc.

  // Generic sector (auto-derived from CGECI sector, used for work accident rates)
  genericSectorCode: varchar('generic_sector_code', { length: 50 }), // 'SERVICES', 'CONSTRUCTION', 'INDUSTRY', etc.

  // Work accident rate (Taux d'accident du travail) provided by CNPS
  workAccidentRate: numeric('work_accident_rate', { precision: 5, scale: 4 }).default('0.0200'), // 0.0000 to 0.1000 (0% to 10%)

  // Daily workers (journaliers) configuration
  defaultDailyTransportRate: numeric('default_daily_transport_rate', { precision: 10, scale: 2 }).default('0'), // Fixed FCFA per day

  // Subscription & features
  plan: text('plan').notNull().default('trial'),
  features: jsonb('features').notNull().default([]),

  // Configuration
  settings: jsonb('settings').notNull().default({}),

  // Lifecycle
  status: text('status').notNull().default('active'),
  trialEndsAt: timestamp('trial_ends_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
