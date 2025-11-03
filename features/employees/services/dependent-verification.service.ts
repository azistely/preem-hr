/**
 * Dependent Verification Service
 *
 * Manages employee dependents and verifies eligibility for fiscal parts and CMU.
 *
 * Legal Context (Côte d'Ivoire):
 * - Dependents under 21: Automatic eligibility
 * - Dependents over 21: Require "certificat de fréquentation" (school attendance certificate)
 *   or similar proof
 *
 * Used for:
 * - Fiscal parts (parts fiscales) calculation for ITS tax
 * - CMU (Couverture Maladie Universelle) contribution calculation
 */

import { db } from '@/lib/db';
import { employeeDependents, employees } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

// ========================================
// Types
// ========================================

export interface VerifiedDependent {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  relationship: 'child' | 'spouse' | 'other';
  isVerified: boolean;
  requiresDocument: boolean;
  eligibleForFiscalParts: boolean;
  eligibleForCmu: boolean;
  documentType?: string | null;
  documentNumber?: string | null;
  documentExpiryDate?: string | null;
  notes?: string | null;
}

export interface DependentCounts {
  totalDependents: number;
  verifiedDependents: number;
  fiscalPartsDependents: number;
  cmuDependents: number;
  expiringSoon: number; // Documents expiring in < 30 days
}

// ========================================
// Helper Functions
// ========================================

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string, asOfDate: Date = new Date()): number {
  const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = asOfDate;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Check if document is expired or expiring soon
 */
export function isDocumentValid(expiryDate: Date | string | null, daysThreshold: number = 0): boolean {
  if (!expiryDate) return false;

  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));

  return expiry >= thresholdDate;
}

// ========================================
// Core Service Functions
// ========================================

/**
 * Get all verified dependents for an employee
 *
 * A dependent is considered verified based on relationship type:
 *
 * SPOUSE:
 * - Always requires marriage certificate document
 * - No age-based auto-verification
 *
 * CHILD:
 * - Under 21 years old: Automatic verification (no document needed)
 * - Over 21: Requires valid "certificat de fréquentation" (school attendance certificate)
 *
 * OTHER:
 * - Requires valid supporting document
 */
export async function getVerifiedDependents(
  employeeId: string,
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<VerifiedDependent[]> {
  // Fetch all active dependents
  const dependents = await db
    .select()
    .from(employeeDependents)
    .where(
      and(
        eq(employeeDependents.employeeId, employeeId),
        eq(employeeDependents.tenantId, tenantId),
        eq(employeeDependents.status, 'active')
      )
    );

  // Map and filter based on verification rules
  return dependents
    .map(dep => {
      const age = calculateAge(dep.dateOfBirth, asOfDate);

      // SPOUSE VERIFICATION: Different rules than children
      if (dep.relationship === 'spouse') {
        // Spouse always requires document (marriage certificate)
        // No age-based auto-verification
        const hasValidDocument = dep.isVerified &&
                                 dep.documentType &&
                                 isDocumentValid(dep.documentExpiryDate);

        return {
          id: dep.id,
          firstName: dep.firstName,
          lastName: dep.lastName,
          dateOfBirth: dep.dateOfBirth,
          age,
          relationship: dep.relationship as 'child' | 'spouse' | 'other',
          isVerified: hasValidDocument,
          requiresDocument: true,
          eligibleForFiscalParts: hasValidDocument && dep.eligibleForFiscalParts,
          eligibleForCmu: hasValidDocument && dep.eligibleForCmu,
          documentType: dep.documentType,
          documentNumber: dep.documentNumber,
          documentExpiryDate: dep.documentExpiryDate,
          notes: dep.notes,
        };
      }

      // CHILD VERIFICATION: Age-based rules
      if (dep.relationship === 'child') {
        // Under 21: Automatic verification
        if (age < 21) {
          return {
            id: dep.id,
            firstName: dep.firstName,
            lastName: dep.lastName,
            dateOfBirth: dep.dateOfBirth,
            age,
            relationship: dep.relationship as 'child' | 'spouse' | 'other',
            isVerified: true,
            requiresDocument: false,
            eligibleForFiscalParts: dep.eligibleForFiscalParts,
            eligibleForCmu: dep.eligibleForCmu,
            documentType: dep.documentType,
            documentNumber: dep.documentNumber,
            documentExpiryDate: dep.documentExpiryDate,
            notes: dep.notes,
          };
        }

        // Over 21: Requires valid document (school certificate)
        const hasValidDocument = dep.isVerified &&
                                 dep.documentType &&
                                 isDocumentValid(dep.documentExpiryDate);

        return {
          id: dep.id,
          firstName: dep.firstName,
          lastName: dep.lastName,
          dateOfBirth: dep.dateOfBirth,
          age,
          relationship: dep.relationship as 'child' | 'spouse' | 'other',
          isVerified: hasValidDocument,
          requiresDocument: true,
          eligibleForFiscalParts: hasValidDocument && dep.eligibleForFiscalParts,
          eligibleForCmu: hasValidDocument && dep.eligibleForCmu,
          documentType: dep.documentType,
          documentNumber: dep.documentNumber,
          documentExpiryDate: dep.documentExpiryDate,
          notes: dep.notes,
        };
      }

      // OTHER RELATIONSHIP: Requires valid document
      const hasValidDocument = dep.isVerified &&
                               dep.documentType &&
                               isDocumentValid(dep.documentExpiryDate);

      return {
        id: dep.id,
        firstName: dep.firstName,
        lastName: dep.lastName,
        dateOfBirth: dep.dateOfBirth,
        age,
        relationship: dep.relationship as 'child' | 'spouse' | 'other',
        isVerified: hasValidDocument,
        requiresDocument: true,
        eligibleForFiscalParts: hasValidDocument && dep.eligibleForFiscalParts,
        eligibleForCmu: hasValidDocument && dep.eligibleForCmu,
        documentType: dep.documentType,
        documentNumber: dep.documentNumber,
        documentExpiryDate: dep.documentExpiryDate,
        notes: dep.notes,
      };
    })
    .filter(dep => dep.isVerified); // Only return verified dependents
}

/**
 * Get count of verified dependents for a specific purpose
 *
 * @param purpose - 'fiscal_parts' or 'cmu'
 */
export async function getVerifiedDependentsCount(
  employeeId: string,
  tenantId: string,
  purpose: 'fiscal_parts' | 'cmu',
  asOfDate: Date = new Date()
): Promise<number> {
  const verified = await getVerifiedDependents(employeeId, tenantId, asOfDate);

  return verified.filter(dep => {
    if (purpose === 'fiscal_parts') {
      return dep.eligibleForFiscalParts;
    } else {
      return dep.eligibleForCmu;
    }
  }).length;
}

/**
 * Get dependent counts and statistics for an employee
 */
export async function getDependentCounts(
  employeeId: string,
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<DependentCounts> {
  const allDependents = await db
    .select()
    .from(employeeDependents)
    .where(
      and(
        eq(employeeDependents.employeeId, employeeId),
        eq(employeeDependents.tenantId, tenantId),
        eq(employeeDependents.status, 'active')
      )
    );

  const verified = await getVerifiedDependents(employeeId, tenantId, asOfDate);

  // Count documents expiring in next 30 days
  const expiringSoon = allDependents.filter(dep => {
    if (!dep.documentExpiryDate) return false;
    return isDocumentValid(dep.documentExpiryDate, 30) &&
           !isDocumentValid(dep.documentExpiryDate, 0);
  }).length;

  return {
    totalDependents: allDependents.length,
    verifiedDependents: verified.length,
    fiscalPartsDependents: verified.filter(d => d.eligibleForFiscalParts).length,
    cmuDependents: verified.filter(d => d.eligibleForCmu).length,
    expiringSoon,
  };
}

/**
 * Calculate fiscal parts for an employee based on verified dependents
 *
 * Côte d'Ivoire Rules:
 * - Single without children: 1.0 part
 * - Single with children: 1.5 base + 0.5 per child (max 4 children)
 * - Married: 2.0 base + 0.5 per child (max 4 children)
 */
export async function calculateFiscalPartsFromDependents(
  employeeId: string,
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<number> {
  // Get employee marital status
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  const maritalStatus = employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | null;

  // Get verified dependents count for fiscal parts
  const verifiedDependents = await getVerifiedDependentsCount(
    employeeId,
    tenantId,
    'fiscal_parts',
    asOfDate
  );

  // Calculate fiscal parts
  return calculateFiscalParts(maritalStatus || 'single', verifiedDependents);
}

/**
 * Calculate fiscal parts based on marital status and dependent count
 *
 * CORRECTED FORMULA (per user requirements):
 * - Single without children: 1.0
 * - Single with children: 1.5 (base for single parent) + 0.5 × children
 * - Married: 2.0 (includes spouse) + 0.5 × children
 * - Maximum 4 children counted
 */
export function calculateFiscalParts(
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed',
  verifiedDependents: number
): number {
  let parts: number;

  // Determine base parts
  if (maritalStatus === 'married') {
    // Married base (includes spouse)
    parts = 2.0;
  } else if (verifiedDependents > 0) {
    // Single parent with at least 1 child gets 1.5 base
    // This is the CORRECTED formula per user requirement
    parts = 1.5;
  } else {
    // Single without children
    parts = 1.0;
  }

  // Add 0.5 per dependent (max 4 counted)
  const countedDependents = Math.min(verifiedDependents, 4);
  parts += countedDependents * 0.5;

  return parts;
}

/**
 * Get dependents with expiring documents (for alerts)
 *
 * @param daysThreshold - Days before expiry to include (default 30)
 */
export async function getDependentsWithExpiringDocuments(
  employeeId: string,
  tenantId: string,
  daysThreshold: number = 30
): Promise<VerifiedDependent[]> {
  const dependents = await db
    .select()
    .from(employeeDependents)
    .where(
      and(
        eq(employeeDependents.employeeId, employeeId),
        eq(employeeDependents.tenantId, tenantId),
        eq(employeeDependents.status, 'active')
      )
    );

  const now = new Date();
  const thresholdDate = new Date(now.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));

  return dependents
    .filter(dep => {
      if (!dep.documentExpiryDate || !dep.requiresDocument) return false;
      const expiryDate = new Date(dep.documentExpiryDate);
      return expiryDate <= thresholdDate && expiryDate >= now;
    })
    .map(dep => ({
      id: dep.id,
      firstName: dep.firstName,
      lastName: dep.lastName,
      dateOfBirth: dep.dateOfBirth,
      age: calculateAge(dep.dateOfBirth),
      relationship: dep.relationship as 'child' | 'spouse' | 'other',
      isVerified: dep.isVerified,
      requiresDocument: dep.requiresDocument,
      eligibleForFiscalParts: dep.eligibleForFiscalParts,
      eligibleForCmu: dep.eligibleForCmu,
      documentType: dep.documentType,
      documentExpiryDate: dep.documentExpiryDate,
    }));
}

/**
 * Calculate marital status from active dependents
 *
 * Logic:
 * - If there's an active spouse dependent → 'married'
 * - Otherwise → keep existing status (user-managed for divorced/widowed)
 *
 * Note: This only auto-sets 'married' status. Divorced/widowed must be set manually
 * since removing a spouse dependent doesn't automatically mean divorced/widowed.
 */
export async function calculateMaritalStatusFromDependents(
  employeeId: string,
  tenantId: string
): Promise<'single' | 'married' | 'divorced' | 'widowed'> {
  // Check if there's an active spouse dependent
  const [spouseDependent] = await db
    .select()
    .from(employeeDependents)
    .where(
      and(
        eq(employeeDependents.employeeId, employeeId),
        eq(employeeDependents.tenantId, tenantId),
        eq(employeeDependents.relationship, 'spouse'),
        eq(employeeDependents.status, 'active')
      )
    )
    .limit(1);

  if (spouseDependent) {
    return 'married';
  }

  // Get current marital status from employee
  const [employee] = await db
    .select({ maritalStatus: employees.maritalStatus })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .limit(1);

  // Keep existing status (might be 'divorced' or 'widowed')
  // Default to 'single' if not set
  return (employee?.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed') || 'single';
}

/**
 * Get all dependents for an employee (including unverified)
 */
export async function getAllDependents(
  employeeId: string,
  tenantId: string
): Promise<VerifiedDependent[]> {
  const dependents = await db
    .select()
    .from(employeeDependents)
    .where(
      and(
        eq(employeeDependents.employeeId, employeeId),
        eq(employeeDependents.tenantId, tenantId),
        eq(employeeDependents.status, 'active')
      )
    );

  return dependents.map(dep => ({
    id: dep.id,
    firstName: dep.firstName,
    lastName: dep.lastName,
    dateOfBirth: dep.dateOfBirth,
    age: calculateAge(dep.dateOfBirth),
    relationship: dep.relationship as 'child' | 'spouse' | 'other',
    isVerified: dep.isVerified,
    requiresDocument: dep.requiresDocument,
    eligibleForFiscalParts: dep.eligibleForFiscalParts,
    eligibleForCmu: dep.eligibleForCmu,
    documentType: dep.documentType,
    documentNumber: dep.documentNumber,
    documentExpiryDate: dep.documentExpiryDate,
  }));
}
