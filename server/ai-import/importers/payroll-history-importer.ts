/**
 * Payroll History Importer
 *
 * Handles importing historical payroll data from SAGE/CIEL/Excel into the
 * historical_payroll_data table.
 *
 * **CRITICAL:** This importer operates in "preserve_amounts" mode - it does NOT
 * recalculate anything. All amounts are stored exactly as provided in the import file.
 *
 * Features:
 * - Preserves original payroll amounts (no recalculation)
 * - Stores detailed components and deductions in JSONB
 * - Links to employee records by employeeNumber
 * - Validates period format (YYYY-MM)
 * - Tenant isolation enforced
 * - Batch insertion for performance
 */

import {
  DataImporter,
  ImportContext,
  ImportResult,
  ImportError,
  ImportWarning,
  createSuccessResult,
  createFailureResult,
  createError,
  createWarning,
  batchInsert,
} from './base-importer';
import { db } from '@/lib/db';
import { historicalPayrollData } from '@/lib/db/schema/data-migration';
import { employees } from '@/lib/db/schema/employees';
import { eq, and } from 'drizzle-orm';

interface PayrollHistoryImportData {
  // Required fields
  employeeNumber: string;
  payrollPeriod: string; // 'YYYY-MM' format

  // Optional employee info
  employeeName?: string;

  // Optional salary amounts
  grossSalary?: number;
  netSalary?: number;

  // Optional social security
  cnpsEmployee?: number;
  cnpsEmployer?: number;

  // Optional tax
  its?: number;

  // Optional detailed components (AI will extract these from columns)
  components?: Record<string, number>; // { "Prime Ancienneté": 25000, "Prime Transport": 75000 }
  deductions?: Record<string, number>; // { "Avance": 50000, "Prêt": 100000 }

  // Optional payment info
  paymentDate?: string; // ISO date string
  paymentMethod?: string;

  // Source data (for audit - AI will preserve all original columns)
  sourceData?: Record<string, any>;

  // Migration tracking (optional - set by coordinator if part of migration)
  migrationId?: string;
}

export class PayrollHistoryImporter implements DataImporter<PayrollHistoryImportData> {
  /**
   * Validate payroll history data before import
   */
  async validate(
    data: PayrollHistoryImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    // Get all employee numbers for this tenant to verify they exist
    const employeeNumbersInDb = await db
      .select({ employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(eq(employees.tenantId, context.tenantId));

    const validEmployeeNumbers = new Set(
      employeeNumbersInDb.map((e) => e.employeeNumber)
    );

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

      if (!row.payrollPeriod?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Période de paie est requise',
            'MISSING_PAYROLL_PERIOD',
            'payrollPeriod'
          )
        );
      } else if (!this.isValidPeriod(row.payrollPeriod)) {
        errors.push(
          createError(
            rowNum,
            `Période de paie invalide: ${row.payrollPeriod} (format attendu: YYYY-MM, ex: 2024-03)`,
            'INVALID_PAYROLL_PERIOD',
            'payrollPeriod',
            row.payrollPeriod
          )
        );
      }

      // Validate employee exists (warning if not found - user might import employees later)
      if (
        row.employeeNumber?.trim() &&
        !validEmployeeNumbers.has(row.employeeNumber.trim())
      ) {
        warnings.push(
          createWarning(
            rowNum,
            `Employé non trouvé: ${row.employeeNumber}. Assurez-vous d'importer les employés d'abord.`,
            'EMPLOYEE_NOT_FOUND',
            'employeeNumber',
            row.employeeNumber
          )
        );
      }

      // Validate numeric fields if present
      if (row.grossSalary !== undefined && row.grossSalary < 0) {
        errors.push(
          createError(
            rowNum,
            `Salaire brut invalide: ${row.grossSalary}`,
            'INVALID_GROSS_SALARY',
            'grossSalary',
            row.grossSalary
          )
        );
      }

      if (row.netSalary !== undefined && row.netSalary < 0) {
        errors.push(
          createError(
            rowNum,
            `Salaire net invalide: ${row.netSalary}`,
            'INVALID_NET_SALARY',
            'netSalary',
            row.netSalary
          )
        );
      }

      // Validate payment date if present
      if (row.paymentDate && !this.isValidDate(row.paymentDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de paiement invalide: ${row.paymentDate}`,
            'INVALID_PAYMENT_DATE',
            'paymentDate',
            row.paymentDate
          )
        );
      }
    }

    // Check for duplicate entries (same employee + period)
    const entries = data.map((row) => `${row.employeeNumber}-${row.payrollPeriod}`);
    const duplicates = entries.filter((entry, index) => entries.indexOf(entry) !== index);

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      for (const dup of uniqueDuplicates) {
        const [empNum, period] = dup.split('-');
        const indices = data
          .map((row, idx) =>
            row.employeeNumber === empNum && row.payrollPeriod === period ? idx + 1 : -1
          )
          .filter((idx) => idx > 0);
        errors.push(
          createError(
            indices[0],
            `Doublon détecté pour employé ${empNum} période ${period} (lignes ${indices.join(', ')})`,
            'DUPLICATE_PAYROLL_ENTRY',
            'employeeNumber',
            dup
          )
        );
      }
    }

    // Check for existing records in database (if not dry run)
    if (!context.dryRun) {
      const existingRecords = await db
        .select({
          employeeNumber: historicalPayrollData.employeeNumber,
          payrollPeriod: historicalPayrollData.payrollPeriod,
        })
        .from(historicalPayrollData)
        .where(eq(historicalPayrollData.tenantId, context.tenantId));

      const existingKeys = new Set(
        existingRecords.map((r) => `${r.employeeNumber}-${r.payrollPeriod}`)
      );

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;
        const key = `${row.employeeNumber}-${row.payrollPeriod}`;

        if (existingKeys.has(key)) {
          warnings.push(
            createWarning(
              rowNum,
              `Données de paie existent déjà pour ${row.employeeNumber} période ${row.payrollPeriod}. Les données seront écrasées si l'import continue.`,
              'PAYROLL_DATA_EXISTS',
              'employeeNumber',
              key
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import payroll history data into database
   */
  async import(
    data: PayrollHistoryImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Transform data to match schema
    const payrollRecords = data.map((row) => {
      // Clean required fields
      const cleanedRow = {
        ...row,
        employeeNumber: row.employeeNumber?.trim(),
        payrollPeriod: row.payrollPeriod?.trim(),
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        employeeNumber: cleanedRow.employeeNumber!,
        payrollPeriod: cleanedRow.payrollPeriod!, // Already in YYYY-MM format from AI cleaning

        // Optional employee info
        ...(cleanedRow.employeeName && {
          employeeName: cleanedRow.employeeName.trim(),
        }),

        // Optional salary amounts (preserve as-is, no recalculation)
        ...(cleanedRow.grossSalary !== undefined && {
          grossSalary: String(cleanedRow.grossSalary),
        }),
        ...(cleanedRow.netSalary !== undefined && {
          netSalary: String(cleanedRow.netSalary),
        }),

        // Optional social security (preserve as-is)
        ...(cleanedRow.cnpsEmployee !== undefined && {
          cnpsEmployee: String(cleanedRow.cnpsEmployee),
        }),
        ...(cleanedRow.cnpsEmployer !== undefined && {
          cnpsEmployer: String(cleanedRow.cnpsEmployer),
        }),

        // Optional tax (preserve as-is)
        ...(cleanedRow.its !== undefined && {
          its: String(cleanedRow.its),
        }),

        // Optional detailed components (AI extracts from Excel columns)
        components: cleanedRow.components || {},
        deductions: cleanedRow.deductions || {},

        // Optional payment info
        ...(cleanedRow.paymentDate && {
          paymentDate: cleanedRow.paymentDate,
        }),
        ...(cleanedRow.paymentMethod && {
          paymentMethod: cleanedRow.paymentMethod,
        }),

        // Source data (for audit - AI preserves all original columns)
        sourceData: cleanedRow.sourceData || {},

        // Migration tracking (if provided)
        ...(cleanedRow.migrationId && {
          migrationId: cleanedRow.migrationId,
        }),
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: payrollRecords.length,
      });
    }

    // Step 4: Delete existing records for same employee + period (if allowPartialImport)
    // This allows re-importing corrected data
    if (context.allowPartialImport) {
      for (const record of payrollRecords) {
        await db
          .delete(historicalPayrollData)
          .where(
            and(
              eq(historicalPayrollData.tenantId, context.tenantId),
              eq(historicalPayrollData.employeeNumber, record.employeeNumber),
              eq(historicalPayrollData.payrollPeriod, record.payrollPeriod)
            )
          );
      }
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(
        historicalPayrollData,
        payrollRecords,
        100
      );

      // Calculate totals for metadata
      const totalGrossSalary = payrollRecords.reduce(
        (sum, r) => sum + (parseFloat(r.grossSalary as any) || 0),
        0
      );
      const totalNetSalary = payrollRecords.reduce(
        (sum, r) => sum + (parseFloat(r.netSalary as any) || 0),
        0
      );

      return createSuccessResult(recordsInserted, {
        totalRecords: recordsInserted,
        uniqueEmployees: new Set(payrollRecords.map((r) => r.employeeNumber)).size,
        periods: [...new Set(payrollRecords.map((r) => r.payrollPeriod))],
        totalGrossSalary: Math.round(totalGrossSalary),
        totalNetSalary: Math.round(totalNetSalary),
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
   * Helper: Validate payroll period format (YYYY-MM)
   */
  private isValidPeriod(period: string): boolean {
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(period)) {
      return false;
    }

    const [year, month] = period.split('-').map(Number);
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
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
export const payrollHistoryImporter = new PayrollHistoryImporter();
