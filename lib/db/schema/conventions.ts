/**
 * Convention Collectives Schema (GAP-CONV-BANK-001)
 *
 * Collective labor agreements with sector-specific professional levels
 * and compensation rules (e.g., banking sector with 9 levels I-IX)
 */

import { pgTable, uuid, varchar, timestamp, integer, numeric, jsonb, boolean, pgPolicy, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { countries } from './countries';
import { tenantUser } from './roles';

/**
 * Convention Collectives
 * Master table for collective labor agreements by country
 */
export const conventionCollectives = pgTable('convention_collectives', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: varchar('country_code', { length: 2 }).notNull().references(() => countries.code),
  conventionCode: varchar('convention_code', { length: 50 }).notNull(), // 'INTERPRO', 'BANKING', 'BTP'
  conventionName: varchar('convention_name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // Public read access (all tenants can see available conventions)
  pgPolicy('public_read', {
    as: 'permissive',
    for: 'select',
    to: tenantUser,
    using: sql`true`,
  }),
  // Super admin can manage
  pgPolicy('super_admin_manage', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

/**
 * Banking Professional Levels
 * 9 professional levels (I-IX) used in banking sector
 */
export const bankingProfessionalLevels = pgTable('banking_professional_levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  conventionId: uuid('convention_id').notNull().references(() => conventionCollectives.id, { onDelete: 'cascade' }),
  levelNumber: integer('level_number').notNull(), // 1-9 (I-IX)
  levelName: varchar('level_name', { length: 10 }).notNull(), // 'I', 'II', 'III', ..., 'IX'
  minimumSalary: numeric('minimum_salary', { precision: 15, scale: 2 }).notNull(),
  typicalPositions: text('typical_positions').array(), // ['Caissier', 'Guichetier']
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // Public read access
  pgPolicy('public_read', {
    as: 'permissive',
    for: 'select',
    to: tenantUser,
    using: sql`true`,
  }),
  // Super admin can manage
  pgPolicy('super_admin_manage', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

/**
 * Banking Seniority Bonuses
 * Automatic bonuses based on years of service (+3% every 3 years)
 */
export const bankingSeniorityBonuses = pgTable('banking_seniority_bonuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  conventionId: uuid('convention_id').notNull().references(() => conventionCollectives.id, { onDelete: 'cascade' }),
  yearsOfService: integer('years_of_service').notNull(),
  bonusPercentage: numeric('bonus_percentage', { precision: 5, scale: 2 }).notNull(), // 3.00 = 3%
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // Public read access
  pgPolicy('public_read', {
    as: 'permissive',
    for: 'select',
    to: tenantUser,
    using: sql`true`,
  }),
  // Super admin can manage
  pgPolicy('super_admin_manage', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`(auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

// Type inference
export type ConventionCollective = typeof conventionCollectives.$inferSelect;
export type NewConventionCollective = typeof conventionCollectives.$inferInsert;

export type BankingProfessionalLevel = typeof bankingProfessionalLevels.$inferSelect;
export type NewBankingProfessionalLevel = typeof bankingProfessionalLevels.$inferInsert;

export type BankingSeniorityBonus = typeof bankingSeniorityBonuses.$inferSelect;
export type NewBankingSeniorityBonus = typeof bankingSeniorityBonuses.$inferInsert;
