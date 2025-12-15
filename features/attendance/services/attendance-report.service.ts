/**
 * Attendance Report Service
 *
 * Aggregates time entries, leave requests, and holidays to build
 * a comprehensive attendance report for employees over a period.
 */

import { db } from '@/lib/db';
import {
  timeEntries,
  timeOffRequests,
  timeOffPolicies,
  employees,
  assignments,
  positions,
  departments,
  publicHolidays,
} from '@/drizzle/schema';
import { eq, and, gte, lte, isNull, inArray, desc } from 'drizzle-orm';
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  getDay,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import type {
  AttendanceReportServiceOptions,
  AttendanceReportOutput,
  AttendancePeriod,
  AttendanceReportSummary,
  EmployeeAttendance,
  EmployeePeriodSummary,
  DailyAttendanceRecord,
  AttendanceStatus,
  TimeEntryDetail,
  LeaveInfo,
  RawTimeEntry,
  RawLeaveRequest,
  RawEmployee,
  AttendanceViewMode,
} from '../types/attendance.types';
import type { OvertimeBreakdown } from '@/features/time-tracking/types/overtime';

// Day labels in French (0=Dimanche, 1=Lundi, etc.)
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Calculate period dates based on view mode and reference date
 */
export function calculatePeriodDates(
  viewMode: AttendanceViewMode,
  referenceDate: Date
): { start: Date; end: Date; dates: string[] } {
  let start: Date;
  let end: Date;

  if (viewMode === 'weekly') {
    start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    end = endOfWeek(referenceDate, { weekStartsOn: 1 }); // Sunday
  } else {
    start = startOfMonth(referenceDate);
    end = endOfMonth(referenceDate);
  }

  const dates = eachDayOfInterval({ start, end }).map((d) =>
    format(d, 'yyyy-MM-dd')
  );

  return { start, end, dates };
}

/**
 * Generate period label in French
 */
export function generatePeriodLabel(
  viewMode: AttendanceViewMode,
  start: Date,
  end: Date
): string {
  if (viewMode === 'weekly') {
    const startDay = format(start, 'd', { locale: fr });
    const endDate = format(end, 'd MMMM yyyy', { locale: fr });
    return `Semaine du ${startDay} au ${endDate}`;
  } else {
    return format(start, 'MMMM yyyy', { locale: fr });
  }
}

/**
 * Fetch active employees with their position and department info
 */
async function fetchEmployees(
  tenantId: string,
  employeeIds?: string[],
  departmentId?: string,
  page: number = 1,
  limit: number = 50
): Promise<{ employees: RawEmployee[]; total: number }> {
  const conditions = [
    eq(employees.tenantId, tenantId),
    eq(employees.status, 'active'),
  ];

  // Filter by specific employee IDs if provided (for manager view)
  if (employeeIds && employeeIds.length > 0) {
    conditions.push(inArray(employees.id, employeeIds));
  }

  // Filter by department if provided
  if (departmentId) {
    conditions.push(eq(positions.departmentId, departmentId));
  }

  const offset = (page - 1) * limit;

  const results = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      firstName: employees.firstName,
      lastName: employees.lastName,
      positionTitle: positions.title,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(
      assignments,
      and(
        eq(assignments.employeeId, employees.id),
        isNull(assignments.effectiveTo) // Current assignment only
      )
    )
    .leftJoin(positions, eq(assignments.positionId, positions.id))
    .leftJoin(departments, eq(positions.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(employees.lastName, employees.firstName)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = results.length > limit;
  const employeeList = results.slice(0, limit).map((r) => ({
    id: r.id,
    employeeNumber: r.employeeNumber,
    firstName: r.firstName,
    lastName: r.lastName,
    departmentName: r.departmentName,
    positionTitle: r.positionTitle,
  }));

  // Get total count
  const countResult = await db
    .select({ count: employees.id })
    .from(employees)
    .leftJoin(
      assignments,
      and(
        eq(assignments.employeeId, employees.id),
        isNull(assignments.effectiveTo)
      )
    )
    .leftJoin(positions, eq(assignments.positionId, positions.id))
    .where(and(...conditions));

  return {
    employees: employeeList,
    total: countResult.length,
  };
}

/**
 * Fetch time entries for employees in date range
 */
async function fetchTimeEntries(
  tenantId: string,
  employeeIds: string[],
  startDate: Date,
  endDate: Date
): Promise<RawTimeEntry[]> {
  if (employeeIds.length === 0) return [];

  const results = await db
    .select({
      id: timeEntries.id,
      employeeId: timeEntries.employeeId,
      clockIn: timeEntries.clockIn,
      clockOut: timeEntries.clockOut,
      totalHours: timeEntries.totalHours,
      status: timeEntries.status,
      entrySource: timeEntries.entrySource,
      notes: timeEntries.notes,
      overtimeBreakdown: timeEntries.overtimeBreakdown,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.tenantId, tenantId),
        inArray(timeEntries.employeeId, employeeIds),
        gte(timeEntries.clockIn, startDate.toISOString()),
        lte(timeEntries.clockIn, endDate.toISOString())
      )
    )
    .orderBy(desc(timeEntries.clockIn));

  return results.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    totalHours: r.totalHours,
    status: r.status || 'pending',
    entrySource: r.entrySource,
    notes: r.notes,
    overtimeBreakdown: r.overtimeBreakdown as OvertimeBreakdown | null,
  }));
}

/**
 * Fetch approved leave requests overlapping with date range
 */
async function fetchLeaveRequests(
  tenantId: string,
  employeeIds: string[],
  startDate: Date,
  endDate: Date
): Promise<RawLeaveRequest[]> {
  if (employeeIds.length === 0) return [];

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const results = await db
    .select({
      id: timeOffRequests.id,
      employeeId: timeOffRequests.employeeId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      status: timeOffRequests.status,
      policyName: timeOffPolicies.name,
      policyType: timeOffPolicies.policyType,
    })
    .from(timeOffRequests)
    .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
    .where(
      and(
        eq(timeOffRequests.tenantId, tenantId),
        inArray(timeOffRequests.employeeId, employeeIds),
        eq(timeOffRequests.status, 'approved'),
        // Overlapping logic: request.startDate <= endDate AND request.endDate >= startDate
        lte(timeOffRequests.startDate, endDateStr),
        gte(timeOffRequests.endDate, startDateStr)
      )
    );

  return results.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status || 'approved',
    policyName: r.policyName || 'Congé',
    policyType: r.policyType || 'annual_leave',
  }));
}

/**
 * Fetch public holidays for country in date range
 */
async function fetchHolidays(
  countryCode: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, string>> {
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const results = await db
    .select({
      date: publicHolidays.holidayDate,
      name: publicHolidays.name,
    })
    .from(publicHolidays)
    .where(
      and(
        eq(publicHolidays.countryCode, countryCode),
        gte(publicHolidays.holidayDate, startDateStr),
        lte(publicHolidays.holidayDate, endDateStr)
      )
    );

  const holidayMap = new Map<string, string>();
  for (const r of results) {
    // name is JSONB with { fr: "...", en: "..." }
    const nameObj = r.name as { fr?: string; en?: string } | null;
    const holidayName = nameObj?.fr || nameObj?.en || 'Jour férié';
    holidayMap.set(r.date, holidayName);
  }

  return holidayMap;
}

/**
 * Check if a date is a weekend (Saturday=6 or Sunday=0)
 */
function isWeekend(dateStr: string): boolean {
  const date = parseISO(dateStr);
  const day = getDay(date);
  return day === 0 || day === 6;
}

/**
 * Build daily attendance records for an employee
 */
function buildDailyRecords(
  dates: string[],
  timeEntriesByDate: Map<string, RawTimeEntry[]>,
  leavesByDate: Map<string, RawLeaveRequest>,
  holidayMap: Map<string, string>
): DailyAttendanceRecord[] {
  return dates.map((dateStr) => {
    const date = parseISO(dateStr);
    const dayOfWeek = getDay(date);
    const dayLabel = DAY_LABELS[dayOfWeek];
    const weekend = isWeekend(dateStr);
    const holidayName = holidayMap.get(dateStr);
    const isHoliday = !!holidayName;

    // Check for leave on this date
    const leave = leavesByDate.get(dateStr);

    // Get time entries for this date
    const entries = timeEntriesByDate.get(dateStr) || [];
    const approvedEntry = entries.find((e) => e.status === 'approved');
    const pendingEntry = entries.find((e) => e.status === 'pending');
    const entry = approvedEntry || pendingEntry;

    // Determine status
    let status: AttendanceStatus;
    let timeEntry: TimeEntryDetail | undefined;
    let leaveInfo: LeaveInfo | undefined;

    if (weekend && !entry) {
      status = 'weekend';
    } else if (isHoliday && !entry) {
      status = 'holiday';
    } else if (leave) {
      status = 'leave';
      leaveInfo = {
        requestId: leave.id,
        policyName: leave.policyName,
        policyType: leave.policyType,
        status: leave.status,
      };
    } else if (entry) {
      status = entry.status === 'approved' ? 'present' : 'pending';
      timeEntry = {
        id: entry.id,
        clockIn: typeof entry.clockIn === 'string' ? entry.clockIn : entry.clockIn.toISOString(),
        clockOut: entry.clockOut
          ? typeof entry.clockOut === 'string'
            ? entry.clockOut
            : entry.clockOut.toISOString()
          : null,
        totalHours: parseFloat(String(entry.totalHours || 0)),
        entrySource: (entry.entrySource as TimeEntryDetail['entrySource']) || 'clock_in_out',
        approvalStatus: (entry.status as TimeEntryDetail['approvalStatus']) || 'pending',
        notes: entry.notes,
        overtimeBreakdown: entry.overtimeBreakdown,
      };
    } else {
      // No entry, not weekend, not holiday, not on leave = absent
      status = 'absent';
    }

    return {
      date: dateStr,
      dayOfWeek,
      dayLabel,
      isWeekend: weekend,
      isHoliday,
      holidayName,
      status,
      timeEntry,
      leaveInfo,
    };
  });
}

/**
 * Calculate period summary for an employee
 */
function calculatePeriodSummary(
  dailyRecords: DailyAttendanceRecord[]
): EmployeePeriodSummary {
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysOnLeave = 0;
  let daysPending = 0;
  let totalHoursWorked = 0;
  let totalOvertimeHours = 0;
  let totalNightHours = 0;

  for (const record of dailyRecords) {
    switch (record.status) {
      case 'present':
        daysPresent++;
        if (record.timeEntry) {
          totalHoursWorked += record.timeEntry.totalHours;
          if (record.timeEntry.overtimeBreakdown) {
            const ob = record.timeEntry.overtimeBreakdown;
            totalOvertimeHours +=
              (ob.hours_41_to_46 || 0) +
              (ob.hours_above_46 || 0) +
              (ob.saturday || 0) +
              (ob.sunday || 0) +
              (ob.public_holiday || 0);
            totalNightHours += ob.night_work || 0;
          }
        }
        break;
      case 'absent':
        daysAbsent++;
        break;
      case 'leave':
        daysOnLeave++;
        break;
      case 'pending':
        daysPending++;
        if (record.timeEntry) {
          totalHoursWorked += record.timeEntry.totalHours;
        }
        break;
      // weekend and holiday don't count
    }
  }

  const workingDays = daysPresent + daysPending;
  const averageHoursPerDay = workingDays > 0 ? totalHoursWorked / workingDays : 0;

  return {
    daysPresent,
    daysAbsent,
    daysOnLeave,
    daysPending,
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalNightHours: Math.round(totalNightHours * 100) / 100,
    averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
  };
}

/**
 * Calculate overall report summary
 */
function calculateReportSummary(
  employeeAttendances: EmployeeAttendance[],
  dates: string[],
  holidayMap: Map<string, string>
): AttendanceReportSummary {
  // Count business days (not weekend, not holiday)
  const totalWorkingDays = dates.filter(
    (d) => !isWeekend(d) && !holidayMap.has(d)
  ).length;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalOnLeave = 0;
  let totalHoursWorked = 0;
  let totalOvertimeHours = 0;
  let totalNightHours = 0;

  for (const emp of employeeAttendances) {
    if (emp.periodSummary.daysPresent > 0) totalPresent++;
    if (emp.periodSummary.daysAbsent > 0) totalAbsent++;
    if (emp.periodSummary.daysOnLeave > 0) totalOnLeave++;
    totalHoursWorked += emp.periodSummary.totalHoursWorked;
    totalOvertimeHours += emp.periodSummary.totalOvertimeHours;
    totalNightHours += emp.periodSummary.totalNightHours;
  }

  const totalEmployees = employeeAttendances.length;
  const averageHoursWorked =
    totalEmployees > 0 ? totalHoursWorked / totalEmployees : 0;

  // Calculate average attendance rate
  // (total present days) / (total employees * working days) * 100
  const totalPossibleDays = totalEmployees * totalWorkingDays;
  const totalPresentDays = employeeAttendances.reduce(
    (sum, emp) => sum + emp.periodSummary.daysPresent,
    0
  );
  const averageAttendanceRate =
    totalPossibleDays > 0 ? (totalPresentDays / totalPossibleDays) * 100 : 0;

  return {
    totalEmployees,
    totalPresent,
    totalAbsent,
    totalOnLeave,
    totalWorkingDays,
    averageHoursWorked: Math.round(averageHoursWorked * 100) / 100,
    averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalNightHours: Math.round(totalNightHours * 100) / 100,
  };
}

/**
 * Get direct reports for a manager
 */
export async function getDirectReportIds(
  tenantId: string,
  managerId: string
): Promise<string[]> {
  const directReports = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, tenantId),
        eq(employees.reportingManagerId, managerId),
        eq(employees.status, 'active')
      )
    );

  return directReports.map((r) => r.id);
}

/**
 * Main function to generate attendance report
 */
export async function getAttendanceReport(
  options: AttendanceReportServiceOptions
): Promise<AttendanceReportOutput> {
  const {
    tenantId,
    startDate,
    endDate,
    countryCode,
    employeeIds,
    departmentId,
    page = 1,
    limit = 50,
  } = options;

  // Calculate dates array
  const dates = eachDayOfInterval({ start: startDate, end: endDate }).map((d) =>
    format(d, 'yyyy-MM-dd')
  );

  // Determine view mode based on date range
  const dayCount = dates.length;
  const viewMode: AttendanceViewMode = dayCount <= 7 ? 'weekly' : 'monthly';

  // Fetch employees
  const { employees: employeeList, total } = await fetchEmployees(
    tenantId,
    employeeIds,
    departmentId,
    page,
    limit
  );

  const empIds = employeeList.map((e) => e.id);

  // Fetch time entries, leaves, and holidays in parallel
  const [rawTimeEntries, rawLeaves, holidayMap] = await Promise.all([
    fetchTimeEntries(tenantId, empIds, startDate, endDate),
    fetchLeaveRequests(tenantId, empIds, startDate, endDate),
    fetchHolidays(countryCode, startDate, endDate),
  ]);

  // Group time entries by employee and date
  const timeEntriesByEmployee = new Map<string, Map<string, RawTimeEntry[]>>();
  for (const entry of rawTimeEntries) {
    const clockInDate =
      typeof entry.clockIn === 'string'
        ? entry.clockIn.split('T')[0]
        : format(entry.clockIn, 'yyyy-MM-dd');

    if (!timeEntriesByEmployee.has(entry.employeeId)) {
      timeEntriesByEmployee.set(entry.employeeId, new Map());
    }
    const empEntries = timeEntriesByEmployee.get(entry.employeeId)!;
    if (!empEntries.has(clockInDate)) {
      empEntries.set(clockInDate, []);
    }
    empEntries.get(clockInDate)!.push(entry);
  }

  // Group leaves by employee and date
  const leavesByEmployee = new Map<string, Map<string, RawLeaveRequest>>();
  for (const leave of rawLeaves) {
    if (!leavesByEmployee.has(leave.employeeId)) {
      leavesByEmployee.set(leave.employeeId, new Map());
    }
    const empLeaves = leavesByEmployee.get(leave.employeeId)!;

    // Mark all dates in the leave range
    const leaveStart = typeof leave.startDate === 'string' ? leave.startDate : format(leave.startDate, 'yyyy-MM-dd');
    const leaveEnd = typeof leave.endDate === 'string' ? leave.endDate : format(leave.endDate, 'yyyy-MM-dd');

    for (const dateStr of dates) {
      if (dateStr >= leaveStart && dateStr <= leaveEnd) {
        empLeaves.set(dateStr, leave);
      }
    }
  }

  // Build employee attendance data
  const employeeAttendances: EmployeeAttendance[] = employeeList.map((emp) => {
    const empTimeEntries = timeEntriesByEmployee.get(emp.id) || new Map();
    const empLeaves = leavesByEmployee.get(emp.id) || new Map();

    const dailyRecords = buildDailyRecords(
      dates,
      empTimeEntries,
      empLeaves,
      holidayMap
    );

    const periodSummary = calculatePeriodSummary(dailyRecords);

    return {
      employeeId: emp.id,
      employeeNumber: emp.employeeNumber || '',
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`,
      department: emp.departmentName,
      position: emp.positionTitle,
      dailyRecords,
      periodSummary,
    };
  });

  // Calculate report summary
  const summary = calculateReportSummary(employeeAttendances, dates, holidayMap);

  // Build period info
  const period: AttendancePeriod = {
    start: startDate,
    end: endDate,
    viewMode,
    label: generatePeriodLabel(viewMode, startDate, endDate),
    dates,
  };

  return {
    period,
    summary,
    employees: employeeAttendances,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}
