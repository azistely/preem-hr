import { pgTable, uuid, text, date, timestamp, integer, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
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

  // Custom fields (Zod validated)
  customFields: jsonb('custom_fields').notNull().default({}),

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
