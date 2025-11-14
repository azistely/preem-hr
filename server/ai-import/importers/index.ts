/**
 * Importer Dispatcher
 *
 * Central registry that routes to the correct importer based on data type.
 * Called by the coordinator after data has been classified, cleaned, and validated.
 *
 * Architecture:
 * - Each data type has a dedicated importer class
 * - Importers follow the DataImporter<T> interface
 * - Dispatcher provides type-safe access to all importers
 *
 * @see server/ai-import/importers/base-importer.ts for interface definition
 */

import { DataImporter, ImportContext, ImportResult, ImportError } from './base-importer';

// Import concrete implementations
import { employeeImporter } from './employee-importer';
import { payrollHistoryImporter } from './payroll-history-importer';
import { employmentContractsImporter } from './employment-contracts-importer';
import { employeeSalariesImporter } from './employee-salaries-importer';
import { employeeDependentsImporter } from './employee-dependents-importer';
import { timeOffBalancesImporter } from './time-off-balances-importer';
import { benefitPlansImporter } from './benefit-plans-importer';
import { benefitEnrollmentsImporter } from './benefit-enrollments-importer';
import { departmentsImporter } from './departments-importer';
import { cnpsDeclarationsImporter } from './cnps-declarations-importer';
import { positionsImporter } from './positions-importer';
import { timeEntriesImporter } from './time-entries-importer';
import { timeOffRequestsImporter } from './time-off-requests-importer';
import { positionAssignmentImporter } from './position-assignments-importer';

/**
 * Get the appropriate importer for a data type
 *
 * @param dataType - Data type ID from data-type-registry
 * @returns Importer instance or null if not implemented
 */
export function getImporter(dataType: string): DataImporter | null {
  switch (dataType) {
    // ========================================
    // EMPLOYEE DATA
    // ========================================
    case 'employee_master':
      return employeeImporter;

    case 'employment_contracts':
      return employmentContractsImporter;

    case 'employee_salaries':
      return employeeSalariesImporter;

    case 'employee_dependents':
      return employeeDependentsImporter;

    case 'employee_documents':
      // TODO: Implement employee documents importer
      return null;

    // ========================================
    // PAYROLL DATA
    // ========================================
    case 'payroll_history':
      return payrollHistoryImporter;

    case 'payroll_current':
      // TODO: Implement current payroll importer
      return null;

    case 'cnps_declarations':
      return cnpsDeclarationsImporter;

    case 'tax_declarations':
      // TODO: Implement tax declarations importer
      return null;

    case 'payslips':
      // TODO: Implement payslips importer
      return null;

    case 'payment_history':
      // TODO: Implement payment history importer
      return null;

    // ========================================
    // BENEFITS DATA
    // ========================================
    case 'benefit_plans':
      return benefitPlansImporter;

    case 'benefit_enrollment':
      return benefitEnrollmentsImporter;

    case 'cmu_coverage':
      // TODO: Implement CMU coverage importer
      return null;

    // ========================================
    // TIME & ATTENDANCE DATA
    // ========================================
    case 'time_entries':
      return timeEntriesImporter;

    case 'time_off_requests':
      return timeOffRequestsImporter;

    case 'time_off_balances':
      return timeOffBalancesImporter;

    case 'overtime_records':
      // TODO: Implement overtime records importer
      return null;

    case 'attendance_records':
      // TODO: Implement attendance records importer
      return null;

    case 'leave_accruals':
      // TODO: Implement leave accruals importer
      return null;

    case 'holiday_calendars':
      // TODO: Implement holiday calendars importer
      return null;

    // ========================================
    // ORGANIZATIONAL DATA
    // ========================================
    case 'departments':
      return departmentsImporter;

    case 'positions':
      return positionsImporter;

    case 'position_assignments':
      return positionAssignmentImporter;

    case 'locations':
      // TODO: Implement locations importer
      return null;

    // ========================================
    // DOCUMENTS
    // ========================================
    case 'contracts_documents':
      // TODO: Implement contracts documents importer
      return null;

    case 'certificates':
      // TODO: Implement certificates importer
      return null;

    // ========================================
    // ACCOUNTING
    // ========================================
    case 'general_ledger_entries':
      // TODO: Implement general ledger entries importer
      return null;

    case 'cost_centers':
      // TODO: Implement cost centers importer
      return null;

    // ========================================
    // DEFAULT
    // ========================================
    default:
      console.warn(`[Importer Dispatcher] No importer found for data type: ${dataType}`);
      return null;
  }
}

/**
 * Execute import for a specific data type
 *
 * This is the main entry point called by the coordinator.
 *
 * @param dataType - Data type ID from classification
 * @param data - Cleaned and validated data
 * @param context - Import context (tenant, user, etc.)
 * @returns Import result with success/failure status
 */
export async function executeImport(
  dataType: string,
  data: any[],
  context: ImportContext
): Promise<ImportResult> {
  const importer = getImporter(dataType);

  if (!importer) {
    return {
      success: false,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [
        {
          row: 0,
          message: `Importer non disponible pour le type de données: ${dataType}. Ce type sera supporté dans une prochaine version.`,
          code: 'IMPORTER_NOT_IMPLEMENTED',
        },
      ],
      warnings: [],
      metadata: {
        dataType,
        availableImporters: [
          'employee_master',
          'employment_contracts',
          'employee_salaries',
          'employee_dependents',
          'payroll_history',
          'cnps_declarations',
          'time_off_balances',
          'time_entries',
          'time_off_requests',
          'benefit_plans',
          'benefit_enrollment',
          'departments',
          'positions',
          'position_assignments',
        ],
      },
    };
  }

  try {
    return await importer.import(data, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return {
      success: false,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [
        {
          row: 0,
          message: `Erreur lors de l'import: ${errorMessage}`,
          code: 'IMPORT_EXECUTION_ERROR',
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Check if an importer is available for a data type
 *
 * @param dataType - Data type ID
 * @returns True if importer is implemented
 */
export function hasImporter(dataType: string): boolean {
  return getImporter(dataType) !== null;
}

/**
 * Get list of all available data types with importers
 *
 * @returns Array of data type IDs that have implemented importers
 */
export function getAvailableImporters(): string[] {
  return [
    'employee_master',
    'employment_contracts',
    'employee_salaries',
    'employee_dependents',
    'payroll_history',
    'cnps_declarations',
    'time_off_balances',
    'time_entries',
    'time_off_requests',
    'benefit_plans',
    'benefit_enrollment',
    'departments',
    'positions',
    'position_assignments',
  ];
}
