/**
 * Attendance Summary Cards Component
 *
 * Displays key attendance metrics at the top of the report.
 * Following HCI principles:
 * - Primary info first (total employees, attendance rate)
 * - Color-coded for quick scanning
 * - Large numbers, small labels
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Clock, TrendingUp, Moon } from 'lucide-react';
import type { AttendanceReportSummary } from '@/features/attendance/types/attendance.types';

interface AttendanceSummaryCardsProps {
  summary: AttendanceReportSummary;
  isLoading?: boolean;
}

export function AttendanceSummaryCards({
  summary,
  isLoading,
}: AttendanceSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* Total Employees */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Employés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {summary.totalEmployees}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.totalWorkingDays} jours ouvrés
          </p>
        </CardContent>
      </Card>

      {/* Attendance Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Taux de présence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-3xl font-bold ${
              summary.averageAttendanceRate >= 90
                ? 'text-green-600'
                : summary.averageAttendanceRate >= 75
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {summary.averageAttendanceRate}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.totalPresent} présents / {summary.totalAbsent} absents
          </p>
        </CardContent>
      </Card>

      {/* Average Hours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Heures moyennes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {summary.averageHoursWorked}h
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            par employé cette période
          </p>
        </CardContent>
      </Card>

      {/* Overtime & Night Hours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            Heures supplémentaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {summary.totalOvertimeHours}h
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            dont {summary.totalNightHours}h de nuit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
