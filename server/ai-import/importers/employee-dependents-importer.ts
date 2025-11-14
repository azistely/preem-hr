/**
 * Employee Dependents Importer
 *
 * Handles importing employee dependent records into the employee_dependents table.
 * Dependents are used for fiscal parts (tax deductions) and CMU (health insurance).
 *
 * Legal Context (West Africa):
 * - Dependents under 21: Automatic eligibility
 * - Dependents over 21: Require "certificat de fréquentation" or school proof
 * - Relationship types: child, spouse, other
 * - Status tracking: active, inactive, expired
 *
 * Features:
 * - Validates foreign key reference to employees table
 * - Auto-calculates requiresDocument flag (TRUE if over 21 years old)
 * - Validates relationship types
 * - Validates date of birth
 * - Tenant isolation enforced
 * - Batch insertion for performance
 */

import {
  DataImporter,
  ImportContext,
  ImportResult,
  ImportError,
  createSuccessResult,
  createFailureResult,
  createError,
  createWarning,
  batchInsert,
} from './base-importer';
import { db } from '@/lib/db';
import { employeeDependents, employees } from '@/lib/db/schema/employees';
import { eq, and, inArray } from 'drizzle-orm';

interface EmployeeDependentImportData {
  // Required fields
  employeeId: string; // UUID or employee number (will be resolved)
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string from AI cleaning (YYYY-MM-DD)
  relationship: 'child' | 'spouse' | 'other';

  // Optional personal info
  gender?: 'male' | 'female';

  // Optional identification
  cnpsNumber?: string;
  cmuNumber?: string;

  // Optional coverage by other employer
  coveredByOtherEmployer?: boolean;
  coverageCertificateType?: string;
  coverageCertificateNumber?: string;
  coverageCertificateUrl?: string;
  coverageCertificateExpiryDate?: string;

  // Optional verification
  isVerified?: boolean;

  // Optional document tracking (for dependents over 21)
  documentType?: string; // 'certificat_frequentation', 'attestation_scolarite', 'carte_etudiant'
  documentNumber?: string;
  documentIssueDate?: string;
  documentExpiryDate?: string;
  documentUrl?: string;
  documentNotes?: string;

  // Optional eligibility flags
  eligibleForFiscalParts?: boolean;
  eligibleForCmu?: boolean;

  // Optional metadata
  notes?: string;

  // Optional status
  status?: 'active' | 'inactive' | 'expired';
}

export class EmployeeDependentsImporter implements DataImporter<EmployeeDependentImportData> {
  /**
   * Validate employee dependent data before import
   */
  async validate(
    data: EmployeeDependentImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'ID employé est requis',
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
      }

      if (!row.firstName?.trim()) {
        errors.push(
          createError(rowNum, 'Prénom est requis', 'MISSING_FIRST_NAME', 'firstName')
        );
      }

      if (!row.lastName?.trim()) {
        errors.push(
          createError(rowNum, 'Nom est requis', 'MISSING_LAST_NAME', 'lastName')
        );
      }

      if (!row.dateOfBirth) {
        errors.push(
          createError(
            rowNum,
            'Date de naissance est requise',
            'MISSING_DATE_OF_BIRTH',
            'dateOfBirth'
          )
        );
      } else if (!this.isValidDate(row.dateOfBirth)) {
        errors.push(
          createError(
            rowNum,
            `Date de naissance invalide: ${row.dateOfBirth}`,
            'INVALID_DATE_OF_BIRTH',
            'dateOfBirth',
            row.dateOfBirth
          )
        );
      }

      if (!row.relationship?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Type de relation est requis',
            'MISSING_RELATIONSHIP',
            'relationship'
          )
        );
      } else if (!this.isValidRelationship(row.relationship)) {
        errors.push(
          createError(
            rowNum,
            `Type de relation invalide: ${row.relationship}. Valeurs acceptées: child, spouse, other`,
            'INVALID_RELATIONSHIP',
            'relationship',
            row.relationship
          )
        );
      }

      // Validate optional date fields
      if (row.coverageCertificateExpiryDate && !this.isValidDate(row.coverageCertificateExpiryDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'expiration du certificat de couverture invalide: ${row.coverageCertificateExpiryDate}`,
            'INVALID_COVERAGE_CERTIFICATE_EXPIRY_DATE',
            'coverageCertificateExpiryDate',
            row.coverageCertificateExpiryDate
          )
        );
      }

      if (row.documentIssueDate && !this.isValidDate(row.documentIssueDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'émission du document invalide: ${row.documentIssueDate}`,
            'INVALID_DOCUMENT_ISSUE_DATE',
            'documentIssueDate',
            row.documentIssueDate
          )
        );
      }

      if (row.documentExpiryDate && !this.isValidDate(row.documentExpiryDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'expiration du document invalide: ${row.documentExpiryDate}`,
            'INVALID_DOCUMENT_EXPIRY_DATE',
            'documentExpiryDate',
            row.documentExpiryDate
          )
        );
      }

      // Validate gender if provided
      if (row.gender && !['male', 'female'].includes(row.gender)) {
        errors.push(
          createError(
            rowNum,
            `Genre invalide: ${row.gender}. Valeurs acceptées: male, female`,
            'INVALID_GENDER',
            'gender',
            row.gender
          )
        );
      }

      // Validate status if provided
      if (row.status && !['active', 'inactive', 'expired'].includes(row.status)) {
        errors.push(
          createError(
            rowNum,
            `Statut invalide: ${row.status}. Valeurs acceptées: active, inactive, expired`,
            'INVALID_STATUS',
            'status',
            row.status
          )
        );
      }
    }

    // Check for valid employee IDs (foreign key validation)
    if (!context.dryRun) {
      const employeeIds = data
        .map((row) => row.employeeId?.trim())
        .filter(Boolean);

      if (employeeIds.length > 0) {
        // Query to find existing employees (by ID or employee number)
        const existingEmployees = await db
          .select({
            id: employees.id,
            employeeNumber: employees.employeeNumber
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, context.tenantId),
              eq(employees.status, 'active')
            )
          );

        const validEmployeeIds = new Set(existingEmployees.map((e) => e.id));
        const validEmployeeNumbers = new Set(existingEmployees.map((e) => e.employeeNumber));

        // Create a mapping for employee number -> employee ID
        const employeeNumberToIdMap = new Map(
          existingEmployees.map((e) => [e.employeeNumber, e.id])
        );

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 1;

          if (!row.employeeId?.trim()) continue;

          const employeeId = row.employeeId.trim();

          // Check if it's a valid UUID (employee ID) or employee number
          const isUUID = this.isValidUUID(employeeId);

          if (isUUID) {
            // Direct employee ID lookup
            if (!validEmployeeIds.has(employeeId)) {
              errors.push(
                createError(
                  rowNum,
                  `ID employé introuvable: ${employeeId}`,
                  'EMPLOYEE_ID_NOT_FOUND',
                  'employeeId',
                  employeeId
                )
              );
            }
          } else {
            // Employee number lookup
            if (!validEmployeeNumbers.has(employeeId)) {
              errors.push(
                createError(
                  rowNum,
                  `Numéro employé introuvable: ${employeeId}`,
                  'EMPLOYEE_NUMBER_NOT_FOUND',
                  'employeeId',
                  employeeId
                )
              );
            }
          }
        }

        // Store the mapping for later use in import()
        (context as any).__employeeNumberToIdMap = employeeNumberToIdMap;
      }
    }

    return errors;
  }

  /**
   * Import employee dependent data into database
   */
  async import(
    data: EmployeeDependentImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Get employee ID mapping (from validation step)
    const employeeNumberToIdMap = (context as any).__employeeNumberToIdMap as Map<string, string>;

    // Step 3: Transform data to match schema
    const dependentRecords = data.map((row) => {
      // Clean required fields
      const cleanedRow = {
        ...row,
        employeeId: row.employeeId?.trim(),
        firstName: row.firstName?.trim(),
        lastName: row.lastName?.trim(),
        relationship: row.relationship?.trim().toLowerCase(),
      };

      // Resolve employee ID (UUID or employee number)
      let resolvedEmployeeId = cleanedRow.employeeId!;
      if (!this.isValidUUID(resolvedEmployeeId)) {
        // It's an employee number, resolve to UUID
        resolvedEmployeeId = employeeNumberToIdMap.get(resolvedEmployeeId) || resolvedEmployeeId;
      }

      // Calculate requiresDocument flag (TRUE if over 21 years old)
      const requiresDocument = this.calculateRequiresDocument(cleanedRow.dateOfBirth!);

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Foreign key
        employeeId: resolvedEmployeeId,

        // Required fields
        firstName: cleanedRow.firstName!,
        lastName: cleanedRow.lastName!,
        dateOfBirth: cleanedRow.dateOfBirth!,
        relationship: cleanedRow.relationship as 'child' | 'spouse' | 'other',

        // Optional personal info
        ...(cleanedRow.gender && { gender: cleanedRow.gender }),

        // Optional identification
        ...(cleanedRow.cnpsNumber && { cnpsNumber: cleanedRow.cnpsNumber }),
        ...(cleanedRow.cmuNumber && { cmuNumber: cleanedRow.cmuNumber }),

        // Optional coverage by other employer
        coveredByOtherEmployer: cleanedRow.coveredByOtherEmployer ?? false,
        ...(cleanedRow.coverageCertificateType && {
          coverageCertificateType: cleanedRow.coverageCertificateType,
        }),
        ...(cleanedRow.coverageCertificateNumber && {
          coverageCertificateNumber: cleanedRow.coverageCertificateNumber,
        }),
        ...(cleanedRow.coverageCertificateUrl && {
          coverageCertificateUrl: cleanedRow.coverageCertificateUrl,
        }),
        ...(cleanedRow.coverageCertificateExpiryDate && {
          coverageCertificateExpiryDate: cleanedRow.coverageCertificateExpiryDate,
        }),

        // Verification
        isVerified: cleanedRow.isVerified ?? false,
        requiresDocument,

        // Optional document tracking
        ...(cleanedRow.documentType && { documentType: cleanedRow.documentType }),
        ...(cleanedRow.documentNumber && { documentNumber: cleanedRow.documentNumber }),
        ...(cleanedRow.documentIssueDate && { documentIssueDate: cleanedRow.documentIssueDate }),
        ...(cleanedRow.documentExpiryDate && { documentExpiryDate: cleanedRow.documentExpiryDate }),
        ...(cleanedRow.documentUrl && { documentUrl: cleanedRow.documentUrl }),
        ...(cleanedRow.documentNotes && { documentNotes: cleanedRow.documentNotes }),

        // Eligibility flags
        eligibleForFiscalParts: cleanedRow.eligibleForFiscalParts ?? true,
        eligibleForCmu: cleanedRow.eligibleForCmu ?? true,

        // Optional metadata
        ...(cleanedRow.notes && { notes: cleanedRow.notes }),

        // Status
        status: cleanedRow.status ?? 'active',

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: dependentRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(employeeDependents, dependentRecords, 100);

      return createSuccessResult(recordsInserted, {
        totalDependents: recordsInserted,
        requireDocumentation: dependentRecords.filter((d) => d.requiresDocument).length,
        relationships: {
          child: dependentRecords.filter((d) => d.relationship === 'child').length,
          spouse: dependentRecords.filter((d) => d.relationship === 'spouse').length,
          other: dependentRecords.filter((d) => d.relationship === 'other').length,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return createFailureResult([
        createError(
          0,
          `Erreur lors de l'insertion: ${errorMessage}`,
          'DATABASE_INSERT_ERROR'
        ),
      ]);
    }
  }

  /**
   * Helper: Calculate if dependent requires documentation
   * TRUE if dependent is over 21 years old
   */
  private calculateRequiresDocument(dateOfBirth: string): boolean {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ? age - 1
      : age;

    return adjustedAge > 21;
  }

  /**
   * Helper: Validate relationship type
   */
  private isValidRelationship(relationship: string): boolean {
    return ['child', 'spouse', 'other'].includes(relationship.toLowerCase());
  }

  /**
   * Helper: Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Helper: Validate date format (YYYY-MM-DD)
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }
}

// Export singleton instance
export const employeeDependentsImporter = new EmployeeDependentsImporter();
