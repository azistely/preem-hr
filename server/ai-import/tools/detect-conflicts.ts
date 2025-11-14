/**
 * Detect Conflicts Tool - Find Data Inconsistencies Across Sources
 *
 * This tool analyzes matched records and detects when the same field
 * has different values from different sources.
 *
 * Conflict severity:
 * - CRITICAL: Core identity fields (name, employeeNumber, hireDate)
 * - MEDIUM: Important fields (salary, position, department)
 * - LOW: Optional fields (phone, address)
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RecordMatch,
  FieldConflict,
  ConflictSeverity,
} from '../types';

/**
 * Critical fields that MUST be consistent across sources
 * These are identity-defining fields
 */
const CRITICAL_FIELDS = new Set([
  'employeeNumber',
  'firstName',
  'lastName',
  'hireDate',
  'cnpsNumber',
  'email',
  'dateOfBirth',
]);

/**
 * Important fields that should be consistent
 * Differences here are concerning but not show-stoppers
 */
const IMPORTANT_FIELDS = new Set([
  'baseSalary',
  'position',
  'department',
  'contractType',
  'bankAccountNumber',
  'taxId',
  'salary',
  'grossSalary',
  'netSalary',
]);

/**
 * Detect conflicts in matched records
 *
 * For each field that appears in multiple sources, check if values differ.
 * If they do, create a conflict object with severity rating.
 */
export function detectConflicts(params: {
  matches: RecordMatch[];
  entityType: string;
}): FieldConflict[] {
  const { matches } = params;
  const conflicts: FieldConflict[] = [];

  // Process each matched entity
  for (const match of matches) {
    // Only check for conflicts if entity has multiple sources
    if (match.sourceRecords.length < 2) {
      continue;
    }

    // Get all fields that appear across sources
    const allFields = new Set<string>();
    for (const source of match.sourceRecords) {
      Object.keys(source.data).forEach((field) => allFields.add(field));
    }

    // Check each field for conflicts
    for (const field of allFields) {
      const conflict = detectFieldConflict(match, field);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

/**
 * Detect conflict for a specific field across sources
 */
function detectFieldConflict(
  match: RecordMatch,
  field: string
): FieldConflict | null {
  // Get values from all sources
  const sources = match.sourceRecords
    .map((source) => ({
      fileName: source.fileName,
      sheetName: source.sheetName,
      value: source.data[field],
      uploadedAt: source.parsedAt,
      metadata: {
        dataType: source.dataType,
      },
    }))
    .filter((s) => s.value !== undefined && s.value !== null && s.value !== '');

  // No conflict if field appears in only one source or not at all
  if (sources.length < 2) {
    return null;
  }

  // Normalize values for comparison
  const normalizedValues = sources.map((s) => normalizeValue(s.value));

  // Check if all values are the same
  const uniqueValues = new Set(normalizedValues);
  if (uniqueValues.size === 1) {
    // No conflict - all sources agree
    return null;
  }

  // Conflict detected!
  const severity = getFieldSeverity(field);

  return {
    conflictId: uuidv4(),
    entityId: match.entityId,
    field,
    sources,
    severity,
    resolved: false,
  };
}

/**
 * Normalize a value for comparison
 *
 * This handles:
 * - Case differences (KOUASSI vs kouassi)
 * - Whitespace differences
 * - Date format differences (2024-01-15 vs 15/01/2024)
 * - Number format differences (75000 vs 75,000)
 */
function normalizeValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Handle numbers
  if (typeof value === 'number') {
    return String(value);
  }

  // Handle strings
  let normalized = String(value).trim().toLowerCase();

  // Remove common punctuation and whitespace variations
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[,\.]/g, '');

  return normalized;
}

/**
 * Determine severity of a field conflict
 */
function getFieldSeverity(field: string): ConflictSeverity {
  const normalizedField = field.toLowerCase();

  if (CRITICAL_FIELDS.has(field) || containsKeyword(normalizedField, ['number', 'name', 'hire', 'birth', 'email'])) {
    return 'critical';
  }

  if (IMPORTANT_FIELDS.has(field) || containsKeyword(normalizedField, ['salary', 'position', 'contract', 'bank', 'tax'])) {
    return 'medium';
  }

  return 'low';
}

/**
 * Check if field name contains any of the keywords
 */
function containsKeyword(fieldName: string, keywords: string[]): boolean {
  return keywords.some((keyword) => fieldName.includes(keyword));
}

/**
 * Group conflicts by severity
 */
export function groupConflictsBySeverity(
  conflicts: FieldConflict[]
): Record<ConflictSeverity, FieldConflict[]> {
  return {
    critical: conflicts.filter((c) => c.severity === 'critical'),
    medium: conflicts.filter((c) => c.severity === 'medium'),
    low: conflicts.filter((c) => c.severity === 'low'),
  };
}

/**
 * Get conflicts for a specific entity
 */
export function getEntityConflicts(
  conflicts: FieldConflict[],
  entityId: string
): FieldConflict[] {
  return conflicts.filter((c) => c.entityId === entityId);
}

/**
 * Get unresolved conflicts
 */
export function getUnresolvedConflicts(
  conflicts: FieldConflict[]
): FieldConflict[] {
  return conflicts.filter((c) => !c.resolved);
}

/**
 * Get conflict statistics
 */
export function getConflictStats(conflicts: FieldConflict[]): {
  total: number;
  bySeverity: Record<ConflictSeverity, number>;
  resolved: number;
  unresolved: number;
  criticalUnresolved: number;
} {
  const grouped = groupConflictsBySeverity(conflicts);
  const unresolved = getUnresolvedConflicts(conflicts);
  const criticalUnresolved = unresolved.filter((c) => c.severity === 'critical');

  return {
    total: conflicts.length,
    bySeverity: {
      critical: grouped.critical.length,
      medium: grouped.medium.length,
      low: grouped.low.length,
    },
    resolved: conflicts.filter((c) => c.resolved).length,
    unresolved: unresolved.length,
    criticalUnresolved: criticalUnresolved.length,
  };
}

/**
 * Check if a value is effectively empty
 */
function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Check if two values are semantically equivalent
 *
 * This is more intelligent than simple equality:
 * - "75000" == 75000
 * - "2024-01-15" == "15/01/2024"
 * - "KOUASSI Jean" == "Jean KOUASSI"
 */
export function valuesAreEquivalent(value1: any, value2: any): boolean {
  // Both empty = equivalent
  if (isEmptyValue(value1) && isEmptyValue(value2)) {
    return true;
  }

  // One empty, one not = not equivalent
  if (isEmptyValue(value1) || isEmptyValue(value2)) {
    return false;
  }

  // Normalize and compare
  return normalizeValue(value1) === normalizeValue(value2);
}

/**
 * Detect potential data quality issues in conflicts
 *
 * This helps identify patterns that suggest systematic problems:
 * - All values from one file are newer → Prefer that file
 * - One source has many empty fields → Less reliable
 * - One source has formatting issues → Lower quality
 */
export function analyzeConflictPatterns(params: {
  conflicts: FieldConflict[];
  matches: RecordMatch[];
}): {
  fileQualityScores: Record<string, number>;
  recommendations: string[];
} {
  const { conflicts } = params;

  // Count conflicts by source file
  const conflictsByFile = new Map<string, number>();
  const emptyFieldsByFile = new Map<string, number>();
  const totalFieldsByFile = new Map<string, number>();

  for (const conflict of conflicts) {
    for (const source of conflict.sources) {
      const file = source.fileName;

      // Count this conflict for this file
      conflictsByFile.set(file, (conflictsByFile.get(file) || 0) + 1);

      // Count empty vs filled fields
      totalFieldsByFile.set(file, (totalFieldsByFile.get(file) || 0) + 1);
      if (isEmptyValue(source.value)) {
        emptyFieldsByFile.set(file, (emptyFieldsByFile.get(file) || 0) + 1);
      }
    }
  }

  // Calculate quality scores (0-100)
  const fileQualityScores: Record<string, number> = {};
  const recommendations: string[] = [];

  for (const [file, totalFields] of totalFieldsByFile) {
    const conflicts = conflictsByFile.get(file) || 0;
    const emptyFields = emptyFieldsByFile.get(file) || 0;

    // Quality = 100 - (conflicts% * 50) - (empty% * 50)
    const conflictPenalty = (conflicts / totalFields) * 50;
    const emptyPenalty = (emptyFields / totalFields) * 50;
    const qualityScore = Math.max(0, 100 - conflictPenalty - emptyPenalty);

    fileQualityScores[file] = Math.round(qualityScore);

    // Generate recommendations
    if (qualityScore < 50) {
      recommendations.push(
        `⚠️  Fichier "${file}" a une faible qualité de données (${Math.round(qualityScore)}%). Vérifiez les données avant import.`
      );
    }
    if (emptyFields / totalFields > 0.3) {
      recommendations.push(
        `📋 Fichier "${file}" a beaucoup de champs vides (${Math.round((emptyFields / totalFields) * 100)}%). Données incomplètes.`
      );
    }
  }

  return {
    fileQualityScores,
    recommendations,
  };
}
