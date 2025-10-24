import { pgTable, uuid, text, integer, timestamp, jsonb, pgPolicy, numeric, date, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Data Migrations Table
 * Tracks SAGE/CIEL data migration operations
 */
export const dataMigrations = pgTable('data_migrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Migration details
  migrationType: text('migration_type').notNull(), // 'sage_employees', 'sage_payroll', 'sage_accounts'
  sourceSystem: text('source_system').notNull(), // 'SAGE', 'CIEL', 'EXCEL', 'CSV'

  // File information
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSizeBytes: integer('file_size_bytes'),

  // Progress tracking
  totalRecords: integer('total_records').notNull().default(0),
  importedRecords: integer('imported_records').notNull().default(0),
  failedRecords: integer('failed_records').notNull().default(0),

  // Status
  migrationStatus: text('migration_status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed', 'cancelled'

  // Configuration
  fieldMapping: jsonb('field_mapping'), // User-configured field mappings
  validationResults: jsonb('validation_results'), // Validation errors/warnings
  errorLog: jsonb('error_log').notNull().default([]), // Array of error objects

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),

  // Audit
  migratedBy: uuid('migrated_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  // Indexes
  index('idx_data_migrations_tenant').on(table.tenantId, table.createdAt),
  index('idx_data_migrations_status').on(table.tenantId, table.migrationStatus),
  index('idx_data_migrations_type').on(table.tenantId, table.migrationType, table.createdAt),
  index('idx_data_migrations_user').on(table.migratedBy, table.createdAt),

  // Constraints
  check('data_migrations_count_check', sql`${table.importedRecords} + ${table.failedRecords} <= ${table.totalRecords}`),
  check('data_migrations_type_check', sql`${table.migrationType} IN ('sage_employees', 'sage_payroll', 'sage_accounts')`),
  check('data_migrations_source_check', sql`${table.sourceSystem} IN ('SAGE', 'CIEL', 'EXCEL', 'CSV')`),
  check('data_migrations_status_check', sql`${table.migrationStatus} IN ('pending', 'processing', 'completed', 'failed', 'cancelled')`),

  // RLS Policy
  pgPolicy('data_migrations_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

/**
 * Historical Payroll Data Table
 * Stores historical payroll data imported from SAGE/CIEL
 */
export const historicalPayrollData = pgTable('historical_payroll_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  migrationId: uuid('migration_id').references(() => dataMigrations.id, { onDelete: 'cascade' }),

  // Employee identification
  employeeNumber: text('employee_number').notNull(),
  employeeName: text('employee_name'),

  // Period
  payrollPeriod: text('payroll_period').notNull(), // 'YYYY-MM' format

  // Salary amounts
  grossSalary: numeric('gross_salary', { precision: 15, scale: 2 }),
  netSalary: numeric('net_salary', { precision: 15, scale: 2 }),

  // Social security contributions
  cnpsEmployee: numeric('cnps_employee', { precision: 15, scale: 2 }),
  cnpsEmployer: numeric('cnps_employer', { precision: 15, scale: 2 }),

  // Tax
  its: numeric('its', { precision: 15, scale: 2 }),

  // Detailed components (JSONB for flexibility)
  components: jsonb('components').notNull().default({}),
  deductions: jsonb('deductions').notNull().default({}),

  // Source data (for audit)
  sourceData: jsonb('source_data'),

  // Payment information
  paymentDate: date('payment_date'),
  paymentMethod: text('payment_method'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  // Indexes
  index('idx_historical_payroll_employee').on(table.tenantId, table.employeeNumber),
  index('idx_historical_payroll_period').on(table.tenantId, table.payrollPeriod),
  index('idx_historical_payroll_migration').on(table.migrationId),
  index('idx_historical_payroll_employee_period').on(table.tenantId, table.employeeNumber, table.payrollPeriod),

  // RLS Policy
  pgPolicy('historical_payroll_data_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

/**
 * Employee Import Staging Table
 * Validates employee data before final insert
 */
export const employeeImportStaging = pgTable('employee_import_staging', {
  id: uuid('id').defaultRandom().primaryKey(),
  migrationId: uuid('migration_id').notNull().references(() => dataMigrations.id, { onDelete: 'cascade' }),

  // Row tracking
  rowNumber: integer('row_number').notNull(),

  // Employee data (mapped from SAGE)
  employeeNumber: text('employee_number').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  categoryCode: text('category_code'),
  baseSalary: numeric('base_salary', { precision: 15, scale: 2 }),
  hireDate: date('hire_date'),
  department: text('department'),
  positionTitle: text('position_title'),

  // Additional fields (optional)
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  familySituation: text('family_situation'),

  // Source data (preserves all original fields)
  sourceData: jsonb('source_data').notNull(),

  // Validation
  validationStatus: text('validation_status').notNull().default('pending'), // 'pending', 'valid', 'invalid', 'warning'
  validationErrors: jsonb('validation_errors').notNull().default([]),
  validationWarnings: jsonb('validation_warnings').notNull().default([]),

  // Import result
  importedEmployeeId: uuid('imported_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  importError: text('import_error'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  // Indexes
  index('idx_employee_staging_migration').on(table.migrationId),
  index('idx_employee_staging_status').on(table.migrationId, table.validationStatus),
  index('idx_employee_staging_employee').on(table.importedEmployeeId),

  // Constraints
  check('employee_staging_status_check', sql`${table.validationStatus} IN ('pending', 'valid', 'invalid', 'warning')`),

  // RLS Policy (inherits from migration)
  pgPolicy('employee_import_staging_via_migration', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`EXISTS (
      SELECT 1 FROM data_migrations dm
      WHERE dm.id = ${table.migrationId}
        AND (
          dm.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          OR (auth.jwt() ->> 'role') = 'super_admin'
        )
    )`,
  }),
]);

// Type exports for use in application code
export type DataMigration = typeof dataMigrations.$inferSelect;
export type NewDataMigration = typeof dataMigrations.$inferInsert;
export type HistoricalPayrollData = typeof historicalPayrollData.$inferSelect;
export type NewHistoricalPayrollData = typeof historicalPayrollData.$inferInsert;
export type EmployeeImportStaging = typeof employeeImportStaging.$inferSelect;
export type NewEmployeeImportStaging = typeof employeeImportStaging.$inferInsert;
