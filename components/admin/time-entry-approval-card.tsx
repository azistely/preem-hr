/**
 * Time Entry Approval Card
 *
 * Displays a single time entry for admin approval with:
 * - Employee info and photo
 * - Clock in/out times
 * - Geofence verification status
 * - Overtime breakdown
 * - Approve/reject actions
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Check,
  X,
  MapPin,
  Camera,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface TimeEntry {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  clockIn: string;
  clockOut: string | null;
  totalHours: string | null;
  geofenceVerified: boolean | null;
  clockInPhotoUrl?: string | null;
  clockOutPhotoUrl?: string | null;
  overtimeBreakdown: {
    hours_41_to_46?: number;
    hours_above_46?: number;
    weekend?: number;
    night_work?: number;
    holiday?: number;
  } | null;
  notes?: string | null;
  status: string;
}

interface TimeEntryApprovalCardProps {
  entry: TimeEntry;
  onApprove?: (entryId: string) => Promise<void>;
  onReject?: (entryId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function TimeEntryApprovalCard({
  entry,
  onApprove,
  onReject,
  isLoading = false,
}: TimeEntryApprovalCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const employeeName = `${entry.employee.firstName} ${entry.employee.lastName}`;
  const initials = `${entry.employee.firstName[0]}${entry.employee.lastName[0]}`;

  const clockInDate = new Date(entry.clockIn);
  const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;

  // Calculate total overtime hours
  const overtimeHours =
    (entry.overtimeBreakdown?.hours_41_to_46 || 0) +
    (entry.overtimeBreakdown?.hours_above_46 || 0) +
    (entry.overtimeBreakdown?.weekend || 0) +
    (entry.overtimeBreakdown?.night_work || 0) +
    (entry.overtimeBreakdown?.holiday || 0);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsSubmitting(true);
    try {
      await onApprove(entry.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectionReason.trim()) return;

    setIsSubmitting(true);
    try {
      await onReject(entry.id, rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={entry.employee.photoUrl || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{employeeName}</CardTitle>
                <CardDescription>
                  {format(clockInDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </CardDescription>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-2">
              {entry.geofenceVerified && (
                <Badge variant="default" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  Lieu vérifié
                </Badge>
              )}
              {!entry.geofenceVerified && entry.clockInPhotoUrl && (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Hors zone
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Clock times */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {format(clockInDate, 'HH:mm')}
                </p>
                <p className="text-xs text-muted-foreground">Arrivée</p>
              </div>
            </div>

            {clockOutDate && (
              <>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {format(clockOutDate, 'HH:mm')}
                    </p>
                    <p className="text-xs text-muted-foreground">Départ</p>
                  </div>
                </div>
              </>
            )}

            {entry.totalHours && (
              <div className="ml-auto">
                <p className="text-lg font-bold">{entry.totalHours}h</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            )}
          </div>

          {/* Overtime breakdown */}
          {overtimeHours > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-900">
                  Heures supplémentaires: {overtimeHours.toFixed(1)}h
                </p>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="text-xs text-amber-700 hover:underline">
                  Voir les détails
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {entry.overtimeBreakdown?.hours_41_to_46 ? (
                    <p className="text-xs">
                      Heures 41-46: {entry.overtimeBreakdown.hours_41_to_46}h
                      (+15%)
                    </p>
                  ) : null}
                  {entry.overtimeBreakdown?.hours_above_46 ? (
                    <p className="text-xs">
                      Heures 46+: {entry.overtimeBreakdown.hours_above_46}h
                      (+50%)
                    </p>
                  ) : null}
                  {entry.overtimeBreakdown?.weekend ? (
                    <p className="text-xs">
                      Week-end: {entry.overtimeBreakdown.weekend}h (+50%)
                    </p>
                  ) : null}
                  {entry.overtimeBreakdown?.night_work ? (
                    <p className="text-xs">
                      Nuit: {entry.overtimeBreakdown.night_work}h (+75%)
                    </p>
                  ) : null}
                  {entry.overtimeBreakdown?.holiday ? (
                    <p className="text-xs">
                      Jour férié: {entry.overtimeBreakdown.holiday}h (+100%)
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Photos */}
          {(entry.clockInPhotoUrl || entry.clockOutPhotoUrl) && (
            <div className="flex gap-2">
              {entry.clockInPhotoUrl && (
                <a
                  href={entry.clockInPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Camera className="h-3 w-3" />
                  Photo arrivée
                </a>
              )}
              {entry.clockOutPhotoUrl && (
                <a
                  href={entry.clockOutPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Camera className="h-3 w-3" />
                  Photo départ
                </a>
              )}
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div className="text-sm">
              <p className="font-medium mb-1">Note:</p>
              <p className="text-muted-foreground">{entry.notes}</p>
            </div>
          )}
        </CardContent>

        {/* Only show action buttons if handlers are provided */}
        {(onApprove || onReject) && (
          <CardFooter className="gap-2">
            {onApprove && (
              <Button
                className="min-h-[44px] flex-1"
                variant="default"
                onClick={handleApprove}
                disabled={isLoading || isSubmitting || entry.status !== 'pending'}
              >
                <Check className="mr-2 h-5 w-5" />
                Approuver
              </Button>
            )}
            {onReject && (
              <Button
                className="min-h-[44px] flex-1"
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isLoading || isSubmitting || entry.status !== 'pending'}
              >
                <X className="mr-2 h-5 w-5" />
                Rejeter
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Rejection dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter l'entrée de temps</DialogTitle>
            <DialogDescription>
              Pour {employeeName} - {format(clockInDate, 'dd/MM/yyyy')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Raison du refus *</Label>
              <Textarea
                id="reason"
                placeholder="Expliquez pourquoi cette entrée est refusée..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="min-h-[48px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isSubmitting}
              className="min-h-[44px]"
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
