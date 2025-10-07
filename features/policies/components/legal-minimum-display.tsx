/**
 * LegalMinimumDisplay Component
 *
 * Shows legal minimum values inline with input fields
 * Provides clear visual indication of compliance requirements
 */

import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LegalMinimumDisplayProps {
  minimum: number | string;
  unit?: string;
  reference?: string;
  variant?: 'inline' | 'block';
  className?: string;
}

export function LegalMinimumDisplay({
  minimum,
  unit = '',
  reference = 'Convention Collective',
  variant = 'inline',
  className,
}: LegalMinimumDisplayProps) {
  if (variant === 'block') {
    return (
      <div
        className={cn(
          'rounded-lg border bg-muted/50 p-3 space-y-2',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Minimum légal</span>
        </div>
        <div className="text-2xl font-bold">
          {minimum} {unit}
        </div>
        {reference && (
          <p className="text-xs text-muted-foreground">{reference}</p>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={cn('cursor-help', className)}>
            Minimum: {minimum} {unit}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Minimum légal</p>
          {reference && (
            <p className="text-xs text-muted-foreground mt-1">{reference}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LegalMinimumAlertProps {
  title: string;
  minimum: number | string;
  current: number | string;
  reference?: string;
  severity?: 'error' | 'warning';
}

export function LegalMinimumAlert({
  title,
  minimum,
  current,
  reference,
  severity = 'error',
}: LegalMinimumAlertProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-2',
        severity === 'error'
          ? 'border-destructive bg-destructive/10'
          : 'border-yellow-500 bg-yellow-50'
      )}
    >
      <div className="flex items-start gap-2">
        <Info
          className={cn(
            'h-5 w-5 mt-0.5',
            severity === 'error' ? 'text-destructive' : 'text-yellow-600'
          )}
        />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">{title}</p>
          <div className="text-sm text-muted-foreground">
            <p>
              Valeur actuelle: <strong>{current}</strong>
            </p>
            <p>
              Minimum requis: <strong>{minimum}</strong>
            </p>
            {reference && (
              <p className="text-xs mt-2 italic">{reference}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
