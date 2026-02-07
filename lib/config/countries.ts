/**
 * Country-Specific Configuration
 *
 * Contains all country-specific content for marketing homepages
 * Based on research: CI (Côte d'Ivoire), SN (Sénégal), BF (Burkina Faso)
 */

import { CountryConfig } from '@/components/marketing/country-homepage';

export const COUNTRIES: Record<string, CountryConfig> = {
  ci: {
    code: 'ci',
    name: 'Côte d\'Ivoire',
    flag: '🇨🇮',
    taxSystem: 'ITS',
    taxSystemFull: 'Impôt sur les Traitements et Salaires',
    socialSecurity: 'CNPS',
    socialSecurityFull: 'Caisse Nationale de Prévoyance Sociale',
    minimumWage: 'SMIG 75,000 FCFA',
    minimumWageAmount: 75000,
    trustIndicators: {
      tax: 'Conforme réforme ITS',
      taxDetail: '(6 tranches progressives)',
      social: 'Calcul CNPS automatique',
      socialDetail: '(Retraite, Prestations, CMU)',
    },
    benefits: {
      compliance: {
        stat: 'Saviez-vous que 33% des PME ivoiriennes reçoivent des amendes chaque année pour erreurs de paie?',
        items: [
          'ITS calculé automatiquement (6 tranches progressives)',
          'Cotisations CNPS exactes (Retraite 14%, Prestations 5%, Accidents 2-5%)',
          'CMU déduite correctement (1,000 FCFA salarié + famille)',
          'FDFP (Taxe d\'Apprentissage + Formation) appliquée',
        ],
      },
      expertise: {
        wage: 'SMIG 75,000 FCFA',
      },
    },
    howItWorks: {
      step1: {
        outcome: 'Jamana configure automatiquement les règles de Côte d\'Ivoire',
        details: 'configure ITS, CNPS, CMU, FDFP pour vous.',
      },
    },
  },

  sn: {
    code: 'sn',
    name: 'Sénégal',
    flag: '🇸🇳',
    taxSystem: 'IRPP',
    taxSystemFull: 'Impôt sur le Revenu des Personnes Physiques',
    socialSecurity: 'IPRES',
    socialSecurityFull: 'Institution de Prévoyance Retraite du Sénégal',
    minimumWage: 'SMIG 52,500 FCFA',
    minimumWageAmount: 52500,
    trustIndicators: {
      tax: 'Conforme IRPP Sénégal',
      taxDetail: '(Barème progressif jusqu\'à 40%)',
      social: 'Calcul IPRES automatique',
      socialDetail: '(Retraite + CSS)',
    },
    benefits: {
      compliance: {
        stat: 'Les erreurs de paie peuvent coûter cher aux entreprises sénégalaises.',
        items: [
          'IRPP calculé automatiquement (barème progressif jusqu\'à 40%)',
          'Cotisations IPRES exactes (pension de retraite)',
          'CSS (Caisse de Sécurité Sociale) appliquée correctement',
          'CFCE (Contribution Forfaitaire à la Charge de l\'Employeur) incluse',
        ],
      },
      expertise: {
        wage: 'SMIG 52,500 FCFA',
      },
    },
    howItWorks: {
      step1: {
        outcome: 'Jamana configure automatiquement les règles du Sénégal',
        details: 'configure IRPP, IPRES, CSS, CFCE pour vous.',
      },
    },
  },

  bf: {
    code: 'bf',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    taxSystem: 'IUTS',
    taxSystemFull: 'Impôt Unique sur les Traitements et Salaires',
    socialSecurity: 'CNSS',
    socialSecurityFull: 'Caisse Nationale de Sécurité Sociale',
    minimumWage: 'SMIG 34,664 FCFA',
    minimumWageAmount: 34664,
    trustIndicators: {
      tax: 'Conforme IUTS Burkina',
      taxDetail: '(Barème progressif)',
      social: 'Calcul CNSS automatique',
      socialDetail: '(Prestations familiales + Retraite)',
    },
    benefits: {
      compliance: {
        stat: 'Les erreurs fiscales et sociales coûtent cher aux entreprises burkinabè.',
        items: [
          'IUTS calculé automatiquement (barème progressif)',
          'Cotisations CNSS exactes (prestations familiales + retraite)',
          'Accidents de travail et maladies professionnelles inclus',
          'Taxe de formation professionnelle appliquée',
        ],
      },
      expertise: {
        wage: 'SMIG 34,664 FCFA',
      },
    },
    howItWorks: {
      step1: {
        outcome: 'Jamana configure automatiquement les règles du Burkina Faso',
        details: 'configure IUTS, CNSS, et toutes les cotisations pour vous.',
      },
    },
  },
};

export const AVAILABLE_COUNTRIES: CountryConfig[] = [
  COUNTRIES.ci,
  COUNTRIES.sn,
  COUNTRIES.bf,
];

/**
 * Phone Configuration for West African Countries
 * Used for phone input component with country code selector
 */
export interface PhoneCountryConfig {
  code: string;       // ISO country code (CI, SN, BF)
  name: string;       // Country name in French
  dialCode: string;   // International dial code (+225, +221, +226)
  flag: string;       // Flag emoji
  phoneLength: number; // Expected phone number length (without country code)
  format: string;     // Display format pattern
  placeholder: string; // Example phone number
}

export const PHONE_COUNTRIES: PhoneCountryConfig[] = [
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    dialCode: '+225',
    flag: '🇨🇮',
    phoneLength: 10,
    format: 'XX XX XX XX XX',
    placeholder: '07 08 09 10 11',
  },
  {
    code: 'SN',
    name: 'Sénégal',
    dialCode: '+221',
    flag: '🇸🇳',
    phoneLength: 9,
    format: 'XX XXX XX XX',
    placeholder: '77 123 45 67',
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    dialCode: '+226',
    flag: '🇧🇫',
    phoneLength: 8,
    format: 'XX XX XX XX',
    placeholder: '70 12 34 56',
  },
];

/**
 * Get phone country config by ISO code
 */
export function getPhoneCountryByCode(code: string): PhoneCountryConfig | undefined {
  return PHONE_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get default phone country (Côte d'Ivoire)
 */
export function getDefaultPhoneCountry(): PhoneCountryConfig {
  return PHONE_COUNTRIES[0]; // CI
}

/**
 * Format phone number for display based on country
 * @param phone - Raw phone number (digits only)
 * @param countryCode - ISO country code
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string, countryCode: string): string {
  const country = getPhoneCountryByCode(countryCode);
  if (!country) return phone;

  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on country
  switch (countryCode.toUpperCase()) {
    case 'CI':
      // Format: XX XX XX XX XX (groups of 2)
      return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    case 'SN':
      // Format: XX XXX XX XX (2-3-2-2)
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    case 'BF':
      // Format: XX XX XX XX (groups of 2)
      return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    default:
      return digits;
  }
}

/**
 * Convert phone number to E.164 format for storage
 * @param phone - Phone number (can include spaces, dashes, leading zero)
 * @param countryCode - ISO country code
 * @returns E.164 formatted phone number (e.g., +2250708091011)
 */
export function toE164(phone: string, countryCode: string): string {
  const country = getPhoneCountryByCode(countryCode);
  if (!country) return phone;

  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Note: For West African countries (CI, SN, BF, etc.), the full national number
  // includes any leading digits - there's no separate trunk prefix to strip.
  // E.g., CI number 0707750765 → +2250707750765

  return `${country.dialCode}${digits}`;
}

/**
 * Parse E.164 phone number back to local format
 * @param e164 - Phone in E.164 format (e.g., +2250708091011)
 * @returns Object with country code and local number
 */
export function parseE164(e164: string): { countryCode: string; localNumber: string } | null {
  for (const country of PHONE_COUNTRIES) {
    if (e164.startsWith(country.dialCode)) {
      return {
        countryCode: country.code,
        localNumber: e164.slice(country.dialCode.length),
      };
    }
  }
  return null;
}

/**
 * Validate phone number length for a country
 * @param phone - Phone number (digits only)
 * @param countryCode - ISO country code
 * @returns Whether the phone number has the correct length
 */
export function isValidPhoneLength(phone: string, countryCode: string): boolean {
  const country = getPhoneCountryByCode(countryCode);
  if (!country) return false;

  // Remove non-digits only - don't strip leading zero
  // For West African countries, the full national number includes any leading digits
  const digits = phone.replace(/\D/g, '');

  return digits.length === country.phoneLength;
}
