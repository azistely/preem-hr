/**
 * CNPS Declaration Export Service
 *
 * Generates Excel/CSV export file for CNPS (Caisse Nationale de Prévoyance Sociale)
 * portal submission in Côte d'Ivoire.
 *
 * IMPORTANT: Multi-Closure Aggregation (Phase 5)
 * ==============================================
 * With daily workers (journaliers), a company may have multiple payroll closures per month:
 * - Monthly workers: 1 closure/month
 * - Weekly workers: 4 closures/month (Semaine 1-4)
 * - Biweekly workers: 2 closures/month (Quinzaine 1-2)
 *
 * CNPS Aggregation Strategy (Option A - Recommended):
 * ---------------------------------------------------
 * The CNPS declaration is filed ONCE per month, aggregating all closures:
 * - Sum all gross salaries for each employee across all closures in the month
 * - Calculate CNPS contributions on the TOTAL monthly gross (not per closure)
 * - Monthly workers contribute once, weekly workers 4× per month
 * - Example: If a weekly worker earns 50,000 FCFA/week:
 *   - Week 1-4: 50,000 each = 200,000 total
 *   - CNPS employee (6.3%): 200,000 × 6.3% = 12,600 FCFA (not 4× 3,150)
 *
 * Implementation Note:
 * - This export should accept a month parameter (YYYY-MM)
 * - Query all approved payroll_runs for that month (all payment_frequency, all closure_sequence)
 * - Group by employee_id, sum grossSalary across all closures
 * - Generate single CNPS declaration with aggregated totals
 *
 * Reference: DAILY-WORKERS-ARCHITECTURE-V2.md Section 10.5, Task 3
 *
 * Required columns:
 * - N° (sequence number)
 * - Matricule CNPS (employee CNPS number)
 * - Nom et Prénoms (full name)
 * - Salaire Brut (gross salary) - AGGREGATED across all closures
 * - Cotisation Retraite Salarié (6.3%)
 * - Cotisation Retraite Patronale (7.7%)
 * - Prestations Familiales (5%)
 * - Accidents du Travail (2-5%)
 * - Total Cotisations
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface CNPSEmployeeData {
  employeeName: string;
  employeeCNPS: string | null;
  grossSalary: number;
  cnpsEmployee: number;
  cnpsEmployer: number;
}

export interface CNPSExportData {
  companyName: string;
  companyCNPS?: string;
  periodStart: Date;
  periodEnd: Date;
  employees: CNPSEmployeeData[];
}

interface CNPSRow {
  'N°': number;
  'Matricule CNPS': string;
  'Nom et Prénoms': string;
  'Salaire Brut (FCFA)': number;
  'Cotisation Retraite Salarié (6,3%)': number;
  'Cotisation Retraite Patronale (7,7%)': number;
  'Prestations Familiales (5%)': number;
  'Accidents du Travail (2-5%)': number;
  'Total Cotisations': number;
}

// ========================================
// Constants
// ========================================

// CNPS contribution rates
const CNPS_RATES = {
  PENSION_EMPLOYEE: 0.063, // 6.3%
  PENSION_EMPLOYER: 0.077, // 7.7%
  FAMILY_BENEFITS: 0.05, // 5%
  WORK_ACCIDENT_MIN: 0.02, // 2%
  WORK_ACCIDENT_MAX: 0.05, // 5%
};

// Salary cap for CNPS (1,647,315 FCFA as of 2024)
const CNPS_SALARY_CAP = 1647315;

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): number => {
  return Math.round(amount);
};

const calculateCappedSalary = (grossSalary: number): number => {
  return Math.min(grossSalary, CNPS_SALARY_CAP);
};

const calculatePensionEmployee = (grossSalary: number): number => {
  const capped = calculateCappedSalary(grossSalary);
  return formatCurrency(capped * CNPS_RATES.PENSION_EMPLOYEE);
};

const calculatePensionEmployer = (grossSalary: number): number => {
  const capped = calculateCappedSalary(grossSalary);
  return formatCurrency(capped * CNPS_RATES.PENSION_EMPLOYER);
};

const calculateFamilyBenefits = (grossSalary: number): number => {
  const capped = calculateCappedSalary(grossSalary);
  return formatCurrency(capped * CNPS_RATES.FAMILY_BENEFITS);
};

const calculateWorkAccident = (grossSalary: number, rate: number = 0.02): number => {
  const capped = calculateCappedSalary(grossSalary);
  return formatCurrency(capped * rate);
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate CNPS declaration Excel file
 *
 * Creates an Excel file with employee CNPS contributions
 * ready for submission to the CNPS portal.
 */
export const generateCNPSExcel = (data: CNPSExportData): ArrayBuffer => {
  // Prepare rows
  const rows: CNPSRow[] = data.employees
    .filter((emp) => emp.employeeCNPS) // Only include employees with CNPS number
    .map((emp, index) => {
      const cappedSalary = calculateCappedSalary(emp.grossSalary);
      const pensionEmployee = calculatePensionEmployee(emp.grossSalary);
      const pensionEmployer = calculatePensionEmployer(emp.grossSalary);
      const familyBenefits = calculateFamilyBenefits(emp.grossSalary);
      const workAccident = calculateWorkAccident(emp.grossSalary);

      const total = pensionEmployee + pensionEmployer + familyBenefits + workAccident;

      return {
        'N°': index + 1,
        'Matricule CNPS': emp.employeeCNPS || '',
        'Nom et Prénoms': emp.employeeName,
        'Salaire Brut (FCFA)': formatCurrency(emp.grossSalary),
        'Cotisation Retraite Salarié (6,3%)': pensionEmployee,
        'Cotisation Retraite Patronale (7,7%)': pensionEmployer,
        'Prestations Familiales (5%)': familyBenefits,
        'Accidents du Travail (2-5%)': workAccident,
        'Total Cotisations': total,
      };
    });

  // Calculate totals
  const totals: CNPSRow = {
    'N°': 0,
    'Matricule CNPS': '',
    'Nom et Prénoms': 'TOTAL',
    'Salaire Brut (FCFA)': rows.reduce((sum, row) => sum + row['Salaire Brut (FCFA)'], 0),
    'Cotisation Retraite Salarié (6,3%)': rows.reduce(
      (sum, row) => sum + row['Cotisation Retraite Salarié (6,3%)'],
      0
    ),
    'Cotisation Retraite Patronale (7,7%)': rows.reduce(
      (sum, row) => sum + row['Cotisation Retraite Patronale (7,7%)'],
      0
    ),
    'Prestations Familiales (5%)': rows.reduce(
      (sum, row) => sum + row['Prestations Familiales (5%)'],
      0
    ),
    'Accidents du Travail (2-5%)': rows.reduce(
      (sum, row) => sum + row['Accidents du Travail (2-5%)'],
      0
    ),
    'Total Cotisations': rows.reduce((sum, row) => sum + row['Total Cotisations'], 0),
  };

  // Add totals row
  rows.push(totals);

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 }, // N°
    { wch: 15 }, // Matricule CNPS
    { wch: 30 }, // Nom et Prénoms
    { wch: 18 }, // Salaire Brut
    { wch: 22 }, // Cotisation Retraite Salarié
    { wch: 22 }, // Cotisation Retraite Patronale
    { wch: 22 }, // Prestations Familiales
    { wch: 22 }, // Accidents du Travail
    { wch: 18 }, // Total Cotisations
  ];

  // Style the totals row (bold)
  const totalRowIndex = rows.length + 1; // +1 for header
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: totalRowIndex - 1, c: col });
    if (!worksheet[cellAddress]) continue;
    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'F0F0F0' } },
    };
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add header info sheet
  const headerData = [
    ['DÉCLARATION CNPS'],
    [''],
    ['Employeur:', data.companyName],
    ['N° CNPS Employeur:', data.companyCNPS || 'N/A'],
    ['Période:', formatPeriod(data.periodStart)],
    ['Nombre de salariés:', data.employees.filter((e) => e.employeeCNPS).length],
    [''],
    ['Plafond CNPS:', `${formatCurrency(CNPS_SALARY_CAP)} FCFA`],
    [''],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');

  // Add data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Déclaration CNPS');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return excelBuffer;
};

/**
 * Generate CNPS export file name
 */
export const generateCNPSFilename = (periodStart: Date): string => {
  const month = format(periodStart, 'MM', { locale: fr });
  const year = format(periodStart, 'yyyy', { locale: fr });
  return `Declaration_CNPS_${month}_${year}.xlsx`;
};

/**
 * Format period for display
 */
const formatPeriod = (periodStart: Date): string => {
  return format(periodStart, 'MMMM yyyy', { locale: fr }).toUpperCase();
};

/**
 * Validate CNPS export data
 */
export const validateCNPSExportData = (data: CNPSExportData): string[] => {
  const errors: string[] = [];

  // Check if there are employees
  if (data.employees.length === 0) {
    errors.push('Aucun employé à exporter');
  }

  // Check if employees have CNPS numbers
  const employeesWithoutCNPS = data.employees.filter((emp) => !emp.employeeCNPS);
  if (employeesWithoutCNPS.length > 0) {
    errors.push(
      `${employeesWithoutCNPS.length} employé(s) sans numéro CNPS (seront exclus de l'export)`
    );
  }

  // Check if all employees have valid gross salary
  const employeesWithInvalidSalary = data.employees.filter((emp) => emp.grossSalary <= 0);
  if (employeesWithInvalidSalary.length > 0) {
    errors.push(`${employeesWithInvalidSalary.length} employé(s) avec un salaire brut invalide`);
  }

  return errors;
};

/**
 * Get CNPS export summary
 */
export const getCNPSExportSummary = (data: CNPSExportData) => {
  const validEmployees = data.employees.filter((emp) => emp.employeeCNPS);

  const totalGross = validEmployees.reduce((sum, emp) => sum + emp.grossSalary, 0);
  const totalEmployee = validEmployees.reduce((sum, emp) => sum + emp.cnpsEmployee, 0);
  const totalEmployer = validEmployees.reduce((sum, emp) => sum + emp.cnpsEmployer, 0);
  const totalContributions = totalEmployee + totalEmployer;

  return {
    employeeCount: validEmployees.length,
    totalGross: formatCurrency(totalGross),
    totalEmployee: formatCurrency(totalEmployee),
    totalEmployer: formatCurrency(totalEmployer),
    totalContributions: formatCurrency(totalContributions),
  };
};
