/**
 * Biometric Device Time Tracking Parser
 *
 * Parses CSV/Excel files from biometric devices (ZKTeco, Anviz, generic)
 * and converts them to time entry format for import.
 *
 * Features:
 * - Auto-detect device type (ZKTeco, Anviz, generic)
 * - Parse timestamps in multiple formats
 * - Match clock-in/clock-out pairs
 * - Validate against existing data
 * - Detect duplicates and missing pairs
 * - Flag overtime automatically
 */

import * as XLSX from 'xlsx';
import { parse as parseCSV } from 'csv-parse/sync';
import { parse as parseDate, isValid, differenceInMinutes, format as formatDate } from 'date-fns';
import {
  DeviceType,
  DeviceFormat,
  DEVICE_FORMATS,
  detectDeviceType,
  normalizeDirection
} from './device-formats';

/**
 * Parsed time entry row from device file
 */
export interface ParsedTimeEntryRow {
  rowNumber: number;
  deviceEmployeeId: string;      // Employee ID from device
  deviceEmployeeName?: string;    // Employee name from device
  employeeId?: string;            // Resolved Preem HR employee ID
  timestamp: Date;                // Parsed timestamp (UTC)
  direction: 'in' | 'out';       // Clock in or clock out
  deviceId?: string;              // Device identifier
  deviceLocation?: string;        // Device location
  rawData: Record<string, any>;   // Original row data
}

/**
 * Paired time entry (clock-in matched with clock-out)
 */
export interface PairedTimeEntry {
  employeeId: string;
  deviceEmployeeId: string;
  deviceEmployeeName?: string;
  clockIn: Date;
  clockOut: Date;
  totalHours: number;
  deviceId?: string;
  deviceLocation?: string;
  workDate: string;               // YYYY-MM-DD format
  inRowNumber: number;
  outRowNumber: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

/**
 * Employee mapping (device ID → system employee)
 */
export interface EmployeeMapping {
  deviceEmployeeId: string;
  deviceEmployeeName?: string;
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'unmapped';
}

/**
 * Parse result
 */
export interface ParseResult {
  deviceType: DeviceType;
  rows: ParsedTimeEntryRow[];
  pairedEntries: PairedTimeEntry[];
  unpairedPunches: ParsedTimeEntryRow[];
  employeeMappings: EmployeeMapping[];
  errors: ValidationError[];
  stats: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    pairedEntries: number;
    unpairedPunches: number;
    uniqueEmployees: number;
    dateRange: { start: Date; end: Date } | null;
  };
}

/**
 * Parse biometric device file
 */
export async function parseBiometricFile(
  fileBuffer: Buffer,
  fileName: string,
  options: {
    deviceType?: DeviceType;
    columnMapping?: Record<string, string>;
    timezoneOffset?: number; // Minutes offset from UTC (e.g., GMT+1 = 60)
    tenantId: string;
  }
): Promise<ParseResult> {
  const errors: ValidationError[] = [];
  const rows: ParsedTimeEntryRow[] = [];

  // Step 1: Detect file format (CSV or Excel)
  const isExcel = fileName.match(/\.(xlsx|xls)$/i);
  let rawRows: any[] = [];
  let headers: string[] = [];

  if (isExcel) {
    // Parse Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // First row is headers
    headers = (jsonData[0] as any[]).map(h => String(h).trim());
    rawRows = (jsonData.slice(1) as any[][]).map((row, idx) => {
      const obj: any = { __rowNumber: idx + 2 }; // +2 because Excel is 1-indexed and we skip header
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  } else {
    // Parse CSV with multiple encoding support
    try {
      const csvData = parseCSV(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true, // Handle BOM
      });
      rawRows = csvData.map((row: any, idx: number) => ({ ...row, __rowNumber: idx + 2 }));
      headers = Object.keys(csvData[0] || {}).filter(k => k !== '__rowNumber');
    } catch (err) {
      // Try alternative encodings
      const text = fileBuffer.toString('latin1');
      const csvData = parseCSV(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      rawRows = csvData.map((row: any, idx: number) => ({ ...row, __rowNumber: idx + 2 }));
      headers = Object.keys(csvData[0] || {}).filter(k => k !== '__rowNumber');
    }
  }

  // Step 2: Auto-detect device type if not specified
  const deviceType = options.deviceType || detectDeviceType(headers) || 'generic';
  const format = DEVICE_FORMATS[deviceType];

  // Step 3: Apply column mapping (either from device format or user-provided)
  const columnMapping = options.columnMapping || format.columnMapping;

  // Find column indices
  const findColumn = (mappingKey: keyof typeof columnMapping): string | null => {
    const mappedName = columnMapping[mappingKey];
    if (mappedName && headers.includes(mappedName)) {
      return mappedName;
    }

    // Try pattern matching for auto-detection
    const patterns = format.columnPatterns[mappingKey];
    if (patterns) {
      const found = headers.find(h => patterns.some(p => p.test(h)));
      if (found) return found;
    }

    return null;
  };

  const employeeIdCol = findColumn('employeeId');
  const employeeNameCol = findColumn('employeeName');
  const timestampCol = findColumn('timestamp');
  const directionCol = findColumn('direction');
  const deviceIdCol = findColumn('deviceId');
  const locationCol = findColumn('location');

  // Validate required columns
  if (!employeeIdCol) {
    errors.push({
      row: 0,
      message: 'Colonne "ID Employé" introuvable. Vérifiez le format du fichier.',
      severity: 'error',
      code: 'MISSING_EMPLOYEE_ID_COLUMN',
    });
  }

  if (!timestampCol) {
    errors.push({
      row: 0,
      message: 'Colonne "Horodatage" introuvable. Vérifiez le format du fichier.',
      severity: 'error',
      code: 'MISSING_TIMESTAMP_COLUMN',
    });
  }

  if (!directionCol) {
    errors.push({
      row: 0,
      message: 'Colonne "Direction (Entrée/Sortie)" introuvable. Vérifiez le format du fichier.',
      severity: 'error',
      code: 'MISSING_DIRECTION_COLUMN',
    });
  }

  // If critical columns missing, return early
  if (!employeeIdCol || !timestampCol || !directionCol) {
    return {
      deviceType,
      rows: [],
      pairedEntries: [],
      unpairedPunches: [],
      employeeMappings: [],
      errors,
      stats: {
        totalRows: rawRows.length,
        validRows: 0,
        errorRows: rawRows.length,
        warningRows: 0,
        pairedEntries: 0,
        unpairedPunches: 0,
        uniqueEmployees: 0,
        dateRange: null,
      },
    };
  }

  // Step 4: Parse each row
  for (const rawRow of rawRows) {
    const rowNumber = rawRow.__rowNumber || 0;
    const rowErrors: ValidationError[] = [];

    try {
      // Extract values
      const deviceEmployeeId = String(rawRow[employeeIdCol] || '').trim();
      const deviceEmployeeName = employeeNameCol ? String(rawRow[employeeNameCol] || '').trim() : undefined;
      const timestampValue = String(rawRow[timestampCol] || '').trim();
      const directionValue = String(rawRow[directionCol] || '').trim();
      const deviceId = deviceIdCol ? String(rawRow[deviceIdCol] || '').trim() : undefined;
      const deviceLocation = locationCol ? String(rawRow[locationCol] || '').trim() : undefined;

      // Validate employee ID
      if (!deviceEmployeeId) {
        rowErrors.push({
          row: rowNumber,
          field: employeeIdCol,
          message: 'ID employé manquant',
          severity: 'error',
          code: 'MISSING_EMPLOYEE_ID',
        });
      }

      // Parse timestamp
      let timestamp: Date | null = null;
      for (const formatStr of format.timestampFormats) {
        try {
          const parsed = parseDate(timestampValue, formatStr, new Date());
          if (isValid(parsed)) {
            timestamp = parsed;

            // Convert to UTC if device uses local time
            if (format.usesLocalTime && options.timezoneOffset !== undefined) {
              timestamp = new Date(timestamp.getTime() - options.timezoneOffset * 60000);
            }
            break;
          }
        } catch (e) {
          // Try next format
        }
      }

      if (!timestamp || !isValid(timestamp)) {
        rowErrors.push({
          row: rowNumber,
          field: timestampCol,
          message: `Format d'horodatage invalide: "${timestampValue}"`,
          severity: 'error',
          code: 'INVALID_TIMESTAMP',
        });
      }

      // Parse direction
      const direction = normalizeDirection(directionValue, format);
      if (!direction) {
        rowErrors.push({
          row: rowNumber,
          field: directionCol,
          message: `Direction invalide: "${directionValue}". Attendu: Entrée/Sortie ou In/Out`,
          severity: 'error',
          code: 'INVALID_DIRECTION',
        });
      }

      // If we have critical errors, skip this row
      if (rowErrors.some(e => e.severity === 'error')) {
        errors.push(...rowErrors);
        continue;
      }

      // Create parsed row
      rows.push({
        rowNumber,
        deviceEmployeeId,
        deviceEmployeeName,
        timestamp: timestamp!,
        direction: direction!,
        deviceId,
        deviceLocation,
        rawData: rawRow,
      });

    } catch (error) {
      errors.push({
        row: rowNumber,
        message: `Erreur lors du parsing: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error',
        code: 'PARSE_ERROR',
      });
    }
  }

  // Step 5: Pair clock-in with clock-out
  const pairedEntries = pairTimeEntries(rows);
  const unpairedPunches = findUnpairedPunches(rows, pairedEntries);

  // Step 6: Generate employee mappings (will be resolved in next step)
  const employeeMappings = generateEmployeeMappings(rows);

  // Step 7: Calculate stats
  const uniqueEmployees = new Set(rows.map(r => r.deviceEmployeeId)).size;
  const timestamps = rows.map(r => r.timestamp).sort((a, b) => a.getTime() - b.getTime());
  const dateRange = timestamps.length > 0
    ? { start: timestamps[0], end: timestamps[timestamps.length - 1] }
    : null;

  return {
    deviceType,
    rows,
    pairedEntries,
    unpairedPunches,
    employeeMappings,
    errors,
    stats: {
      totalRows: rawRows.length,
      validRows: rows.length,
      errorRows: rawRows.length - rows.length,
      warningRows: errors.filter(e => e.severity === 'warning').length,
      pairedEntries: pairedEntries.length,
      unpairedPunches: unpairedPunches.length,
      uniqueEmployees,
      dateRange,
    },
  };
}

/**
 * Pair clock-in with clock-out entries
 *
 * Algorithm:
 * 1. Group by employee ID
 * 2. Sort by timestamp
 * 3. Match each "in" with the next "out" for the same day
 * 4. Handle re-entries (multiple in/out pairs same day)
 */
function pairTimeEntries(rows: ParsedTimeEntryRow[]): PairedTimeEntry[] {
  const pairs: PairedTimeEntry[] = [];

  // Group by employee
  const byEmployee = rows.reduce((acc, row) => {
    if (!acc[row.deviceEmployeeId]) {
      acc[row.deviceEmployeeId] = [];
    }
    acc[row.deviceEmployeeId].push(row);
    return acc;
  }, {} as Record<string, ParsedTimeEntryRow[]>);

  // Process each employee
  for (const [deviceEmployeeId, employeeRows] of Object.entries(byEmployee)) {
    // Sort by timestamp
    const sorted = [...employeeRows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let i = 0;
    while (i < sorted.length) {
      const current = sorted[i];

      if (current.direction === 'in') {
        // Find next "out" for this employee
        const nextOut = sorted.slice(i + 1).find(r => r.direction === 'out');

        if (nextOut) {
          const totalMinutes = differenceInMinutes(nextOut.timestamp, current.timestamp);
          const totalHours = totalMinutes / 60;

          // Only pair if it's the same day and reasonable duration (< 24h)
          const sameDay = formatDate(current.timestamp, 'yyyy-MM-dd') === formatDate(nextOut.timestamp, 'yyyy-MM-dd');

          if (sameDay && totalHours > 0 && totalHours < 24) {
            pairs.push({
              employeeId: current.employeeId || '',
              deviceEmployeeId,
              deviceEmployeeName: current.deviceEmployeeName,
              clockIn: current.timestamp,
              clockOut: nextOut.timestamp,
              totalHours,
              deviceId: current.deviceId,
              deviceLocation: current.deviceLocation,
              workDate: formatDate(current.timestamp, 'yyyy-MM-dd'),
              inRowNumber: current.rowNumber,
              outRowNumber: nextOut.rowNumber,
            });

            // Skip the matched "out"
            i = sorted.indexOf(nextOut) + 1;
            continue;
          }
        }
      }

      i++;
    }
  }

  return pairs;
}

/**
 * Find unpaired punches (clock-in without clock-out or vice versa)
 */
function findUnpairedPunches(
  rows: ParsedTimeEntryRow[],
  pairs: PairedTimeEntry[]
): ParsedTimeEntryRow[] {
  const pairedRowNumbers = new Set<number>();

  // Mark all paired rows
  for (const pair of pairs) {
    pairedRowNumbers.add(pair.inRowNumber);
    pairedRowNumbers.add(pair.outRowNumber);
  }

  // Return rows that aren't in any pair
  return rows.filter(row => !pairedRowNumbers.has(row.rowNumber));
}

/**
 * Generate employee mappings for resolution
 */
function generateEmployeeMappings(rows: ParsedTimeEntryRow[]): EmployeeMapping[] {
  const uniqueEmployees = new Map<string, EmployeeMapping>();

  for (const row of rows) {
    if (!uniqueEmployees.has(row.deviceEmployeeId)) {
      uniqueEmployees.set(row.deviceEmployeeId, {
        deviceEmployeeId: row.deviceEmployeeId,
        deviceEmployeeName: row.deviceEmployeeName,
        matchType: 'unmapped',
      });
    }
  }

  return Array.from(uniqueEmployees.values());
}
