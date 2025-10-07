/**
 * Compliance Badge Component
 *
 * Visual indicator of policy compliance level:
 * - 🔒 Locked (Convention Collective mandatory)
 * - ⚙️ Configurable (within legal bounds)
 * - 🎨 Freeform (fully customizable)
 * - ⚠️ Non-compliant (violations detected)
 *
 * Usage:
 * <ComplianceBadge level="locked" />
 * <ComplianceBadge level="configurable" legalReference="Article 28" />
 */

import { Badge } from '@/components/ui/badge';
import { Lock, Settings, Palette, AlertTriangle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ComplianceBadgeProps {
  level: 'locked' | 'configurable' | 'freeform' | 'non_compliant' | 'convention_collective';
  legalReference?: string;
  className?: string;
  showLabel?: boolean;
}

const badgeConfig = {
  locked: {
    label: 'Obligatoire',
    fullLabel: 'Conforme Convention Collective',
    variant: 'default' as const,
    icon: Lock,
    description:
      'Cette politique est obligatoire selon la Convention Collective et ne peut pas être modifiée.',
  },
  convention_collective: {
    label: 'Conforme',
    fullLabel: 'Conforme Convention Collective',
    variant: 'default' as const,
    icon: Lock,
    description: 'Cette politique respecte les exigences de la Convention Collective.',
  },
  configurable: {
    label: 'Configurable',
    fullLabel: 'Configurable (limites légales)',
    variant: 'secondary' as const,
    icon: Settings,
    description:
      'Cette politique peut être personnalisée dans les limites définies par la loi.',
  },
  freeform: {
    label: 'Personnalisé',
    fullLabel: 'Politique personnalisée',
    variant: 'outline' as const,
    icon: Palette,
    description:
      'Cette politique est entièrement personnalisable selon vos besoins internes.',
  },
  non_compliant: {
    label: 'Non conforme',
    fullLabel: 'Non conforme aux exigences légales',
    variant: 'destructive' as const,
    icon: AlertTriangle,
    description:
      'Cette politique ne respecte pas les exigences légales minimales.',
  },
};

export function ComplianceBadge({
  level,
  legalReference,
  className,
  showLabel = true,
}: ComplianceBadgeProps) {
  const config = badgeConfig[level] || {
    label: 'Inconnu',
    fullLabel: 'Niveau de conformité inconnu',
    variant: 'secondary' as const,
    icon: HelpCircle,
    description: 'Le niveau de conformité de cette politique est inconnu.',
  };

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={className}>
            <Icon className="mr-1.5 h-3 w-3" />
            {showLabel && config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{config.fullLabel}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {legalReference && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                Référence légale: {legalReference}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
