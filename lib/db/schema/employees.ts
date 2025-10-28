import { pgTable, uuid, text, date, timestamp, integer, jsonb, pgPolicy, numeric, boolean, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { tenantUser } from './roles';

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Personal info
  employeeNumber: text('employee_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  preferredName: text('preferred_name'),
  dateOfBirth: date('date_of_birth'),
  gender: text('gender'),

  // Contact
  email: text('email').notNull(),
  phone: text('phone'),
  nationalId: text('national_id'),

  // Address
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  postalCode: text('postal_code'),
  countryCode: text('country_code').notNull().default('CI'),

  // Employment
  hireDate: date('hire_date').notNull(),
  terminationDate: date('termination_date'),
  terminationReason: text('termination_reason'),

  // Banking
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),

  // CNPS
  cnpsNumber: text('cnps_number'),

  // Tax
  taxNumber: text('tax_number'),
  taxDependents: integer('tax_dependents').notNull().default(0),

  // Coefficient (catégorie professionnelle)
  coefficient: integer('coefficient').notNull().default(100),

  // Rate type (MONTHLY, DAILY, HOURLY)
  rateType: text('rate_type').notNull().default('MONTHLY'),

  // Termination
  terminationId: uuid('termination_id'),

  // Reporting structure
  reportingManagerId: uuid('reporting_manager_id'),

  // Primary work location (for transport allowance limit)
  primaryLocationId: uuid('primary_location_id'), // References locations(id)

  // Family information (for family deductions)
  maritalStatus: varchar('marital_status'),
  dependentChildren: integer('dependent_children'),
  fiscalParts: numeric('fiscal_parts'),
  hasFamily: boolean('has_family'),

  // Custom fields (Zod validated)
  customFields: jsonb('custom_fields').notNull().default({}),

  // Document expiry (for alerts)
  nationalIdExpiry: date('national_id_expiry'),
  workPermitExpiry: date('work_permit_expiry'),

  // Convention Collective (GAP-CONV-BANK-001)
  conventionCode: varchar('convention_code', { length: 50 }), // 'INTERPRO', 'BANKING', 'BTP'
  professionalLevel: integer('professional_level'), // 1-9 for banking, varies by convention
  sector: varchar('sector', { length: 50 }).default('services'), // 'services', 'industry', 'agriculture'

  // CGECI Barème 2023 Support
  categoryCode: varchar('category_code', { length: 10 }), // 'C', 'M1', '1A', '2B', etc.
  sectorCodeCgeci: varchar('sector_code_cgeci', { length: 50 }), // 'BTP', 'BANQUES', 'COMMERCE', etc.

  // Lifecycle
  status: text('status').notNull().default('active'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
  updatedBy: uuid('updated_by'), // References users(id)
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Employee Dependents Table
 *
 * Tracks individual dependents with document verification for accurate
 * fiscal parts and CMU calculation.
 *
 * Legal Context (Côte d'Ivoire):
 * - Dependents under 21: Automatic eligibility
 * - Dependents over 21: Require "certificat de fréquentation" or school proof
 * - Used for: Fiscal parts (tax deductions) and CMU (health insurance)
 */
export const employeeDependents = pgTable('employee_dependents', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Dependent information
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull(), // 'child', 'spouse', 'other'

  // Verification status
  isVerified: boolean('is_verified').notNull().default(false),
  requiresDocument: boolean('requires_document').notNull().default(false), // TRUE if over 21

  // Document tracking (for dependents over 21)
  documentType: varchar('document_type', { length: 100 }), // 'certificat_frequentation', 'attestation_scolarite', 'carte_etudiant'
  documentNumber: varchar('document_number', { length: 100 }),
  documentIssueDate: date('document_issue_date'),
  documentExpiryDate: date('document_expiry_date'),
  documentUrl: text('document_url'), // Link to uploaded document in storage
  documentNotes: text('document_notes'),

  // Eligibility flags
  eligibleForFiscalParts: boolean('eligible_for_fiscal_parts').notNull().default(true),
  eligibleForCmu: boolean('eligible_for_cmu').notNull().default(true),

  // Additional metadata
  notes: text('notes'),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'inactive', 'expired'

  // Audit fields
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);
