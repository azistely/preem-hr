/**
 * SAGE Import Service
 * Handles import of employees and historical payroll data from SAGE/CIEL exports
 *
 * Supports:
 * - CSV files (ISO-8859-1 encoding, semicolon delimiter)
 * - Excel files (.xlsx, .xls)
 * - Field mapping configuration
 * - Validation before import
 * - Progress tracking
 */

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import {
  dataMigrations,
  employeeImportStaging,
  historicalPayrollData,
  type NewDataMigration,
  type NewEmployeeImportStaging,
  type NewHistoricalPayrollData,
} from '@/lib/db/schema';
import { employees } from '@/lib/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface SAGEFieldMapping {
  sageField: string;
  preemField: string;
  transformation?: 'uppercase' | 'lowercase' | 'trim' | 'date_parse';
  defaultValue?: string | number;
}

export interface SAGEImportConfig {
  employeeFields: SAGEFieldMapping[];
  payrollFields: SAGEFieldMapping[];
  dateFormat: string; // 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'
  encoding: string; // 'UTF-8', 'ISO-8859-1' (default for SAGE)
  delimiter: string; // ',', ';' (default for SAGE), '\t'
}

export interface ImportResult {
  migrationId: string;
  totalRecords: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; field: string; error: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// SAGE Import Service Class
// ============================================================================

export class SAGEImportService {
  /**
   * Import employees from SAGE export file
   *
   * Process:
   * 1. Create migration record
   * 2. Parse file (CSV or Excel)
   * 3. Map SAGE fields to Preem fields
   * 4. Validate each record
   * 5. Insert to staging table
   * 6. Import valid records to employees table
   * 7. Update migration status
   */
  async importEmployees(
    tenantId: string,
    file: File,
    mapping: SAGEImportConfig,
    userId: string
  ): Promise<ImportResult> {
    // 1. Create migration tracking record
    const [migration] = await db
      .insert(dataMigrations)
      .values({
        tenantId,
        migrationType: 'sage_employees',
        sourceSystem: 'SAGE',
        fileName: file.name,
        fileSizeBytes: file.size,
        migrationStatus: 'processing',
        fieldMapping: mapping as any,
        migratedBy: userId,
        startedAt: new Date().toISOString(),
      })
      .returning();

    try {
      // 2. Parse file
      const records = await this.parseFile(file, mapping);

      // Update total records count
      await db
        .update(dataMigrations)
        .set({ totalRecords: records.length })
        .where(eq(dataMigrations.id, migration.id));

      // 3. Map and validate records
      const validationResults: Array<{
        record: any;
        validation: ValidationResult;
      }> = [];

      for (let i = 0; i < records.length; i++) {
        const sageRecord = records[i];
        const mappedRecord = this.mapSAGERecord(
          sageRecord,
          mapping.employeeFields
        );
        const validation = this.validateEmployeeRecord(mappedRecord);

        validationResults.push({ record: mappedRecord, validation });

        // Insert to staging table
        const stagingData: NewEmployeeImportStaging = {
          migrationId: migration.id,
          rowNumber: i + 1,
          employeeNumber: mappedRecord.employee_number || '',
          firstName: mappedRecord.first_name || null,
          lastName: mappedRecord.last_name || null,
          categoryCode: mappedRecord.category_code || null,
          baseSalary: mappedRecord.base_salary || null,
          hireDate: mappedRecord.hire_date || null,
          department: mappedRecord.department || null,
          positionTitle: mappedRecord.position_title || null,
          email: mappedRecord.email || null,
          phone: mappedRecord.phone || null,
          address: mappedRecord.address || null,
          familySituation: mappedRecord.family_situation || null,
          sourceData: sageRecord,
          validationStatus: validation.valid
            ? 'valid'
            : validation.warnings.length > 0
              ? 'warning'
              : 'invalid',
          validationErrors: validation.errors as any,
          validationWarnings: validation.warnings as any,
        };

        await db.insert(employeeImportStaging).values(stagingData);
      }

      // 4. Import valid records to employees table
      const validRecords = validationResults.filter((v) => v.validation.valid);
      let imported = 0;
      let failed = 0;
      const errors: Array<{ row: number; field: string; error: string }> = [];

      for (let i = 0; i < validRecords.length; i++) {
        const { record } = validRecords[i];

        try {
          // Check if employee already exists
          const existingEmployee = await db.query.employees.findFirst({
            where: and(
              eq(employees.tenantId, tenantId),
              eq(employees.employeeNumber, record.employee_number)
            ),
          });

          if (existingEmployee) {
            failed++;
            errors.push({
              row: i + 1,
              field: 'employee_number',
              error: `Employé avec matricule ${record.employee_number} existe déjà`,
            });
            continue;
          }

          // Insert employee
          const [newEmployee] = await db
            .insert(employees)
            .values({
              tenantId,
              employeeNumber: record.employee_number,
              firstName: record.first_name,
              lastName: record.last_name,
              email: record.email || `${record.employee_number}@temp.preem-hr.com`,
              phone: record.phone || null,
              hireDate: record.hire_date,
              countryCode: 'CI', // Default to Côte d'Ivoire
              coefficient: this.getCoefficientFromCategory(record.category_code),
              status: 'active',
              customFields: {},
            })
            .returning();

          // Update staging table with imported employee ID
          await db
            .update(employeeImportStaging)
            .set({ importedEmployeeId: newEmployee.id })
            .where(
              and(
                eq(employeeImportStaging.migrationId, migration.id),
                eq(employeeImportStaging.employeeNumber, record.employee_number)
              )
            );

          imported++;
        } catch (error) {
          failed++;
          errors.push({
            row: i + 1,
            field: 'employee',
            error:
              error instanceof Error
                ? error.message
                : 'Erreur inconnue lors de l\'import',
          });
        }
      }

      // 5. Update migration status
      await db
        .update(dataMigrations)
        .set({
          importedRecords: imported,
          failedRecords: failed,
          errorLog: errors as any,
          migrationStatus: 'completed',
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataMigrations.id, migration.id));

      return {
        migrationId: migration.id,
        totalRecords: records.length,
        imported,
        failed,
        errors,
      };
    } catch (error) {
      // Mark migration as failed
      await db
        .update(dataMigrations)
        .set({
          migrationStatus: 'failed',
          errorLog: [
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Erreur inconnue',
              timestamp: new Date().toISOString(),
            },
          ] as any,
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataMigrations.id, migration.id));

      throw error;
    }
  }

  /**
   * Import historical payroll data from SAGE
   */
  async importHistoricalPayroll(
    tenantId: string,
    file: File,
    mapping: SAGEImportConfig,
    userId: string
  ): Promise<ImportResult> {
    // 1. Create migration record
    const [migration] = await db
      .insert(dataMigrations)
      .values({
        tenantId,
        migrationType: 'sage_payroll',
        sourceSystem: 'SAGE',
        fileName: file.name,
        fileSizeBytes: file.size,
        migrationStatus: 'processing',
        fieldMapping: mapping as any,
        migratedBy: userId,
        startedAt: new Date().toISOString(),
      })
      .returning();

    try {
      // 2. Parse file
      const records = await this.parseFile(file, mapping);

      await db
        .update(dataMigrations)
        .set({ totalRecords: records.length })
        .where(eq(dataMigrations.id, migration.id));

      // 3. Import payroll data
      let imported = 0;
      let failed = 0;
      const errors: Array<{ row: number; field: string; error: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const sageRecord = records[i];

        try {
          const mapped = this.mapSAGERecord(sageRecord, mapping.payrollFields);

          const payrollData: NewHistoricalPayrollData = {
            tenantId,
            migrationId: migration.id,
            employeeNumber: mapped.employee_number,
            employeeName: mapped.employee_name || null,
            payrollPeriod: mapped.period, // 'YYYY-MM'
            grossSalary: mapped.gross_salary || null,
            netSalary: mapped.net_salary || null,
            cnpsEmployee: mapped.cnps_employee || null,
            cnpsEmployer: mapped.cnps_employer || null,
            its: mapped.its || null,
            components: mapped.components || {},
            deductions: mapped.deductions || {},
            sourceData: sageRecord,
            paymentDate: mapped.payment_date || null,
            paymentMethod: mapped.payment_method || null,
          };

          await db.insert(historicalPayrollData).values(payrollData);
          imported++;
        } catch (error) {
          failed++;
          errors.push({
            row: i + 1,
            field: 'payroll',
            error:
              error instanceof Error
                ? error.message
                : 'Erreur inconnue',
          });
        }
      }

      // 4. Update migration status
      await db
        .update(dataMigrations)
        .set({
          importedRecords: imported,
          failedRecords: failed,
          errorLog: errors as any,
          migrationStatus: 'completed',
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataMigrations.id, migration.id));

      return {
        migrationId: migration.id,
        totalRecords: records.length,
        imported,
        failed,
        errors,
      };
    } catch (error) {
      await db
        .update(dataMigrations)
        .set({
          migrationStatus: 'failed',
          errorLog: [
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Erreur inconnue',
              timestamp: new Date().toISOString(),
            },
          ] as any,
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataMigrations.id, migration.id));

      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Parse CSV or Excel file
   */
  private async parseFile(
    file: File,
    mapping: SAGEImportConfig
  ): Promise<any[]> {
    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer);

    if (file.name.endsWith('.csv')) {
      return parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: mapping.delimiter,
        encoding: mapping.encoding as BufferEncoding,
        trim: true,
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const workbook = XLSX.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    } else {
      throw new Error(
        'Format de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls).'
      );
    }
  }

  /**
   * Map SAGE field to Preem HR field using mapping config
   */
  private mapSAGERecord(
    sageRecord: any,
    mapping: SAGEFieldMapping[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const fieldMap of mapping) {
      let value = sageRecord[fieldMap.sageField];

      // Use default if value is missing
      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        value = fieldMap.defaultValue;
      }

      // Apply transformation
      if (value && fieldMap.transformation) {
        switch (fieldMap.transformation) {
          case 'uppercase':
            value = String(value).toUpperCase();
            break;
          case 'lowercase':
            value = String(value).toLowerCase();
            break;
          case 'trim':
            value = String(value).trim();
            break;
          case 'date_parse':
            value = this.parseDate(String(value));
            break;
        }
      }

      result[fieldMap.preemField] = value;
    }

    return result;
  }

  /**
   * Validate employee record before import
   */
  private validateEmployeeRecord(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields
    if (!record.employee_number) {
      errors.push({ field: 'employee_number', message: 'Matricule requis' });
    }
    if (!record.first_name) {
      errors.push({ field: 'first_name', message: 'Prénom requis' });
    }
    if (!record.last_name) {
      errors.push({ field: 'last_name', message: 'Nom requis' });
    }

    // Base salary validation
    if (record.base_salary !== undefined && record.base_salary !== null) {
      const salary = Number(record.base_salary);
      if (isNaN(salary)) {
        errors.push({
          field: 'base_salary',
          message: 'Salaire doit être un nombre',
        });
      } else if (salary <= 0) {
        errors.push({
          field: 'base_salary',
          message: 'Salaire doit être positif',
        });
      } else if (salary < 75000) {
        warnings.push({
          field: 'base_salary',
          message: 'Salaire inférieur au SMIG (75,000 FCFA)',
        });
      }
    }

    // Category code validation
    const validCategories = ['A1', 'A2', 'B', 'C', 'D', 'E', 'F'];
    if (
      record.category_code &&
      !validCategories.includes(record.category_code)
    ) {
      warnings.push({
        field: 'category_code',
        message: `Catégorie invalide: ${record.category_code}`,
      });
    }

    // Hire date validation
    if (record.hire_date) {
      const date =
        record.hire_date instanceof Date
          ? record.hire_date
          : new Date(record.hire_date);

      if (isNaN(date.getTime())) {
        errors.push({
          field: 'hire_date',
          message: "Date d'embauche invalide",
        });
      } else if (date > new Date()) {
        warnings.push({
          field: 'hire_date',
          message: "Date d'embauche dans le futur",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse date string in multiple formats
   */
  private parseDate(dateString: string): Date | null {
    // Handle multiple date formats common in SAGE exports
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
      /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        // Parse based on format
        if (format.source.startsWith('^(\\d{4})')) {
          // YYYY-MM-DD
          return new Date(`${match[1]}-${match[2]}-${match[3]}`);
        } else {
          // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
          return new Date(`${match[3]}-${match[2]}-${match[1]}`);
        }
      }
    }

    // Try native Date parsing as fallback
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Convert SAGE category code to CGECI coefficient
   */
  private getCoefficientFromCategory(categoryCode: string | null): number {
    if (!categoryCode) return 100;

    // CGECI category mapping
    const categoryMap: Record<string, number> = {
      A1: 100,
      A2: 115,
      B: 130,
      C: 150,
      D: 175,
      E: 200,
      F: 250,
    };

    return categoryMap[categoryCode.toUpperCase()] || 100;
  }
}

// Export singleton instance
export const sageImportService = new SAGEImportService();
