/**
 * AlertCard Component
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Displays proactive alerts with severity-based styling
 * Design: Mobile-first, touch-friendly (≥44px targets), French language
 */

'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertTriangle, Info, AlertCircle, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Alert } from '@/lib/db/schema/automation';

interface AlertCardProps {
  alert: Alert & {
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  };
  onDismiss?: (id: string) => void;
  onComplete?: (id: string) => void;
  onAction?: (url: string) => void;
  compact?: boolean;
}

const severityConfig = {
  info: {
    icon: Info,
    containerClass: 'border-blue-200 bg-blue-50',
    iconClass: 'text-blue-600',
    titleClass: 'text-blue-900',
  },
  warning: {
    icon: AlertCircle,
    containerClass: 'border-yellow-200 bg-yellow-50',
    iconClass: 'text-yellow-600',
    titleClass: 'text-yellow-900',
  },
  urgent: {
    icon: AlertTriangle,
    containerClass: 'border-red-200 bg-red-50',
    iconClass: 'text-red-600',
    titleClass: 'text-red-900',
  },
};

export function AlertCard({
  alert,
  onDismiss,
  onComplete,
  onAction,
  compact = false,
}: AlertCardProps) {
  const config = severityConfig[alert.severity as keyof typeof severityConfig];
  const Icon = config.icon;

  const handleAction = () => {
    if (alert.actionUrl && onAction) {
      onAction(alert.actionUrl);
    }
  };

  const employeeInitials = alert.employee
    ? `${alert.employee.firstName[0]}${alert.employee.lastName[0]}`
    : '??';

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-l-4',
        config.containerClass,
        'transition-all hover:shadow-md'
      )}
    >
      {/* Mobile-friendly touch targets */}
      <div className={cn('p-4', compact ? 'space-y-2' : 'space-y-4')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('flex-shrink-0', config.iconClass)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Alert Message */}
            <p className={cn('font-medium', config.titleClass, compact ? 'text-sm' : 'text-base')}>
              {alert.message}
            </p>

            {/* Due Date */}
            {alert.dueDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Échéance: {format(new Date(alert.dueDate), 'dd MMM yyyy', { locale: fr })}
              </p>
            )}
          </div>

          {/* Dismiss Button */}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
              className="flex-shrink-0 h-8 w-8 p-0"
              aria-label="Ignorer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Employee Info (if applicable) */}
        {alert.employee && !compact && (
          <div className="flex items-center gap-3 pl-8">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{employeeInitials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {alert.employee.firstName} {alert.employee.lastName}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={cn('flex gap-2', compact ? 'pl-8' : 'pl-8 pt-2')}>
          {alert.actionUrl && alert.actionLabel && (
            <Button
              onClick={handleAction}
              size="sm"
              className="min-h-[44px]"
            >
              {alert.actionLabel}
            </Button>
          )}

          {onComplete && (
            <Button
              onClick={() => onComplete(alert.id)}
              variant="outline"
              size="sm"
              className="min-h-[44px]"
            >
              <Check className="h-4 w-4 mr-2" />
              Marquer comme fait
            </Button>
          )}

          {onDismiss && !compact && (
            <Button
              onClick={() => onDismiss(alert.id)}
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              Plus tard
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Compact Alert Item for Lists
 */
export function AlertItem({
  alert,
  onClick,
}: {
  alert: Alert;
  onClick?: () => void;
}) {
  const config = severityConfig[alert.severity as keyof typeof severityConfig];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors',
        'hover:bg-accent hover:border-accent-foreground/20',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        'min-h-[44px]', // Touch-friendly
        config.containerClass
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4 flex-shrink-0', config.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium truncate', config.titleClass)}>
            {alert.message}
          </p>
          {alert.dueDate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(alert.dueDate), 'dd MMM', { locale: fr })}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
