/**
 * Transport Allowance Alert Component
 *
 * HCI Principles Applied:
 * - Pattern 3: Error Prevention (validate against location minimum)
 * - Pattern 5: Immediate Feedback (real-time validation)
 * - Pattern 7: Country-Specific Labels (reference location requirements)
 *
 * Validates transport allowance against location's minimum requirement
 */

'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface TransportAllowanceAlertProps {
  locationId: string | null | undefined;
  currentTransport: number; // In the employee's rate type (hourly/daily/monthly)
  rateType: 'HOURLY' | 'DAILY' | 'MONTHLY';
  className?: string;
}

export function TransportAllowanceAlert({
  locationId,
  currentTransport,
  rateType,
  className,
}: TransportAllowanceAlertProps) {
  const [minimumTransport, setMinimumTransport] = useState<number>(0);
  const [locationName, setLocationName] = useState<string>('');

  // Fetch location details
  const { data: location, isLoading } = trpc.locations.get.useQuery(
    { id: locationId! },
    { enabled: !!locationId }
  );

  // Convert location's monthly transport to employee's rate type
  useEffect(() => {
    if (location?.transportAllowance) {
      const monthlyTransport = parseFloat(location.transportAllowance.toString());
      let converted = monthlyTransport;

      if (rateType === 'HOURLY') {
        // Convert monthly to hourly: divide by 240 (30 days × 8 hours)
        converted = Math.round(monthlyTransport / 240);
      } else if (rateType === 'DAILY') {
        // Convert monthly to daily: divide by 30
        converted = Math.round(monthlyTransport / 30);
      }

      setMinimumTransport(converted);
      setLocationName(location.locationName || '');
    }
  }, [location, rateType]);

  // Format currency (West African CFA Franc)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  // Get rate label
  const getRateLabel = () => {
    switch (rateType) {
      case 'HOURLY': return '/heure';
      case 'DAILY': return '/jour';
      case 'MONTHLY': return '';
      default: return '';
    }
  };

  // Don't show if loading or no location
  if (isLoading || !location) {
    return null;
  }

  // Don't show if location has no minimum transport requirement
  if (minimumTransport === 0) {
    return null;
  }

  // Don't show if no transport entered yet
  if (currentTransport === 0) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Transport minimum pour {locationName}:</strong>{' '}
          {formatCurrency(minimumTransport)}{getRateLabel()}
        </AlertDescription>
      </Alert>
    );
  }

  // Determine alert state
  const difference = Math.abs(currentTransport - minimumTransport);
  const percentageBelow = minimumTransport > 0
    ? ((minimumTransport - currentTransport) / minimumTransport) * 100
    : 0;

  // Below minimum (ERROR)
  if (currentTransport < minimumTransport) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">
              L'indemnité de transport est inférieure au minimum requis pour ce site.
            </p>

            <div className="text-sm space-y-1">
              <p>
                <strong>Site:</strong> {locationName}
              </p>
              <p>
                <strong>Transport actuel:</strong> {formatCurrency(currentTransport)}{getRateLabel()}
              </p>
              <p>
                <strong>Minimum requis:</strong> {formatCurrency(minimumTransport)}{getRateLabel()}
              </p>
              <p className="text-destructive-foreground/80">
                <strong>Différence:</strong> {formatCurrency(difference)}{' '}
                ({percentageBelow.toFixed(1)}% en dessous)
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // At or above minimum (valid)
  if (currentTransport >= minimumTransport) {
    return (
      <Alert className={className}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          Indemnité de transport conforme au minimum du site.{' '}
          <span className="text-muted-foreground">
            (Minimum {locationName}: {formatCurrency(minimumTransport)}{getRateLabel()})
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
