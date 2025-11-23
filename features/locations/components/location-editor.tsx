/**
 * Location Editor Form Component
 *
 * HCI Principles Applied:
 * - Smart Defaults: Pre-select "headquarters" as location type
 * - Error Prevention: Validate location code format (uppercase, no spaces)
 * - Progressive Disclosure: Hide GPS fields in "Options Avancées" collapsible
 * - Task-Oriented: Focus on "What is this site?" not technical fields
 * - Immediate Feedback: Show validation errors inline, success toast on save
 * - Touch Targets: All inputs ≥48px, buttons ≥44px, primary button 56px
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { trpc } from '@/lib/trpc/client';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { CI_CITIES, ABIDJAN_COMMUNES } from '@/lib/constants/ci-cities';

// Validation Schema
const locationSchema = z.object({
  locationCode: z
    .string()
    .min(1, 'Le code est requis')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Lettres majuscules, chiffres et tirets uniquement'),
  locationName: z.string().min(1, 'Le nom est requis').max(255),
  locationType: z.enum(['headquarters', 'branch', 'construction_site', 'client_site']),
  city: z.string().max(100).optional(),
  commune: z.string().max(100).optional(),
  transportAllowance: z.string().default('0'),
  mealAllowance: z.string().default('0'),
  sitePremium: z.string().default('0'),
  notes: z.string().optional(),
  // GPS fields (progressive disclosure)
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  // Additional address fields
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

type LocationEditorProps = {
  locationId?: string | null;
  onClose: () => void;
};

export function LocationEditor({ locationId, onClose }: LocationEditorProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [selectedCity, setSelectedCity] = useState<string>('');

  // Fetch location if editing
  const { data: location, isLoading: isLoadingLocation } = trpc.locations.get.useQuery(
    { id: locationId! },
    { enabled: !!locationId }
  );

  // Mutations
  const createMutation = trpc.locations.create.useMutation({
    onSuccess: () => {
      utils.locations.list.invalidate();
      toast({
        title: 'Site créé',
        description: 'Le site a été créé avec succès.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = trpc.locations.update.useMutation({
    onSuccess: () => {
      utils.locations.list.invalidate();
      toast({
        title: 'Site mis à jour',
        description: 'Le site a été mis à jour avec succès.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Form setup
  const form = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      locationCode: '',
      locationName: '',
      locationType: 'headquarters' as const, // SMART DEFAULT
      city: '',
      commune: '',
      transportAllowance: '0',
      mealAllowance: '0',
      sitePremium: '0',
      notes: '',
      latitude: '',
      longitude: '',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
    },
  });

  // Load location data when editing
  useEffect(() => {
    if (location) {
      const cityValue = location.city || '';
      setSelectedCity(cityValue);
      form.reset({
        locationCode: location.locationCode,
        locationName: location.locationName,
        locationType: location.locationType as 'headquarters' | 'branch' | 'construction_site' | 'client_site',
        city: cityValue,
        commune: location.commune || '',
        transportAllowance: location.transportAllowance || '0',
        mealAllowance: location.mealAllowance || '0',
        sitePremium: location.sitePremium || '0',
        notes: location.notes || '',
        latitude: location.latitude || '',
        longitude: location.longitude || '',
        addressLine1: location.addressLine1 || '',
        addressLine2: location.addressLine2 || '',
        postalCode: location.postalCode || '',
      });
    }
  }, [location, form]);

  const onSubmit = (data: any) => {
    if (locationId) {
      updateMutation.mutate({ id: locationId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoadingLocation && locationId) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{locationId ? 'Modifier le site' : 'Nouveau site'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px] min-w-[44px]">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Location Name */}
          <div className="space-y-2">
            <Label htmlFor="locationName">
              Nom du site <span className="text-destructive">*</span>
            </Label>
            <Input
              id="locationName"
              {...form.register('locationName')}
              placeholder="Siège Abidjan"
              className="min-h-[48px]"
            />
            {form.formState.errors.locationName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.locationName.message}
              </p>
            )}
          </div>

          {/* Location Code */}
          <div className="space-y-2">
            <Label htmlFor="locationCode">
              Code du site <span className="text-destructive">*</span>
            </Label>
            <Input
              id="locationCode"
              {...form.register('locationCode')}
              placeholder="ABJ-001"
              className="min-h-[48px] uppercase"
              onChange={(e) => {
                const upperValue = e.target.value.toUpperCase();
                e.target.value = upperValue;
                form.setValue('locationCode', upperValue);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Lettres majuscules, chiffres et tirets uniquement
            </p>
            {form.formState.errors.locationCode && (
              <p className="text-sm text-destructive">
                {form.formState.errors.locationCode.message}
              </p>
            )}
          </div>

          {/* Location Type */}
          <div className="space-y-2">
            <Label htmlFor="locationType">
              Type de site <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch('locationType')}
              onValueChange={(value) => form.setValue('locationType', value as any)}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="headquarters">Siège social</SelectItem>
                <SelectItem value="branch">Succursale</SelectItem>
                <SelectItem value="construction_site">Chantier de construction</SelectItem>
                <SelectItem value="client_site">Site client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Select
              value={selectedCity}
              onValueChange={(value) => {
                setSelectedCity(value);
                form.setValue('city', value);
                // Reset commune when changing city
                if (value !== 'Abidjan') {
                  form.setValue('commune', '');
                }
              }}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Sélectionnez la ville du site" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px]">
                {CI_CITIES.map((city) => (
                  <SelectItem key={city.value} value={city.value}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sélectionnez la ville du site
            </p>
          </div>

          {/* Commune (only for Abidjan) */}
          {selectedCity === 'Abidjan' && (
            <div className="space-y-2">
              <Label htmlFor="commune">Commune</Label>
              <Select
                value={form.watch('commune') || ''}
                onValueChange={(value) => form.setValue('commune', value)}
              >
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Précisez la commune (optionnel)" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {ABIDJAN_COMMUNES.map((commune) => (
                    <SelectItem key={commune.value} value={commune.value}>
                      {commune.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Précisez la commune (optionnel)
              </p>
            </div>
          )}

          {/* Indemnités Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Indemnités journalières</h3>

            {/* Transport Allowance */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="transportAllowance">Transport (FCFA/jour)</Label>
              <Input
                id="transportAllowance"
                type="number"
                min="0"
                step="100"
                {...form.register('transportAllowance')}
                placeholder="5000"
                className="min-h-[48px]"
              />
            </div>

            {/* Meal Allowance */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="mealAllowance">Repas (FCFA/jour)</Label>
              <Input
                id="mealAllowance"
                type="number"
                min="0"
                step="100"
                {...form.register('mealAllowance')}
                placeholder="3000"
                className="min-h-[48px]"
              />
            </div>

            {/* Site Premium */}
            <div className="space-y-2">
              <Label htmlFor="sitePremium">Prime mensuelle (FCFA)</Label>
              <Input
                id="sitePremium"
                type="number"
                min="0"
                step="1000"
                {...form.register('sitePremium')}
                placeholder="0"
                className="min-h-[48px]"
              />
              <p className="text-xs text-muted-foreground">
                Prime fixe mensuelle pour ce site
              </p>
            </div>
          </div>

          {/* Progressive Disclosure: Advanced Options */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px] justify-between"
              >
                <span>Options Avancées</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Adresse ligne 1</Label>
                <Input
                  id="addressLine1"
                  {...form.register('addressLine1')}
                  placeholder="123 Rue de la Paix"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Adresse ligne 2</Label>
                <Input
                  id="addressLine2"
                  {...form.register('addressLine2')}
                  placeholder="Appartement 4B"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  {...form.register('postalCode')}
                  placeholder="BP 1234"
                  className="min-h-[48px]"
                />
              </div>

              {/* GPS Coordinates */}
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude GPS</Label>
                <Input
                  id="latitude"
                  {...form.register('latitude')}
                  placeholder="5.3364"
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude GPS</Label>
                <Input
                  id="longitude"
                  {...form.register('longitude')}
                  placeholder="-4.0267"
                  className="min-h-[48px]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Informations supplémentaires..."
                  rows={3}
                  className="min-h-[96px]"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              className="flex-1 min-h-[56px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {locationId ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>{locationId ? 'Enregistrer' : 'Créer'}</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[56px]"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
