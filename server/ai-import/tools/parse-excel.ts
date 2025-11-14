/**
 * Parse Excel Tool - Raw Data Extraction
 *
 * Extracts raw data from Excel files WITHOUT any analysis or transformation.
 * Pure data extraction - AI handles all understanding.
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { tool } from 'ai';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  sampleData: Record<string, any>[];
  allData: Record<string, any>[];
}

export interface ParseExcelResult {
  fileName: string;
  sheets: ParsedSheet[];
  totalSheets: number;
  totalRows: number;
}

/**
 * Parse Excel file and extract raw data
 */
export async function parseExcel(params: {
  filePath: string;
  includeEmptyRows?: boolean;
  maxSampleRows?: number;
}): Promise<ParseExcelResult> {
  const {
    filePath,
    includeEmptyRows = false,
    maxSampleRows = 10,
  } = params;
    try {
      // Debug: Log file path and check if file exists
      const fs = await import('fs');
      const fileExists = fs.existsSync(filePath);
      const fileStats = fileExists ? fs.statSync(filePath) : null;

      let readable = false;
      if (fileExists) {
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          readable = true;
        } catch (e) {
          readable = false;
        }
      }

      console.log(`[PARSE-EXCEL] Attempting to read file:`, {
        filePath,
        exists: fileExists,
        size: fileStats?.size,
        readable,
        mode: fileStats?.mode?.toString(8),
      });

      if (!fileExists) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      if (!readable) {
        throw new Error(`File exists but is not readable: ${filePath}`);
      }

      // Read the Excel file as buffer (more reliable in serverless environments)
      // XLSX.readFile() can fail in serverless contexts, use XLSX.read() with buffer instead
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      console.log(`[PARSE-EXCEL] Successfully read workbook with ${workbook.SheetNames.length} sheets`);

      const sheets: ParsedSheet[] = [];
      let totalRows = 0;

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const allData = XLSX.utils.sheet_to_json(worksheet, {
          defval: includeEmptyRows ? '' : undefined,
          raw: false, // Convert dates to strings
        }) as Record<string, any>[];

        // Skip empty sheets
        if (allData.length === 0) {
          continue;
        }

        // Extract columns from first row
        const columns = Object.keys(allData[0] || {});

        // Get sample data (first N rows)
        const sampleData = allData.slice(0, maxSampleRows);

        sheets.push({
          name: sheetName,
          rowCount: allData.length,
          columnCount: columns.length,
          columns,
          sampleData,
          allData, // Include all data for later processing
        });

        totalRows += allData.length;
      }

      const result: ParseExcelResult = {
        fileName: filePath.split('/').pop() || 'unknown',
        sheets,
        totalSheets: sheets.length,
        totalRows,
      };

      return result;
    } catch (error) {
      console.error('[PARSE-EXCEL] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });

      throw new Error(
        `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
}