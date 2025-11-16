/**
 * Type definitions for historical payroll import
 */

/**
 * Raw row from Excel sheet (French column names)
 */
export interface PayrollImportRow {
  // Run-level fields (repeated on each row)
  numero_paie: string;
  periode_debut: string | Date;
  periode_fin: string | Date;
  date_paiement: string | Date;
  frequence_paiement: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
  nom_paie?: string;
  description_paie?: string;
  code_pays: string;
  sequence_cloture?: number;

  // Line item fields
  matricule: string; // employee number
  nom_employe?: string;
  numero_employe?: string;
  titre_poste?: string;

  // Salary & allowances
  salaire_base: number;
  logement?: number;
  transport?: number;
  repas?: number;
  autres_allocations?: number;

  // Time tracking
  jours_travailles: number;
  jours_absents?: number;
  heures_travaillees?: number;
  heures_supp_25?: number;
  heures_supp_50?: number;
  heures_supp_75?: number;
  heures_supp_100?: number;
  paiement_heures_supp?: number;
  primes?: number;

  // Earnings
  salaire_brut: number;
  brut_imposable?: number;

  // Employee deductions
  cnps_employe: number;
  cmu_employe?: number;
  its: number;
  autres_deductions?: string; // JSON string
  total_deductions: number;
  net_a_payer: number;

  // Employer contributions
  cnps_employeur: number;
  cmu_employeur?: number;
  autres_impots_employeur?: number;
  cout_total_employeur: number;

  // Payment details
  methode_paiement?: string;
  compte_bancaire?: string;
  reference_paiement?: string;
  notes?: string;
}

/**
 * Parsed line item ready for database
 */
export interface ParsedLineItem {
  employeeId: string; // UUID from lookup
  employeeNumber: string;
  employeeName?: string;
  positionTitle?: string;

  baseSalary: number;
  allowances: {
    housing?: number;
    transport?: number;
    meal?: number;
    other?: number;
  };

  daysWorked: number;
  daysAbsent: number;
  hoursWorked?: number;
  overtimeHours: {
    regular25?: number;
    regular50?: number;
    night75?: number;
    sunday100?: number;
  };
  overtimePay?: number;
  bonuses?: number;

  grossSalary: number;
  brutImposable?: number;

  cnpsEmployee: number;
  cmuEmployee?: number;
  its: number;
  otherDeductions: Record<string, number>;
  totalDeductions: number;
  netSalary: number;

  cnpsEmployer: number;
  cmuEmployer?: number;
  totalOtherTaxes?: number;
  totalEmployerCost: number;

  paymentMethod: string;
  bankAccount?: string;
  paymentReference?: string;
  notes?: string;
}

/**
 * Parsed payroll run with its line items
 */
export interface ParsedPayrollRun {
  runNumber: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  paymentFrequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
  name?: string;
  description?: string;
  countryCode: string;
  closureSequence?: number;

  lineItems: ParsedLineItem[];
}

/**
 * Validation warning
 */
export interface ImportWarning {
  row: number; // Excel row number (1-indexed)
  field?: string; // Field name that caused the warning
  type: 'missing_employee' | 'low_salary' | 'future_date' | 'missing_field' | 'invalid_value' | 'other';
  message: string;
  employeeNumber?: string;
}

/**
 * Validation error (blocks import)
 */
export interface ValidationError {
  type: 'missing_employees' | 'duplicate_run' | 'invalid_data';
  message: string;
  details?: string[];
}

/**
 * Parse result with warnings
 */
export interface ParseResult {
  runs: ParsedPayrollRun[];
  warnings: ImportWarning[];
  validationErrors: ValidationError[]; // Blocking errors
  summary: {
    totalRuns: number;
    totalEmployees: number;
    totalRows: number;
    warningCount: number;
    errorCount: number;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  runIds: string[]; // Created payroll run IDs
  employeeCount: number;
  message: string;
  errors?: string[];
}
