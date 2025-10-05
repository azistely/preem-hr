import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  code: text('code').primaryKey(), // ISO 3166-1 alpha-2
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  currency: text('currency').notNull(),
  timezone: text('timezone').notNull(),

  // Payroll configuration
  payrollRules: jsonb('payroll_rules').notNull(),
  taxBrackets: jsonb('tax_brackets').notNull(),
  contributionRates: jsonb('contribution_rates').notNull(),
  publicHolidays: jsonb('public_holidays').notNull().default([]),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
