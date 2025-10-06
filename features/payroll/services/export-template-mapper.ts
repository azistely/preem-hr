/**
 * ExportTemplateMapper Service
 *
 * Maps payroll data to export template columns dynamically.
 * Resolves field paths, applies transformations, and validates data.
 *
 * Source: docs/05-EPIC-PAYROLL.md Multi-Country Architecture Phase 1
 */

import type {
  ExportColumnDefinition,
  ExportTemplateStructure,
} from '@/lib/db/schema/export-templates';

// ========================================
// Types
// ========================================

/**
 * Payroll data context for template mapping
 */
export interface PayrollDataContext {
  // Row metadata
  rowNumber: number;

  // Company data
  company: {
    name: string;
    taxId?: string;
    cnpsNumber?: string;
    bankAccount?: string;
    code?: string;
  };

  // Employee data
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email?: string;
    cnpsNumber?: string;
    cssNumber?: string;
    taxNumber?: string;
    bankName?: string;
    bankAccount?: string;
    socialSecurityNumber?: string; // Generic social security number field
  };

  // Payroll calculation results
  payroll: {
    period: string; // YYYY-MM or YYYYMM format
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    reference: string;

    // Salary components
    baseSalary: number;
    grossSalary: number;
    netSalary: number;

    // Allowances
    housingAllowance?: number;
    transportAllowance?: number;
    mealAllowance?: number;
    totalAllowances?: number;

    // Tax
    taxableIncome: number;
    incomeTax: number; // ITS, IGR, etc.

    // Social security employee
    cnpsEmployee?: number;
    cssEmployee?: number;
    cmuEmployee?: number;

    // Social security employer
    cnpsEmployer?: number;
    cssEmployer?: number;
    cmuEmployer?: number;

    // Other contributions
    fdfp?: number; // Formation professionnelle (CI)
    threeFPT?: number; // 3FPT (SN)

    // Totals
    totalDeductions: number;
    totalEmployerCost: number;
  };

  // Calculated fields (generated on demand)
  calculated: {
    [key: string]: number | string;
  };
}

/**
 * Mapped row result
 */
export interface MappedRow {
  [columnName: string]: string | number | boolean | null;
}

// ========================================
// ExportTemplateMapper Class
// ========================================

export class ExportTemplateMapper {
  /**
   * Map payroll data array to template structure
   */
  static mapData(
    payrollData: PayrollDataContext[],
    template: ExportTemplateStructure
  ): MappedRow[] {
    return payrollData.map((context) => this.mapRow(context, template.columns));
  }

  /**
   * Map a single payroll context to a row
   */
  static mapRow(
    context: PayrollDataContext,
    columns: ExportColumnDefinition[]
  ): MappedRow {
    const row: MappedRow = {};

    for (const column of columns) {
      const value = this.resolveFieldValue(context, column);
      row[column.name] = value;
    }

    return row;
  }

  /**
   * Resolve field value from context using dot notation path
   */
  private static resolveFieldValue(
    context: PayrollDataContext,
    column: ExportColumnDefinition
  ): string | number | boolean | null {
    // Handle special source fields
    if (column.sourceField === 'row_number') {
      return context.rowNumber;
    }

    if (column.sourceField === 'constant' && column.defaultValue !== undefined) {
      return column.defaultValue;
    }

    // Resolve nested field path (e.g., "employee.full_name" -> context.employee.fullName)
    const value = this.getNestedValue(context, column.sourceField);

    // Apply default value if field is empty
    if (value === null || value === undefined) {
      if (column.defaultValue !== undefined) {
        return column.defaultValue;
      }
      if (column.required) {
        throw new Error(
          `Required field "${column.sourceField}" is missing for column "${column.name}"`
        );
      }
      return null;
    }

    // Apply transformations
    const transformed = this.applyTransformation(value, column);

    // Format the value
    return this.formatValue(transformed, column);
  }

  /**
   * Get nested value from object using dot notation
   * Example: "employee.full_name" -> context.employee.fullName
   */
  private static getNestedValue(obj: any, path: string): any {
    // Convert snake_case to camelCase for field names
    const parts = path.split('.').map((part) => this.toCamelCase(part));

    return parts.reduce((current, key) => {
      if (current === null || current === undefined) {
        return null;
      }
      return current[key];
    }, obj);
  }

  /**
   * Convert snake_case to camelCase
   */
  private static toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Apply text transformations
   */
  private static applyTransformation(
    value: any,
    column: ExportColumnDefinition
  ): any {
    if (typeof value !== 'string' || !column.transform) {
      return value;
    }

    switch (column.transform) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case 'trim':
        return value.trim();
      default:
        return value;
    }
  }

  /**
   * Format value according to column data type
   */
  private static formatValue(
    value: any,
    column: ExportColumnDefinition
  ): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    switch (column.dataType) {
      case 'string':
        return String(value);

      case 'integer':
        return parseInt(String(value), 10);

      case 'decimal':
      case 'currency':
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (column.format) {
          return this.formatNumber(num, column.format);
        }
        return num;

      case 'date':
        const date = value instanceof Date ? value : new Date(value);
        if (column.format) {
          return this.formatDate(date, column.format);
        }
        return date.toISOString().split('T')[0]; // Default: YYYY-MM-DD

      case 'boolean':
        return Boolean(value);

      default:
        return value;
    }
  }

  /**
   * Format number according to format string
   * Examples: "0" -> integer, "0.00" -> 2 decimals, "0,000.00" -> with thousands separator
   */
  private static formatNumber(num: number, format: string): string {
    const decimals = (format.split('.')[1] || '').length;
    const withSeparator = format.includes(',');

    let result = num.toFixed(decimals);

    if (withSeparator) {
      const parts = result.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      result = parts.join('.');
    }

    return result;
  }

  /**
   * Format date according to format string
   * Supports: YYYY, MM, DD, YYYYMM, YYYY-MM-DD, DD/MM/YYYY, etc.
   */
  private static formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }

  /**
   * Validate column value against validation rules
   */
  static validateValue(
    value: any,
    column: ExportColumnDefinition
  ): { valid: boolean; error?: string } {
    // Required check
    if (column.required && (value === null || value === undefined || value === '')) {
      return {
        valid: false,
        error: `Column "${column.name}" is required but has no value`,
      };
    }

    // Regex validation
    if (column.validation && typeof value === 'string') {
      const regex = new RegExp(column.validation.replace('regex:', ''));
      if (!regex.test(value)) {
        return {
          valid: false,
          error: `Column "${column.name}" does not match required format`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate all rows against template
   */
  static validateData(
    mappedData: MappedRow[],
    columns: ExportColumnDefinition[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    mappedData.forEach((row, index) => {
      columns.forEach((column) => {
        const validation = this.validateValue(row[column.name], column);
        if (!validation.valid) {
          errors.push(`Row ${index + 1}: ${validation.error}`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate filename from pattern
   * Supports variables: {YYYY}, {MM}, {YYYYMM}, {company_code}, {company_name}, etc.
   */
  static generateFilename(
    pattern: string,
    context: {
      date: Date;
      companyCode?: string;
      companyName?: string;
      runNumber?: string;
    }
  ): string {
    const year = context.date.getFullYear();
    const month = String(context.date.getMonth() + 1).padStart(2, '0');

    return pattern
      .replace('{YYYY}', String(year))
      .replace('{MM}', month)
      .replace('{YYYYMM}', `${year}${month}`)
      .replace('{company_code}', context.companyCode || '')
      .replace('{company_name}', context.companyName || '')
      .replace('{run_number}', context.runNumber || '')
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  }
}
