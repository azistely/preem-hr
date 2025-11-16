/**
 * Country-Specific Field Configuration
 *
 * Maps country codes to localized labels, placeholders, and validation rules
 * for company information fields.
 *
 * This enables the UI to adapt based on tenant.countryCode, showing
 * country-appropriate terminology (e.g., "CNPS" for CI, "IPRES" for SN).
 */

export interface CountryFieldConfig {
  // Social Security
  socialSecurityLabel: string;
  socialSecurityPlaceholder: string;
  socialSecurityRequired: boolean;

  // Tax ID
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdRequired: boolean;

  // Business Registration
  rccmLabel: string;
  rccmPlaceholder: string;
  rccmRequired: boolean;

  // Work Accident Rate
  workAccidentRateLabel: string;
  workAccidentRateRequired: boolean;

  // Collective Agreement
  collectiveAgreementLabel: string;
  collectiveAgreementPlaceholder: string;

  // Common fund names (pre-populated suggestions)
  commonFunds: Array<{
    name: string;
    type: "tax" | "social" | "insurance" | "mutual";
  }>;
}

/**
 * Country-specific configurations
 */
export const COUNTRY_FIELD_CONFIGS: Record<string, CountryFieldConfig> = {
  // Côte d'Ivoire
  CI: {
    socialSecurityLabel: "Numéro CNPS",
    socialSecurityPlaceholder: "Ex: 12345678",
    socialSecurityRequired: true,

    taxIdLabel: "Numéro de Compte Contribuable",
    taxIdPlaceholder: "Ex: CI202056789",
    taxIdRequired: true,

    rccmLabel: "Numéro RCCM",
    rccmPlaceholder: "Ex: CI-ABJ-2020-B-12345",
    rccmRequired: false,

    workAccidentRateLabel: "Taux d'Accident de Travail (%)",
    workAccidentRateRequired: true,

    collectiveAgreementLabel: "Convention Collective",
    collectiveAgreementPlaceholder: "Ex: Convention Collective Interprofessionnelle",

    commonFunds: [
      { name: "DGI (Direction Générale des Impôts)", type: "tax" },
      { name: "CNPS (Caisse Nationale de Prévoyance Sociale)", type: "social" },
      { name: "CMU (Couverture Maladie Universelle)", type: "insurance" },
    ],
  },

  // Sénégal
  SN: {
    socialSecurityLabel: "Numéro IPRES",
    socialSecurityPlaceholder: "Ex: SN-12345678",
    socialSecurityRequired: true,

    taxIdLabel: "NINEA",
    taxIdPlaceholder: "Ex: 123456789",
    taxIdRequired: true,

    rccmLabel: "Numéro RCCM",
    rccmPlaceholder: "Ex: SN-DKR-2020-B-12345",
    rccmRequired: false,

    workAccidentRateLabel: "Taux d'Accident de Travail (%)",
    workAccidentRateRequired: true,

    collectiveAgreementLabel: "Convention Collective",
    collectiveAgreementPlaceholder: "Ex: Convention Collective Interprofessionnelle",

    commonFunds: [
      { name: "DGID (Direction Générale des Impôts et Domaines)", type: "tax" },
      { name: "IPRES (Institution de Prévoyance Retraite du Sénégal)", type: "social" },
      { name: "CSS (Caisse de Sécurité Sociale)", type: "social" },
      { name: "IPM (Institutions de Prévoyance Maladie)", type: "insurance" },
    ],
  },

  // Burkina Faso
  BF: {
    socialSecurityLabel: "Numéro CNSS",
    socialSecurityPlaceholder: "Ex: BF-12345678",
    socialSecurityRequired: true,

    taxIdLabel: "IFU (Identifiant Fiscal Unique)",
    taxIdPlaceholder: "Ex: 00123456A",
    taxIdRequired: true,

    rccmLabel: "Numéro RCCM",
    rccmPlaceholder: "Ex: BF-OUA-2020-B-12345",
    rccmRequired: false,

    workAccidentRateLabel: "Taux d'Accident de Travail (%)",
    workAccidentRateRequired: true,

    collectiveAgreementLabel: "Convention Collective",
    collectiveAgreementPlaceholder: "Ex: Convention Collective Interprofessionnelle",

    commonFunds: [
      { name: "DGI (Direction Générale des Impôts)", type: "tax" },
      { name: "CNSS (Caisse Nationale de Sécurité Sociale)", type: "social" },
    ],
  },

  // Mali
  ML: {
    socialSecurityLabel: "Numéro INPS",
    socialSecurityPlaceholder: "Ex: ML-12345678",
    socialSecurityRequired: true,

    taxIdLabel: "NIF (Numéro d'Identification Fiscale)",
    taxIdPlaceholder: "Ex: 123456789",
    taxIdRequired: true,

    rccmLabel: "Numéro RCCM",
    rccmPlaceholder: "Ex: ML-BKO-2020-B-12345",
    rccmRequired: false,

    workAccidentRateLabel: "Taux d'Accident de Travail (%)",
    workAccidentRateRequired: true,

    collectiveAgreementLabel: "Convention Collective",
    collectiveAgreementPlaceholder: "Ex: Convention Collective Interprofessionnelle",

    commonFunds: [
      { name: "DGI (Direction Générale des Impôts)", type: "tax" },
      { name: "INPS (Institut National de Prévoyance Sociale)", type: "social" },
    ],
  },

  // Bénin
  BJ: {
    socialSecurityLabel: "Numéro CNSS",
    socialSecurityPlaceholder: "Ex: BJ-12345678",
    socialSecurityRequired: true,

    taxIdLabel: "IFU (Identifiant Fiscal Unique)",
    taxIdPlaceholder: "Ex: 3123456789012",
    taxIdRequired: true,

    rccmLabel: "Numéro RCCM",
    rccmPlaceholder: "Ex: RB/COT/20 B 12345",
    rccmRequired: false,

    workAccidentRateLabel: "Taux d'Accident de Travail (%)",
    workAccidentRateRequired: true,

    collectiveAgreementLabel: "Convention Collective",
    collectiveAgreementPlaceholder: "Ex: Convention Collective Interprofessionnelle",

    commonFunds: [
      { name: "DGI (Direction Générale des Impôts)", type: "tax" },
      { name: "CNSS (Caisse Nationale de Sécurité Sociale)", type: "social" },
    ],
  },
};

/**
 * Default configuration for countries not explicitly listed
 */
export const DEFAULT_FIELD_CONFIG: CountryFieldConfig = {
  socialSecurityLabel: "Numéro de Sécurité Sociale",
  socialSecurityPlaceholder: "",
  socialSecurityRequired: false,

  taxIdLabel: "Numéro d'Identification Fiscale",
  taxIdPlaceholder: "",
  taxIdRequired: false,

  rccmLabel: "Numéro RCCM",
  rccmPlaceholder: "",
  rccmRequired: false,

  workAccidentRateLabel: "Taux d'Accident de Travail (%)",
  workAccidentRateRequired: false,

  collectiveAgreementLabel: "Convention Collective",
  collectiveAgreementPlaceholder: "",

  commonFunds: [],
};

/**
 * Get country-specific field configuration
 * Falls back to default config if country not found
 */
export function getCountryFieldConfig(countryCode: string): CountryFieldConfig {
  return COUNTRY_FIELD_CONFIGS[countryCode] ?? DEFAULT_FIELD_CONFIG;
}

/**
 * Get localized label for social security field
 */
export function getSocialSecurityLabel(countryCode: string): string {
  return getCountryFieldConfig(countryCode).socialSecurityLabel;
}

/**
 * Get localized label for tax ID field
 */
export function getTaxIdLabel(countryCode: string): string {
  return getCountryFieldConfig(countryCode).taxIdLabel;
}
