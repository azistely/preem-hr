/**
 * Manager Attendance Report Page
 *
 * Shows attendance data for manager's direct reports.
 * Task-oriented: "Voir le pointage de mon équipe"
 */

import { AttendanceReport } from '@/components/reports/attendance-report';

export default function ManagerAttendanceReportPage() {
  return <AttendanceReport scope="team" />;
}
