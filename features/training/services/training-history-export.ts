/**
 * Training History Export Service
 *
 * Generates Excel exports for employee training history.
 * Supports French column headers and multi-sheet exports.
 *
 * Export columns:
 * - Matricule, Nom, Prénom, Département
 * - Formation, Catégorie, Modalité
 * - Session, Date début, Date fin
 * - Heures, Statut, Score évaluation
 * - Certificat obtenu, Date expiration
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface TrainingHistoryExportData {
  // Employee info
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;

  // Course info
  courseCode: string;
  courseName: string;
  category: string;
  modality: string;
  durationHours: number;
  provider: string | null;
  isExternal: boolean;

  // Session info
  sessionCode: string;
  sessionName: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  instructorName: string | null;

  // Enrollment status
  enrollmentStatus: string; // enrolled, attended, completed, no_show, cancelled
  attendancePercentage: number | null;
  completionStatus: string | null; // passed, failed, pending
  completionScore: number | null;
  completedAt: Date | null;

  // Certification
  grantsCertification: boolean;
  certificationObtained: boolean;
  certificationName: string | null;
  certificationExpiryDate: string | null;

  // Notes
  enrollmentNotes: string | null;
}

export interface TrainingHistoryExportOptions {
  dateFrom?: string;
  dateTo?: string;
  includeIncompletePeriod?: boolean;
  groupByEmployee?: boolean;
}

interface TrainingHistoryExportRow {
  Matricule: string;
  Nom: string;
  Prénom: string;
  Département: string;
  Poste: string;
  'Code Formation': string;
  Formation: string;
  Catégorie: string;
  Modalité: string;
  Prestataire: string;
  'Code Session': string;
  'Date Début': string;
  'Date Fin': string;
  'Durée (heures)': number;
  Lieu: string;
  Formateur: string;
  'Statut Inscription': string;
  'Présence (%)': string;
  'Résultat': string;
  Score: string;
  'Date Achèvement': string;
  'Certificat Obtenu': string;
  'Certificat': string;
  'Expiration Certificat': string;
  Notes: string;
}

// ========================================
// Constants
// ========================================

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrit',
  attended: 'Présent',
  completed: 'Terminé',
  no_show: 'Absent',
  cancelled: 'Annulé',
};

const COMPLETION_STATUS_LABELS: Record<string, string> = {
  passed: 'Réussi',
  failed: 'Échoué',
  pending: 'En attente',
};

const CATEGORY_LABELS: Record<string, string> = {
  securite: 'Sécurité',
  technique: 'Technique',
  soft_skills: 'Compétences Transversales',
  management: 'Management',
  reglementaire: 'Réglementaire',
  informatique: 'Informatique',
  langues: 'Langues',
  qualite: 'Qualité',
  hse: 'HSE',
  other: 'Autre',
};

const MODALITY_LABELS: Record<string, string> = {
  in_person: 'Présentiel',
  virtual: 'Virtuel',
  e_learning: 'E-learning',
  blended: 'Mixte',
  on_the_job: 'Sur le poste',
};

// ========================================
// Helper Functions
// ========================================

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (date: Date | null): string => {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr });
  } catch {
    return '';
  }
};

const getEnrollmentStatusLabel = (status: string): string => {
  return ENROLLMENT_STATUS_LABELS[status] || status;
};

const getCompletionStatusLabel = (status: string | null): string => {
  if (!status) return '';
  return COMPLETION_STATUS_LABELS[status] || status;
};

const getCategoryLabel = (category: string): string => {
  return CATEGORY_LABELS[category] || category;
};

const getModalityLabel = (modality: string): string => {
  return MODALITY_LABELS[modality] || modality;
};

const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  return `${Math.round(value)}%`;
};

const formatScore = (score: number | null): string => {
  if (score === null || score === undefined) return '';
  return String(score);
};

// ========================================
// Export Functions
// ========================================

/**
 * Generate Excel export for training history
 */
export function generateTrainingHistoryExcel(
  history: TrainingHistoryExportData[],
  options: TrainingHistoryExportOptions = {}
): Buffer {
  const { dateFrom, dateTo } = options;

  // Transform data to export rows
  const rows: TrainingHistoryExportRow[] = history.map((record) => ({
    Matricule: record.employeeNumber,
    Nom: record.lastName,
    Prénom: record.firstName,
    Département: record.department || '',
    Poste: record.jobTitle || '',
    'Code Formation': record.courseCode,
    Formation: record.courseName,
    Catégorie: getCategoryLabel(record.category),
    Modalité: getModalityLabel(record.modality),
    Prestataire: record.isExternal
      ? (record.provider || 'Externe')
      : 'Interne',
    'Code Session': record.sessionCode,
    'Date Début': formatDate(record.startDate),
    'Date Fin': formatDate(record.endDate),
    'Durée (heures)': record.durationHours,
    Lieu: record.location || (record.modality === 'virtual' ? 'En ligne' : ''),
    Formateur: record.instructorName || '',
    'Statut Inscription': getEnrollmentStatusLabel(record.enrollmentStatus),
    'Présence (%)': formatPercentage(record.attendancePercentage),
    'Résultat': getCompletionStatusLabel(record.completionStatus),
    Score: formatScore(record.completionScore),
    'Date Achèvement': formatDateTime(record.completedAt),
    'Certificat Obtenu': record.certificationObtained ? 'Oui' : (record.grantsCertification ? 'Non' : ''),
    'Certificat': record.certificationName || '',
    'Expiration Certificat': formatDate(record.certificationExpiryDate),
    Notes: record.enrollmentNotes || '',
  }));

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create main data sheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Matricule
    { wch: 15 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 20 }, // Département
    { wch: 20 }, // Poste
    { wch: 15 }, // Code Formation
    { wch: 40 }, // Formation
    { wch: 20 }, // Catégorie
    { wch: 15 }, // Modalité
    { wch: 20 }, // Prestataire
    { wch: 15 }, // Code Session
    { wch: 12 }, // Date Début
    { wch: 12 }, // Date Fin
    { wch: 12 }, // Durée (heures)
    { wch: 25 }, // Lieu
    { wch: 20 }, // Formateur
    { wch: 15 }, // Statut Inscription
    { wch: 12 }, // Présence (%)
    { wch: 12 }, // Résultat
    { wch: 10 }, // Score
    { wch: 15 }, // Date Achèvement
    { wch: 15 }, // Certificat Obtenu
    { wch: 30 }, // Certificat
    { wch: 15 }, // Expiration Certificat
    { wch: 30 }, // Notes
  ];

  // Build sheet name
  let sheetName = 'Historique Formations';
  if (dateFrom && dateTo) {
    sheetName = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`.substring(0, 31);
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Add summary sheet
  const summaryData = generateTrainingSummary(history);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

  // Add per-employee summary
  const byEmployeeData = generateByEmployeeTrainingSummary(history);
  const byEmployeeSheet = XLSX.utils.json_to_sheet(byEmployeeData);
  byEmployeeSheet['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, byEmployeeSheet, 'Par Employé');

  // Add per-course summary
  const byCourseData = generateByCourseSummary(history);
  const byCourseSheet = XLSX.utils.json_to_sheet(byCourseData);
  byCourseSheet['!cols'] = [
    { wch: 15 },
    { wch: 40 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, byCourseSheet, 'Par Formation');

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate overall summary statistics
 */
function generateTrainingSummary(
  history: TrainingHistoryExportData[]
): Array<{ Métrique: string; Valeur: string | number }> {
  const total = history.length;
  const uniqueEmployees = new Set(history.map(h => h.employeeNumber)).size;
  const uniqueCourses = new Set(history.map(h => h.courseCode)).size;
  const uniqueSessions = new Set(history.map(h => h.sessionCode)).size;

  // Status distribution
  const completed = history.filter(h => h.enrollmentStatus === 'completed').length;
  const attended = history.filter(h => h.enrollmentStatus === 'attended').length;
  const enrolled = history.filter(h => h.enrollmentStatus === 'enrolled').length;
  const noShow = history.filter(h => h.enrollmentStatus === 'no_show').length;
  const cancelled = history.filter(h => h.enrollmentStatus === 'cancelled').length;

  // Completion results
  const passed = history.filter(h => h.completionStatus === 'passed').length;
  const failed = history.filter(h => h.completionStatus === 'failed').length;

  // Hours
  const totalHours = history.reduce((sum, h) => {
    if (h.enrollmentStatus === 'completed' || h.enrollmentStatus === 'attended') {
      return sum + h.durationHours;
    }
    return sum;
  }, 0);

  // Certifications
  const certificationsObtained = history.filter(h => h.certificationObtained).length;

  // By category
  const byCategory = new Map<string, number>();
  for (const record of history) {
    const cat = record.category;
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
  }

  // By modality
  const byModality = new Map<string, number>();
  for (const record of history) {
    const mod = record.modality;
    byModality.set(mod, (byModality.get(mod) || 0) + 1);
  }

  const results: Array<{ Métrique: string; Valeur: string | number }> = [
    { Métrique: 'Total Inscriptions', Valeur: total },
    { Métrique: 'Nombre d\'Employés', Valeur: uniqueEmployees },
    { Métrique: 'Nombre de Formations', Valeur: uniqueCourses },
    { Métrique: 'Nombre de Sessions', Valeur: uniqueSessions },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Heures de Formation (Total)', Valeur: totalHours },
    { Métrique: 'Heures Moyennes/Employé', Valeur: uniqueEmployees > 0 ? (totalHours / uniqueEmployees).toFixed(1) : 0 },
    { Métrique: '', Valeur: '' },
    { Métrique: '--- Statut Inscriptions ---', Valeur: '' },
    { Métrique: 'Terminées', Valeur: completed },
    { Métrique: 'Présents', Valeur: attended },
    { Métrique: 'Inscrits', Valeur: enrolled },
    { Métrique: 'Absents', Valeur: noShow },
    { Métrique: 'Annulées', Valeur: cancelled },
    { Métrique: '', Valeur: '' },
    { Métrique: '--- Résultats ---', Valeur: '' },
    { Métrique: 'Réussis', Valeur: passed },
    { Métrique: 'Échoués', Valeur: failed },
    { Métrique: 'Taux de Réussite', Valeur: passed + failed > 0 ? `${Math.round((passed / (passed + failed)) * 100)}%` : 'N/A' },
    { Métrique: '', Valeur: '' },
    { Métrique: 'Certificats Obtenus', Valeur: certificationsObtained },
    { Métrique: '', Valeur: '' },
    { Métrique: '--- Par Catégorie ---', Valeur: '' },
  ];

  for (const [cat, count] of byCategory.entries()) {
    results.push({ Métrique: getCategoryLabel(cat), Valeur: count });
  }

  results.push({ Métrique: '', Valeur: '' });
  results.push({ Métrique: '--- Par Modalité ---', Valeur: '' });

  for (const [mod, count] of byModality.entries()) {
    results.push({ Métrique: getModalityLabel(mod), Valeur: count });
  }

  return results;
}

/**
 * Generate per-employee training summary
 */
function generateByEmployeeTrainingSummary(
  history: TrainingHistoryExportData[]
): Array<{
  Matricule: string;
  'Nom Complet': string;
  Département: string;
  'Nb Formations': number;
  'Heures Total': number;
  Terminées: number;
  'Certificats': number;
}> {
  // Group by employee
  const byEmployee = new Map<string, TrainingHistoryExportData[]>();
  for (const record of history) {
    const key = record.employeeNumber;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, []);
    }
    byEmployee.get(key)!.push(record);
  }

  // Build summary rows
  const rows: Array<{
    Matricule: string;
    'Nom Complet': string;
    Département: string;
    'Nb Formations': number;
    'Heures Total': number;
    Terminées: number;
    'Certificats': number;
  }> = [];

  for (const [employeeNumber, records] of byEmployee) {
    const first = records[0];
    const completed = records.filter(r =>
      r.enrollmentStatus === 'completed' || r.enrollmentStatus === 'attended'
    ).length;

    const totalHours = records.reduce((sum, r) => {
      if (r.enrollmentStatus === 'completed' || r.enrollmentStatus === 'attended') {
        return sum + r.durationHours;
      }
      return sum;
    }, 0);

    const certs = records.filter(r => r.certificationObtained).length;

    rows.push({
      Matricule: employeeNumber,
      'Nom Complet': `${first.lastName} ${first.firstName}`,
      Département: first.department || '',
      'Nb Formations': records.length,
      'Heures Total': totalHours,
      Terminées: completed,
      'Certificats': certs,
    });
  }

  // Sort by name
  rows.sort((a, b) => a['Nom Complet'].localeCompare(b['Nom Complet']));

  return rows;
}

/**
 * Generate per-course summary
 */
function generateByCourseSummary(
  history: TrainingHistoryExportData[]
): Array<{
  'Code Formation': string;
  Formation: string;
  Catégorie: string;
  'Nb Inscrits': number;
  Terminés: number;
  'Taux Complétion': string;
}> {
  // Group by course
  const byCourse = new Map<string, TrainingHistoryExportData[]>();
  for (const record of history) {
    const key = record.courseCode;
    if (!byCourse.has(key)) {
      byCourse.set(key, []);
    }
    byCourse.get(key)!.push(record);
  }

  // Build summary rows
  const rows: Array<{
    'Code Formation': string;
    Formation: string;
    Catégorie: string;
    'Nb Inscrits': number;
    Terminés: number;
    'Taux Complétion': string;
  }> = [];

  for (const [courseCode, records] of byCourse) {
    const first = records[0];
    const completed = records.filter(r =>
      r.enrollmentStatus === 'completed' || r.enrollmentStatus === 'attended'
    ).length;

    const completionRate = records.length > 0
      ? Math.round((completed / records.length) * 100)
      : 0;

    rows.push({
      'Code Formation': courseCode,
      Formation: first.courseName,
      Catégorie: getCategoryLabel(first.category),
      'Nb Inscrits': records.length,
      Terminés: completed,
      'Taux Complétion': `${completionRate}%`,
    });
  }

  // Sort by course name
  rows.sort((a, b) => a.Formation.localeCompare(b.Formation));

  return rows;
}

/**
 * Generate CSV export for training history
 */
export function generateTrainingHistoryCSV(
  history: TrainingHistoryExportData[]
): string {
  const headers = [
    'Matricule',
    'Nom',
    'Prénom',
    'Département',
    'Poste',
    'Code Formation',
    'Formation',
    'Catégorie',
    'Modalité',
    'Prestataire',
    'Code Session',
    'Date Début',
    'Date Fin',
    'Durée (heures)',
    'Lieu',
    'Formateur',
    'Statut Inscription',
    'Présence (%)',
    'Résultat',
    'Score',
    'Date Achèvement',
    'Certificat Obtenu',
    'Certificat',
    'Expiration Certificat',
  ];

  const rows = history.map((record) => {
    const values = [
      record.employeeNumber,
      record.lastName,
      record.firstName,
      record.department || '',
      record.jobTitle || '',
      record.courseCode,
      escapeCSV(record.courseName),
      getCategoryLabel(record.category),
      getModalityLabel(record.modality),
      record.isExternal ? (record.provider || 'Externe') : 'Interne',
      record.sessionCode,
      formatDate(record.startDate),
      formatDate(record.endDate),
      String(record.durationHours),
      escapeCSV(record.location || ''),
      escapeCSV(record.instructorName || ''),
      getEnrollmentStatusLabel(record.enrollmentStatus),
      formatPercentage(record.attendancePercentage),
      getCompletionStatusLabel(record.completionStatus),
      formatScore(record.completionScore),
      formatDateTime(record.completedAt),
      record.certificationObtained ? 'Oui' : (record.grantsCertification ? 'Non' : ''),
      escapeCSV(record.certificationName || ''),
      formatDate(record.certificationExpiryDate),
    ];

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
export function getTrainingHistoryExportFilename(
  dateFrom?: string,
  dateTo?: string,
  fileFormat: 'xlsx' | 'csv' = 'xlsx'
): string {
  const dateStr = format(new Date(), 'yyyy-MM-dd');

  if (dateFrom && dateTo) {
    const fromStr = dateFrom.substring(0, 7).replace('-', '');
    const toStr = dateTo.substring(0, 7).replace('-', '');
    return `historique_formations_${fromStr}_${toStr}.${fileFormat}`;
  }

  return `historique_formations_${dateStr}.${fileFormat}`;
}
