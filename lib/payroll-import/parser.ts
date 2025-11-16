/**
 * Parse Excel file for historical payroll import
 */

import * as XLSX from 'xlsx';
import type {
  PayrollImportRow,
  ParsedLineItem,
  ParsedPayrollRun,
  ImportWarning,
  ParseResult,
} from './types';

/**
 * Parse Excel file from buffer or base64
 */
export async function parsePayrollImportFile(fileData: string | Buffer): Promise<ParseResult> {
  const warnings: ImportWarning[] = [];

  // Convert base64 to buffer if needed
  const buffer = typeof fileData === 'string'
    ? Buffer.from(fileData, 'base64')
    : fileData;

  // Parse Excel workbook
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Get first sheet (should be "Données de Paie")
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Aucune feuille trouvée dans le fichier Excel');
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Feuille "${sheetName}" introuvable`);
  }

  // Convert sheet to JSON with header row
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false, // Get formatted values (dates as strings)
  });

  if (rawData.length === 0) {
    throw new Error('Le fichier Excel est vide');
  }

  // Parse rows
  const parsedRows: { row: PayrollImportRow; rowNumber: number }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    const rowNumber = i + 2; // Excel row number (1-indexed + header)

    try {
      const parsedRow = parseRow(rawRow, rowNumber, warnings);
      if (parsedRow) {
        parsedRows.push({ row: parsedRow, rowNumber });
      }
    } catch (error) {
      warnings.push({
        row: rowNumber,
        type: 'other',
        message: error instanceof Error ? error.message : 'Erreur de parsing',
      });
    }
  }

  // Group rows by payroll run
  const runs = groupRowsByRun(parsedRows, warnings);

  // Validate that all periods are in the past
  const now = new Date();
  for (const run of runs) {
    const periodEnd = ensureDate(run.periodEnd);
    if (periodEnd > now) {
      throw new Error(
        `La période de paie "${run.runNumber}" se termine dans le futur (${periodEnd.toLocaleDateString('fr-FR')}). ` +
        `Seules les paies historiques (périodes passées) peuvent être importées.`
      );
    }
  }

  // Generate summary
  const summary = {
    totalRuns: runs.length,
    totalEmployees: parsedRows.length,
    totalRows: rawData.length,
    warningCount: warnings.length,
    errorCount: 0, // Will be populated by validation step
  };

  return {
    runs,
    warnings,
    validationErrors: [], // Will be populated by validation step
    summary,
  };
}

/**
 * Parse a single row from Excel
 */
function parseRow(
  rawRow: Record<string, unknown>,
  rowNumber: number,
  warnings: ImportWarning[]
): PayrollImportRow | null {
  // Map French column names to fields
  const row: PayrollImportRow = {
    // Run-level fields
    numero_paie: getString(rawRow, 'Numéro de Paie*', rowNumber, warnings),
    periode_debut: getDate(rawRow, 'Période Début*', rowNumber, warnings),
    periode_fin: getDate(rawRow, 'Période Fin*', rowNumber, warnings),
    date_paiement: getDate(rawRow, 'Date de Paiement*', rowNumber, warnings),
    frequence_paiement: getFrequency(rawRow, 'Fréquence*', rowNumber, warnings),
    nom_paie: getStringOptional(rawRow, 'Nom de la Paie'),
    description_paie: getStringOptional(rawRow, 'Description'),
    code_pays: getString(rawRow, 'Code Pays*', rowNumber, warnings),
    sequence_cloture: getNumberOptional(rawRow, 'Séquence Clôture'),

    // Employee identification
    matricule: getString(rawRow, 'Matricule*', rowNumber, warnings),
    nom_employe: getStringOptional(rawRow, 'Nom Employé'),
    numero_employe: getStringOptional(rawRow, 'Numéro Employé'),
    titre_poste: getStringOptional(rawRow, 'Titre du Poste'),

    // Salary & allowances
    salaire_base: getNumber(rawRow, 'Salaire de Base*', rowNumber, warnings),
    logement: getNumberOptional(rawRow, 'Logement'),
    transport: getNumberOptional(rawRow, 'Transport'),
    repas: getNumberOptional(rawRow, 'Repas'),
    autres_allocations: getNumberOptional(rawRow, 'Autres Allocations'),

    // Time tracking
    jours_travailles: getNumber(rawRow, 'Jours Travaillés*', rowNumber, warnings),
    jours_absents: getNumberOptional(rawRow, 'Jours Absents'),
    heures_travaillees: getNumberOptional(rawRow, 'Heures Travaillées'),
    heures_supp_25: getNumberOptional(rawRow, 'Heures Supp 25%'),
    heures_supp_50: getNumberOptional(rawRow, 'Heures Supp 50%'),
    heures_supp_75: getNumberOptional(rawRow, 'Heures Supp 75%'),
    heures_supp_100: getNumberOptional(rawRow, 'Heures Supp 100%'),
    paiement_heures_supp: getNumberOptional(rawRow, 'Paiement Heures Supp'),
    primes: getNumberOptional(rawRow, 'Primes'),

    // Earnings
    salaire_brut: getNumber(rawRow, 'Salaire Brut*', rowNumber, warnings),
    brut_imposable: getNumberOptional(rawRow, 'Brut Imposable'),

    // Employee deductions
    cnps_employe: getNumber(rawRow, 'CNPS Employé*', rowNumber, warnings),
    cmu_employe: getNumberOptional(rawRow, 'CMU Employé'),
    its: getNumber(rawRow, 'ITS*', rowNumber, warnings),
    autres_deductions: getStringOptional(rawRow, 'Autres Déductions'),
    total_deductions: getNumber(rawRow, 'Total Déductions*', rowNumber, warnings),
    net_a_payer: getNumber(rawRow, 'Net à Payer*', rowNumber, warnings),

    // Employer contributions
    cnps_employeur: getNumber(rawRow, 'CNPS Employeur*', rowNumber, warnings),
    cmu_employeur: getNumberOptional(rawRow, 'CMU Employeur'),
    autres_impots_employeur: getNumberOptional(rawRow, 'Autres Impôts Employeur'),
    cout_total_employeur: getNumber(rawRow, 'Coût Total Employeur*', rowNumber, warnings),

    // Payment details
    methode_paiement: getStringOptional(rawRow, 'Méthode de Paiement'),
    compte_bancaire: getStringOptional(rawRow, 'Compte Bancaire'),
    reference_paiement: getStringOptional(rawRow, 'Référence Paiement'),
    notes: getStringOptional(rawRow, 'Notes'),
  };

  // Skip row if all required fields are empty
  if (!row.numero_paie && !row.matricule) {
    return null;
  }

  return row;
}

/**
 * Group rows by payroll run
 */
function groupRowsByRun(
  parsedRows: { row: PayrollImportRow; rowNumber: number }[],
  warnings: ImportWarning[]
): ParsedPayrollRun[] {
  const runMap = new Map<string, ParsedPayrollRun>();

  for (const { row, rowNumber } of parsedRows) {
    // Use numero_paie as key
    const runKey = row.numero_paie;

    if (!runMap.has(runKey)) {
      // Create new run
      runMap.set(runKey, {
        runNumber: row.numero_paie,
        periodStart: ensureDate(row.periode_debut),
        periodEnd: ensureDate(row.periode_fin),
        payDate: ensureDate(row.date_paiement),
        paymentFrequency: row.frequence_paiement,
        name: row.nom_paie,
        description: row.description_paie,
        countryCode: row.code_pays,
        closureSequence: row.sequence_cloture,
        lineItems: [],
      });
    }

    const run = runMap.get(runKey)!;

    // Convert row to line item (will be validated later)
    const lineItem = convertToLineItem(row, rowNumber, warnings);
    run.lineItems.push(lineItem);
  }

  return Array.from(runMap.values());
}

/**
 * Convert row to line item
 */
function convertToLineItem(
  row: PayrollImportRow,
  rowNumber: number,
  warnings: ImportWarning[]
): ParsedLineItem {
  // Parse other deductions JSON
  let otherDeductions: Record<string, number> = {};
  if (row.autres_deductions && row.autres_deductions.trim() !== '{}' && row.autres_deductions.trim() !== '') {
    try {
      otherDeductions = JSON.parse(row.autres_deductions);
    } catch (error) {
      warnings.push({
        row: rowNumber,
        field: 'autres_deductions',
        type: 'invalid_value',
        message: 'Format JSON invalide pour "Autres Déductions"',
        employeeNumber: row.matricule,
      });
    }
  }

  return {
    employeeId: '', // Will be resolved later from matricule
    employeeNumber: row.matricule,
    employeeName: row.nom_employe,
    positionTitle: row.titre_poste,

    baseSalary: row.salaire_base,
    allowances: {
      housing: row.logement,
      transport: row.transport,
      meal: row.repas,
      other: row.autres_allocations,
    },

    daysWorked: row.jours_travailles,
    daysAbsent: row.jours_absents ?? 0,
    hoursWorked: row.heures_travaillees,
    overtimeHours: {
      regular25: row.heures_supp_25,
      regular50: row.heures_supp_50,
      night75: row.heures_supp_75,
      sunday100: row.heures_supp_100,
    },
    overtimePay: row.paiement_heures_supp,
    bonuses: row.primes,

    grossSalary: row.salaire_brut,
    brutImposable: row.brut_imposable,

    cnpsEmployee: row.cnps_employe,
    cmuEmployee: row.cmu_employe,
    its: row.its,
    otherDeductions,
    totalDeductions: row.total_deductions,
    netSalary: row.net_a_payer,

    cnpsEmployer: row.cnps_employeur,
    cmuEmployer: row.cmu_employeur,
    totalOtherTaxes: row.autres_impots_employeur,
    totalEmployerCost: row.cout_total_employeur,

    paymentMethod: row.methode_paiement ?? 'bank_transfer',
    bankAccount: row.compte_bancaire,
    paymentReference: row.reference_paiement,
    notes: row.notes,
  };
}

// Helper functions

function getString(row: Record<string, unknown>, key: string, rowNumber: number, warnings: ImportWarning[]): string {
  const value = row[key];
  if (!value || value === '') {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'missing_field',
      message: `Champ obligatoire manquant: ${key}`,
    });
    return '';
  }
  return String(value).trim();
}

function getStringOptional(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return value && value !== '' ? String(value).trim() : undefined;
}

function getNumber(row: Record<string, unknown>, key: string, rowNumber: number, warnings: ImportWarning[]): number {
  const value = row[key];
  if (value === undefined || value === null || value === '') {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'missing_field',
      message: `Champ obligatoire manquant: ${key}`,
    });
    return 0;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/\s/g, ''));
  if (isNaN(num)) {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'invalid_value',
      message: `Valeur numérique invalide pour: ${key}`,
    });
    return 0;
  }
  return num;
}

function getNumberOptional(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/\s/g, ''));
  return isNaN(num) ? undefined : num;
}

function getDate(row: Record<string, unknown>, key: string, rowNumber: number, warnings: ImportWarning[]): Date | string {
  const value = row[key];
  if (!value || value === '') {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'missing_field',
      message: `Champ obligatoire manquant: ${key}`,
    });
    return new Date();
  }

  // Try parsing as date
  if (value instanceof Date) {
    return value;
  }

  const dateStr = String(value).trim();
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'invalid_value',
      message: `Date invalide pour: ${key} (utilisez AAAA-MM-JJ)`,
    });
    return dateStr; // Return string, will be handled later
  }

  return parsed;
}

function getFrequency(row: Record<string, unknown>, key: string, rowNumber: number, warnings: ImportWarning[]): 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY' {
  const value = getString(row, key, rowNumber, warnings).toUpperCase();
  const valid = ['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY'];

  if (!valid.includes(value)) {
    warnings.push({
      row: rowNumber,
      field: key,
      type: 'invalid_value',
      message: `Fréquence invalide: ${value}. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY`,
    });
    return 'MONTHLY';
  }

  return value as 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
}

function ensureDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
