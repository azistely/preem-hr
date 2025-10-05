/**
 * État 301 Export Service
 *
 * Generates Excel export file for État 301 (Tax Declaration)
 * for submission to DGI (Direction Générale des Impôts) in Côte d'Ivoire.
 *
 * État 301 is the monthly declaration of salaries and withholding tax (ITS).
 *
 * Required columns:
 * - N° (sequence number)
 * - Matricule (employee number)
 * - Nom et Prénoms (full name)
 * - Salaire Imposable (taxable income)
 * - Impôt Retenu à la Source (ITS/withholding tax)
 * - Monthly totals
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface Etat301EmployeeData {
  employeeName: string;
  employeeNumber: string;
  grossSalary: number;
  cnpsEmployee: number;
  cmuEmployee: number;
  taxableIncome: number;
  its: number;
}

export interface Etat301ExportData {
  companyName: string;
  companyTaxId?: string;
  periodStart: Date;
  periodEnd: Date;
  employees: Etat301EmployeeData[];
}

interface Etat301Row {
  'N°': number;
  Matricule: string;
  'Nom et Prénoms': string;
  'Salaire Brut (FCFA)': number;
  'Déductions Sociales (FCFA)': number;
  'Salaire Imposable (FCFA)': number;
  'ITS Retenu (FCFA)': number;
}

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): number => {
  return Math.round(amount);
};

const formatPeriod = (periodStart: Date): string => {
  return format(periodStart, 'MMMM yyyy', { locale: fr }).toUpperCase();
};

const calculateTaxableIncome = (
  grossSalary: number,
  cnpsEmployee: number,
  cmuEmployee: number
): number => {
  return grossSalary - cnpsEmployee - cmuEmployee;
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate État 301 Excel file
 *
 * Creates an Excel file with employee tax declarations
 * ready for submission to the DGI portal.
 */
export const generateEtat301Excel = (data: Etat301ExportData): ArrayBuffer => {
  // Prepare rows
  const rows: Etat301Row[] = data.employees.map((emp, index) => {
    const socialDeductions = emp.cnpsEmployee + emp.cmuEmployee;

    return {
      'N°': index + 1,
      Matricule: emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Salaire Brut (FCFA)': formatCurrency(emp.grossSalary),
      'Déductions Sociales (FCFA)': formatCurrency(socialDeductions),
      'Salaire Imposable (FCFA)': formatCurrency(emp.taxableIncome),
      'ITS Retenu (FCFA)': formatCurrency(emp.its),
    };
  });

  // Calculate totals
  const totals: Etat301Row = {
    'N°': 0,
    Matricule: '',
    'Nom et Prénoms': 'TOTAL',
    'Salaire Brut (FCFA)': rows.reduce((sum, row) => sum + row['Salaire Brut (FCFA)'], 0),
    'Déductions Sociales (FCFA)': rows.reduce(
      (sum, row) => sum + row['Déductions Sociales (FCFA)'],
      0
    ),
    'Salaire Imposable (FCFA)': rows.reduce((sum, row) => sum + row['Salaire Imposable (FCFA)'], 0),
    'ITS Retenu (FCFA)': rows.reduce((sum, row) => sum + row['ITS Retenu (FCFA)'], 0),
  };

  // Add totals row
  rows.push(totals);

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 }, // N°
    { wch: 15 }, // Matricule
    { wch: 30 }, // Nom et Prénoms
    { wch: 18 }, // Salaire Brut
    { wch: 22 }, // Déductions Sociales
    { wch: 22 }, // Salaire Imposable
    { wch: 18 }, // ITS Retenu
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add header info sheet
  const month = format(data.periodStart, 'MMMM', { locale: fr });
  const year = format(data.periodStart, 'yyyy', { locale: fr });

  const headerData = [
    ['ÉTAT 301 - DÉCLARATION MENSUELLE DES SALAIRES'],
    ['ET RETENUE À LA SOURCE (ITS)'],
    [''],
    ['Employeur:', data.companyName],
    ['N° CC/DGI:', data.companyTaxId || 'N/A'],
    ['Mois:', month],
    ['Année:', year],
    ['Période:', `${format(data.periodStart, 'dd/MM/yyyy')} - ${format(data.periodEnd, 'dd/MM/yyyy')}`],
    ['Nombre de salariés:', data.employees.length],
    [''],
    ['Récapitulatif:'],
    ['Total Salaires Bruts:', `${formatCurrency(totals['Salaire Brut (FCFA)'])} FCFA`],
    ['Total Déductions Sociales:', `${formatCurrency(totals['Déductions Sociales (FCFA)'])} FCFA`],
    ['Total Salaires Imposables:', `${formatCurrency(totals['Salaire Imposable (FCFA)'])} FCFA`],
    ['Total ITS Retenu:', `${formatCurrency(totals['ITS Retenu (FCFA)'])} FCFA`],
    [''],
    ['Note: Les déductions sociales comprennent les cotisations CNPS et CMU salariales.'],
    [''],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');

  // Add data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'État 301');

  // Add summary sheet for DGI submission
  const summaryData = [
    ['RÉCAPITULATIF ÉTAT 301'],
    [''],
    ['Employeur:', data.companyName],
    ['N° CC/DGI:', data.companyTaxId || ''],
    ['Mois:', month],
    ['Année:', year],
    [''],
    ['MONTANTS DÉCLARÉS:'],
    [''],
    ['Description', 'Montant (FCFA)'],
    ['Nombre de salariés', data.employees.length],
    ['Total Salaires Bruts', formatCurrency(totals['Salaire Brut (FCFA)'])],
    ['Total Déductions Sociales', formatCurrency(totals['Déductions Sociales (FCFA)'])],
    ['Total Salaires Imposables', formatCurrency(totals['Salaire Imposable (FCFA)'])],
    ['Total ITS à reverser', formatCurrency(totals['ITS Retenu (FCFA)'])],
    [''],
    ['Date de génération:', format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Récapitulatif');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return excelBuffer;
};

/**
 * Generate État 301 export file name
 */
export const generateEtat301Filename = (periodStart: Date): string => {
  const month = format(periodStart, 'MM', { locale: fr });
  const year = format(periodStart, 'yyyy', { locale: fr });
  return `Etat_301_${month}_${year}.xlsx`;
};

/**
 * Validate État 301 export data
 */
export const validateEtat301ExportData = (data: Etat301ExportData): string[] => {
  const errors: string[] = [];

  // Check if there are employees
  if (data.employees.length === 0) {
    errors.push('Aucun employé à exporter');
  }

  // Check if company has tax ID
  if (!data.companyTaxId) {
    errors.push("Le numéro CC/DGI de l'entreprise est manquant");
  }

  // Check if employees have valid employee numbers
  const employeesWithoutNumber = data.employees.filter((emp) => !emp.employeeNumber);
  if (employeesWithoutNumber.length > 0) {
    errors.push(`${employeesWithoutNumber.length} employé(s) sans matricule`);
  }

  // Check if employees have valid taxable income
  const employeesWithInvalidIncome = data.employees.filter((emp) => emp.taxableIncome < 0);
  if (employeesWithInvalidIncome.length > 0) {
    errors.push(`${employeesWithInvalidIncome.length} employé(s) avec un revenu imposable invalide`);
  }

  // Check if employees have valid ITS
  const employeesWithInvalidITS = data.employees.filter((emp) => emp.its < 0);
  if (employeesWithInvalidITS.length > 0) {
    errors.push(`${employeesWithInvalidITS.length} employé(s) avec un ITS invalide`);
  }

  // Warn about employees with 0 taxable income but ITS > 0
  const inconsistentTax = data.employees.filter(
    (emp) => emp.taxableIncome === 0 && emp.its > 0
  );
  if (inconsistentTax.length > 0) {
    errors.push(
      `${inconsistentTax.length} employé(s) avec un revenu imposable nul mais un ITS positif`
    );
  }

  return errors;
};

/**
 * Get État 301 export summary
 */
export const getEtat301ExportSummary = (data: Etat301ExportData) => {
  const totalGross = data.employees.reduce((sum, emp) => sum + emp.grossSalary, 0);
  const totalSocialDeductions = data.employees.reduce(
    (sum, emp) => sum + emp.cnpsEmployee + emp.cmuEmployee,
    0
  );
  const totalTaxable = data.employees.reduce((sum, emp) => sum + emp.taxableIncome, 0);
  const totalITS = data.employees.reduce((sum, emp) => sum + emp.its, 0);

  const employeesWithTax = data.employees.filter((emp) => emp.its > 0).length;
  const employeesWithoutTax = data.employees.length - employeesWithTax;

  return {
    employeeCount: data.employees.length,
    employeesWithTax,
    employeesWithoutTax,
    totalGross: formatCurrency(totalGross),
    totalSocialDeductions: formatCurrency(totalSocialDeductions),
    totalTaxable: formatCurrency(totalTaxable),
    totalITS: formatCurrency(totalITS),
    averageITSRate:
      totalTaxable > 0
        ? ((totalITS / totalTaxable) * 100).toFixed(2) + '%'
        : '0%',
  };
};

/**
 * Calculate ITS payment details for DGI
 */
export const calculateITSPaymentDetails = (data: Etat301ExportData) => {
  const totalITS = data.employees.reduce((sum, emp) => sum + emp.its, 0);
  const month = format(data.periodStart, 'MMMM yyyy', { locale: fr });

  // ITS payment is typically due by the 15th of the following month
  const paymentDueDate = new Date(data.periodEnd);
  paymentDueDate.setMonth(paymentDueDate.getMonth() + 1);
  paymentDueDate.setDate(15);

  return {
    amount: formatCurrency(totalITS),
    period: month,
    dueDate: format(paymentDueDate, 'dd/MM/yyyy', { locale: fr }),
    reference: `ITS_${format(data.periodStart, 'MM_yyyy')}`,
  };
};
