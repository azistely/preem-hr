import { pgTable, text, boolean, timestamp, jsonb, uuid, varchar, integer } from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  code: varchar('code', { length: 2 }).notNull().unique(),
  name: jsonb('name').notNull(), // { fr: string, en?: string }
  currencyCode: varchar('currency_code', { length: 3 }).notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
