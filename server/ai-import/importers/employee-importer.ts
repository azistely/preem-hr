/**
 * Employee Master Data Importer
 *
 * Handles importing employee records into the employees table.
 * This is the foundational importer that creates employee master data.
 *
 * Features:
 * - Validates unique employee numbers per tenant
 * - Handles optional fields gracefully
 * - Auto-generates UUIDs for employee IDs
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
import { employees } from '@/lib/db/schema/employees';
import { eq, and } from 'drizzle-orm';

interface EmployeeImportData {
  // Required fields
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string; // ISO date string from AI cleaning

  // Optional personal info
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  placeOfBirth?: string;

  // Optional personnel record
  nationalityZone?: 'LOCAL' | 'CEDEAO' | 'HORS_CEDEAO';
  employeeType?: 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE';
  fatherName?: string;
  motherName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Optional contact
  phone?: string;
  nationalId?: string;
  identityDocumentType?: 'cni' | 'passport' | 'residence_permit';

  // Optional address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;

  // Optional employment
  terminationDate?: string;
  terminationReason?: string;
  contractType?: 'CDI' | 'CDD' | 'INTERIM' | 'STAGE';
  jobTitle?: string;
  profession?: string;
  qualification?: string;
  employmentClassification?: string;
  salaryRegime?: string;

  // Optional organizational structure
  establishment?: string;
  division?: string;
  service?: string;
  section?: string;
  workSite?: string;

  // Optional banking
  bankName?: string;
  bankAccount?: string;

  // Optional social security
  cnpsNumber?: string;
  cmuNumber?: string;

  // Optional tax
  taxNumber?: string;
  taxDependents?: number;
  isExpat?: boolean;

  // Optional coefficient
  coefficient?: number;

  // Optional rate type
  rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY';
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h';

  // Optional family information
  maritalStatus?: string;
  dependentChildren?: number;
  fiscalParts?: number;
  hasFamily?: boolean;

  // Optional compensation (temporary fields)
  categoricalSalary?: number;
  salaryPremium?: number;

  // Optional historical leave data (before system implementation)
  initialLeaveBalance?: number;  // Paid leave balance (annual leave)
  historicalUnpaidLeaveDays?: number;  // Unpaid leave taken (permission, congé sans solde, etc.)
  lastAnnualLeaveEndDate?: string;  // Date when employee returned from last annual leave (for ACP reference period)

  // Optional document expiry
  nationalIdExpiry?: string;
  workPermitExpiry?: string;

  // Optional convention collective
  conventionCode?: string;
  professionalLevel?: number;
  sector?: string;

  // Optional CGECI
  categoryCode?: string;
  sectorCodeCgeci?: string;

  // Status
  status?: 'active' | 'inactive' | 'terminated';
}

export class EmployeeImporter implements DataImporter<EmployeeImportData> {
  /**
   * Validate employee data before import
   */
  async validate(
    data: EmployeeImportData[],
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

      if (!row.email?.trim()) {
        errors.push(createError(rowNum, 'Email est requis', 'MISSING_EMAIL', 'email'));
      } else if (!this.isValidEmail(row.email)) {
        errors.push(
          createError(
            rowNum,
            `Email invalide: ${row.email}`,
            'INVALID_EMAIL',
            'email',
            row.email
          )
        );
      }

      if (!row.hireDate) {
        errors.push(
          createError(
            rowNum,
            "Date d'embauche est requise",
            'MISSING_HIRE_DATE',
            'hireDate'
          )
        );
      } else if (!this.isValidDate(row.hireDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'embauche invalide: ${row.hireDate}`,
            'INVALID_HIRE_DATE',
            'hireDate',
            row.hireDate
          )
        );
      }

      // Validate date formats for optional fields
      if (row.dateOfBirth && !this.isValidDate(row.dateOfBirth)) {
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
    }

    // Check for duplicate employee numbers within the import
    const employeeNumbers = data.map((row) => row.employeeNumber?.trim()).filter(Boolean);
    const duplicates = employeeNumbers.filter(
      (num, index) => employeeNumbers.indexOf(num) !== index
    );

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      for (const dupNum of uniqueDuplicates) {
        const indices = data
          .map((row, idx) => (row.employeeNumber?.trim() === dupNum ? idx + 1 : -1))
          .filter((idx) => idx > 0);
        errors.push(
          createError(
            indices[0],
            `Numéro employé dupliqué dans le fichier: ${dupNum} (lignes ${indices.join(', ')})`,
            'DUPLICATE_EMPLOYEE_NUMBER',
            'employeeNumber',
            dupNum
          )
        );
      }
    }

    // Check for existing employee numbers in database
    if (!context.dryRun) {
      const existingEmployees = await db
        .select({ employeeNumber: employees.employeeNumber })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, context.tenantId),
            eq(employees.status, 'active')
          )
        );

      const existingNumbers = new Set(
        existingEmployees.map((e) => e.employeeNumber)
      );

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (row.employeeNumber && existingNumbers.has(row.employeeNumber.trim())) {
          errors.push(
            createError(
              rowNum,
              `Numéro employé existe déjà: ${row.employeeNumber}`,
              'EMPLOYEE_NUMBER_EXISTS',
              'employeeNumber',
              row.employeeNumber
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import employee data into database
   */
  async import(
    data: EmployeeImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Transform data to match schema
    const employeeRecords = data.map((row) => {
      // Remove any whitespace from required fields
      const cleanedRow = {
        ...row,
        employeeNumber: row.employeeNumber?.trim(),
        firstName: row.firstName?.trim(),
        lastName: row.lastName?.trim(),
        email: row.email?.trim().toLowerCase(),
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        employeeNumber: cleanedRow.employeeNumber!,
        firstName: cleanedRow.firstName!,
        lastName: cleanedRow.lastName!,
        email: cleanedRow.email!,
        hireDate: cleanedRow.hireDate!, // Already in YYYY-MM-DD format from AI cleaning

        // Optional personal info
        ...(cleanedRow.preferredName && { preferredName: cleanedRow.preferredName }),
        ...(cleanedRow.dateOfBirth && { dateOfBirth: cleanedRow.dateOfBirth }),
        ...(cleanedRow.gender && { gender: cleanedRow.gender }),
        ...(cleanedRow.nationality && { nationality: cleanedRow.nationality }),
        ...(cleanedRow.placeOfBirth && { placeOfBirth: cleanedRow.placeOfBirth }),

        // Optional personnel record
        ...(cleanedRow.nationalityZone && {
          nationalityZone: cleanedRow.nationalityZone,
        }),
        ...(cleanedRow.employeeType && { employeeType: cleanedRow.employeeType }),
        ...(cleanedRow.fatherName && { fatherName: cleanedRow.fatherName }),
        ...(cleanedRow.motherName && { motherName: cleanedRow.motherName }),
        ...(cleanedRow.emergencyContactName && {
          emergencyContactName: cleanedRow.emergencyContactName,
        }),
        ...(cleanedRow.emergencyContactPhone && {
          emergencyContactPhone: cleanedRow.emergencyContactPhone,
        }),

        // Optional contact
        ...(cleanedRow.phone && { phone: cleanedRow.phone }),
        ...(cleanedRow.nationalId && { nationalId: cleanedRow.nationalId }),
        ...(cleanedRow.identityDocumentType && {
          identityDocumentType: cleanedRow.identityDocumentType,
        }),

        // Optional address
        ...(cleanedRow.addressLine1 && { addressLine1: cleanedRow.addressLine1 }),
        ...(cleanedRow.addressLine2 && { addressLine2: cleanedRow.addressLine2 }),
        ...(cleanedRow.city && { city: cleanedRow.city }),
        ...(cleanedRow.postalCode && { postalCode: cleanedRow.postalCode }),
        countryCode: cleanedRow.countryCode || context.countryCode || 'CI',

        // Optional employment
        ...(cleanedRow.terminationDate && {
          terminationDate: cleanedRow.terminationDate,
        }),
        ...(cleanedRow.terminationReason && {
          terminationReason: cleanedRow.terminationReason,
        }),
        ...(cleanedRow.contractType && { contractType: cleanedRow.contractType }),
        ...(cleanedRow.jobTitle && { jobTitle: cleanedRow.jobTitle }),
        ...(cleanedRow.profession && { profession: cleanedRow.profession }),
        ...(cleanedRow.qualification && { qualification: cleanedRow.qualification }),
        ...(cleanedRow.employmentClassification && {
          employmentClassification: cleanedRow.employmentClassification,
        }),
        ...(cleanedRow.salaryRegime && { salaryRegime: cleanedRow.salaryRegime }),

        // Optional organizational structure
        ...(cleanedRow.establishment && { establishment: cleanedRow.establishment }),
        ...(cleanedRow.division && { division: cleanedRow.division }),
        ...(cleanedRow.service && { service: cleanedRow.service }),
        ...(cleanedRow.section && { section: cleanedRow.section }),
        ...(cleanedRow.workSite && { workSite: cleanedRow.workSite }),

        // Optional banking
        ...(cleanedRow.bankName && { bankName: cleanedRow.bankName }),
        ...(cleanedRow.bankAccount && { bankAccount: cleanedRow.bankAccount }),

        // Optional social security
        ...(cleanedRow.cnpsNumber && { cnpsNumber: cleanedRow.cnpsNumber }),
        ...(cleanedRow.cmuNumber && { cmuNumber: cleanedRow.cmuNumber }),

        // Optional tax
        ...(cleanedRow.taxNumber && { taxNumber: cleanedRow.taxNumber }),
        taxDependents: cleanedRow.taxDependents ?? 0,
        isExpat: cleanedRow.isExpat ?? false,

        // Optional coefficient
        coefficient: cleanedRow.coefficient ?? 100,

        // Optional rate type
        rateType: cleanedRow.rateType ?? 'MONTHLY',
        paymentFrequency: cleanedRow.paymentFrequency ?? 'MONTHLY',
        weeklyHoursRegime: cleanedRow.weeklyHoursRegime ?? '40h',

        // Optional family information
        ...(cleanedRow.maritalStatus && { maritalStatus: cleanedRow.maritalStatus }),
        ...(cleanedRow.dependentChildren !== undefined && {
          dependentChildren: cleanedRow.dependentChildren,
        }),
        ...(cleanedRow.fiscalParts !== undefined && {
          fiscalParts: String(cleanedRow.fiscalParts),
        }),
        ...(cleanedRow.hasFamily !== undefined && { hasFamily: cleanedRow.hasFamily }),

        // Optional compensation
        ...(cleanedRow.categoricalSalary !== undefined && {
          categoricalSalary: String(cleanedRow.categoricalSalary),
        }),
        ...(cleanedRow.salaryPremium !== undefined && {
          salaryPremium: String(cleanedRow.salaryPremium),
        }),

        // Optional historical leave data
        ...(cleanedRow.initialLeaveBalance !== undefined && {
          initialLeaveBalance: String(cleanedRow.initialLeaveBalance),
        }),
        ...(cleanedRow.historicalUnpaidLeaveDays !== undefined && {
          historicalUnpaidLeaveDays: String(cleanedRow.historicalUnpaidLeaveDays),
        }),
        ...(cleanedRow.lastAnnualLeaveEndDate && {
          lastAnnualLeaveEndDate: cleanedRow.lastAnnualLeaveEndDate,
        }),

        // Optional document expiry
        ...(cleanedRow.nationalIdExpiry && {
          nationalIdExpiry: cleanedRow.nationalIdExpiry,
        }),
        ...(cleanedRow.workPermitExpiry && {
          workPermitExpiry: cleanedRow.workPermitExpiry,
        }),

        // Optional convention collective
        ...(cleanedRow.conventionCode && { conventionCode: cleanedRow.conventionCode }),
        ...(cleanedRow.professionalLevel !== undefined && {
          professionalLevel: cleanedRow.professionalLevel,
        }),
        ...(cleanedRow.sector && { sector: cleanedRow.sector }),

        // Optional CGECI
        ...(cleanedRow.categoryCode && { categoryCode: cleanedRow.categoryCode }),
        ...(cleanedRow.sectorCodeCgeci && {
          sectorCodeCgeci: cleanedRow.sectorCodeCgeci,
        }),

        // Status
        status: cleanedRow.status ?? 'active',

        // Defaults
        customFields: {},
        acpPaymentActive: false,

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: employeeRecords.length,
      });
    }

    // Step 4: Batch insert into database
    try {
      const recordsInserted = await batchInsert(employees, employeeRecords, 100);

      return createSuccessResult(recordsInserted, {
        employeeNumbers: employeeRecords.map((e) => e.employeeNumber),
        totalEmployees: recordsInserted,
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
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
export const employeeImporter = new EmployeeImporter();
