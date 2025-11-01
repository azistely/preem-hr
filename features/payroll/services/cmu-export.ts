/**
 * CMU Export Service
 *
 * Generates CSV/Excel export file for CMU (Couverture Maladie Universelle)
 * portal submission in Côte d'Ivoire.
 *
 * IMPORTANT: Multi-Closure Aggregation (Phase 5)
 * ==============================================
 * With daily workers (journaliers), a company may have multiple payroll closures per month.
 * CMU declaration follows the same aggregation strategy as CNPS:
 *
 * CMU Aggregation Strategy:
 * -------------------------
 * - CMU is filed ONCE per month, aggregating all closures
 * - Sum CMU contributions for each employee across all closures in the month
 * - Monthly workers pay CMU once, weekly workers 4× per month (1,000 + 500 each week = 6,000 total)
 * - Example: If a weekly worker has CMU 1,500 FCFA/week:
 *   - Week 1-4: 1,500 each = 6,000 total CMU
 *
 * Implementation Note:
 * - Accept month parameter (YYYY-MM) instead of single payrollRunId
 * - Query all approved payroll_runs for that month
 * - Group by employee_id, sum CMU contributions across all closures
 * - Generate single CMU declaration with aggregated totals
 *
 * Reference: DAILY-WORKERS-ARCHITECTURE-V2.md Section 10.5, Task 3
 *
 * Required columns:
 * - Matricule (employee number)
 * - Nom et Prénoms (full name)
 * - Cotisation Salarié (1,000 FCFA fixed) - AGGREGATED across closures
 * - Cotisation Patronale (500 FCFA without family, 5,000 FCFA with family) - AGGREGATED
 * - Ayants droit (number of family members - not always available)
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface CMUEmployeeData {
  employeeName: string;
  employeeNumber: string;
  cmuEmployee: number;
  cmuEmployer: number;
  hasFamily?: boolean;
  dependents?: number;
}

export interface CMUExportData {
  companyName: string;
  companyTaxId?: string;
  periodStart: Date;
  periodEnd: Date;
  employees: CMUEmployeeData[];
}

interface CMURow {
  Matricule: string;
  'Nom et Prénoms': string;
  'Cotisation Salarié (FCFA)': number;
  'Cotisation Patronale (FCFA)': number;
  'Ayants droit': number;
  'Total (FCFA)': number;
}

// ========================================
// Constants
// ========================================

const CMU_RATES = {
  EMPLOYEE: 1000, // Fixed 1,000 FCFA per employee
  EMPLOYER_WITHOUT_FAMILY: 500, // 500 FCFA if no family
  EMPLOYER_WITH_FAMILY: 5000, // 5,000 FCFA if has family
};

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): number => {
  return Math.round(amount);
};

const formatPeriod = (periodStart: Date): string => {
  return format(periodStart, 'MMMM yyyy', { locale: fr }).toUpperCase();
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate CMU declaration CSV file
 *
 * Creates a CSV file with employee CMU contributions
 * ready for submission to the CMU portal.
 */
export const generateCMUCSV = (data: CMUExportData): string => {
  // Prepare rows
  const rows: CMURow[] = data.employees.map((emp) => {
    const total = emp.cmuEmployee + emp.cmuEmployer;

    return {
      Matricule: emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Cotisation Salarié (FCFA)': formatCurrency(emp.cmuEmployee),
      'Cotisation Patronale (FCFA)': formatCurrency(emp.cmuEmployer),
      'Ayants droit': emp.dependents || (emp.hasFamily ? 1 : 0),
      'Total (FCFA)': formatCurrency(total),
    };
  });

  // Calculate totals
  const totals: CMURow = {
    Matricule: '',
    'Nom et Prénoms': 'TOTAL',
    'Cotisation Salarié (FCFA)': rows.reduce(
      (sum, row) => sum + row['Cotisation Salarié (FCFA)'],
      0
    ),
    'Cotisation Patronale (FCFA)': rows.reduce(
      (sum, row) => sum + row['Cotisation Patronale (FCFA)'],
      0
    ),
    'Ayants droit': rows.reduce((sum, row) => sum + row['Ayants droit'], 0),
    'Total (FCFA)': rows.reduce((sum, row) => sum + row['Total (FCFA)'], 0),
  };

  // Add totals row
  rows.push(totals);

  // Convert to CSV
  const headers = Object.keys(rows[0]);
  const csvRows = [
    // Header row
    headers.join(','),
    // Data rows
    ...rows.map((row) =>
      headers.map((header) => {
        const value = row[header as keyof CMURow];
        // Wrap text fields in quotes if they contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
};

/**
 * Generate CMU declaration Excel file
 *
 * Creates an Excel file with employee CMU contributions
 * ready for submission to the CMU portal.
 */
export const generateCMUExcel = (data: CMUExportData): ArrayBuffer => {
  // Prepare rows
  const rows: CMURow[] = data.employees.map((emp) => {
    const total = emp.cmuEmployee + emp.cmuEmployer;

    return {
      Matricule: emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Cotisation Salarié (FCFA)': formatCurrency(emp.cmuEmployee),
      'Cotisation Patronale (FCFA)': formatCurrency(emp.cmuEmployer),
      'Ayants droit': emp.dependents || (emp.hasFamily ? 1 : 0),
      'Total (FCFA)': formatCurrency(total),
    };
  });

  // Calculate totals
  const totals: CMURow = {
    Matricule: '',
    'Nom et Prénoms': 'TOTAL',
    'Cotisation Salarié (FCFA)': rows.reduce(
      (sum, row) => sum + row['Cotisation Salarié (FCFA)'],
      0
    ),
    'Cotisation Patronale (FCFA)': rows.reduce(
      (sum, row) => sum + row['Cotisation Patronale (FCFA)'],
      0
    ),
    'Ayants droit': rows.reduce((sum, row) => sum + row['Ayants droit'], 0),
    'Total (FCFA)': rows.reduce((sum, row) => sum + row['Total (FCFA)'], 0),
  };

  // Add totals row
  rows.push(totals);

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Matricule
    { wch: 30 }, // Nom et Prénoms
    { wch: 22 }, // Cotisation Salarié
    { wch: 22 }, // Cotisation Patronale
    { wch: 15 }, // Ayants droit
    { wch: 15 }, // Total
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add header info sheet
  const headerData = [
    ['DÉCLARATION CMU'],
    ['(Couverture Maladie Universelle)'],
    [''],
    ['Employeur:', data.companyName],
    ['CC/DGI:', data.companyTaxId || 'N/A'],
    ['Période:', formatPeriod(data.periodStart)],
    ['Nombre de salariés:', data.employees.length],
    [''],
    ['Tarifs CMU:'],
    ['- Cotisation salarié: 1 000 FCFA (fixe)'],
    ['- Cotisation patronale sans famille: 500 FCFA'],
    ['- Cotisation patronale avec famille: 5 000 FCFA'],
    [''],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');

  // Add data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Déclaration CMU');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return excelBuffer;
};

/**
 * Generate CMU export file name
 */
export const generateCMUFilename = (periodStart: Date, format: 'csv' | 'xlsx' = 'csv'): string => {
  const month = XLSX.utils.format_cell({ t: 's', v: periodStart.getMonth() + 1 });
  const year = periodStart.getFullYear();
  const monthStr = month.toString().padStart(2, '0');
  return `Declaration_CMU_${monthStr}_${year}.${format}`;
};

/**
 * Validate CMU export data
 */
export const validateCMUExportData = (data: CMUExportData): string[] => {
  const errors: string[] = [];

  // Check if there are employees
  if (data.employees.length === 0) {
    errors.push('Aucun employé à exporter');
  }

  // Check if employees have valid employee numbers
  const employeesWithoutNumber = data.employees.filter((emp) => !emp.employeeNumber);
  if (employeesWithoutNumber.length > 0) {
    errors.push(`${employeesWithoutNumber.length} employé(s) sans matricule`);
  }

  // Check if CMU contributions are valid
  const invalidContributions = data.employees.filter(
    (emp) => emp.cmuEmployee <= 0 || emp.cmuEmployer <= 0
  );
  if (invalidContributions.length > 0) {
    errors.push(`${invalidContributions.length} employé(s) avec des cotisations CMU invalides`);
  }

  // Warn about non-standard employee contributions
  const nonStandardEmployee = data.employees.filter(
    (emp) => emp.cmuEmployee !== CMU_RATES.EMPLOYEE
  );
  if (nonStandardEmployee.length > 0) {
    errors.push(
      `${nonStandardEmployee.length} employé(s) avec une cotisation salarié différente de ${CMU_RATES.EMPLOYEE} FCFA`
    );
  }

  // Warn about non-standard employer contributions
  const nonStandardEmployer = data.employees.filter(
    (emp) =>
      emp.cmuEmployer !== CMU_RATES.EMPLOYER_WITHOUT_FAMILY &&
      emp.cmuEmployer !== CMU_RATES.EMPLOYER_WITH_FAMILY
  );
  if (nonStandardEmployer.length > 0) {
    errors.push(
      `${nonStandardEmployer.length} employé(s) avec une cotisation patronale non-standard`
    );
  }

  return errors;
};

/**
 * Get CMU export summary
 */
export const getCMUExportSummary = (data: CMUExportData) => {
  const totalEmployee = data.employees.reduce((sum, emp) => sum + emp.cmuEmployee, 0);
  const totalEmployer = data.employees.reduce((sum, emp) => sum + emp.cmuEmployer, 0);
  const totalContributions = totalEmployee + totalEmployer;

  const employeesWithFamily = data.employees.filter((emp) => emp.hasFamily).length;
  const employeesWithoutFamily = data.employees.length - employeesWithFamily;

  return {
    employeeCount: data.employees.length,
    employeesWithFamily,
    employeesWithoutFamily,
    totalEmployee: formatCurrency(totalEmployee),
    totalEmployer: formatCurrency(totalEmployer),
    totalContributions: formatCurrency(totalContributions),
  };
};
