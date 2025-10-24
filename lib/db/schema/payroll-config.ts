/**
 * Payroll Configuration Schema
 *
 * Multi-country payroll rules schema for tax systems, social security,
 * and other payroll-related configuration.
 */

import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  jsonb,
  numeric,
  boolean,
  integer,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { countries } from './countries';
import { tenantUser } from './roles';

// ========================================
// Tax Systems
// ========================================

export const taxSystems = pgTable('tax_systems', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: varchar('country_code', { length: 2 })
    .notNull()
    .references(() => countries.code),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: jsonb('display_name').notNull(),
  calculationMethod: varchar('calculation_method', { length: 50 }).notNull(),
  supportsFamilyDeductions: boolean('supports_family_deductions')
    .notNull()
    .default(false),
  calculationBase: varchar('calculation_base', { length: 50 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taxBrackets = pgTable('tax_brackets', {
  id: uuid('id').defaultRandom().primaryKey(),
  taxSystemId: uuid('tax_system_id')
    .notNull()
    .references(() => taxSystems.id, { onDelete: 'cascade' }),
  bracketOrder: integer('bracket_order').notNull(),
  minAmount: numeric('min_amount', { precision: 15, scale: 2 }).notNull(),
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }),
  rate: numeric('rate', { precision: 6, scale: 4 }).notNull(),
  description: jsonb('description'),
});

export const familyDeductionRules = pgTable('family_deduction_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  taxSystemId: uuid('tax_system_id')
    .notNull()
    .references(() => taxSystems.id, { onDelete: 'cascade' }),
  fiscalParts: numeric('fiscal_parts', { precision: 3, scale: 1 }).notNull(),
  deductionAmount: numeric('deduction_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  description: jsonb('description'),
});

// ========================================
// Social Security
// ========================================

export const socialSecuritySchemes = pgTable('social_security_schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: varchar('country_code', { length: 2 })
    .notNull()
    .references(() => countries.code),
  agencyCode: varchar('agency_code', { length: 10 }).notNull(),
  agencyName: jsonb('agency_name').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contributionTypes = pgTable('contribution_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id')
    .notNull()
    .references(() => socialSecuritySchemes.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  name: jsonb('name').notNull(),
  employeeRate: numeric('employee_rate', { precision: 6, scale: 4 }),
  employerRate: numeric('employer_rate', { precision: 6, scale: 4 }),
  calculationBase: varchar('calculation_base', { length: 50 }).notNull(),
  ceilingAmount: numeric('ceiling_amount', { precision: 15, scale: 2 }),
  ceilingPeriod: varchar('ceiling_period', { length: 20 }),
  fixedAmount: numeric('fixed_amount', { precision: 15, scale: 2 }),
  isVariableBySector: boolean('is_variable_by_sector').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
});

export const sectorContributionOverrides = pgTable(
  'sector_contribution_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionTypeId: uuid('contribution_type_id')
      .notNull()
      .references(() => contributionTypes.id, { onDelete: 'cascade' }),
    sectorCode: varchar('sector_code', { length: 50 }).notNull(),
    sectorName: jsonb('sector_name').notNull(),
    employerRate: numeric('employer_rate', { precision: 6, scale: 4 }).notNull(),
    riskLevel: varchar('risk_level', { length: 20 }),
  }
);

// ========================================
// Other Taxes
// ========================================

export const otherTaxes = pgTable('other_taxes', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: varchar('country_code', { length: 2 })
    .notNull()
    .references(() => countries.code),
  code: varchar('code', { length: 50 }).notNull(),
  name: jsonb('name').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 4 }).notNull(),
  calculationBase: varchar('calculation_base', { length: 50 }).notNull(),
  paidBy: varchar('paid_by', { length: 20 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ========================================
// Salary Components
// ========================================

export const salaryComponentDefinitions = pgTable(
  'salary_component_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryCode: varchar('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    code: varchar('code', { length: 50 }).notNull(),
    name: jsonb('name').notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    componentType: varchar('component_type', { length: 50 }).notNull(),
    isTaxable: boolean('is_taxable').notNull().default(true),
    isSubjectToSocialSecurity: boolean('is_subject_to_social_security')
      .notNull()
      .default(true),
    calculationMethod: varchar('calculation_method', { length: 50 }),
    defaultValue: numeric('default_value', { precision: 15, scale: 2 }),
    displayOrder: integer('display_order').notNull().default(0),
    isCommon: boolean('is_common').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
);

// ========================================
// Employee Categories & Coefficients
// ========================================

export const employeeCategoryCoefficients = pgTable(
  'employee_category_coefficients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryCode: varchar('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: 'cascade' }),

    // Category information
    category: varchar('category', { length: 10 }).notNull(),
    labelFr: varchar('label_fr', { length: 255 }).notNull(),

    // CGECI sector support (NULL for generic Convention Collective categories)
    sectorCode: varchar('sector_code', { length: 50 }),

    // Coefficient range (for generic categories)
    minCoefficient: integer('min_coefficient').notNull(),
    maxCoefficient: integer('max_coefficient').notNull(),

    // Actual minimum wage (for CGECI sector-specific categories)
    actualMinimumWage: numeric('actual_minimum_wage', {
      precision: 15,
      scale: 2,
    }),

    // Legacy: minimum wage base type (SMIG, SMAG, etc.)
    minimumWageBase: varchar('minimum_wage_base', { length: 20 })
      .notNull()
      .default('SMIG'),

    // Notice periods
    noticePeriodDays: integer('notice_period_days').notNull(),
    noticeReductionPercent: integer('notice_reduction_percent')
      .notNull()
      .default(0),

    // Metadata
    legalReference: varchar('legal_reference', { length: 500 }),
    notes: varchar('notes', { length: 1000 }),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('employee_categories_read_all', {
      as: 'permissive',
      for: 'select',
      to: tenantUser,
      using: sql`true`,
    }),
  ]
);
