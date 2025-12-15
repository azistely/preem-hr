/**
 * Field Mappings for Observation Import
 *
 * Maps Excel/CSV field names to observation data fields
 * Includes validators, transformers, and required field definitions
 *
 * Used for importing daily/weekly KPI observations from team leads
 */

import { parseISO, parse, isValid } from 'date-fns';

// ============================================================================
// FIELD MAPPING: Excel → Observation Data
// ============================================================================

export const OBSERVATION_FIELD_MAPPING: Record<string, string> = {
  // Required fields
  'Matricule': 'employeeNumber',
  'Date': 'observationDate',
  'Date d\'observation': 'observationDate',
  'Date Observation': 'observationDate',

  // Period
  'Période': 'period',
  'Periode': 'period',

  // Production KPIs
  'Unités produites': 'unitsProduced',
  'Unites produites': 'unitsProduced',
  'Production': 'unitsProduced',
  'Quantité produite': 'unitsProduced',
  'Quantite produite': 'unitsProduced',

  'Objectif production': 'targetUnits',
  'Objectif': 'targetUnits',
  'Cible': 'targetUnits',

  'Défauts': 'defects',
  'Defauts': 'defects',
  'Nb défauts': 'defects',
  'Nb defauts': 'defects',
  'Rebus': 'defects',
  'Rebuts': 'defects',

  'Taux de défaut': 'defectRate',
  'Taux defaut': 'defectRate',
  '% défauts': 'defectRate',
  '% defauts': 'defectRate',

  'Temps d\'arrêt machine': 'machineDowntimeMinutes',
  'Temps arret machine': 'machineDowntimeMinutes',
  'Arrêt machine (min)': 'machineDowntimeMinutes',
  'Downtime': 'machineDowntimeMinutes',

  // Attendance KPIs
  'Heures travaillées': 'hoursWorked',
  'Heures travaillees': 'hoursWorked',
  'Heures': 'hoursWorked',
  'H. travaillées': 'hoursWorked',

  'Heures prévues': 'expectedHours',
  'Heures prevues': 'expectedHours',
  'H. prévues': 'expectedHours',

  'Retard': 'lateMinutes',
  'Retard (min)': 'lateMinutes',
  'Minutes de retard': 'lateMinutes',

  'Présence': 'absenceType',
  'Presence': 'absenceType',
  'Statut présence': 'absenceType',
  'Statut presence': 'absenceType',
  'Absent': 'absenceType',

  // Safety KPIs
  'Sécurité': 'safetyScore',
  'Securite': 'safetyScore',
  'Note sécurité': 'safetyScore',
  'Note securite': 'safetyScore',
  'Score sécurité': 'safetyScore',

  'EPI': 'ppeCompliance',
  'Conformité EPI': 'ppeCompliance',
  'Conformite EPI': 'ppeCompliance',
  'Port EPI': 'ppeCompliance',

  'Incident': 'incidentReported',
  'Incident reporté': 'incidentReported',
  'Incident reporte': 'incidentReported',

  // Behavior KPIs
  'Qualité': 'qualityScore',
  'Qualite': 'qualityScore',
  'Note qualité': 'qualityScore',
  'Note qualite': 'qualityScore',
  'Score qualité': 'qualityScore',

  'Travail d\'équipe': 'teamworkScore',
  'Travail d\'equipe': 'teamworkScore',
  'Travail equipe': 'teamworkScore',
  'Équipe': 'teamworkScore',
  'Equipe': 'teamworkScore',
  'Esprit d\'équipe': 'teamworkScore',

  'Initiative': 'initiativeScore',
  'Note initiative': 'initiativeScore',
  'Proactivité': 'initiativeScore',
  'Proactivite': 'initiativeScore',

  // Overall
  'Note globale': 'overallRating',
  'Évaluation globale': 'overallRating',
  'Evaluation globale': 'overallRating',
  'Score global': 'overallRating',

  // Comments
  'Commentaire': 'comment',
  'Commentaires': 'comment',
  'Remarques': 'comment',
  'Notes': 'comment',
  'Observations': 'comment',
};

// ============================================================================
// REQUIRED FIELDS
// ============================================================================

export const REQUIRED_OBSERVATION_FIELDS = [
  'Matricule',
  'Date',
] as const;

// ============================================================================
// FIELD VALIDATORS
// ============================================================================

export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export const OBSERVATION_VALIDATORS: Record<string, (value: any) => ValidationResult> = {
  'Matricule': (val: string) => {
    if (!val || typeof val !== 'string') {
      return { valid: false, message: 'Matricule requis' };
    }
    const cleaned = val.trim();
    if (cleaned.length < 2 || cleaned.length > 20) {
      return { valid: false, message: 'Matricule doit avoir entre 2 et 20 caractères' };
    }
    return { valid: true };
  },

  'Date': (val: any) => {
    if (!val) {
      return { valid: false, message: 'Date d\'observation requise' };
    }
    const parsed = parseObservationDate(val);
    if (!parsed) {
      return { valid: false, message: 'Format de date invalide (utilisez JJ/MM/AAAA)' };
    }
    const now = new Date();
    if (parsed > now) {
      return { valid: false, message: 'Date d\'observation ne peut pas être dans le futur' };
    }
    if (parsed < new Date('2020-01-01')) {
      return { valid: false, message: 'Date d\'observation trop ancienne (avant 2020)' };
    }
    return { valid: true };
  },

  'Unités produites': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Unités produites doit être un nombre positif' };
    }
    return { valid: true };
  },

  'Objectif production': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Objectif production doit être un nombre positif' };
    }
    return { valid: true };
  },

  'Défauts': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      return { valid: false, message: 'Défauts doit être un nombre positif ou zéro' };
    }
    return { valid: true };
  },

  'Heures travaillées': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const num = Number(String(val).replace(',', '.').replace('h', ''));
    if (isNaN(num) || num < 0 || num > 24) {
      return { valid: false, message: 'Heures travaillées doit être entre 0 et 24' };
    }
    return { valid: true };
  },

  'Retard (min)': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 480) {
      return { valid: false, message: 'Retard doit être entre 0 et 480 minutes (8h)' };
    }
    return { valid: true };
  },

  'Présence': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const normalized = String(val).trim().toLowerCase();
    const validValues = [
      'present', 'présent', 'p', 'oui', 'o', '1',
      'absent', 'a', 'non', 'n', '0',
      'absent_justified', 'absent justifié', 'aj', 'justifié', 'justifie',
      'absent_unjustified', 'absent non justifié', 'anj', 'non justifié', 'non justifie',
    ];
    if (!validValues.includes(normalized)) {
      return { valid: false, message: 'Présence invalide. Écrivez: Présent, Absent, Justifié, ou Non justifié' };
    }
    return { valid: true };
  },

  'Sécurité': (val: any) => validateRating(val, 'Sécurité'),
  'Qualité': (val: any) => validateRating(val, 'Qualité'),
  'Travail d\'équipe': (val: any) => validateRating(val, 'Travail d\'équipe'),
  'Initiative': (val: any) => validateRating(val, 'Initiative'),
  'Note globale': (val: any) => validateRating(val, 'Note globale'),

  'EPI': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const normalized = String(val).trim().toLowerCase();
    const validValues = ['oui', 'o', 'yes', 'y', '1', 'true', 'non', 'n', 'no', '0', 'false'];
    if (!validValues.includes(normalized)) {
      return { valid: false, message: 'EPI doit être Oui ou Non' };
    }
    return { valid: true };
  },

  'Incident': (val: any) => {
    if (val === null || val === undefined || val === '') return { valid: true };
    const normalized = String(val).trim().toLowerCase();
    const validValues = ['oui', 'o', 'yes', 'y', '1', 'true', 'non', 'n', 'no', '0', 'false'];
    if (!validValues.includes(normalized)) {
      return { valid: false, message: 'Incident doit être Oui ou Non' };
    }
    return { valid: true };
  },
};

function validateRating(val: any, fieldName: string): ValidationResult {
  if (val === null || val === undefined || val === '') return { valid: true };
  const num = Number(val);
  if (isNaN(num) || num < 1 || num > 5) {
    return { valid: false, message: `${fieldName} doit être entre 1 et 5` };
  }
  return { valid: true };
}

// ============================================================================
// FIELD TRANSFORMERS
// ============================================================================

export const OBSERVATION_TRANSFORMERS: Record<string, (value: any) => any> = {
  'Matricule': (val: string) => {
    if (!val) return null;
    return String(val).trim().toUpperCase();
  },

  'Date': (val: any) => {
    return parseObservationDate(val);
  },

  'Période': (val: string) => {
    if (!val) return 'daily';
    const normalized = val.trim().toLowerCase();
    const map: Record<string, string> = {
      'journalier': 'daily',
      'journalière': 'daily',
      'daily': 'daily',
      'jour': 'daily',
      'hebdomadaire': 'weekly',
      'weekly': 'weekly',
      'semaine': 'weekly',
      'mensuel': 'monthly',
      'monthly': 'monthly',
      'mois': 'monthly',
    };
    return map[normalized] || 'daily';
  },

  'Unités produites': transformNumber,
  'Objectif production': transformNumber,
  'Défauts': transformNumber,
  'Taux de défaut': transformPercentage,
  'Temps d\'arrêt machine': transformNumber,
  'Heures travaillées': transformHours,
  'Heures prévues': transformHours,
  'Retard (min)': transformNumber,

  'Présence': (val: any) => {
    if (val === null || val === undefined || val === '') return 'present';
    const normalized = String(val).trim().toLowerCase();
    const map: Record<string, string> = {
      'present': 'present',
      'présent': 'present',
      'p': 'present',
      'oui': 'present',
      'o': 'present',
      '1': 'present',
      'absent': 'absent_unjustified',
      'a': 'absent_unjustified',
      'non': 'absent_unjustified',
      'n': 'absent_unjustified',
      '0': 'absent_unjustified',
      'absent_justified': 'absent_justified',
      'absent justifié': 'absent_justified',
      'aj': 'absent_justified',
      'justifié': 'absent_justified',
      'justifie': 'absent_justified',
      'absent_unjustified': 'absent_unjustified',
      'absent non justifié': 'absent_unjustified',
      'anj': 'absent_unjustified',
      'non justifié': 'absent_unjustified',
      'non justifie': 'absent_unjustified',
    };
    return map[normalized] || 'present';
  },

  'Sécurité': transformRating,
  'Qualité': transformRating,
  'Travail d\'équipe': transformRating,
  'Initiative': transformRating,
  'Note globale': transformRating,

  'EPI': transformBoolean,
  'Incident': transformBoolean,

  'Commentaire': (val: any) => {
    if (!val) return null;
    return String(val).trim();
  },
};

function transformNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(String(val).replace(/[\s,]/g, ''));
  return isNaN(num) ? null : num;
}

function transformHours(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(String(val).replace(',', '.').replace(/h/gi, ''));
  return isNaN(num) ? null : num;
}

function transformPercentage(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  let str = String(val).replace(/[\s%]/g, '').replace(',', '.');
  const num = Number(str);
  if (isNaN(num)) return null;
  // If value is > 1, assume it's already a percentage, otherwise convert
  return num > 1 ? num : num * 100;
}

function transformRating(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || num < 1 || num > 5) return null;
  return Math.round(num);
}

function transformBoolean(val: any): boolean | null {
  if (val === null || val === undefined || val === '') return null;
  const normalized = String(val).trim().toLowerCase();
  if (['oui', 'o', 'yes', 'y', '1', 'true'].includes(normalized)) return true;
  if (['non', 'n', 'no', '0', 'false'].includes(normalized)) return false;
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse date from various formats
 * Supports: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, Excel serial dates
 */
export function parseObservationDate(val: any): Date | null {
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

  // Try DD-MM-YYYY format
  const ddmmyyyyDash = parse(str, 'dd-MM-yyyy', new Date());
  if (isValid(ddmmyyyyDash)) return ddmmyyyyDash;

  // Try ISO format (YYYY-MM-DD)
  const iso = parseISO(str);
  if (isValid(iso)) return iso;

  // Try Excel serial date (number of days since 1900-01-01)
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
    if (isValid(date)) return date;
  }

  return null;
}

/**
 * Normalize field name for fuzzy matching
 */
export function normalizeObservationFieldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Spaces to underscores
    .toLowerCase();
}

/**
 * Find mapped field name from Excel header (fuzzy matching)
 */
export function findObservationField(header: string): string | null {
  // Strip asterisks from template headers
  const cleanHeader = header.replace(/\*+$/, '').trim();

  // Direct match first
  if (OBSERVATION_FIELD_MAPPING[cleanHeader]) {
    return OBSERVATION_FIELD_MAPPING[cleanHeader];
  }

  // Fuzzy match by normalized name
  const normalized = normalizeObservationFieldName(cleanHeader);
  for (const [excelField, dbField] of Object.entries(OBSERVATION_FIELD_MAPPING)) {
    if (normalizeObservationFieldName(excelField) === normalized) {
      return dbField;
    }
  }

  return null;
}

/**
 * Strip asterisks from field names
 */
function stripFieldMarkers(fieldName: string): string {
  return fieldName.replace(/\*+$/, '').trim();
}

/**
 * Validate a single field value
 */
export function validateObservationField(fieldName: string, value: any): ValidationResult {
  const cleanFieldName = stripFieldMarkers(fieldName);

  // Check direct match
  if (OBSERVATION_VALIDATORS[cleanFieldName]) {
    return OBSERVATION_VALIDATORS[cleanFieldName](value);
  }

  // Check by normalized name
  for (const [validatorField, validator] of Object.entries(OBSERVATION_VALIDATORS)) {
    if (normalizeObservationFieldName(validatorField) === normalizeObservationFieldName(cleanFieldName)) {
      return validator(value);
    }
  }

  return { valid: true };
}

/**
 * Transform a single field value
 */
export function transformObservationField(fieldName: string, value: any): any {
  const cleanFieldName = stripFieldMarkers(fieldName);

  // Check direct match
  if (OBSERVATION_TRANSFORMERS[cleanFieldName]) {
    return OBSERVATION_TRANSFORMERS[cleanFieldName](value);
  }

  // Check by normalized name
  for (const [transformerField, transformer] of Object.entries(OBSERVATION_TRANSFORMERS)) {
    if (normalizeObservationFieldName(transformerField) === normalizeObservationFieldName(cleanFieldName)) {
      return transformer(value);
    }
  }

  return value;
}

/**
 * Check if a field is required
 */
export function isRequiredObservationField(fieldName: string): boolean {
  const cleanFieldName = stripFieldMarkers(fieldName);
  const normalized = normalizeObservationFieldName(cleanFieldName);

  for (const required of REQUIRED_OBSERVATION_FIELDS) {
    if (normalizeObservationFieldName(required) === normalized) {
      return true;
    }
  }

  return false;
}
