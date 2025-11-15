/**
 * Resolve Valid Employees - Employee-Centric Referential Integrity
 *
 * This tool resolves ALL valid employees that can be referenced by other entities:
 * - Existing employees from database
 * - New employees from Excel files
 *
 * This creates the MASTER LIST that all other entities must link to.
 *
 * WHY THIS IS CRITICAL:
 * "Each entity should be related to an employee (existing and found from the excel)
 *  for each entity found does it belong an employee in this list? Yes import, no Skip."
 *
 * @see docs/AI-IMPORT-EMPLOYEE-LINKING.md
 */

import type { ImportContext, RecordMatch } from '../types';

/**
 * Resolved employee - combines existing DB employees + new employees from Excel
 */
export interface ResolvedEmployee {
  /** Employee ID if existing in database, undefined if new */
  employeeId?: string;

  /** Employee number (for matching) */
  employeeNumber?: string;

  /** Full name for display */
  employeeName: string;

  /** Email for matching */
  email?: string;

  /** CNPS number for matching */
  cnpsNumber?: string;

  /** Phone number for matching */
  phoneNumber?: string;

  /** Is this a new employee (from Excel) or existing (from DB)? */
  isNew: boolean;

  /** For new employees: the matched record with all data */
  matchedRecord?: RecordMatch;
}

/**
 * Resolve all valid employees from database + Excel files
 *
 * This creates the master employee index that all other entities MUST link to.
 *
 * Valid employees include:
 * 1. All existing employees from database (always valid)
 * 2. New employees from Excel (no duplicate detected)
 * 3. Duplicate employees with 'update' action (will update existing)
 *
 * @param existingEmployees - Employees already in database
 * @param employeeMatches - Matched employee records from Excel with duplicate detection
 * @returns Map of valid employees indexed by all possible identifiers
 */
export function resolveValidEmployees(params: {
  existingEmployees: NonNullable<ImportContext['existingEmployees']>;
  employeeMatches: RecordMatch[];
}): Map<string, ResolvedEmployee> {
  const { existingEmployees, employeeMatches } = params;

  const validEmployees = new Map<string, ResolvedEmployee>();

  // Step 1: Add ALL existing employees from database (always valid)
  for (const emp of existingEmployees) {
    const resolved: ResolvedEmployee = {
      employeeId: emp.id,
      employeeNumber: emp.employeeNumber ?? undefined,
      employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      email: emp.email ?? undefined,
      cnpsNumber: emp.cnpsNumber ?? undefined,
      phoneNumber: emp.phoneNumber ?? undefined,
      isNew: false,
    };

    // Index by all possible identifiers
    indexEmployee(validEmployees, resolved);
  }

  // Step 2: Add NEW employees from Excel (not duplicates OR will update existing)
  for (const match of employeeMatches) {
    const employeeData = match.sourceRecords[0]?.data || {};

    // Skip employees that are duplicates with 'skip' action
    if (match.duplicate?.recommendedAction === 'skip') {
      continue;
    }

    // If this is a duplicate with 'update' action, employee is already in map (from existing)
    if (match.duplicate?.recommendedAction === 'update' && match.duplicate.existingEmployeeId) {
      // Employee already indexed - just ensure we have the latest data
      continue;
    }

    // This is a NEW employee (no duplicate OR requires user decision)
    const resolved: ResolvedEmployee = {
      employeeId: match.duplicate?.existingEmployeeId, // undefined for truly new employees
      employeeNumber: employeeData.employeeNumber,
      employeeName:
        `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim() ||
        'Employé sans nom',
      email: employeeData.email,
      cnpsNumber: employeeData.cnpsNumber,
      phoneNumber: employeeData.phoneNumber,
      isNew: !match.duplicate, // true if no duplicate, false if duplicate with update
      matchedRecord: match,
    };

    // Index by all possible identifiers
    indexEmployee(validEmployees, resolved);
  }

  return validEmployees;
}

/**
 * Index employee by all possible identifiers for O(1) lookup
 *
 * Creates multiple index entries:
 * - num:{employeeNumber}
 * - email:{email}
 * - cnps:{cnpsNumber}
 * - phone:{normalizedPhone}
 * - name:{normalizedFullName}
 */
function indexEmployee(
  index: Map<string, ResolvedEmployee>,
  employee: ResolvedEmployee
): void {
  // Index by employee number
  if (employee.employeeNumber) {
    index.set(`num:${employee.employeeNumber}`, employee);
  }

  // Index by email (case-insensitive)
  if (employee.email) {
    index.set(`email:${employee.email.toLowerCase()}`, employee);
  }

  // Index by CNPS number
  if (employee.cnpsNumber) {
    index.set(`cnps:${employee.cnpsNumber}`, employee);
  }

  // Index by phone number (normalized)
  if (employee.phoneNumber) {
    const normalized = employee.phoneNumber.replace(/[\s\-\(\)]/g, '');
    index.set(`phone:${normalized}`, employee);
  }

  // Index by normalized full name (for fuzzy matching fallback)
  if (employee.employeeName) {
    const normalized = normalizeNameForMatching(employee.employeeName);
    index.set(`name:${normalized}`, employee);
  }
}

/**
 * Find employee by any identifier
 *
 * This tries multiple strategies to find an employee:
 * 1. employeeNumber (exact)
 * 2. email (case-insensitive)
 * 3. CNPS number (exact)
 * 4. phone number (normalized)
 * 5. Full name (normalized)
 *
 * @param entityData - Entity data that may contain employee references
 * @param validEmployees - Map of valid employees
 * @returns Matched employee or undefined
 */
export function findEmployeeForEntity(params: {
  entityData: Record<string, any>;
  validEmployees: Map<string, ResolvedEmployee>;
}): {
  employee: ResolvedEmployee;
  matchMethod: 'employeeNumber' | 'email' | 'cnpsNumber' | 'phoneNumber' | 'fullName';
  matchConfidence: number;
} | undefined {
  const { entityData, validEmployees } = params;

  // Strategy 1: employeeNumber (100% confidence)
  if (entityData.employeeNumber) {
    const employee = validEmployees.get(`num:${entityData.employeeNumber}`);
    if (employee) {
      return { employee, matchMethod: 'employeeNumber', matchConfidence: 100 };
    }
  }

  // Strategy 2: email (95% confidence)
  if (entityData.email) {
    const employee = validEmployees.get(`email:${entityData.email.toLowerCase()}`);
    if (employee) {
      return { employee, matchMethod: 'email', matchConfidence: 95 };
    }
  }

  // Strategy 3: CNPS number (90% confidence)
  if (entityData.cnpsNumber) {
    const employee = validEmployees.get(`cnps:${entityData.cnpsNumber}`);
    if (employee) {
      return { employee, matchMethod: 'cnpsNumber', matchConfidence: 90 };
    }
  }

  // Strategy 4: phone number (85% confidence)
  if (entityData.phoneNumber) {
    const normalized = entityData.phoneNumber.replace(/[\s\-\(\)]/g, '');
    const employee = validEmployees.get(`phone:${normalized}`);
    if (employee) {
      return { employee, matchMethod: 'phoneNumber', matchConfidence: 85 };
    }
  }

  // Strategy 5: Full name (70-80% confidence, requires normalization)
  if (entityData.firstName || entityData.lastName || entityData.employeeName) {
    const fullName =
      entityData.employeeName ||
      `${entityData.firstName || ''} ${entityData.lastName || ''}`.trim();

    if (fullName) {
      const normalized = normalizeNameForMatching(fullName);
      const employee = validEmployees.get(`name:${normalized}`);
      if (employee) {
        return { employee, matchMethod: 'fullName', matchConfidence: 75 };
      }
    }
  }

  // No match found
  return undefined;
}

/**
 * Normalize name for matching
 *
 * Handles West African name variations:
 * - "Jean KOUASSI" → "jean kouassi"
 * - "KOUASSI Jean" → "jean kouassi" (order-independent)
 * - "Abdoulayé" → "abdoulaye" (diacritics removed)
 */
function normalizeNameForMatching(name: string): string {
  // Remove diacritics
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Split into parts and sort alphabetically (order-independent)
  const parts = normalized.split(/\s+/).sort();

  return parts.join(' ');
}

/**
 * Format entity reference that failed to link to employee
 *
 * This creates a user-friendly description of what entity couldn't be linked.
 *
 * Examples:
 * - "Bulletin de paie: Janvier 2024"
 * - "Contrat: EMP999 (employé non trouvé)"
 * - "Congé: Marie Traoré"
 */
export function formatRejectedEntityDescription(params: {
  entityData: Record<string, any>;
  entityType: string;
}): string {
  const { entityData, entityType } = params;

  // Try to extract meaningful identifier
  const identifier =
    entityData.employeeNumber ||
    entityData.email ||
    entityData.employeeName ||
    `${entityData.firstName || ''} ${entityData.lastName || ''}`.trim() ||
    entityData.period ||
    entityData.month ||
    'ID inconnu';

  return `${entityType}: ${identifier}`;
}
