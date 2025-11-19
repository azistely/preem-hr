/**
 * CNPS Declaration Export Service
 *
 * Generates Excel export file for CNPS (Caisse Nationale de Prévoyance Sociale)
 * portal submission in Côte d'Ivoire.
 *
 * FORMAT: Employee Declaration (not contribution calculation)
 * COLUMNS: 10 columns as per official CNPS template
 *
 * CRITICAL BUSINESS RULE - CDDTI 21-Day Threshold:
 * ===================================================
 * "Un CDDTI est un journalier sauf s'il n'a pas 21 jours travaillés dans le mois
 *  il est de type Horaire dans CNPS"
 *
 * Translation: A CDDTI is classified as daily worker (Journalier) UNLESS they
 * worked less than 21 days in the month, in which case they are classified as
 * hourly (Horaire) for CNPS purposes.
 *
 * Implementation:
 * - CDDTI with >= 21 days → TYPE='J', DUREE=days_worked, BRANCHE="123"
 * - CDDTI with < 21 days  → TYPE='H', DUREE=hours_worked, BRANCHE="123"
 *
 * See: docs/CNPS-EXPORT-SPECIFICATION.md for complete specification
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

/**
 * Employee data for CNPS export
 * Contains all fields needed for the 10-column CNPS declaration
 */
export interface CNPSEmployeeData {
  // Employee identification
  cnpsNumber: string;
  firstName: string;
  lastName: string;

  // Personal information
  dateOfBirth: Date | string | null;

  // Employment dates
  hireDate: Date | string;
  terminationDate: Date | string | null;

  // Employment classification
  salaryRegime: string | null; // MONTHLY, DAILY, HOURLY
  contractType: string | null; // CDI, CDD, CDDTI, STAGE, INTERIM

  // Payroll data (from payroll_line_items)
  daysWorked: number | null;
  hoursWorked: number | null;
  grossSalary: number;
}

/**
 * Complete export data structure
 */
export interface CNPSExportData {
  companyName: string;
  companyCNPS?: string;
  periodStart: Date;
  periodEnd: Date;
  employees: CNPSEmployeeData[];
}

/**
 * CNPS declaration row structure (10 columns)
 */
interface CNPSRow {
  'NUMERO CNPS': string;
  'NOM': string;
  'PRENOMS': string;
  'ANNEE DE NAISSANCE': number | string;
  "DATE D'EMBAUCHE": string;
  'DATE DE DEPART': string;
  'TYPE SALARIE': 'M' | 'J' | 'H';
  'DUREE TRAVAILLE': number;
  'SALAIRE BRUT': number;
  'BRANCHE COTISEE': string;
}

// ========================================
// Constants
// ========================================

/**
 * CNPS contribution branches
 * 1 = Retraite (Pension)
 * 2 = Accidents du Travail et Maladies Professionnelles
 * 3 = Prestations Familiales et Maternité
 * 4 = CMU (Couverture Maladie Universelle)
 */
const CONTRIBUTION_BRANCHES = {
  FULL_COVERAGE: '1234', // All branches (CDI, CDD, INTERIM)
  NO_CMU: '123', // No CMU (CDDTI, STAGE)
};

/**
 * CDDTI 21-day threshold for Journalier vs Horaire classification
 */
const CDDTI_JOURNALIER_THRESHOLD = 21;

// ========================================
// Helper Functions
// ========================================

/**
 * Extract birth year from date
 */
function getBirthYear(dateOfBirth: Date | string | null): number | string {
  if (!dateOfBirth) return '';
  const dateObj = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  return dateObj.getFullYear();
}

/**
 * Format date as DD/MM/YYYY (French standard)
 */
function formatDDMMYYYY(date: Date | string | null): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy', { locale: fr });
}

/**
 * Determine salary type code for CNPS
 *
 * CRITICAL: Implements CDDTI 21-day threshold rule
 *
 * @param salaryRegime - Employee salary regime (MONTHLY, DAILY, HOURLY)
 * @param contractType - Employee contract type (CDI, CDD, CDDTI, etc.)
 * @param daysWorked - Days worked in the period (for CDDTI threshold check)
 * @returns 'M' (Mensuel), 'J' (Journalier), or 'H' (Horaire)
 */
function getSalaryTypeCode(
  salaryRegime: string | null,
  contractType: string | null,
  daysWorked: number | null
): 'M' | 'J' | 'H' {
  // CRITICAL BUSINESS RULE: CDDTI 21-day threshold
  if (contractType?.toUpperCase() === 'CDDTI') {
    const days = daysWorked ?? 0;
    // >= 21 days → Journalier (daily worker)
    // < 21 days → Horaire (hourly worker)
    return days >= CDDTI_JOURNALIER_THRESHOLD ? 'J' : 'H';
  }

  // Standard mapping for all other contract types
  switch (salaryRegime?.toUpperCase()) {
    case 'DAILY':
      return 'J';
    case 'HOURLY':
      return 'H';
    case 'MONTHLY':
    default:
      return 'M';
  }
}

/**
 * Calculate duration worked based on salary type
 *
 * @param salaryTypeCode - Final TYPE SALARIE code ('M', 'J', or 'H')
 * @param daysWorked - Days worked in the period
 * @param hoursWorked - Hours worked in the period
 * @returns Duration value for DUREE TRAVAILLE column
 */
function getDurationWorked(
  salaryTypeCode: 'M' | 'J' | 'H',
  daysWorked: number | null,
  hoursWorked: number | null
): number {
  switch (salaryTypeCode) {
    case 'M':
      return 1; // Monthly workers always 1
    case 'J':
      return daysWorked ?? 0; // Daily workers use days worked
    case 'H':
      return hoursWorked ?? 0; // Hourly workers use hours worked
  }
}

/**
 * Determine contribution branches based on contract type
 *
 * @param contractType - Employee contract type
 * @returns Branch string (e.g., "1234" or "123")
 */
function getContributionBranches(contractType: string | null): string {
  const type = contractType?.toUpperCase() || '';

  // Full coverage (including CMU - branch 4)
  if (['CDI', 'CDD', 'INTERIM'].includes(type)) {
    return CONTRIBUTION_BRANCHES.FULL_COVERAGE;
  }

  // No CMU coverage
  if (['CDDTI', 'STAGE'].includes(type)) {
    return CONTRIBUTION_BRANCHES.NO_CMU;
  }

  // Default: no CMU
  return CONTRIBUTION_BRANCHES.NO_CMU;
}

/**
 * Format currency (round to whole number, no decimals)
 */
function formatCurrency(amount: number): number {
  return Math.round(amount);
}

/**
 * Format period for display (e.g., "MARS 2024")
 */
function formatPeriod(periodStart: Date): string {
  return format(periodStart, 'MMMM yyyy', { locale: fr }).toUpperCase();
}

// ========================================
// Export Functions
// ========================================

/**
 * Generate CNPS declaration Excel file
 *
 * Creates an Excel file with employee CNPS declaration data
 * ready for submission to the CNPS portal.
 *
 * Format: 2 worksheets
 * 1. "Informations" - Company metadata
 * 2. "Déclaration CNPS" - Employee declaration (10 columns)
 *
 * @param data - Export data containing company info and employee list
 * @returns Excel file as ArrayBuffer
 */
export const generateCNPSExcel = (data: CNPSExportData): ArrayBuffer => {
  // Filter to only include employees with CNPS numbers
  const validEmployees = data.employees.filter((emp) => emp.cnpsNumber);

  console.log('[CNPS Export Service] Input employees:', data.employees.length);
  console.log('[CNPS Export Service] Employees with CNPS#:', validEmployees.length);
  console.log('[CNPS Export Service] Employees without CNPS (excluded):', data.employees.length - validEmployees.length);

  // Transform employee data to CNPS rows (only valid employees)
  const rows: CNPSRow[] = validEmployees.map((emp) => {
    // Step 1: Determine TYPE SALARIE (applies CDDTI 21-day rule)
    const salaryTypeCode = getSalaryTypeCode(
      emp.salaryRegime,
      emp.contractType,
      emp.daysWorked
    );

    // Step 2: Calculate DUREE TRAVAILLE based on TYPE SALARIE
    const durationWorked = getDurationWorked(
      salaryTypeCode,
      emp.daysWorked,
      emp.hoursWorked
    );

    // Step 3: Determine BRANCHE COTISEE
    const branches = getContributionBranches(emp.contractType);

    return {
      'NUMERO CNPS': emp.cnpsNumber,
      'NOM': emp.lastName.toUpperCase(),
      'PRENOMS': emp.firstName,
      'ANNEE DE NAISSANCE': getBirthYear(emp.dateOfBirth),
      "DATE D'EMBAUCHE": formatDDMMYYYY(emp.hireDate),
      'DATE DE DEPART': formatDDMMYYYY(emp.terminationDate),
      'TYPE SALARIE': salaryTypeCode,
      'DUREE TRAVAILLE': durationWorked,
      'SALAIRE BRUT': formatCurrency(emp.grossSalary),
      'BRANCHE COTISEE': branches,
    };
  });

  // Create worksheet with just headers and data (no subheaders)
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 15 }, // NUMERO CNPS
    { wch: 25 }, // NOM
    { wch: 25 }, // PRENOMS
    { wch: 10 }, // ANNEE DE NAISSANCE
    { wch: 15 }, // DATE D'EMBAUCHE
    { wch: 15 }, // DATE DE DEPART
    { wch: 15 }, // TYPE SALARIE
    { wch: 12 }, // DUREE TRAVAILLE
    { wch: 18 }, // SALAIRE BRUT
    { wch: 12 }, // BRANCHE COTISEE
  ];

  // Create workbook with single worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Déclaration CNPS');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return excelBuffer;
};

/**
 * Generate CNPS export file name
 *
 * Format: Appel_Cotisation_CNPS_MM_YYYY.xlsx
 *
 * @param periodStart - Period start date
 * @returns Filename string
 */
export const generateCNPSFilename = (periodStart: Date): string => {
  const month = format(periodStart, 'MM', { locale: fr });
  const year = format(periodStart, 'yyyy', { locale: fr });
  return `Appel_Cotisation_CNPS_${month}_${year}.xlsx`;
};

/**
 * Validate CNPS export data
 *
 * Checks for common issues before generating export
 *
 * @param data - Export data to validate
 * @returns Object with errors and warnings arrays
 */
export const validateCNPSExportData = (data: CNPSExportData): {
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if there are employees
  if (data.employees.length === 0) {
    errors.push('Aucun employé à exporter');
    return { errors, warnings };
  }

  // Check if employees have CNPS numbers
  const employeesWithCNPS = data.employees.filter((emp) => emp.cnpsNumber);
  if (employeesWithCNPS.length === 0) {
    errors.push(
      "Aucun employé avec numéro CNPS - impossible de générer l'export. " +
        "Veuillez d'abord enregistrer vos employés à la CNPS."
    );
  }

  // Warn about missing CNPS numbers
  const employeesWithoutCNPS = data.employees.filter((emp) => !emp.cnpsNumber);
  if (employeesWithoutCNPS.length > 0 && employeesWithCNPS.length > 0) {
    warnings.push(
      `${employeesWithoutCNPS.length} employé(s) sans numéro CNPS seront exclus de l'export`
    );
  }

  // Check for missing birth dates
  const employeesWithoutBirthDate = data.employees.filter((emp) => !emp.dateOfBirth);
  if (employeesWithoutBirthDate.length > 0) {
    warnings.push(
      `${employeesWithoutBirthDate.length} employé(s) sans date de naissance (année vide dans l'export)`
    );
  }

  // Check for invalid gross salary
  const employeesWithInvalidSalary = data.employees.filter((emp) => emp.grossSalary <= 0);
  if (employeesWithInvalidSalary.length > 0) {
    warnings.push(
      `${employeesWithInvalidSalary.length} employé(s) avec un salaire brut invalide`
    );
  }

  return { errors, warnings };
};

/**
 * Get CNPS export summary statistics
 *
 * Provides overview of export data for display to user
 *
 * @param data - Export data
 * @returns Summary object with counts and totals
 */
export const getCNPSExportSummary = (data: CNPSExportData) => {
  const validEmployees = data.employees.filter((emp) => emp.cnpsNumber);

  const totalGross = validEmployees.reduce((sum, emp) => sum + emp.grossSalary, 0);

  // Count by contract type (only valid employees)
  const byContractType = validEmployees.reduce(
    (acc, emp) => {
      const type = emp.contractType?.toUpperCase() || 'OTHER';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Count CDDTI by classification (for verification)
  const cddtiEmployees = validEmployees.filter(
    (emp) => emp.contractType?.toUpperCase() === 'CDDTI'
  );
  const cddtiJournalier = cddtiEmployees.filter(
    (emp) => (emp.daysWorked ?? 0) >= CDDTI_JOURNALIER_THRESHOLD
  ).length;
  const cddtiHoraire = cddtiEmployees.filter(
    (emp) => (emp.daysWorked ?? 0) < CDDTI_JOURNALIER_THRESHOLD
  ).length;

  return {
    employeeCount: validEmployees.length,
    totalGross: formatCurrency(totalGross),
    byContractType,
    cddtiStats: {
      total: cddtiEmployees.length,
      journalier: cddtiJournalier, // >= 21 days
      horaire: cddtiHoraire, // < 21 days
    },
  };
};
