/**
 * Admin Attendance Report Page
 *
 * Shows attendance data for all employees in the organization.
 * Includes department filtering for large organizations.
 * Task-oriented: "Voir le pointage de tous les employés"
 */

import { AttendanceReport } from '@/components/reports/attendance-report';

export default function AdminAttendanceReportPage() {
  return <AttendanceReport scope="all" />;
}
