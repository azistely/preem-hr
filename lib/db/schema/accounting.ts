import { pgTable, uuid, varchar, text, boolean, timestamp, numeric, date, jsonb, index, pgPolicy, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { payrollRuns } from './payroll';
import { departments } from './departments';
import { tenantUser } from './roles';

/**
 * Chart of Accounts
 * Stores accounting account definitions (SYSCOHADA, IFRS, Custom)
 */
export const accountingAccounts = pgTable('accounting_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: varchar('account_type', { length: 50 }), // 'expense', 'liability', 'asset'
  parentAccountCode: varchar('parent_account_code', { length: 20 }),
  isActive: boolean('is_active').default(true),
  accountingSystem: varchar('accounting_system', { length: 50 }).default('SYSCOHADA'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_accounting_accounts_tenant').on(table.tenantId),
  index('idx_accounting_accounts_code').on(table.accountCode),
  pgPolicy('view_system_and_tenant_accounts', {
    as: 'permissive',
    for: 'select',
    to: ['public'],
    using: sql`${table.tenantId} IS NULL OR ${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
  pgPolicy('manage_tenant_accounts', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Payroll Account Mappings
 * Maps payroll components to GL accounts
 */
export const payrollAccountMappings = pgTable('payroll_account_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  componentType: varchar('component_type', { length: 100 }).notNull(),
  debitAccountId: uuid('debit_account_id').references(() => accountingAccounts.id, { onDelete: 'set null' }),
  creditAccountId: uuid('credit_account_id').references(() => accountingAccounts.id, { onDelete: 'set null' }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  costCenter: varchar('cost_center', { length: 50 }),
  isActive: boolean('is_active').default(true),
  effectiveFrom: date('effective_from').defaultNow(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_payroll_account_mappings_tenant').on(table.tenantId),
  index('idx_payroll_account_mappings_component').on(table.componentType),
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * GL Exports
 * History of GL journal exports
 */
export const glExports = pgTable('gl_exports', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'set null' }),
  exportDate: timestamp('export_date').defaultNow(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  exportFormat: varchar('export_format', { length: 50 }),
  fileUrl: text('file_url'),
  fileName: varchar('file_name', { length: 255 }),
  totalDebit: numeric('total_debit', { precision: 15, scale: 2 }),
  totalCredit: numeric('total_credit', { precision: 15, scale: 2 }),
  entryCount: integer('entry_count'),
  exportedBy: uuid('exported_by').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('generated'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_gl_exports_tenant').on(table.tenantId),
  index('idx_gl_exports_payroll_run').on(table.payrollRunId),
  index('idx_gl_exports_period').on(table.tenantId, table.periodStart, table.periodEnd),
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * GL Journal Entries
 * Individual journal entries for preview and validation
 */
export const glJournalEntries = pgTable('gl_journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  exportId: uuid('export_id').notNull().references(() => glExports.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 255 }),
  debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).default('0'),
  creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).default('0'),
  department: varchar('department', { length: 100 }),
  costCenter: varchar('cost_center', { length: 50 }),
  description: text('description'),
  reference: varchar('reference', { length: 100 }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  lineNumber: integer('line_number'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_gl_journal_entries_export').on(table.exportId),
  index('idx_gl_journal_entries_account').on(table.accountCode),
  index('idx_gl_journal_entries_employee').on(table.employeeId),
]);

/**
 * CMU Export Configuration
 * Configuration for CMU 1% export
 */
export const cmuExportConfig = pgTable('cmu_export_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  cmuEmployerNumber: varchar('cmu_employer_number', { length: 50 }),
  cmuRate: numeric('cmu_rate', { precision: 5, scale: 2 }).default('1.0'),
  includeDependents: boolean('include_dependents').default(true),
  exportFormat: varchar('export_format', { length: 50 }).default('CSV'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_cmu_export_config_tenant').on(table.tenantId),
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * ETAT 301 Export Configuration
 * Configuration for monthly ITS declaration
 */
export const etat301Config = pgTable('etat_301_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  dgiTaxNumber: varchar('dgi_tax_number', { length: 50 }),
  exportFormat: varchar('export_format', { length: 50 }).default('PDF'),
  includeAttachments: boolean('include_attachments').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_etat_301_config_tenant').on(table.tenantId),
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Tenant Component Codes
 * Custom component code overrides (e.g., Code 11, 12, 13)
 */
export const tenantComponentCodes = pgTable('tenant_component_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  componentDefinitionId: uuid('component_definition_id'),
  componentType: varchar('component_type', { length: 100 }),
  customCode: varchar('custom_code', { length: 20 }).notNull(),
  customDescription: varchar('custom_description', { length: 255 }),
  effectiveFrom: date('effective_from').defaultNow(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_tenant_component_codes_tenant').on(table.tenantId),
  index('idx_tenant_component_codes_component').on(table.componentDefinitionId),
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);
