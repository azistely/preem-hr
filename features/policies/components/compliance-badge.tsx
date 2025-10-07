/**
 * ComplianceBadge Component
 *
 * Visual indicator for policy compliance level
 * Shows lock icon for Convention Collective policies
 */

import { Badge } from '@/components/ui/badge';
import { Lock, Settings, Palette, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComplianceLevel =
  | 'locked'
  | 'convention_collective'
  | 'configurable'
  | 'freeform'
  | 'non_compliant';

interface ComplianceBadgeProps {
  level: ComplianceLevel;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const COMPLIANCE_CONFIG: Record<
  ComplianceLevel,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof Lock;
    description: string;
  }
> = {
  locked: {
    label: 'Verrouillée',
    variant: 'secondary',
    icon: Lock,
    description: 'Convention Collective',
  },
  convention_collective: {
    label: 'Conforme',
    variant: 'default',
    icon: Lock,
    description: 'Convention Collective',
  },
  configurable: {
    label: 'Configurable',
    variant: 'outline',
    icon: Settings,
    description: 'Limites légales appliquées',
  },
  freeform: {
    label: 'Personnalisé',
    variant: 'secondary',
    icon: Palette,
    description: 'Politique sur mesure',
  },
  non_compliant: {
    label: 'Non conforme',
    variant: 'destructive',
    icon: AlertTriangle,
    description: 'Attention: non conforme aux minimums légaux',
  },
};

export function ComplianceBadge({
  level,
  className,
  showIcon = true,
  size = 'md',
}: ComplianceBadgeProps) {
  const config = COMPLIANCE_CONFIG[level];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1.5',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      <span>{config.label}</span>
    </Badge>
  );
}

export function ComplianceBadgeWithDescription({
  level,
  className,
}: {
  level: ComplianceLevel;
  className?: string;
}) {
  const config = COMPLIANCE_CONFIG[level];

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <ComplianceBadge level={level} />
      <p className="text-sm text-muted-foreground">{config.description}</p>
    </div>
  );
}
