/**
 * Employee Salaries Importer
 *
 * Handles importing salary records into the employee_salaries table.
 * Tracks salary history with effective dates and validates against business rules.
 *
 * Features:
 * - Validates foreign key references (employee must exist)
 * - Validates salary amounts (must be positive)
 * - Validates effective dates (no overlaps for same employee)
 * - Warns if salary below SMIG for non-interns
 * - Handles salary components (base salary + allowances)
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
import { employeeSalaries } from '@/lib/db/schema/salaries';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, or, lte, gte, isNull } from 'drizzle-orm';

interface EmployeeSalaryImportData {
  // Required fields
  employeeId: string; // UUID
  baseSalary: number;
  effectiveFrom: string; // ISO date string (YYYY-MM-DD)

  // Optional fields
  effectiveTo?: string; // ISO date string
  currency?: string;
  payFrequency?: string;
  changeReason?: string;
  notes?: string;

  // Optional salary components (legacy allowances)
  transportAllowance?: number;
  housingAllowance?: number;
  foodAllowance?: number;
  otherAllowances?: Record<string, number>;

  // Optional salary components (new system)
  components?: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType?: string;
    metadata?: Record<string, any>;
  }>;
}

export class EmployeeSalariesImporter implements DataImporter<EmployeeSalaryImportData> {
  /**
   * Minimum wage constants (SMIG) by country
   * Should ideally be loaded from database, but hardcoded for now
   */
  private readonly SMIG: Record<string, number> = {
    CI: 75000, // Côte d'Ivoire
    SN: 52500, // Sénégal
    BF: 34000, // Burkina Faso
    ML: 40000, // Mali
    TG: 35000, // Togo
    BJ: 40000, // Bénin
  };

  /**
   * Validate employee salary data before import
   */
  async validate(
    data: EmployeeSalaryImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Step 1: Load all employees for this tenant (for FK validation)
    const existingEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        employeeType: employees.employeeType,
        countryCode: employees.countryCode,
      })
      .from(employees)
      .where(eq(employees.tenantId, context.tenantId));

    const employeeMap = new Map(
      existingEmployees.map((emp) => [emp.id, emp])
    );

    // Step 2: Load existing salary records (for duplicate/overlap detection)
    const existingSalaries = await db
      .select({
        id: employeeSalaries.id,
        employeeId: employeeSalaries.employeeId,
        effectiveFrom: employeeSalaries.effectiveFrom,
        effectiveTo: employeeSalaries.effectiveTo,
      })
      .from(employeeSalaries)
      .where(eq(employeeSalaries.tenantId, context.tenantId));

    // Group existing salaries by employeeId for efficient lookup
    const salariesByEmployee = new Map<string, typeof existingSalaries>();
    for (const salary of existingSalaries) {
      if (!salariesByEmployee.has(salary.employeeId)) {
        salariesByEmployee.set(salary.employeeId, []);
      }
      salariesByEmployee.get(salary.employeeId)!.push(salary);
    }

    // Step 3: Validate each record
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Required field: employeeId
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Identifiant employé est requis',
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
        continue; // Skip other validations if no employeeId
      }

      // Required field: baseSalary
      if (row.baseSalary === undefined || row.baseSalary === null) {
        errors.push(
          createError(
            rowNum,
            'Salaire de base est requis',
            'MISSING_BASE_SALARY',
            'baseSalary'
          )
        );
      } else if (typeof row.baseSalary !== 'number') {
        errors.push(
          createError(
            rowNum,
            `Salaire de base doit être un nombre: ${row.baseSalary}`,
            'INVALID_BASE_SALARY_TYPE',
            'baseSalary',
            row.baseSalary
          )
        );
      } else if (row.baseSalary <= 0) {
        errors.push(
          createError(
            rowNum,
            `Salaire de base doit être positif: ${row.baseSalary}`,
            'NEGATIVE_BASE_SALARY',
            'baseSalary',
            row.baseSalary
          )
        );
      }

      // Required field: effectiveFrom
      if (!row.effectiveFrom) {
        errors.push(
          createError(
            rowNum,
            'Date de prise d\'effet est requise',
            'MISSING_EFFECTIVE_FROM',
            'effectiveFrom'
          )
        );
      } else if (!this.isValidDate(row.effectiveFrom)) {
        errors.push(
          createError(
            rowNum,
            `Date de prise d'effet invalide: ${row.effectiveFrom}`,
            'INVALID_EFFECTIVE_FROM',
            'effectiveFrom',
            row.effectiveFrom
          )
        );
      }

      // Optional field: effectiveTo (must be after effectiveFrom)
      if (row.effectiveTo) {
        if (!this.isValidDate(row.effectiveTo)) {
          errors.push(
            createError(
              rowNum,
              `Date de fin invalide: ${row.effectiveTo}`,
              'INVALID_EFFECTIVE_TO',
              'effectiveTo',
              row.effectiveTo
            )
          );
        } else if (row.effectiveFrom && row.effectiveTo <= row.effectiveFrom) {
          errors.push(
            createError(
              rowNum,
              `Date de fin doit être après la date de prise d'effet (${row.effectiveFrom} -> ${row.effectiveTo})`,
              'EFFECTIVE_TO_BEFORE_FROM',
              'effectiveTo',
              row.effectiveTo
            )
          );
        }
      }

      // Foreign key validation: employeeId must exist
      const employee = employeeMap.get(row.employeeId);
      if (!employee) {
        errors.push(
          createError(
            rowNum,
            `Employé introuvable: ${row.employeeId}`,
            'EMPLOYEE_NOT_FOUND',
            'employeeId',
            row.employeeId
          )
        );
        continue; // Skip further validations if employee doesn't exist
      }

      // Check for duplicate entry (same employee + exact same effective date)
      const existingSalariesForEmployee = salariesByEmployee.get(row.employeeId) || [];
      const exactDuplicate = existingSalariesForEmployee.find(
        (s) => s.effectiveFrom === row.effectiveFrom
      );

      if (exactDuplicate) {
        errors.push(
          createError(
            rowNum,
            `Salaire existe déjà pour cet employé à cette date: ${employee.employeeNumber} (${row.effectiveFrom})`,
            'DUPLICATE_SALARY_ENTRY',
            'effectiveFrom',
            row.effectiveFrom
          )
        );
      }

      // Check for date overlap with existing salaries
      // A new salary overlaps if:
      // - It starts before an existing salary ends (or existing has no end)
      // - It ends after an existing salary starts (or new has no end)
      if (row.effectiveFrom && this.isValidDate(row.effectiveFrom)) {
        for (const existingSalary of existingSalariesForEmployee) {
          // Skip the exact duplicate we already caught
          if (existingSalary.effectiveFrom === row.effectiveFrom) {
            continue;
          }

          const newStart = new Date(row.effectiveFrom);
          const newEnd = row.effectiveTo ? new Date(row.effectiveTo) : null;
          const existingStart = new Date(existingSalary.effectiveFrom);
          const existingEnd = existingSalary.effectiveTo
            ? new Date(existingSalary.effectiveTo)
            : null;

          // Check for overlap
          const overlaps =
            (newEnd === null || newEnd >= existingStart) &&
            (existingEnd === null || existingStart <= (newEnd || new Date('9999-12-31'))) &&
            newStart <= (existingEnd || new Date('9999-12-31'));

          if (overlaps) {
            errors.push(
              createError(
                rowNum,
                `Période de salaire chevauche une période existante pour ${employee.employeeNumber}: ${existingSalary.effectiveFrom} → ${existingSalary.effectiveTo || 'présent'}`,
                'SALARY_DATE_OVERLAP',
                'effectiveFrom',
                row.effectiveFrom
              )
            );
            break; // Only report first overlap
          }
        }
      }
    }

    // Step 4: Generate warnings (non-blocking)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const employee = employeeMap.get(row.employeeId);

      if (!employee || !row.baseSalary) {
        continue; // Skip if validation errors already exist
      }

      // Warning: Salary below SMIG (except for STAGIAIRE)
      const countryCode = employee.countryCode || context.countryCode || 'CI';
      const smig = this.SMIG[countryCode] || this.SMIG['CI'];

      if (
        row.baseSalary < smig &&
        employee.employeeType !== 'STAGIAIRE'
      ) {
        errors.push(
          createWarning(
            rowNum,
            `Salaire inférieur au SMIG de ${countryCode} (${smig.toLocaleString()} FCFA) pour ${employee.employeeNumber}: ${row.baseSalary.toLocaleString()} FCFA`,
            'SALARY_BELOW_SMIG',
            'baseSalary',
            row.baseSalary
          )
        );
      }
    }

    return errors;
  }

  /**
   * Import employee salary data into database
   */
  async import(
    data: EmployeeSalaryImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);

    // Separate errors and warnings
    const errors = validationErrors.filter((e) => 'message' in e && !('code' in e && e.code.startsWith('SALARY_BELOW_SMIG')));
    const warnings = validationErrors.filter((e) => 'code' in e && e.code.startsWith('SALARY_BELOW_SMIG'));

    if (errors.length > 0) {
      return {
        ...createFailureResult(errors),
        warnings,
      };
    }

    // Step 2: Transform data to match schema
    const salaryRecords = data.map((row) => {
      // Build components array (new system)
      let components: any[] = [];

      if (row.components && row.components.length > 0) {
        // Use provided components
        components = row.components;
      } else {
        // Build from base salary + legacy allowances
        components.push({
          code: '11',
          name: 'Salaire de base',
          amount: row.baseSalary,
          sourceType: 'base',
          metadata: {},
        });

        // Add legacy allowances as components
        if (row.transportAllowance && row.transportAllowance > 0) {
          components.push({
            code: '21',
            name: 'Indemnité de transport',
            amount: row.transportAllowance,
            sourceType: 'allowance',
            metadata: {},
          });
        }

        if (row.housingAllowance && row.housingAllowance > 0) {
          components.push({
            code: '22',
            name: 'Indemnité de logement',
            amount: row.housingAllowance,
            sourceType: 'allowance',
            metadata: {},
          });
        }

        if (row.foodAllowance && row.foodAllowance > 0) {
          components.push({
            code: '23',
            name: 'Indemnité de repas',
            amount: row.foodAllowance,
            sourceType: 'allowance',
            metadata: {},
          });
        }

        if (row.otherAllowances) {
          let index = 30;
          for (const [name, amount] of Object.entries(row.otherAllowances)) {
            if (amount > 0) {
              components.push({
                code: String(index++),
                name,
                amount,
                sourceType: 'allowance',
                metadata: {},
              });
            }
          }
        }
      }

      // Build legacy allowances JSONB
      const allowances: Record<string, number> = {};
      if (row.transportAllowance) allowances.transport = row.transportAllowance;
      if (row.housingAllowance) allowances.housing = row.housingAllowance;
      if (row.foodAllowance) allowances.food = row.foodAllowance;
      if (row.otherAllowances) {
        Object.assign(allowances, row.otherAllowances);
      }

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Foreign keys
        employeeId: row.employeeId,

        // Salary components
        baseSalary: String(row.baseSalary),
        currency: row.currency || 'XOF',
        payFrequency: row.payFrequency || 'monthly',

        // Legacy allowances
        allowances,

        // New components system
        components,

        // Effective dating
        effectiveFrom: row.effectiveFrom,
        ...(row.effectiveTo && { effectiveTo: row.effectiveTo }),

        // Change tracking
        ...(row.changeReason && { changeReason: row.changeReason }),
        ...(row.notes && { notes: row.notes }),

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return {
        success: true,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        warnings,
        metadata: {
          message: 'Validation réussie (mode test)',
          wouldInsert: salaryRecords.length,
        },
      };
    }

    // Step 4: Batch insert into database
    try {
      const recordsInserted = await batchInsert(employeeSalaries, salaryRecords, 100);

      return {
        success: true,
        recordsInserted,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        warnings,
        metadata: {
          totalSalaries: recordsInserted,
          employeeIds: salaryRecords.map((s) => s.employeeId),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [
          createError(
            0,
            `Erreur lors de l'insertion: ${errorMessage}`,
            'DATABASE_INSERT_ERROR'
          ),
        ],
        warnings,
      };
    }
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

  /**
   * Helper: Create warning (non-blocking issue)
   */
  private createWarning(
    row: number,
    message: string,
    code: string,
    field?: string,
    value?: any
  ): ImportError {
    return { row, field, message, code, value };
  }
}

// Export singleton instance
export const employeeSalariesImporter = new EmployeeSalariesImporter();
