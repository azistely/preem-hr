'use client';

/**
 * Tenant Switcher Component
 *
 * Dropdown menu for switching between tenants.
 * Follows HCI principles: clear visual hierarchy, large touch targets,
 * immediate feedback, zero learning curve.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, Check, ChevronDown, Loader2, Plus } from 'lucide-react';
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

interface TenantSwitcherProps {
  /** Display mode: 'full' shows name and icon, 'compact' shows only icon */
  variant?: 'full' | 'compact';
  /** Additional CSS classes */
  className?: string;
  /** Callback when dropdown open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function TenantSwitcher({ variant = 'full', className, onOpenChange }: TenantSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Handle dropdown open state change
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Fetch available tenants
  const { data: tenants, isLoading: isLoadingTenants } = trpc.tenant.listUserTenants.useQuery();

  // Fetch current active tenant
  const { data: currentTenant } = trpc.tenant.getActiveTenant.useQuery();

  // Fetch current user (to check role for create permission)
  const { data: currentUser } = trpc.auth.me.useQuery();

  // Switch tenant mutation
  const switchTenantMutation = trpc.tenant.switchTenant.useMutation({
    onSuccess: () => {
      // Refresh the page to update context
      window.location.reload();
    },
    onError: (error) => {
      console.error('Failed to switch tenant:', error);
      alert(`Erreur lors du changement d'entreprise: ${error.message}`);
      setSwitchingTo(null);
    },
  });

  const handleSwitchTenant = async (tenantId: string) => {
    if (tenantId === currentTenant?.id) {
      handleOpenChange(false);
      return;
    }

    setSwitchingTo(tenantId);
    try {
      await switchTenantMutation.mutateAsync({ tenantId });
    } catch (error) {
      // Error handled in mutation callback
    }
  };

  // Loading state
  if (isLoadingTenants || !currentTenant) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {variant === 'full' && <span className="ml-2">Chargement...</span>}
      </Button>
    );
  }

  // Single tenant - no switcher needed
  if (!tenants || tenants.length <= 1) {
    if (variant === 'compact') {
      return (
        <div className={cn('flex items-center justify-center', className)}>
          <span className="text-2xl" aria-label={currentTenant.name}>
            {COUNTRY_FLAGS[currentTenant.countryCode] || '🏢'}
          </span>
        </div>
      );
    }

    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <span className="text-xl" aria-label={currentTenant.name}>
          {COUNTRY_FLAGS[currentTenant.countryCode] || '🏢'}
        </span>
        <span className="font-medium text-sm truncate max-w-[200px]">
          {currentTenant.name}
        </span>
      </div>
    );
  }

  // Multi-tenant dropdown
  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center gap-2 min-h-[44px]', // Touch-friendly height
            variant === 'full' ? 'px-3' : 'px-2',
            className
          )}
        >
          {/* Current Tenant Display */}
          {variant === 'full' ? (
            <>
              <span className="text-xl" aria-label={currentTenant.name}>
                {COUNTRY_FLAGS[currentTenant.countryCode] || <Building2 className="h-4 w-4" />}
              </span>
              <span className="font-medium text-sm truncate max-w-[150px]">
                {currentTenant.name}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </>
          ) : (
            <>
              <span className="text-xl" aria-label={currentTenant.name}>
                {COUNTRY_FLAGS[currentTenant.countryCode] || <Building2 className="h-4 w-4" />}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Changer d'entreprise</p>
            <p className="text-xs leading-none text-muted-foreground">
              {tenants.length} {tenants.length === 1 ? 'entreprise' : 'entreprises'} disponible{tenants.length > 1 ? 's' : ''}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Tenant List */}
        {tenants.map((tenant) => {
          const isActive = tenant.id === currentTenant?.id;
          const isSwitching = switchingTo === tenant.id;

          return (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => handleSwitchTenant(tenant.id)}
              className={cn(
                'flex items-center gap-3 py-3 cursor-pointer min-h-[44px]', // Touch-friendly
                isActive && 'bg-accent'
              )}
              disabled={isSwitching}
            >
              {/* Country Flag */}
              <span className="text-2xl" aria-label={tenant.name}>
                {COUNTRY_FLAGS[tenant.countryCode] || '🏢'}
              </span>

              {/* Tenant Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{tenant.name}</p>
                  {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tenant.userRole === 'tenant_admin' && 'Administrateur'}
                  {tenant.userRole === 'hr_manager' && 'Responsable RH'}
                  {tenant.userRole === 'manager' && 'Manager'}
                  {tenant.userRole === 'employee' && 'Employé'}
                </p>
              </div>

              {/* Loading Indicator */}
              {isSwitching && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}

        {/* Create New Company Option (for tenant_admin or super_admin) */}
        {currentUser && ['tenant_admin', 'super_admin'].includes(currentUser.role) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                handleOpenChange(false);
                router.push('/settings/companies/new');
              }}
              className="flex items-center gap-3 py-3 cursor-pointer min-h-[44px] text-primary"
            >
              <Plus className="h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Créer une nouvelle entreprise</p>
                <p className="text-xs text-muted-foreground">
                  Ajouter une entreprise à gérer
                </p>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
