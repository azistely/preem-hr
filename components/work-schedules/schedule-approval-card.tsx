/**
 * Schedule Approval Card - Manager approval interface
 *
 * Design Pattern: Decision Making + Batch Operations
 * - Show week summary with employee info
 * - Approve/Reject actions
 * - Bulk selection support
 * - Visual feedback
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X, Clock, User, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyScheduleGroup } from '@/lib/db/schema/work-schedules';

type ScheduleApprovalCardProps = {
  weeklySchedule: WeeklyScheduleGroup;
  employeeName: string;
  employeeNumber?: string;
  employeePhotoUrl?: string;
  onApprove: (scheduleIds: string[]) => Promise<void>;
  onReject: (scheduleIds: string[], reason: string) => Promise<void>;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  disabled?: boolean;
};

export function ScheduleApprovalCard({
  weeklySchedule,
  employeeName,
  employeeNumber,
  employeePhotoUrl,
  onApprove,
  onReject,
  selected = false,
  onSelectionChange,
  disabled = false,
}: ScheduleApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const { weekStartDate, schedules, totalDays, totalHours } = weeklySchedule;
  const scheduleIds = schedules.map((s) => s.id);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(scheduleIds);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;

    setIsRejecting(true);
    try {
      await onReject(scheduleIds, rejectionReason);
      setShowRejectDialog(false);
      setRejectionReason('');
    } finally {
      setIsRejecting(false);
    }
  };

  const initials = employeeName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <Card className={cn(selected && 'ring-2 ring-primary')}>
        <CardHeader>
          <div className="flex items-center gap-4">
            {onSelectionChange && (
              <Checkbox
                checked={selected}
                onCheckedChange={onSelectionChange}
                disabled={disabled}
              />
            )}

            <Avatar className="h-12 w-12">
              <AvatarImage src={employeePhotoUrl} alt={employeeName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <CardTitle className="text-lg">{employeeName}</CardTitle>
              {employeeNumber && (
                <div className="text-sm text-muted-foreground">
                  Matricule: {employeeNumber}
                </div>
              )}
            </div>

            <Badge variant="secondary" className="ml-auto">
              <Clock className="h-3 w-3 mr-1" />
              En attente
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Week Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>
              Semaine du {format(weekStartDate, 'd MMMM yyyy', { locale: fr })}
            </span>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-primary">{totalDays}</div>
              <div className="text-xs text-muted-foreground mt-1">Jours</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-primary">
                {totalHours.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Heures</div>
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Détail des jours:</div>
            <div className="grid grid-cols-7 gap-1">
              {schedules.map((schedule) => {
                const date = new Date(schedule.workDate);
                const dayName = format(date, 'EEE', { locale: fr });

                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      'text-center p-2 rounded text-xs',
                      schedule.isPresent
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    <div className="font-semibold capitalize">{dayName}</div>
                    <div className="mt-1">
                      {schedule.isPresent ? (
                        <>
                          <Check className="h-3 w-3 mx-auto" />
                          <div className="text-[10px] mt-1">
                            {Number(schedule.hoursWorked || 0)}h
                          </div>
                        </>
                      ) : (
                        <X className="h-3 w-3 mx-auto" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setShowRejectDialog(true)}
              disabled={disabled || isApproving}
            >
              <X className="h-4 w-4 mr-2" />
              Rejeter
            </Button>
            <Button
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={disabled || isApproving}
            >
              {isApproving ? (
                'Approbation...'
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Approuver
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter les horaires</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du rejet pour {employeeName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Raison du rejet *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Heures incorrectes, jours non justifiés..."
                className="min-h-[100px] mt-2"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground mt-1">
                {rejectionReason.length}/500 caractères
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
              }}
              disabled={isRejecting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isRejecting}
            >
              {isRejecting ? 'Rejet...' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
