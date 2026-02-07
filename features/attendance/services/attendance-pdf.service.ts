/**
 * Attendance PDF Export Service
 *
 * Generates a professional "Feuille de Pointage" PDF report
 * using @react-pdf/renderer.
 */

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type {
  AttendanceReportOutput,
  EmployeeAttendance,
  DailyAttendanceRecord,
  AttendanceExportResult,
} from '../types/attendance.types';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 15,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10,
    color: '#333',
    marginBottom: 2,
  },
  metadata: {
    fontSize: 8,
    color: '#666',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
  },
  summaryBox: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 7,
    color: '#666',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: 6,
    fontWeight: 'bold',
    fontSize: 7,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    padding: 5,
    fontSize: 7,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    padding: 5,
    fontSize: 7,
  },
  colEmployee: {
    width: '15%',
  },
  colDay: {
    width: '3%',
    textAlign: 'center',
  },
  colSummary: {
    width: '8%',
    textAlign: 'center',
  },
  cellPresent: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: 2,
    borderRadius: 2,
    textAlign: 'center',
  },
  cellAbsent: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: 2,
    borderRadius: 2,
    textAlign: 'center',
  },
  cellLeave: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: 2,
    borderRadius: 2,
    textAlign: 'center',
  },
  cellPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 2,
    borderRadius: 2,
    textAlign: 'center',
  },
  cellWeekend: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    padding: 2,
    borderRadius: 2,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    fontSize: 7,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 4,
    borderRadius: 2,
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status symbol for PDF cell
 */
function getStatusSymbol(status: DailyAttendanceRecord['status']): string {
  switch (status) {
    case 'present':
      return 'P';
    case 'absent':
      return 'A';
    case 'leave':
      return 'C';
    case 'pending':
      return '?';
    case 'weekend':
    case 'holiday':
      return '-';
    default:
      return '';
  }
}

/**
 * Get cell style based on status
 */
function getCellStyle(status: DailyAttendanceRecord['status']) {
  switch (status) {
    case 'present':
      return styles.cellPresent;
    case 'absent':
      return styles.cellAbsent;
    case 'leave':
      return styles.cellLeave;
    case 'pending':
      return styles.cellPending;
    case 'weekend':
    case 'holiday':
    default:
      return styles.cellWeekend;
  }
}

// ============================================================================
// PDF Component
// ============================================================================

interface AttendancePDFProps {
  data: AttendanceReportOutput;
  companyName?: string;
}

function AttendancePDFDocument({ data, companyName }: AttendancePDFProps) {
  const generatedDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });
  const periodLabel = data.period.label;

  // Limit dates to show (max 31 for monthly, 7 for weekly)
  const dates = data.period.dates;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', orientation: 'landscape', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, 'Feuille de Pointage'),
        React.createElement(Text, { style: styles.subtitle }, periodLabel),
        companyName &&
          React.createElement(Text, { style: styles.metadata }, companyName),
        React.createElement(
          Text,
          { style: styles.metadata },
          `Généré le ${generatedDate}`
        )
      ),
      // Summary
      React.createElement(
        View,
        { style: styles.summaryContainer },
        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryLabel }, 'Employés'),
          React.createElement(
            Text,
            { style: styles.summaryValue },
            data.summary.totalEmployees.toString()
          )
        ),
        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryLabel }, 'Taux présence'),
          React.createElement(
            Text,
            { style: styles.summaryValue },
            `${data.summary.averageAttendanceRate}%`
          )
        ),
        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryLabel }, 'Heures moy.'),
          React.createElement(
            Text,
            { style: styles.summaryValue },
            `${data.summary.averageHoursWorked}h`
          )
        ),
        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryLabel }, 'Heures sup.'),
          React.createElement(
            Text,
            { style: styles.summaryValue },
            `${data.summary.totalOvertimeHours}h`
          )
        )
      ),
      // Legend
      React.createElement(
        View,
        { style: styles.legend },
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, {
            style: { ...styles.legendColor, backgroundColor: '#dcfce7' },
          }),
          React.createElement(Text, null, 'P = Présent')
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, {
            style: { ...styles.legendColor, backgroundColor: '#fee2e2' },
          }),
          React.createElement(Text, null, 'A = Absent')
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, {
            style: { ...styles.legendColor, backgroundColor: '#dbeafe' },
          }),
          React.createElement(Text, null, 'C = Congé')
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, {
            style: { ...styles.legendColor, backgroundColor: '#fef3c7' },
          }),
          React.createElement(Text, null, '? = En attente')
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, {
            style: { ...styles.legendColor, backgroundColor: '#f3f4f6' },
          }),
          React.createElement(Text, null, '- = Week-end/Férié')
        )
      ),
      // Table
      React.createElement(
        View,
        { style: styles.table },
        // Header row
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colEmployee }, 'Employé'),
          ...dates.map((dateStr) => {
            const dayNum = dateStr.split('-')[2];
            return React.createElement(
              Text,
              { key: dateStr, style: styles.colDay },
              dayNum
            );
          }),
          React.createElement(Text, { style: styles.colSummary }, 'Prés.'),
          React.createElement(Text, { style: styles.colSummary }, 'Heures')
        ),
        // Data rows
        ...data.employees.map((emp, idx) =>
          React.createElement(
            View,
            {
              key: emp.employeeId,
              style: idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt,
            },
            React.createElement(
              Text,
              { style: styles.colEmployee },
              `${emp.lastName} ${emp.firstName.charAt(0)}.`
            ),
            ...emp.dailyRecords.map((record) =>
              React.createElement(
                View,
                { key: record.date, style: styles.colDay },
                React.createElement(
                  Text,
                  { style: getCellStyle(record.status) },
                  getStatusSymbol(record.status)
                )
              )
            ),
            React.createElement(
              Text,
              { style: styles.colSummary },
              emp.periodSummary.daysPresent.toString()
            ),
            React.createElement(
              Text,
              { style: styles.colSummary },
              emp.periodSummary.totalHoursWorked.toString()
            )
          )
        )
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          null,
          `Page 1 | ${data.employees.length} employés | Jamana`
        )
      )
    )
  );
}

// ============================================================================
// Export Function
// ============================================================================

/**
 * Generate attendance report PDF
 */
export async function generateAttendancePDF(
  report: AttendanceReportOutput,
  companyName?: string
): Promise<AttendanceExportResult> {
  // Render PDF to buffer
  const pdfBuffer = await renderToBuffer(
    AttendancePDFDocument({ data: report, companyName })
  );

  // Convert buffer to base64
  const base64Data = Buffer.from(pdfBuffer).toString('base64');

  // Generate filename
  const periodSlug = report.period.viewMode === 'weekly'
    ? format(report.period.start, 'yyyy-MM-dd')
    : format(report.period.start, 'yyyy-MM');
  const filename = `Feuille_Pointage_${periodSlug}.pdf`;

  return {
    data: base64Data,
    filename,
    contentType: 'application/pdf',
    metadata: {
      employeeCount: report.employees.length,
      periodLabel: report.period.label,
      generatedAt: new Date().toISOString(),
    },
  };
}
