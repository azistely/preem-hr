/**
 * Field Mappings for Employee Import
 *
 * Maps SAGE/Excel field names to Preem HR database columns
 * Includes validators, transformers, and required field definitions
 */

import { parseISO, parse, isValid } from 'date-fns';

// ============================================================================
// FIELD MAPPING: SAGE → Preem HR
// ============================================================================

export const SAGE_TO_PREEM_MAPPING: Record<string, string> = {
  // Personal info (9 fields)
  'Matricule': 'employeeNumber',
  'Prénom': 'firstName',
  'Nom': 'lastName',
  'Genre': 'gender',
  'Date de naissance': 'dateOfBirth',
  'Lieu de naissance': 'placeOfBirth',
  'Nationalité': 'nationality',
  'Contact': 'phone',
  'Email': 'email',

  // Identity (2 fields)
  'N° CNI/Passeport': 'nationalId',
  'Domicile': 'addressLine1',

  // Personnel record (6 fields)
  'Zone Nationalité': 'nationalityZone',
  'Type de salarié': 'employeeType',
  'Père': 'fatherName',
  'Mère': 'motherName', // Note: SAGE exports as "Mere" without accent
  'Mere': 'motherName', // Fallback for SAGE without accent
  'Personne en cas d\'urgence': 'emergencyContactName',
  'Contact urgence': 'emergencyContactPhone',

  // Family (3 fields)
  'Situation Familiale': 'maritalStatus',
  'Nombre d\'enfant': 'dependentChildren',
  'Nombre d\'enfants à charge': 'dependentChildren', // Alternative spelling
  'Nbr Part': 'fiscalParts',

  // Employment (9 fields - added payment frequency and contract end date)
  'Date d\'embauche': 'hireDate',
  'Nature du contrat': 'contractType',
  'Fréquence de paiement': 'paymentFrequency',
  'Fonction': 'jobTitle',
  'Métier': 'profession',
  'Type Emploi': 'employmentClassification',
  'Date de fin de contrat': 'contractEndDate', // Required for CDD/CDDTI
  'Date de sortie': 'terminationDate',
  'Nature de sortie': 'terminationReason',

  // Classification (6 fields)
  'Catégorie': 'categoryCode',
  'Qualification': 'qualification',
  'Salaire Catégoriel': 'categoricalSalary',
  'Sursalaire': 'salaryPremium',
  'Regime salaire': 'salaryRegime',
  'Régime salaire': 'salaryRegime', // With accent
  'Régime horaire': 'weeklyHoursRegime',
  'Regime horaire': 'weeklyHoursRegime', // Without accent

  // Transport allowance (optional - if not provided, uses city minimum)
  'Indemnité de transport': 'transportAllowance',
  'Prime de transport': 'transportAllowance', // Alternative name

  // Organizational (7 fields)
  'Etablissement': 'establishment',
  'Établissement': 'establishment', // With accent
  'Direction': 'division',
  'Département': 'service', // Note: Maps to service field for now
  'Service': 'service',
  'Section': 'section',
  'Site de travail': 'workSite',
  'Manager': 'reportingManagerId', // Will need matricule → ID resolution

  // Social security (4 fields)
  'N° CNPS': 'cnpsNumber',
  'N° CMU': 'cmuNumber',
  'Couverture Maladie': 'healthCoverage',
  'Date début couverture': 'healthCoverageStartDate',

  // Banking (2 fields)
  'Banque': 'bankName',
  'RIB': 'bankAccount',

  // Leave (1 field)
  'Solde congés': 'initialLeaveBalance',
  'Solde congés initial': 'initialLeaveBalance',
};

// ============================================================================
// REQUIRED FIELDS (always required - minimal template)
// ============================================================================

export const REQUIRED_FIELDS = [
  // 1. Employee identification
  'Matricule',
  'Nom',
  'Prénom',
  'Contact',

  // 2. Personal information
  'Date de naissance',
  'Genre',
  'Situation Familiale',
  'Nombre d\'enfants à charge',
  'Zone Nationalité',
  'Type de salarié',

  // 3. Employment details
  'Date d\'embauche',
  'Nature du contrat',
  'Fréquence de paiement',
  'Fonction',
  'Site de travail',

  // 4. Compensation
  'Catégorie',
  'Salaire Catégoriel',
  'Indemnité de transport',
] as const;

// ============================================================================
// CONDITIONALLY REQUIRED FIELDS (based on contract type)
// ============================================================================

/**
 * Fields required only for specific contract types
 * - Régime horaire: Required only for CDDTI (task-based contracts)
 * - Date de fin de contrat: Required for CDD and CDDTI
 */
export const CONDITIONAL_REQUIRED_FIELDS: Record<string, { requiredFor: string[]; fieldName: string }> = {
  'Régime horaire': {
    requiredFor: ['CDDTI'],
    fieldName: 'weeklyHoursRegime',
  },
  'Date de fin de contrat': {
    requiredFor: ['CDD', 'CDDTI'],
    fieldName: 'contractEndDate',
  },
};

// ============================================================================
// FIELD VALIDATORS
// ============================================================================

export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export const FIELD_VALIDATORS: Record<string, (value: any) => ValidationResult> = {
  'Matricule': (val: string) => {
    if (!val || typeof val !== 'string') {
      return { valid: false, message: 'Matricule requis' };
    }
    const cleaned = val.trim();
    if (cleaned.length < 2 || cleaned.length > 20) {
      return { valid: false, message: 'Matricule doit avoir entre 2 et 20 caractères' };
    }
    if (!/^[A-Z0-9-_]+$/i.test(cleaned)) {
      return { valid: false, message: 'Matricule: uniquement lettres, chiffres, tirets' };
    }
    return { valid: true };
  },

  'Email': (val: string) => {
    if (!val) return { valid: true }; // Optional
    if (typeof val !== 'string') {
      return { valid: false, message: 'Email invalide' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) {
      return { valid: false, message: 'Format email invalide (ex: nom@domaine.com)' };
    }
    return { valid: true };
  },

  'Contact': (val: string) => {
    if (!val || typeof val !== 'string') {
      return { valid: false, message: 'Contact requis' };
    }
    const cleaned = val.replace(/[\s-]/g, '');
    if (cleaned.length < 8 || cleaned.length > 15) {
      return { valid: false, message: 'Contact doit avoir entre 8 et 15 chiffres' };
    }
    if (!/^[\d+][\d]+$/.test(cleaned)) {
      return { valid: false, message: 'Contact: uniquement chiffres et + (ex: +225 07 12 34 56 78)' };
    }
    return { valid: true };
  },

  'Date de naissance': (val: any) => {
    if (!val) {
      return { valid: false, message: 'Date de naissance requise' };
    }
    const parsed = parseDate(val);
    if (!parsed) {
      return { valid: false, message: 'Format de date invalide (utilisez JJ/MM/AAAA)' };
    }
    const now = new Date();
    const age = now.getFullYear() - parsed.getFullYear();
    if (age < 16 || age > 100) {
      return { valid: false, message: 'Âge doit être entre 16 et 100 ans' };
    }
    return { valid: true };
  },

  'Date d\'embauche': (val: any) => {
    if (!val) {
      return { valid: false, message: 'Date d\'embauche requise' };
    }
    const parsed = parseDate(val);
    if (!parsed) {
      return { valid: false, message: 'Format de date invalide. Écrivez comme ceci: JJ/MM/AAAA (exemple: 15/03/2020)' };
    }
    const now = new Date();
    if (parsed > now) {
      return { valid: false, message: 'Date d\'embauche ne peut pas être dans le futur' };
    }
    if (parsed < new Date('1950-01-01')) {
      return { valid: false, message: 'Date d\'embauche trop ancienne (avant 1950). Vérifiez l\'année.' };
    }
    return { valid: true };
  },

  'N° CNPS': (val: any) => {
    if (!val) return { valid: true }; // Optional field
    const cleaned = String(val).replace(/[\s-]/g, '');
    if (!/^\d{7,10}$/.test(cleaned)) {
      return { valid: false, message: 'N° CNPS doit contenir entre 7 et 10 chiffres' };
    }
    return { valid: true };
  },

  'N° CMU': (val: any) => {
    if (!val) return { valid: true }; // Optional
    const cleaned = String(val).replace(/[\s-]/g, '');
    if (cleaned.length > 0 && cleaned.length < 5) {
      return { valid: false, message: 'N° CMU incomplet (doit avoir au moins 5 chiffres). Exemple: CMU123456' };
    }
    return { valid: true };
  },

  'RIB': (val: string) => {
    if (!val) return { valid: true }; // Optional
    const cleaned = val.replace(/\s/g, '');
    // CI RIB format: CI + 2 digits + 26-30 alphanumeric
    if (!/^CI\d{2}[A-Z0-9]{20,30}$/i.test(cleaned)) {
      return { valid: false, message: 'Format RIB invalide (ex: CI93 CI000 01234...)' };
    }
    return { valid: true };
  },

  'Nombre d\'enfants à charge': (val: any) => {
    if (val === null || val === undefined || val === '') {
      return { valid: false, message: 'Nombre d\'enfants requis (0 si aucun)' };
    }
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 20) {
      return { valid: false, message: 'Nombre d\'enfants doit être entre 0 et 20' };
    }
    return { valid: true };
  },

  'Salaire Catégoriel': (val: any) => {
    if (!val) {
      return { valid: false, message: 'Salaire Catégoriel requis' };
    }
    const num = Number(String(val).replace(/[\s,]/g, ''));
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Salaire doit être un nombre positif' };
    }
    if (num < 50000) {
      return { valid: false, message: 'Salaire semble trop faible (minimum SMIG en Côte d\'Ivoire: 75,000 FCFA)' };
    }
    if (num > 50000000) {
      return { valid: false, message: 'Salaire semble trop élevé (supérieur à 50 millions FCFA). Vérifiez le montant.' };
    }
    return { valid: true };
  },

  'Indemnité de transport': (val: any) => {
    if (!val) {
      return { valid: false, message: 'Indemnité de transport requise' };
    }
    const num = Number(String(val).replace(/[\s,]/g, ''));
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Indemnité de transport doit être un nombre positif' };
    }
    // Legal minimums: Abidjan 30k, Bouaké 24k, Others 20k
    if (num < 20000) {
      return { valid: false, message: 'Indemnité de transport doit être ≥ 20,000 FCFA (minimum légal)' };
    }
    if (num > 100000) {
      return { valid: false, message: 'Indemnité de transport semble trop élevée (max raisonnable: 100,000 FCFA)' };
    }
    return { valid: true };
  },

  'Prime de transport': (val: any) => {
    // Alias for 'Indemnité de transport'
    return FIELD_VALIDATORS['Indemnité de transport'](val);
  },

  'Fréquence de paiement': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Fréquence de paiement requise' };
    }
    const normalized = val.trim().toUpperCase();
    const validValues = [
      // English
      'MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY',
      // French (various spellings)
      'MENSUEL', 'MENSUELLE',
      'HEBDOMADAIRE', 'HEBDO',
      'BIMENSUEL', 'BIMENSUELLE', 'QUINZAINE', 'BIHEBDO',
      'JOURNALIER', 'JOURNALIÈRE', 'JOURNALIERE',
    ];
    if (!validValues.includes(normalized)) {
      return { valid: false, message: 'Fréquence invalide. Écrivez: Mensuelle, Hebdomadaire, Bimensuelle, ou Journalière' };
    }
    return { valid: true };
  },

  'Nature du contrat': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Nature du contrat requise' };
    }
    const normalized = val.trim().toUpperCase();
    const validTypes = ['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE', 'PERMANENT', 'FIXE', 'INTÉRIM', 'TEMPORAIRE', 'STAGIAIRE', 'TACHE', 'TÂCHE'];
    if (!validTypes.includes(normalized)) {
      return { valid: false, message: 'Type de contrat invalide. Écrivez: CDI (permanent), CDD (durée déterminée), CDDTI (tâche imprécise), INTERIM (intérim), ou STAGE (stage)' };
    }
    return { valid: true };
  },

  'Genre': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Genre requis' };
    }
    const normalized = val.trim().toLowerCase();
    const validGenders = ['h', 'homme', 'm', 'masculin', 'f', 'femme', 'féminin', 'feminin', 'autre', 'other', 'male', 'female'];
    if (!validGenders.includes(normalized)) {
      return { valid: false, message: 'Genre invalide. Écrivez: H (homme), F (femme), ou Autre' };
    }
    return { valid: true };
  },

  'Zone Nationalité': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Zone de nationalité requise' };
    }
    const normalized = val.trim().toUpperCase();
    const validZones = ['LOCAL', 'IVOIRIEN', 'IVOIRIENNE', 'CEDEAO', 'AFRIQUE DE L\'OUEST', 'HORS_CEDEAO', 'HORS CEDEAO', 'ETRANGER', 'ÉTRANGER'];
    if (!validZones.includes(normalized)) {
      return { valid: false, message: 'Zone de nationalité invalide. Écrivez: LOCAL (ivoirien), CEDEAO (Afrique de l\'Ouest), ou HORS_CEDEAO (étranger)' };
    }
    return { valid: true };
  },

  'Type de salarié': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Type d\'employé requis' };
    }
    const normalized = val.trim().toUpperCase();
    const validTypes = ['LOCAL', 'EXPAT', 'EXPATRIE', 'EXPATRIÉ', 'DETACHE', 'DÉTACHÉ', 'STAGIAIRE', 'STAGE'];
    if (!validTypes.includes(normalized)) {
      return { valid: false, message: 'Type d\'employé invalide. Écrivez: LOCAL, EXPAT (expatrié), DETACHE (détaché), ou STAGIAIRE' };
    }
    return { valid: true };
  },

  'Régime horaire': (val: any) => {
    // Note: This field is conditionally required for CDDTI contracts only
    // The conditional validation is handled separately in validateConditionalFields()
    if (!val) return { valid: true }; // Allow empty - conditional check happens elsewhere
    const num = Number(String(val).replace(/[\s,h]/gi, ''));
    if (isNaN(num) || num < 1 || num > 80) {
      return { valid: false, message: 'Régime horaire doit être un nombre entre 1 et 80 heures par semaine' };
    }
    // Common valid values: 35, 39, 40, 45, 48
    if (![35, 39, 40, 45, 48].includes(num) && (num < 30 || num > 50)) {
      return { valid: false, message: 'Régime horaire inhabituel. Valeurs courantes: 35h, 39h, 40h, 45h, ou 48h par semaine' };
    }
    return { valid: true };
  },

  'Site de travail': (val: string) => {
    if (!val || typeof val !== 'string') {
      return { valid: false, message: 'Site de travail requis' };
    }
    if (val.trim().length < 2) {
      return { valid: false, message: 'Site de travail doit avoir au moins 2 caractères' };
    }
    return { valid: true };
  },

  'Sursalaire': (val: any) => {
    // Optional field - if empty, defaults to 0
    if (val === null || val === undefined || val === '') {
      return { valid: true };
    }
    const num = Number(String(val).replace(/[\s,]/g, ''));
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Sursalaire doit être un nombre positif (0 si aucun)' };
    }
    if (num > 50000000) {
      return { valid: false, message: 'Sursalaire semble trop élevé (supérieur à 50 millions FCFA). Vérifiez le montant.' };
    }
    return { valid: true };
  },

  'Date de fin de contrat': (val: any) => {
    // Note: This field is conditionally required for CDD/CDDTI contracts
    // The conditional validation is handled separately in validateConditionalFields()
    if (!val) return { valid: true }; // Allow empty - conditional check happens elsewhere
    const parsed = parseDate(val);
    if (!parsed) {
      return { valid: false, message: 'Format de date invalide. Écrivez comme ceci: JJ/MM/AAAA (exemple: 31/12/2025)' };
    }
    const now = new Date();
    if (parsed < now) {
      return { valid: false, message: 'Date de fin de contrat doit être dans le futur' };
    }
    return { valid: true };
  },
};

// ============================================================================
// FIELD TRANSFORMERS (SAGE format → DB format)
// ============================================================================

export const FIELD_TRANSFORMERS: Record<string, (value: any) => any> = {
  'Genre': (val: string) => {
    if (!val) return null;
    const normalized = val.trim().toLowerCase();
    const map: Record<string, string> = {
      'h': 'male',
      'homme': 'male',
      'm': 'male',
      'masculin': 'male',
      'f': 'female',
      'femme': 'female',
      'féminin': 'female',
      'feminin': 'female',
      'autre': 'other',
      'other': 'other',
    };
    return map[normalized] || val;
  },

  'Zone Nationalité': (val: string) => {
    if (!val) return null;
    const normalized = val.trim().toUpperCase();
    const map: Record<string, string> = {
      'LOCAL': 'LOCAL',
      'IVOIRIEN': 'LOCAL',
      'IVOIRIENNE': 'LOCAL',
      'CEDEAO': 'CEDEAO',
      'AFRIQUE DE L\'OUEST': 'CEDEAO',
      'HORS_CEDEAO': 'HORS_CEDEAO',
      'HORS CEDEAO': 'HORS_CEDEAO',
      'ETRANGER': 'HORS_CEDEAO',
      'ÉTRANGER': 'HORS_CEDEAO',
    };
    return map[normalized] || normalized;
  },

  'Type de salarié': (val: string) => {
    if (!val) return null;
    const normalized = val.trim().toUpperCase();
    const map: Record<string, string> = {
      'LOCAL': 'LOCAL',
      'EXPAT': 'EXPAT',
      'EXPATRIE': 'EXPAT',
      'EXPATRIÉ': 'EXPAT',
      'DETACHE': 'DETACHE',
      'DÉTACHÉ': 'DETACHE',
      'STAGIAIRE': 'STAGIAIRE',
      'STAGE': 'STAGIAIRE',
    };
    return map[normalized] || normalized;
  },

  'Situation Familiale': (val: string) => {
    if (!val) return 'single';
    const normalized = val.trim().toLowerCase();
    const map: Record<string, string> = {
      'c': 'single',
      'celibataire': 'single',
      'célibataire': 'single',
      'm': 'married',
      'marie': 'married',
      'marié': 'married',
      'mariee': 'married',
      'mariée': 'married',
      'd': 'divorced',
      'divorce': 'divorced',
      'divorcé': 'divorced',
      'divorcee': 'divorced',
      'divorcée': 'divorced',
      'v': 'widowed',
      'veuf': 'widowed',
      'veuve': 'widowed',
    };
    return map[normalized] || val;
  },

  'Nature du contrat': (val: string) => {
    if (!val) return null;
    const normalized = val.trim().toUpperCase();
    const map: Record<string, string> = {
      'CDI': 'CDI',
      'PERMANENT': 'CDI',
      'CDD': 'CDD',
      'FIXE': 'CDD',
      'CDDTI': 'CDDTI',
      'TACHE': 'CDDTI',
      'TÂCHE': 'CDDTI',
      'INTERIM': 'INTERIM',
      'INTÉRIM': 'INTERIM',
      'TEMPORAIRE': 'INTERIM',
      'STAGE': 'STAGE',
      'STAGIAIRE': 'STAGE',
    };
    return map[normalized] || normalized;
  },

  'Fréquence de paiement': (val: string) => {
    if (!val) return 'MONTHLY'; // Default to monthly
    const normalized = val.trim().toUpperCase();
    const map: Record<string, string> = {
      // English values
      'MONTHLY': 'MONTHLY',
      'WEEKLY': 'WEEKLY',
      'BIWEEKLY': 'BIWEEKLY',
      'DAILY': 'DAILY',
      // French values (with various spellings)
      'MENSUEL': 'MONTHLY',
      'MENSUELLE': 'MONTHLY',
      'HEBDOMADAIRE': 'WEEKLY',
      'HEBDO': 'WEEKLY',
      'BIMENSUEL': 'BIWEEKLY',
      'BIMENSUELLE': 'BIWEEKLY',
      'QUINZAINE': 'BIWEEKLY',
      'BIHEBDO': 'BIWEEKLY',
      'JOURNALIER': 'DAILY',
      'JOURNALIÈRE': 'DAILY',
      'JOURNALIERE': 'DAILY',
    };
    return map[normalized] || 'MONTHLY';
  },

  'Date de naissance': (val: any) => {
    return parseDate(val);
  },

  'Date d\'embauche': (val: any) => {
    return parseDate(val);
  },

  'Date de sortie': (val: any) => {
    if (!val) return null;
    return parseDate(val);
  },

  'Date de fin de contrat': (val: any) => {
    if (!val) return null;
    const parsed = parseDate(val);
    // Return ISO date string (YYYY-MM-DD) for database compatibility
    return parsed ? parsed.toISOString().split('T')[0] : null;
  },

  'Nombre d\'enfants à charge': (val: any) => {
    if (val === null || val === undefined || val === '') return 0;
    return parseInt(String(val), 10) || 0;
  },

  'Nbr Part': (val: any) => {
    if (!val) return null;
    return parseFloat(String(val).replace(',', '.')) || null;
  },

  'Salaire Catégoriel': (val: any) => {
    if (!val) return null;
    return parseFloat(String(val).replace(/[\s,]/g, '')) || null;
  },

  'Sursalaire': (val: any) => {
    if (!val) return null;
    return parseFloat(String(val).replace(/[\s,]/g, '')) || null;
  },

  'Régime horaire': (val: any) => {
    if (!val) return null;
    // Remove spaces, commas, and 'h' characters (e.g., "35h" -> 35)
    const num = parseFloat(String(val).replace(/[\s,h]/gi, ''));
    return isNaN(num) ? null : num;
  },

  'Indemnité de transport': (val: any) => {
    if (!val) return null;
    return parseFloat(String(val).replace(/[\s,]/g, '')) || null;
  },

  'Prime de transport': (val: any) => {
    // Alias for 'Indemnité de transport'
    return FIELD_TRANSFORMERS['Indemnité de transport'](val);
  },

  'Solde congés initial': (val: any) => {
    if (!val) return null;
    return parseFloat(String(val).replace(',', '.')) || null;
  },

  'Contact': (val: string) => {
    if (!val) return null;
    // Normalize phone number: keep only digits and +
    let cleaned = val.trim();
    // Ensure it starts with + if it's an international number
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    } else if (cleaned.startsWith('225') && !cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  },

  'RIB': (val: string) => {
    if (!val) return null;
    // Normalize RIB: remove spaces
    return val.replace(/\s/g, '');
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse date from various formats
 * Supports: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, Excel serial dates
 */
function parseDate(val: any): Date | null {
  if (!val) return null;

  // If already a Date object
  if (val instanceof Date) {
    return isValid(val) ? val : null;
  }

  const str = String(val).trim();

  // Try DD/MM/YYYY format (most common in French contexts)
  const ddmmyyyy = parse(str, 'dd/MM/yyyy', new Date());
  if (isValid(ddmmyyyy)) return ddmmyyyy;

  // Try DD/MM/YY format
  const ddmmyy = parse(str, 'dd/MM/yy', new Date());
  if (isValid(ddmmyy)) return ddmmyy;

  // Try ISO format (YYYY-MM-DD)
  const iso = parseISO(str);
  if (isValid(iso)) return iso;

  // Try Excel serial date (number of days since 1900-01-01)
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    // Excel dates are days since 1900-01-01 (with bug: 1900 is not a leap year)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
    if (isValid(date)) return date;
  }

  return null;
}

/**
 * Normalize field name for fuzzy matching
 * Removes accents, spaces, and special characters
 */
export function normalizeFieldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Spaces to underscores
    .toLowerCase();
}

/**
 * Find database field name from SAGE header (fuzzy matching)
 */
export function findDatabaseField(sageHeader: string): string | null {
  // Strip asterisks from template headers (e.g., "Fréquence de paiement*" → "Fréquence de paiement")
  const cleanHeader = sageHeader.replace(/\*+$/, '').trim();

  // Direct match first
  if (SAGE_TO_PREEM_MAPPING[cleanHeader]) {
    return SAGE_TO_PREEM_MAPPING[cleanHeader];
  }

  // Fuzzy match by normalized name
  const normalized = normalizeFieldName(cleanHeader);
  for (const [sage, preem] of Object.entries(SAGE_TO_PREEM_MAPPING)) {
    if (normalizeFieldName(sage) === normalized) {
      return preem;
    }
  }

  return null;
}

/**
 * Strip asterisks from field names (used for required field markers in templates)
 */
function stripFieldMarkers(fieldName: string): string {
  return fieldName.replace(/\*+$/, '').trim();
}

/**
 * Validate a single field value
 */
export function validateField(fieldName: string, value: any): ValidationResult {
  // Strip asterisks from template headers (e.g., "Fréquence de paiement*" → "Fréquence de paiement")
  const cleanFieldName = stripFieldMarkers(fieldName);
  const validator = FIELD_VALIDATORS[cleanFieldName];
  if (validator) {
    return validator(value);
  }
  return { valid: true };
}

/**
 * Transform a single field value
 */
export function transformField(fieldName: string, value: any): any {
  // Strip asterisks from template headers (e.g., "Fréquence de paiement*" → "Fréquence de paiement")
  const cleanFieldName = stripFieldMarkers(fieldName);
  const transformer = FIELD_TRANSFORMERS[cleanFieldName];
  if (transformer) {
    return transformer(value);
  }
  return value;
}

/**
 * Check if a field is always required (not conditional)
 */
export function isRequiredField(fieldName: string): boolean {
  return REQUIRED_FIELDS.includes(fieldName as any);
}

/**
 * Check if a field is conditionally required based on contract type
 */
export function isConditionallyRequired(fieldName: string, contractType: string | null | undefined): boolean {
  const condition = CONDITIONAL_REQUIRED_FIELDS[fieldName];
  if (!condition) return false;

  if (!contractType) return false;

  // Normalize contract type (handle French variations)
  const normalized = contractType.trim().toUpperCase();
  const normalizedTypes: Record<string, string> = {
    'CDI': 'CDI',
    'PERMANENT': 'CDI',
    'CDD': 'CDD',
    'FIXE': 'CDD',
    'CDDTI': 'CDDTI',
    'TACHE': 'CDDTI',
    'TÂCHE': 'CDDTI',
    'INTERIM': 'INTERIM',
    'INTÉRIM': 'INTERIM',
    'TEMPORAIRE': 'INTERIM',
    'STAGE': 'STAGE',
    'STAGIAIRE': 'STAGE',
  };

  const resolvedType = normalizedTypes[normalized] || normalized;
  return condition.requiredFor.includes(resolvedType);
}

/**
 * Validate conditional fields for a row
 * Returns validation errors for fields that are conditionally required but missing
 */
export function validateConditionalFields(row: Record<string, any>): ValidationResult[] {
  const errors: ValidationResult[] = [];

  // Get contract type from row (check various possible field names, including with asterisks)
  const contractType = row['Nature du contrat'] || row['Nature du contrat*'] || row['contractType'];

  if (!contractType) return errors; // Can't validate without contract type

  // Check each conditionally required field
  for (const [fieldName, condition] of Object.entries(CONDITIONAL_REQUIRED_FIELDS)) {
    if (isConditionallyRequired(fieldName, contractType)) {
      // Look for value with various field name formats (with/without asterisks)
      const value = row[fieldName] || row[`${fieldName}*`] || row[`${fieldName}**`];

      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Determine which contract types require this field for the error message
        const requiredForText = condition.requiredFor.join('/');
        errors.push({
          valid: false,
          message: `${fieldName} est requis pour les contrats ${requiredForText}`,
        });
      }
    }
  }

  return errors;
}
