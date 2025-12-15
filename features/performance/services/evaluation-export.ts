/**
 * Evaluation Export Service
 *
 * Generates Excel exports for performance evaluations.
 * Supports French column headers and multi-sheet exports.
 *
 * Export columns:
 * - Matricule, Nom, Prénom, Département, Poste
 * - Cycle, Type d'évaluation, Statut
 * - Score objectifs, Score compétences, Score global
 * - Note globale (Exceeds/Meets/Below)
 * - Points forts, Axes d'amélioration
 * - Date soumission, Date validation
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface EvaluationExportData {
  // Employee info
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;

  // Cycle info
  cycleName: string;
  cycleType: string;

  // Evaluation status
  status: string;
  evaluationType: string; // self, manager, peer

  // Scores
  objectivesScore: number | null;
  competenciesScore: number | null;
  overallScore: number | null;
  overallRating: string | null; // exceeds_expectations, meets_expectations, below_expectations

  // Feedback
  strengths: string | null;
  areasForImprovement: string | null;
  developmentPlanComment: string | null;

  // Dates
  submittedAt: Date | null;
  validatedAt: Date | null;
  createdAt: Date;
}

export interface EvaluationExportOptions {
  cycleName?: string;
  periodStart?: Date;
  periodEnd?: Date;
  includeStrengths?: boolean;
  includeAreas?: boolean;
  includeDevelopmentPlan?: boolean;
}

interface EvaluationExportRow {
  Matricule: string;
  Nom: string;
  Prénom: string;
  Département: string;
  Poste: string;
  Cycle: string;
  "Type d'évaluation": string;
  Statut: string;
  'Score Objectifs': string;
  'Score Compétences': string;
  'Score Global': string;
  'Note Globale': string;
  'Points Forts'?: string;
  "Axes d'Amélioration"?: string;
  'Plan de Développement'?: string;
  'Date Soumission': string;
  'Date Validation': string;
}

// ========================================
// Constants
// ========================================

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  acknowledged: 'Prise en compte',
  in_review: 'En révision',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const EVALUATION_TYPE_LABELS: Record<string, string> = {
  self: 'Auto-évaluation',
  manager: 'Évaluation manager',
  peer: 'Évaluation pair',
  direct_report: 'Évaluation collaborateur',
};

const RATING_LABELS: Record<string, string> = {
  exceeds_expectations: 'Dépasse les attentes',
  meets_expectations: 'Atteint les attentes',
  below_expectations: 'En dessous des attentes',
  needs_improvement: 'Amélioration nécessaire',
  exceptional: 'Exceptionnel',
};

// ========================================
// Helper Functions
// ========================================

const formatScore = (score: number | null): string => {
  if (score === null || score === undefined) return '';
  return `${Math.round(score * 100) / 100}`;
};

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
};

const getStatusLabel = (status: string): string => {
  return STATUS_LABELS[status] || status;
};

const getEvaluationTypeLabel = (type: string): string => {
  return EVALUATION_TYPE_LABELS[type] || type;
};

const getRatingLabel = (rating: string | null): string => {
  if (!rating) return '';
  return RATING_LABELS[rating] || rating;
};

const truncateText = (text: string | null, maxLength: number = 500): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate Excel export for evaluations
 */
export function generateEvaluationExcel(
  evaluations: EvaluationExportData[],
  options: EvaluationExportOptions = {}
): Buffer {
  const {
    cycleName,
    periodStart,
    periodEnd,
    includeStrengths = true,
    includeAreas = true,
    includeDevelopmentPlan = false,
  } = options;

  // Transform data to export rows
  const rows: EvaluationExportRow[] = evaluations.map((eval_) => {
    const row: EvaluationExportRow = {
      Matricule: eval_.employeeNumber,
      Nom: eval_.lastName,
      Prénom: eval_.firstName,
      Département: eval_.department || '',
      Poste: eval_.jobTitle || '',
      Cycle: eval_.cycleName,
      "Type d'évaluation": getEvaluationTypeLabel(eval_.evaluationType),
      Statut: getStatusLabel(eval_.status),
      'Score Objectifs': formatScore(eval_.objectivesScore),
      'Score Compétences': formatScore(eval_.competenciesScore),
      'Score Global': formatScore(eval_.overallScore),
      'Note Globale': getRatingLabel(eval_.overallRating),
      'Date Soumission': formatDate(eval_.submittedAt),
      'Date Validation': formatDate(eval_.validatedAt),
    };

    if (includeStrengths) {
      row['Points Forts'] = truncateText(eval_.strengths);
    }

    if (includeAreas) {
      row["Axes d'Amélioration"] = truncateText(eval_.areasForImprovement);
    }

    if (includeDevelopmentPlan) {
      row['Plan de Développement'] = truncateText(eval_.developmentPlanComment);
    }

    return row;
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create main data sheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const columnWidths = [
    { wch: 12 }, // Matricule
    { wch: 15 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 20 }, // Département
    { wch: 20 }, // Poste
    { wch: 25 }, // Cycle
    { wch: 20 }, // Type d'évaluation
    { wch: 15 }, // Statut
    { wch: 12 }, // Score Objectifs
    { wch: 15 }, // Score Compétences
    { wch: 12 }, // Score Global
    { wch: 20 }, // Note Globale
  ];

  if (includeStrengths) columnWidths.push({ wch: 50 });
  if (includeAreas) columnWidths.push({ wch: 50 });
  if (includeDevelopmentPlan) columnWidths.push({ wch: 50 });
  columnWidths.push({ wch: 15 }); // Date Soumission
  columnWidths.push({ wch: 15 }); // Date Validation

  worksheet['!cols'] = columnWidths;

  // Add sheet to workbook
  const sheetName = cycleName
    ? `Évaluations - ${cycleName}`.substring(0, 31) // Excel sheet name limit
    : 'Évaluations';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Add summary sheet
  const summaryData = generateEvaluationSummary(evaluations);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate summary statistics for evaluations
 */
function generateEvaluationSummary(
  evaluations: EvaluationExportData[]
): Array<{ Métrique: string; Valeur: string | number }> {
  const total = evaluations.length;
  const completed = evaluations.filter(e => e.status === 'completed').length;
  const submitted = evaluations.filter(e => e.status === 'submitted').length;
  const draft = evaluations.filter(e => e.status === 'draft').length;

  // Score averages
  const scoresWithValues = evaluations.filter(e => e.overallScore != null);
  const avgScore = scoresWithValues.length > 0
    ? scoresWithValues.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / scoresWithValues.length
    : 0;

  // Rating distribution
  const exceeds = evaluations.filter(e => e.overallRating === 'exceeds_expectations').length;
  const meets = evaluations.filter(e => e.overallRating === 'meets_expectations').length;
  const below = evaluations.filter(e => e.overallRating === 'below_expectations').length;

  return [
    { Métrique: 'Total Évaluations', Valeur: total },
    { Métrique: 'Terminées', Valeur: completed },
    { Métrique: 'Soumises', Valeur: submitted },
    { Métrique: 'Brouillons', Valeur: draft },
    { Métrique: 'Taux de Complétion', Valeur: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Score Moyen', Valeur: avgScore > 0 ? avgScore.toFixed(2) : 'N/A' },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Dépasse les attentes', Valeur: exceeds },
    { Métrique: 'Atteint les attentes', Valeur: meets },
    { Métrique: 'En dessous des attentes', Valeur: below },
  ];
}

/**
 * Generate CSV export for evaluations
 */
export function generateEvaluationCSV(
  evaluations: EvaluationExportData[],
  options: EvaluationExportOptions = {}
): string {
  const {
    includeStrengths = true,
    includeAreas = true,
    includeDevelopmentPlan = false,
  } = options;

  // Build header
  const headers = [
    'Matricule',
    'Nom',
    'Prénom',
    'Département',
    'Poste',
    'Cycle',
    "Type d'évaluation",
    'Statut',
    'Score Objectifs',
    'Score Compétences',
    'Score Global',
    'Note Globale',
  ];

  if (includeStrengths) headers.push('Points Forts');
  if (includeAreas) headers.push("Axes d'Amélioration");
  if (includeDevelopmentPlan) headers.push('Plan de Développement');
  headers.push('Date Soumission', 'Date Validation');

  // Build rows
  const rows = evaluations.map((eval_) => {
    const values = [
      eval_.employeeNumber,
      eval_.lastName,
      eval_.firstName,
      eval_.department || '',
      eval_.jobTitle || '',
      eval_.cycleName,
      getEvaluationTypeLabel(eval_.evaluationType),
      getStatusLabel(eval_.status),
      formatScore(eval_.objectivesScore),
      formatScore(eval_.competenciesScore),
      formatScore(eval_.overallScore),
      getRatingLabel(eval_.overallRating),
    ];

    if (includeStrengths) values.push(escapeCSV(truncateText(eval_.strengths)));
    if (includeAreas) values.push(escapeCSV(truncateText(eval_.areasForImprovement)));
    if (includeDevelopmentPlan) values.push(escapeCSV(truncateText(eval_.developmentPlanComment)));
    values.push(formatDate(eval_.submittedAt), formatDate(eval_.validatedAt));

    return values.join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // If contains semicolon, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Get export filename
 */
export function getEvaluationExportFilename(
  cycleName?: string,
  fileFormat: 'xlsx' | 'csv' = 'xlsx'
): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const cycleSlug = cycleName
    ? cycleName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'all';
  return `evaluations_${cycleSlug}_${dateStr}.${fileFormat}`;
}
