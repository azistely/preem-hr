/**
 * Salary Components Type Definitions
 *
 * Multi-country salary component system with flexible metadata
 * Supports CI, BF, SN, and other West African countries
 */

// ============================================================================
// Base Types
// ============================================================================

export interface SalaryComponentDefinition {
  id: string;
  countryCode: string;
  code: string;
  name: Record<string, string>; // { fr: "Salaire de base" }
  category: 'base' | 'allowance' | 'bonus' | 'deduction' | 'benefit';
  componentType?: 'fixed' | 'percentage' | 'calculated';
  metadata: ComponentMetadata;
  isCommon: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryComponentTemplate {
  id: string;
  countryCode: string;
  code: string;
  name: Record<string, string>;
  description?: string;
  category: 'allowance' | 'bonus' | 'deduction' | 'benefit';
  metadata: ComponentMetadata;
  suggestedAmount?: number;
  isPopular: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectorConfiguration {
  id: string;
  countryCode: string;
  sectorCode: string;
  name: Record<string, string>;
  workAccidentRate: number;
  defaultComponents: Record<string, unknown>;
  smartDefaults: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSalaryComponent {
  id: string;
  tenantId?: string;
  countryCode?: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  templateCode?: string;
  metadata: ComponentMetadata;
  complianceLevel?: string; // locked | configurable | freeform
  customizableFields?: string[]; // ["calculationRule.rate"]
  canModify?: boolean;
  canDeactivate?: boolean;
  legalReference?: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ============================================================================
// Component Instance (on employee_salaries)
// ============================================================================

export interface SalaryComponentInstance {
  code: string;
  name: string;
  amount: number;
  metadata?: ComponentMetadata;
  sourceType: 'standard' | 'custom' | 'template';
  sourceId?: string;
}

// ============================================================================
// Metadata Types (Country-Specific)
// ============================================================================

// Common calculation rule type used across all metadata variants
export interface CalculationRule {
  type: 'fixed' | 'percentage' | 'auto-calculated';
  baseAmount?: number;
  rate?: number;
  cap?: number;
  value?: number;
}

export type ComponentMetadata =
  | CIComponentMetadata
  | BFComponentMetadata
  | SNComponentMetadata
  | GenericComponentMetadata;

// Côte d'Ivoire (CI) - Three calculation bases
export interface CIComponentMetadata {
  taxTreatment: {
    isTaxable: boolean;
    includeInBrutImposable: boolean;
    includeInSalaireCategoriel: boolean;
    exemptionCap?: number; // e.g., transport exempt up to 30,000 FCFA
  };
  socialSecurityTreatment?: {
    includeInCnpsBase: boolean;
  };
  calculationRule?: CalculationRule;
}

// Burkina Faso (BF) - Percentage-based exemptions
export interface BFComponentMetadata {
  taxTreatment: {
    exemptionType: 'none' | 'percentage' | 'fixed';
    exemptionRate?: number; // e.g., 0.20 for 20% exempt
    exemptionCap?: number; // Maximum exempt amount
    taxableBase: 'gross' | 'net' | 'custom';
  };
  socialSecurityTreatment?: {
    includeInCnss: boolean;
  };
}

// Senegal (SN) - Standard deduction system
export interface SNComponentMetadata {
  taxTreatment: {
    includedInGross: boolean;
    subjectToStandardDeduction: boolean; // 30% standard deduction
    exemptionType?: 'total' | 'partial' | 'none';
  };
  socialSecurityTreatment?: {
    includeInIpres: boolean;
    includeInIpm: boolean;
  };
}

// Generic metadata for other countries or simple cases
export interface GenericComponentMetadata {
  taxTreatment: {
    isTaxable: boolean;
    exemptionRule?: string;
  };
  socialSecurityTreatment?: {
    includedInBase: boolean;
  };
  calculationRule?: CalculationRule;
}

// ============================================================================
// Metadata Builder Helpers
// ============================================================================

export interface MetadataBuilderOptions {
  countryCode: string;
  category: string;
  userInputs: Record<string, unknown>;
}

export interface MetadataValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// Request/Response Types for tRPC
// ============================================================================

export interface GetStandardComponentsInput {
  countryCode: string;
  category?: 'base' | 'allowance' | 'bonus' | 'deduction' | 'benefit';
}

export interface GetComponentTemplatesInput {
  countryCode: string;
  popularOnly?: boolean;
}

export interface GetSectorConfigurationsInput {
  countryCode: string;
}

export interface CreateCustomComponentInput {
  countryCode: string;
  name: string;
  description?: string;
  category: 'allowance' | 'bonus' | 'deduction' | 'benefit';
  metadata: ComponentMetadata;
  templateCode?: string;
}

export interface AddFromTemplateInput {
  templateCode: string;
  customizations?: {
    name?: string;
    amount?: number;
    metadata?: Partial<ComponentMetadata>;
  };
}

export interface AssignComponentToEmployeeInput {
  employeeId: string;
  componentCode: string;
  amount: number;
  effectiveDate: Date;
  sourceType: 'standard' | 'custom' | 'template';
  sourceId?: string;
}

// ============================================================================
// Auto-Enable Rules (for smart suggestions)
// ============================================================================

export interface AutoEnableRule {
  componentCode: string;
  condition: {
    type: 'seniority' | 'position' | 'salary_threshold' | 'sector';
    value: unknown;
  };
  suggestedAmount?: number | ((employee: unknown) => number);
  notificationMessage: Record<string, string>; // { fr: "Éligible à..." }
}

// ============================================================================
// Display Helpers
// ============================================================================

export interface ComponentDisplayInfo {
  code: string;
  name: string;
  category: string;
  amount: number;
  isTaxable: boolean;
  badge?: 'auto' | 'custom' | 'standard';
  description?: string;
}

export interface ComponentGrouping {
  category: string;
  label: Record<string, string>;
  components: ComponentDisplayInfo[];
  totalAmount: number;
}
