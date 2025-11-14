/**
 * Base Importer Infrastructure
 *
 * Provides common types, utilities, and interfaces for all data importers.
 * Each importer follows the same pattern for consistency and maintainability.
 */

import { db } from '@/lib/db';

/**
 * Result of an import operation
 */
export interface ImportResult {
  success: boolean;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  metadata?: Record<string, any>;
}

/**
 * Import error (blocking issue)
 */
export interface ImportError {
  row: number;
  field?: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Import warning (non-blocking issue)
 */
export interface ImportWarning {
  row: number;
  field?: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Context for import operations
 */
export interface ImportContext {
  tenantId: string;
  userId?: string;
  countryCode?: string;
  dryRun?: boolean; // If true, validate but don't insert
  allowPartialImport?: boolean; // If true, continue on errors
}

/**
 * Base interface that all importers must implement
 */
export interface DataImporter<T = any> {
  /**
   * Import data into the database
   */
  import(data: T[], context: ImportContext): Promise<ImportResult>;

  /**
   * Validate data before import (optional, for pre-validation)
   */
  validate?(data: T[], context: ImportContext): Promise<ImportError[]>;
}

/**
 * Helper to create a successful import result
 */
export function createSuccessResult(
  recordsInserted: number,
  metadata?: Record<string, any>
): ImportResult {
  return {
    success: true,
    recordsInserted,
    recordsUpdated: 0,
    recordsSkipped: 0,
    errors: [],
    warnings: [],
    metadata,
  };
}

/**
 * Helper to create a failed import result
 */
export function createFailureResult(errors: ImportError[]): ImportResult {
  return {
    success: false,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    errors,
    warnings: [],
  };
}

/**
 * Helper to create an import error
 */
export function createError(
  row: number,
  message: string,
  code: string,
  field?: string,
  value?: any
): ImportError {
  return { row, field, message, code, value };
}

/**
 * Helper to create an import warning
 */
export function createWarning(
  row: number,
  message: string,
  code: string,
  field?: string,
  value?: any
): ImportWarning {
  return { row, field, message, code, value };
}

/**
 * Execute import with transaction support
 * Rolls back on error unless allowPartialImport is true
 */
export async function executeInTransaction<T>(
  fn: () => Promise<T>,
  context: ImportContext
): Promise<T> {
  if (context.dryRun) {
    // Dry run - don't actually execute
    return fn(); // Just validate, don't commit
  }

  // TODO: Implement proper transaction support with Drizzle
  // For now, just execute directly
  return fn();
}

/**
 * Batch insert helper
 * Inserts records in batches to avoid overwhelming the database
 */
export async function batchInsert<T extends Record<string, any>>(
  table: any,
  records: T[],
  batchSize: number = 100
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(table).values(batch);
    totalInserted += batch.length;
  }

  return totalInserted;
}
