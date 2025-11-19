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
  phoneNumber?: string;
  // RIB components (Relevé d'Identité Bancaire)
  bankCode?: string;        // Code banque (5 digits)
  branchCode?: string;      // Code guichet (5 digits)
  accountNumber?: string;   // Numéro de compte (11 chars)
  ribKey?: string;          // Clé RIB (2 digits)
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
  Matricule: string;
  'Nom Prénom': string;
  'Code Banque': string;
  'Code Guichet': string;
  'Numéro de Compte': string;
  'Clé RIB': string;
  'Libellé': string;
  'Net à Payer': number;
  'Numéro de Téléphone': string;
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

/**
 * Parse RIB components from bank account string
 *
 * French RIB format: BBBBBGGGGGCCCCCCCCCCCCC (23 chars total)
 * - B: Code banque (5 digits)
 * - G: Code guichet (5 digits)
 * - C: Numéro de compte (11 chars)
 * - K: Clé RIB (2 digits)
 *
 * Accepts formats:
 * - "12345 67890 12345678901 23" (with spaces)
 * - "12345678901234567890123" (without spaces)
 * - "12345-67890-12345678901-23" (with dashes)
 */
const parseRIB = (bankAccount: string | null): {
  bankCode?: string;
  branchCode?: string;
  accountNumber?: string;
  ribKey?: string;
} => {
  if (!bankAccount) {
    return {};
  }

  // Remove all spaces, dashes, and special characters
  const cleaned = bankAccount.replace(/[\s\-]/g, '');

  // Check if it's a valid RIB length (23 characters)
  if (cleaned.length === 23 && /^[0-9A-Z]+$/i.test(cleaned)) {
    return {
      bankCode: cleaned.substring(0, 5),
      branchCode: cleaned.substring(5, 10),
      accountNumber: cleaned.substring(10, 21),
      ribKey: cleaned.substring(21, 23),
    };
  }

  // Return empty if not a valid RIB format
  return {};
};

// ========================================
// CSV Export
// ========================================

/**
 * Generate bank transfer CSV file
 *
 * CSV format with RIB components for bank transfers.
 */
export const generateBankTransferCSV = (data: BankTransferExportData): string => {
  // Generate libellé (payment description)
  const month = format(data.periodStart, 'MMMM', { locale: fr }).toUpperCase();
  const year = format(data.periodStart, 'yyyy');
  const libelle = `PAIE ${month} ${year}`;

  // Prepare rows with RIB components (include ALL employees, even without bank accounts)
  const rows: BankTransferRow[] = data.employees.map((emp) => {
    // Parse RIB components from bank account
    const rib = parseRIB(emp.bankAccount);

    return {
      Matricule: emp.employeeNumber,
      'Nom Prénom': emp.employeeName,
      'Code Banque': rib.bankCode || emp.bankCode || '',
      'Code Guichet': rib.branchCode || emp.branchCode || '',
      'Numéro de Compte': rib.accountNumber || emp.accountNumber || '',
      'Clé RIB': rib.ribKey || emp.ribKey || '',
      'Libellé': libelle,
      'Net à Payer': formatCurrency(emp.netSalary),
      'Numéro de Téléphone': emp.phoneNumber || '',
    };
  });

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
 * Excel format with detailed bank information (RIB components).
 * Columns: Matricule, Nom Prénom, Code Banque, Code Guichet, Numéro de Compte,
 *          Clé RIB, Libellé, Net à Payer, Numéro de Téléphone
 */
export const generateBankTransferExcel = (data: BankTransferExportData): ArrayBuffer => {
  // Generate libellé (payment description)
  const generateLibelle = (periodStart: Date): string => {
    const month = format(periodStart, 'MMMM', { locale: fr }).toUpperCase();
    const year = format(periodStart, 'yyyy');
    return `PAIE ${month} ${year}`;
  };

  const libelle = generateLibelle(data.periodStart);

  // Prepare rows with RIB components (include ALL employees, even without bank accounts)
  const rows: BankTransferRow[] = data.employees.map((emp) => {
    // Parse RIB components from bank account
    const rib = parseRIB(emp.bankAccount);

    return {
      Matricule: emp.employeeNumber,
      'Nom Prénom': emp.employeeName,
      'Code Banque': rib.bankCode || emp.bankCode || '',
      'Code Guichet': rib.branchCode || emp.branchCode || '',
      'Numéro de Compte': rib.accountNumber || emp.accountNumber || '',
      'Clé RIB': rib.ribKey || emp.ribKey || '',
      'Libellé': libelle,
      'Net à Payer': formatCurrency(emp.netSalary),
      'Numéro de Téléphone': emp.phoneNumber || '',
    };
  });

  // Calculate totals
  const totalAmount = rows.reduce((sum, row) => sum + row['Net à Payer'], 0);

  // Add totals row
  rows.push({
    Matricule: '',
    'Nom Prénom': 'TOTAL',
    'Code Banque': '',
    'Code Guichet': '',
    'Numéro de Compte': '',
    'Clé RIB': '',
    'Libellé': '',
    'Net à Payer': totalAmount,
    'Numéro de Téléphone': '',
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 },  // Matricule
    { wch: 30 },  // Nom Prénom
    { wch: 12 },  // Code Banque
    { wch: 12 },  // Code Guichet
    { wch: 15 },  // Numéro de Compte
    { wch: 10 },  // Clé RIB
    { wch: 25 },  // Libellé
    { wch: 15 },  // Net à Payer
    { wch: 18 },  // Numéro de Téléphone
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add data sheet (main sheet)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Paiement');

  // Add header info sheet
  const employeesWithBankAccount = data.employees.filter((emp) => emp.bankAccount);
  const employeesWithoutAccount = data.employees.filter((emp) => !emp.bankAccount);

  const headerData = [
    ['EXTRACTION POUR PAIEMENT'],
    [''],
    ['Employeur:', data.companyName],
    ['Période:', formatPeriod(data.periodStart)],
    ['Date de paiement:', format(data.payDate, 'dd/MM/yyyy', { locale: fr })],
    [''],
    ['Nombre total d\'employés:', data.employees.length],
    ['Employés avec compte bancaire:', employeesWithBankAccount.length],
    ['Employés sans compte bancaire:', employeesWithoutAccount.length],
    [''],
    ['Montant total:', `${formatCurrency(totalAmount)} FCFA`],
    [''],
  ];

  const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Informations');

  // Add sheet for employees without bank accounts
  if (employeesWithoutAccount.length > 0) {
    const missingData = employeesWithoutAccount.map((emp) => ({
      Matricule: emp.employeeNumber,
      'Nom et Prénoms': emp.employeeName,
      'Montant (FCFA)': formatCurrency(emp.netSalary),
      'Note': 'Compte bancaire manquant',
    }));

    const missingSheet = XLSX.utils.json_to_sheet(missingData);
    missingSheet['!cols'] = [
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
  // For SEPA, we MUST filter to only employees with valid bank accounts
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
  return `Extraction_Paiement_${monthStr}_${year}.${extension}`;
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
