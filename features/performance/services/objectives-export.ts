/**
 * Objectives Export Service
 *
 * Generates Excel exports for performance objectives.
 * Supports French column headers and multi-sheet exports.
 *
 * Export columns:
 * - Matricule, Nom, Prénom
 * - Objectif, Type, Niveau (Entreprise/Équipe/Individuel)
 * - Valeur cible, Valeur actuelle, Unité
 * - Poids, Score d'atteinte (%)
 * - Statut, Date d'échéance
 * - Notes d'évaluation
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface ObjectiveExportData {
  // Employee info
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;

  // Objective info
  objectiveTitle: string;
  objectiveDescription: string | null;
  objectiveType: string; // quantitative, qualitative, behavioral
  objectiveLevel: string; // company, team, individual

  // Metrics
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  weight: number;
  achievementScore: number | null;

  // Status
  status: string; // draft, active, completed, cancelled
  dueDate: string | null;

  // Review
  selfAssessment: string | null;
  managerAssessment: string | null;
  finalNotes: string | null;

  // Cycle info
  cycleName: string;
}

export interface ObjectiveExportOptions {
  cycleName?: string;
  groupByEmployee?: boolean;
  includeDescriptions?: boolean;
  includeAssessments?: boolean;
}

interface ObjectiveExportRow {
  Matricule: string;
  Nom: string;
  Prénom: string;
  Département: string;
  Poste: string;
  Cycle: string;
  Objectif: string;
  Description?: string;
  Type: string;
  Niveau: string;
  'Valeur Cible': string;
  'Valeur Actuelle': string;
  Unité: string;
  Poids: string;
  "Score d'Atteinte": string;
  Statut: string;
  Échéance: string;
  'Auto-évaluation'?: string;
  'Évaluation Manager'?: string;
  'Notes Finales'?: string;
}

// ========================================
// Constants
// ========================================

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  not_started: 'Non démarré',
  in_progress: 'En progression',
  achieved: 'Atteint',
  exceeded: 'Dépassé',
  partially_achieved: 'Partiellement atteint',
  not_achieved: 'Non atteint',
};

const TYPE_LABELS: Record<string, string> = {
  quantitative: 'Quantitatif',
  qualitative: 'Qualitatif',
  behavioral: 'Comportemental',
  developmental: 'Développement',
  project: 'Projet',
};

const LEVEL_LABELS: Record<string, string> = {
  company: 'Entreprise',
  team: 'Équipe',
  individual: 'Individuel',
  department: 'Département',
};

// ========================================
// Helper Functions
// ========================================

const formatValue = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  return `${Math.round(value)}%`;
};

const formatWeight = (weight: number): string => {
  return `${Math.round(weight * 100)}%`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
};

const getStatusLabel = (status: string): string => {
  return STATUS_LABELS[status] || status;
};

const getTypeLabel = (type: string): string => {
  return TYPE_LABELS[type] || type;
};

const getLevelLabel = (level: string): string => {
  return LEVEL_LABELS[level] || level;
};

const truncateText = (text: string | null, maxLength: number = 300): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate Excel export for objectives
 */
export function generateObjectivesExcel(
  objectives: ObjectiveExportData[],
  options: ObjectiveExportOptions = {}
): Buffer {
  const {
    cycleName,
    includeDescriptions = true,
    includeAssessments = true,
  } = options;

  // Transform data to export rows
  const rows: ObjectiveExportRow[] = objectives.map((obj) => {
    const row: ObjectiveExportRow = {
      Matricule: obj.employeeNumber,
      Nom: obj.lastName,
      Prénom: obj.firstName,
      Département: obj.department || '',
      Poste: obj.jobTitle || '',
      Cycle: obj.cycleName,
      Objectif: obj.objectiveTitle,
      Type: getTypeLabel(obj.objectiveType),
      Niveau: getLevelLabel(obj.objectiveLevel),
      'Valeur Cible': formatValue(obj.targetValue),
      'Valeur Actuelle': formatValue(obj.currentValue),
      Unité: obj.unit || '',
      Poids: formatWeight(obj.weight),
      "Score d'Atteinte": formatPercentage(obj.achievementScore),
      Statut: getStatusLabel(obj.status),
      Échéance: formatDate(obj.dueDate),
    };

    if (includeDescriptions) {
      row.Description = truncateText(obj.objectiveDescription);
    }

    if (includeAssessments) {
      row['Auto-évaluation'] = truncateText(obj.selfAssessment);
      row['Évaluation Manager'] = truncateText(obj.managerAssessment);
      row['Notes Finales'] = truncateText(obj.finalNotes);
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
    { wch: 40 }, // Objectif
  ];

  if (includeDescriptions) columnWidths.push({ wch: 50 }); // Description

  columnWidths.push(
    { wch: 15 }, // Type
    { wch: 15 }, // Niveau
    { wch: 12 }, // Valeur Cible
    { wch: 14 }, // Valeur Actuelle
    { wch: 10 }, // Unité
    { wch: 10 }, // Poids
    { wch: 15 }, // Score d'Atteinte
    { wch: 15 }, // Statut
    { wch: 12 }, // Échéance
  );

  if (includeAssessments) {
    columnWidths.push(
      { wch: 40 }, // Auto-évaluation
      { wch: 40 }, // Évaluation Manager
      { wch: 40 }, // Notes Finales
    );
  }

  worksheet['!cols'] = columnWidths;

  // Add sheet to workbook
  const sheetName = cycleName
    ? `Objectifs - ${cycleName}`.substring(0, 31)
    : 'Objectifs';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Add summary sheet
  const summaryData = generateObjectivesSummary(objectives);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

  // Add by-employee summary
  const byEmployeeData = generateByEmployeeSummary(objectives);
  const byEmployeeSheet = XLSX.utils.json_to_sheet(byEmployeeData);
  byEmployeeSheet['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, byEmployeeSheet, 'Par Employé');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate summary statistics for objectives
 */
function generateObjectivesSummary(
  objectives: ObjectiveExportData[]
): Array<{ Métrique: string; Valeur: string | number }> {
  const total = objectives.length;
  const uniqueEmployees = new Set(objectives.map(o => o.employeeNumber)).size;

  // Status distribution
  const completed = objectives.filter(o => o.status === 'completed' || o.status === 'achieved').length;
  const inProgress = objectives.filter(o => o.status === 'active' || o.status === 'in_progress').length;
  const notStarted = objectives.filter(o => o.status === 'draft' || o.status === 'not_started').length;

  // Achievement scores
  const withScores = objectives.filter(o => o.achievementScore != null);
  const avgScore = withScores.length > 0
    ? withScores.reduce((sum, o) => sum + (o.achievementScore ?? 0), 0) / withScores.length
    : 0;

  // Level distribution
  const byLevel = {
    company: objectives.filter(o => o.objectiveLevel === 'company').length,
    team: objectives.filter(o => o.objectiveLevel === 'team').length,
    individual: objectives.filter(o => o.objectiveLevel === 'individual').length,
  };

  // Type distribution
  const byType = {
    quantitative: objectives.filter(o => o.objectiveType === 'quantitative').length,
    qualitative: objectives.filter(o => o.objectiveType === 'qualitative').length,
    behavioral: objectives.filter(o => o.objectiveType === 'behavioral').length,
  };

  return [
    { Métrique: 'Total Objectifs', Valeur: total },
    { Métrique: 'Nombre d\'Employés', Valeur: uniqueEmployees },
    { Métrique: 'Moyenne Objectifs/Employé', Valeur: uniqueEmployees > 0 ? (total / uniqueEmployees).toFixed(1) : 0 },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Terminés', Valeur: completed },
    { Métrique: 'En cours', Valeur: inProgress },
    { Métrique: 'Non démarrés', Valeur: notStarted },
    { Métrique: 'Taux de Complétion', Valeur: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Score Moyen d\'Atteinte', Valeur: avgScore > 0 ? `${avgScore.toFixed(1)}%` : 'N/A' },
    { Métrique: '', Valeur: '' },
    { Métrique: '--- Par Niveau ---', Valeur: '' },
    { Métrique: 'Objectifs Entreprise', Valeur: byLevel.company },
    { Métrique: 'Objectifs Équipe', Valeur: byLevel.team },
    { Métrique: 'Objectifs Individuels', Valeur: byLevel.individual },
    { Métrique: '', Valeur: '' },
    { Métrique: '--- Par Type ---', Valeur: '' },
    { Métrique: 'Quantitatifs', Valeur: byType.quantitative },
    { Métrique: 'Qualitatifs', Valeur: byType.qualitative },
    { Métrique: 'Comportementaux', Valeur: byType.behavioral },
  ];
}

/**
 * Generate per-employee summary
 */
function generateByEmployeeSummary(
  objectives: ObjectiveExportData[]
): Array<{
  Matricule: string;
  'Nom Complet': string;
  'Nb Objectifs': number;
  Complétés: number;
  'Score Moyen': string;
}> {
  // Group by employee
  const byEmployee = new Map<string, ObjectiveExportData[]>();
  for (const obj of objectives) {
    const key = obj.employeeNumber;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, []);
    }
    byEmployee.get(key)!.push(obj);
  }

  // Build summary rows
  const rows: Array<{
    Matricule: string;
    'Nom Complet': string;
    'Nb Objectifs': number;
    Complétés: number;
    'Score Moyen': string;
  }> = [];

  for (const [employeeNumber, objs] of byEmployee) {
    const first = objs[0];
    const completed = objs.filter(o => o.status === 'completed' || o.status === 'achieved').length;
    const withScores = objs.filter(o => o.achievementScore != null);
    const avgScore = withScores.length > 0
      ? withScores.reduce((sum, o) => sum + (o.achievementScore ?? 0), 0) / withScores.length
      : null;

    rows.push({
      Matricule: employeeNumber,
      'Nom Complet': `${first.lastName} ${first.firstName}`,
      'Nb Objectifs': objs.length,
      Complétés: completed,
      'Score Moyen': avgScore != null ? `${avgScore.toFixed(1)}%` : 'N/A',
    });
  }

  // Sort by name
  rows.sort((a, b) => a['Nom Complet'].localeCompare(b['Nom Complet']));

  return rows;
}

/**
 * Generate CSV export for objectives
 */
export function generateObjectivesCSV(
  objectives: ObjectiveExportData[],
  options: ObjectiveExportOptions = {}
): string {
  const {
    includeDescriptions = true,
    includeAssessments = false,
  } = options;

  // Build header
  const headers = [
    'Matricule',
    'Nom',
    'Prénom',
    'Département',
    'Poste',
    'Cycle',
    'Objectif',
  ];

  if (includeDescriptions) headers.push('Description');

  headers.push(
    'Type',
    'Niveau',
    'Valeur Cible',
    'Valeur Actuelle',
    'Unité',
    'Poids',
    "Score d'Atteinte",
    'Statut',
    'Échéance',
  );

  if (includeAssessments) {
    headers.push('Auto-évaluation', 'Évaluation Manager', 'Notes Finales');
  }

  // Build rows
  const rows = objectives.map((obj) => {
    const values = [
      obj.employeeNumber,
      obj.lastName,
      obj.firstName,
      obj.department || '',
      obj.jobTitle || '',
      obj.cycleName,
      escapeCSV(obj.objectiveTitle),
    ];

    if (includeDescriptions) {
      values.push(escapeCSV(truncateText(obj.objectiveDescription)));
    }

    values.push(
      getTypeLabel(obj.objectiveType),
      getLevelLabel(obj.objectiveLevel),
      formatValue(obj.targetValue),
      formatValue(obj.currentValue),
      obj.unit || '',
      formatWeight(obj.weight),
      formatPercentage(obj.achievementScore),
      getStatusLabel(obj.status),
      formatDate(obj.dueDate),
    );

    if (includeAssessments) {
      values.push(
        escapeCSV(truncateText(obj.selfAssessment)),
        escapeCSV(truncateText(obj.managerAssessment)),
        escapeCSV(truncateText(obj.finalNotes)),
      );
    }

    return values.join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Get export filename
 */
export function getObjectivesExportFilename(
  cycleName?: string,
  fileFormat: 'xlsx' | 'csv' = 'xlsx'
): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const cycleSlug = cycleName
    ? cycleName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'all';
  return `objectifs_${cycleSlug}_${dateStr}.${fileFormat}`;
}
