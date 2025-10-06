/**
 * Payroll Export Factory
 *
 * Factory pattern for creating country-specific payroll exporters.
 * Implements multi-country export strategy.
 *
 * Source: docs/05-EPIC-PAYROLL.md GAP 4
 */

import { ruleLoader, type CountryConfig } from './rule-loader';

// ========================================
// Export Types
// ========================================

export interface ExportResult {
  data: string; // Base64 encoded file data
  filename: string;
  contentType: string;
  metadata?: {
    employeeCount: number;
    totalAmount: number;
    period: string;
  };
}

export interface PayrollRunExportData {
  runId: string;
  countryCode: string;
  companyName: string;
  companyTaxId?: string;
  companySocialSecurityNumber?: string;
  periodStart: Date;
  periodEnd: Date;
  employees: EmployeePayrollData[];
}

export interface EmployeePayrollData {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  socialSecurityNumber?: string;
  position?: string;
  grossSalary: number;
  baseSalary: number;
  allowances: number;
  deductions: DeductionBreakdown;
  netSalary: number;
}

export interface DeductionBreakdown {
  socialSecurity: SocialSecurityDeduction[];
  tax: TaxDeduction[];
  other: OtherDeduction[];
}

export interface SocialSecurityDeduction {
  code: string;
  name: string;
  employeeAmount: number;
  employerAmount: number;
  base: number;
}

export interface TaxDeduction {
  code: string;
  name: string;
  amount: number;
  taxableIncome: number;
}

export interface OtherDeduction {
  code: string;
  name: string;
  amount: number;
  paidBy: 'employee' | 'employer';
}

// ========================================
// Exporter Interface
// ========================================

export interface IPayrollExporter {
  /**
   * Export social security declaration
   * (CNPS for CI, CSS for SN, CNSS for BF, etc.)
   */
  exportSocialSecurity(data: PayrollRunExportData): Promise<ExportResult>;

  /**
   * Export tax declaration
   * (État 301 for CI, CFCE for SN, etc.)
   */
  exportTaxDeclaration(data: PayrollRunExportData): Promise<ExportResult>;

  /**
   * Export health insurance declaration (optional)
   * (CMU for CI, IPM for SN, etc.)
   */
  exportHealthInsurance?(data: PayrollRunExportData): Promise<ExportResult>;

  /**
   * Export training tax declaration (optional)
   * (FDFP for CI, 3FPT for SN, etc.)
   */
  exportTrainingTax?(data: PayrollRunExportData): Promise<ExportResult>;

  /**
   * Export bank transfer file
   * (Standard format for all countries)
   */
  exportBankTransfer(data: PayrollRunExportData): Promise<ExportResult>;

  /**
   * Get available export types for this country
   */
  getAvailableExports(): ExportType[];
}

export interface ExportType {
  code: string;
  name: string;
  description: string;
  icon: string;
  format: 'xlsx' | 'csv' | 'txt' | 'pdf';
}

// ========================================
// Base Exporter (Common Logic)
// ========================================

export abstract class BasePayrollExporter implements IPayrollExporter {
  protected config: CountryConfig | null = null;

  constructor(protected countryCode: string) {}

  /**
   * Load country configuration
   */
  protected async loadConfig(effectiveDate: Date): Promise<CountryConfig> {
    if (!this.config) {
      this.config = await ruleLoader.getCountryConfig(this.countryCode, effectiveDate);
    }
    return this.config;
  }

  /**
   * Format currency for export
   */
  protected formatCurrency(amount: number): number {
    return Math.round(amount);
  }

  /**
   * Format date for display
   */
  protected formatDate(date: Date, format: 'long' | 'short' = 'long'): string {
    const options: Intl.DateTimeFormatOptions = format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' };

    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  protected arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  // Abstract methods to be implemented by country-specific exporters
  abstract exportSocialSecurity(data: PayrollRunExportData): Promise<ExportResult>;
  abstract exportTaxDeclaration(data: PayrollRunExportData): Promise<ExportResult>;
  abstract exportBankTransfer(data: PayrollRunExportData): Promise<ExportResult>;
  abstract getAvailableExports(): ExportType[];
}

// ========================================
// Export Factory
// ========================================

export class PayrollExportFactory {
  /**
   * Get country-specific exporter
   */
  static getExporter(countryCode: string): IPayrollExporter {
    switch (countryCode.toUpperCase()) {
      case 'CI':
        // Import dynamically to avoid circular dependencies
        const CIExporter = require('./exporters/ci-exporter').CIPayrollExporter;
        return new CIExporter();

      case 'SN':
        // Import dynamically (to be implemented)
        const SNExporter = require('./exporters/sn-exporter').SNPayrollExporter;
        return new SNExporter();

      case 'BF':
        // Import dynamically (to be implemented)
        const BFExporter = require('./exporters/bf-exporter').BFPayrollExporter;
        return new BFExporter();

      default:
        throw new Error(
          `No payroll exporter available for country: ${countryCode}. ` +
          `Supported countries: CI, SN, BF`
        );
    }
  }

  /**
   * Get available exports for a country
   */
  static async getAvailableExports(countryCode: string): Promise<ExportType[]> {
    const exporter = this.getExporter(countryCode);
    return exporter.getAvailableExports();
  }

  /**
   * Export social security for any country
   */
  static async exportSocialSecurity(data: PayrollRunExportData): Promise<ExportResult> {
    const exporter = this.getExporter(data.countryCode);
    return exporter.exportSocialSecurity(data);
  }

  /**
   * Export tax declaration for any country
   */
  static async exportTaxDeclaration(data: PayrollRunExportData): Promise<ExportResult> {
    const exporter = this.getExporter(data.countryCode);
    return exporter.exportTaxDeclaration(data);
  }

  /**
   * Export health insurance for any country (if supported)
   */
  static async exportHealthInsurance(data: PayrollRunExportData): Promise<ExportResult> {
    const exporter = this.getExporter(data.countryCode);

    if (!exporter.exportHealthInsurance) {
      throw new Error(
        `Health insurance export not supported for country: ${data.countryCode}`
      );
    }

    return exporter.exportHealthInsurance(data);
  }

  /**
   * Export training tax for any country (if supported)
   */
  static async exportTrainingTax(data: PayrollRunExportData): Promise<ExportResult> {
    const exporter = this.getExporter(data.countryCode);

    if (!exporter.exportTrainingTax) {
      throw new Error(
        `Training tax export not supported for country: ${data.countryCode}`
      );
    }

    return exporter.exportTrainingTax(data);
  }

  /**
   * Export bank transfer for any country
   */
  static async exportBankTransfer(data: PayrollRunExportData): Promise<ExportResult> {
    const exporter = this.getExporter(data.countryCode);
    return exporter.exportBankTransfer(data);
  }
}
