/**
 * Observation Import Template Generator
 *
 * Generates Excel templates for KPI observation imports
 * Pre-filled with column headers and format hints in French
 *
 * Template Versions:
 * - Basic: Production + Attendance + Behavior scores
 * - Extended: All KPI fields including safety and machine metrics
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateConfig {
  type: 'basic' | 'extended' | 'custom';
  includeProduction?: boolean;
  includeAttendance?: boolean;
  includeSafety?: boolean;
  includeBehavior?: boolean;
  includeMachine?: boolean;
  includeExamples?: boolean;
  employees?: Array<{
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department?: string;
  }>;
}

interface ColumnDef {
  header: string;
  width: number;
  hint: string;
  required: boolean;
}

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

const BASE_COLUMNS: ColumnDef[] = [
  { header: 'Matricule*', width: 12, hint: 'Ex: EMP-001', required: true },
  { header: 'Date*', width: 12, hint: 'Ex: 15/01/2025', required: true },
  { header: 'Période', width: 12, hint: 'Journalier / Hebdomadaire', required: false },
];

const PRODUCTION_COLUMNS: ColumnDef[] = [
  { header: 'Unités produites', width: 14, hint: 'Ex: 150', required: false },
  { header: 'Objectif production', width: 16, hint: 'Ex: 200', required: false },
  { header: 'Défauts', width: 10, hint: 'Ex: 3', required: false },
  { header: 'Taux de défaut', width: 14, hint: 'Ex: 2%', required: false },
];

const ATTENDANCE_COLUMNS: ColumnDef[] = [
  { header: 'Heures travaillées', width: 16, hint: 'Ex: 8', required: false },
  { header: 'Heures prévues', width: 14, hint: 'Ex: 8', required: false },
  { header: 'Retard (min)', width: 12, hint: 'Ex: 15', required: false },
  { header: 'Présence', width: 14, hint: 'Présent / Absent / Justifié', required: false },
];

const SAFETY_COLUMNS: ColumnDef[] = [
  { header: 'Sécurité', width: 10, hint: '1-5', required: false },
  { header: 'EPI', width: 8, hint: 'Oui / Non', required: false },
  { header: 'Incident', width: 10, hint: 'Oui / Non', required: false },
];

const BEHAVIOR_COLUMNS: ColumnDef[] = [
  { header: 'Qualité', width: 10, hint: '1-5', required: false },
  { header: 'Travail d\'équipe', width: 16, hint: '1-5', required: false },
  { header: 'Initiative', width: 12, hint: '1-5', required: false },
];

const MACHINE_COLUMNS: ColumnDef[] = [
  { header: 'Temps d\'arrêt machine', width: 18, hint: 'Minutes', required: false },
];

const COMMENT_COLUMN: ColumnDef = {
  header: 'Commentaire',
  width: 40,
  hint: 'Remarques libres',
  required: false,
};

const OVERALL_COLUMN: ColumnDef = {
  header: 'Note globale',
  width: 12,
  hint: '1-5',
  required: false,
};

// ============================================================================
// TEMPLATE GENERATORS
// ============================================================================

/**
 * Generate observation import template
 */
export function generateObservationTemplate(config: TemplateConfig = { type: 'basic' }): Buffer {
  const columns = getColumnsForConfig(config);

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create main data sheet
  const headers = columns.map(c => c.header);
  const hints = columns.map(c => c.hint);

  // Build sheet data
  const sheetData: any[][] = [headers, hints];

  // Add example rows if configured
  if (config.includeExamples) {
    sheetData.push(generateExampleRow(columns, 1));
    sheetData.push(generateExampleRow(columns, 2));
  }

  // Add pre-filled employee rows if provided
  if (config.employees && config.employees.length > 0) {
    const today = format(new Date(), 'dd/MM/yyyy', { locale: fr });

    for (const employee of config.employees) {
      const row = columns.map(col => {
        if (col.header === 'Matricule*') return employee.employeeNumber;
        if (col.header === 'Date*') return today;
        if (col.header === 'Période') return 'Journalier';
        return '';
      });
      sheetData.push(row);
    }
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  worksheet['!cols'] = columns.map(c => ({ wch: c.width }));

  // Style hint row (row 2)
  // Note: Basic xlsx doesn't support cell styles, but we can add comments

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Observations');

  // Add instructions sheet
  const instructionsSheet = createInstructionsSheet(config);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Add rating scale reference
  const ratingSheet = createRatingScaleSheet();
  XLSX.utils.book_append_sheet(workbook, ratingSheet, 'Échelle Notation');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate basic template (most common use case)
 */
export function generateBasicTemplate(): Buffer {
  return generateObservationTemplate({
    type: 'basic',
    includeProduction: true,
    includeAttendance: true,
    includeBehavior: true,
    includeExamples: true,
  });
}

/**
 * Generate extended template with all fields
 */
export function generateExtendedTemplate(): Buffer {
  return generateObservationTemplate({
    type: 'extended',
    includeProduction: true,
    includeAttendance: true,
    includeSafety: true,
    includeBehavior: true,
    includeMachine: true,
    includeExamples: true,
  });
}

/**
 * Generate template pre-filled with employee list
 */
export function generatePrefilledTemplate(
  employees: Array<{
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department?: string;
  }>,
  config: Partial<TemplateConfig> = {}
): Buffer {
  return generateObservationTemplate({
    type: config.type || 'basic',
    includeProduction: config.includeProduction ?? true,
    includeAttendance: config.includeAttendance ?? true,
    includeSafety: config.includeSafety ?? false,
    includeBehavior: config.includeBehavior ?? true,
    includeExamples: false,
    employees,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getColumnsForConfig(config: TemplateConfig): ColumnDef[] {
  const columns: ColumnDef[] = [...BASE_COLUMNS];

  if (config.type === 'extended') {
    // Extended includes everything
    columns.push(...PRODUCTION_COLUMNS);
    columns.push(...ATTENDANCE_COLUMNS);
    columns.push(...SAFETY_COLUMNS);
    columns.push(...MACHINE_COLUMNS);
    columns.push(...BEHAVIOR_COLUMNS);
    columns.push(OVERALL_COLUMN);
    columns.push(COMMENT_COLUMN);
  } else if (config.type === 'custom') {
    // Custom based on individual flags
    if (config.includeProduction) columns.push(...PRODUCTION_COLUMNS);
    if (config.includeAttendance) columns.push(...ATTENDANCE_COLUMNS);
    if (config.includeSafety) columns.push(...SAFETY_COLUMNS);
    if (config.includeMachine) columns.push(...MACHINE_COLUMNS);
    if (config.includeBehavior) columns.push(...BEHAVIOR_COLUMNS);
    columns.push(OVERALL_COLUMN);
    columns.push(COMMENT_COLUMN);
  } else {
    // Basic template
    columns.push(...PRODUCTION_COLUMNS.slice(0, 2)); // Units + Target only
    columns.push(...ATTENDANCE_COLUMNS.slice(0, 2)); // Hours worked + expected
    columns.push(...BEHAVIOR_COLUMNS);
    columns.push(OVERALL_COLUMN);
    columns.push(COMMENT_COLUMN);
  }

  return columns;
}

function generateExampleRow(columns: ColumnDef[], rowNum: number): string[] {
  const today = new Date();
  const date = new Date(today);
  date.setDate(date.getDate() - rowNum);

  return columns.map(col => {
    const header = col.header.replace('*', '');
    switch (header) {
      case 'Matricule':
        return rowNum === 1 ? 'EMP-001' : 'EMP-002';
      case 'Date':
        return format(date, 'dd/MM/yyyy', { locale: fr });
      case 'Période':
        return 'Journalier';
      case 'Unités produites':
        return rowNum === 1 ? '145' : '160';
      case 'Objectif production':
        return '150';
      case 'Défauts':
        return rowNum === 1 ? '2' : '1';
      case 'Taux de défaut':
        return rowNum === 1 ? '1.4%' : '0.6%';
      case 'Heures travaillées':
        return '8';
      case 'Heures prévues':
        return '8';
      case 'Retard (min)':
        return rowNum === 1 ? '0' : '10';
      case 'Présence':
        return 'Présent';
      case 'Sécurité':
        return rowNum === 1 ? '5' : '4';
      case 'EPI':
        return 'Oui';
      case 'Incident':
        return 'Non';
      case 'Qualité':
        return rowNum === 1 ? '4' : '5';
      case 'Travail d\'équipe':
        return '4';
      case 'Initiative':
        return rowNum === 1 ? '3' : '4';
      case 'Temps d\'arrêt machine':
        return rowNum === 1 ? '15' : '0';
      case 'Note globale':
        return rowNum === 1 ? '4' : '5';
      case 'Commentaire':
        return rowNum === 1 ? 'Bonne journée, léger retard machine' : 'Excellent travail';
      default:
        return '';
    }
  });
}

function createInstructionsSheet(config: TemplateConfig): XLSX.WorkSheet {
  const templateType = config.type === 'extended' ? 'Étendu' : 'Standard';

  const instructions = [
    ['INSTRUCTIONS D\'IMPORTATION DES OBSERVATIONS'],
    [''],
    ['Modèle:', templateType],
    ['Généré le:', format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })],
    [''],
    ['CHAMPS OBLIGATOIRES'],
    ['- Matricule*: Numéro de matricule de l\'employé (doit exister dans le système)'],
    ['- Date*: Date de l\'observation au format JJ/MM/AAAA'],
    [''],
    ['CHAMPS OPTIONNELS'],
    ['- Période: Journalier (par défaut), Hebdomadaire, ou Mensuel'],
    ['- Les autres champs sont optionnels mais recommandés'],
    [''],
    ['ÉCHELLE DE NOTATION'],
    ['- Les notes (Qualité, Sécurité, etc.) sont de 1 à 5:'],
    ['  1 = Insuffisant'],
    ['  2 = À améliorer'],
    ['  3 = Satisfaisant'],
    ['  4 = Bon'],
    ['  5 = Excellent'],
    [''],
    ['PRÉSENCE'],
    ['- Présent ou P: L\'employé était présent'],
    ['- Absent ou A: Absence non justifiée'],
    ['- Justifié ou AJ: Absence justifiée (maladie, congé, etc.)'],
    [''],
    ['CONSEILS'],
    ['1. Ne modifiez pas la première ligne (en-têtes)'],
    ['2. La deuxième ligne contient des exemples de format'],
    ['3. Supprimez les lignes d\'exemple avant d\'importer'],
    ['4. Vérifiez que les matricules correspondent au système'],
    ['5. Une observation par employé par jour'],
    [''],
    ['SUPPORT'],
    ['En cas de problème, contactez l\'équipe RH'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(instructions);
  worksheet['!cols'] = [{ wch: 80 }];

  return worksheet;
}

function createRatingScaleSheet(): XLSX.WorkSheet {
  const data = [
    ['ÉCHELLE DE NOTATION (1-5)'],
    [''],
    ['Note', 'Niveau', 'Description'],
    ['1', 'Insuffisant', 'Performance nettement en dessous des attentes, nécessite une intervention immédiate'],
    ['2', 'À améliorer', 'Performance en dessous des attentes, des améliorations sont nécessaires'],
    ['3', 'Satisfaisant', 'Performance conforme aux attentes, objectifs atteints'],
    ['4', 'Bon', 'Performance au-dessus des attentes, dépasse parfois les objectifs'],
    ['5', 'Excellent', 'Performance exceptionnelle, dépasse systématiquement les objectifs'],
    [''],
    ['INDICATEURS PAR CATÉGORIE'],
    [''],
    ['Qualité (du travail)'],
    ['1 - Nombreuses erreurs, rebus fréquents'],
    ['2 - Quelques erreurs récurrentes'],
    ['3 - Travail conforme aux standards'],
    ['4 - Travail de haute qualité, peu d\'erreurs'],
    ['5 - Travail impeccable, référence pour l\'équipe'],
    [''],
    ['Sécurité'],
    ['1 - Non-respect des consignes, comportement dangereux'],
    ['2 - Respect partiel, rappels fréquents nécessaires'],
    ['3 - Respect des consignes de base'],
    ['4 - Vigilant, signale les risques'],
    ['5 - Exemplaire, forme les autres'],
    [''],
    ['Travail d\'équipe'],
    ['1 - Conflits, travail isolé'],
    ['2 - Collaboration minimale'],
    ['3 - Coopère quand demandé'],
    ['4 - Aide activement les collègues'],
    ['5 - Leader naturel, améliore la cohésion'],
    [''],
    ['Initiative'],
    ['1 - Attend toujours les instructions'],
    ['2 - Suit les instructions à la lettre'],
    ['3 - Propose parfois des idées'],
    ['4 - Proactif, résout les problèmes'],
    ['5 - Innovant, améliore les processus'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 60 }];

  return worksheet;
}

// ============================================================================
// FILENAME GENERATOR
// ============================================================================

/**
 * Generate template filename
 */
export function getTemplateFilename(type: 'basic' | 'extended' = 'basic'): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const typeLabel = type === 'extended' ? 'complet' : 'standard';
  return `modele_observations_${typeLabel}_${dateStr}.xlsx`;
}

/**
 * Generate prefilled template filename
 */
export function getPrefilledTemplateFilename(department?: string): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const deptSlug = department
    ? department.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'all';
  return `observations_${deptSlug}_${dateStr}.xlsx`;
}
