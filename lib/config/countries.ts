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
    taxSystem: 'ITS 2024',
    taxSystemFull: 'Impôt sur les Traitements et Salaires 2024',
    socialSecurity: 'CNPS',
    socialSecurityFull: 'Caisse Nationale de Prévoyance Sociale',
    minimumWage: 'SMIG 75,000 FCFA',
    minimumWageAmount: 75000,
    trustIndicators: {
      tax: 'Conforme réforme ITS 2024',
      taxDetail: '(6 tranches progressives)',
      social: 'Calcul CNPS automatique',
      socialDetail: '(Retraite, Prestations, CMU)',
    },
    benefits: {
      compliance: {
        stat: 'Saviez-vous que 33% des PME ivoiriennes reçoivent des amendes chaque année pour erreurs de paie?',
        items: [
          'ITS 2024 calculé automatiquement (6 tranches progressives)',
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
        outcome: 'Preem HR configure automatiquement les règles de Côte d\'Ivoire',
        details: 'configure ITS 2024, CNPS, CMU, FDFP pour vous.',
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
        outcome: 'Preem HR configure automatiquement les règles du Sénégal',
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
        outcome: 'Preem HR configure automatiquement les règles du Burkina Faso',
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
