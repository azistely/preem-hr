/**
 * Employment Contracts Importer
 *
 * Handles importing employment contract records into the employment_contracts table.
 * This importer creates contract history for employees.
 *
 * Features:
 * - Links contracts to existing employees
 * - Validates contract dates and types
 * - Handles CDD, CDI, CDDTI, INTERIM, and STAGE contracts
 * - Validates renewal counts
 * - Enforces contract-specific business rules
 * - Tenant isolation enforced
 * - Batch insertion for performance
 *
 * Business Rules:
 * - CDI and CDDTI contracts must NOT have end dates
 * - CDD, INTERIM, and STAGE contracts must have end dates
 * - End date must be after start date
 * - Renewal count must be between 0 and 2
 * - CDDTI contracts should have task descriptions
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
import { employees } from '@/lib/db/schema/employees';
import { eq, and, inArray } from 'drizzle-orm';

// Import from drizzle schema (until we have proper lib/db/schema file)
import { employmentContracts } from '@/drizzle/schema';

interface EmploymentContractImportData {
  // Required fields
  employeeNumber: string; // Will be used to look up employeeId
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  startDate: string; // ISO date string from AI cleaning

  // Conditionally required based on contract type
  endDate?: string; // Required for CDD, INTERIM, STAGE; forbidden for CDI, CDDTI

  // Optional fields
  contractNumber?: string;
  renewalCount?: number;
  isActive?: boolean;
  terminationDate?: string;
  terminationReason?: string;
  originalContractId?: string;
  replacesContractId?: string;
  cddReason?: string;
  cddTotalDurationMonths?: number;
  cddtiTaskDescription?: string;
  signedDate?: string;
  contractFileUrl?: string;
  notes?: string;
}

export class EmploymentContractsImporter implements DataImporter<EmploymentContractImportData> {
  /**
   * Validate employment contract data before import
   */
  async validate(
    data: EmploymentContractImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.employeeNumber?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Numéro employé est requis',
            'MISSING_EMPLOYEE_NUMBER',
            'employeeNumber'
          )
        );
      }

      if (!row.contractType?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Type de contrat est requis',
            'MISSING_CONTRACT_TYPE',
            'contractType'
          )
        );
      } else if (!this.isValidContractType(row.contractType)) {
        errors.push(
          createError(
            rowNum,
            `Type de contrat invalide: ${row.contractType}. Valeurs valides: CDI, CDD, CDDTI, INTERIM, STAGE`,
            'INVALID_CONTRACT_TYPE',
            'contractType',
            row.contractType
          )
        );
      }

      if (!row.startDate) {
        errors.push(
          createError(
            rowNum,
            'Date de début est requise',
            'MISSING_START_DATE',
            'startDate'
          )
        );
      } else if (!this.isValidDate(row.startDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de début invalide: ${row.startDate}`,
            'INVALID_START_DATE',
            'startDate',
            row.startDate
          )
        );
      }

      // Validate contract-specific rules
      if (row.contractType) {
        const contractType = row.contractType.toUpperCase();

        // CDI and CDDTI must NOT have end dates
        if ((contractType === 'CDI' || contractType === 'CDDTI') && row.endDate) {
          errors.push(
            createError(
              rowNum,
              `Les contrats ${contractType} ne doivent pas avoir de date de fin`,
              'END_DATE_NOT_ALLOWED',
              'endDate',
              row.endDate
            )
          );
        }

        // CDD, INTERIM, and STAGE must have end dates
        if (
          (contractType === 'CDD' || contractType === 'INTERIM' || contractType === 'STAGE') &&
          !row.endDate
        ) {
          errors.push(
            createError(
              rowNum,
              `Les contrats ${contractType} doivent avoir une date de fin`,
              'END_DATE_REQUIRED',
              'endDate'
            )
          );
        }

        // Validate CDDTI task description
        if (contractType === 'CDDTI' && !row.cddtiTaskDescription?.trim()) {
          // This is a warning, not an error (business rule: "recommended")
          // But we'll track it as a warning
          errors.push(
            createError(
              rowNum,
              'Description de la tâche recommandée pour les contrats CDDTI',
              'CDDTI_TASK_RECOMMENDED',
              'cddtiTaskDescription'
            )
          );
        }
      }

      // Validate end date if present
      if (row.endDate) {
        if (!this.isValidDate(row.endDate)) {
          errors.push(
            createError(
              rowNum,
              `Date de fin invalide: ${row.endDate}`,
              'INVALID_END_DATE',
              'endDate',
              row.endDate
            )
          );
        } else if (row.startDate && this.isValidDate(row.startDate)) {
          // Check that end date is after start date
          const startDate = new Date(row.startDate);
          const endDate = new Date(row.endDate);

          if (endDate <= startDate) {
            errors.push(
              createError(
                rowNum,
                `La date de fin (${row.endDate}) doit être après la date de début (${row.startDate})`,
                'INVALID_DATE_RANGE',
                'endDate',
                row.endDate
              )
            );
          }
        }
      }

      // Validate optional date fields
      if (row.terminationDate && !this.isValidDate(row.terminationDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de fin de contrat invalide: ${row.terminationDate}`,
            'INVALID_TERMINATION_DATE',
            'terminationDate',
            row.terminationDate
          )
        );
      }

      if (row.signedDate && !this.isValidDate(row.signedDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de signature invalide: ${row.signedDate}`,
            'INVALID_SIGNED_DATE',
            'signedDate',
            row.signedDate
          )
        );
      }

      // Validate renewal count
      if (row.renewalCount !== undefined) {
        if (row.renewalCount < 0 || row.renewalCount > 2) {
          errors.push(
            createError(
              rowNum,
              `Nombre de renouvellements invalide: ${row.renewalCount}. Doit être entre 0 et 2`,
              'INVALID_RENEWAL_COUNT',
              'renewalCount',
              row.renewalCount
            )
          );
        }
      }
    }

    // Check for existing employees in database
    if (!context.dryRun) {
      const employeeNumbers = data
        .map((row) => row.employeeNumber?.trim())
        .filter(Boolean);

      if (employeeNumbers.length > 0) {
        const existingEmployees = await db
          .select({
            employeeNumber: employees.employeeNumber,
            id: employees.id,
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, context.tenantId),
              inArray(employees.employeeNumber, employeeNumbers)
            )
          );

        const existingNumbersMap = new Map(
          existingEmployees.map((e) => [e.employeeNumber, e.id])
        );

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 1;

          if (row.employeeNumber && !existingNumbersMap.has(row.employeeNumber.trim())) {
            errors.push(
              createError(
                rowNum,
                `Employé non trouvé: ${row.employeeNumber}`,
                'EMPLOYEE_NOT_FOUND',
                'employeeNumber',
                row.employeeNumber
              )
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Import employment contract data into database
   */
  async import(
    data: EmploymentContractImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Fetch employee IDs
    const employeeNumbers = data
      .map((row) => row.employeeNumber?.trim())
      .filter(Boolean);

    const existingEmployees = await db
      .select({
        employeeNumber: employees.employeeNumber,
        id: employees.id,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, context.tenantId),
          inArray(employees.employeeNumber, employeeNumbers)
        )
      );

    const employeeIdMap = new Map(
      existingEmployees.map((e) => [e.employeeNumber, e.id])
    );

    // Step 3: Transform data to match schema
    const contractRecords = data.map((row) => {
      const employeeId = employeeIdMap.get(row.employeeNumber?.trim());

      if (!employeeId) {
        throw new Error(`Employee not found: ${row.employeeNumber}`);
      }

      // Clean contract type
      const cleanedContractType = row.contractType?.trim().toUpperCase() as
        | 'CDI'
        | 'CDD'
        | 'CDDTI'
        | 'INTERIM'
        | 'STAGE';

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Foreign key
        employeeId: employeeId,

        // Required fields
        contractType: cleanedContractType,
        startDate: row.startDate!, // Already in YYYY-MM-DD format from AI cleaning

        // Conditionally required end date
        ...(row.endDate && { endDate: row.endDate }),

        // Optional fields with defaults
        renewalCount: row.renewalCount ?? 0,
        isActive: row.isActive ?? true,

        // Optional fields
        ...(row.contractNumber && { contractNumber: row.contractNumber.trim() }),
        ...(row.terminationDate && { terminationDate: row.terminationDate }),
        ...(row.terminationReason && { terminationReason: row.terminationReason }),
        ...(row.originalContractId && { originalContractId: row.originalContractId }),
        ...(row.replacesContractId && { replacesContractId: row.replacesContractId }),
        ...(row.cddReason && { cddReason: row.cddReason }),
        ...(row.cddTotalDurationMonths !== undefined && {
          cddTotalDurationMonths: row.cddTotalDurationMonths,
        }),
        ...(row.cddtiTaskDescription && {
          cddtiTaskDescription: row.cddtiTaskDescription,
        }),
        ...(row.signedDate && { signedDate: row.signedDate }),
        ...(row.contractFileUrl && { contractFileUrl: row.contractFileUrl }),
        ...(row.notes && { notes: row.notes }),

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: contractRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(employmentContracts, contractRecords, 100);

      return createSuccessResult(recordsInserted, {
        contractTypes: contractRecords.reduce(
          (acc, c) => {
            acc[c.contractType] = (acc[c.contractType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        totalContracts: recordsInserted,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
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
   * Helper: Validate contract type
   */
  private isValidContractType(contractType: string): boolean {
    const validTypes = ['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE'];
    return validTypes.includes(contractType.toUpperCase());
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
export const employmentContractsImporter = new EmploymentContractsImporter();
