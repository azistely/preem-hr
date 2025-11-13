'use client';

/**
 * Active Tenant Badge Component
 *
 * Displays the currently active tenant with clear visual indication.
 * Used in headers, navigation bars, and dashboards.
 */

import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Country flag emoji mapping
 */
const COUNTRY_FLAGS: Record<string, string> = {
  CI: '🇨🇮',
  SN: '🇸🇳',
  BF: '🇧🇫',
  ML: '🇲🇱',
  TG: '🇹🇬',
  BJ: '🇧🇯',
  NE: '🇳🇪',
  GN: '🇬🇳',
};

/**
 * Get country name in French
 */
function getCountryName(code: string): string {
  const names: Record<string, string> = {
    CI: 'Côte d\'Ivoire',
    SN: 'Sénégal',
    BF: 'Burkina Faso',
    ML: 'Mali',
    TG: 'Togo',
    BJ: 'Bénin',
    NE: 'Niger',
    GN: 'Guinée',
  };
  return names[code] || code;
}

interface ActiveTenantBadgeProps {
  /** Display variant */
  variant?: 'default' | 'outline' | 'secondary';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show country name */
  showCountry?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ActiveTenantBadge({
  variant = 'default',
  size = 'md',
  showCountry = false,
  className,
}: ActiveTenantBadgeProps) {
  // Fetch current active tenant
  const { data: currentTenant, isLoading } = trpc.tenant.getActiveTenant.useQuery();

  // Loading state
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn('gap-2', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Chargement...</span>
      </Badge>
    );
  }

  // No active tenant
  if (!currentTenant) {
    return (
      <Badge variant="outline" className={cn('gap-2', className)}>
        <Building2 className="h-3 w-3" />
        <span className="text-xs">Aucune entreprise</span>
      </Badge>
    );
  }

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'gap-2 font-normal',
        sizeClasses[size],
        className
      )}
    >
      {/* Country Flag or Building Icon */}
      {COUNTRY_FLAGS[currentTenant.countryCode] ? (
        <span
          className={size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'}
          aria-label={currentTenant.name}
        >
          {COUNTRY_FLAGS[currentTenant.countryCode]}
        </span>
      ) : (
        <Building2 className={iconSizes[size]} />
      )}

      {/* Tenant Name */}
      <span className="font-medium truncate max-w-[200px]">
        {currentTenant.name}
      </span>

      {/* Country Name (optional) */}
      {showCountry && (
        <span className="text-muted-foreground font-normal">
          ({getCountryName(currentTenant.countryCode)})
        </span>
      )}
    </Badge>
  );
}
