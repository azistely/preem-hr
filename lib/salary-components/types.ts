/**
 * Salary Component Processing Types
 *
 * Type definitions for database-driven component processing.
 * These types align with the standardized metadata schema.
 */

import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';

// ============================================================================
// Exemption Cap Types
// ============================================================================

export interface FixedExemptionCap {
  type: 'fixed';
  value: number; // Fixed amount (e.g., 30000 for 30,000 FCFA)
}

export interface PercentageExemptionCap {
  type: 'percentage';
  value: number; // Percentage as decimal (e.g., 0.10 for 10%)
  appliesTo: 'total_remuneration' | 'base_salary';
}

export interface CityBasedExemptionCap {
  type: 'city_based';
  cityTable: string; // Table name (e.g., 'city_transport_minimums')
  fallbackValue?: number; // Default value if city not found
}

export type ExemptionCap =
  | FixedExemptionCap
  | PercentageExemptionCap
  | CityBasedExemptionCap;

// ============================================================================
// Component Metadata (Database Schema)
// ============================================================================

export interface TaxTreatment {
  isTaxable: boolean;
  includeInBrutImposable: boolean;
  includeInSalaireCategoriel: boolean;
  exemptionCap?: ExemptionCap;
  exemptionNote?: string; // Human-readable explanation
}

export interface SocialSecurityTreatment {
  includeInCnpsBase: boolean;
  includeInIpresBase?: boolean; // For Senegal
  includeInCnssBase?: boolean; // For other countries
}

export interface AutoCalculate {
  formula?: string; // e.g., 'baseSalary * 0.02 * yearsOfService'
  maxRate?: number; // Maximum rate (e.g., 0.25 for 25%)
  dependencies?: string[]; // ['baseSalary', 'hireDate']
}

export interface ComponentMetadata {
  // Display & Description
  description?: string;
  isOptional?: boolean;
  defaultValue?: number;

  // Tax Treatment
  taxTreatment: TaxTreatment;

  // Social Security Treatment
  socialSecurityTreatment?: SocialSecurityTreatment;

  // Auto-Calculation (if applicable)
  autoCalculate?: AutoCalculate;
}

export interface ComponentDefinition {
  id: string;
  countryCode: string;
  code: string;
  name: Record<string, string>; // { fr: "...", en: "..." }
  category: string;
  componentType: string;
  isTaxable: boolean;
  isSubjectToSocialSecurity: boolean;
  calculationMethod?: string;
  defaultValue?: string | null;
  displayOrder: number;
  isCommon: boolean;
  metadata?: ComponentMetadata;
  createdAt: Date;
  updatedAt: Date;
  cachedAt?: number; // For cache invalidation
}

// ============================================================================
// Processing Context
// ============================================================================

export interface ComponentProcessingContext {
  // Salary context
  totalRemuneration: number; // Sum of all components (for percentage caps)
  baseSalary: number; // Base salary (for percentage caps)

  // Location context
  countryCode: string; // 'CI', 'SN', 'BF', etc.
  city?: string; // 'Abidjan', 'Bouaké', etc.

  // Date context (for versioning)
  effectiveDate: Date; // Payroll period date

  // Tenant context (for tenant overrides)
  tenantId?: string; // For loading tenant-specific overrides

  // Employee context (for auto-calculation)
  hireDate?: Date; // For seniority calculation
  yearsOfService?: number; // Pre-calculated

  // Preview mode (for hiring flow before component activation)
  isPreview?: boolean; // If true, use safe defaults for unknown components

  // Payment frequency context (for transport validation and calculation)
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'; // For prorated transport amounts
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h'; // For hourly rate calculations
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'; // For CDDTI-specific rules
}

// ============================================================================
// Processing Results
// ============================================================================

export interface CapAppliedInfo {
  type: 'fixed' | 'percentage' | 'city_based';
  capValue: number;
  calculatedFrom?: string; // 'total_remuneration', 'city: Abidjan', etc.
  reason: string; // Human-readable explanation
}

export interface ProcessedComponent {
  // Original component
  code: string;
  name: string;
  originalAmount: number;

  // After cap enforcement
  exemptPortion: number; // Non-taxable portion
  taxablePortion: number; // Taxable portion

  // Treatment flags (from metadata)
  includeInBrutImposable: boolean;
  includeInSalaireCategoriel: boolean;
  includeInCnpsBase: boolean;
  includeInIpresBase: boolean;

  // Audit trail
  capApplied?: CapAppliedInfo;

  // Validation errors (if any)
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// City Transport Minimum (from database)
// ============================================================================

export interface CityTransportMinimum {
  id: string;
  countryCode: string;
  cityName: string;
  cityNameNormalized: string;
  displayName: Record<string, string>;
  monthlyMinimum: number;
  dailyRate: number;
  taxExemptionCap: number;
  effectiveFrom: Date;
  legalReference?: Record<string, string>;
}
