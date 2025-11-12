/**
 * CMU Beneficiary Export Service
 *
 * Generates Excel export file for CMU (Couverture Maladie Universelle)
 * beneficiary registration in Côte d'Ivoire.
 *
 * Format: One row per beneficiary (spouse or dependent child)
 * Employee data is repeated on each row for their beneficiaries.
 * Employees with no beneficiaries get one row with empty beneficiary columns.
 *
 * Required columns (per CNPS requirements):
 * 1. NUMERO CNPS ASSURE - Employee CNPS number
 * 2. NUMERO SECURITE SOCIALE ASSURE - Employee CMU number
 * 3. NOM ASSURE - Employee last name
 * 4. PRENOMS ASSURE - Employee first name
 * 5. DATE DE NAISSANCE ASSURE - Employee DOB (DD/MM/YYYY)
 * 6. NUMERO CNPS BENEFICIAIRE - Dependent CNPS number
 * 7. NUMERO SECURITE SOCIALE BENEFICIAIRE - Dependent CMU number
 * 8. TYPE BENEFICIAIRE - C (CONJOINT/spouse) or E (ENFANT/child)
 * 9. NOM BENEFICIAIRE - Dependent last name
 * 10. PRENOMS BENEFICIAIRE - Dependent first name
 * 11. DATE DE NAISSANCE BENEFICIAIRE - Dependent DOB (DD/MM/YYYY)
 * 12. GENRE BENEFICIAIRE - H (HOMME/male) or F (FEMME/female)
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// ========================================
// Types
// ========================================

/**
 * CMU Beneficiary Export Row
 *
 * Each row represents ONE beneficiary (spouse or child).
 * Employee data is repeated for each of their beneficiaries.
 * If employee has no beneficiaries, they get one row with empty beneficiary columns.
 */
export interface CMUBeneficiaryRow {
  // Employee Information (Assuré)
  employeeCnpsNumber: string; // NUMERO CNPS ASSURE
  employeeSocialSecurityNumber: string; // NUMERO SECURITE SOCIALE ASSURE
  employeeLastName: string; // NOM ASSURE
  employeeFirstName: string; // PRENOMS ASSURE
  employeeDateOfBirth: string; // DATE DE NAISSANCE ASSURE (DD/MM/YYYY)

  // Beneficiary Information (Bénéficiaire)
  beneficiaryCnpsNumber: string; // NUMERO CNPS BENEFICIAIRE
  beneficiarySocialSecurityNumber: string; // NUMERO SECURITE SOCIALE BENEFICIAIRE
  beneficiaryType: string; // TYPE: C (CONJOINT) or E (ENFANT)
  beneficiaryLastName: string; // NOM BENEFICIAIRE
  beneficiaryFirstName: string; // PRENOMS BENEFICIAIRE
  beneficiaryDateOfBirth: string; // DATE DE NAISSANCE BENEFICIAIRE (DD/MM/YYYY)
  beneficiaryGender: string; // GENRE: H (HOMME) or F (FEMME)
}

export interface CMUBeneficiaryExportData {
  beneficiaryRows: CMUBeneficiaryRow[];
  periodStart: Date;
  periodEnd: Date;
  companyName: string;
  totalEmployees: number;
  totalBeneficiaries: number;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Format date as DD/MM/YYYY for CNPS export
 */
export function formatCNPSDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Map relationship type to CNPS beneficiary type code
 */
export function mapRelationshipToType(relationship: string): string {
  switch (relationship.toLowerCase()) {
    case 'spouse':
    case 'conjoint':
      return 'C'; // CONJOINT/TRAVAILLEUR
    case 'child':
    case 'enfant':
      return 'E'; // ENFANT
    default:
      return 'E'; // Default to child
  }
}

/**
 * Map gender to CNPS gender code
 */
export function mapGenderCode(gender: string | null | undefined): string {
  if (!gender) return '';

  switch (gender.toLowerCase()) {
    case 'male':
    case 'homme':
    case 'm':
      return 'H'; // HOMME
    case 'female':
    case 'femme':
    case 'f':
      return 'F'; // FEMME
    default:
      return '';
  }
}

/**
 * Format period for filename
 */
function formatPeriod(periodStart: Date): string {
  return format(periodStart, 'yyyy-MM');
}

// ========================================
// Export Functions
// ========================================

/**
 * Generate CMU Beneficiary Export
 *
 * Creates Excel file with one row per beneficiary (spouse/child).
 * Employees with no beneficiaries get one row with empty beneficiary columns.
 */
export async function generateCMUBeneficiaryExport(
  data: CMUBeneficiaryExportData
): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('CMU Bénéficiaires');

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // NUMERO CNPS ASSURE
    { width: 20 }, // NUMERO SECURITE SOCIALE ASSURE
    { width: 20 }, // NOM ASSURE
    { width: 20 }, // PRENOMS ASSURE
    { width: 15 }, // DATE DE NAISSANCE ASSURE
    { width: 15 }, // NUMERO CNPS BENEFICIAIRE
    { width: 20 }, // NUMERO SECURITE SOCIALE BENEFICIAIRE
    { width: 12 }, // TYPE BENEFICIAIRE
    { width: 20 }, // NOM BENEFICIAIRE
    { width: 20 }, // PRENOMS BENEFICIAIRE
    { width: 15 }, // DATE DE NAISSANCE BENEFICIAIRE
    { width: 12 }, // GENRE BENEFICIAIRE
  ];

  // Add header row (yellow background, bold, borders)
  const headerRow = worksheet.addRow([
    'NUMERO CNPS ASSURE',
    'NUMERO SECURITE SOCIALE ASSURE',
    'NOM ASSURE',
    'PRENOMS ASSURE',
    'DATE DE NAISSANCE ASSURE',
    'NUMERO CNPS BENEFICIAIRE',
    'NUMERO SECURITE SOCIALE BENEFICIAIRE',
    'TYPE BENEFICIAIRE C: CONJOINT/TRAVAILLEUR E: ENFANT',
    'NOM BENEFICIAIRE',
    'PRENOMS BENEFICIAIRE',
    'DATE DE NAISSANCE BENEFICIAIRE',
    'GENRE BENEFICIAIRE H: HOMME F: FEMME',
  ]);

  // Style header
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' }, // Yellow background
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Add data rows
  data.beneficiaryRows.forEach((row) => {
    const dataRow = worksheet.addRow([
      row.employeeCnpsNumber,
      row.employeeSocialSecurityNumber,
      row.employeeLastName,
      row.employeeFirstName,
      row.employeeDateOfBirth,
      row.beneficiaryCnpsNumber,
      row.beneficiarySocialSecurityNumber,
      row.beneficiaryType,
      row.beneficiaryLastName,
      row.beneficiaryFirstName,
      row.beneficiaryDateOfBirth,
      row.beneficiaryGender,
    ]);

    // Add borders to data cells
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Enable auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Generate filename
  const periodStr = formatPeriod(data.periodStart);
  const filename = `CMU_Beneficiaires_${periodStr}.xlsx`;

  return {
    data: Buffer.from(buffer),
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

// ========================================
// Validation Functions
// ========================================

/**
 * Validate CMU export data
 *
 * Returns array of warning messages (non-blocking)
 */
export function validateCMUBeneficiaryExportData(
  data: CMUBeneficiaryExportData
): string[] {
  const warnings: string[] = [];

  data.beneficiaryRows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because Excel is 1-indexed and row 1 is header

    // Warning if employee missing CNPS number
    if (!row.employeeCnpsNumber) {
      warnings.push(
        `Ligne ${rowNum}: Employé "${row.employeeFirstName} ${row.employeeLastName}" sans numéro CNPS`
      );
    }

    // Warning if employee missing DOB
    if (!row.employeeDateOfBirth) {
      warnings.push(
        `Ligne ${rowNum}: Employé "${row.employeeFirstName} ${row.employeeLastName}" sans date de naissance`
      );
    }

    // Warning if beneficiary has data but missing DOB
    if (row.beneficiaryFirstName && !row.beneficiaryDateOfBirth) {
      warnings.push(
        `Ligne ${rowNum}: Bénéficiaire "${row.beneficiaryFirstName} ${row.beneficiaryLastName}" sans date de naissance`
      );
    }

    // Warning if beneficiary has invalid type
    if (row.beneficiaryType && !['C', 'E', ''].includes(row.beneficiaryType)) {
      warnings.push(
        `Ligne ${rowNum}: Type bénéficiaire invalide "${row.beneficiaryType}"`
      );
    }

    // Warning if beneficiary has invalid gender
    if (row.beneficiaryGender && !['H', 'F', ''].includes(row.beneficiaryGender)) {
      warnings.push(
        `Ligne ${rowNum}: Genre bénéficiaire invalide "${row.beneficiaryGender}"`
      );
    }
  });

  return warnings;
}

/**
 * Get CMU export summary
 */
export function getCMUBeneficiaryExportSummary(data: CMUBeneficiaryExportData) {
  const rowsWithBeneficiaries = data.beneficiaryRows.filter(
    (row) => row.beneficiaryFirstName !== ''
  );

  const beneficiariesByType = {
    spouse: rowsWithBeneficiaries.filter((row) => row.beneficiaryType === 'C').length,
    children: rowsWithBeneficiaries.filter((row) => row.beneficiaryType === 'E').length,
  };

  return {
    totalRows: data.beneficiaryRows.length,
    totalEmployees: data.totalEmployees,
    totalBeneficiaries: data.totalBeneficiaries,
    beneficiariesByType,
    employeesWithoutBeneficiaries:
      data.totalEmployees - new Set(rowsWithBeneficiaries.map((r) => r.employeeCnpsNumber)).size,
  };
}
