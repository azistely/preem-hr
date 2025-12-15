/**
 * Attendance Report Types
 *
 * Type definitions for the attendance report feature including daily records,
 * employee attendance summaries, and period aggregations.
 */

import type { OvertimeBreakdown } from '@/features/time-tracking/types/overtime';

// ============================================================================
// Daily Attendance Types
// ============================================================================

/**
 * Attendance status for a single day
 */
export type AttendanceStatus =
  | 'present' // Employee worked (has approved time entry)
  | 'absent' // No time entry and no leave
  | 'leave' // Approved leave request
  | 'pending' // Has time entry but pending approval
  | 'weekend' // Saturday or Sunday (non-working day)
  | 'holiday'; // Public holiday

/**
 * Time entry source for tracking how attendance was recorded
 */
export type TimeEntrySource = 'clock_in_out' | 'manual' | 'biometric';

/**
 * Approval status for time entries
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Time entry details for a day when employee was present
 */
export interface TimeEntryDetail {
  id: string;
  clockIn: string; // ISO timestamp
  clockOut: string | null; // ISO timestamp, null if still clocked in
  totalHours: number;
  entrySource: TimeEntrySource;
  approvalStatus: ApprovalStatus;
  notes: string | null;
  overtimeBreakdown: OvertimeBreakdown | null;
}

/**
 * Leave information for a day when employee is on leave
 */
export interface LeaveInfo {
  requestId: string;
  policyName: string;
  policyType: string; // 'annual_leave', 'sick_leave', 'maternity', etc.
  status: string;
}

/**
 * Complete attendance record for a single day
 */
export interface DailyAttendanceRecord {
  date: string; // YYYY-MM-DD format
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayLabel: string; // "Lun", "Mar", etc.
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  status: AttendanceStatus;
  timeEntry?: TimeEntryDetail;
  leaveInfo?: LeaveInfo;
}

// ============================================================================
// Employee Attendance Types
// ============================================================================

/**
 * Period summary statistics for an employee
 */
export interface EmployeePeriodSummary {
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  daysPending: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  totalNightHours: number;
  averageHoursPerDay: number;
}

/**
 * Complete attendance data for one employee over a period
 */
export interface EmployeeAttendance {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string; // Computed: firstName + lastName
  department: string | null;
  position: string | null;
  dailyRecords: DailyAttendanceRecord[];
  periodSummary: EmployeePeriodSummary;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * View mode for the attendance report
 */
export type AttendanceViewMode = 'weekly' | 'monthly';

/**
 * Period information for the report
 */
export interface AttendancePeriod {
  start: Date;
  end: Date;
  viewMode: AttendanceViewMode;
  label: string; // "Semaine du 9 au 15 décembre 2024" or "Décembre 2024"
  dates: string[]; // Array of YYYY-MM-DD for each day in period
}

/**
 * Overall summary statistics for the report
 */
export interface AttendanceReportSummary {
  totalEmployees: number;
  totalPresent: number; // Employees with at least one present day
  totalAbsent: number; // Employees with at least one absent day
  totalOnLeave: number; // Employees with at least one leave day
  totalWorkingDays: number; // Business days in period
  averageHoursWorked: number;
  averageAttendanceRate: number; // Percentage (0-100)
  totalOvertimeHours: number;
  totalNightHours: number;
}

/**
 * Complete attendance report output
 */
export interface AttendanceReportOutput {
  period: AttendancePeriod;
  summary: AttendanceReportSummary;
  employees: EmployeeAttendance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Input Types for tRPC
// ============================================================================

/**
 * Input for fetching attendance report
 */
export interface GetAttendanceReportInput {
  viewMode: AttendanceViewMode;
  referenceDate: Date;
  departmentId?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}

/**
 * Input for exporting attendance report
 */
export interface ExportAttendanceReportInput {
  viewMode: AttendanceViewMode;
  referenceDate: Date;
  format: 'pdf' | 'xlsx';
  scope: 'team' | 'all';
  departmentId?: string;
}

/**
 * Export result with base64 encoded file
 */
export interface AttendanceExportResult {
  data: string; // Base64 encoded file
  filename: string;
  contentType: string;
  metadata: {
    employeeCount: number;
    periodLabel: string;
    generatedAt: string;
  };
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Options for the attendance report service
 */
export interface AttendanceReportServiceOptions {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  countryCode: string;
  employeeIds?: string[]; // Filter to specific employees (for manager view)
  departmentId?: string;
  page?: number;
  limit?: number;
}

/**
 * Raw time entry from database query
 */
export interface RawTimeEntry {
  id: string;
  employeeId: string;
  clockIn: string | Date;
  clockOut: string | Date | null;
  totalHours: string | number | null;
  status: string;
  entrySource: string | null;
  notes: string | null;
  overtimeBreakdown: OvertimeBreakdown | null;
}

/**
 * Raw leave request from database query
 */
export interface RawLeaveRequest {
  id: string;
  employeeId: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  policyName: string;
  policyType: string;
}

/**
 * Raw employee from database query
 */
export interface RawEmployee {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  positionTitle: string | null;
}
