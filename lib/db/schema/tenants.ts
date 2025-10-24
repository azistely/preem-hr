import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';
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
  email: text('email'),
  hrEmail: text('hr_email'),

  // CGECI Sector (company-level, determines employee categories and minimum wages)
  cgeciSectorCode: varchar('cgeci_sector_code', { length: 50 }), // 'BANQUES', 'BTP', 'COMMERCE', etc.

  // Generic sector (auto-derived from CGECI sector, used for work accident rates)
  genericSectorCode: varchar('generic_sector_code', { length: 50 }), // 'SERVICES', 'CONSTRUCTION', 'INDUSTRY', etc.

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
