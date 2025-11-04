/**
 * Pay Register (Livre de Paie) Export Service
 *
 * Generates Excel pay register exports for Côte d'Ivoire payroll.
 * Supports separate registers by payment frequency per Phase 5 requirements.
 *
 * Register Types:
 * - "Livre de Paie - Mensuel - [Month] [Year]" (monthly workers, 1 per month)
 * - "Livre de Paie - Hebdomadaire Semaine 1 - [Month] [Year]" (weekly workers, week 1)
 * - "Livre de Paie - Hebdomadaire Semaine 2 - [Month] [Year]" (weekly workers, week 2)
 * - "Livre de Paie - Hebdomadaire Semaine 3 - [Month] [Year]" (weekly workers, week 3)
 * - "Livre de Paie - Hebdomadaire Semaine 4 - [Month] [Year]" (weekly workers, week 4)
 * - "Livre de Paie - Quinzaine 1 - [Month] [Year]" (biweekly workers, first half)
 * - "Livre de Paie - Quinzaine 2 - [Month] [Year]" (biweekly workers, second half)
 *
 * Reference: DAILY-WORKERS-ARCHITECTURE-V2.md Section 10.5
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface PayRegisterEmployeeData {
  employeeNumber: string;
  employeeName: string;
  position?: string;
  baseSalary: number;

  // Earnings
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  seniorityBonus?: number;
  familyAllowance?: number;
  overtimePay?: number;
  bonuses?: number;

  // CDDTI-specific components (daily workers)
  gratification?: number; // 6.25% - Prime annuelle de 75%
  congesPayes?: number; // 10.15% - Provision 2.2 jours/mois
  indemnitePrecarite?: number; // 3% of (base + grat + congés)

  grossSalary: number;

  // Deductions
  cnpsEmployee: number;
  cmuEmployee: number;
  its: number;
  otherDeductions?: number;
  totalDeductions: number;

  netSalary: number;

  // Employer contributions
  cnpsEmployer: number;
  cmuEmployer: number;
  fdfp?: number;
  workAccident?: number;
  employerPayrollTax?: number;
  totalEmployerCost: number;

  // Time tracking (for daily workers)
  daysWorked?: number;
  hoursWorked?: number;

  // Payment info
  paymentMethod?: string;
  bankAccount?: string;
}

export interface PayRegisterExportData {
  // Company info
  companyName: string;
  companyCNPS?: string;
  companyTaxId?: string;

  // Period info
  periodStart: Date;
  periodEnd: Date;
  paymentFrequency: PaymentFrequency;
  closureSequence?: number; // 1-4 for weekly, 1-2 for biweekly

  // Employees
  employees: PayRegisterEmployeeData[];
}

interface PayRegisterRow {
  'N°': number;
  'Matricule': string;
  'Nom et Prénoms': string;
  'Fonction': string;
  'Jours': string | number; // Days worked (daily workers)
  'Salaire de Base': number;
  'Avantages': number;
  'Heures Sup.': number;
  'Brut': number;
  'CNPS 6,3%': number;
  'CMU 1%': number;
  'ITS': number;
  'Total Retenues': number;
  'Net à Payer': number;
}

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): number => {
  return Math.round(amount);
};

/**
 * Format register title based on payment frequency and closure sequence
 */
export const formatPayRegisterTitle = (
  paymentFrequency: PaymentFrequency,
  closureSequence?: number,
  periodStart?: Date
): string => {
  const monthYear = periodStart
    ? format(periodStart, 'MMMM yyyy', { locale: fr })
    : '';

  switch (paymentFrequency) {
    case 'MONTHLY':
      return `Livre de Paie - Mensuel - ${monthYear}`;

    case 'WEEKLY':
      const week = closureSequence || 1;
      return `Livre de Paie - Hebdomadaire Semaine ${week} - ${monthYear}`;

    case 'BIWEEKLY':
      const quinzaine = closureSequence || 1;
      return `Livre de Paie - Quinzaine ${quinzaine} - ${monthYear}`;

    case 'DAILY':
      return `Livre de Paie - Journalier - ${monthYear}`;

    default:
      return `Livre de Paie - ${monthYear}`;
  }
};

/**
 * Format filename for pay register export
 */
export const generatePayRegisterFilename = (
  paymentFrequency: PaymentFrequency,
  closureSequence?: number,
  periodStart?: Date
): string => {
  const monthCode = periodStart ? format(periodStart, 'yyyy-MM') : '';

  switch (paymentFrequency) {
    case 'MONTHLY':
      return `livre_paie_mensuel_${monthCode}.xlsx`;

    case 'WEEKLY':
      const week = closureSequence || 1;
      return `livre_paie_hebdo_s${week}_${monthCode}.xlsx`;

    case 'BIWEEKLY':
      const quinzaine = closureSequence || 1;
      return `livre_paie_quinz${quinzaine}_${monthCode}.xlsx`;

    case 'DAILY':
      return `livre_paie_journalier_${monthCode}.xlsx`;

    default:
      return `livre_paie_${monthCode}.xlsx`;
  }
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate Pay Register Excel file
 *
 * Creates a comprehensive pay register with all employee earnings and deductions.
 */
export const generatePayRegisterExcel = (data: PayRegisterExportData): ArrayBuffer => {
  const title = formatPayRegisterTitle(
    data.paymentFrequency,
    data.closureSequence,
    data.periodStart
  );

  // Prepare employee rows
  const rows: PayRegisterRow[] = data.employees.map((emp, index) => {
    // Calculate total benefits (avantages)
    const benefits =
      (emp.housingAllowance || 0) +
      (emp.transportAllowance || 0) +
      (emp.mealAllowance || 0) +
      (emp.seniorityBonus || 0) +
      (emp.familyAllowance || 0) +
      (emp.gratification || 0) +
      (emp.congesPayes || 0) +
      (emp.indemnitePrecarite || 0);

    return {
      'N°': index + 1,
      'Matricule': emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Fonction': emp.position || '',
      'Jours': emp.daysWorked || '', // Show days for daily workers
      'Salaire de Base': formatCurrency(emp.baseSalary),
      'Avantages': formatCurrency(benefits),
      'Heures Sup.': formatCurrency(emp.overtimePay || 0),
      'Brut': formatCurrency(emp.grossSalary),
      'CNPS 6,3%': formatCurrency(emp.cnpsEmployee),
      'CMU 1%': formatCurrency(emp.cmuEmployee),
      'ITS': formatCurrency(emp.its),
      'Total Retenues': formatCurrency(emp.totalDeductions),
      'Net à Payer': formatCurrency(emp.netSalary),
    };
  });

  // Calculate totals
  const totals: PayRegisterRow = {
    'N°': 0,
    'Matricule': '',
    'Nom et Prénoms': 'TOTAL',
    'Fonction': '',
    'Jours': '',
    'Salaire de Base': rows.reduce((sum, row) => sum + row['Salaire de Base'], 0),
    'Avantages': rows.reduce((sum, row) => sum + row['Avantages'], 0),
    'Heures Sup.': rows.reduce((sum, row) => sum + row['Heures Sup.'], 0),
    'Brut': rows.reduce((sum, row) => sum + row['Brut'], 0),
    'CNPS 6,3%': rows.reduce((sum, row) => sum + row['CNPS 6,3%'], 0),
    'CMU 1%': rows.reduce((sum, row) => sum + row['CMU 1%'], 0),
    'ITS': rows.reduce((sum, row) => sum + row['ITS'], 0),
    'Total Retenues': rows.reduce((sum, row) => sum + row['Total Retenues'], 0),
    'Net à Payer': rows.reduce((sum, row) => sum + row['Net à Payer'], 0),
  };

  // Add totals row
  rows.push(totals);

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },  // N°
    { wch: 12 }, // Matricule
    { wch: 30 }, // Nom et Prénoms
    { wch: 20 }, // Fonction
    { wch: 8 },  // Jours
    { wch: 15 }, // Salaire de Base
    { wch: 15 }, // Avantages
    { wch: 12 }, // Heures Sup.
    { wch: 15 }, // Brut
    { wch: 12 }, // CNPS
    { wch: 10 }, // CMU
    { wch: 12 }, // ITS
    { wch: 15 }, // Total Retenues
    { wch: 15 }, // Net à Payer
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add header info sheet
  const month = format(data.periodStart, 'MMMM', { locale: fr });
  const year = format(data.periodStart, 'yyyy');

  const headerData = [
    [title.toUpperCase()],
    [''],
    ['Employeur:', data.companyName],
    ['N° CNPS:', data.companyCNPS || 'N/A'],
    ['N° CC/DGI:', data.companyTaxId || 'N/A'],
    ['Mois:', month],
    ['Année:', year],
    [
      'Période:',
      `${format(data.periodStart, 'dd/MM/yyyy')} - ${format(data.periodEnd, 'dd/MM/yyyy')}`,
    ],
    ['Fréquence de paiement:', getFrequencyLabel(data.paymentFrequency)],
    ...(data.closureSequence
      ? [['Clôture:', getClosureLabel(data.paymentFrequency, data.closureSequence)]]
      : []),
    ['Nombre de salariés:', data.employees.length],
    [''],
    ['Récapitulatif:'],
    ['Total Salaires de Base:', `${formatCurrency(totals['Salaire de Base'])} FCFA`],
    ['Total Avantages:', `${formatCurrency(totals['Avantages'])} FCFA`],
    ['Total Heures Supplémentaires:', `${formatCurrency(totals['Heures Sup.'])} FCFA`],
    ['Total Brut:', `${formatCurrency(totals['Brut'])} FCFA`],
    ['Total CNPS Salarié:', `${formatCurrency(totals['CNPS 6,3%'])} FCFA`],
    ['Total CMU Salarié:', `${formatCurrency(totals['CMU 1%'])} FCFA`],
    ['Total ITS:', `${formatCurrency(totals['ITS'])} FCFA`],
    ['Total Retenues:', `${formatCurrency(totals['Total Retenues'])} FCFA`],
    ['Total Net à Payer:', `${formatCurrency(totals['Net à Payer'])} FCFA`],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  headerSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];

  // Add sheets to workbook
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Livre de Paie');

  // Generate Excel file
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

// ========================================
// Helper Label Functions
// ========================================

function getFrequencyLabel(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'MONTHLY':
      return 'Mensuel';
    case 'WEEKLY':
      return 'Hebdomadaire';
    case 'BIWEEKLY':
      return 'Quinzaine';
    case 'DAILY':
      return 'Journalier';
    default:
      return frequency;
  }
}

function getClosureLabel(frequency: PaymentFrequency, sequence: number): string {
  if (frequency === 'WEEKLY') {
    return `Semaine ${sequence}`;
  } else if (frequency === 'BIWEEKLY') {
    return `Quinzaine ${sequence}`;
  }
  return `Clôture ${sequence}`;
}
