/**
 * Locations List Component
 *
 * HCI Principles Applied:
 * - Visual Hierarchy: Icons for location types (🏢, 🏗️, 🛡️)
 * - Cognitive Load: Show only essential info (name, code, city, allowances)
 * - Touch Targets: Edit button = 44px height minimum
 * - Graceful Degradation: Grid on desktop (3 columns), single column on mobile
 * - Progressive Disclosure: Allowances only shown if > 0
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md
 */

'use client';

import { MapPin, Edit, Building2, HardHat, Shield, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Location type configuration
const LOCATION_TYPE_ICONS = {
  headquarters: Home,
  branch: Building2,
  construction_site: HardHat,
  client_site: Shield,
} as const;

const LOCATION_TYPE_LABELS = {
  headquarters: 'Siège social',
  branch: 'Succursale',
  construction_site: 'Chantier',
  client_site: 'Site client',
} as const;

const LOCATION_TYPE_COLORS = {
  headquarters: 'text-blue-600 bg-blue-50',
  branch: 'text-green-600 bg-green-50',
  construction_site: 'text-orange-600 bg-orange-50',
  client_site: 'text-purple-600 bg-purple-50',
} as const;

type LocationType = 'headquarters' | 'branch' | 'construction_site' | 'client_site';

type Location = {
  id: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  city: string | null;
  transportAllowance: string;
  mealAllowance: string;
  sitePremium: string;
  isActive: boolean;
};

type LocationsListProps = {
  locations: Location[];
  onEdit: (locationId: string) => void;
};

export function LocationsList({ locations, onEdit }: LocationsListProps) {
  if (locations.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun site configuré</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {locations.map((location) => {
        const Icon = LOCATION_TYPE_ICONS[location.locationType] || MapPin;
        const typeLabel = LOCATION_TYPE_LABELS[location.locationType];
        const typeColor = LOCATION_TYPE_COLORS[location.locationType];

        // Calculate if there are any allowances to show
        const hasAllowances =
          Number(location.transportAllowance) > 0 ||
          Number(location.mealAllowance) > 0 ||
          Number(location.sitePremium) > 0;

        return (
          <Card key={location.id} className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-2 rounded-lg ${typeColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    {location.locationName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {location.locationCode}
                  </p>
                </div>
              </div>
              {!location.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactif
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">
                  {typeLabel}
                </Badge>
                {location.city && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{location.city}</span>
                  </div>
                )}

                {/* Allowances (only if > 0) */}
                {hasAllowances && (
                  <div className="pt-2 border-t space-y-1">
                    {Number(location.transportAllowance) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Transport/jour:</span>
                        <span className="font-medium">
                          {Number(location.transportAllowance).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    )}
                    {Number(location.mealAllowance) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Repas/jour:</span>
                        <span className="font-medium">
                          {Number(location.mealAllowance).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    )}
                    {Number(location.sitePremium) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Prime mensuelle:</span>
                        <span className="font-medium">
                          {Number(location.sitePremium).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px]"
                onClick={() => onEdit(location.id)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
