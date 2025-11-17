/**
 * Compact Time Entry Component
 *
 * Mobile-optimized compact view for time entry approval.
 * Shows essential info in ~80px height vs 290px detailed view.
 * - Shows: Checkbox + Name + Date + Hours + Status + Quick approve
 * - Hides: Photos, location, overtime breakdown (click to expand)
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Check,
  X,
  ChevronRight,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { TimeEntry } from './time-entry-approval-card';

interface CompactTimeEntryProps {
  entry: TimeEntry;
  onApprove?: (entryId: string) => Promise<void>;
  onReject?: (entryId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
  isSelected?: boolean;
  onSelect?: (entryId: string, selected: boolean) => void;
}

export function CompactTimeEntry({
  entry,
  onApprove,
  onReject,
  isLoading = false,
  isSelected = false,
  onSelect,
}: CompactTimeEntryProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const employeeName = `${entry.employee.firstName} ${entry.employee.lastName}`;
  const initials = `${entry.employee.firstName[0]}${entry.employee.lastName[0]}`;

  const clockInDate = new Date(entry.clockIn);
  const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;

  // Calculate total overtime hours
  const overtimeHours =
    (entry.overtimeBreakdown?.hours_41_to_46 || 0) +
    (entry.overtimeBreakdown?.hours_above_46 || 0) +
    (entry.overtimeBreakdown?.saturday || 0) +
    (entry.overtimeBreakdown?.sunday || 0) +
    (entry.overtimeBreakdown?.night_work || 0) +
    (entry.overtimeBreakdown?.public_holiday || 0);

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

  const getStatusBadge = () => {
    switch (entry.status) {
      case 'approved':
        return (
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            Validé
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            Rejeté
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            En attente
          </Badge>
        );
    }
  };

  return (
    <>
      <Card
        className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
          showDetails ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-3">
          {/* Checkbox (for future bulk operations) */}
          {onSelect && entry.status === 'pending' && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                onSelect(entry.id, checked as boolean);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={entry.employee.photoUrl || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          {/* Name and Date */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{employeeName}</p>
            <p className="text-xs text-muted-foreground">
              {format(clockInDate, 'd MMM yyyy', { locale: fr })} •{' '}
              {format(clockInDate, 'HH:mm')}
              {clockOutDate && ` - ${format(clockOutDate, 'HH:mm')}`}
            </p>
          </div>

          {/* Hours */}
          <div className="text-right">
            <p className="text-lg font-bold">
              {entry.totalHours ? `${entry.totalHours}h` : '-'}
            </p>
            {overtimeHours > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <TrendingUp className="h-3 w-3" />
                {overtimeHours.toFixed(1)}h
              </div>
            )}
          </div>

          {/* Status or Quick Actions */}
          {entry.status === 'pending' && onApprove ? (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="default"
                className="min-h-[36px]"
                onClick={handleApprove}
                disabled={isLoading || isSubmitting}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px]"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isLoading || isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <ChevronRight
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  showDetails ? 'rotate-90' : ''
                }`}
              />
            </div>
          )}
        </div>

        {/* Additional badges */}
        {(entry.geofenceVerified || overtimeHours > 0) && (
          <div className="flex gap-2 mt-2 ml-14">
            {entry.geofenceVerified && (
              <Badge variant="outline" className="gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                Lieu vérifié
              </Badge>
            )}
          </div>
        )}

        {/* Expanded details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t ml-14 space-y-3">
            {/* Overtime breakdown */}
            {overtimeHours > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Heures supplémentaires: {overtimeHours.toFixed(1)}h
                </p>
                <div className="space-y-1 text-xs text-amber-800">
                  {entry.overtimeBreakdown?.hours_41_to_46 ? (
                    <p>Heures 41-46: {entry.overtimeBreakdown.hours_41_to_46}h (+15%)</p>
                  ) : null}
                  {entry.overtimeBreakdown?.hours_above_46 ? (
                    <p>Heures 46+: {entry.overtimeBreakdown.hours_above_46}h (+50%)</p>
                  ) : null}
                  {entry.overtimeBreakdown?.saturday ? (
                    <p>Samedi: {entry.overtimeBreakdown.saturday}h (+50%)</p>
                  ) : null}
                  {entry.overtimeBreakdown?.sunday ? (
                    <p>Dimanche: {entry.overtimeBreakdown.sunday}h (+75%)</p>
                  ) : null}
                  {entry.overtimeBreakdown?.night_work ? (
                    <p>Nuit: {entry.overtimeBreakdown.night_work}h (+75%)</p>
                  ) : null}
                  {entry.overtimeBreakdown?.public_holiday ? (
                    <p>Jour férié: {entry.overtimeBreakdown.public_holiday}h (+100%)</p>
                  ) : null}
                </div>
              </div>
            )}

            {/* Photos */}
            {(entry.clockInPhotoUrl || entry.clockOutPhotoUrl) && (
              <div className="flex gap-2 text-xs">
                {entry.clockInPhotoUrl && (
                  <a
                    href={entry.clockInPhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Photo arrivée
                  </a>
                )}
                {entry.clockOutPhotoUrl && (
                  <a
                    href={entry.clockOutPhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
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
          </div>
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
