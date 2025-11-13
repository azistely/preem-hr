'use client';

/**
 * Tenant Selector Page
 *
 * Full-page tenant selection interface for users with access to multiple tenants.
 * Follows HCI principles: large touch targets, clear visual hierarchy, zero learning curve.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Check, Loader2 } from 'lucide-react';
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

export default function SelectTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin/dashboard';

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available tenants
  const { data: tenantsData, isLoading: isLoadingTenants } = trpc.tenant.listUserTenants.useQuery();

  // Fetch current active tenant to show which one is selected
  const { data: activeTenant } = trpc.tenant.getActiveTenant.useQuery();

  // Switch tenant mutation
  const switchTenantMutation = trpc.tenant.switchTenant.useMutation({
    onSuccess: () => {
      // Refresh the page to update context
      window.location.href = redirectTo;
    },
    onError: (error) => {
      console.error('Failed to switch tenant:', error);
      setIsLoading(false);
      alert(`Erreur lors du changement d'entreprise: ${error.message}`);
    },
  });

  // Auto-select if user only has one tenant
  useEffect(() => {
    if (tenantsData && tenantsData.length === 1 && !activeTenant) {
      handleSelectTenant(tenantsData[0].id);
    }
  }, [tenantsData, activeTenant]);

  const handleSelectTenant = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setIsLoading(true);

    try {
      await switchTenantMutation.mutateAsync({ tenantId });
    } catch (error) {
      // Error handled in mutation callback
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoadingTenants) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // No tenants available
  if (!tenantsData || tenantsData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Aucune entreprise disponible</CardTitle>
            <CardDescription>
              Vous n'avez accès à aucune entreprise. Contactez votre administrateur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Sélectionnez une entreprise
          </h1>
          <p className="text-lg text-muted-foreground">
            {tenantsData.length === 1
              ? 'Vous avez accès à 1 entreprise'
              : `Vous avez accès à ${tenantsData.length} entreprises`}
          </p>
        </div>

        {/* Tenant Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenantsData.map((tenant) => {
            const isActive = activeTenant?.id === tenant.id;
            const isSelected = selectedTenantId === tenant.id;
            const isLoadingThis = isLoading && isSelected;

            return (
              <Card
                key={tenant.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                  'min-h-[120px]', // Ensure good touch target size
                  isActive && 'ring-2 ring-primary',
                  isSelected && 'ring-2 ring-primary bg-primary/5'
                )}
                onClick={() => !isLoading && handleSelectTenant(tenant.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Country Flag */}
                      <span className="text-4xl" aria-label={getCountryName(tenant.countryCode)}>
                        {COUNTRY_FLAGS[tenant.countryCode] || '🏢'}
                      </span>

                      {/* Tenant Info */}
                      <div>
                        <CardTitle className="text-xl mb-1">{tenant.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {getCountryName(tenant.countryCode)}
                        </CardDescription>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {isActive && (
                      <div className="flex items-center gap-1 text-primary text-sm font-medium">
                        <Check className="h-4 w-4" />
                        <span>Active</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Role Badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      tenant.userRole === 'tenant_admin' && 'bg-purple-100 text-purple-800',
                      tenant.userRole === 'hr_manager' && 'bg-blue-100 text-blue-800',
                      tenant.userRole === 'manager' && 'bg-green-100 text-green-800',
                      tenant.userRole === 'employee' && 'bg-gray-100 text-gray-800'
                    )}>
                      {tenant.userRole === 'tenant_admin' && 'Administrateur'}
                      {tenant.userRole === 'hr_manager' && 'Responsable RH'}
                      {tenant.userRole === 'manager' && 'Manager'}
                      {tenant.userRole === 'employee' && 'Employé'}
                    </span>

                    {isLoadingThis && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Vous pouvez changer d'entreprise à tout moment depuis le menu principal
          </p>
        </div>
      </div>
    </div>
  );
}
