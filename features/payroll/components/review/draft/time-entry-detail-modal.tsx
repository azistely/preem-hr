'use client';

/**
 * Time Entry Detail Modal
 *
 * Full breakdown of a single day's time entry
 * - Clock in/out times, break, total hours
 * - Overtime calculation (if applicable)
 * - Location/photo verification
 * - Approve/reject/edit actions
 *
 * Design: Mobile-first dialog, large touch targets, clear CTAs
 */

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock,
  MapPin,
  Camera,
  Check,
  XCircle,
  Edit,
  Coffee,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimeEntryDetail {
  id: string;
  employeeName: string;
  employeeNumber: string;
  clockIn: string; // ISO timestamp
  clockOut: string | null;
  totalHours: number | null;
  breakMinutes?: number;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string | null;
  clockInLocation?: { lat: number; lng: number } | null;
  clockOutLocation?: { lat: number; lng: number } | null;
  geofenceVerified?: boolean;
  clockInPhotoUrl?: string | null;
  clockOutPhotoUrl?: string | null;
  notes?: string | null;
  overtimeHours?: number;
  overtimeAmount?: number;
}

interface TimeEntryDetailModalProps {
  open: boolean;
  onClose: () => void;
  entry: TimeEntryDetail | null;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function TimeEntryDetailModal({
  open,
  onClose,
  entry,
  onApprove,
  onReject,
  onEdit,
  isApproving = false,
  isRejecting = false,
}: TimeEntryDetailModalProps) {
  if (!entry) return null;

  const clockInTime = parseISO(entry.clockIn);
  const clockOutTime = entry.clockOut ? parseISO(entry.clockOut) : null;

  const formatTime = (date: Date) => format(date, 'HH:mm');
  const formatDateTime = (date: Date) =>
    format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });

  const canApprove = entry.status === 'pending';
  const canReject = entry.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {format(clockInTime, 'EEEE dd MMMM yyyy', { locale: fr })}
          </DialogTitle>
          <DialogDescription>
            {entry.employeeName} (#{entry.employeeNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Time Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Arrivée
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {formatTime(clockInTime)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Départ
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {clockOutTime ? formatTime(clockOutTime) : '--:--'}
                  </div>
                </div>
              </div>

              {entry.breakMinutes !== undefined && entry.breakMinutes > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Coffee className="h-4 w-4" />
                      <span>Pause</span>
                    </div>
                    <Badge variant="outline">{entry.breakMinutes} min</Badge>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-primary">
                  {entry.totalHours !== null
                    ? `${entry.totalHours.toFixed(2)}h`
                    : 'Non calculé'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Overtime (if applicable) */}
          {entry.overtimeHours !== undefined && entry.overtimeHours > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-base">Heures Supplémentaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Heures sup
                  </span>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700">
                    {entry.overtimeHours.toFixed(1)}h
                  </Badge>
                </div>
                {entry.overtimeAmount !== undefined && (
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-sm">Prime calculée</span>
                    <span className="text-primary">
                      +{entry.overtimeAmount.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location Verification */}
          {(entry.clockInLocation || entry.clockOutLocation) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {entry.clockInLocation && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Arrivée</span>
                    <Badge
                      variant={entry.geofenceVerified ? 'default' : 'secondary'}
                      className={
                        entry.geofenceVerified
                          ? 'bg-green-100 text-green-700'
                          : ''
                      }
                    >
                      {entry.geofenceVerified ? '✓ Vérifiée' : 'Non vérifiée'}
                    </Badge>
                  </div>
                )}
                {entry.clockOutLocation && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Départ</span>
                    <Badge
                      variant={entry.geofenceVerified ? 'default' : 'secondary'}
                      className={
                        entry.geofenceVerified
                          ? 'bg-green-100 text-green-700'
                          : ''
                      }
                    >
                      {entry.geofenceVerified ? '✓ Vérifiée' : 'Non vérifiée'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {(entry.clockInPhotoUrl || entry.clockOutPhotoUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {entry.clockInPhotoUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Arrivée
                    </div>
                    <img
                      src={entry.clockInPhotoUrl}
                      alt="Photo arrivée"
                      className="rounded-lg border w-full h-32 object-cover"
                    />
                  </div>
                )}
                {entry.clockOutPhotoUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Départ
                    </div>
                    <img
                      src={entry.clockOutPhotoUrl}
                      alt="Photo départ"
                      className="rounded-lg border w-full h-32 object-cover"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {entry.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{entry.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Status Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {entry.status === 'approved' && entry.approvedBy && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-green-700">
                      Approuvé par {entry.approvedBy}
                    </div>
                    {entry.approvedAt && (
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(parseISO(entry.approvedAt))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {entry.status === 'rejected' && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-red-700">Rejeté</div>
                    {entry.rejectionReason && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Raison: {entry.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {entry.status === 'pending' && (
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="font-medium text-orange-700">
                    En attente d&apos;approbation
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canApprove && (
            <>
              <Button
                variant="outline"
                onClick={onEdit}
                className="min-h-[48px] gap-2"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </Button>
              <Button
                variant="outline"
                onClick={onReject}
                disabled={isRejecting}
                className="min-h-[48px] gap-2 border-red-300 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 text-red-600" />
                Rejeter
              </Button>
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="min-h-[48px] gap-2"
              >
                <Check className="h-4 w-4" />
                Approuver
              </Button>
            </>
          )}
          {!canApprove && (
            <Button
              variant="outline"
              onClick={onClose}
              className="min-h-[48px]"
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
