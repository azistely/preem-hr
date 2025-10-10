/**
 * ExportFileGenerator Service
 *
 * Generates export files (CSV, Excel, XML) from mapped data.
 * Supports multiple file formats and provider-specific configurations.
 *
 * Source: docs/05-EPIC-PAYROLL.md Multi-Country Architecture Phase 1
 */

import type {
  ExportColumnDefinition,
  ExportTemplateStructure,
  ExportTemplateMetadata,
  ExportRowDefinition,
} from '@/lib/db/schema/export-templates';
import type { MappedRow } from './export-template-mapper';
import * as XLSX from 'xlsx';

// ========================================
// Types
// ========================================

export interface ExportFileOptions {
  filename: string;
  fileFormat: 'csv' | 'xlsx' | 'txt' | 'xml';
  delimiter?: string; // For CSV/TXT
  encoding?: string;
  metadata?: ExportTemplateMetadata;
}

export interface ExportFileResult {
  filename: string;
  mimeType: string;
  content: Buffer | string;
  size: number;
}

// ========================================
// ExportFileGenerator Class
// ========================================

export class ExportFileGenerator {
  /**
   * Generate export file from mapped data
   */
  static async generate(
    mappedData: MappedRow[],
    template: ExportTemplateStructure,
    options: ExportFileOptions
  ): Promise<ExportFileResult> {
    switch (options.fileFormat) {
      case 'csv':
      case 'txt':
        return this.generateCSV(mappedData, template, options);

      case 'xlsx':
        return this.generateExcel(mappedData, template, options);

      case 'xml':
        return this.generateXML(mappedData, template, options);

      default:
        throw new Error(`Unsupported file format: ${options.fileFormat}`);
    }
  }

  // ========================================
  // CSV/TXT Generation
  // ========================================

  /**
   * Generate CSV file
   */
  private static generateCSV(
    mappedData: MappedRow[],
    template: ExportTemplateStructure,
    options: ExportFileOptions
  ): ExportFileResult {
    const delimiter = options.delimiter || ';';
    const lines: string[] = [];

    // Add custom header rows if defined
    if (template.headers && template.headers.length > 0) {
      template.headers.forEach((headerRow) => {
        lines.push(this.buildHeaderRow(headerRow, delimiter));
      });
    }

    // Add column headers
    const columnHeaders = template.columns
      .sort((a, b) => a.position - b.position)
      .map((col) => this.escapeCsvValue(col.name, delimiter));
    lines.push(columnHeaders.join(delimiter));

    // Add data rows
    mappedData.forEach((row) => {
      const values = template.columns
        .sort((a, b) => a.position - b.position)
        .map((col) => {
          const value = row[col.name];
          return this.escapeCsvValue(this.formatCsvValue(value), delimiter);
        });
      lines.push(values.join(delimiter));
    });

    // Add custom footer rows if defined
    if (template.footers && template.footers.length > 0) {
      template.footers.forEach((footerRow) => {
        lines.push(this.buildFooterRow(footerRow, mappedData, delimiter));
      });
    }

    const content = lines.join('\n');
    const encoding = options.encoding || 'UTF-8';

    return {
      filename: options.filename,
      mimeType: 'text/csv',
      content: Buffer.from(content, encoding === 'UTF-8' ? 'utf-8' : 'latin1'),
      size: Buffer.byteLength(content, encoding === 'UTF-8' ? 'utf-8' : 'latin1'),
    };
  }

  /**
   * Escape CSV value (handle quotes, delimiters, newlines)
   */
  private static escapeCsvValue(value: string | number | null, delimiter: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // Check if value needs quoting
    if (
      stringValue.includes(delimiter) ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Format value for CSV output
   */
  private static formatCsvValue(value: any): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    return value;
  }

  /**
   * Build custom header row
   */
  private static buildHeaderRow(headerRow: ExportRowDefinition, delimiter: string): string {
    const maxColumn = Math.max(...headerRow.cells.map((c) => c.column));
    const values: string[] = new Array(maxColumn).fill('');

    headerRow.cells.forEach((cell) => {
      values[cell.column - 1] = this.escapeCsvValue(cell.value, delimiter);
    });

    return values.join(delimiter);
  }

  /**
   * Build custom footer row (with totals)
   */
  private static buildFooterRow(
    footerRow: ExportRowDefinition,
    mappedData: MappedRow[],
    delimiter: string
  ): string {
    const maxColumn = Math.max(...footerRow.cells.map((c) => c.column));
    const values: string[] = new Array(maxColumn).fill('');

    footerRow.cells.forEach((cell) => {
      let value = cell.value;

      // Support simple SUM() expressions in footer
      if (value.startsWith('SUM(') && value.endsWith(')')) {
        const columnName = value.slice(4, -1);
        const sum = mappedData.reduce((total, row) => {
          const cellValue = row[columnName];
          return total + (typeof cellValue === 'number' ? cellValue : 0);
        }, 0);
        value = String(sum);
      }

      values[cell.column - 1] = this.escapeCsvValue(value, delimiter);
    });

    return values.join(delimiter);
  }

  // ========================================
  // Excel Generation
  // ========================================

  /**
   * Generate Excel file
   */
  private static generateExcel(
    mappedData: MappedRow[],
    template: ExportTemplateStructure,
    options: ExportFileOptions
  ): ExportFileResult {
    const workbook = XLSX.utils.book_new();
    const sheetName = options.metadata?.excel?.sheetName || 'Export';

    // Prepare data array for Excel
    const excelData: any[][] = [];

    // Add custom header rows
    if (template.headers && template.headers.length > 0) {
      template.headers.forEach((headerRow) => {
        const row = this.buildExcelHeaderRow(headerRow);
        excelData.push(row);
      });
    }

    // Add column headers
    const columnHeaders = template.columns
      .sort((a, b) => a.position - b.position)
      .map((col) => col.name);
    excelData.push(columnHeaders);

    // Add data rows
    mappedData.forEach((row) => {
      const excelRow = template.columns
        .sort((a, b) => a.position - b.position)
        .map((col) => row[col.name] ?? '');
      excelData.push(excelRow);
    });

    // Add custom footer rows
    if (template.footers && template.footers.length > 0) {
      template.footers.forEach((footerRow) => {
        const row = this.buildExcelFooterRow(footerRow, mappedData);
        excelData.push(row);
      });
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Apply column widths
    const columnWidths = template.columns.map((col) => ({
      wch: col.width || 15, // Default width: 15 characters
    }));
    worksheet['!cols'] = columnWidths;

    // Apply freeze panes (freeze header row)
    const startRow = options.metadata?.excel?.startRow || 1;
    if (options.metadata?.excel?.freezePanes) {
      worksheet['!freeze'] = {
        xSplit: options.metadata.excel.freezePanes.col,
        ySplit: options.metadata.excel.freezePanes.row,
      };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      filename: options.filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: buffer,
      size: buffer.length,
    };
  }

  /**
   * Build Excel header row
   */
  private static buildExcelHeaderRow(headerRow: ExportRowDefinition): any[] {
    const maxColumn = Math.max(...headerRow.cells.map((c) => c.column));
    const values: any[] = new Array(maxColumn).fill('');

    headerRow.cells.forEach((cell) => {
      values[cell.column - 1] = cell.value;
    });

    return values;
  }

  /**
   * Build Excel footer row with formulas
   */
  private static buildExcelFooterRow(
    footerRow: ExportRowDefinition,
    mappedData: MappedRow[]
  ): any[] {
    const maxColumn = Math.max(...footerRow.cells.map((c) => c.column));
    const values: any[] = new Array(maxColumn).fill('');

    footerRow.cells.forEach((cell) => {
      let value = cell.value;

      // Support SUM() expressions
      if (value.startsWith('SUM(') && value.endsWith(')')) {
        const columnName = value.slice(4, -1);
        const sum = mappedData.reduce((total, row) => {
          const cellValue = row[columnName];
          return total + (typeof cellValue === 'number' ? cellValue : 0);
        }, 0);
        value = String(sum);
      }

      values[cell.column - 1] = value;
    });

    return values;
  }

  // ========================================
  // XML Generation
  // ========================================

  /**
   * Generate XML file
   */
  private static generateXML(
    mappedData: MappedRow[],
    template: ExportTemplateStructure,
    options: ExportFileOptions
  ): ExportFileResult {
    const rootElement = options.metadata?.xml?.rootElement || 'export';
    const recordElement = options.metadata?.xml?.recordElement || 'record';
    const namespace = options.metadata?.xml?.namespace;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

    // Add root element with optional namespace
    if (namespace) {
      xml += `<${rootElement} xmlns="${namespace}">\n`;
    } else {
      xml += `<${rootElement}>\n`;
    }

    // Add records
    mappedData.forEach((row) => {
      xml += `  <${recordElement}>\n`;

      template.columns
        .sort((a, b) => a.position - b.position)
        .forEach((col) => {
          const value = row[col.name];
          const elementName = this.toXmlElementName(col.name);
          const escapedValue = this.escapeXml(String(value ?? ''));
          xml += `    <${elementName}>${escapedValue}</${elementName}>\n`;
        });

      xml += `  </${recordElement}>\n`;
    });

    xml += `</${rootElement}>\n`;

    return {
      filename: options.filename,
      mimeType: 'application/xml',
      content: xml,
      size: Buffer.byteLength(xml, 'utf-8'),
    };
  }

  /**
   * Convert column name to valid XML element name
   */
  private static toXmlElementName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .toLowerCase();
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
