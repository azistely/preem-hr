/**
 * Salary Component Metadata Builder Utilities
 *
 * Converts user-friendly form inputs into country-specific metadata
 * Hides complexity from low-digital-literacy users
 */

import type {
  ComponentMetadata,
  CIComponentMetadata,
  BFComponentMetadata,
  SNComponentMetadata,
  GenericComponentMetadata,
  MetadataBuilderOptions,
  MetadataValidationResult,
} from '@/features/employees/types/salary-components';

// ============================================================================
// Côte d'Ivoire (CI) - Metadata Builder
// ============================================================================

export interface CIMetadataFormInputs {
  isTaxable: boolean;
  includeInBrutImposable?: boolean;
  includeInSalaireCategoriel?: boolean;
  exemptionCap?: number;
  includeInCnpsBase?: boolean;
  calculationType?: 'fixed' | 'percentage' | 'auto-calculated';
  rate?: number;
  cap?: number;
}

export function buildCIMetadata(inputs: CIMetadataFormInputs): CIComponentMetadata {
  const metadata: CIComponentMetadata = {
    taxTreatment: {
      isTaxable: inputs.isTaxable,
      includeInBrutImposable: inputs.includeInBrutImposable ?? inputs.isTaxable,
      includeInSalaireCategoriel: inputs.includeInSalaireCategoriel ?? inputs.isTaxable,
    },
  };

  // Add exemption cap if specified (e.g., transport exempt up to 30k)
  if (inputs.exemptionCap && inputs.exemptionCap > 0) {
    metadata.taxTreatment.exemptionCap = inputs.exemptionCap;
  }

  // Add social security treatment
  if (inputs.includeInCnpsBase !== undefined) {
    metadata.socialSecurityTreatment = {
      includeInCnpsBase: inputs.includeInCnpsBase,
    };
  }

  // Add calculation rule (for seniority, percentage-based components)
  if (inputs.calculationType) {
    metadata.calculationRule = {
      type: inputs.calculationType,
      rate: inputs.rate,
      cap: inputs.cap,
    };
  }

  return metadata;
}

// ============================================================================
// Burkina Faso (BF) - Metadata Builder
// ============================================================================

export interface BFMetadataFormInputs {
  exemptionType: 'none' | 'percentage' | 'fixed';
  exemptionRate?: number; // e.g., 0.20 for 20% exempt
  exemptionCap?: number;
  taxableBase?: 'gross' | 'net' | 'custom';
  includeInCnss?: boolean;
}

export function buildBFMetadata(inputs: BFMetadataFormInputs): BFComponentMetadata {
  const metadata: BFComponentMetadata = {
    taxTreatment: {
      exemptionType: inputs.exemptionType,
      taxableBase: inputs.taxableBase || 'gross',
    },
  };

  if (inputs.exemptionRate !== undefined) {
    metadata.taxTreatment.exemptionRate = inputs.exemptionRate;
  }

  if (inputs.exemptionCap !== undefined) {
    metadata.taxTreatment.exemptionCap = inputs.exemptionCap;
  }

  if (inputs.includeInCnss !== undefined) {
    metadata.socialSecurityTreatment = {
      includeInCnss: inputs.includeInCnss,
    };
  }

  return metadata;
}

// ============================================================================
// Senegal (SN) - Metadata Builder
// ============================================================================

export interface SNMetadataFormInputs {
  includedInGross: boolean;
  subjectToStandardDeduction?: boolean; // 30% standard deduction
  exemptionType?: 'total' | 'partial' | 'none';
  includeInIpres?: boolean;
  includeInIpm?: boolean;
}

export function buildSNMetadata(inputs: SNMetadataFormInputs): SNComponentMetadata {
  const metadata: SNComponentMetadata = {
    taxTreatment: {
      includedInGross: inputs.includedInGross,
      subjectToStandardDeduction: inputs.subjectToStandardDeduction ?? true,
    },
  };

  if (inputs.exemptionType) {
    metadata.taxTreatment.exemptionType = inputs.exemptionType;
  }

  if (inputs.includeInIpres !== undefined || inputs.includeInIpm !== undefined) {
    metadata.socialSecurityTreatment = {
      includeInIpres: inputs.includeInIpres ?? false,
      includeInIpm: inputs.includeInIpm ?? false,
    };
  }

  return metadata;
}

// ============================================================================
// Generic Metadata Builder (Other Countries)
// ============================================================================

export interface GenericMetadataFormInputs {
  isTaxable: boolean;
  exemptionRule?: string;
  includedInSocialSecurityBase?: boolean;
  calculationType?: 'fixed' | 'percentage' | 'auto-calculated';
  calculationValue?: number;
}

export function buildGenericMetadata(inputs: GenericMetadataFormInputs): GenericComponentMetadata {
  const metadata: GenericComponentMetadata = {
    taxTreatment: {
      isTaxable: inputs.isTaxable,
    },
  };

  if (inputs.exemptionRule) {
    metadata.taxTreatment.exemptionRule = inputs.exemptionRule;
  }

  if (inputs.includedInSocialSecurityBase !== undefined) {
    metadata.socialSecurityTreatment = {
      includedInBase: inputs.includedInSocialSecurityBase,
    };
  }

  if (inputs.calculationType) {
    metadata.calculationRule = {
      type: inputs.calculationType,
      value: inputs.calculationValue,
    };
  }

  return metadata;
}

// ============================================================================
// Smart Metadata Builder (Country-Aware)
// ============================================================================

export function buildMetadata(options: MetadataBuilderOptions): ComponentMetadata {
  const { countryCode, userInputs } = options;

  switch (countryCode) {
    case 'CI':
      return buildCIMetadata(userInputs as unknown as CIMetadataFormInputs);
    case 'BF':
      return buildBFMetadata(userInputs as unknown as BFMetadataFormInputs);
    case 'SN':
      return buildSNMetadata(userInputs as unknown as SNMetadataFormInputs);
    default:
      return buildGenericMetadata(userInputs as unknown as GenericMetadataFormInputs);
  }
}

// ============================================================================
// Metadata Validation
// ============================================================================

export function validateCIMetadata(metadata: CIComponentMetadata): MetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation: If includeInSalaireCategoriel is true, must be in BrutImposable too
  if (
    metadata.taxTreatment.includeInSalaireCategoriel &&
    !metadata.taxTreatment.includeInBrutImposable
  ) {
    errors.push('Si le composant est dans le Salaire Catégoriel, il doit aussi être dans le Brut Imposable');
  }

  // Warning: If not taxable, check if exemption cap makes sense
  if (!metadata.taxTreatment.isTaxable && metadata.taxTreatment.exemptionCap) {
    warnings.push('Un composant non imposable n\'a pas besoin d\'un plafond d\'exonération');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateBFMetadata(metadata: BFComponentMetadata): MetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation: If exemptionType is percentage, rate must be provided
  if (metadata.taxTreatment.exemptionType === 'percentage' && !metadata.taxTreatment.exemptionRate) {
    errors.push('Le taux d\'exonération est requis pour le type "pourcentage"');
  }

  // Validation: Exemption rate must be between 0 and 1
  if (
    metadata.taxTreatment.exemptionRate !== undefined &&
    (metadata.taxTreatment.exemptionRate < 0 || metadata.taxTreatment.exemptionRate > 1)
  ) {
    errors.push('Le taux d\'exonération doit être entre 0 et 1');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateSNMetadata(metadata: SNComponentMetadata): MetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Warning: If not included in gross, standard deduction won't apply
  if (
    !metadata.taxTreatment.includedInGross &&
    metadata.taxTreatment.subjectToStandardDeduction
  ) {
    warnings.push('La déduction standard ne s\'applique qu\'aux éléments inclus dans le brut');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateMetadata(
  countryCode: string,
  metadata: ComponentMetadata
): MetadataValidationResult {
  switch (countryCode) {
    case 'CI':
      return validateCIMetadata(metadata as CIComponentMetadata);
    case 'BF':
      return validateBFMetadata(metadata as BFComponentMetadata);
    case 'SN':
      return validateSNMetadata(metadata as SNComponentMetadata);
    default:
      return { isValid: true }; // Generic metadata has no strict validation
  }
}

// ============================================================================
// Smart Defaults for Common Component Types
// ============================================================================

/**
 * @deprecated Use getComponentMetadata() from component-loader.ts instead
 *
 * This function is deprecated as part of the single source of truth migration.
 * All component metadata should now be loaded from the database.
 *
 * Migration guide:
 * ```typescript
 * // BEFORE (hardcoded)
 * const metadata = getSmartDefaults('CI', 'transport');
 *
 * // AFTER (database-driven)
 * import { getComponentMetadata } from '@/lib/salary-components/component-loader';
 * const component = await getComponentMetadata('CI', 'TPT_TRANSPORT_CI');
 * const metadata = component.metadata;
 * ```
 *
 * This function is kept temporarily for backward compatibility but will be removed in a future update.
 * New code should NOT use this function.
 */
export function getSmartDefaults(
  countryCode: string,
  componentType: 'transport' | 'phone' | 'meal' | 'housing' | 'seniority' | 'bonus'
): ComponentMetadata {
  console.warn(
    `getSmartDefaults() is deprecated. Use getComponentMetadata() from component-loader.ts instead. ` +
      `Called with: countryCode=${countryCode}, componentType=${componentType}`
  );

  if (countryCode === 'CI') {
    switch (componentType) {
      case 'transport':
        return buildCIMetadata({
          isTaxable: false, // Transport is NOT taxable per Code du Travail Art. 31
          includeInBrutImposable: false, // NOT included in taxable gross
          includeInSalaireCategoriel: false,
          exemptionCap: 30000, // Exemption cap for city-based transport allowances
          includeInCnpsBase: false,
        });

      case 'phone':
        return buildCIMetadata({
          isTaxable: true,
          includeInBrutImposable: true,
          includeInSalaireCategoriel: false,
          includeInCnpsBase: false,
        });

      case 'meal':
        return buildCIMetadata({
          isTaxable: true,
          includeInBrutImposable: true,
          includeInSalaireCategoriel: false,
          includeInCnpsBase: false,
        });

      case 'housing':
        return buildCIMetadata({
          isTaxable: true,
          includeInBrutImposable: true,
          includeInSalaireCategoriel: true,
          includeInCnpsBase: true,
        });

      case 'seniority':
        return buildCIMetadata({
          isTaxable: true,
          includeInBrutImposable: true,
          includeInSalaireCategoriel: true,
          includeInCnpsBase: true,
          calculationType: 'auto-calculated',
          rate: 0.02, // 2% per year
          cap: 0.25, // Max 25%
        });

      case 'bonus':
        return buildCIMetadata({
          isTaxable: true,
          includeInBrutImposable: true,
          includeInSalaireCategoriel: false,
          includeInCnpsBase: false,
        });
    }
  }

  // Default to generic metadata for other countries
  return buildGenericMetadata({
    isTaxable: true,
    includedInSocialSecurityBase: false,
  });
}
