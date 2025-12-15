/**
 * Observation Import Parser
 *
 * Parses Excel and CSV files for KPI observation imports
 * Handles encoding issues, detects headers, maps fields
 *
 * Used by team leads and HR to import daily/weekly observations
 */

import * as XLSX from 'xlsx';
import { parse as parseCSV } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import {
  findObservationField,
  validateObservationField,
  transformObservationField,
  isRequiredObservationField,
  REQUIRED_OBSERVATION_FIELDS,
} from './field-mappings';
import type { ObservationKpiData } from '@/lib/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedObservationRow {
  employeeNumber: string;
  observationDate: Date;
  period: string;
  kpiData: ObservationKpiData;
  overallRating: number | null;
  comment: string | null;
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ObservationParseResult {
  success: boolean;
  rows: ParsedObservationRow[];
  errors: ParseError[];
  warnings: ParseError[];
  fieldMapping: Record<string, string>;
  totalRows: number;
  validRows: number;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse observation import file (Excel or CSV)
 */
export async function parseObservationFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<ObservationParseResult> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    return parseObservationExcel(fileBuffer);
  } else if (extension === 'csv') {
    return parseObservationCSV(fileBuffer);
  } else {
    throw new Error(`Format de fichier non supporté: ${extension}. Utilisez .xlsx ou .csv`);
  }
}

// ============================================================================
// EXCEL PARSER
// ============================================================================

function parseObservationExcel(fileBuffer: Buffer): ObservationParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON (array of arrays)
  const rawData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as any[][];

  if (rawData.length === 0) {
    return {
      success: false,
      rows: [],
      errors: [{ row: 0, message: 'Fichier vide', severity: 'error' }],
      warnings: [],
      fieldMapping: {},
      totalRows: 0,
      validRows: 0,
    };
  }

  // Detect header row (first non-empty row)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some((cell: any) => cell && String(cell).trim())) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = rawData[headerRowIndex].map((h: any) => String(h || '').trim());

  // Detect if row 2 is format hints
  let dataStartRow = headerRowIndex + 1;
  if (dataStartRow < rawData.length) {
    const secondRow = rawData[dataStartRow];
    const isHintRow = secondRow.some((cell: any) => {
      const str = String(cell || '').toLowerCase();
      return str.includes('ex:') || str.includes('exemple') || str.includes('format') || str.includes('1-5');
    });
    if (isHintRow) {
      dataStartRow++;
    }
  }

  // Build field mapping
  const fieldMapping = buildObservationFieldMapping(headers);

  // Parse data rows
  const dataRows = rawData.slice(dataStartRow);

  return parseObservationDataRows(dataRows, headers, fieldMapping);
}

// ============================================================================
// CSV PARSER
// ============================================================================

function parseObservationCSV(fileBuffer: Buffer): ObservationParseResult {
  // Try multiple encodings
  const encodings = ['utf8', 'iso-8859-1', 'windows-1252'];
  let decoded: string | null = null;

  for (const encoding of encodings) {
    try {
      decoded = iconv.decode(fileBuffer, encoding);
      if (!decoded.includes('�')) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (!decoded) {
    throw new Error('Impossible de décoder le fichier CSV. Vérifiez l\'encodage.');
  }

  // Parse CSV (try different delimiters)
  const delimiters = [';', ',', '\t'];
  let records: any[][] | null = null;

  for (const delimiter of delimiters) {
    try {
      const parsed = parseCSV(decoded, {
        delimiter,
        skip_empty_lines: true,
        relax_quotes: true,
        trim: true,
      }) as any[][];

      if (parsed.length > 0 && parsed[0].length >= 2) {
        records = parsed;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!records || records.length === 0) {
    return {
      success: false,
      rows: [],
      errors: [{ row: 0, message: 'Impossible de lire le fichier CSV', severity: 'error' }],
      warnings: [],
      fieldMapping: {},
      totalRows: 0,
      validRows: 0,
    };
  }

  // First row is headers
  const headers = records[0].map((h: any) => String(h || '').trim());

  // Check if row 2 is format hints
  let dataStartRow = 1;
  if (records.length > 1) {
    const secondRow = records[1];
    const isHintRow = secondRow.some((cell: any) => {
      const str = String(cell || '').toLowerCase();
      return str.includes('ex:') || str.includes('exemple') || str.includes('format') || str.includes('1-5');
    });
    if (isHintRow) {
      dataStartRow = 2;
    }
  }

  // Build field mapping
  const fieldMapping = buildObservationFieldMapping(headers);

  // Parse data rows
  const dataRows = records.slice(dataStartRow);

  return parseObservationDataRows(dataRows, headers, fieldMapping);
}

// ============================================================================
// FIELD MAPPING
// ============================================================================

function buildObservationFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    if (!header) continue;

    const dbField = findObservationField(header);
    if (dbField) {
      mapping[header] = dbField;
    }
  }

  return mapping;
}

// ============================================================================
// DATA ROW PARSER
// ============================================================================

function parseObservationDataRows(
  dataRows: any[][],
  headers: string[],
  fieldMapping: Record<string, string>
): ObservationParseResult {
  const rows: ParsedObservationRow[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 1;
    const rowData = dataRows[i];

    // Skip completely empty rows
    if (!rowData || rowData.every((cell: any) => !cell || String(cell).trim() === '')) {
      continue;
    }

    // Build raw row object
    const rawRow: Record<string, any> = {};
    const rowErrors: ParseError[] = [];
    const rowWarnings: ParseError[] = [];

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = rowData[j];
      const dbField = fieldMapping[header];

      if (!dbField) continue;

      // Transform value
      const transformed = transformObservationField(header, value);
      rawRow[dbField] = transformed;

      // Validate value
      const validation = validateObservationField(header, value);
      if (!validation.valid) {
        rowErrors.push({
          row: rowIndex,
          field: header,
          message: validation.message || 'Valeur invalide',
          severity: 'error',
        });
      }
    }

    // Check required fields
    for (const requiredField of REQUIRED_OBSERVATION_FIELDS) {
      const dbField = findObservationField(requiredField);
      if (dbField) {
        const value = rawRow[dbField];
        const isMissing = value === null || value === undefined ||
          (typeof value === 'string' && value.trim() === '');

        if (isMissing) {
          rowErrors.push({
            row: rowIndex,
            field: requiredField,
            message: `Champ requis manquant: ${requiredField}`,
            severity: 'error',
          });
        }
      }
    }

    // Build structured observation row
    const kpiData: ObservationKpiData = {
      unitsProduced: rawRow.unitsProduced ?? undefined,
      targetUnits: rawRow.targetUnits ?? undefined,
      defects: rawRow.defects ?? undefined,
      defectRate: rawRow.defectRate ?? undefined,
      machineDowntimeMinutes: rawRow.machineDowntimeMinutes ?? undefined,
      hoursWorked: rawRow.hoursWorked ?? undefined,
      expectedHours: rawRow.expectedHours ?? undefined,
      lateMinutes: rawRow.lateMinutes ?? undefined,
      absenceType: rawRow.absenceType ?? undefined,
      safetyScore: rawRow.safetyScore ?? undefined,
      ppeCompliance: rawRow.ppeCompliance ?? undefined,
      incidentReported: rawRow.incidentReported ?? undefined,
      qualityScore: rawRow.qualityScore ?? undefined,
      teamworkScore: rawRow.teamworkScore ?? undefined,
      initiativeScore: rawRow.initiativeScore ?? undefined,
    };

    // Clean undefined values from kpiData
    Object.keys(kpiData).forEach(key => {
      const k = key as keyof ObservationKpiData;
      if (kpiData[k] === undefined) {
        delete kpiData[k];
      }
    });

    const observationRow: ParsedObservationRow = {
      employeeNumber: rawRow.employeeNumber || '',
      observationDate: rawRow.observationDate || new Date(),
      period: rawRow.period || 'daily',
      kpiData,
      overallRating: rawRow.overallRating ?? null,
      comment: rawRow.comment ?? null,
    };

    rows.push(observationRow);
    errors.push(...rowErrors);
    warnings.push(...rowWarnings);
  }

  const validRows = rows.filter((_, i) => {
    const rowIndex = i + 1;
    return !errors.some(e => e.row === rowIndex);
  }).length;

  return {
    success: errors.length === 0,
    rows,
    errors,
    warnings,
    fieldMapping,
    totalRows: rows.length,
    validRows,
  };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Check for duplicate observations within parsed data
 * (Same employee + same date = duplicate)
 */
export function detectObservationDuplicates(rows: ParsedObservationRow[]): ParseError[] {
  const errors: ParseError[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = `${row.employeeNumber}_${row.observationDate.toISOString().split('T')[0]}`;

    if (seen.has(key)) {
      errors.push({
        row: i + 1,
        field: 'Matricule/Date',
        message: `Observation en double: ${row.employeeNumber} le ${row.observationDate.toISOString().split('T')[0]} (déjà à la ligne ${seen.get(key)})`,
        severity: 'error',
      });
    } else {
      seen.set(key, i + 1);
    }
  }

  return errors;
}

/**
 * Validate employee numbers against database
 */
export function validateEmployeeNumbers(
  rows: ParsedObservationRow[],
  validEmployeeNumbers: Set<string>
): ParseError[] {
  const errors: ParseError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const normalized = row.employeeNumber.trim().toUpperCase();

    if (!validEmployeeNumbers.has(normalized)) {
      errors.push({
        row: i + 1,
        field: 'Matricule',
        message: `Matricule inconnu: ${row.employeeNumber}`,
        severity: 'error',
      });
    }
  }

  return errors;
}
