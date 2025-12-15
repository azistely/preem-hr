/**
 * Attendance Excel Export Service
 *
 * Generates Excel (.xlsx) attendance report with:
 * - Employee attendance grid
 * - Daily status columns
 * - Summary statistics
 * - Conditional formatting
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type {
  AttendanceReportOutput,
  EmployeeAttendance,
  DailyAttendanceRecord,
  AttendanceExportResult,
} from '../types/attendance.types';

// ============================================================================
// Types
// ============================================================================

interface AttendanceRow {
  'N° Matricule': string;
  'Nom': string;
  'Prénom': string;
  'Département': string;
  'Poste': string;
  [date: string]: string | number; // Dynamic date columns
  'Jours Présent': number;
  'Jours Absent': number;
  'Jours Congé': number;
  'Total Heures': number;
  'Heures Sup.': number;
  'Heures Nuit': number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status text for Excel cell
 */
function getStatusText(record: DailyAttendanceRecord): string {
  switch (record.status) {
    case 'present':
      return record.timeEntry
        ? `${record.timeEntry.totalHours}h`
        : 'P';
    case 'absent':
      return 'A';
    case 'leave':
      return record.leaveInfo?.policyName || 'C';
    case 'pending':
      return '?';
    case 'weekend':
      return 'WE';
    case 'holiday':
      return record.holidayName || 'F';
    default:
      return '';
  }
}

/**
 * Format date for column header (e.g., "15 Lun")
 */
function formatDateHeader(dateStr: string, dayLabel: string): string {
  const day = dateStr.split('-')[2];
  return `${day} ${dayLabel}`;
}

// ============================================================================
// Excel Generation
// ============================================================================

/**
 * Generate attendance Excel workbook
 */
export async function generateAttendanceExcel(
  report: AttendanceReportOutput,
  companyName?: string
): Promise<AttendanceExportResult> {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // ========================================
  // Sheet 1: Attendance Grid
  // ========================================

  // Build header row
  const headers: string[] = [
    'N° Matricule',
    'Nom',
    'Prénom',
    'Département',
    'Poste',
  ];

  // Add date columns
  const dateHeaders: string[] = [];
  for (const emp of report.employees) {
    if (emp.dailyRecords.length > 0) {
      for (const record of emp.dailyRecords) {
        dateHeaders.push(formatDateHeader(record.date, record.dayLabel));
      }
      break;
    }
  }
  headers.push(...dateHeaders);

  // Add summary columns
  headers.push(
    'Jours Présent',
    'Jours Absent',
    'Jours Congé',
    'Total Heures',
    'Heures Sup.',
    'Heures Nuit'
  );

  // Build data rows
  const rows: any[][] = [headers];

  for (const emp of report.employees) {
    const row: any[] = [
      emp.employeeNumber,
      emp.lastName,
      emp.firstName,
      emp.department || '',
      emp.position || '',
    ];

    // Add daily status
    for (const record of emp.dailyRecords) {
      row.push(getStatusText(record));
    }

    // Add summary
    row.push(
      emp.periodSummary.daysPresent,
      emp.periodSummary.daysAbsent,
      emp.periodSummary.daysOnLeave,
      emp.periodSummary.totalHoursWorked,
      emp.periodSummary.totalOvertimeHours,
      emp.periodSummary.totalNightHours
    );

    rows.push(row);
  }

  // Create worksheet
  const wsAttendance = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Matricule
    { wch: 15 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 15 }, // Département
    { wch: 15 }, // Poste
    ...dateHeaders.map(() => ({ wch: 6 })), // Date columns
    { wch: 10 }, // Jours Présent
    { wch: 10 }, // Jours Absent
    { wch: 10 }, // Jours Congé
    { wch: 10 }, // Total Heures
    { wch: 10 }, // Heures Sup.
    { wch: 10 }, // Heures Nuit
  ];
  wsAttendance['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, wsAttendance, 'Pointage');

  // ========================================
  // Sheet 2: Summary
  // ========================================

  const summaryRows = [
    ['RAPPORT DE POINTAGE'],
    [''],
    ['Période:', report.period.label],
    ['Généré le:', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })],
    companyName ? ['Entreprise:', companyName] : [],
    [''],
    ['STATISTIQUES GLOBALES'],
    [''],
    ['Total employés:', report.summary.totalEmployees],
    ['Jours ouvrés:', report.summary.totalWorkingDays],
    ['Taux de présence:', `${report.summary.averageAttendanceRate}%`],
    ['Heures moyennes/employé:', `${report.summary.averageHoursWorked}h`],
    ['Total heures supplémentaires:', `${report.summary.totalOvertimeHours}h`],
    ['Total heures de nuit:', `${report.summary.totalNightHours}h`],
    [''],
    ['LÉGENDE'],
    ['P ou Xh = Présent (avec heures)'],
    ['A = Absent'],
    ['C = Congé'],
    ['? = En attente de validation'],
    ['WE = Week-end'],
    ['F = Jour férié'],
  ].filter((row) => row.length > 0);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Résumé');

  // ========================================
  // Sheet 3: Detailed Time Entries (optional)
  // ========================================

  const detailHeaders = [
    'Matricule',
    'Nom Prénom',
    'Date',
    'Statut',
    'Heure Arrivée',
    'Heure Départ',
    'Total Heures',
    'Source',
    'Validation',
    'Notes',
  ];

  const detailRows: any[][] = [detailHeaders];

  for (const emp of report.employees) {
    for (const record of emp.dailyRecords) {
      if (record.status === 'present' || record.status === 'pending') {
        const entry = record.timeEntry;
        detailRows.push([
          emp.employeeNumber,
          emp.fullName,
          format(new Date(record.date), 'dd/MM/yyyy'),
          record.status === 'present' ? 'Présent' : 'En attente',
          entry ? format(new Date(entry.clockIn), 'HH:mm') : '',
          entry?.clockOut ? format(new Date(entry.clockOut), 'HH:mm') : '-',
          entry?.totalHours || 0,
          entry?.entrySource === 'biometric'
            ? 'Biométrique'
            : entry?.entrySource === 'manual'
            ? 'Manuel'
            : 'Pointeuse',
          entry?.approvalStatus === 'approved'
            ? 'Validé'
            : entry?.approvalStatus === 'rejected'
            ? 'Rejeté'
            : 'En attente',
          entry?.notes || '',
        ]);
      } else if (record.status === 'leave') {
        detailRows.push([
          emp.employeeNumber,
          emp.fullName,
          format(new Date(record.date), 'dd/MM/yyyy'),
          'Congé',
          '-',
          '-',
          0,
          '-',
          '-',
          record.leaveInfo?.policyName || '',
        ]);
      } else if (record.status === 'absent') {
        detailRows.push([
          emp.employeeNumber,
          emp.fullName,
          format(new Date(record.date), 'dd/MM/yyyy'),
          'Absent',
          '-',
          '-',
          0,
          '-',
          '-',
          '',
        ]);
      }
    }
  }

  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 12 }, // Matricule
    { wch: 25 }, // Nom Prénom
    { wch: 12 }, // Date
    { wch: 10 }, // Statut
    { wch: 12 }, // Heure Arrivée
    { wch: 12 }, // Heure Départ
    { wch: 10 }, // Total Heures
    { wch: 12 }, // Source
    { wch: 10 }, // Validation
    { wch: 30 }, // Notes
  ];

  XLSX.utils.book_append_sheet(workbook, wsDetails, 'Détails');

  // ========================================
  // Generate Buffer
  // ========================================

  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });

  // Convert to base64
  const base64Data = Buffer.from(excelBuffer).toString('base64');

  // Generate filename
  const periodSlug =
    report.period.viewMode === 'weekly'
      ? format(report.period.start, 'yyyy-MM-dd')
      : format(report.period.start, 'yyyy-MM');
  const filename = `Feuille_Pointage_${periodSlug}.xlsx`;

  return {
    data: base64Data,
    filename,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    metadata: {
      employeeCount: report.employees.length,
      periodLabel: report.period.label,
      generatedAt: new Date().toISOString(),
    },
  };
}
