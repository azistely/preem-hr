'use client';

/**
 * Employee Status Badge Component
 *
 * Reusable badge for both draft and calculated review modes
 * - Draft mode: Shows 'critical', 'warning', 'ready', 'info' statuses
 * - Calculated mode: Shows 'verified', 'flagged', 'unverified', 'auto_ok' statuses
 *
 * Design: Color-coded with icons, mobile-friendly (min 44px touch target)
 */

import { AlertCircle, AlertTriangle, CheckCircle, Info, Check, Flag, HelpCircle, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Draft mode statuses
type DraftStatus = 'critical' | 'warning' | 'ready' | 'info';

// Calculated mode statuses
type CalculatedStatus = 'verified' | 'flagged' | 'unverified' | 'auto_ok';

interface EmployeeStatusBadgeProps {
  mode: 'draft' | 'calculated';
  status: DraftStatus | CalculatedStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EmployeeStatusBadge({
  mode,
  status,
  size = 'md',
  className,
}: EmployeeStatusBadgeProps) {
  const getDraftConfig = (status: DraftStatus) => {
    const configs = {
      critical: {
        icon: AlertCircle,
        label: 'Critique',
        variant: 'destructive' as const,
        colorClass: 'bg-red-100 text-red-700 border-red-300',
      },
      warning: {
        icon: AlertTriangle,
        label: 'Attention',
        variant: 'default' as const,
        colorClass: 'bg-orange-100 text-orange-700 border-orange-300',
      },
      ready: {
        icon: CheckCircle,
        label: 'Prêt',
        variant: 'default' as const,
        colorClass: 'bg-green-100 text-green-700 border-green-300',
      },
      info: {
        icon: Info,
        label: 'Info',
        variant: 'secondary' as const,
        colorClass: 'bg-blue-100 text-blue-700 border-blue-300',
      },
    };
    return configs[status];
  };

  const getCalculatedConfig = (status: CalculatedStatus) => {
    const configs = {
      verified: {
        icon: Check,
        label: 'Vérifié',
        variant: 'default' as const,
        colorClass: 'bg-green-100 text-green-700 border-green-300',
      },
      flagged: {
        icon: Flag,
        label: 'Signalé',
        variant: 'default' as const,
        colorClass: 'bg-orange-100 text-orange-700 border-orange-300',
      },
      unverified: {
        icon: HelpCircle,
        label: 'Non vérifié',
        variant: 'secondary' as const,
        colorClass: 'bg-gray-100 text-gray-700 border-gray-300',
      },
      auto_ok: {
        icon: Bot,
        label: 'Auto-vérifié',
        variant: 'secondary' as const,
        colorClass: 'bg-blue-100 text-blue-700 border-blue-300',
      },
    };
    return configs[status];
  };

  const config = mode === 'draft'
    ? getDraftConfig(status as DraftStatus)
    : getCalculatedConfig(status as CalculatedStatus);

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-11 px-4 text-base min-h-[44px]', // Touch-friendly
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        sizeClasses[size],
        config.colorClass,
        'inline-flex items-center gap-1.5 font-medium border',
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </Badge>
  );
}
