/**
 * Employee Import Parser
 *
 * Parses Excel and CSV files for employee imports
 * Handles encoding issues, detects headers, maps fields
 */

import * as XLSX from 'xlsx';
import { parse as parseCSV } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import {
  SAGE_TO_PREEM_MAPPING,
  findDatabaseField,
  normalizeFieldName,
  validateField,
  transformField,
  isRequiredField,
  validateConditionalFields,
} from './field-mappings';

export type ParsedRow = Record<string, any>;

export type ParseError = {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type ParseResult = {
  success: boolean;
  rows: ParsedRow[];
  errors: ParseError[];
  warnings: ParseError[];
  fieldMapping: Record<string, string>; // SAGE field → DB field
  totalRows: number;
  validRows: number;
};

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse employee import file (Excel or CSV)
 */
export async function parseEmployeeFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(fileBuffer);
  } else if (extension === 'csv') {
    return parseCSVFile(fileBuffer);
  } else {
    throw new Error(`Format de fichier non supporté: ${extension}. Utilisez .xlsx ou .csv`);
  }
}

// ============================================================================
// EXCEL PARSER
// ============================================================================

function parseExcelFile(fileBuffer: Buffer): ParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  // Get first sheet (usually "Employés")
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON (array of objects)
  const rawData = XLSX.utils.sheet_to_json(sheet, {
    header: 1, // Get as array of arrays first
    defval: '', // Default value for empty cells
    raw: false, // Convert dates to strings
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

  // Detect if row 2 is format hints (contains "Ex:" or similar)
  let dataStartRow = headerRowIndex + 1;
  if (dataStartRow < rawData.length) {
    const secondRow = rawData[dataStartRow];
    const isHintRow = secondRow.some((cell: any) => {
      const str = String(cell || '').toLowerCase();
      return str.includes('ex:') || str.includes('exemple') || str.includes('format');
    });
    if (isHintRow) {
      dataStartRow++;
    }
  }

  // Build field mapping
  const fieldMapping = buildFieldMapping(headers);

  // Parse data rows
  const dataRows = rawData.slice(dataStartRow);

  return parseDataRows(dataRows, headers, fieldMapping);
}

// ============================================================================
// CSV PARSER
// ============================================================================

function parseCSVFile(fileBuffer: Buffer): ParseResult {
  // Try multiple encodings (SAGE often exports in ISO-8859-1)
  const encodings = ['utf8', 'iso-8859-1', 'windows-1252'];
  let decoded: string | null = null;

  for (const encoding of encodings) {
    try {
      decoded = iconv.decode(fileBuffer, encoding);
      // Check if decoding was successful (no replacement characters)
      if (!decoded.includes('�')) {
        break;
      }
    } catch (e) {
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

      // Check if parsing was successful (at least 2 columns)
      if (parsed.length > 0 && parsed[0].length >= 2) {
        records = parsed;
        break;
      }
    } catch (e) {
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
      return str.includes('ex:') || str.includes('exemple') || str.includes('format');
    });
    if (isHintRow) {
      dataStartRow = 2;
    }
  }

  // Build field mapping
  const fieldMapping = buildFieldMapping(headers);

  // Parse data rows
  const dataRows = records.slice(dataStartRow);

  return parseDataRows(dataRows, headers, fieldMapping);
}

// ============================================================================
// FIELD MAPPING
// ============================================================================

function buildFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    if (!header) continue;

    const dbField = findDatabaseField(header);
    if (dbField) {
      mapping[header] = dbField;
    }
  }

  return mapping;
}

// ============================================================================
// DATA ROW PARSER
// ============================================================================

function parseDataRows(
  dataRows: any[][],
  headers: string[],
  fieldMapping: Record<string, string>
): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 1; // 1-indexed for user display
    const rowData = dataRows[i];

    // Skip completely empty rows
    if (!rowData || rowData.every((cell: any) => !cell || String(cell).trim() === '')) {
      continue;
    }

    // Build row object
    const rowObject: Record<string, any> = {};
    const rowErrors: ParseError[] = [];
    const rowWarnings: ParseError[] = [];

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = rowData[j];
      const dbField = fieldMapping[header];

      if (!dbField) continue; // Skip unmapped fields

      // Transform value
      const transformed = transformField(header, value);
      rowObject[dbField] = transformed;

      // Validate value
      const validation = validateField(header, transformed);
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
    for (const sageField of Object.keys(SAGE_TO_PREEM_MAPPING)) {
      if (isRequiredField(sageField)) {
        const dbField = SAGE_TO_PREEM_MAPPING[sageField];
        const value = rowObject[dbField];

        if (!value || String(value).trim() === '') {
          rowErrors.push({
            row: rowIndex,
            field: sageField,
            message: `Champ requis manquant: ${sageField}`,
            severity: 'error',
          });
        }
      }
    }

    // Build a row with original header names for conditional validation
    const rowWithHeaders: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = rowData[j];
      if (header) {
        rowWithHeaders[header] = value;
      }
    }

    // Check conditionally required fields (e.g., Régime horaire for CDDTI, Date de fin de contrat for CDD/CDDTI)
    const conditionalErrors = validateConditionalFields(rowWithHeaders);
    for (const condError of conditionalErrors) {
      rowErrors.push({
        row: rowIndex,
        field: condError.message?.split(' est requis')[0], // Extract field name from message
        message: condError.message || 'Champ conditionnel requis manquant',
        severity: 'error',
      });
    }

    // Warnings removed - only show critical validation errors
    // Users can add optional fields (CMU, place of birth, parents' names) later via employee edit

    // Add row even if it has errors (for preview)
    rows.push(rowObject);
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
 * Check for duplicate employee numbers within parsed data
 */
export function detectDuplicates(rows: ParsedRow[]): ParseError[] {
  const errors: ParseError[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const employeeNumber = rows[i].employeeNumber;
    if (!employeeNumber) continue;

    const normalized = String(employeeNumber).trim().toUpperCase();
    if (seen.has(normalized)) {
      errors.push({
        row: i + 1,
        field: 'Matricule',
        message: `Matricule en double: ${employeeNumber} (déjà utilisé ligne ${seen.get(normalized)})`,
        severity: 'error',
      });
    } else {
      seen.set(normalized, i + 1);
    }
  }

  return errors;
}
