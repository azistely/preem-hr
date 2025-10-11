/**
 * Time Entry Calendar
 *
 * Display time entries in a monthly view
 * Following HCI principles:
 * - Progressive disclosure (collapsible)
 * - Visual indicators for status
 * - Mobile-responsive
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Camera
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  entryType: 'regular' | 'overtime' | 'on_call';
  status: 'pending' | 'approved' | 'rejected';
  geofenceVerified: boolean;
  clockInLocation?: any;
  clockOutLocation?: any;
  clockInPhotoUrl?: string | null;
  clockOutPhotoUrl?: string | null;
  overtimeBreakdown?: any;
}

interface TimeEntryCalendarProps {
  employeeId: string;
}

export function TimeEntryCalendar({ employeeId }: TimeEntryCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Fetch time entries for current month
  const { data: entries, isLoading } = trpc.timeTracking.getEntries.useQuery({
    employeeId,
    startDate: monthStart,
    endDate: monthEnd,
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { variant: 'outline' as const, label: 'En attente', icon: AlertCircle },
      approved: { variant: 'default' as const, label: 'Approuvé', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejeté', icon: AlertCircle },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      regular: 'Normal',
      overtime: 'Heures supp.',
      on_call: 'Astreinte',
    };
    return types[type] || type;
  };

  const calculateHoursWorked = (entry: TimeEntry) => {
    if (!entry.clockOut) return null;
    const start = new Date(entry.clockIn);
    const end = new Date(entry.clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pointages
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMonth}
                className="min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="min-h-[44px] min-w-[44px]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun pointage pour ce mois</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry: any) => {
                const hoursWorked = calculateHoursWorked(entry);
                return (
                  <Card
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {format(new Date(entry.clockIn), 'EEEE d MMMM', { locale: fr })}
                            </p>
                            {getStatusBadge(entry.status)}
                            <Badge variant="outline">{getTypeLabel(entry.entryType)}</Badge>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>
                              Entrée: {format(new Date(entry.clockIn), 'HH:mm')}
                            </span>
                            {entry.clockOut && (
                              <span>
                                Sortie: {format(new Date(entry.clockOut), 'HH:mm')}
                              </span>
                            )}
                          </div>

                          {hoursWorked && (
                            <p className="text-sm">
                              <span className="font-medium">Heures travaillées:</span>{' '}
                              {hoursWorked}h
                            </p>
                          )}

                          {entry.geofenceVerified && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <MapPin className="h-3 w-3" />
                              <span>Position vérifiée</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry Details Dialog */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Détails du pointage -{' '}
                {format(new Date(selectedEntry.clockIn), 'PPP', { locale: fr })}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status and Type */}
              <div className="flex gap-2">
                {getStatusBadge(selectedEntry.status)}
                <Badge variant="outline">{getTypeLabel(selectedEntry.entryType)}</Badge>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Heure d'entrée</p>
                  <p className="font-medium">
                    {format(new Date(selectedEntry.clockIn), 'HH:mm:ss')}
                  </p>
                </div>
                {selectedEntry.clockOut && (
                  <div>
                    <p className="text-sm text-muted-foreground">Heure de sortie</p>
                    <p className="font-medium">
                      {format(new Date(selectedEntry.clockOut), 'HH:mm:ss')}
                    </p>
                  </div>
                )}
              </div>

              {/* Hours Worked */}
              {calculateHoursWorked(selectedEntry) && (
                <div>
                  <p className="text-sm text-muted-foreground">Heures travaillées</p>
                  <p className="text-2xl font-bold">
                    {calculateHoursWorked(selectedEntry)}h
                  </p>
                </div>
              )}

              {/* Geofence */}
              <div className="flex items-center gap-2">
                <MapPin className={`h-4 w-4 ${selectedEntry.geofenceVerified ? 'text-green-600' : 'text-muted-foreground'}`} />
                <span className="text-sm">
                  {selectedEntry.geofenceVerified
                    ? 'Position vérifiée - Dans la zone autorisée'
                    : 'Position non vérifiée'}
                </span>
              </div>

              {/* Photos */}
              {(selectedEntry.clockInPhotoUrl || selectedEntry.clockOutPhotoUrl) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Photos</p>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedEntry.clockInPhotoUrl && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Entrée</p>
                        <img
                          src={selectedEntry.clockInPhotoUrl}
                          alt="Photo d'entrée"
                          className="rounded-md border w-full"
                        />
                      </div>
                    )}
                    {selectedEntry.clockOutPhotoUrl && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Sortie</p>
                        <img
                          src={selectedEntry.clockOutPhotoUrl}
                          alt="Photo de sortie"
                          className="rounded-md border w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Overtime Breakdown */}
              {selectedEntry.overtimeBreakdown && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Heures supplémentaires</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selectedEntry.overtimeBreakdown).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium ml-2">{value as string}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
