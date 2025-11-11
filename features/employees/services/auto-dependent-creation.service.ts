/**
 * Auto-Dependent Creation Service
 *
 * Automatically creates placeholder dependent records during employee import.
 * These records allow immediate fiscal calculations while flagging HR to complete details.
 *
 * Design decisions:
 * - Placeholder dependents count towards fiscal parts immediately (per business requirement)
 * - Spouse dependents marked as unverified (require marriage certificate)
 * - Child dependents <21 auto-verified (no documents required)
 * - Generic placeholder data makes incomplete records obvious to HR
 */

import { db } from '@/lib/db';
import { employeeDependents } from '@/lib/db/schema/employees';

export interface CreatePlaceholderDependentsInput {
  employeeId: string;
  tenantId: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildrenCount: number;
}

export interface CreatePlaceholderDependentsResult {
  spouseCreated: boolean;
  childrenCreated: number;
  totalDependentsCreated: number;
}

/**
 * Creates placeholder dependent records after employee import
 *
 * @param input - Employee context and family information
 * @returns Summary of dependents created
 *
 * @example
 * ```ts
 * const result = await createPlaceholderDependents({
 *   employeeId: 'uuid',
 *   tenantId: 'uuid',
 *   maritalStatus: 'married',
 *   dependentChildrenCount: 2
 * });
 * // Result: { spouseCreated: true, childrenCreated: 2, totalDependentsCreated: 3 }
 * ```
 */
export async function createPlaceholderDependents(
  input: CreatePlaceholderDependentsInput
): Promise<CreatePlaceholderDependentsResult> {
  const { employeeId, tenantId, maritalStatus, dependentChildrenCount } = input;

  const dependentsToCreate = [];
  let spouseCreated = false;
  let childrenCreated = 0;

  // Create spouse dependent if married
  if (maritalStatus === 'married') {
    dependentsToCreate.push({
      employeeId,
      tenantId,
      firstName: '[À compléter]',
      lastName: '[À compléter]',
      dateOfBirth: '1990-01-01', // Placeholder DOB (34 years old)
      relationship: 'spouse',
      gender: null, // Force user to complete this field (required for CMU tracking)
      isVerified: false, // Requires marriage certificate
      requiresDocument: true,
      documentType: 'marriage_certificate',
      eligibleForFiscalParts: true, // Counts immediately per business requirement
      eligibleForCmu: true,
      status: 'active',
      notes: 'Créé automatiquement lors de l\'import. Veuillez compléter les informations et joindre l\'acte de mariage pour finaliser la vérification.',
    });
    spouseCreated = true;
  }

  // Create child dependents
  for (let i = 0; i < dependentChildrenCount; i++) {
    dependentsToCreate.push({
      employeeId,
      tenantId,
      firstName: `[Enfant ${i + 1}]`,
      lastName: '[À compléter]',
      dateOfBirth: '2015-01-01', // Placeholder: 10 years old (auto-verified as <21)
      relationship: 'child',
      gender: null, // Force user to complete this field (required for CMU tracking)
      isVerified: true, // Auto-verified since <21 years old
      requiresDocument: false, // No documents needed for children <21
      eligibleForFiscalParts: true, // Counts immediately
      eligibleForCmu: true,
      status: 'active',
      notes: 'Créé automatiquement lors de l\'import. Veuillez compléter les informations (nom, prénom, date de naissance exacte).',
    });
    childrenCreated++;
  }

  // Bulk insert all dependents
  if (dependentsToCreate.length > 0) {
    await db.insert(employeeDependents).values(dependentsToCreate);
  }

  return {
    spouseCreated,
    childrenCreated,
    totalDependentsCreated: dependentsToCreate.length,
  };
}

/**
 * Validates marital status value from CSV import
 * Supports both English and French values
 *
 * @param value - Raw CSV value
 * @returns Normalized marital status or null if invalid
 */
export function normalizeMaritalStatus(
  value: string | undefined
): 'single' | 'married' | 'divorced' | 'widowed' | null {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();

  // Map French and English values
  const statusMap: Record<string, 'single' | 'married' | 'divorced' | 'widowed'> = {
    // English
    'single': 'single',
    'married': 'married',
    'divorced': 'divorced',
    'widowed': 'widowed',
    // French
    'célibataire': 'single',
    'celibataire': 'single',
    'marié': 'married',
    'marie': 'married',
    'mariée': 'married',
    'mariee': 'married',
    'divorcé': 'divorced',
    'divorce': 'divorced',
    'divorcée': 'divorced',
    'divorcee': 'divorced',
    'veuf': 'widowed',
    'veuve': 'widowed',
  };

  return statusMap[normalized] || null;
}

/**
 * Validates dependent children count from CSV import
 *
 * @param value - Raw CSV value
 * @returns Validated count (0-10) or null if invalid
 */
export function validateDependentChildrenCount(
  value: string | undefined
): number | null {
  if (!value) return 0; // Default to 0 if not provided

  const count = parseInt(value, 10);

  // Must be a valid integer between 0 and 10
  if (isNaN(count) || count < 0 || count > 10) {
    return null;
  }

  return count;
}
