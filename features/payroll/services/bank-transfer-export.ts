/**
 * Bank Transfer Export Service
 *
 * Generates bank transfer files for payroll in Côte d'Ivoire.
 *
 * Supports common formats:
 * - CSV (generic format for most banks)
 * - SEPA XML (for international banks)
 * - Custom formats for local banks (SGBCI, BOA, etc.)
 *
 * Required fields:
 * - Employee bank details (IBAN or account number)
 * - Net salary amount
 * - Payment reference
 * - Total batch amount
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface BankTransferEmployeeData {
  employeeName: string;
  employeeNumber: string;
  bankName?: string;
  bankAccount: string | null;
  netSalary: number;
  paymentReference?: string;
}

export interface BankTransferExportData {
  companyName: string;
  companyBankAccount?: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  employees: BankTransferEmployeeData[];
  batchReference?: string;
}

interface BankTransferRow {
  'N°': number;
  Matricule: string;
  'Nom et Prénoms': string;
  'Banque': string;
  'Compte Bancaire': string;
  'Montant (FCFA)': number;
  'Référence': string;
}

export type BankTransferFormat = 'csv' | 'excel' | 'sepa';

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): number => {
  return Math.round(amount);
};

const formatPeriod = (periodStart: Date): string => {
  return format(periodStart, 'MMMM yyyy', { locale: fr }).toUpperCase();
};

const generatePaymentReference = (
  employeeNumber: string,
  periodStart: Date
): string => {
  const month = format(periodStart, 'MM');
  const year = format(periodStart, 'yyyy');
  return `SAL_${employeeNumber}_${month}_${year}`;
};

const sanitizeAccountNumber = (account: string): string => {
  // Remove spaces and special characters
  return account.replace(/[^0-9A-Z]/gi, '');
};

const validateIBAN = (iban: string): boolean => {
  // Basic IBAN validation
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
  return ibanRegex.test(iban.replace(/\s/g, ''));
};

// ========================================
// CSV Export
// ========================================

/**
 * Generate bank transfer CSV file
 *
 * Generic CSV format compatible with most banks.
 * Each bank may have specific requirements, so this is a base format.
 */
export const generateBankTransferCSV = (data: BankTransferExportData): string => {
  // Filter employees with valid bank accounts
  const validEmployees = data.employees.filter((emp) => emp.bankAccount);

  // Prepare rows
  const rows: BankTransferRow[] = validEmployees.map((emp, index) => ({
    'N°': index + 1,
    Matricule: emp.employeeNumber,
    'Nom et Prénoms': emp.employeeName,
    'Banque': emp.bankName || 'N/A',
    'Compte Bancaire': emp.bankAccount || '',
    'Montant (FCFA)': formatCurrency(emp.netSalary),
    'Référence':
      emp.paymentReference || generatePaymentReference(emp.employeeNumber, data.periodStart),
  }));

  // Convert to CSV
  const headers = Object.keys(rows[0]);
  const csvRows = [
    // Header row
    headers.join(','),
    // Data rows
    ...rows.map((row) =>
      headers.map((header) => {
        const value = row[header as keyof BankTransferRow];
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

// ========================================
// Excel Export
// ========================================

/**
 * Generate bank transfer Excel file
 *
 * Excel format with detailed information and summary.
 */
export const generateBankTransferExcel = (data: BankTransferExportData): ArrayBuffer => {
  // Filter employees with valid bank accounts
  const validEmployees = data.employees.filter((emp) => emp.bankAccount);

  // Prepare rows
  const rows: BankTransferRow[] = validEmployees.map((emp, index) => ({
    'N°': index + 1,
    Matricule: emp.employeeNumber,
    'Nom et Prénoms': emp.employeeName,
    'Banque': emp.bankName || 'N/A',
    'Compte Bancaire': emp.bankAccount || '',
    'Montant (FCFA)': formatCurrency(emp.netSalary),
    'Référence':
      emp.paymentReference || generatePaymentReference(emp.employeeNumber, data.periodStart),
  }));

  // Calculate totals
  const totalAmount = rows.reduce((sum, row) => sum + row['Montant (FCFA)'], 0);

  // Add totals row
  rows.push({
    'N°': 0,
    Matricule: '',
    'Nom et Prénoms': 'TOTAL',
    'Banque': '',
    'Compte Bancaire': '',
    'Montant (FCFA)': totalAmount,
    'Référence': '',
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 }, // N°
    { wch: 15 }, // Matricule
    { wch: 30 }, // Nom et Prénoms
    { wch: 20 }, // Banque
    { wch: 25 }, // Compte Bancaire
    { wch: 18 }, // Montant
    { wch: 25 }, // Référence
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add header info sheet
  const employeesWithoutAccount = data.employees.filter((emp) => !emp.bankAccount);

  const headerData = [
    ['ORDRE DE VIREMENT BANCAIRE'],
    [''],
    ['Employeur:', data.companyName],
    ['Compte émetteur:', data.companyBankAccount || 'N/A'],
    ['Période:', formatPeriod(data.periodStart)],
    ['Date de paiement:', format(data.payDate, 'dd/MM/yyyy', { locale: fr })],
    ['Référence du lot:', data.batchReference || `VIR_${format(data.payDate, 'ddMMyyyy')}`],
    [''],
    ['Nombre total d\'employés:', data.employees.length],
    ['Employés avec compte bancaire:', validEmployees.length],
    ['Employés sans compte bancaire:', employeesWithoutAccount.length],
    [''],
    ['Montant total:', `${formatCurrency(totalAmount)} FCFA`],
    [''],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');

  // Add data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Virements');

  // Add sheet for employees without bank accounts
  if (employeesWithoutAccount.length > 0) {
    const missingData = employeesWithoutAccount.map((emp, index) => ({
      'N°': index + 1,
      Matricule: emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Montant (FCFA)': formatCurrency(emp.netSalary),
      'Note': 'Compte bancaire manquant',
    }));

    const missingSheet = XLSX.utils.json_to_sheet(missingData);
    missingSheet['!cols'] = [
      { wch: 5 },
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, missingSheet, 'Comptes manquants');
  }

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return excelBuffer;
};

// ========================================
// SEPA XML Export (Simplified)
// ========================================

/**
 * Generate SEPA XML file for bank transfers
 *
 * Simplified SEPA pain.001.001.03 format.
 * Note: This is a basic implementation. Production systems should use
 * a proper SEPA library for full compliance.
 */
export const generateSEPAXML = (data: BankTransferExportData): string => {
  // Filter employees with valid bank accounts
  const validEmployees = data.employees.filter((emp) => emp.bankAccount);

  const totalAmount = validEmployees.reduce((sum, emp) => sum + emp.netSalary, 0);
  const batchId = data.batchReference || `VIR${format(data.payDate, 'yyyyMMddHHmmss')}`;
  const executionDate = format(data.payDate, 'yyyy-MM-dd');
  const timestamp = format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss');

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">\n';
  xml += '  <CstmrCdtTrfInitn>\n';

  // Group Header
  xml += '    <GrpHdr>\n';
  xml += `      <MsgId>${batchId}</MsgId>\n`;
  xml += `      <CreDtTm>${timestamp}</CreDtTm>\n`;
  xml += `      <NbOfTxs>${validEmployees.length}</NbOfTxs>\n`;
  xml += `      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>\n`;
  xml += '      <InitgPty>\n';
  xml += `        <Nm>${escapeXML(data.companyName)}</Nm>\n`;
  xml += '      </InitgPty>\n';
  xml += '    </GrpHdr>\n';

  // Payment Information
  xml += '    <PmtInf>\n';
  xml += `      <PmtInfId>${batchId}</PmtInfId>\n`;
  xml += '      <PmtMtd>TRF</PmtMtd>\n';
  xml += `      <NbOfTxs>${validEmployees.length}</NbOfTxs>\n`;
  xml += `      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>\n`;
  xml += `      <ReqdExctnDt>${executionDate}</ReqdExctnDt>\n`;
  xml += '      <Dbtr>\n';
  xml += `        <Nm>${escapeXML(data.companyName)}</Nm>\n`;
  xml += '      </Dbtr>\n';
  if (data.companyBankAccount) {
    xml += '      <DbtrAcct>\n';
    xml += '        <Id>\n';
    xml += `          <IBAN>${data.companyBankAccount}</IBAN>\n`;
    xml += '        </Id>\n';
    xml += '      </DbtrAcct>\n';
  }

  // Credit Transfer Transactions
  validEmployees.forEach((emp, index) => {
    const reference = emp.paymentReference || generatePaymentReference(emp.employeeNumber, data.periodStart);

    xml += '      <CdtTrfTxInf>\n';
    xml += '        <PmtId>\n';
    xml += `          <EndToEndId>${reference}</EndToEndId>\n`;
    xml += '        </PmtId>\n';
    xml += '        <Amt>\n';
    xml += `          <InstdAmt Ccy="XOF">${emp.netSalary.toFixed(2)}</InstdAmt>\n`;
    xml += '        </Amt>\n';
    xml += '        <Cdtr>\n';
    xml += `          <Nm>${escapeXML(emp.employeeName)}</Nm>\n`;
    xml += '        </Cdtr>\n';
    xml += '        <CdtrAcct>\n';
    xml += '          <Id>\n';
    if (emp.bankAccount && validateIBAN(emp.bankAccount)) {
      xml += `            <IBAN>${sanitizeAccountNumber(emp.bankAccount)}</IBAN>\n`;
    } else {
      xml += '            <Othr>\n';
      xml += `              <Id>${emp.bankAccount}</Id>\n`;
      xml += '            </Othr>\n';
    }
    xml += '          </Id>\n';
    xml += '        </CdtrAcct>\n';
    xml += '        <RmtInf>\n';
    xml += `          <Ustrd>${escapeXML(formatPeriod(data.periodStart))}</Ustrd>\n`;
    xml += '        </RmtInf>\n';
    xml += '      </CdtTrfTxInf>\n';
  });

  xml += '    </PmtInf>\n';
  xml += '  </CstmrCdtTrfInitn>\n';
  xml += '</Document>';

  return xml;
};

/**
 * Escape XML special characters
 */
const escapeXML = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// ========================================
// File Generation
// ========================================

/**
 * Generate bank transfer file name
 */
export const generateBankTransferFilename = (
  periodStart: Date,
  format: BankTransferFormat
): string => {
  const month = XLSX.utils.format_cell({ t: 's', v: periodStart.getMonth() + 1 });
  const year = periodStart.getFullYear();
  const monthStr = month.toString().padStart(2, '0');

  const extension = format === 'sepa' ? 'xml' : format === 'excel' ? 'xlsx' : 'csv';
  return `Virement_Bancaire_${monthStr}_${year}.${extension}`;
};

// ========================================
// Validation
// ========================================

/**
 * Validate bank transfer export data
 */
export const validateBankTransferExportData = (data: BankTransferExportData): string[] => {
  const errors: string[] = [];

  // Check if there are employees
  if (data.employees.length === 0) {
    errors.push('Aucun employé à exporter');
  }

  // Check if employees have bank accounts
  const employeesWithoutAccount = data.employees.filter((emp) => !emp.bankAccount);
  if (employeesWithoutAccount.length > 0) {
    errors.push(
      `${employeesWithoutAccount.length} employé(s) sans compte bancaire (seront exclus)`
    );
  }

  const validEmployees = data.employees.filter((emp) => emp.bankAccount);
  if (validEmployees.length === 0) {
    errors.push('Aucun employé avec un compte bancaire valide');
  }

  // Check if employees have valid net salaries
  const employeesWithInvalidSalary = data.employees.filter((emp) => emp.netSalary <= 0);
  if (employeesWithInvalidSalary.length > 0) {
    errors.push(`${employeesWithInvalidSalary.length} employé(s) avec un salaire net invalide`);
  }

  // Check if company has bank account (for SEPA)
  if (!data.companyBankAccount) {
    errors.push(
      "Le compte bancaire de l'entreprise est manquant (requis pour le format SEPA)"
    );
  }

  return errors;
};

/**
 * Get bank transfer export summary
 */
export const getBankTransferExportSummary = (data: BankTransferExportData) => {
  const validEmployees = data.employees.filter((emp) => emp.bankAccount);
  const totalAmount = validEmployees.reduce((sum, emp) => sum + emp.netSalary, 0);
  const employeesWithoutAccount = data.employees.filter((emp) => !emp.bankAccount);

  // Group by bank
  const bankGroups = validEmployees.reduce((acc, emp) => {
    const bank = emp.bankName || 'Non spécifié';
    if (!acc[bank]) {
      acc[bank] = { count: 0, total: 0 };
    }
    acc[bank].count++;
    acc[bank].total += emp.netSalary;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  return {
    totalEmployees: data.employees.length,
    validEmployees: validEmployees.length,
    employeesWithoutAccount: employeesWithoutAccount.length,
    totalAmount: formatCurrency(totalAmount),
    bankGroups: Object.entries(bankGroups).map(([bank, data]) => ({
      bank,
      count: data.count,
      total: formatCurrency(data.total),
    })),
  };
};
