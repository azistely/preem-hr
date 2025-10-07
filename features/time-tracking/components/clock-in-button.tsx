/**
 * Clock In/Out Button Component
 *
 * Mobile-first component following HCI principles:
 * - Large touch targets (min 56px height)
 * - Clear visual feedback
 * - Error prevention
 * - French labels
 * - Geolocation integration
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Camera, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClockInButtonProps {
  employeeId: string;
  currentEntry?: any; // Time entry data from parent
  onUpdate?: () => void; // Callback to refresh parent data
}

export function ClockInButton({ employeeId, currentEntry, onUpdate }: ClockInButtonProps) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const clockInMutation = trpc.timeTracking.clockIn.useMutation({
    onSuccess: () => {
      toast.success('Arrivée enregistrée');
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const clockOutMutation = trpc.timeTracking.clockOut.useMutation({
    onSuccess: () => {
      toast.success('Départ enregistré');
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Get GPS location
  const getLocation = async () => {
    setIsGettingLocation(true);
    try {
      if (!navigator.geolocation) {
        throw new Error('Géolocalisation non supportée');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const loc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(loc);
      return loc;
    } catch (error) {
      toast.error('Impossible d\'obtenir votre position');
      throw error;
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Clock in
  const handleClockIn = async () => {
    try {
      // Validate employeeId before proceeding
      if (!employeeId) {
        toast.error('Impossible de pointer: employé non identifié');
        return;
      }

      const loc = await getLocation();

      await clockInMutation.mutateAsync({
        employeeId,
        location: loc,
      });
    } catch (error) {
      // Error already shown by toast
    }
  };

  // Clock out
  const handleClockOut = async () => {
    try {
      // Validate employeeId before proceeding
      if (!employeeId) {
        toast.error('Impossible de pointer: employé non identifié');
        return;
      }

      const loc = await getLocation();

      await clockOutMutation.mutateAsync({
        employeeId,
        location: loc,
      });
    } catch (error) {
      // Error already shown by toast
    }
  };

  const isClockedIn = !!currentEntry && !currentEntry.clockOut;
  const isLoading = clockInMutation.isLoading || clockOutMutation.isLoading || isGettingLocation;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pointage</span>
          {isClockedIn && (
            <Badge variant="default" className="text-base">
              En cours
            </Badge>
          )}
        </CardTitle>
        {isClockedIn && currentEntry && (
          <CardDescription className="text-base">
            Arrivée:{' '}
            {formatDistanceToNow(new Date(currentEntry.clockIn), {
              addSuffix: true,
              locale: fr,
            })}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main action button */}
        {!isClockedIn ? (
          <Button
            onClick={handleClockIn}
            disabled={isLoading}
            className="w-full min-h-[56px] text-lg"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Localisation en cours...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-6 w-6" />
                Pointer l'arrivée
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleClockOut}
            disabled={isLoading}
            className="w-full min-h-[56px] text-lg"
            size="lg"
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Localisation en cours...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-6 w-6" />
                Pointer le départ
              </>
            )}
          </Button>
        )}

        {/* Location status */}
        {location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              Position enregistrée ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
            </span>
          </div>
        )}

        {/* Geofence info */}
        {currentEntry?.geofenceVerified && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <MapPin className="h-4 w-4" />
            <span>Lieu de travail vérifié</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
