/**
 * Attendance Day Detail Dialog Component
 *
 * Shows detailed information about an employee's attendance for a specific day.
 * Includes time entry details, overtime breakdown, and leave info.
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  LogIn,
  LogOut,
  Timer,
  ChevronDown,
  Moon,
  Sun,
  Calendar,
  FileText,
  Fingerprint,
  Pencil,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  EmployeeAttendance,
  DailyAttendanceRecord,
} from '@/features/attendance/types/attendance.types';

interface AttendanceDayDetailProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeAttendance | null;
  record: DailyAttendanceRecord | null;
}

/**
 * Get status badge variant and text
 */
function getStatusBadge(status: DailyAttendanceRecord['status']) {
  switch (status) {
    case 'present':
      return { variant: 'default' as const, text: 'Présent', icon: CheckCircle };
    case 'absent':
      return { variant: 'destructive' as const, text: 'Absent', icon: XCircle };
    case 'leave':
      return { variant: 'secondary' as const, text: 'Congé', icon: Calendar };
    case 'pending':
      return { variant: 'outline' as const, text: 'En attente', icon: AlertCircle };
    default:
      return { variant: 'outline' as const, text: '-', icon: Clock };
  }
}

/**
 * Get entry source icon and label
 */
function getEntrySource(source: string) {
  switch (source) {
    case 'biometric':
      return { icon: Fingerprint, label: 'Biométrique' };
    case 'manual':
      return { icon: Pencil, label: 'Saisie manuelle' };
    case 'clock_in_out':
    default:
      return { icon: Clock, label: 'Pointeuse' };
  }
}

/**
 * Format time from ISO string
 */
function formatTime(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    return format(parseISO(isoString), 'HH:mm');
  } catch {
    return '-';
  }
}

export function AttendanceDayDetail({
  isOpen,
  onClose,
  employee,
  record,
}: AttendanceDayDetailProps) {
  if (!employee || !record) return null;

  const statusInfo = getStatusBadge(record.status);
  const StatusIcon = statusInfo.icon;
  const dateFormatted = format(parseISO(record.date), 'EEEE d MMMM yyyy', {
    locale: fr,
  });

  const entry = record.timeEntry;
  const entrySource = entry ? getEntrySource(entry.entrySource) : null;
  const EntrySourceIcon = entrySource?.icon || Clock;

  const hasOvertime =
    entry?.overtimeBreakdown &&
    Object.values(entry.overtimeBreakdown).some(
      (v) => typeof v === 'number' && v > 0
    );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Détail de la journée
          </DialogTitle>
          <DialogDescription>
            {employee.fullName} - {dateFormatted}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.text}
            </Badge>
          </div>

          <Separator />

          {/* Time Entry Details (if present or pending) */}
          {entry && (
            <>
              {/* Clock In/Out Times */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Arrivée</p>
                    <p className="font-medium">{formatTime(entry.clockIn)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Départ</p>
                    <p className="font-medium">
                      {entry.clockOut ? formatTime(entry.clockOut) : 'En cours'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Hours */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span className="text-sm">Heures travaillées</span>
                </div>
                <span className="text-xl font-bold">{entry.totalHours}h</span>
              </div>

              {/* Entry Source & Approval Status */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <EntrySourceIcon className="h-4 w-4" />
                  <span>{entrySource?.label}</span>
                </div>
                <Badge
                  variant={
                    entry.approvalStatus === 'approved'
                      ? 'default'
                      : entry.approvalStatus === 'rejected'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {entry.approvalStatus === 'approved'
                    ? 'Validé'
                    : entry.approvalStatus === 'rejected'
                    ? 'Rejeté'
                    : 'En attente'}
                </Badge>
              </div>

              {/* Overtime Breakdown (Collapsible) */}
              {hasOvertime && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-sm p-2 hover:bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-orange-500" />
                      <span>Détail heures supplémentaires</span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 pl-6">
                    {(entry.overtimeBreakdown?.hours_41_to_46 ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">41-46h (×1.15)</span>
                        <span>{entry.overtimeBreakdown?.hours_41_to_46}h</span>
                      </div>
                    )}
                    {(entry.overtimeBreakdown?.hours_above_46 ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">46h+ (×1.50)</span>
                        <span>{entry.overtimeBreakdown?.hours_above_46}h</span>
                      </div>
                    )}
                    {(entry.overtimeBreakdown?.night_work ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          <Moon className="h-3 w-3 inline mr-1" />
                          Nuit (×1.75)
                        </span>
                        <span>{entry.overtimeBreakdown?.night_work}h</span>
                      </div>
                    )}
                    {(entry.overtimeBreakdown?.saturday ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Samedi (×1.50)</span>
                        <span>{entry.overtimeBreakdown?.saturday}h</span>
                      </div>
                    )}
                    {(entry.overtimeBreakdown?.sunday ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dimanche (×1.75)</span>
                        <span>{entry.overtimeBreakdown?.sunday}h</span>
                      </div>
                    )}
                    {(entry.overtimeBreakdown?.public_holiday ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Jour férié (×2.00)</span>
                        <span>{entry.overtimeBreakdown?.public_holiday}h</span>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Notes */}
              {entry.notes && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted/30 p-2 rounded">{entry.notes}</p>
                </div>
              )}
            </>
          )}

          {/* Leave Info */}
          {record.status === 'leave' && record.leaveInfo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{record.leaveInfo.policyName}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Type: {record.leaveInfo.policyType === 'annual_leave'
                  ? 'Congés annuels'
                  : record.leaveInfo.policyType === 'sick_leave'
                  ? 'Maladie'
                  : record.leaveInfo.policyType === 'maternity'
                  ? 'Maternité'
                  : record.leaveInfo.policyType}
              </p>
            </div>
          )}

          {/* Absent (no entry) */}
          {record.status === 'absent' && (
            <div className="text-center py-4 text-muted-foreground">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p>Aucun pointage enregistré</p>
            </div>
          )}

          {/* Holiday Info */}
          {record.isHoliday && record.holidayName && (
            <div className="flex items-center gap-2 text-purple-600 bg-purple-50 p-3 rounded">
              <Sun className="h-4 w-4" />
              <span>{record.holidayName}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
