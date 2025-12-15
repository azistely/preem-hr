/**
 * Attendance Calendar Grid Component
 *
 * Displays employee attendance in a grid format with:
 * - Rows: Employees
 * - Columns: Dates
 * - Color-coded cells for status
 *
 * HCI Principles:
 * - Touch-friendly cells (min 44px)
 * - Horizontal scroll for many dates
 * - Click to see details
 */

'use client';

import { useState } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceDayDetail } from './attendance-day-detail';
import type {
  EmployeeAttendance,
  DailyAttendanceRecord,
  AttendanceStatus,
} from '@/features/attendance/types/attendance.types';

interface AttendanceCalendarGridProps {
  employees: EmployeeAttendance[];
  dates: string[];
  isLoading?: boolean;
}

/**
 * Get cell style based on attendance status
 */
function getCellStyle(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
    case 'absent':
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
    case 'leave':
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
    case 'weekend':
    case 'holiday':
    default:
      return 'bg-gray-50 text-gray-400 border-gray-100';
  }
}

/**
 * Get status abbreviation for cell
 */
function getStatusAbbr(record: DailyAttendanceRecord): string {
  switch (record.status) {
    case 'present':
      return record.timeEntry ? `${Math.round(record.timeEntry.totalHours)}h` : 'P';
    case 'absent':
      return 'A';
    case 'leave':
      return 'C';
    case 'pending':
      return '?';
    case 'weekend':
      return '-';
    case 'holiday':
      return 'F';
    default:
      return '';
  }
}

/**
 * Extract day number from date string
 */
function getDayNumber(dateStr: string): string {
  return dateStr.split('-')[2];
}

export function AttendanceCalendarGrid({
  employees,
  dates,
  isLoading,
}: AttendanceCalendarGridProps) {
  const [selectedDetail, setSelectedDetail] = useState<{
    employee: EmployeeAttendance;
    record: DailyAttendanceRecord;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 animate-pulse">
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <p>Aucun employé à afficher</p>
      </div>
    );
  }

  // Get date labels from first employee's records
  const dateLabels =
    employees[0]?.dailyRecords.map((r) => ({
      date: r.date,
      dayLabel: r.dayLabel,
      dayNumber: getDayNumber(r.date),
      isWeekend: r.isWeekend,
    })) || [];

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* Header Row */}
            <div className="flex bg-gray-50 border-b sticky top-0 z-10">
              {/* Employee column header */}
              <div className="w-48 min-w-48 px-3 py-2 font-medium text-sm border-r bg-gray-100 sticky left-0 z-20">
                Employé
              </div>
              {/* Date headers */}
              {dateLabels.map((d) => (
                <div
                  key={d.date}
                  className={cn(
                    'w-11 min-w-11 px-1 py-2 text-center text-xs font-medium border-r',
                    d.isWeekend && 'bg-gray-100 text-gray-500'
                  )}
                >
                  <div>{d.dayLabel}</div>
                  <div className="font-bold">{d.dayNumber}</div>
                </div>
              ))}
              {/* Summary headers */}
              <div className="w-16 min-w-16 px-2 py-2 text-center text-xs font-medium border-r bg-gray-100">
                Prés.
              </div>
              <div className="w-16 min-w-16 px-2 py-2 text-center text-xs font-medium bg-gray-100">
                Heures
              </div>
            </div>

            {/* Employee Rows */}
            {employees.map((emp, idx) => (
              <div
                key={emp.employeeId}
                className={cn(
                  'flex border-b hover:bg-gray-50',
                  idx % 2 === 1 && 'bg-gray-50/50'
                )}
              >
                {/* Employee name */}
                <div className="w-48 min-w-48 px-3 py-2 border-r bg-white sticky left-0 z-10">
                  <div className="font-medium text-sm truncate">
                    {emp.lastName} {emp.firstName}
                  </div>
                  {emp.position && (
                    <div className="text-xs text-muted-foreground truncate">
                      {emp.position}
                    </div>
                  )}
                </div>

                {/* Day cells */}
                {emp.dailyRecords.map((record) => (
                  <button
                    key={record.date}
                    onClick={() =>
                      record.status !== 'weekend' &&
                      record.status !== 'holiday' &&
                      setSelectedDetail({ employee: emp, record })
                    }
                    disabled={
                      record.status === 'weekend' || record.status === 'holiday'
                    }
                    className={cn(
                      'w-11 min-w-11 min-h-[44px] flex items-center justify-center border-r text-xs font-medium transition-colors',
                      getCellStyle(record.status),
                      record.status !== 'weekend' &&
                        record.status !== 'holiday' &&
                        'cursor-pointer'
                    )}
                    title={`${record.date}: ${record.status}`}
                  >
                    {getStatusAbbr(record)}
                  </button>
                ))}

                {/* Summary cells */}
                <div className="w-16 min-w-16 px-2 py-2 flex items-center justify-center border-r text-sm font-medium">
                  <Badge
                    variant={
                      emp.periodSummary.daysPresent > 0 ? 'default' : 'secondary'
                    }
                    className="min-w-[32px] justify-center"
                  >
                    {emp.periodSummary.daysPresent}
                  </Badge>
                </div>
                <div className="w-16 min-w-16 px-2 py-2 flex items-center justify-center text-sm font-medium">
                  {emp.periodSummary.totalHoursWorked}h
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-green-100 border border-green-200" />
          <span>Présent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-red-100 border border-red-200" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-100 border border-blue-200" />
          <span>Congé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-yellow-100 border border-yellow-200" />
          <span>En attente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gray-50 border border-gray-100" />
          <span>Week-end / Férié</span>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <AttendanceDayDetail
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        employee={selectedDetail?.employee || null}
        record={selectedDetail?.record || null}
      />
    </>
  );
}
