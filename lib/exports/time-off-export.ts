/**
 * Time-Off Calendar Export Utilities
 *
 * Provides CSV and PDF export functionality for time-off calendar data
 * Following HCI principles: Simple, one-click exports
 */

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
  };
  startDate: string;
  endDate: string;
  status: string;
  policy: {
    name: string;
    policyType: string;
  };
}

/**
 * Export time-off calendar data to CSV
 *
 * @param requests - Leave requests to export
 * @param month - Month being displayed
 */
export function exportToCSV(requests: LeaveRequest[], month: Date) {
  const monthName = format(month, 'MMMM yyyy', { locale: fr });

  // CSV Headers
  const headers = [
    'Employé',
    'Type de congé',
    'Date de début',
    'Date de fin',
    'Statut',
  ];

  // CSV Rows
  const rows = requests.map((request) => [
    `${request.employee.firstName} ${request.employee.lastName}`,
    request.policy.name,
    format(new Date(request.startDate), 'dd/MM/yyyy'),
    format(new Date(request.endDate), 'dd/MM/yyyy'),
    request.status === 'approved' ? 'Approuvé' : request.status === 'pending' ? 'En attente' : request.status,
  ]);

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  // Add BOM for Excel compatibility with French characters
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Download file
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `conges-${format(month, 'yyyy-MM')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export time-off calendar summary to CSV
 *
 * Shows daily summary of leave counts
 *
 * @param calendarData - Daily aggregated data
 * @param month - Month being displayed
 */
export function exportSummaryToCSV(
  calendarData: Record<string, { approved: number; pending: number; total: number }>,
  month: Date
) {
  // CSV Headers
  const headers = [
    'Date',
    'Congés approuvés',
    'Congés en attente',
    'Total',
  ];

  // CSV Rows (only days with leave)
  const rows = Object.entries(calendarData)
    .filter(([_, stats]) => stats.total > 0)
    .map(([dateKey, stats]) => [
      format(new Date(dateKey), 'dd/MM/yyyy'),
      stats.approved.toString(),
      stats.pending.toString(),
      stats.total.toString(),
    ]);

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Download file
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `resume-conges-${format(month, 'yyyy-MM')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate PDF document data for time-off calendar
 *
 * Returns data structure that can be used by @react-pdf/renderer
 *
 * @param requests - Leave requests to include
 * @param month - Month being displayed
 */
export function preparePDFData(requests: LeaveRequest[], month: Date) {
  const monthName = format(month, 'MMMM yyyy', { locale: fr });

  return {
    title: `Calendrier des Congés - ${monthName}`,
    generated: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
    requests: requests.map((request) => ({
      employee: `${request.employee.firstName} ${request.employee.lastName}`,
      policyName: request.policy.name,
      startDate: format(new Date(request.startDate), 'dd MMM yyyy', { locale: fr }),
      endDate: format(new Date(request.endDate), 'dd MMM yyyy', { locale: fr }),
      status: request.status === 'approved' ? 'Approuvé' :
              request.status === 'pending' ? 'En attente' : request.status,
      statusColor: request.status === 'approved' ? '#22c55e' :
                   request.status === 'pending' ? '#f59e0b' : '#6b7280',
    })),
    stats: {
      total: requests.length,
      approved: requests.filter(r => r.status === 'approved').length,
      pending: requests.filter(r => r.status === 'pending').length,
    },
  };
}
