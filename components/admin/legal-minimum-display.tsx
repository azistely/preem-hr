/**
 * Legal Minimum Display Component
 *
 * Shows legal minimum value with reference
 * Used alongside input fields to display compliance requirements
 *
 * Usage:
 * <LegalMinimumDisplay
 *   label="Minimum légal"
 *   value={2.0}
 *   unit="jours/mois"
 *   reference="Convention Collective Article 28"
 * />
 */

import { Info, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LegalMinimumDisplayProps {
  label?: string;
  value: number | string;
  unit?: string;
  reference?: string;
  variant?: 'inline' | 'badge';
  className?: string;
  showIcon?: boolean;
}

export function LegalMinimumDisplay({
  label = 'Minimum légal',
  value,
  unit,
  reference,
  variant = 'inline',
  className,
  showIcon = true,
}: LegalMinimumDisplayProps) {
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className={cn('gap-1.5', className)}>
              {showIcon && <Lock className="h-3 w-3" />}
              <span>
                {label}: {value}
                {unit && ` ${unit}`}
              </span>
            </Badge>
          </TooltipTrigger>
          {reference && (
            <TooltipContent side="bottom">
              <p className="text-sm">{reference}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('rounded-md border border-muted bg-muted/20 p-3', className)}>
      <div className="flex items-start gap-2">
        {showIcon && <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {label}: <span className="font-semibold text-lg">{value}</span>
            {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
          </p>
          {reference && (
            <p className="text-xs text-muted-foreground">
              Référence: {reference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
