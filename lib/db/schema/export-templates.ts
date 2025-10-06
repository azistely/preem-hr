/**
 * Export Templates Schema
 *
 * Database-driven export templates for government portals, banks, and other institutions.
 * Enables configuration-based exports without code changes.
 *
 * Source: docs/05-EPIC-PAYROLL.md Multi-Country Architecture
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';
import { relations } from 'drizzle-orm';

// ========================================
// Export Templates
// ========================================

export const exportTemplates = pgTable('export_templates', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Country and provider identification
  countryCode: varchar('country_code', { length: 2 })
    .notNull()
    .references(() => countries.code),
  templateType: varchar('template_type', { length: 50 }).notNull(), // 'social_security', 'tax', 'health', 'training_tax', 'bank_transfer'
  providerCode: varchar('provider_code', { length: 50 }).notNull(), // 'cnps', 'css', 'bicici', 'sgbci', etc.
  providerName: varchar('provider_name', { length: 200 }).notNull(),

  // File format and structure
  fileFormat: varchar('file_format', { length: 20 }).notNull(), // 'csv', 'xlsx', 'txt', 'xml'
  delimiter: varchar('delimiter', { length: 5 }), // For CSV: ',', ';', '\t', etc.
  encoding: varchar('encoding', { length: 20 }).default('UTF-8'), // 'UTF-8', 'ISO-8859-1', etc.

  // Template structure (stored as JSONB for flexibility)
  columns: jsonb('columns').notNull(), // Array of column definitions
  headers: jsonb('headers'), // Optional header rows (for multi-row headers)
  footers: jsonb('footers'), // Optional footer rows (totals, etc.)

  // File naming configuration
  filenamePattern: varchar('filename_pattern', { length: 200 }), // e.g., "CNPS_{YYYYMM}_{company_code}.xlsx"

  // Version control
  version: varchar('version', { length: 20 }).notNull().default('1.0'),
  effectiveFrom: date('effective_from').notNull().defaultNow(),
  effectiveTo: date('effective_to'),
  isActive: boolean('is_active').notNull().default(true),

  // Documentation
  description: text('description'),
  portalUrl: text('portal_url'),
  documentationUrl: text('documentation_url'),
  sampleFileUrl: text('sample_file_url'),

  // Additional configuration
  metadata: jsonb('metadata'), // Any provider-specific configuration

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ========================================
// Relations
// ========================================

export const exportTemplatesRelations = relations(exportTemplates, ({ one }) => ({
  country: one(countries, {
    fields: [exportTemplates.countryCode],
    references: [countries.code],
  }),
}));

// ========================================
// TypeScript Types
// ========================================

/**
 * Column definition in export template
 */
export interface ExportColumnDefinition {
  position: number; // Column order (1-based index)
  name: string; // Column header name
  sourceField: string; // Dot-notation path to data field (e.g., "employee.full_name", "payroll.gross_salary")
  dataType: 'string' | 'integer' | 'decimal' | 'currency' | 'date' | 'boolean';
  format?: string; // Format string (e.g., "0.00" for decimals, "YYYY-MM-DD" for dates)
  required?: boolean; // Whether this column is mandatory
  defaultValue?: string | number; // Default value if source field is empty
  validation?: string; // Validation regex or rule
  transform?: 'uppercase' | 'lowercase' | 'trim' | 'capitalize'; // Text transformation
  width?: number; // Column width for Excel exports
}

/**
 * Header/Footer row definition
 */
export interface ExportRowDefinition {
  rowNumber: number; // Row position
  cells: Array<{
    column: number; // Column position (1-based)
    value: string; // Static value or template variable
    format?: 'bold' | 'italic' | 'underline'; // Formatting for Excel
  }>;
}

/**
 * Complete template structure
 */
export interface ExportTemplateStructure {
  columns: ExportColumnDefinition[];
  headers?: ExportRowDefinition[];
  footers?: ExportRowDefinition[];
}

/**
 * Metadata for specific providers
 */
export interface ExportTemplateMetadata {
  // CNPS-specific
  cnps?: {
    employerCode?: string;
    periodFormat?: 'YYYYMM' | 'MMYYYY';
  };

  // Bank-specific
  bank?: {
    debitAccountField?: string; // Company account to debit
    transferType?: 'same_bank' | 'interbank' | 'international';
    requiresAuthorizationFile?: boolean;
  };

  // Excel-specific
  excel?: {
    sheetName?: string;
    startRow?: number; // First row for data (after headers)
    freezePanes?: { row: number; col: number };
    styles?: {
      headerBackground?: string;
      headerFontColor?: string;
      alternateRowColors?: boolean;
    };
  };

  // XML-specific
  xml?: {
    rootElement?: string;
    recordElement?: string;
    namespace?: string;
  };
}
